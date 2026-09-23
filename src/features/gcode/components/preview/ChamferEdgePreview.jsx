import { getChamferPreviewLayout, getActiveHighlight } from './chamferPreviewHelpers';
import styles from './preview.module.css';

const C = {
  bg: '#0a0c0f',
  piece: '#1e3048',
  pieceEdge: '#3a5f7a',
  toolFill: 'rgba(56,189,248,0.12)',
  toolEdge: '#38bdf8',
  toolBase: '#38bdf8',
  dimLine: '#4a6a8a',
  active: '#f0a500',
  activeGlow: 'rgba(240,165,0,0.18)',
  label: '#6a8aaa',
};

function Arc({ cx, cy, r, a1, a2, style }) {
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const la = a2 - a1 > Math.PI ? 1 : 0;
  return <path d={`M ${x1},${y1} A ${r},${r} 0 ${la},1 ${x2},${y2}`} fill="none" {...style} />;
}

export default function ChamferEdgePreview({ params, solved, activeParamId }) {
  if (!params || !solved) {
    return <div className={styles.placeholder}>Ajuste os parâmetros para visualizar o preview</div>;
  }

  const l = getChamferPreviewLayout(params, solved);
  const active = activeParamId;
  const idle = !active;

  const dimStyle = (id) => ({
    stroke: active === id ? C.active : C.dimLine,
    strokeWidth: active === id ? 2 : 1,
    opacity: idle || active === id ? 1 : 0.15,
  });

  const labelFill = (id) => (active === id ? C.active : C.label);
  const show = (id) => (idle || active === id);

  return (
    <svg viewBox="0 0 400 280" className={styles.svg} preserveAspectRatio="xMidYMid meet" style={{ background: C.bg }}>
      {/* ── Peça (bloco sólido, esquerda) ── */}
      <polygon
        points={`${l.wpL},${l.wpB} ${l.wpR},${l.wpB} ${l.wpR},${l.wpT} ${l.fx},${l.fy} ${l.wpL},${l.fy}`}
        fill={C.piece}
        stroke={C.pieceEdge}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* ── Ferramenta (translúcida, direita, dominante) ── */}
      <g>
        {/* Haste superior */}
        <rect
          x={l.tL + l.tW * 0.28}
          y={l.tT - l.tH * 0.35}
          width={l.tW * 0.44}
          height={l.tH * 0.35}
          fill={C.toolFill}
          stroke={C.toolEdge}
          strokeWidth="0.8"
        />
        {/* Corpo principal */}
        <rect
          x={l.tL} y={l.tT}
          width={l.tW} height={l.tH}
          rx={l.rPx} ry={l.rPx}
          fill={C.toolFill}
          stroke={C.toolEdge}
          strokeWidth="1.2"
        />
        {/* Base inferior (linha azul forte) */}
        <line
          x1={l.tL} y1={l.tB}
          x2={l.tR} y2={l.tB}
          stroke={C.toolBase}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Canto arredondado inferior esquerdo */}
        <path
          d={`M ${l.tL + l.rPx},${l.tB} A ${l.rPx},${l.rPx} 0 0,0 ${l.tL},${l.tB - l.rPx}`}
          fill="none"
          stroke={C.toolBase}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </g>

      {/* ── Cotas (só ativas, ou todas discretas se idle) ── */}

      {/* L — comprimento (topo) */}
      {show('L') && (
        <g opacity={idle ? 0.5 : 1}>
          <line x1={l.wpL} y1={l.wpT - 18} x2={l.wpR} y2={l.wpT - 18} {...dimStyle('L')} />
          <line x1={l.wpL} y1={l.wpT - 14} x2={l.wpL} y2={l.wpT - 24} {...dimStyle('L')} />
          <line x1={l.wpR} y1={l.wpT - 14} x2={l.wpR} y2={l.wpT - 24} {...dimStyle('L')} />
          {active === 'L' && <rect x={l.wpL} y={l.wpT - 28} width={l.wpR - l.wpL} height={16} fill={C.activeGlow} rx="2" />}
          <text x={(l.wpL + l.wpR) / 2} y={l.wpT - 26} fill={labelFill('L')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="middle">{active === 'L' ? `L=${l.params.L}` : 'L'}</text>
        </g>
      )}

      {/* C — largura do chanfro */}
      {show('C') && (
        <g opacity={idle ? 0.4 : 1}>
          <line x1={l.vx} y1={l.vy} x2={l.fx} y2={l.fy} {...dimStyle('C')} strokeDasharray={active === 'C' ? 'none' : '3,3'} />
          <circle cx={l.vx} cy={l.vy} r="2.5" fill={active === 'C' ? C.active : C.dimLine} />
          <circle cx={l.fx} cy={l.fy} r="2.5" fill={active === 'C' ? C.active : C.dimLine} />
          {active === 'C' && <rect x={Math.min(l.vx, l.fx) - 4} y={Math.min(l.vy, l.fy) - 14} width={Math.abs(l.vx - l.fx) + 8} height={18} fill={C.activeGlow} rx="2" />}
          <text x={(l.vx + l.fx) / 2 - 14} y={(l.vy + l.fy) / 2 - 8} fill={labelFill('C')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="middle">{active === 'C' ? `C=${l.params.C}` : 'C'}</text>
        </g>
      )}

      {/* A — ângulo */}
      {show('A') && (
        <g opacity={idle ? 0.4 : 1}>
          <Arc cx={l.vx} cy={l.vy} r={Math.min(20, l.chamPx * 0.4)} a1={0} a2={l.params.A * Math.PI / 180} style={dimStyle('A')} />
          <text x={l.vx + Math.min(20, l.chamPx * 0.4) + 6} y={l.vy - 8} fill={labelFill('A')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="start">{active === 'A' ? `${l.params.A}°` : '∠'}</text>
        </g>
      )}

      {/* D — diâmetro da fresa */}
      {show('D') && (
        <g opacity={idle ? 0.5 : 1}>
          <line x1={l.tR + 10} y1={l.tT + 8} x2={l.tR + 10} y2={l.tB - 8} {...dimStyle('D')} />
          <line x1={l.tR + 7} y1={l.tT + 8} x2={l.tR + 13} y2={l.tT + 8} {...dimStyle('D')} />
          <line x1={l.tR + 7} y1={l.tB - 8} x2={l.tR + 13} y2={l.tB - 8} {...dimStyle('D')} />
          {active === 'D' && <rect x={l.tR + 7} y={l.tT + 4} width={50} height={l.tB - l.tT - 12} fill={C.activeGlow} rx="2" />}
          <text x={l.tR + 26} y={(l.tT + l.tB) / 2 + 4} fill={labelFill('D')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="start">{active === 'D' ? `D=${l.params.D}` : 'D'}</text>
        </g>
      )}

      {/* r — raio de canto */}
      {show('r') && (
        <g opacity={idle ? 0.4 : 1}>
          <Arc cx={l.tL} cy={l.tB} r={l.rPx} a1={Math.PI} a2={1.5 * Math.PI} style={dimStyle('r')} />
          <line x1={l.tL} y1={l.tB - l.rPx} x2={l.tL - 6} y2={l.tB - l.rPx} {...dimStyle('r')} />
          <text x={l.tL - 10} y={l.tB - l.rPx + 4} fill={labelFill('r')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="end">{active === 'r' ? `r=${l.params.r}` : 'r'}</text>
        </g>
      )}

      {/* passeZ — profundidade */}
      {show('passeZ') && (
        <g opacity={idle ? 0.4 : 1}>
          <line x1={l.wpL - 20} y1={l.vy} x2={l.wpL - 20} y2={l.fy} {...dimStyle('passeZ')} />
          <line x1={l.wpL - 16} y1={l.vy} x2={l.wpL - 24} y2={l.vy} {...dimStyle('passeZ')} />
          <line x1={l.wpL - 16} y1={l.fy} x2={l.wpL - 24} y2={l.fy} {...dimStyle('passeZ')} />
          {active === 'passeZ' && <rect x={l.wpL - 28} y={l.fy} width={18} height={l.vy - l.fy} fill={C.activeGlow} rx="2" />}
          <text x={l.wpL - 28} y={(l.vy + l.fy) / 2 + 4} fill={labelFill('passeZ')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="end">{active === 'passeZ' ? `pZ=${l.params.passeZ}` : 'pZ'}</text>
        </g>
      )}
    </svg>
  );
}
