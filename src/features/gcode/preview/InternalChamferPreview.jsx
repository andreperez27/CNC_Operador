import { buildInternalChamferPreviewModel } from './buildInternalChamferPreviewModel';
import { VIEW, COLORS, arcPath } from './previewGeometry';
import styles from './preview.module.css';

function ArcSVG({ cx, cy, r, a1, a2, style }) {
  const { x1, y1, x2, y2, la } = arcPath(cx, cy, r, a1, a2);
  return <path d={`M ${x1},${y1} A ${r},${r} 0 ${la},1 ${x2},${y2}`} fill="none" {...style} />;
}

export default function InternalChamferPreview({ params, solved, activeParamId }) {
  if (!params || !solved) {
    return <div className={styles.placeholder}>Ajuste os parâmetros para visualizar o preview</div>;
  }

  const m = buildInternalChamferPreviewModel(params, solved);
  const active = activeParamId;
  const idle = !active;
  const h = m.highlights;
  const cav = m.cavity;

  const dimStyle = (id) => ({
    stroke: active === id ? COLORS.active : COLORS.dimLine,
    strokeWidth: active === id ? 2 : 1,
    opacity: idle || active === id ? 1 : 0.12,
  });
  const labelFill = (id) => (active === id ? COLORS.active : COLORS.label);
  const show = (id) => (idle || active === id);
  const glowFill = (id) => (active === id ? COLORS.activeGlow : 'transparent');

  return (
    <svg viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} className={styles.svg} preserveAspectRatio="xMidYMid meet" style={{ background: COLORS.bg }}>
      {/* ── Sólido em L ────────────────────────────────────── */}
      <polygon
        points={m.piece.body.join(' ')}
        fill={COLORS.piece}
        stroke={COLORS.pieceEdge}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />

      {/* ── Linhas de referência da parede e base ───────────── */}
      <line x1={cav.wall} y1={cav.top} x2={cav.wall} y2={cav.base}
            stroke={COLORS.pieceEdge} strokeWidth="1.2" strokeDasharray="4,6" opacity="0.3" />
      <line x1={cav.wall} y1={cav.base} x2={cav.right} y2={cav.base}
            stroke={COLORS.pieceEdge} strokeWidth="1.2" strokeDasharray="4,6" opacity="0.3" />

      {/* ── Ferramenta ──────────────────────────────────────── */}
      <g>
        {/* haste */}
        <rect
          x={m.tool.shankX} y={m.tool.shankTop}
          width={m.tool.shankW} height={m.tool.shankH}
          fill={COLORS.toolFill}
          stroke={COLORS.toolEdge}
          strokeWidth="0.8"
        />
        {/* corpo */}
        <rect
          x={m.tool.left} y={m.tool.top}
          width={m.tool.width} height={m.tool.height}
          rx={m.tool.cornerR} ry={m.tool.cornerR}
          fill={COLORS.toolFill}
          stroke={COLORS.toolEdge}
          strokeWidth="1.2"
        />
        {/* linha inferior ativa */}
        <line
          x1={m.tool.left} y1={m.tool.bottom}
          x2={m.tool.right} y2={m.tool.bottom}
          stroke={COLORS.toolBase}
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* arco do raio de canto */}
        <ArcSVG
          cx={m.tangency.center[0]} cy={m.tangency.center[1]}
          r={m.tangency.radius}
          a1={Math.PI} a2={1.5 * Math.PI}
          style={{ stroke: COLORS.toolBase, strokeWidth: 2.5, fill: 'none', strokeLinecap: 'round' }}
        />
      </g>

      {/* ── Indicador de tangência ───────────────────────────── */}
      {idle && (
        <g opacity="0.4">
          <circle cx={m.tangency.point[0]} cy={m.tangency.point[1]} r="2.5" fill={COLORS.contact} />
          <line
            x1={m.tangency.point[0]} y1={m.tangency.point[1]}
            x2={m.tangency.center[0]} y2={m.tangency.center[1]}
            stroke={COLORS.contact} strokeWidth="0.8" strokeDasharray="2,2"
          />
        </g>
      )}

      {/* ── Cotas destacáveis ─────────────────────────────── */}

      {show('L') && (
        <g opacity={idle ? 0.5 : 1}>
          <line x1={h.L.pts[0]} y1={h.L.pts[1]} x2={h.L.pts[2]} y2={h.L.pts[3]} {...dimStyle('L')} />
          <line x1={h.L.pts[0]} y1={h.L.pts[1] - 4} x2={h.L.pts[0]} y2={h.L.pts[1] + 4} {...dimStyle('L')} />
          <line x1={h.L.pts[2]} y1={h.L.pts[3] - 4} x2={h.L.pts[2]} y2={h.L.pts[3] + 4} {...dimStyle('L')} />
          {active === 'L' && <rect x={h.L.pts[0]} y={h.L.cy - 2} width={h.L.pts[2] - h.L.pts[0]} height={16} fill={COLORS.activeGlow} rx="2" />}
          <text x={h.L.cx} y={h.L.cy} fill={labelFill('L')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="middle">{active === 'L' ? h.L.label : 'L'}</text>
        </g>
      )}

      {show('C') && (
        <g opacity={idle ? 0.4 : 1}>
          <line x1={h.C.pts[0]} y1={h.C.pts[1]} x2={h.C.pts[2]} y2={h.C.pts[3]} {...dimStyle('C')} strokeDasharray={active === 'C' ? 'none' : '3,3'} />
          <circle cx={h.C.pts[0]} cy={h.C.pts[1]} r="2" fill={active === 'C' ? COLORS.active : COLORS.dimLine} />
          <circle cx={h.C.pts[2]} cy={h.C.pts[3]} r="2" fill={active === 'C' ? COLORS.active : COLORS.dimLine} />
          {active === 'C' && <rect x={h.C.cx - 4} y={h.C.cy - 6} width={Math.abs(h.C.pts[0] - h.C.pts[2]) + 8} height={18} fill={COLORS.activeGlow} rx="2" />}
          <text x={h.C.cx} y={h.C.cy} fill={labelFill('C')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="middle">{active === 'C' ? h.C.label : 'C'}</text>
        </g>
      )}

      {show('A') && (
        <g opacity={idle ? 0.4 : 1}>
          <ArcSVG cx={h.A.arc.cx} cy={h.A.arc.cy} r={h.A.arc.r} a1={h.A.arc.a1} a2={h.A.arc.a2} style={dimStyle('A')} />
          <text x={h.A.cx} y={h.A.cy} fill={labelFill('A')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="start">{active === 'A' ? h.A.label : '∠'}</text>
        </g>
      )}

      {show('D') && (
        <g opacity={idle ? 0.5 : 1}>
          <line x1={m.tool.right + 8} y1={m.tool.top} x2={m.tool.right + 8} y2={m.tool.bottom} {...dimStyle('D')} />
          <line x1={m.tool.right + 5} y1={m.tool.top} x2={m.tool.right + 11} y2={m.tool.top} {...dimStyle('D')} />
          <line x1={m.tool.right + 5} y1={m.tool.bottom} x2={m.tool.right + 11} y2={m.tool.bottom} {...dimStyle('D')} />
          {active === 'D' && <rect x={m.tool.right + 6} y={m.tool.top} width={24} height={m.tool.bottom - m.tool.top} fill={COLORS.activeGlow} rx="2" />}
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

      {show('passeZ') && (
        <g opacity={idle ? 0.4 : 1}>
          <line x1={h.passeZ.pts[0]} y1={h.passeZ.pts[1]} x2={h.passeZ.pts[2]} y2={h.passeZ.pts[3]} {...dimStyle('passeZ')} />
          <line x1={h.passeZ.pts[0] - 4} y1={h.passeZ.pts[1]} x2={h.passeZ.pts[0] + 4} y2={h.passeZ.pts[1]} {...dimStyle('passeZ')} />
          <line x1={h.passeZ.pts[0] - 4} y1={h.passeZ.pts[3]} x2={h.passeZ.pts[0] + 4} y2={h.passeZ.pts[3]} {...dimStyle('passeZ')} />
          {active === 'passeZ' && <rect x={h.passeZ.pts[0] - 8} y={h.passeZ.pts[3]} width={18} height={h.passeZ.pts[1] - h.passeZ.pts[3]} fill={COLORS.activeGlow} rx="2" />}
          <text x={h.passeZ.cx} y={h.passeZ.cy} fill={labelFill('passeZ')} fontFamily="Share Tech Mono,monospace" fontSize="11" fontWeight="bold" textAnchor="end">{active === 'passeZ' ? h.passeZ.label : 'pZ'}</text>
        </g>
      )}
    </svg>
  );
}
