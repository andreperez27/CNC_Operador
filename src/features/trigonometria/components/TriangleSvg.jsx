import { useState } from 'react';

const CONFIGS = [
  { poly: "40,160 40,30 220,160", rx: 40, ry: 145, rw: 15, rh: 15, A: [50,34], B: [200,157], Cp: [20,178], bx: 22, by: 98, ax: 130, ay: 178, cx: 142, cy: 88 },
  { poly: "220,160 220,30 40,160", rx: 205, ry: 145, rw: 15, rh: 15, A: [196,34], B: [30,157], Cp: [210,178], bx: 238, by: 98, ax: 130, ay: 178, cx: 110, cy: 88 },
  { poly: "220,40 220,170 40,40", rx: 205, ry: 40, rw: 15, rh: 15, A: [196,173], B: [30,43], Cp: [210,33], bx: 238, by: 105, ax: 130, ay: 24, cx: 110, cy: 115 },
  { poly: "40,40 40,170 220,40", rx: 40, ry: 40, rw: 15, rh: 15, A: [50,173], B: [200,43], Cp: [14,33], bx: 22, by: 105, ax: 130, ay: 24, cx: 142, cy: 115 },
];

const COLORS = {
  triangle: { fill: 'rgba(240,165,0,.07)', stroke: '#f0a500' },
  rect: { stroke: '#7a92b0' },
  labels: { fill: '#f0a500' },
  angles: { fill: '#38bdf8' },
  rightAngle: { fill: '#7a92b0' },
};

export default function TriangleSvg() {
  const [pos, setPos] = useState(0);
  const c = CONFIGS[pos];

  const flip = () => setPos((pos + 1) % 4);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 14 }}>
      <svg viewBox="0 0 260 200" width="240" height="185" xmlns="http://www.w3.org/2000/svg">
        <polygon points={c.poly} fill={COLORS.triangle.fill} stroke={COLORS.triangle.stroke} strokeWidth="2.5" />
        <rect x={c.rx} y={c.ry} width={c.rw} height={c.rh} fill="none" stroke={COLORS.rect.stroke} strokeWidth="1.5" />
        <text x={c.bx} y={c.by} fill={COLORS.labels.fill} fontFamily="Share Tech Mono,monospace" fontSize="20" fontWeight="bold" textAnchor="middle">b</text>
        <text x={c.ax} y={c.ay} fill={COLORS.labels.fill} fontFamily="Share Tech Mono,monospace" fontSize="20" fontWeight="bold" textAnchor="middle">a</text>
        <text x={c.cx} y={c.cy} fill={COLORS.labels.fill} fontFamily="Share Tech Mono,monospace" fontSize="20" fontWeight="bold" textAnchor="middle">c</text>
        <text x={c.A[0]} y={c.A[1]} fill={COLORS.angles.fill} fontFamily="Share Tech Mono,monospace" fontSize="16" textAnchor="middle">A</text>
        <text x={c.B[0]} y={c.B[1]} fill={COLORS.angles.fill} fontFamily="Share Tech Mono,monospace" fontSize="16" textAnchor="middle">B</text>
        <text x={c.Cp[0]} y={c.Cp[1]} fill={COLORS.rightAngle.fill} fontFamily="Share Tech Mono,monospace" fontSize="12" textAnchor="middle">C=90°</text>
      </svg>
      <button
        onClick={flip}
        style={{
          marginTop: 4,
          border: '1.5px solid var(--border2)',
          borderRadius: 4,
          background: 'transparent',
          color: 'var(--text)',
          fontFamily: 'var(--mono)',
          fontSize: '.85rem',
          padding: '7px 18px',
          cursor: 'pointer',
        }}
      >
        ↻ GIRAR
      </button>
    </div>
  );
}
