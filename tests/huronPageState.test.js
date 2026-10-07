import { describe, it, expect } from 'vitest';
import {
  RING_OPTIONS,
  parseAngle,
  buildHuronResult,
  formatResultEcho,
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
