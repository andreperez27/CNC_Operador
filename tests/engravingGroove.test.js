import { describe, it, expect } from 'vitest';
import {
  grooveWidth,
  tangentHeight,
  resolveGrooveWidth,
  effectiveMargin,
  describeTool,
} from '../src/core/engraving/groove';

/**
 * Parte 2 — largura do risco por tipo de ferramenta (valores da spec).
 */

describe('grooveWidth — topo reto', () => {
  it('D0,5 = 0,5 em qualquer profundidade', () => {
    expect(grooveWidth({ type: 'flat', diameter: 0.5 }, 0.1)).toBe(0.5);
    expect(grooveWidth({ type: 'flat', diameter: 0.5 }, 5)).toBe(0.5);
  });
});

describe('grooveWidth — esférica', () => {
  it('D1 a 0,2 = 0,8; maior ou igual a D/2 = D', () => {
    expect(grooveWidth({ type: 'ball', diameter: 1 }, 0.2)).toBeCloseTo(0.8, 12);
    expect(grooveWidth({ type: 'ball', diameter: 1 }, 0.5)).toBe(1);
    expect(grooveWidth({ type: 'ball', diameter: 1 }, 0.7)).toBe(1);
  });
});

describe('grooveWidth — V', () => {
  it('60 graus com raio 0,5: 0,2 → 0,8; 0,25 (tangência) → 0,8660; 0,3 → 0,9238', () => {
    const t = { type: 'vee', angle: 60, radius: 0.5 };
    expect(tangentHeight(60, 0.5)).toBeCloseTo(0.25, 12);
    expect(grooveWidth(t, 0.2)).toBeCloseTo(0.8, 12);
    expect(grooveWidth(t, 0.25)).toBeCloseTo(0.8660254, 7);
    expect(grooveWidth(t, 0.3)).toBeCloseTo(0.9238, 4);
  });

  it('ponta plana (padrão): 60°/0,1 a 0,2 → 0,3309 e a 0,3 → 0,4464', () => {
    expect(grooveWidth({ type: 'vee', angle: 60, tipDiameter: 0.1 }, 0.2)).toBeCloseTo(0.3309, 4);
    expect(grooveWidth({ type: 'vee', angle: 60, tipDiameter: 0.1 }, 0.3)).toBeCloseTo(0.4464, 4);
  });

  it('ponta plana: 10°/0,1 a 0,2 → 0,1350; 90°/0,1 a 0,5 → 1,1; ponta 0 = ideal', () => {
    expect(grooveWidth({ type: 'vee', angle: 10, tipDiameter: 0.1 }, 0.2)).toBeCloseTo(0.135, 4);
    expect(grooveWidth({ type: 'vee', angle: 90, tipDiameter: 0.1 }, 0.5)).toBeCloseTo(1.1, 12);
    expect(grooveWidth({ type: 'vee', angle: 60, tipDiameter: 0 }, 0.3)).toBeCloseTo(0.3464, 4);
  });

  it('só ângulo vira plana com ponta padrão 0,1', () => {
    expect(grooveWidth({ type: 'vee', angle: 60 }, 0.2)).toBeCloseTo(0.3309, 4);
  });

  it('limite pela haste (padrão 3,175); explícito respeitado', () => {
    expect(grooveWidth({ type: 'vee', angle: 60, tipDiameter: 0.1 }, 10)).toBe(3.175);
    expect(grooveWidth({ type: 'vee', angle: 60, tipDiameter: 0.1, maxDiameter: 0.2 }, 10)).toBe(0.2);
    expect(grooveWidth({ type: 'vee', angle: 60, tipDiameter: 0.1, shank: 5 }, 10)).toBe(5);
  });

  it('ponta plana inválida explica o motivo', () => {
    expect(() => grooveWidth({ type: 'vee', angle: 60, tipDiameter: -0.1 }, 0.2)).toThrowError(/negativo/);
    expect(() => grooveWidth({ type: 'vee', angle: 0, tipDiameter: 0.1 }, 0.2)).toThrowError(/entre 0 e 180/);
    expect(() => grooveWidth({ type: 'vee', angle: 60, tipDiameter: 0.1, radius: 0.5 }, 0.2))
      .toThrowError(/um jeito só/);
  });

  it('r = 0 vira o V ideal', () => {
    expect(tangentHeight(60, 0)).toBeNull();
    expect(grooveWidth({ type: 'vee', angle: 60, radius: 0 }, 0.3)).toBeCloseTo(0.3464, 4);
    expect(grooveWidth({ type: 'vee', angle: 90, radius: 0 }, 0.5)).toBeCloseTo(1, 12);
  });

  it('continuidade na altura de tangência e largura não decrescente', () => {
    for (const tool of [
      { type: 'vee', angle: 60, radius: 0.5 },
      { type: 'vee', angle: 90, radius: 1 },
      { type: 'vee', angle: 30, radius: 0.2 },
      { type: 'ball', diameter: 1 },
    ]) {
      const ht = tool.type === 'vee' ? tangentHeight(tool.angle, tool.radius) : tool.diameter / 2;
      const below = grooveWidth(tool, ht - 1e-7);
      const above = grooveWidth(tool, ht + 1e-7);
      expect(Math.abs(below - above)).toBeLessThan(1e-6);
      let prev = 0;
      for (let p = 0.01; p <= 2.0001; p += 0.05) {
        const w = grooveWidth(tool, p);
        expect(w).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = w;
      }
    }
  });

  it('outros ângulos e raios', () => {
    expect(grooveWidth({ type: 'vee', angle: 90, radius: 1 }, 0.5)).toBeCloseTo(1.8284, 4);
    expect(grooveWidth({ type: 'vee', angle: 30, radius: 0 }, 1)).toBeCloseTo(0.5359, 4);
  });

  it('parâmetros inválidos explicam o motivo', () => {
    expect(() => grooveWidth({ type: 'vee', angle: 0, radius: 0.5 }, 0.2)).toThrowError(/entre 0 e 180/);
    expect(() => grooveWidth({ type: 'vee', angle: 180, radius: 0.5 }, 0.2)).toThrowError(/entre 0 e 180/);
    expect(() => grooveWidth({ type: 'vee', angle: 60, radius: -1 }, 0.2)).toThrowError(/negativo/);
    expect(() => grooveWidth({ type: 'flat', diameter: 0 }, 0.2)).toThrowError(/maior que zero/);
    expect(() => grooveWidth({ type: 'x' }, 0.2)).toThrowError(/flat.*ball.*vee/);
    expect(() => grooveWidth({ type: 'flat', diameter: 1, maxDiameter: 0 }, 0.2)).toThrowError(/maior que zero/);
  });

  it('profundidade zero ou negativa devolve null (aviso na tela)', () => {
    expect(grooveWidth({ type: 'flat', diameter: 0.5 }, 0)).toBeNull();
    expect(grooveWidth({ type: 'flat', diameter: 0.5 }, -1)).toBeNull();
    expect(grooveWidth({ type: 'flat', diameter: 0.5 }, NaN)).toBeNull();
  });

  it('diâmetro máximo limita', () => {
    expect(grooveWidth({ type: 'flat', diameter: 2, maxDiameter: 1.5 }, 1)).toBe(1.5);
    expect(grooveWidth({ type: 'ball', diameter: 1, maxDiameter: 0.5 }, 0.2)).toBe(0.5);
  });
});

describe('resolveGrooveWidth / effectiveMargin / describeTool', () => {
  it('medida substitui a calculada; inválida explica', () => {
    expect(resolveGrooveWidth(0.9, 0.8)).toBe(0.9);
    expect(resolveGrooveWidth('', 0.8)).toBe(0.8);
    expect(resolveGrooveWidth(undefined, 0.8)).toBe(0.8);
    expect(() => resolveGrooveWidth('x', 0.8)).toThrowError(/maior que zero/);
    expect(() => resolveGrooveWidth(0, 0.8)).toThrowError(/maior que zero/);
  });

  it('margem efetiva é o maior entre margem e metade do risco', () => {
    expect(effectiveMargin(2, 5)).toBe(2.5);
    expect(effectiveMargin(2, null)).toBe(2);
    expect(effectiveMargin(2, 3)).toBe(2);
  });

  it('descrição para o cabeçalho', () => {
    expect(describeTool({ type: 'flat', diameter: 0.5 })).toBe('topo reto D 0,5 mm');
    expect(describeTool({ type: 'ball', diameter: 1 })).toBe('esférica D 1 mm');
    expect(describeTool({ type: 'vee', angle: 60, radius: 0.5 })).toBe('V 60° r 0,5 mm');
    expect(describeTool({ type: 'vee', angle: 60, tipDiameter: 0.1 })).toBe('V 60° ponta 0,1 mm');
    expect(describeTool({ type: 'vee', angle: 60 })).toBe('V 60° ponta 0,1 mm');
  });
});
