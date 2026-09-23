/*
 * previewGeometry — Shared SVG constants for Heidenhain previews
 */

export const VIEW = { W: 860, H: 560 };

export const COLORS = {
  bg: '#0a0c0f',
  piece: '#1e3048',
  pieceEdge: '#3a5f7a',
  pieceRaw: '#14202e',
  pieceRawEdge: '#1a3048',
  toolFill: 'rgba(56,189,248,0.16)',
  toolEdge: '#38bdf8',
  toolBase: '#38bdf8',
  toolCenter: '#38bdf8',
  toolCenterFill: '#38bdf8',
  dimLine: '#4a6a8a',
  active: '#f0a500',
  activeGlow: 'rgba(240,165,0,0.18)',
  contact: '#f0a500',
  contactDim: '#f0a500',
  normalVec: '#f0a500',
  tangentVec: '#38bdf8',
  label: '#6a8aaa',
  trajectory: 'rgba(56,189,248,0.3)',
  trajectoryLine: '#38bdf8',
  safety: 'rgba(255,255,255,0.15)',
  origin: 'rgba(255,255,255,0.4)',
  originMarker: '#ffffff',
  axis: '#8b9cb0',
  axisLabel: '#c3d4e4',
  chamfer: '#fbbf24',
  chamferLabel: '#fbbf24',
  rawLabel: '#4a6a8a',
};

export function arcPath(cx, cy, r, a1, a2) {
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const x2 = cx + r * Math.cos(a2);
  const y2 = cy + r * Math.sin(a2);
  const la = a2 - a1 > Math.PI ? 1 : 0;
  return { x1, y1, x2, y2, la };
}
