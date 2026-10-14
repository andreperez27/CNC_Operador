import { describe, it, expect } from 'vitest';
import { layoutText } from '../src/core/engraving/layout';
import { fitInBlock, anchorInBlock } from '../src/core/engraving/fit';
import { blockOutlines, svgPathForLoop } from '../src/features/gravador/components/engravingPaths';
import fontData from '../src/core/engraving/fonts/traco-simples-10.v1.json';

/**
 * Encaixe em bloco: fitInBlock (números), anchorInBlock (posicionamento) e
 * contornos da prévia. Proporção nunca muda (só altura); espaçamento extra
 * em mm reais, sem escala.
 */

const P = { height: 10, letterSpacing: 0, lineHeightFactor: 1.6 };

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('fitInBlock — casos de referência', () => {
  it('"ANDRE HENRIQUE" 50x10 m0 e0 h10: não cabe (overW 39); max 5,6 largura', () => {
    const r = fitInBlock('ANDRE HENRIQUE', fontData, { ...P, blockW: 50, blockH: 10, margin: 0 });
    expect(r.fits).toBe(false);
    expect(r.overW).toBeCloseTo(39, 9);
    expect(r.maxHeight).toBe(5.6);
    expect(r.limitedBy).toBe('largura');
    expect(r.availW).toBe(50);
    expect(r.availH).toBe(10);
    expect(fitInBlock('ANDRE HENRIQUE', fontData, { ...P, height: 5.6, blockW: 50, blockH: 10, margin: 0 }).fits).toBe(true);
    expect(fitInBlock('ANDRE HENRIQUE', fontData, { ...P, height: 5.7, blockW: 50, blockH: 10, margin: 0 }).fits).toBe(false);
  });

  it('mesmo texto com extra 1 mm: maxHeight 4,1', () => {
    const r = fitInBlock('ANDRE HENRIQUE', fontData, { ...P, letterSpacing: 1, blockW: 50, blockH: 10, margin: 0 });
    expect(r.maxHeight).toBe(4.1);
    expect(r.limitedBy).toBe('largura');
  });

  it('"A" em 50x6: maxHeight 6,0, limitedBy altura', () => {
    const r = fitInBlock('A', fontData, { ...P, blockW: 50, blockH: 6, margin: 0 });
    expect(r.maxHeight).toBe(6);
    expect(r.limitedBy).toBe('altura');
    expect(r.fits).toBe(false);
    expect(fitInBlock('A', fontData, { ...P, height: 6, blockW: 50, blockH: 6, margin: 0 }).fits).toBe(true);
  });

  it('duas linhas (fator 1,6) em altura 10: maxHeight 3,8', () => {
    const r = fitInBlock('A\nA', fontData, { ...P, blockW: 50, blockH: 10, margin: 0 });
    expect(r.maxHeight).toBe(3.8);
    expect(r.limitedBy).toBe('altura');
  });

  it('margem 1 em 50x10: área útil 48x8', () => {
    const r = fitInBlock('A', fontData, { ...P, blockW: 50, blockH: 10, margin: 1 });
    expect(r.availW).toBe(48);
    expect(r.availH).toBe(8);
  });

  it('extra grande demais: não cabe em nenhuma altura', () => {
    const r = fitInBlock('AB', fontData, { ...P, letterSpacing: 100, blockW: 50, blockH: 10, margin: 0 });
    expect(r.fits).toBe(false);
    expect(r.maxHeight).toBeNull();
    expect(r.limitedBy).toBeNull();
    expect(r.message).toMatch(/Não cabe em nenhuma altura/);
  });

  it('bloco inválido lança', () => {
    expect(() => fitInBlock('A', fontData, { ...P, blockW: 0, blockH: 10 })).toThrowError(/Bloco/);
  });
});

describe('fitInBlock — propriedade com textos aleatórios (seed fixa)', () => {
  const CHARS = 'ABEHINORXZ019 ';
  it('cabe em maxHeight e não cabe em maxHeight + 0,1', () => {
    const rnd = mulberry32(42);
    let checked = 0;
    let impossible = 0;
    for (let t = 0; t < 60; t++) {
      const n = 1 + Math.floor(rnd() * 12);
      let text = '';
      for (let i = 0; i < n; i++) {
        const r = rnd();
        text += r < 0.08 && i > 0 && i < n - 1 ? '\n' : CHARS[Math.floor(rnd() * CHARS.length)];
      }
      if (!/[A-Z0-9]/.test(text)) continue;
      const blockW = 30 + Math.floor(rnd() * 121);
      const blockH = 8 + Math.floor(rnd() * 33);
      const margin = Math.floor(rnd() * 4) / 2;
      const extra = Math.floor(rnd() * 6);
      const base = { letterSpacing: extra, lineHeightFactor: 1.6, blockW, blockH, margin };
      const r = fitInBlock(text, fontData, { ...base, height: 10 });
      if (r.maxHeight === null) {
    expect(r.message).toMatch(/Não cabe em nenhuma altura/);
        impossible += 1;
        continue;
      }
      expect(r.maxHeight).toBeGreaterThan(0);
      const atMax = fitInBlock(text, fontData, { ...base, height: r.maxHeight });
      expect(atMax.fits).toBe(true);
      const over = Math.round((r.maxHeight + 0.1) * 10) / 10;
      const above = fitInBlock(text, fontData, { ...base, height: over });
      expect(above.fits).toBe(false);
      checked += 1;
    }
    expect(checked).toBeGreaterThan(20);
    expect(impossible).toBeGreaterThanOrEqual(0);
  });
});

describe('proporção: só a altura muda, razão preservada', () => {
  it('todas as coordenadas escalam por um único fator; razão w/h constante (extra 0)', () => {
    const a = layoutText('ANDRE R', fontData, { height: 5, letterSpacing: 0, x0: 0, y0: 0 });
    const b = layoutText('ANDRE R', fontData, { height: 13, letterSpacing: 0, x0: 0, y0: 0 });
    const k = 13 / 5;
    const pts = (st) => [st.from, ...st.segs.map((s) => s.to)];
    const pa = a.strokes.flatMap(pts);
    const pb = b.strokes.flatMap(pts);
    expect(pa.length).toBe(pb.length);
    pa.forEach((p, i) => {
      expect(pb[i][0]).toBeCloseTo(p[0] * k, 9);
      expect(pb[i][1]).toBeCloseTo(p[1] * k, 9);
    });
    expect(a.bounds.width / a.bounds.height).toBeCloseTo(b.bounds.width / b.bounds.height, 9);
  });
});

describe('anchorInBlock — centrado e ancorado', () => {
  const base = layoutText('ANDRE', fontData, { height: 10, letterSpacing: 0, x0: 0, y0: 0 });

  it('centralizado: caixa da tinta centrada no bloco (1e-6)', () => {
    const out = anchorInBlock(base, { x0: 10, y0: 5, blockW: 100, blockH: 20, margin: 2, center: true });
    expect((out.bounds.minX + out.bounds.maxX) / 2).toBeCloseTo(10 + 100 / 2, 6);
    expect((out.bounds.minY + out.bounds.maxY) / 2).toBeCloseTo(5 + 20 / 2, 6);
    expect(out.bounds.width).toBeCloseTo(base.bounds.width, 9);
    expect(out.bounds.height).toBeCloseTo(base.bounds.height, 9);
  });

  it('sem centralizar: tinta ancorada em (x0+m, y0+m)', () => {
    const out = anchorInBlock(base, { x0: 10, y0: 5, blockW: 100, blockH: 20, margin: 2, center: false });
    expect(out.bounds.minX).toBeCloseTo(12, 9);
    expect(out.bounds.minY).toBeCloseTo(7, 9);
  });
});

describe('blockOutlines — retângulo do bloco e área útil', () => {
  it('cantos exatos com margem', () => {
    const { block, usable } = blockOutlines({ x0: 10, y0: 5, blockW: 50, blockH: 10, margin: 1 });
    expect(block).toEqual([[10, 5], [60, 5], [60, 15], [10, 15], [10, 5]]);
    expect(usable).toEqual([[11, 6], [59, 6], [59, 14], [11, 14], [11, 6]]);
    // path com Y negado (mapeamento da tela, igual aos traços)
    expect(svgPathForLoop(block)).toBe('M 10,-5 L 60,-5 L 60,-15 L 10,-15 L 10,-5');
  });
});
