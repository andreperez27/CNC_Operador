import { describe, it, expect } from 'vitest';
import { solveChamfer } from '../src/core/machining/chamfer/index';
import { solveRadius } from '../src/core/machining/radius/index';
import { formatResultNumber, summarizeModel, originLabel } from '../src/features/gcoderapido/resultSummary';

/**
 * Linha de resumo da aba Dados + correção do NaN no "Incremento real".
 *
 * Causa raiz (2026-09-29): a página calculava o incremento como
 * `|passes[1].y − passes[0].y|`, mas os passes do core têm `x/z` — o campo
 * `y` não existe, então `undefined − undefined = NaN` sempre que havia mais
 * de 1 passe (com ou sem profundidade preenchida). O core já entrega o valor
 * canônico em `model.incReal` (= profZ / nPasses, o mesmo do Q4); a página
 * passa a usar a fonte única, com traço quando não houver valor.
 */

const CHAMFER_BASE = {
  type: 'external', width: 2, angle: 45,
  tool: { type: 'toroidal', diameter: 12, radius: 2 },
  strategy: { passDepth: 0.3 }, plane: 'XZ', origin: 'vertex',
  length: 100, feed: 600, rpm: 3000, safety: 10, toolNumber: 1, sobre: 0,
};

const RADIUS_BASE = {
  type: 'external', radius: 20,
  tool: { type: 'toroidal', diameter: 25, radius: 0.8 },
  strategy: { passDepth: 20 }, plane: 'XZ', origin: 'vertex',
  length: 100, feed: 600, rpm: 3000, safety: 10, toolNumber: 1, sobre: 0,
};

describe('item 5 — profundidade total vazia não gera NaN', () => {
  it('chanfro com depth undefined: modelo válido e incReal finito (= profZ/nPasses)', () => {
    const r = solveChamfer({ ...CHAMFER_BASE, depth: undefined });
    expect(r.valid).toBe(true);
    const m = r.model;
    expect(m.nPasses).toBeGreaterThan(1);
    expect(Number.isFinite(m.incReal)).toBe(true);
    expect(m.incReal).toBeCloseTo(m.profZ / m.nPasses, 12);
    // profZ deriva de largura + ângulo quando depth vem vazio.
    expect(m.profZ).toBeCloseTo(2 * Math.SQRT1_2, 9);
  });

  it('documenta a causa raiz: passes do core não têm campo y', () => {
    const m = solveChamfer({ ...CHAMFER_BASE, depth: undefined }).model;
    expect(m.passes[0].y).toBeUndefined();
    expect(m.passes[1].y).toBeUndefined();
  });

  it('resumo do chanfro com depth vazio traz passes, profZ e contato', () => {
    const m = solveChamfer({ ...CHAMFER_BASE, depth: undefined }).model;
    const s = summarizeModel(m);
    expect(s.passes).toBe(m.nPasses);
    expect(s.profZ).not.toBe('—');
    expect(s.contato).toMatch(/^\(.+,.+\)$/);
  });

  it('resumo do raio traz passes, profZ e contato', () => {
    const r = solveRadius(RADIUS_BASE);
    expect(r.valid).toBe(true);
    const s = summarizeModel(r.model);
    expect(s.passes).toBe(r.model.nPasses);
    expect(s.profZ).not.toBe('—');
    expect(s.contato).toMatch(/^\(.+,.+\)$/);
  });

  it('sem modelo: tudo traço (nunca "NaN")', () => {
    expect(summarizeModel(null)).toEqual({ passes: '—', profZ: '—', contato: '—' });
  });
});

describe('formatResultNumber — traço quando não houver valor', () => {
  it('NaN, Infinity e undefined viram traço', () => {
    expect(formatResultNumber(NaN)).toBe('—');
    expect(formatResultNumber(Infinity)).toBe('—');
    expect(formatResultNumber(undefined)).toBe('—');
  });

  it('valor normal formata pt-BR com as casas pedidas', () => {
    expect(formatResultNumber(0.282842712474619, 6)).toBe('0,283');
    expect(formatResultNumber(100, 3)).toBe('100');
  });
});

describe('originLabel — rodapé Plano/Origem', () => {
  it('externo e interno têm rótulo próprio; desconhecido cai no externo', () => {
    expect(originLabel('external')).toMatch(/Vértice/);
    expect(originLabel('internal')).toMatch(/bolsão/);
    expect(originLabel('x')).toBe(originLabel('external'));
  });
});
