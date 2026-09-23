import { buildRoundingPreviewModel } from './buildRoundingPreviewModel';
import { VIEW, COLORS, arcPath } from './previewGeometry';
import styles from './preview.module.css';

function ArcSVG({ cx, cy, r, a1, a2, style }) {
  const { x1, y1, x2, y2, la } = arcPath(cx, cy, r, a1, a2);
  return <path d={`M ${x1},${y1} A ${r},${r} 0 ${la},1 ${x2},${y2}`} fill="none" {...style} />;
}

export default function RoundingEdgePreview({ params, solved, activeParamId }) {
  if (!params || !solved) {
    return <div className={styles.placeholder}>Ajuste os parâmetros para visualizar o preview</div>;
  }

  const m = buildRoundingPreviewModel(params, solved);
  const active = activeParamId;
  const idle = !active;
  const h = m.highlights;

  const dimStyle = (id) => ({
    stroke: active === id ? COLORS.active : COLORS.dimLine,
    strokeWidth: active === id ? 2 : 1,
    opacity: idle || active === id ? 1 : 0.12,
  });
  const labelFill = (id) => (active === id ? COLORS.active : COLORS.label);
  const show = (id) => (idle || active === id);

  const { floor, wall, arc } = m.piece;

  return (
    <svg viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} className={styles.svg} preserveAspectRatio="xMidYMid meet" style={{ background: COLORS.bg }}>
      {/* ── Peça: piso + parede, com concordância côncava no canto ── */}
      <path
        d={`M ${floor.l},${floor.b}
            L ${floor.r},${floor.b}
            L ${floor.r},${wall.t}
            L ${wall.l},${wall.t}
            L ${wall.l},${arc.from[1]}
            A ${arc.r},${arc.r} 0 0,1 ${arc.to[0]},${arc.to[1]}
            L ${floor.l},${floor.t} Z`}
        fill={COLORS.piece}
        stroke={COLORS.pieceEdge}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* ── Ferramenta (posicionada por tangência) ── */}
      <g>
        <rect
          x={m.tool.shankX} y={m.tool.shankTop}
          width={m.tool.shankW} height={m.tool.shankH}
          fill={COLORS.toolFill}
          stroke={COLORS.toolEdge}
          strokeWidth="0.8"
        />
        <rect
          x={m.tool.left} y={m.tool.top}
          width={m.tool.width} height={m.tool.height}
          rx={m.tool.cornerR} ry={m.tool.cornerR}
          fill={COLORS.toolFill}
          stroke={COLORS.toolEdge}
          strokeWidth="1.2"
        />
        <line
          x1={m.tool.left} y1={m.tool.bottom}
          x2={m.tool.right} y2={m.tool.bottom}
          stroke={COLORS.toolBase}
          strokeWidth="3"
          strokeLinecap="round"
        />
        <ArcSVG
          cx={m.tangency.center[0]} cy={m.tangency.center[1]}
          r={m.tangency.radius}
          a1={0} a2={Math.PI / 2}
          style={{ stroke: COLORS.toolBase, strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round' }}
        />
      </g>

      {/* ── Indicador de tangência ── */}
      {idle && (
        <g opacity="0.4">
          <line
            x1={m.tangency.center[0]} y1={m.tangency.center[1]}
            x2={m.tangency.point[0]} y2={m.tangency.point[1]}
            stroke={COLORS.contact} strokeWidth="0.8" strokeDasharray="2,2"
          />
          <circle cx={m.tangency.point[0]} cy={m.tangency.point[1]} r="2.5" fill={COLORS.contact} />
        </g>
      )}

      {/* ── Pontos de referência da ferramenta (centro + cantos) ── */}
      <g opacity="0.85">
        <circle cx={m.markers.center[0]} cy={m.markers.center[1]} r="2.4" fill={COLORS.toolEdge} />
        <circle cx={m.markers.refA[0]} cy={m.markers.refA[1]} r="2.2" fill="none" stroke={COLORS.toolEdge} strokeWidth="1" />
        <circle cx={m.markers.refB[0]} cy={m.markers.refB[1]} r="2.2" fill="none" stroke={COLORS.toolEdge} strokeWidth="1" />
      </g>

      {/* ── Cotas ── */}

      {show('L') && (
        <g opacity={idle ? 0.5 : 1}>
          <line x1={h.L.pts[0]} y1={h.L.pts[1]} x2={h.L.pts[2]} y2={h.L.pts[3]} {...dimStyle('L')} />
          <line x1={h.L.pts[0]} y1={h.L.pts[1] - 4} x2={h.L.pts[0]} y2={h.L.pts[1] + 4} {...dimStyle('L')} />
          <line x1={h.L.pts[2]} y1={h.L.pts[3] - 4} x2={h.L.pts[2]} y2={h.L.pts[3] + 4} {...dimStyle('L')} />
          {active === 'L' && <rect x={h.L.pts[0]} y={h.L.cy - 2} width={h.L.pts[2] - h.L.pts[0]} height={16} fill={COLORS.activeGlow} rx="2" />}
          <text x={h.L.cx} y={h.L.cy} fill={labelFill('L')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="middle">{active === 'L' ? h.L.label : 'L'}</text>
        </g>
      )}

      {show('R') && (
        <g opacity={idle ? 0.4 : 1}>
          <ArcSVG cx={h.R.arc.cx} cy={h.R.arc.cy} r={h.R.arc.r} a1={h.R.arc.a1} a2={h.R.arc.a2} style={dimStyle('R')} />
          <line x1={h.R.arc.cx} y1={h.R.arc.cy} x2={h.R.arc.cx + h.R.arc.r * 0.35} y2={h.R.arc.cy - h.R.arc.r * 0.35} {...dimStyle('R')} strokeDasharray="3,3" />
          <text x={h.R.cx} y={h.R.cy} fill={labelFill('R')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="middle">{active === 'R' ? h.R.label : 'R'}</text>
        </g>
      )}

      {show('D') && (
        <g opacity={idle ? 0.5 : 1}>
          <line x1={h.D.pts[0]} y1={h.D.pts[1]} x2={h.D.pts[2]} y2={h.D.pts[3]} {...dimStyle('D')} />
          <line x1={h.D.pts[0] - 3} y1={h.D.pts[1]} x2={h.D.pts[0] + 3} y2={h.D.pts[1]} {...dimStyle('D')} />
          <line x1={h.D.pts[2] - 3} y1={h.D.pts[3]} x2={h.D.pts[2] + 3} y2={h.D.pts[3]} {...dimStyle('D')} />
          {active === 'D' && <rect x={h.D.pts[0] - 2} y={h.D.pts[1] - 2} width={50} height={h.D.pts[3] - h.D.pts[1] + 4} fill={COLORS.activeGlow} rx="2" />}
          <text x={h.D.cx} y={h.D.cy} fill={labelFill('D')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="start">{active === 'D' ? h.D.label : 'D'}</text>
        </g>
      )}

      {show('r') && (
        <g opacity={idle ? 0.4 : 1}>
          <ArcSVG cx={h.r.arc.cx} cy={h.r.arc.cy} r={h.r.arc.r} a1={h.r.arc.a1} a2={h.r.arc.a2} style={dimStyle('r')} />
          <line x1={h.r.arc.cx - h.r.arc.r} y1={h.r.arc.cy} x2={h.r.arc.cx - h.r.arc.r - 6} y2={h.r.arc.cy} {...dimStyle('r')} />
          <text x={h.r.cx} y={h.r.cy} fill={labelFill('r')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="end">{active === 'r' ? h.r.label : 'r'}</text>
        </g>
      )}

      {show('incrZ') && (
        <g opacity={idle ? 0.4 : 1}>
          <line x1={h.incrZ.pts[0]} y1={h.incrZ.pts[1]} x2={h.incrZ.pts[2]} y2={h.incrZ.pts[3]} {...dimStyle('incrZ')} />
          <line x1={h.incrZ.pts[0] - 4} y1={h.incrZ.pts[1]} x2={h.incrZ.pts[0] + 4} y2={h.incrZ.pts[1]} {...dimStyle('incrZ')} />
          <line x1={h.incrZ.pts[0] - 4} y1={h.incrZ.pts[3]} x2={h.incrZ.pts[0] + 4} y2={h.incrZ.pts[3]} {...dimStyle('incrZ')} />
          {active === 'incrZ' && <rect x={h.incrZ.pts[0] - 8} y={h.incrZ.pts[3]} width={18} height={h.incrZ.pts[1] - h.incrZ.pts[3]} fill={COLORS.activeGlow} rx="2" />}
          <text x={h.incrZ.cx} y={h.incrZ.cy} fill={labelFill('incrZ')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="end">{active === 'incrZ' ? h.incrZ.label : 'dZ'}</text>
        </g>
      )}
    </svg>
  );
}
