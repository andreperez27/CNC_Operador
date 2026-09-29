import { describe, it, expect } from 'vitest';
import { solveChamfer, buildChamferProgram } from '../src/core/machining/chamfer/index';

/**
 * Regressão: `normalizeChamferInput` atribuía a LARGURA ao ângulo A
 * (`A: input.width`), de modo que o programa .H rotulava Q1 com a
 * largura em vez do ângulo. A geometria sempre usou o ângulo real
 * (`chamferGeometry` recebe `input.angle`), por isso os testes de
 * paridade nunca acusaram — só o rótulo Q1 saía errado.
 */

function baseInput(overrides) {
  return {
    type: 'external',
    width: 5,
    angle: 45,
    tool: { type: 'toroidal', diameter: 16, radius: 0.8 },
    strategy: { passDepth: 0.3 },
    plane: 'XZ',
    origin: 'vertex',
    length: 100,
    feed: 600,
    rpm: 3000,
    ...overrides,
  };
}

describe('rotulagem do programa de chanfro (A = angulo, nao largura)', () => {
  it('externo: Q1 leva o angulo (45) e Q2 leva a largura (5)', () => {
    const result = solveChamfer(baseInput());
    expect(result.valid).toBe(true);
    const prog = buildChamferProgram(result.model);
    expect(prog).toContain('FN 0: Q1 =+45 ;ANGULO DO CHANFRO');
    expect(prog).toContain('FN 0: Q2 =+5 ;LARGURA DO CHANFRO');
  });

  it('interno: $1 leva o angulo (45) e $2 leva a largura (5)', () => {
    const result = solveChamfer(baseInput({
      type: 'internal',
      origin: 'corner',
      clearance: { pocketWidth: 50 },
    }));
    expect(result.valid).toBe(true);
    const prog = buildChamferProgram(result.model);
    expect(prog).toContain('Q1  = +45,0');
    expect(prog).toContain('Angulo do chanfro');
    expect(prog).toContain('Q2  = +5,000');
    expect(prog).toContain('Largura do chanfro');
  });
});
