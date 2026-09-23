import { VIEW, COLORS } from '../../heidenhain/preview/previewGeometry';
import { fitTransform } from '../../heidenhain/preview/previewLayout';
import styles from '../RoscasPage.module.css';

function fmt(v) {
  return Number(v).toFixed(2).replace('.', ',');
}

function DoubleArrow({ x1, y1, x2, y2, color, label, dx = 0, dy = 0 }) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const ux = (x2 - x1) / (len || 1);
  const uy = (y2 - y1) / (len || 1);
  const head = 7;
  const tip = (s) =>
    `${x2 - ux * s},${y2 - uy * s} ${x2 - ux * s - uy * head * 0.45},${y2 - uy * s + ux * head * 0.45} ${x2 - ux * s + uy * head * 0.45},${y2 - uy * s - ux * head * 0.45}`;
  const tip2 = (s) =>
    `${x1 + ux * s},${y1 + uy * s} ${x1 + ux * s - uy * head * 0.45},${y1 + uy * s + ux * head * 0.45} ${x1 + ux * s + uy * head * 0.45},${y1 + uy * s - ux * head * 0.45}`;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.4" strokeDasharray="4 3" />
      <polygon points={tip(1)} fill={color} />
      <polygon points={tip2(1)} fill={color} />
      <text x={(x1 + x2) / 2 + dx} y={(y1 + y2) / 2 + dy} fill={color} fontSize="12" textAnchor="middle" fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}

export default function ThreadPreview({ model }) {
  if (!model) {
    return (
      <div className={styles.previewBox}>
        <div className={styles.previewEmpty}>Selecione uma rosca e preencha os parametros.</div>
      </div>
    );
  }

  const t = model.thread;
  const isHelical = model.method === 'helical';
  const zStart = model.zStart;
  const zThreadEnd = model.zEnd; // fim da rosca = zStart − prof. da rosca
  const holeDepth = Number.isFinite(Number(model.holeDepth)) ? Number(model.holeDepth) : model.depth;
  const zHoleEnd = zStart - holeDepth; // fundo do furo cego
  const safety = model.safety || 0;

  const partW = Math.max(t.nominal * 3, t.hole + 30);
  const partTop = zStart + safety + 3;
  const partBottom = zHoleEnd - 4;

  const pts = [
    { x: -partW / 2, z: partTop },
    { x: partW / 2, z: partTop },
    { x: -partW / 2, z: partBottom },
    { x: partW / 2, z: partBottom },
    ...model.trajectory.points,
  ];

  const t2 = fitTransform(pts, VIEW.W, VIEW.H, 70, 46, -1);
  const X = (x) => t2.xOf(x);
  const Y = (z) => t2.yOf(z);
  const cx = X(0);

  const holeX1 = X(-t.hole / 2);
  const holeX2 = X(t.hole / 2);
  const holeW = holeX2 - holeX1;
  const holeTop = Y(zStart);
  const threadBottom = Y(zThreadEnd);
  const holeBot = Y(zHoleEnd);

  // marcas de rosca (1 por passo, na zona roscada)
  const threadMarks = [];
  if (t.pitch > 0) {
    for (let z = zStart; z > zThreadEnd - 1e-9; z -= t.pitch) {
      threadMarks.push(z);
    }
  }

  return (
    <div className={styles.previewBox}>
      <svg viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} width="100%" height="auto" role="img" aria-label="Preview da rosca">
        <rect x="0" y="0" width={VIEW.W} height={VIEW.H} fill={COLORS.bg} />

        {/* eixos */}
        <line x1={X(-partW / 2 - 10)} y1={Y(0)} x2={X(partW / 2 + 10)} y2={Y(0)} stroke={COLORS.axis} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        <line x1={cx} y1={Y(partTop + 6)} x2={cx} y2={Y(partBottom - 6)} stroke={COLORS.axis} strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
        <text x={X(partW / 2 + 6)} y={Y(0) - 5} fill={COLORS.axisLabel} fontSize="11" fontFamily="monospace">X</text>
        <text x={cx + 5} y={Y(partTop + 4)} fill={COLORS.axisLabel} fontSize="11" fontFamily="monospace">Z-</text>

        {/* peça */}
        <rect
          x={X(-partW / 2)}
          y={Y(partTop)}
          width={X(partW / 2) - X(-partW / 2)}
          height={Y(partBottom) - Y(partTop)}
          fill={COLORS.piece}
          stroke={COLORS.pieceEdge}
          strokeWidth="1.2"
        />

        {/* furo cego: da boca até a profundidade total do furo */}
        <rect x={holeX1} y={holeTop} width={holeW} height={holeBot - holeTop} fill="#0a0e14" stroke="#1f3a55" strokeWidth="1" />

        {/* zona da ROSCA (profundidade útil) */}
        <rect x={holeX1} y={holeTop} width={holeW} height={threadBottom - holeTop} fill="#1a2f22" stroke={COLORS.trajectoryLine} strokeWidth="1" strokeDasharray="3 2" opacity="0.85" />
        {threadMarks.map((z) => (
          <line key={z} x1={holeX1 + 2} y1={Y(z)} x2={holeX2 - 2} y2={Y(z)} stroke={COLORS.trajectoryLine} strokeWidth="1" opacity="0.8" />
        ))}
        <text x={holeX2 - 8} y={(holeTop + threadBottom) / 2} fill={COLORS.label} fontSize="10" textAnchor="end" fontFamily="monospace">ROSCA</text>

        {/* zona de FOLGA (fundo do furo) */}
        {threadBottom !== holeBot && (
          <>
            <rect x={holeX1} y={threadBottom} width={holeW} height={holeBot - threadBottom} fill="#14202c" stroke={COLORS.dimLine} strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <text x={holeX1 + 8} y={(threadBottom + holeBot) / 2} fill={COLORS.dimLine} fontSize="10" fontFamily="monospace">FOLGA</text>
          </>
        )}

        {/* trajetória calculada */}
        <polyline
          points={model.trajectory.points.map((p) => `${X(p.x)},${Y(p.z)}`).join(' ')}
          fill="none"
          stroke={isHelical ? COLORS.active : COLORS.trajectoryLine}
          strokeWidth={isHelical ? 2 : 1.6}
          strokeDasharray={isHelical ? '1 4' : '6 4'}
        />

        {isHelical && (
          <>
            {/* raio de interpolação */}
            <line x1={cx} y1={Y(zStart)} x2={X(model.radius)} y2={Y(zStart)} stroke={COLORS.dimLine} strokeWidth="1.2" strokeDasharray="4 3" />
            {/* ferramenta no fim */}
            <circle cx={X(model.radius)} cy={Y(zThreadEnd)} r={Math.max(3, (model.toolDiameter / 2) * t2.scale)} fill={COLORS.toolFill} stroke={COLORS.toolEdge} strokeWidth="1.4" />
            {/* top view: sentido */}
            <g transform={`translate(${VIEW.W - 150},${VIEW.H - 140})`}>
              <circle r="52" fill="#0a0e14" stroke={COLORS.pieceEdge} />
              <circle r="36" fill="none" stroke={COLORS.active} strokeWidth="1.4" strokeDasharray="4 3" />
              <path
                d="M -26 0 A 26 26 0 1 1 19 -18"
                fill="none"
                stroke={COLORS.active}
                strokeWidth="2"
                markerEnd="url(#arrowCw)"
              />
              <text x="0" y="34" fill={COLORS.label} fontSize="11" textAnchor="middle" fontFamily="monospace">
                {model.direction === 'cw' ? 'sentido horario' : 'sentido anti-horario'}
              </text>
              <text x="0" y="48" fill={COLORS.label} fontSize="10" textAnchor="middle" fontFamily="monospace">(vista superior)</text>
              <defs>
                <marker id="arrowCw" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill={COLORS.active} />
                </marker>
              </defs>
            </g>
          </>
        )}

        {/* cota da profundidade total do furo */}
        <DoubleArrow
          x1={holeX2 + 24}
          y1={holeTop}
          x2={holeX2 + 24}
          y2={holeBot}
          color={COLORS.chamfer}
          label={`prof. furo ${fmt(holeDepth)} mm`}
          dx={0}
          dy={-8}
        />

        {/* cota da profundidade útil da rosca */}
        <DoubleArrow
          x1={holeX2 + 24}
          y1={holeTop}
          x2={holeX2 + 24}
          y2={threadBottom}
          color={COLORS.trajectoryLine}
          label={`prof. rosca ${fmt(model.depth)} mm`}
          dx={0}
          dy={8}
        />

        {/* cota do passo */}
        <DoubleArrow
          x1={holeX1 - 24}
          y1={Y(zStart)}
          x2={holeX1 - 24}
          y2={Y(zStart - model.pitch)}
          color={COLORS.dimLine}
          label={`passo ${fmt(model.pitch)} mm`}
          dx={-4}
          dy={-6}
        />

        {/* legenda de dados */}
        <text x={16} y={22} fill={COLORS.axisLabel} fontSize="13" fontFamily="monospace">
          {model.designation} · {isHelical ? 'interpolação helicoidal' : 'rosca rígida (CYCL 207)'}
        </text>
        <text x={16} y={40} fill={COLORS.label} fontSize="12" fontFamily="monospace">
          Ø nominal {fmt(model.nominal)} mm · Ø furo {fmt(t.hole)} mm
          {isHelical ? ` · raio ${fmt(model.radius)} mm` : ''}
        </text>
        {model.holeRule && (
          <text x={16} y={58} fill={COLORS.dimLine} fontSize="11" fontFamily="monospace">
            furo cego {fmt(holeDepth)} mm — {model.holeRule.formula}
          </text>
        )}
      </svg>
    </div>
  );
}