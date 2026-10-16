import { describe, it, expect } from 'vitest';
import { layoutText } from '../src/core/engraving/layout';
import { grooveWidth } from '../src/core/engraving/groove';
import { fitInBlock } from '../src/core/engraving/fit';
import {
  analyzeLegibility,
  minLegibleHeight,
  viableRange,
  canExport,
  describeWorst,
} from '../src/core/engraving/legibility';
import fontData from '../src/core/engraving/fonts/traco-simples-10.v1.json';
import fontV2 from '../src/core/engraving/fonts/traco-simples-10.v2.json';

/**
 * Parte 2 — legibilidade geométrica: folga livre = distância − risco,
 * verde/amarelo/vermelho, altura mínima por bisseção e faixa viável.
 */

const lay = (text, params = {}) =>
  layoutText(text, fontData, { height: 10, letterSpacing: 0, x0: 0, y0: 0, ...params });

// Ponto só existe na v2.
const lay2 = (text, params = {}) =>
  layoutText(text, fontV2, { height: 10, letterSpacing: 0, x0: 0, y0: 0, ...params });

// Duas verticais de 10 mm a 2 mm (geometria construída, sem fonte).
const verticals = (gap = 2, h = 10) => ({
  strokes: [
    { from: [0, 0], segs: [{ t: 'L', to: [0, h] }], ch: 'X', line: 0, gi: 0 },
    { from: [gap, 0], segs: [{ t: 'L', to: [gap, h] }], ch: 'Y', line: 0, gi: 1 },
  ],
});

describe('analyzeLegibility — casos construídos verde/amarelo/vermelho', () => {
  it('"#" verticais a 2 mm, altura 10, risco 0,5: verde', () => {
    const r = analyzeLegibility(verticals(), 0.5);
    expect(r.nivel).toBe('verde');
    expect(r.folgaMinima).toBeCloseTo(1.5, 9);
    expect(r.pior).toBeNull();
    expect(r.alertas).toEqual([]);
  });

  it('"#" verticais a 2 mm, altura 5, risco 1,0: vermelho (folga 0)', () => {
    const v = { strokes: verticals().strokes.map((st) => ({
      ...st,
      from: [st.from[0] / 2, st.from[1] / 2],
      segs: st.segs.map((s) => ({ t: 'L', to: [s.to[0] / 2, s.to[1] / 2] })),
    })) };
    const r = analyzeLegibility(v, 1.0);
    expect(r.nivel).toBe('vermelho');
    expect(r.folgaMinima).toBeCloseTo(0, 9);
    expect(r.pior.tipo).toBe('entre');
    expect(r.pior.caracteres).toBe('X-Y');
  });

  it('folga positiva abaixo do mínimo: amarelo', () => {
    const r = analyzeLegibility(verticals(), 1.8);
    expect(r.nivel).toBe('amarelo');
    expect(r.folgaMinima).toBeCloseTo(0.2, 9);
    expect(r.alertas).toHaveLength(1);
    expect(r.alertas[0].sugestao).toMatch(/espaçamento extra/);
  });

  it('dentro do caractere sugere altura/ferramenta, não espaçamento', () => {
    const one = {
      strokes: [
        { from: [0, 0], segs: [{ t: 'L', to: [0, 10] }], ch: 'X', line: 0, gi: 0 },
        { from: [1, 0], segs: [{ t: 'L', to: [1, 10] }], ch: 'X', line: 0, gi: 0 },
      ],
    };
    const r = analyzeLegibility(one, 0.9);
    expect(r.nivel).toBe('amarelo');
    expect(r.alertas[0].tipo).toBe('dentro');
    expect(r.alertas[0].sugestao).toMatch(/altura maior ou ferramenta mais fina/);
  });

  it('sem pares: verde, folga infinita, sem pior', () => {
    const r = analyzeLegibility(lay('I'), 0.5);
    expect(r.nivel).toBe('verde');
    expect(r.folgaMinima).toBe(Infinity);
    expect(r.pior).toBeNull();
  });

  it('largura inválida explica em vez de estimar', () => {
    expect(() => analyzeLegibility(lay('A'), 0)).toThrowError(/maior que zero/);
    expect(() => analyzeLegibility(lay('A'), -1)).toThrowError(/maior que zero/);
  });
});

describe('analyzeLegibility — junções intencionais sem falso alerta', () => {
  for (const ch of ['A', 'E', 'H', '4', 'Q']) {
    it(`'${ch}' com risco 0,5: sem alertas`, () => {
      const r = analyzeLegibility(lay(ch), 0.5);
      expect(r.alertas).toEqual([]);
      expect(r.nivel).toBe('verde');
    });
  }

  // Folgas medidas na fonte v1 (altura 10, risco 0,5): O=4,5, B=1,0, D=1,5.
  // O ponto é só garantir que o vazio interno não gera falso alerta.
  for (const [ch, folga] of [['O', 4.5], ['B', 1.0], ['D', 1.5]]) {
    it(`'${ch}' preserva o espaço interno`, () => {
      const r = analyzeLegibility(lay(ch), 0.5);
      expect(r.alertas).toEqual([]);
      expect(r.nivel).toBe('verde');
      expect(r.folgaMinima).toBeCloseTo(folga, 6);
    });
  }
});

describe('analyzeLegibility — entre letras e espaçamento', () => {
  it("'AN': entre 2,0 / 3,0 / 4,0 com extra 0 / 1 / 2 (tol 0,01)", () => {
    for (const [extra, esperado] of [[0, 2.0], [1, 3.0], [2, 4.0]]) {
      const r = analyzeLegibility(lay('AN', { letterSpacing: extra }), 0.5);
      expect(r.entre).not.toBeNull();
      expect(Math.abs(r.entre.distancia - esperado)).toBeLessThan(0.01);
      expect(r.alertas).toEqual([]);
    }
    // O global com extra ≥ 1 é o dentro do A (2,425…), não o entre.
    const b = analyzeLegibility(lay('AN', { letterSpacing: 2 }), 0.5);
    expect(b.folgaMinima).toBeCloseTo(1.92535625036333, 9);
    expect(b.dentro.distancia).toBeCloseTo(2.42535625036333, 9);
  });

  it('global com extra 0 segue o entre (1,5)', () => {
    const a = analyzeLegibility(lay('AN'), 0.5);
    expect(a.folgaMinima).toBeCloseTo(1.5, 9);
    expect(a.entre.distancia).toBeCloseTo(2.0, 9);
  });
});

describe('analyzeLegibility — entre por par vizinho em ANDRE HENRIQUE', () => {
  const PARES = ['AN', 'ND', 'DR', 'RE', 'HE', 'EN', 'NR', 'RI', 'IQ', 'QU', 'UE'];
  for (const par of PARES) {
    it(`'${par}': entre 2,0 a altura 10, extra 0 (tol 0,01)`, () => {
      const r = analyzeLegibility(lay(par), 0.5);
      expect(r.nivel).toBe('verde');
      expect(Math.abs(r.entre.distancia - 2.0)).toBeLessThan(0.01);
    });
    it(`'${par}': extra 1 soma 1,0 no entre (tol 0,01)`, () => {
      const r = analyzeLegibility(lay(par, { letterSpacing: 1 }), 0.5);
      expect(Math.abs(r.entre.distancia - 3.0)).toBeLessThan(0.01);
    });
  }
});

describe('analyzeLegibility — ponto cheio e folga infinita', () => {
  it("'.' sozinho com risco grosso: verde, sem alerta, dentro nulo", () => {
    const r = analyzeLegibility(lay2('.'), 2.0);
    expect(r.nivel).toBe('verde');
    expect(r.alertas).toEqual([]);
    expect(r.dentro).toBeNull();
    expect(r.entre).toBeNull();
    expect(r.folgaMinima).toBe(Infinity);
    expect(r.pior).toBeNull();
  });

  it("'.' com vizinhos vale como traço comum no entre", () => {
    // O círculo curva para longe: o entre real é a diagonal pé→círculo
    // (≈2,068), não os 2,0 do avanço — geometria real, como traço comum.
    const r = analyzeLegibility(lay2('A.'), 0.5);
    expect(r.entre).not.toBeNull();
    expect(r.entre.distancia).toBeGreaterThan(2.0);
    expect(r.entre.distancia).toBeLessThan(2.1);
    // Com risco largo, o ponto participa e acusa no entre (A-. amarelo).
    const w = analyzeLegibility(lay2('A.'), 2.0);
    expect(w.nivel).toBe('amarelo');
    expect(w.entre.pior.caracteres).toBe('A-.');
  });

  it("'I' sem pares: dentro/entre nulos, pior nulo", () => {
    const r = analyzeLegibility(lay('I'), 0.5);
    expect(r.dentro).toBeNull();
    expect(r.entre).toBeNull();
    expect(r.pior).toBeNull();
  });
});

describe('minLegibleHeight — bisseção e faixa', () => {
  const texts = ['ABE', 'HIN', 'OTTO', 'AQUA', 'EFEITO'];

  it('passa na altura devolvida e falha 0,1 abaixo (propriedade)', () => {
    for (const text of texts) {
      const r = minLegibleHeight({ text, font: fontData, letterSpacing: 0, grooveWidth: 0.5 });
      expect(r.legible).toBe(true);
      expect(
        analyzeLegibility(lay(text, { height: r.height }), 0.5).nivel,
      ).toBe('verde');
      expect(
        analyzeLegibility(lay(text, { height: Number((r.height - 0.1).toFixed(10)) }), 0.5).nivel,
      ).not.toBe('verde');
    }
  });

  it('ilegível até 50 mm informa em vez de número', () => {
    const r = minLegibleHeight({ text: 'ABE', font: fontData, grooveWidth: 50 });
    expect(r).toEqual({ legible: false, height: null });
  });

  it('determinístico e rejeita espaçamento negativo', () => {
    const a = minLegibleHeight({ text: 'ABE', font: fontData, grooveWidth: 0.5 });
    const b = minLegibleHeight({ text: 'ABE', font: fontData, grooveWidth: 0.5 });
    expect(a).toEqual(b);
    expect(() => minLegibleHeight({ text: 'ABE', font: fontData, letterSpacing: -1, grooveWidth: 0.5 }))
      .toThrowError(/negativo/);
  });
});

describe('describeWorst — texto único do pior ponto, nunca undefined', () => {
  it('formatos: dentro do K / entre R e I / nulo em dado ruim', () => {
    expect(describeWorst({ tipo: 'dentro', caracteres: 'K' })).toBe('dentro do K');
    expect(describeWorst({ tipo: 'entre', caracteres: 'R-I' })).toBe('entre R e I');
    expect(describeWorst({ tipo: 'entre', caracteres: 'A-.' })).toBe('entre A e .');
    expect(describeWorst(null)).toBeNull();
    expect(describeWorst(undefined)).toBeNull();
    expect(describeWorst({})).toBeNull();
    expect(describeWorst({ tipo: 'dentro' })).toBeNull();
  });

  it('nenhuma string de diagnóstico contém undefined (dentro, entre, ponto, sem pares)', () => {
    const k = analyzeLegibility(lay('K', { height: 5 }), 0.5);
    expect(k.nivel).toBe('vermelho');
    const he = analyzeLegibility(lay('HE', { height: 2 }), 0.5);
    expect(he.nivel).toBe('vermelho');
    const dot = analyzeLegibility(lay2('A.'), 2.0);
    expect(dot.nivel).toBe('amarelo');
    const bare = analyzeLegibility(lay('I'), 0.5);
    const strs = [k, he, dot, bare].flatMap((r) => [
      describeWorst(r.pior),
      r.dentro ? describeWorst(r.dentro.pior) : null,
      r.entre ? describeWorst(r.entre.pior) : null,
    ]);
    expect(strs.length).toBeGreaterThan(0);
    for (const s of strs) {
      if (s !== null) expect(s.includes('undefined')).toBe(false);
    }
    expect(describeWorst(k.pior)).toBe('dentro do K');
    expect(describeWorst(he.pior)).toBe('entre H e E');
    expect(describeWorst(dot.entre.pior)).toBe('entre A e .');
  });
});

describe('viableRange e canExport', () => {
  it('faixa vazia detectada', () => {
    expect(viableRange(5, null)).toEqual({ viable: false });
    expect(viableRange(null, 5)).toEqual({ viable: false });
    expect(viableRange(6, 5)).toEqual({ viable: false });
    expect(viableRange(5, 6)).toEqual({ viable: true });
    expect(viableRange(5, 5)).toEqual({ viable: true });
  });

  it('exportação exige confirmação só no vermelho', () => {
    expect(canExport('verde', false)).toBe(true);
    expect(canExport('amarelo', false)).toBe(true);
    expect(canExport('vermelho', false)).toBe(false);
    expect(canExport('vermelho', true)).toBe(true);
  });
});

describe('precondição da fonte para a bisseção ser válida', () => {
  it('tinta dentro de [0, advance] em todos os glifos', () => {
    for (const g of fontData.glyphs) {
      expect(g.bbox[0]).toBeGreaterThanOrEqual(-1e-9);
      expect(g.bbox[2]).toBeLessThanOrEqual(g.advance + 1e-9);
    }
  });
});

describe('aceite da fiação (núcleo): V plano em ANDRE HENRIQUE', () => {
  const W60 = grooveWidth({ type: 'vee', angle: 60, tipDiameter: 0.1 }, 0.2);
  const W90 = grooveWidth({ type: 'vee', angle: 90, tipDiameter: 0.1 }, 0.5);

  it('V60 ponta 0,1 p0,2 (0,3309): pior no Q, mínima 2,9; 2,8 amarelo', () => {
    expect(W60).toBeCloseTo(0.3309, 4);
    const m = minLegibleHeight({ text: 'ANDRE HENRIQUE', font: fontV2, grooveWidth: W60 });
    expect(m).toEqual({ legible: true, height: 2.9 });
    const below = analyzeLegibility(lay2('ANDRE HENRIQUE', { height: 2.8 }), W60);
    expect(below.nivel).toBe('amarelo');
    expect(below.pior).toMatchObject({ caracteres: 'Q', tipo: 'dentro' });
    expect(analyzeLegibility(lay2('ANDRE HENRIQUE', { height: 2.9 }), W60).nivel).toBe('verde');
  });

  it('V90 ponta 0,1 p0,5 (1,1): mínima 9,4; bloco 50x10 sem faixa; export pede confirmação', () => {
    expect(W90).toBeCloseTo(1.1, 9);
    const m = minLegibleHeight({ text: 'ANDRE HENRIQUE', font: fontV2, grooveWidth: W90 });
    expect(m).toEqual({ legible: true, height: 9.4 });
    const fit = fitInBlock('ANDRE HENRIQUE', fontV2, { height: 10, blockW: 50, blockH: 10, margin: 0 });
    expect(fit.maxHeight).toBe(5.6);
    expect(viableRange(m.height, fit.maxHeight)).toEqual({ viable: false });
    const atMax = analyzeLegibility(lay2('ANDRE HENRIQUE', { height: fit.maxHeight }), W90);
    expect(atMax.nivel).toBe('vermelho');
    expect(canExport(atMax.nivel, false)).toBe(false);
    expect(canExport(atMax.nivel, true)).toBe(true);
  });
});
