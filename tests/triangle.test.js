import { describe, it, expect } from 'vitest';
import { solveTriangle } from '../src/features/trigonometria/solver/triangleSolver';

describe('regressão inventário — Triângulo (T13)', () => {
  it('catetos 3/4 → hipotenusa 5, ângulo 53,130102354°', () => {
    const r = solveTriangle({ a: 3, b: 4 });
    expect(r.error).toBeUndefined();
    expect(r.c).toBeCloseTo(5, 9);
    expect(r.A).toBeCloseTo(53.1301023542, 9);
    expect(r.B).toBeCloseTo(36.8698976458, 9);
  });

  it('a=3, A=36,87° → b=4, c=5', () => {
    const r = solveTriangle({ a: 3, A: 36.86989764584401 });
    expect(r.c).toBeCloseTo(5, 6);
    expect(r.b).toBeCloseTo(4, 6);
  });

  it('hipotenusa menor que cateto → erro', () => {
    expect(solveTriangle({ a: 10, c: 5 }).error).toBeTruthy();
  });
});