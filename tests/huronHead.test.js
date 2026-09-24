import { describe, it, expect } from 'vitest';
import { calculateHuronFlanges } from '../src/core/machining/huronHead.js';

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
