import { describe, it, expect } from 'vitest';
import { calculateHuronFlanges } from '../src/core/machining/huronHead.js';
import { validateHuronReachability, REACH_COS_TOL } from '../src/core/machining/huronReachability.js';
import { validateHuronInput } from '../src/core/machining/huronValidation.js';
import { ValidationError } from '../src/core/validation/validationEngine.js';

// 10 leituras reais coletadas na máquina (iTNC 530, cabeçote 45 Huron universal,
// programa READ_45HURON.MM lido via FN16-FPRINT). Ver docs/ para o levantamento.
const CASES = [
  { input: { A: 20, B: 0, C: 0 }, expected: { bFlange: 28.4317, cFlange: 79.8441 } },
  { input: { A: 0, B: 20, C: 0 }, expected: { bFlange: 28.4317, cFlange: 169.8441 } },
  { input: { A: 45, B: 0, C: 0 }, expected: { bFlange: 65.5302, cFlange: 65.5302 } },
  { input: { A: 90, B: 0, C: 0 }, expected: { bFlange: 180, cFlange: 0 } },
  { input: { A: 0, B: 0, C: 30 }, expected: { bFlange: 0, cFlange: 0 } },
  { input: { A: 20, B: 20, C: 0 }, expected: { bFlange: 40, cFlange: 118.7864 } },
  { input: { A: 15, B: 0, C: 15 }, expected: { bFlange: 21.2747, cFlange: 97.4349 } },
  { input: { A: 0, B: 15, C: 15 }, expected: { bFlange: 21.2747, cFlange: -172.5651 } },
  { input: { A: 10, B: 10, C: 10 }, expected: { bFlange: 20, cFlange: 137.4544 } },
  { input: { A: 30, B: 20, C: 10 }, expected: { bFlange: 51.1271, cFlange: 111.955 } },
];

describe('calculateHuronFlanges — paridade com leituras reais da máquina', () => {
  CASES.forEach(({ input, expected }, i) => {
    it(`caso ${i + 1}: A=${input.A} B=${input.B} C=${input.C}`, () => {
      const result = calculateHuronFlanges(input);
      expect(result.bFlange).toBeCloseTo(expected.bFlange, 2);
      expect(result.cFlange).toBeCloseTo(expected.cFlange, 2);
    });
  });
});

describe('validateHuronReachability — limites válidos', () => {
  const valid = [
    [{ A: 0, B: 0, C: 0 }, 0],
    [{ A: 90, B: 0, C: 0 }, 90],
    [{ A: -90, B: 0, C: 0 }, 90],
    [{ A: 0, B: 90, C: 0 }, 90],
    [{ A: 0, B: -90, C: 0 }, 90],
  ];
  for (const [input, tilt] of valid) {
    it(`A=${input.A} B=${input.B} aceito (tilt ${tilt}°)`, () => {
      const r = validateHuronReachability(input);
      expect(r.reachable).toBe(true);
      expect(r.reason).toBeNull();
      expect(r.tiltDeg).toBeCloseTo(tilt, 6);
    });
  }
});

describe('validateHuronReachability — limites inválidos', () => {
  const invalid = [
    { A: 90.01, B: 0, C: 0 },
    { A: -90.01, B: 0, C: 0 },
    { A: 0, B: 90.01, C: 0 },
    { A: 0, B: -90.01, C: 0 },
  ];
  for (const input of invalid) {
    it(`A=${input.A} B=${input.B} rejeitado`, () => {
      const r = validateHuronReachability(input);
      expect(r.reachable).toBe(false);
      expect(r.reason).toBe('TILT_EXCEEDS_90');
      expect(r.message).toContain('não alcançável');
    });
  }
});

describe('validateHuronReachability — caso real do bug (A=-91°)', () => {
  it('não entrega (180°, −180°) como solução válida', () => {
    const r = validateHuronReachability({ A: -91, B: 0, C: 0 });
    expect(r.reachable).toBe(false);
    expect(r.reason).toBe('TILT_EXCEEDS_90');
    expect(r.tiltDeg).toBeCloseTo(91, 6);
    // E a regra NÃO é caixa em |A|<=90: (100,100) tem tilt 88,27° e é válida.
    const equiv = validateHuronReachability({ A: 100, B: 100, C: 0 });
    expect(equiv.reachable).toBe(true);
    expect(equiv.tiltDeg).toBeCloseTo(88.2720589276495, 6);
  });
});

describe('validateHuronReachability — perto do limite', () => {
  it('89,999° aceito; 90,001° rejeitado', () => {
    expect(validateHuronReachability({ A: 89.999, B: 0, C: 0 }).reachable).toBe(true);
    expect(validateHuronReachability({ A: -89.999, B: 0, C: 0 }).reachable).toBe(true);
    expect(validateHuronReachability({ A: 90.001, B: 0, C: 0 }).reachable).toBe(false);
    expect(validateHuronReachability({ A: -90.001, B: 0, C: 0 }).reachable).toBe(false);
  });
});

describe('validateHuronReachability — soluções equivalentes', () => {
  it('(100,100,0) fora da caixa mas alcançável, igual a (80,-80,0) dentro da caixa', () => {
    const t1 = { A: 100, B: 100, C: 0 };
    const t2 = { A: 80, B: -80, C: 0 };
    expect(Math.abs(t1.A)).toBeGreaterThan(90);
    expect(validateHuronReachability(t1).reachable).toBe(true);
    expect(validateHuronReachability(t2).reachable).toBe(true);
    // Mesma direção (a menos de 1e-12) → mesmos flanges: orientação preservada.
    const f1 = calculateHuronFlanges(t1);
    const f2 = calculateHuronFlanges(t2);
    expect(f1.bFlange).toBeCloseTo(160, 9);
    expect(f1.bFlange).toBeCloseTo(f2.bFlange, 9);
    expect(f1.cFlange).toBeCloseTo(f2.cFlange, 9);
  });

  it('volta completa (C+360°) é a mesma orientação', () => {
    const a = calculateHuronFlanges({ A: 10, B: 20, C: 10 });
    const b = calculateHuronFlanges({ A: 10, B: 20, C: 370 });
    expect(a.bFlange).toBeCloseTo(b.bFlange, 9);
    expect(a.cFlange).toBeCloseTo(b.cFlange, 9);
  });
});

describe('validateHuronReachability — tolerância numérica', () => {
  it('ruído float na fronteira não vira falso inválido nem falso válido', () => {
    // cos(90,00000001°) ≈ −1,7e-10 está dentro da tolerância: fronteira válida.
    expect(validateHuronReachability({ A: 90.00000001, B: 0, C: 0 }).reachable).toBe(true);
    // cos(90,0000001°) ≈ −1,7e-9 já é violação real: inválido.
    expect(validateHuronReachability({ A: 90.0000001, B: 0, C: 0 }).reachable).toBe(false);
    expect(REACH_COS_TOL).toBe(1e-9);
  });

  it('entradas não numéricas são inválidas (INVALID_INPUT)', () => {
    for (const bad of [{ A: NaN, B: 0, C: 0 }, { A: 0, B: Infinity, C: 0 }, { A: 'x', B: 0, C: 0 }]) {
      const r = validateHuronReachability(bad);
      expect(r.reachable).toBe(false);
      expect(r.reason).toBe('INVALID_INPUT');
      expect(r.tiltDeg).toBeNull();
    }
  });
});

describe('validateHuronReachability — normalização em varredura', () => {
  it('todo alcançável tem flanges finitos com |c|<=180 e b em [0,180]', () => {
    for (let A = -100; A <= 100; A += 5) {
      for (let B = -100; B <= 100; B += 5) {
        for (const C of [0, 45]) {
          const r = validateHuronReachability({ A, B, C });
          if (!r.reachable) continue;
          const f = calculateHuronFlanges({ A, B, C });
          expect(Number.isFinite(f.bFlange)).toBe(true);
          expect(Number.isFinite(f.cFlange)).toBe(true);
          expect(f.bFlange).toBeGreaterThanOrEqual(0);
          expect(f.bFlange).toBeLessThanOrEqual(180);
          expect(Math.abs(f.cFlange)).toBeLessThanOrEqual(180);
        }
      }
    }
  });
});

describe('calculateHuronFlanges — contrato endurecido (FASE 4)', () => {
  function throwsCode(input, code) {
    try {
      calculateHuronFlanges(input);
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect(e.code).toBe(code);
      return;
    }
    throw new Error('era esperado ValidationError ' + code);
  }

  it('caso válido conhecido não lança', () => {
    expect(calculateHuronFlanges({ A: 20, B: 0, C: 0 })).toEqual({
      bFlange: expect.any(Number),
      cFlange: expect.any(Number),
    });
  });

  it('fronteira exata 90° não lança', () => {
    expect(() => calculateHuronFlanges({ A: 90, B: 0, C: 0 })).not.toThrow();
  });

  it('imediatamente abaixo (89,999°) não lança', () => {
    expect(() => calculateHuronFlanges({ A: 89.999, B: 0, C: 0 })).not.toThrow();
  });

  it('imediatamente acima (90,001°) lança TILT_EXCEEDS_90', () => {
    throwsCode({ A: 90.001, B: 0, C: 0 }, 'TILT_EXCEEDS_90');
  });

  it('caso real A=-91° lança em vez de fabricar (180,-180)', () => {
    throwsCode({ A: -91, B: 0, C: 0 }, 'TILT_EXCEEDS_90');
  });

  it('nenhuma orientação inalcançável retorna silenciosamente', () => {
    for (const input of [
      { A: -91, B: 0, C: 0 },
      { A: 0, B: -100, C: 0 },
      { A: 120, B: 0, C: 0 },
      { A: 45, B: 100, C: 0 },
    ]) {
      throwsCode(input, 'TILT_EXCEEDS_90');
    }
  });

  it('entradas inválidas lançam INVALID_INPUT (nunca NaN silencioso)', () => {
    throwsCode({ A: NaN, B: 0, C: 0 }, 'INVALID_INPUT');
    throwsCode({ A: 0, B: Infinity, C: 0 }, 'INVALID_INPUT');
  });

  it('válidos anteriores permanecem bit-idênticos (inclui fora-da-caixa)', () => {
    const f = calculateHuronFlanges({ A: 100, B: 100, C: 0 });
    expect(f.bFlange).toBeCloseTo(160, 9);
    expect(f.cFlange).toBeCloseTo(4.15086604893304, 9);
  });
});

describe('huronValidation — adapter canônico validateHuronInput', () => {
  it('aceita entrada válida: valid, sem erros e sem warnings', () => {
    const r = validateHuronInput({ A: 30, B: 45, C: 60 });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.warnings).toEqual([]);
  });

  it('rejeita entrada não-objeto como INVALID_INPUT', () => {
    for (const bad of [null, undefined, 'x', 42, [1, 2, 3]]) {
      const r = validateHuronInput(bad);
      expect(r.valid).toBe(false);
      expect(r.errors).toHaveLength(1);
      expect(r.errors[0].code).toBe('INVALID_INPUT');
    }
  });

  it('sinaliza cada eixo não-numérico no campo correspondente', () => {
    expect(validateHuronInput({ A: NaN, B: 0, C: 0 }).errors.map((e) => e.field)).toEqual(['A']);
    expect(validateHuronInput({ A: 0, B: NaN, C: 0 }).errors.map((e) => e.field)).toEqual(['B']);
    expect(validateHuronInput({ A: 0, B: 0, C: NaN }).errors.map((e) => e.field)).toEqual(['C']);
    expect(validateHuronInput({ A: NaN, B: 0, C: 0 }).errors[0].code).toBe('INVALID_ANGLE');
  });

  it('aceita tripleto finito alcançável (20, 0, 0)', () => {
    const r = validateHuronInput({ A: 20, B: 0, C: 0 });
    expect(r.valid).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it('aceita inclinação exatamente no limite de 90°', () => {
    expect(validateHuronInput({ A: 90, B: 0, C: 0 }).valid).toBe(true);
  });

  it('aceita inclinação abaixo de 90°', () => {
    expect(validateHuronInput({ A: 89.999, B: 0, C: 0 }).valid).toBe(true);
  });

  it('rejeita inclinação acima de 90° com TILT_EXCEEDS_90 no campo orientacao', () => {
    const r = validateHuronInput({ A: 90.001, B: 0, C: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].code).toBe('TILT_EXCEEDS_90');
    expect(r.errors[0].field).toBe('orientacao');
  });

  it('rejeita inclinação real −91° (não apenas artefato de wrap)', () => {
    const r = validateHuronInput({ A: -91, B: 0, C: 0 });
    expect(r.valid).toBe(false);
    expect(r.errors[0].code).toBe('TILT_EXCEEDS_90');
    expect(r.errors[0].field).toBe('orientacao');
  });

  it('nunca autoriza cálculo quando inválido e nunca lança', () => {
    const invalids = [
      null,
      { A: NaN, B: 0, C: 0 },
      { A: 0, B: NaN, C: 0 },
      { A: 0, B: 0, C: NaN },
      { A: 90.001, B: 0, C: 0 },
      { A: -91, B: 0, C: 0 },
    ];
    for (const input of invalids) {
      let r;
      expect(() => { r = validateHuronInput(input); }).not.toThrow();
      expect(r.valid).toBe(false);
    }
  });

  it('retorna warnings como array vazio em todos os casos', () => {
    expect(validateHuronInput({ A: 0, B: 0, C: 0 }).warnings).toEqual([]);
    expect(validateHuronInput(null).warnings).toEqual([]);
    expect(validateHuronInput({ A: 120, B: 0, C: 0 }).warnings).toEqual([]);
  });

  it('expõe mensagens em pt-BR compatíveis com a UI', () => {
    expect(validateHuronInput({ A: NaN, B: 0, C: 0 }).errors[0].message)
      .toBe('Informe um número válido em graus.');
    expect(validateHuronInput({ A: 120, B: 0, C: 0 }).errors[0].message)
      .toBe('Orientação não alcançável nesta configuração do cabeçote.');
  });

  it('delega ao validador: valid === reachable numa grade de orientações', () => {
    const angles = [-180, -91, -90, -45, 0, 45, 89.999, 90, 90.001, 120, 180];
    for (const A of angles) {
      for (const B of [0, 45, 100]) {
        const input = { A, B, C: 0 };
        const adapter = validateHuronInput(input);
        const gate = validateHuronReachability(input);
        expect(adapter.valid).toBe(gate.reachable);
      }
    }
    // Caso fora da caixa teórica mas geometricamente alcançável: o adapter
    // delega (válido) e o solver continua podendo lançar NO_SOLUTION.
    expect(validateHuronInput({ A: 100, B: 100, C: 0 }).valid).toBe(true);
  });
});
