import { describe, it, expect } from 'vitest';
import { layoutText } from '../src/core/engraving/layout';
import { buildToolpath, round3, plungeWarning } from '../src/core/engraving/toolpath';
import { buildEngravingProgram } from '../src/core/engraving/emitHeidenhain';
import { postprocess } from '../src/core/postprocessors/heidenhain';
import fontData from '../src/core/engraving/fonts/traco-simples-10.v1.json';

/**
 * Gravador de Textos CNC — trajetória, emissor Heidenhain e ida e volta.
 * Sem ISO na v1 (decisão): roundtrip só Heidenhain absoluto; sem modo
 * incremental, o teste 4 vira determinismo/anti-deriva do absoluto.
 */

const META = { slug: fontData.font.slug, version: fontData.font.version, name: fontData.font.name };

const lay = (text, params = {}) =>
  layoutText(text, fontData, { height: 10, letterSpacing: 0, x0: 0, y0: 0, ...params });

const prog = (text, machining = {}) =>
  buildEngravingProgram({ layout: lay(text), machining, fontMeta: META });

describe('round3 — 3 casas, nunca -0', () => {
  it('normaliza zeros negativos', () => {
    expect(round3(-0.00004)).toBe('0.000');
    expect(round3(-0)).toBe('0.000');
    expect(round3(0)).toBe('0.000');
    expect(round3(2.5)).toBe('2.500');
    expect(round3(-3.14159)).toBe('-3.142');
  });
});

describe('buildToolpath — sequência por traço + padrões', () => {
  it('I: XY no alto, Z seguranca, aproximacao, mergulho, corte, subida; defaults (corte 500)', () => {
    const { blocks, machining } = buildToolpath(lay('I'), {});
    expect(machining).toMatchObject({ zGravacao: 0, zSeguranca: 10, feed: 500, rpm: 1000, ferramenta: 2, zInicio: 100, plungeFeed: 125, approach: 2 });
    const kinds = blocks.map((b) => b.type);
    expect(kinds).toEqual(['rapid', 'rapid', 'rapid', 'linear', 'linear', 'rapid']);
    expect(blocks[0].coords).toEqual({ x: '0.000', y: '0.000' });
    expect(blocks[1].coords).toEqual({ z: '10.000' });
    expect(blocks[2]).toMatchObject({ type: 'rapid', coords: { z: '2.000' } });
    expect(blocks[3]).toMatchObject({ type: 'linear', feed: 125 });
    expect(blocks[3].coords.z).toBe('0.000');
    expect(blocks[4]).toMatchObject({ type: 'linear', feed: 500 });
    expect(blocks[5]).toMatchObject({ type: 'rapid', coords: { z: '10.000' } });
  });

  it('arco vira bloco arc com centro/fim/sentido', () => {
    const { blocks } = buildToolpath(lay('C'), {});
    const arc = blocks.find((b) => b.type === 'arc');
    expect(arc).toBeTruthy();
    expect(arc.direction).toBe('ccw');
    expect(arc.feed).toBe(500);
  });

  it('usinagem inválida lança', () => {
    expect(() => buildToolpath(lay('I'), { feed: 0 })).toThrowError(/Avanco/);
    expect(() => buildToolpath(lay('I'), { rpm: -1 })).toThrowError(/Rotacao/);
  });
});

describe('buildToolpath - mergulho so nas descidas + aproximacao', () => {
  const M = { feed: 2000, plungeFeed: 500, approach: 2 };

  it('sequencia por traco: XY, Zseg, aproximacao FMAX, mergulho, corte, subida', () => {
    const { blocks, machining, warnings, plunge } = buildToolpath(lay('I'), M);
    expect(plunge).toBe(true);
    expect(warnings).toEqual([]);
    expect(blocks.map((b) => b.type)).toEqual(['rapid', 'rapid', 'rapid', 'linear', 'linear', 'rapid']);
    expect(blocks[2]).toMatchObject({ type: 'rapid', coords: { z: '2.000' } });
    expect(blocks[3]).toMatchObject({ type: 'linear', coords: { z: '0.000' }, feed: 500 });
    expect(blocks[4]).toMatchObject({ type: 'linear', feed: 2000 });
    expect(machining).toMatchObject({ plungeFeed: 500, approach: 2 });
  });

  it('arcos cortam no avanco de corte; descida no de mergulho', () => {
    const { blocks } = buildToolpath(lay('C'), M);
    const arc = blocks.find((b) => b.type === 'arc');
    expect(arc.feed).toBe(2000);
    const descents = blocks.filter((b) => b.type === 'linear' && b.coords.x === undefined);
    expect(descents).toHaveLength(1);
    expect(descents[0].feed).toBe(500);
  });

  it('approach vazio vira zGravacao + 2; sem os dois vira padrao com mergulho', () => {
    const a = buildToolpath(lay('I'), { plungeFeed: 500 });
    expect(a.blocks[2]).toMatchObject({ type: 'rapid', coords: { z: '2.000' } });
    const d = buildToolpath(lay('I'), {});
    expect(d.plunge).toBe(true);
    expect(d.blocks.map((b) => b.type)).toEqual(['rapid', 'rapid', 'rapid', 'linear', 'linear', 'rapid']);
    expect(d.machining.plungeFeed).toBe(125);
    expect(d.machining.approach).toBe(2);
  });

  it('validacoes explicam o motivo', () => {
    expect(() => buildToolpath(lay('I'), { ...M, plungeFeed: 0 })).toThrowError(/maior que zero/);
    expect(() => buildToolpath(lay('I'), { ...M, plungeFeed: 3000 })).toThrowError(/nao pode passar/);
    expect(() => buildToolpath(lay('I'), { ...M, plungeFeed: NaN })).toThrowError(/numero valido/);
    expect(() => buildToolpath(lay('I'), { ...M, approach: 0.05 })).toThrowError(/minimo/);
    expect(() => buildToolpath(lay('I'), { ...M, approach: 10 })).toThrowError(/menor que o Z/);
    expect(() => buildToolpath(lay('I'), { ...M, approach: NaN })).toThrowError(/numero valido/);
  });

  it('acima de 50% do corte avisa sem bloquear', () => {
    expect(plungeWarning(2000, 1200)).toMatch(/50%/);
    expect(plungeWarning(2000, 1000)).toBeNull();
    expect(plungeWarning(2000, 500)).toBeNull();
    expect(plungeWarning(2000, NaN)).toBeNull();
    const r = buildToolpath(lay('I'), { ...M, plungeFeed: 1200 });
    expect(r.warnings).toHaveLength(1);
    expect(r.blocks.find((b) => b.type === 'linear' && b.coords.x === undefined).feed).toBe(1200);
  });
});

describe('cabecalho com avancos (corte + mergulho)', () => {
  it('linha de Avanco sempre (sequencia unica com mergulho)', () => {
    const tooling = { description: 'V 60graus ponta 0,1 mm' };
    const withPlunge = buildEngravingProgram({
      layout: lay('I'), machining: { feed: 2000, plungeFeed: 500, approach: 2 }, fontMeta: META, tooling,
    });
    expect(withPlunge).toContain('Avanco: corte 2000 mm/min + mergulho 500 mm/min (25%)');
    const defaults = buildEngravingProgram({ layout: lay('I'), machining: {}, fontMeta: META, tooling });
    expect(defaults).toContain('Avanco: corte 500 mm/min + mergulho 125 mm/min (25%)');
  });
});

describe('postprocess IR arc — aditivo, CC antes de C', () => {
  it('bloco arc emite CC + C com DR por sentido', () => {
    const out = postprocess([
      { type: 'arc', center: { x: '2.500', y: '7.500' }, end: { x: '0.000', y: '7.500' }, direction: 'cw', feed: 2000 },
    ]);
    expect(out).toContain('CC X+2,500 Y+7,500');
    expect(out).toContain('DR-');
    const out2 = postprocess([
      { type: 'arc', center: { x: '2.500', y: '2.500' }, end: { x: '5.000', y: '2.500' }, direction: 'ccw', feed: 2000 },
    ]);
    expect(out2).toContain('DR+');
  });
});

describe('programa Heidenhain — estrutural', () => {
  const text = prog('ANDRE HENRIQUE');

  it('cabeçalho com fonte/versão + SIMULAR + abertura e fim do original', () => {
    expect(text).toContain('traco-simples-10');
    expect(text).toContain('v1');
    expect(text).toContain('SIMULAR ANTES DE USAR');
    expect(text).toContain('TOOL CALL 2 Z S1000');
    expect(text).toContain('L Z +100,000 R0 FMAX M3');
    expect(text).toContain('L Z +100,000 R0 FMAX M30');
    expect(text).toContain('BEGIN PGM GRAVACAO_');
    expect(text).toMatch(/END PGM GRAVACAO_\d{8} MM/);
  });

  it('abertura: XY ainda no alto antes de descer ao Z de segurança', () => {
    const lines = prog('I').split('\n').map((l) => l.replace(/^\d+\s+/, ''));
    const iXY = lines.findIndex((l) => /^L X/.test(l));
    const iZseg = lines.findIndex((l) => /^L Z \+10,000/.test(l));
    expect(iXY).toBeGreaterThanOrEqual(0);
    expect(iZseg).toBeGreaterThanOrEqual(0);
    expect(iXY).toBeLessThan(iZseg);
  });

  it('todo C tem CC imediatamente antes; DR- p/ cw, DR+ p/ ccw', () => {
    const lines = text.split('\n').map((l) => l.replace(/^\d+ /, ''));
    const cIdx = lines.map((l, i) => (/^C X/.test(l) ? i : -1)).filter((i) => i >= 0);
    expect(cIdx.length).toBeGreaterThan(0);
    for (const i of cIdx) {
      expect(lines[i - 1].startsWith('CC X')).toBe(true);
    }
    expect(text).toContain('DR-');
    expect(text).toContain('DR+');
  });

  it('programName explícito (nome por texto) vale no BEGIN/END', () => {
    const p = buildEngravingProgram({ layout: lay('A'), machining: {}, fontMeta: META, programName: 'andre_1026' });
    expect(p).toContain('BEGIN PGM andre_1026 MM');
    expect(p).toMatch(/END PGM andre_1026 MM/);
  });

  it('sem -0 em lugar nenhum', () => {
    const p = prog('ANDRE HENRIQUE', {});
    expect(p).not.toMatch(/-0(?!\d)/);
    const p2 = buildEngravingProgram({
      layout: lay('LI', { x0: -0.00004 }),
      machining: {},
      fontMeta: META,
    });
    expect(p2).not.toMatch(/-0(?!\d)/);
  });
});

// Parser mínimo só do teste: L (XY/Z), CC (centro), C (fim). Vírgula→ponto.
// Blocos 0–9 têm espaço duplo após o número ("0  L …"), por isso \s+.
function parseProgram(text) {
  const pts = [];
  const centers = [];
  const drifts = [];
  for (const raw of text.split('\n')) {
    const line = raw.replace(/^\d+\s+/, '');
    if (/^(;|BEGIN|END|TOOL|FN|LBL)/.test(line)) continue;
    const nums = [...line.matchAll(/([XYZ])\s*([+-]?[\d,]+)/g)].map((m) => [m[1], Number(m[2].replace(',', '.'))]);
    const get = (k) => nums.find((n) => n[0] === k)?.[1];
    if (line.startsWith('CC ')) {
      centers.push([get('X'), get('Y')]);
    } else if (/^C X/.test(line)) {
      pts.push([get('X'), get('Y')]);
    } else if (line.startsWith('L ')) {
      if (get('X') !== undefined && get('Y') !== undefined) pts.push([get('X'), get('Y')]);
      if (get('Z') !== undefined) drifts.push(get('Z'));
    }
  }
  return { pts, centers, drifts };
}

describe('ida e volta Heidenhain absoluto (teste 3, sem ISO na v1)', () => {
  it('geometria recuperada == layout (tol 0,002)', () => {
    const layout = lay('ANDRE HENRIQUE');
    const rec = parseProgram(prog('ANDRE HENRIQUE'));
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
      expect(p[0]).toBeCloseTo(flat[i][0], 2);
      expect(p[1]).toBeCloseTo(flat[i][1], 2);
    });
    expect(rec.centers.length).toBe(arcCenters.length);
    rec.centers.forEach((p, i) => {
      expect(p[0]).toBeCloseTo(arcCenters[i][0], 2);
      expect(p[1]).toBeCloseTo(arcCenters[i][1], 2);
    });
    expect(new Set(rec.drifts)).toEqual(new Set([100, 10, 2, 0]));
  });
});

describe('texto longo em absoluto: sem deriva (teste 4 adaptado)', () => {
  it('60+ caracteres terminam na posição absoluta esperada (±0,001)', () => {
    const text = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.repeat(2);
    expect(text.length).toBeGreaterThanOrEqual(60);
    const layout = lay(text);
    const last = layout.strokes[layout.strokes.length - 1];
    const end = last.segs[last.segs.length - 1].to;
    const rec = parseProgram(prog(text));
    const plast = rec.pts[rec.pts.length - 1];
    expect(plast[0]).toBeCloseTo(end[0], 3);
    expect(plast[1]).toBeCloseTo(end[1], 3);
    const again = prog(text);
    expect(again).toBe(prog(text));
  });
});
