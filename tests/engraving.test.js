import { describe, it, expect } from 'vitest';
import { validateFont } from '../src/core/engraving/validateFont';
import { getFont, embeddedFontRepository } from '../src/core/engraving/fontRepository';
import { layoutText, describeArc, measureCutLength } from '../src/core/engraving/layout';
import fontData from '../src/core/engraving/fonts/traco-simples-10.v1.json';
import fontV2 from '../src/core/engraving/fonts/traco-simples-10.v2.json';
import golden from './fixtures/andre-henrique.golden.json';

/**
 * Gravador de Textos CNC — fonte, repositório e motor geométrico.
 */

const clone = (o) => JSON.parse(JSON.stringify(o));

function expectStrokesClose(actual, expected, digits = 3) {
  expect(actual.length).toBe(expected.length);
  actual.forEach((st, i) => {
    const ex = expected[i];
    expect(st.from[0]).toBeCloseTo(ex.from[0], digits);
    expect(st.from[1]).toBeCloseTo(ex.from[1], digits);
    expect(st.segs.length).toBe(ex.segs.length);
    st.segs.forEach((s, j) => {
      const sx = ex.segs[j];
      expect(s.t).toBe(sx.t);
      expect(s.to[0]).toBeCloseTo(sx.to[0], digits);
      expect(s.to[1]).toBeCloseTo(sx.to[1], digits);
      if (s.t === 'A') {
        expect(s.cw).toBe(sx.cw);
        expect(s.c[0]).toBeCloseTo(sx.c[0], digits);
        expect(s.c[1]).toBeCloseTo(sx.c[1], digits);
      }
    });
  });
}

describe('validateFont — teste 5 (dados da fonte)', () => {
  it('fonte embutida passa', () => {
    const r = validateFont(fontData);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('rejeita fonte adulterada', () => {
    const badAdvance = clone(fontData);
    badAdvance.glyphs[0].advance = 0;
    expect(validateFont(badAdvance).valid).toBe(false);

    const dup = clone(fontData);
    dup.glyphs.push(clone(fontData.glyphs[0]));
    expect(validateFont(dup).errors.some((e) => e.includes('duplicado'))).toBe(true);

    const badArc = clone(fontData);
    badArc.glyphs.find((g) => g.char === 'O').strokes[0].segs[0].c = [0, 0];
    expect(validateFont(badArc).valid).toBe(false);

    const loop = clone(fontData);
    const oSeg = loop.glyphs.find((g) => g.char === 'O').strokes[0].segs[0];
    oSeg.to = [0.0, 2.5];
    // arco de [0,2.5] até [0,2.5]: início igual ao fim (raios seguem iguais)
    const r = validateFont({ font: loop.font, glyphs: [loop.glyphs.find((g) => g.char === 'O')] });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes('início igual ao fim'))).toBe(true);

    const outside = clone(fontData);
    outside.glyphs.find((g) => g.char === 'A').strokes[0].segs[0].to = [99, 99];
    expect(validateFont(outside).valid).toBe(false);

    const badRef = clone(fontData);
    badRef.font.height_ref = 0;
    expect(validateFont(badRef).valid).toBe(false);

    expect(validateFont(null).valid).toBe(false);
    expect(validateFont({}).valid).toBe(false);
  });
});

describe('fontRepository — getFont', () => {
  it('resolve a fonte embutida validada (v2 por padrão)', async () => {
    const f = await getFont('traco-simples-10');
    expect(f.glyphs).toHaveLength(47);
    expect(f.font.version).toBe(2);
  });

  it('slug desconhecido rejeita', async () => {
    await expect(embeddedFontRepository.getFont('x')).rejects.toThrow();
  });
});

describe('layoutText — aceite golden (teste 1)', () => {
  it('"ANDRE HENRIQUE" altura 10, espaco 0, origem 0,0 == golden (tol 0,001)', () => {
    const out = layoutText('ANDRE HENRIQUE', fontData, { height: 10, letterSpacing: 0, x0: 0, y0: 0 });
    expectStrokesClose(out.strokes, golden.strokes, 3);
    expect(out.warnings).toEqual([]);
  });
});

describe('layoutText — escala (teste 2)', () => {
  it('altura 5 = metade exata; espacamento extra sem escala', () => {
    const full = layoutText('ANDRE HENRIQUE', fontData, { height: 10, letterSpacing: 0, x0: 0, y0: 0 });
    const half = layoutText('ANDRE HENRIQUE', fontData, { height: 5, letterSpacing: 0, x0: 0, y0: 0 });
    expect(half.strokes.length).toBe(full.strokes.length);
    half.strokes.forEach((st, i) => {
      expect(st.from[0]).toBeCloseTo(full.strokes[i].from[0] / 2, 12);
      expect(st.from[1]).toBeCloseTo(full.strokes[i].from[1] / 2, 12);
    });
    expect(half.bounds.width).toBeCloseTo(full.bounds.width / 2, 12);
    // espacamento extra soma em mm reais, sem escala
    const spaced = layoutText('AB', fontData, { height: 5, letterSpacing: 2, x0: 0, y0: 0 });
    const plain = layoutText('AB', fontData, { height: 5, letterSpacing: 0, x0: 0, y0: 0 });
    expect(spaced.strokes[1].from[0] - plain.strokes[1].from[0]).toBeCloseTo(2, 12);
    expect(spaced.bounds.width - plain.bounds.width).toBeCloseTo(2, 12);
  });
});

describe('layoutText — texto (teste 6)', () => {
  it('minúsculas usam a maiúscula, com aviso; símbolos entram exatos sem aviso', () => {
    const a = layoutText('andre', fontData, { height: 10 });
    const b = layoutText('ANDRE', fontData, { height: 10 });
    expectStrokesClose(a.strokes, b.strokes, 9);
    expect(a.warnings.some((w) => w.includes('Minúscula'))).toBe(true);
    expect(b.warnings).toEqual([]);
    const s = layoutText('A-B', fontV2, { height: 10 });
    expect(s.warnings).toEqual([]);
    expect(s.strokes.map((st) => st.ch).join('')).toBe('A-B');
  });

  it('acentos removidos com aviso; inexistente avisa e não avança', () => {
    const out = layoutText('É@', fontData, { height: 10 });
    expect(out.warnings.some((w) => w.includes('Acento'))).toBe(true);
    expect(out.warnings.some((w) => w.includes('@'))).toBe(true);
    // 'É' virou 'E' (1 traço de 6 segs); '@' não gerou traço nem avanço
    expect(out.strokes).toHaveLength(1);
    expect(out.strokes[0].segs).toHaveLength(6);
  });

  it('\\n desce a linha pelo fator; espaço avança 5×escala', () => {
    const out = layoutText('A\nA', fontData, { height: 10 });
    expect(out.lines).toHaveLength(2);
    expect(out.lines[1].y).toBeCloseTo(-16, 12);
    const custom = layoutText('A\nA', fontData, { height: 10, lineHeightFactor: 2 });
    expect(custom.lines[1].y).toBeCloseTo(-20, 12);
    const sp = layoutText('A A', fontData, { height: 20 });
    // A(7) + espaço(5) em escala 2 → segundo A começa em (7+5)*2 = 24
    expect(sp.strokes[1].from[0]).toBeCloseTo(24, 9);
  });

  it('área disponível excedida gera aviso (sem alterar o texto)', () => {
    const out = layoutText('ANDRE HENRIQUE', fontData, { height: 10, availableWidth: 80 });
    expect(out.warnings.some((w) => w.includes('área'))).toBe(true);
    expect(out.strokes).toHaveLength(14);
    const ok = layoutText('ANDRE HENRIQUE', fontData, { height: 10, availableWidth: 500, availableHeight: 50 });
    expect(ok.warnings).toEqual([]);
  });

  it('zero provisório avisa', () => {
    const out = layoutText('0', fontData, { height: 10 });
    expect(out.warnings.some((w) => w.includes('provisório'))).toBe(true);
    expect(out.strokes).toHaveLength(1);
  });

  it('altura ≤ 0 e texto vazio são erro', () => {
    expect(() => layoutText('A', fontData, { height: 0 })).toThrowError(/Altura/);
    expect(() => layoutText('', fontData, { height: 10 })).toThrowError(/graváveis/);
    expect(() => layoutText('   ', fontData, { height: 10 })).toThrowError(/graváveis/);
  });
});

describe('describeArc — flags do SVG', () => {
  it('semicírculo: large-arc 0; 270°: large-arc 1; cw-na-máquina vira sweep 1 na tela', () => {
    const semi = describeArc([0, 2.5], { t: 'A', to: [5, 2.5], c: [2.5, 2.5], cw: false });
    expect(semi.sweepDeg).toBeCloseTo(180, 9);
    expect(semi.largeArc).toBe(0);
    expect(semi.sweepFlag).toBe(0);
    const big = describeArc([0, 7.5], { t: 'A', to: [2.5, 5], c: [2.5, 7.5], cw: true });
    expect(big.sweepDeg).toBeCloseTo(270, 9);
    expect(big.largeArc).toBe(1);
    expect(big.sweepFlag).toBe(1);
  });
});

describe('measureCutLength — sanidade', () => {
  it('quadrado 10×10 mede 40; semicírculo r2,5 mede π·2,5', () => {
    const sq = [{ from: [0, 0], segs: [{ t: 'L', to: [10, 0] }, { t: 'L', to: [10, 10] }, { t: 'L', to: [0, 10] }, { t: 'L', to: [0, 0] }] }];
    expect(measureCutLength(sq)).toBeCloseTo(40, 9);
    const semi = [{ from: [0, 2.5], segs: [{ t: 'A', to: [5, 2.5], c: [2.5, 2.5], cw: false }] }];
    expect(measureCutLength(semi)).toBeCloseTo(Math.PI * 2.5, 9);
  });
});
