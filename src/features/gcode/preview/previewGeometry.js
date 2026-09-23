// Constantes visuais compartilhadas entre os previews SVG
export const VIEW = { W: 400, H: 280 };

export const COLORS = {
  bg: '#0a0c0f',
  piece: '#1e3048',
  pieceEdge: '#3a5f7a',
  toolFill: 'rgba(56,189,248,0.12)',
  toolEdge: '#38bdf8',
  toolBase: '#38bdf8',
  dimLine: '#4a6a8a',
  active: '#f0a500',
  activeGlow: 'rgba(240,165,0,0.18)',
  contact: '#f0a500',
  label: '#6a8aaa',
};

// Utilitário para arco SVG
export function arcPath(cx, cy, r, a1, a2) {
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const la = a2 - a1 > Math.PI ? 1 : 0;
  return { x1, y1, x2, y2, la };
}
