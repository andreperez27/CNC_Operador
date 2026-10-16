import { describe, it, expect } from 'vitest';
import { describeArc } from '../src/core/engraving/layout';
import { svgPathForStroke, toggleSignText, unionBounds } from '../src/features/gravador/components/engravingPaths';

/**
 * Regressão da prévia SVG: para cada arco, o ponto médio do arco DESENHADO
 * (recuperado do path via flags) convertido de volta para a máquina bate
 * com o ponto médio calculado de centro + sentido (tol 0,001). Cobre D
 * (DR+), R (DR−), 2 (225°), S (270°) e os símbolos v2 '(' , ')' (90°),
 * '.' (180° exatos, limite do large-arc) e '&' (253,7°). Qualquer inversão
 * de flags (sweep ou large-arc) desloca o ponto médio e quebra este teste.
 */

// Arcos reais da fonte (from + segmento), com as flags ESPERADAS corretas.
const ARCS = [
  {
    id: 'D (DR+)', from: [2.0, 0.0],
    seg: { t: 'A', to: [5.0, 3.0], c: [2.0, 3.0], cw: false },
    largeArc: 0, sweepFlag: 0,
  },
  {
    id: 'R (DR−)', from: [2.0, 10.0],
    seg: { t: 'A', to: [2.0, 4.0], c: [2.0, 7.0], cw: true },
    largeArc: 0, sweepFlag: 1,
  },
  {
    id: '2 (225°)', from: [0.0, 7.5],
    seg: { t: 'A', to: [4.2678, 5.7322], c: [2.5, 7.5], cw: true },
    largeArc: 1, sweepFlag: 1,
  },
  {
    id: 'S (270°)', from: [5.0, 7.5],
    seg: { t: 'A', to: [2.5, 5.0], c: [2.5, 7.5], cw: false },
    largeArc: 1, sweepFlag: 0,
  },
  {
    id: "'(' (90°)", from: [2.5, 10.0],
    seg: { t: 'A', to: [0.0, 7.5], c: [2.5, 7.5], cw: false },
    largeArc: 0, sweepFlag: 0,
  },
  {
    id: "')' (90°)", from: [0.0, 10.0],
    seg: { t: 'A', to: [2.5, 7.5], c: [0.0, 7.5], cw: true },
    largeArc: 0, sweepFlag: 1,
  },
  {
    id: "'.' (180° exatos)", from: [0.0, 0.6],
    seg: { t: 'A', to: [1.2, 0.6], c: [0.6, 0.6], cw: false },
    largeArc: 0, sweepFlag: 0,
  },
  {
    id: "'&' (253,7°)", from: [0.8, 6.8],
    seg: { t: 'A', to: [4.0, 6.8], c: [2.4, 8.0], cw: true },
    largeArc: 1, sweepFlag: 1,
  },
];

// Ponto médio na máquina: centro + raio no bissetor, seguindo o sentido.
function machineMidpoint(from, seg) {
  const r = Math.hypot(from[0] - seg.c[0], from[1] - seg.c[1]);
  const a0 = Math.atan2(from[1] - seg.c[1], from[0] - seg.c[0]);
  const { sweepDeg } = describeArc(from, seg);
  const half = ((sweepDeg * Math.PI) / 180) / 2;
  const mid = seg.cw ? a0 - half : a0 + half;
  return [seg.c[0] + r * Math.cos(mid), seg.c[1] + r * Math.sin(mid)];
}

// Recupera o centro do arco a partir do path SVG (endpoint→center, F.6.5
// sem rotação) e devolve o ponto médio desenhado, em coords de tela.
function svgMidpoint(p0, p1, r, largeArc, sweepFlag, sweepDeg) {
  const dx = (p0[0] - p1[0]) / 2;
  const dy = (p0[1] - p1[1]) / 2;
  const d2 = dx * dx + dy * dy;
  const f = Math.sqrt(Math.max(0, (r * r - d2) / (d2 || 1e-12)));
  const sign = largeArc !== sweepFlag ? 1 : -1;
  const cx = sign * f * dy + (p0[0] + p1[0]) / 2;
  const cy = sign * f * -dx + (p0[1] + p1[1]) / 2;
  const start = Math.atan2(p0[1] - cy, p0[0] - cx);
  const dir = sweepFlag === 1 ? 1 : -1;
  const mid = start + (dir * ((sweepDeg * Math.PI) / 180)) / 2;
  return [cx + r * Math.cos(mid), cy + r * Math.sin(mid)];
}

function parseArc(d) {
  const m = d.match(/A\s+(\S+)\s+(\S+)\s+0\s+(\d)\s+(\d)\s+(\S+),(\S+)/);
  if (!m) throw new Error('path sem arco: ' + d);
  return {
    rx: Number(m[1]),
    largeArc: Number(m[3]),
    sweepFlag: Number(m[4]),
    end: [Number(m[5]), Number(m[6])],
  };
}

describe('prévia SVG: ponto médio desenhado == ponto médio da máquina (0,001)', () => {
  for (const a of ARCS) {
    it(`${a.id}: flags corretas e midpoint confere`, () => {
      const d = svgPathForStroke({ from: a.from, segs: [a.seg] });
      const arc = parseArc(d);
      expect(arc.largeArc).toBe(a.largeArc);
      expect(arc.sweepFlag).toBe(a.sweepFlag);
      // início do path == from mapeado (x, −y)
      const start = [a.from[0], -a.from[1]];
      expect(d.startsWith(`M ${a.from[0]},${-a.from[1]}`)).toBe(true);
      const { sweepDeg } = describeArc(a.from, a.seg);
      const r = Math.hypot(a.from[0] - a.seg.c[0], a.from[1] - a.seg.c[1]);
      const midSvg = svgMidpoint(start, arc.end, r, arc.largeArc, arc.sweepFlag, sweepDeg);
      const midBack = [midSvg[0], -midSvg[1]];
      const midMachine = machineMidpoint(a.from, a.seg);
      // Tolerância literal 0,001 (não toBeCloseTo, que exigiria < 0,0005):
      // o path serializa em 3 casas, então há ruído de quantização; um flag
      // invertido erraria na ordem de mm (lado oposto do arco).
      expect(Math.abs(midBack[0] - midMachine[0])).toBeLessThan(0.001);
      expect(Math.abs(midBack[1] - midMachine[1])).toBeLessThan(0.001);
    });
  }
});

describe('toggleSignText — botão +/− do mobile', () => {
  it('vazio, sinal solto, números e inválidos', () => {
    expect(toggleSignText('')).toBe('-');
    expect(toggleSignText('-')).toBe('');
    expect(toggleSignText('40')).toBe('-40');
    expect(toggleSignText('-40')).toBe('40');
    expect(toggleSignText('40,5')).toBe('-40.5');
    expect(toggleSignText('abc')).toBe('abc');
    expect(toggleSignText(null)).toBe('-');
  });
});

describe('unionBounds — enquadramento tinta + bloco', () => {
  it('une pelos extremos', () => {
    expect(
      unionBounds(
        { minX: 0, minY: 0, maxX: 10, maxY: 5 },
        { minX: -2, minY: -2, maxX: 4, maxY: 8 },
      ),
    ).toEqual({ minX: -2, minY: -2, maxX: 10, maxY: 8, width: 12, height: 10 });
  });
});
