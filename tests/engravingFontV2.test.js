import { describe, it, expect } from 'vitest';
import { validateFont } from '../src/core/engraving/validateFont';
import { layoutText } from '../src/core/engraving/layout';
import { grooveWidth, describeTool, effectiveMargin } from '../src/core/engraving/groove';
import { analyzeLegibility, minLegibleHeight, viableRange, canExport, describeWorst } from '../src/core/engraving/legibility';
import { fitInBlock } from '../src/core/engraving/fit';
import { buildEngravingProgram, toAscii } from '../src/core/engraving/emitHeidenhain';
import fontV1 from '../src/core/engraving/fonts/traco-simples-10.v1.json';
import fontV2 from '../src/core/engraving/fonts/traco-simples-10.v2.json';
import golden from './fixtures/andre-henrique.golden.json';

/**
 * Parte 3 — fonte v2 (47 caracteres: v1 intacta + - _ . / + = # ( ) &).
 * A v1 publicada é imutável e segue no repo só para compatibilidade;
 * o embutido padrão serve a v2 e o .H carimba a versão da fonte usada.
 */

const clone = (o) => JSON.parse(JSON.stringify(o));

// ASCII estrito sem regex de controle (regra de lint): todo char ≤ 0x7F.
const isAscii = (s) => {
  for (const ch of String(s)) {
    if (ch.codePointAt(0) > 0x7f) return false;
  }
  return true;
};

const lay2 = (text, params = {}) =>
  layoutText(text, fontV2, { height: 10, letterSpacing: 0, x0: 0, y0: 0, ...params });

const META2 = { slug: fontV2.font.slug, version: fontV2.font.version, name: fontV2.font.name };

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

describe('v2 contém a v1 com geometria idêntica (comparação profunda)', () => {
  it('37 caracteres da v1 presentes, char/advance/bbox/strokes/provisional iguais', () => {
    const byChar = new Map(fontV2.glyphs.map((g) => [g.char, g]));
    expect(fontV2.glyphs).toHaveLength(47);
    for (const g of fontV1.glyphs) {
      const h = byChar.get(g.char);
      expect(h, `glifo '${g.char}'`).toBeTruthy();
      expect(h.advance).toBe(g.advance);
      expect(h.bbox).toEqual(g.bbox);
      expect(h.strokes).toEqual(g.strokes);
      expect(!!h.provisional).toBe(!!g.provisional);
    }
    const fresh = new Set(fontV1.glyphs.map((g) => g.char));
    expect(fontV2.glyphs.filter((g) => !fresh.has(g.char)).map((g) => g.char).join(''))
      .toBe('-_./+=#()&');
  });
});

describe('golden ANDRE HENRIQUE continua passando com a v2', () => {
  it('altura 10, espaço 0 == golden (tol 0,001), sem avisos', () => {
    const out = lay2('ANDRE HENRIQUE');
    expectStrokesClose(out.strokes, golden.strokes, 3);
    expect(out.warnings).toEqual([]);
  });
});

describe('validateFont aceita a v2 e rejeita adulteração', () => {
  it('v2 passa limpa', () => {
    const r = validateFont(fontV2);
    expect(r.errors).toEqual([]);
    expect(r.valid).toBe(true);
  });

  it('v1 segue válida (compatibilidade, publicada imutável)', () => {
    expect(validateFont(fontV1).valid).toBe(true);
  });

  it('rejeita v2 adulterada', () => {
    const badAdvance = clone(fontV2);
    badAdvance.glyphs.find((g) => g.char === '.').advance = 0;
    expect(validateFont(badAdvance).valid).toBe(false);

    const dup = clone(fontV2);
    dup.glyphs.push(clone(fontV2.glyphs.find((g) => g.char === '#')));
    expect(validateFont(dup).errors.some((e) => e.includes('duplicado'))).toBe(true);

    const badArc = clone(fontV2);
    badArc.glyphs.find((g) => g.char === '(').strokes[0].segs[0].c = [0, 0];
    expect(validateFont(badArc).valid).toBe(false);
  });
});

describe('avanço dos símbolos novos = xmax + 2 (tol 1e-6)', () => {
  for (const ch of ['-', '_', '.', '/', '+', '=', '#', '(', ')', '&']) {
    it(`'${ch}'`, () => {
      const g = fontV2.glyphs.find((x) => x.char === ch);
      expect(Math.abs(g.advance - (g.bbox[2] + 2))).toBeLessThan(1e-6);
    });
  }
});

describe('toAscii — cabeçalho só ASCII', () => {
  it('ç→c, é→e, °→graus, travessão→-', () => {
    expect(toAscii('Traço (série ALFA) 45° — ponta')).toBe('Traco (serie ALFA) 45graus - ponta');
  });

  it('programa inteiro ASCII em várias combinações (ferramenta/texto/diagnóstico)', () => {
    const combos = [
      [{ type: 'flat', diameter: 0.5 }, 0.2, 'A', 10, null],
      [{ type: 'ball', diameter: 1 }, 0.2, 'Q', 5, { w: 50, h: 10 }],
      [{ type: 'vee', angle: 60, tipDiameter: 0.1 }, 0.2, 'ANDRE HENRIQUE', 10, { w: 200, h: 25 }],
      [{ type: 'vee', angle: 90, radius: 0.5 }, 0.3, 'A-B_C.D/E+F=G#H&I(J)K', 5, null],
    ];
    for (const [tool, depth, text, height, blockDims] of combos) {
      const w = grooveWidth(tool, depth);
      const layout = lay2(text, { height });
      const a = analyzeLegibility(layout, w);
      const block = blockDims
        ? (() => {
          const f = fitInBlock(text, fontV2, {
            height, blockW: blockDims.w, blockH: blockDims.h, margin: effectiveMargin(0, w),
          });
          return { w: blockDims.w, h: blockDims.h, margin: effectiveMargin(0, w), fits: f.fits, overW: f.overW, overH: f.overH };
        })()
        : null;
      const prog = buildEngravingProgram({
        layout, machining: {}, fontMeta: META2,
        tooling: {
          description: describeTool(tool), depth, zSurf: 0, width: w, measured: false,
          folga: a.folgaMinima, nivel: a.nivel, pior: a.pior,
        },
        block,
      });
      expect(isAscii(prog)).toBe(true);
      expect(prog.includes('undefined')).toBe(false);
      expect(prog).toContain('Traco simples 10 mm (serie ALFA)');
    }
  });
});

describe('cabeçalho: números com vírgula, ≤3 casas (margem/bloco)', () => {
  it('margem efetiva 0,514… sai 0,514, sem ponto decimal no cabeçalho', () => {
    const w = grooveWidth({ type: 'vee', angle: 45, tipDiameter: 0.2 }, 1.0);
    const margin = effectiveMargin(0, w);
    expect(margin).toBeCloseTo(0.5142, 4);
    const prog = buildEngravingProgram({
      layout: lay2('A'), machining: {}, fontMeta: META2,
      tooling: { description: 'x', depth: 1, zSurf: 0, width: w, measured: false, folga: 1, nivel: 'verde', pior: null },
      block: { w: 200, h: 25, margin, fits: true, overW: 0, overH: 0 },
    });
    const head = prog.split('\n').filter((l) => /^\d+\s+;/.test(l)).join('\n');
    expect(head).toContain('margem 0,514');
    expect(head).toContain('Bloco: 200x25');
    expect(/\d\.\d/.test(head)).toBe(false);
  });
});

describe('aceite V45 em símbolos, bloco 200x25', () => {
  const TOOL45 = { type: 'vee', angle: 45, tipDiameter: 0.2 };
  const TEXT45 = 'A-B_C.D/E+F=G#H&I(J)K';
  const W45 = grooveWidth(TOOL45, 1.0);

  it('largura 1,0284; pior dentro do K; folga -0,195; vermelho', () => {
    expect(W45).toBeCloseTo(1.0284, 4);
    const r = analyzeLegibility(lay2(TEXT45), W45);
    expect(r.nivel).toBe('vermelho');
    expect(r.pior).toMatchObject({ tipo: 'dentro', caracteres: 'K' });
    expect(r.folgaMinima).toBeCloseTo(-0.1954, 4);
    expect(describeWorst(r.pior)).toBe('dentro do K');
  });

  it('mínima 18,6; máxima 15,5 (margem efetiva); faixa vazia; gate no vermelho', () => {
    const m = minLegibleHeight({ text: TEXT45, font: fontV2, grooveWidth: W45 });
    expect(m).toEqual({ legible: true, height: 18.6 });
    const margin = effectiveMargin(0, W45);
    const fit = fitInBlock(TEXT45, fontV2, { height: 10, blockW: 200, blockH: 25, margin });
    expect(fit.maxHeight).toBe(15.5);
    expect(viableRange(m.height, fit.maxHeight)).toEqual({ viable: false });
    const atBase = analyzeLegibility(lay2(TEXT45), W45);
    expect(atBase.nivel).toBe('vermelho');
    expect(canExport(atBase.nivel, false)).toBe(false);
    expect(canExport(atBase.nivel, true)).toBe(true);
  });

  it('cabeçalho do aceite: dentro do K, margem 0,514, ASCII, sem undefined', () => {
    const margin = effectiveMargin(0, W45);
    const fit = fitInBlock(TEXT45, fontV2, { height: 10, blockW: 200, blockH: 25, margin });
    const layout = lay2(TEXT45);
    const a = analyzeLegibility(layout, W45);
    const prog = buildEngravingProgram({
      layout, machining: {}, fontMeta: META2,
      tooling: {
        description: describeTool(TOOL45), depth: 1.0, zSurf: 0, width: W45, measured: false,
        folga: a.folgaMinima, nivel: a.nivel, pior: a.pior,
      },
      block: { w: 200, h: 25, margin, fits: fit.fits, overW: fit.overW, overH: fit.overH },
    });
    expect(prog).toContain('dentro do K');
    expect(prog).toContain('margem 0,514');
    expect(prog.includes('undefined')).toBe(false);
    expect(isAscii(prog)).toBe(true);
  });
});

describe('cabeçalho do .H registra a v2', () => {
  it('slug + v2 no cabeçalho', () => {
    const text = buildEngravingProgram({ layout: lay2('A'), machining: {}, fontMeta: META2 });
    expect(text).toContain('traco-simples-10');
    expect(text).toContain('v2');
  });

  it('ferramenta, profundidade, risco, folga e nível no cabeçalho', () => {
    const tool = { type: 'vee', angle: 60, tipDiameter: 0.1 };
    const w = grooveWidth(tool, 0.2);
    const layout = lay2('A');
    const a = analyzeLegibility(layout, w);
    const text = buildEngravingProgram({
      layout, machining: {}, fontMeta: META2,
      tooling: {
        description: describeTool(tool), depth: 0.2, zSurf: 0,
        width: w, measured: false, folga: a.folgaMinima, nivel: a.nivel, pior: a.pior,
      },
    });
    expect(text).toContain('Ferramenta: V 60graus ponta 0,1 mm');
    expect(text).toContain('Profundidade: 0,2 mm');
    expect(text).toContain('Largura do risco: 0,331 mm (calculada)');
    expect(text).toContain('Diagnostico: VERDE');
  });
});

describe('busca do glifo: exato → maiúscula → sem acento', () => {
  it('símbolos entram exatos, sem aviso e sem avanço perdido', () => {
    const out = lay2('-_./+=#()&');
    expect(out.warnings).toEqual([]);
    expect(out.strokes.length).toBeGreaterThan(0);
  });

  it('minúscula usa a maiúscula com aviso; acento só sem glifo acentuado', () => {
    const low = lay2('a');
    expect(low.strokes).toHaveLength(1);
    expect(low.warnings.some((w) => w.includes('Minúscula'))).toBe(true);
    const acc = lay2('É');
    expect(acc.strokes).toHaveLength(1);
    expect(acc.warnings.some((w) => w.includes('Acento'))).toBe(true);
    // '@' continua ignorado sem gerar traço
    expect(lay2('A@').strokes.map((st) => st.ch).join('')).toBe('A');
  });
});

// Parser mínimo do teste (igual ao do teste 3): L (XY), CC (centro), C (fim).
function parseProgram(text) {
  const pts = [];
  const centers = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\d+\s+/, '');
    if (/^(;|BEGIN|END|TOOL|FN|LBL)/.test(line)) continue;
    const nums = [...line.matchAll(/([XY])\s*([+-]?[\d,]+)/g)].map((m) => [m[1], Number(m[2].replace(',', '.'))]);
    const get = (k) => nums.find((n) => n[0] === k)?.[1];
    if (line.startsWith('CC ')) centers.push([get('X'), get('Y')]);
    else if (/^C X/.test(line)) pts.push([get('X'), get('Y')]);
    else if (line.startsWith('L ') && get('X') !== undefined) pts.push([get('X'), get('Y')]);
  }
  return { pts, centers };
}

describe('ida e volta com símbolos (tol 0,002 mm)', () => {
  it('A-B_C.D/E+F=G#H&I(J)K recuperado == layout', () => {
    const text = 'A-B_C.D/E+F=G#H&I(J)K';
    const layout = lay2(text);
    const prog = buildEngravingProgram({ layout, machining: {}, fontMeta: META2 });
    const rec = parseProgram(prog);
    const flat = [];
    const arcCenters = [];
    for (const st of layout.strokes) {
      flat.push(st.from);
      for (const s of st.segs) {
        flat.push(s.to);
        if (s.t === 'A') arcCenters.push(s.c);
      }
    }
    expect(rec.pts.length).toBe(flat.length);
    rec.pts.forEach((p, i) => {
      expect(Math.abs(p[0] - flat[i][0])).toBeLessThan(0.002);
      expect(Math.abs(p[1] - flat[i][1])).toBeLessThan(0.002);
    });
    expect(rec.centers.length).toBe(arcCenters.length);
    rec.centers.forEach((p, i) => {
      expect(Math.abs(p[0] - arcCenters[i][0])).toBeLessThan(0.002);
      expect(Math.abs(p[1] - arcCenters[i][1])).toBeLessThan(0.002);
    });
  });
});

describe('encaixe usa a caixa real da tinta com . e _', () => {
  it('"." tem 1,2 mm de tinta a altura 10; limite de largura pela tinta', () => {
    const f = fitInBlock('.', fontV2, { height: 10, blockW: 50, blockH: 10, margin: 0 });
    expect(f.inkWidth).toBeCloseTo(1.2, 9);
    expect(f.inkHeight).toBeCloseTo(1.2, 9);
    expect(f.fits).toBe(true);
    // Bloco 12×100: pela tinta (1,2) o teto é ~100; pelo avanço (3,2) seria 37,5.
    const w = fitInBlock('.', fontV2, { height: 10, blockW: 12, blockH: 100, margin: 0 });
    expect(w.maxHeight).toBeCloseTo(100, 0);
  });

  it('"_" largo 5 de tinta (avanço 7): teto 10 num bloco 5×10', () => {
    const f = fitInBlock('_', fontV2, { height: 10, blockW: 5, blockH: 10, margin: 0 });
    expect(f.inkWidth).toBeCloseTo(5, 9);
    expect(f.inkHeight).toBeCloseTo(0, 9);
    expect(f.fits).toBe(true);
    // Pela tinta (5): 10; pelo avanço (7): 7,1.
    expect(f.maxHeight).toBe(10);
  });
});
