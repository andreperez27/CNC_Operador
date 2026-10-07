import { describe, it, expect } from 'vitest';
import {
  RING_OPTIONS,
  parseAngle,
  buildHuronResult,
  formatResultEcho,
  formatRingNote,
  formatCopyCalibLine,
  buildCopyText,
  initHuronPageState,
  huronPageReducer,
} from '../src/features/huron/huronPageState';

/**
 * Correções da auditoria do resultado obsoleto (C=45 exibido com o campo
 * em C=40): editar campo/anel invalida o resultado, e o resultado ecoa o
 * A/B/C usados no cálculo. Lógica pura do HuronPage (sem DOM).
 */

const edit = (state, id, raw) => huronPageReducer(state, { type: 'FIELD_EDIT', id, raw });
const calc = (state) => huronPageReducer(state, { type: 'CALCULATE' });
const ring = (state, id, value) => huronPageReducer(state, { type: 'RING_CHANGE', id, value });

const fillABC = (state, A, B, C) => calc(edit(edit(edit(state, 'A', A), 'B', B), 'C', C));

describe('(a) editar campo depois de calcular remove o resultado', () => {
  it('FIELD_EDIT limpa result e submitted', () => {
    let s = fillABC(initHuronPageState('x'), -45, 0, 40);
    expect(s.result).not.toBeNull();
    expect(s.submitted).toBe(true);
    s = edit(s, 'C', 45);
    expect(s.result).toBeNull();
    expect(s.submitted).toBe(false);
    expect(s.values.C).toBe(45);
  });

  it('RING_CHANGE também invalida (resultado depende do offset)', () => {
    let s = fillABC(initHuronPageState('x'), -45, 0, 40);
    expect(s.result).not.toBeNull();
    s = ring(s, 'c', 90);
    expect(s.result).toBeNull();
    expect(s.submitted).toBe(false);
    expect(s.ring.c).toBe(90);
  });

  it('CLEAR zera campos/resultado e preserva o anel', () => {
    let s = ring(fillABC(initHuronPageState('x'), -45, 0, 40), 'c', 90);
    s = calc(s);
    expect(s.result).not.toBeNull();
    s = huronPageReducer(s, { type: 'CLEAR' });
    expect(s.result).toBeNull();
    expect(s.submitted).toBe(false);
    expect(s.values).toEqual({ A: 0, B: 0, C: 0 });
    expect(s.ring).toEqual({ b: 0, c: 90 });
  });

  it('CALCULAR com campo inválido não gera resultado', () => {
    const s = calc(edit(initHuronPageState('x'), 'C', 'abc'));
    expect(s.submitted).toBe(true);
    expect(s.result).toBeNull();
  });
});

describe('(b) resultado traz o A, B e C usados no cálculo', () => {
  it('buildHuronResult guarda input numérico junto', () => {
    const r = buildHuronResult({ A: -45, B: 0, C: 40 }, { b: 0, c: 0 });
    expect(r.input).toEqual({ A: -45, B: 0, C: 40 });
  });

  it('formatResultEcho gera a linha exibida sob o resultado', () => {
    expect(formatResultEcho({ A: -45, B: 0, C: 40 })).toBe('calculado para A=-45° B=0° C=40°');
    expect(formatResultEcho(null)).toBe('');
  });

  it('parseAngle aceita vírgula pt-BR e rejeita texto', () => {
    expect(parseAngle('40,5')).toBe(40.5);
    expect(parseAngle('40')).toBe(40);
    expect(parseAngle('')).toBeNull();
    expect(parseAngle('abc')).toBeNull();
  });
});

describe('(c) fluxo A=-45, B=0: C=40 → 285,5302; C=45 → 290,5302', () => {
  it('C=40: inferior 65,5302 e superior 285,5302', () => {
    const s = fillABC(initHuronPageState('x'), -45, 0, 40);
    expect(s.result.bFlange).toBeCloseTo(65.5302, 4);
    expect(s.result.cFlange).toBeCloseTo(285.5302, 4);
    expect(s.result.input).toEqual({ A: -45, B: 0, C: 40 });
  });

  it('trocar C para 45 invalida; recalcular mostra 290,5302', () => {
    let s = fillABC(initHuronPageState('x'), -45, 0, 40);
    s = edit(s, 'C', 45);
    expect(s.result).toBeNull();
    s = calc(s);
    expect(s.result.bFlange).toBeCloseTo(65.5302, 4);
    expect(s.result.cFlange).toBeCloseTo(290.5302, 4);
    expect(s.result.input).toEqual({ A: -45, B: 0, C: 45 });
  });
});

describe('init respeita offsets salvos válidos', () => {
  it('RING_OPTIONS continua 0/90/180/270 e init usa zeros sem storage', () => {
    expect(RING_OPTIONS).toEqual([0, 90, 180, 270]);
    expect(initHuronPageState('x').ring).toEqual({ b: 0, c: 0 });
  });
});

describe('(a) formatRingNote: vazio com 0, legenda caso contrário', () => {
  it('offset 0 (e ausente) não gera legenda — tela idêntica', () => {
    expect(formatRingNote(0)).toBe('');
    expect(formatRingNote(null)).toBe('');
    expect(formatRingNote(undefined)).toBe('');
  });

  it('offset ativo gera "calib. N°"', () => {
    expect(formatRingNote(180)).toBe('calib. 180°');
    expect(formatRingNote(90)).toBe('calib. 90°');
    expect(formatRingNote(270)).toBe('calib. 270°');
  });
});

describe('(b) resultado guarda os offsets usados no cálculo', () => {
  it('ringOffsets congelados junto com input', () => {
    const r = buildHuronResult({ A: -45, B: 0, C: 40 }, { b: 180, c: 0 });
    expect(r.ringOffsets).toEqual({ b: 180, c: 0 });
    expect(r.input).toEqual({ A: -45, B: 0, C: 40 });
    // valores já com offset: 65,5302+180 e 285,5302+0
    expect(r.bFlange).toBeCloseTo(245.5302, 4);
    expect(r.cFlange).toBeCloseTo(285.5302, 4);
  });

  it('formatCopyCalibLine vazia com zeros, linha curta com offset', () => {
    expect(formatCopyCalibLine({ b: 0, c: 0 })).toBe('');
    expect(formatCopyCalibLine(null)).toBe('');
    expect(formatCopyCalibLine({ b: 180, c: 0 })).toBe('calib. anel: inferior 180°, superior 0°');
  });
});

describe('(c) buildCopyText: igual com offsets 0, linha extra com offset', () => {
  const R0 = buildHuronResult({ A: -45, B: 0, C: 40 }, { b: 0, c: 0 });

  it('offsets 0: texto exatamente igual ao anterior', () => {
    expect(buildCopyText(R0, { ring: { b: 0, c: 0 }, ringActive: false })).toBe(
      [
        'CABECOTE HURON 45 - 3D ROT A=-45 B=0 C=40 (graus)',
        'Flange inferior (45°): 65.5302°',
        'Flange superior: 285.5302°',
      ].join('\n'),
    );
  });

  it('sem resultado: vazio', () => {
    expect(buildCopyText(null, { ring: { b: 0, c: 0 }, ringActive: false })).toBe('');
  });

  it('caso plano (b=0): linha de indefinida preservada', () => {
    const flat = {
      input: { A: 0, B: 0, C: 30 },
      raw: { bFlange: 0, cFlange: 0 },
      bFlange: 0,
      cFlange: 0,
      ringOffsets: { b: 0, c: 0 },
    };
    expect(buildCopyText(flat, { ring: { b: 0, c: 0 }, ringActive: false })).toBe(
      [
        'CABECOTE HURON 45 - 3D ROT A=0 B=0 C=30 (graus)',
        'Flange inferior (45°): 0.0000°',
        'Flange superior: indefinida (sem inclinacao)',
      ].join('\n'),
    );
  });

  it('offset ativo: mantém linha Anel e acrescenta a de calibração', () => {
    const r = buildHuronResult({ A: -45, B: 0, C: 40 }, { b: 180, c: 0 });
    expect(buildCopyText(r, { ring: { b: 180, c: 0 }, ringActive: true })).toBe(
      [
        'CABECOTE HURON 45 - 3D ROT A=-45 B=0 C=40 (graus)',
        'Flange inferior (45°): 245.5302°',
        'Flange superior: 285.5302°',
        'Anel: inferior +180°, superior 0°',
        'calib. anel: inferior 180°, superior 0°',
      ].join('\n'),
    );
  });
});

describe('(d) A=-45, B=0, C=40 com inferior em 180', () => {
  it('inferior 245,5302 com legenda; superior 285,5302 sem legenda', () => {
    let s = ring(initHuronPageState('x'), 'b', 180);
    s = calc(edit(edit(edit(s, 'A', -45), 'B', 0), 'C', 40));
    expect(s.result.bFlange).toBeCloseTo(245.5302, 4);
    expect(s.result.cFlange).toBeCloseTo(285.5302, 4);
    expect(formatRingNote(s.result.ringOffsets.b)).toBe('calib. 180°');
    expect(formatRingNote(s.result.ringOffsets.c)).toBe('');
  });
});
