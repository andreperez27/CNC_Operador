import { describeArc } from '../../../core/engraving/layout';

// Construtor puro dos paths SVG da prévia (separado do componente para ser
// testável e não violar a regra de fast refresh). Mesmo mapeamento do
// componente: (x, y) → (x, −y), viewBox deslocado.

export function trimNum(v) {
  return String(Number(v.toFixed(3)));
}

export function svgViewBox(bounds, padRatio = 0.08) {
  const pad = Math.max(2, Math.max(bounds.width, bounds.height) * padRatio);
  const minX = bounds.minX - pad;
  const minY = -(bounds.maxY + pad);
  const W = bounds.width + pad * 2;
  const H = bounds.height + pad * 2;
  return `${trimNum(minX)} ${trimNum(minY)} ${trimNum(W)} ${trimNum(H)}`;
}

const P = (x, y) => `${trimNum(x)},${trimNum(-y)}`;

export function svgPathForStroke(stroke) {
  let d = `M ${P(stroke.from[0], stroke.from[1])}`;
  let cur = stroke.from;
  for (const sg of stroke.segs) {
    if (sg.t === 'L') {
      d += ` L ${P(sg.to[0], sg.to[1])}`;
    } else {
      const { radius, largeArc, sweepFlag } = describeArc(cur, sg);
      const r = trimNum(radius);
      d += ` A ${r} ${r} 0 ${largeArc} ${sweepFlag} ${P(sg.to[0], sg.to[1])}`;
    }
    cur = sg.to;
  }
  return d;
}

// Contornos do bloco e da área útil (coordenadas de máquina; o componente
// mapeia com P()). Usado nos testes como o path dos traços.
export function blockOutlines({ x0, y0, blockW, blockH, margin = 0 }) {
  const loop = (ax, ay, bx, by) => [[ax, ay], [bx, ay], [bx, by], [ax, by], [ax, ay]];
  return {
    block: loop(x0, y0, x0 + blockW, y0 + blockH),
    usable: loop(x0 + margin, y0 + margin, x0 + blockW - margin, y0 + blockH - margin),
  };
}

export function svgPathForLoop(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${P(p[0], p[1])}`).join(' ');
}

// Inverte o sinal de um texto numérico (botão +/− do mobile, mesmo padrão
// do HuronForm): '' → '-', '-' → '', número válido → negado; resto intacto.
export function toggleSignText(raw) {
  const s = String(raw ?? '');
  if (s === '') return '-';
  if (s === '-') return '';
  const n = Number(s.replace(',', '.'));
  return Number.isFinite(n) ? String(-n) : s;
}

// Une dois bboxes {minX,minY,maxX,maxY} (prévia com bloco: tinta + bloco).
export function unionBounds(a, b) {
  const box = {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
  return { ...box, width: box.maxX - box.minX, height: box.maxY - box.minY };
}
