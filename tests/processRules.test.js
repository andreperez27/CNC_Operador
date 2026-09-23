import { describe, it, expect } from 'vitest';
import {
  calculateBlindHoleDepth,
  listBlindHoleRules,
  formatBlindHoleFormula,
  resolveRuleObject,
  BLIND_HOLE_REFERENCES,
  CUSTOM_RULE_ID,
  BLIND_HOLE_DEFAULT_RULES,
} from '../src/core/process/rules/blindHoleDepth';
import { resolveHoleFromInput, DEFAULT_HOLE_MARGIN } from '../src/core/machining/thread/holeDepth';
import { solveThread } from '../src/core/machining/thread/solver';
import { validateThreadInput } from '../src/core/machining/thread/validation';
import { buildThreadProgram } from '../src/core/machining/thread/template';

const M10 = { nominal: 10, hole: 8.5 }; // M10 × 1,5

describe('regras de processo — banco (não são norma ISO/ABNT)', () => {
  it('regras cadastradas com metadados de processo', () => {
    const rules = listBlindHoleRules();
    expect(rules.map((r) => r.id)).toEqual([
      'process:2.5x-thread-diameter',
      'process:4x-drill-diameter',
      'process:5x-thread-diameter',
    ]);
    for (const r of rules) {
      expect(r.type).toBe('process-rule');
      expect(r.origem).toBe('informada pelo usuario');
      expect(r.normative).toBe(false);
      expect(r.factor).toBeGreaterThan(0);
    }
  });

  it('formata a fórmula com a referência exibida', () => {
    expect(formatBlindHoleFormula(2.5, BLIND_HOLE_REFERENCES.THREAD_DIAMETER)).toBe('2,5 × Ø da rosca');
    expect(formatBlindHoleFormula(4, BLIND_HOLE_REFERENCES.DRILL_DIAMETER)).toBe('4 × Ø da broca');
    expect(formatBlindHoleFormula(5, BLIND_HOLE_REFERENCES.THREAD_DIAMETER)).toBe('5 × Ø da rosca');
  });

  it('resolveRuleObject aceita id e objeto inline, rejeita id inexistente', () => {
    expect(resolveRuleObject('process:5x-thread-diameter').factor).toBe(5);
    expect(resolveRuleObject({ reference: 'threadDiameter', factor: 3 }).factor).toBe(3);
    expect(resolveRuleObject('process:nenhuma')).toBeNull();
    expect(resolveRuleObject(null)).toBeNull();
  });
});

describe('calculateBlindHoleDepth — fórmula genérica (fator × referência)', () => {
  it('2,5 × Ø da rosca → M10=25, M12=30, M20=50', () => {
    expect(calculateBlindHoleDepth({ rule: 'process:2.5x-thread-diameter', threadDiameter: 10, drillDiameter: 8.5 }).depth).toBe(25);
    expect(calculateBlindHoleDepth({ rule: 'process:2.5x-thread-diameter', threadDiameter: 12, drillDiameter: 10.2 }).depth).toBe(30);
    expect(calculateBlindHoleDepth({ rule: 'process:2.5x-thread-diameter', threadDiameter: 20, drillDiameter: 17.5 }).depth).toBe(50);
  });

  it('4 × Ø da broca → M10×1,5 (broca 8,5) = 34', () => {
    const r = calculateBlindHoleDepth({ rule: 'process:4x-drill-diameter', threadDiameter: 10, drillDiameter: 8.5 });
    expect(r.depth).toBe(34);
    expect(r.reference).toBe(BLIND_HOLE_REFERENCES.DRILL_DIAMETER);
  });

  it('5 × Ø da rosca → M10 = 50', () => {
    const r = calculateBlindHoleDepth({ rule: 'process:5x-thread-diameter', threadDiameter: 10, drillDiameter: 8.5 });
    expect(r.depth).toBe(50);
    expect(r.reference).toBe(BLIND_HOLE_REFERENCES.THREAD_DIAMETER);
  });

  it('regra personalizada inline (3 × Ø da rosca → 30)', () => {
    const r = calculateBlindHoleDepth({ rule: { reference: 'threadDiameter', factor: 3 }, threadDiameter: 10, drillDiameter: 8.5 });
    expect(r.valid).toBe(true);
    expect(r.depth).toBe(30);
  });

  it('mantém precisão interna (sem arredondamento prematuro)', () => {
    const r = calculateBlindHoleDepth({ rule: { reference: 'threadDiameter', factor: 3.1416 }, threadDiameter: 10, drillDiameter: 8.5 });
    expect(r.depth).toBe(31.416);
  });

  it('códigos de erro estáveis para referência/fator', () => {
    expect(calculateBlindHoleDepth({ rule: { reference: 'x', factor: 3 }, threadDiameter: 10, drillDiameter: 8.5 }).code).toBe('INVALID_REFERENCE');
    expect(calculateBlindHoleDepth({ rule: { reference: 'threadDiameter', factor: 0 }, threadDiameter: 10, drillDiameter: 8.5 }).code).toBe('INVALID_FACTOR');
    expect(calculateBlindHoleDepth({ rule: 'process:zzz', threadDiameter: 10, drillDiameter: 8.5 }).code).toBe('INVALID_RULE');
  });
});

describe('calculateBlindHoleDepth — consistência (nunca NaN/Infinity)', () => {
  const BAD = [0, -1, NaN, Infinity, -Infinity];

  it('diâmetro da rosca zero/negativo/NaN/Infinity → depth null', () => {
    for (const d of BAD) {
      const r = calculateBlindHoleDepth({ rule: 'process:2.5x-thread-diameter', threadDiameter: d, drillDiameter: 8.5 });
      expect(r.valid).toBe(false);
      expect(r.depth).toBeNull();
      expect(r.code).toBe('INVALID_DIAMETER');
    }
  });

  it('broca zero/negativo/NaN/Infinity → depth null', () => {
    for (const d of BAD) {
      const r = calculateBlindHoleDepth({ rule: 'process:4x-drill-diameter', threadDiameter: 10, drillDiameter: d });
      expect(r.valid).toBe(false);
      expect(r.depth).toBeNull();
    }
  });

  it('fator zero/negativo/NaN/Infinity → depth null', () => {
    for (const f of BAD) {
      const r = calculateBlindHoleDepth({ rule: { reference: 'threadDiameter', factor: f }, threadDiameter: 10, drillDiameter: 8.5 });
      expect(r.valid).toBe(false);
      expect(r.depth).toBeNull();
      expect(r.code).toBe('INVALID_FACTOR');
    }
  });

  it('regra inexistente/vazia → depth null', () => {
    expect(calculateBlindHoleDepth({ rule: 'process:nao-existe', threadDiameter: 10, drillDiameter: 8.5 }).valid).toBe(false);
    expect(calculateBlindHoleDepth({ rule: null, threadDiameter: 10, drillDiameter: 8.5 }).valid).toBe(false);
    expect(calculateBlindHoleDepth({ rule: undefined, threadDiameter: 10, drillDiameter: 8.5 }).valid).toBe(false);
  });
});

describe('resolveHoleFromInput — prof. da rosca × prof. do furo (independentes)', () => {
  it('mínimo = prof. da rosca + margem', () => {
    const r = resolveHoleFromInput({ depth: 20, holeMargin: 5, holeRule: 'process:2.5x-thread-diameter', holeDepth: 25 }, M10);
    expect(r.minimum).toBe(25);
    expect(r.suggested).toBe(25);
  });

  it('regra 5 × Ø da rosca sugere 50 (regra > mínimo 25)', () => {
    const r = resolveHoleFromInput({ depth: 20, holeMargin: 5, holeRule: 'process:5x-thread-diameter', holeDepth: 50 }, M10);
    expect(r.suggested).toBe(50);
    expect(r.formula).toBe('5 × Ø da rosca');
  });

  it('4 × Ø da broca sugere 34 (broca 8,5)', () => {
    const r = resolveHoleFromInput({ depth: 20, holeMargin: 5, holeRule: 'process:4x-drill-diameter', holeDepth: 34 }, M10);
    expect(r.suggested).toBe(34);
  });

  it('valor do desenho tem PRIORIDADE sobre a regra (sugestão não substitui)', () => {
    const r = resolveHoleFromInput({ depth: 20, holeMargin: 5, holeRule: 'process:5x-thread-diameter', holeDepth: 30 }, M10);
    expect(r.suggested).toBe(50); // sugestão da regra
    expect(r.final).toBe(30); // mas o desenho manda
    expect(r.valid).toBe(true);
  });

  it('sem regra explícita usa a default (2,5 × Ø da rosca)', () => {
    const r = resolveHoleFromInput({ depth: 20, holeMargin: 5 }, M10);
    expect(r.suggested).toBe(25);
    expect(r.ruleProvided).toBe(false);
  });

  it('regra personalizada (6 × Ø da rosca → 60)', () => {
    const r = resolveHoleFromInput({ depth: 20, holeMargin: 5, holeRule: CUSTOM_RULE_ID, customFactor: 6, customReference: 'threadDiameter', holeDepth: 60 }, M10);
    expect(r.suggested).toBe(60);
    expect(r.valid).toBe(true);
  });

  it('furo cego: furo menor que a rosca → inválido', () => {
    const r = resolveHoleFromInput({ depth: 20, holeMargin: 5, holeRule: 'process:5x-thread-diameter', holeDepth: 15 }, M10);
    expect(r.valid).toBe(false);
    expect(r.code).toBe('INVALID_HOLE_DEPTH');
    expect(r.error).toMatch(/menor que a profundidade da rosca/);
  });

  it('margem negativa → inválido', () => {
    const r = resolveHoleFromInput({ depth: 20, holeMargin: -1, holeDepth: 25 }, M10);
    expect(r.valid).toBe(false);
    expect(r.code).toBe('INVALID_HOLE_MARGIN');
  });
});

describe('integração com o solver de rosca', () => {
  const BASE = {
    threadId: 'metric:M10X1.5',
    toolNumber: 1,
    rpm: 500,
    depth: 20,
    safety: 5,
    zStart: 0,
    holeRule: 'process:2.5x-thread-diameter',
    holeMargin: 5,
  };

  it('modelo expõe profundidade da rosca e do furo separadas', () => {
    const r = solveThread({ ...BASE, holeDepth: 25 });
    expect(r.valid).toBe(true);
    expect(r.model.threadDepth).toBe(20);
    expect(r.model.depth).toBe(20);
    expect(r.model.holeDepth).toBe(25);
    expect(r.model.holeSuggested).toBe(25);
    expect(r.model.holeRule).toMatchObject({ id: 'process:2.5x-thread-diameter', reference: 'threadDiameter' });
  });

  it('5 × Ø da rosca → furo sugerido 50 no modelo', () => {
    const r = solveThread({ ...BASE, holeRule: 'process:5x-thread-diameter', holeDepth: 50 });
    expect(r.model.holeDepth).toBe(50);
    expect(r.model.holeRule.formula).toBe('5 × Ø da rosca');
  });

  it('regra personalizada via solver (4 × Ø da broca → 34)', () => {
    const r = solveThread({ ...BASE, holeRule: CUSTOM_RULE_ID, customFactor: 4, customReference: 'drillDiameter', holeDepth: 34 });
    expect(r.valid).toBe(true);
    expect(r.model.holeDepth).toBe(34);
    expect(r.model.holeRule.formula).toBe('4 × Ø da broca');
  });

  it('furo < rosca: NÃO gera programa', () => {
    const r = solveThread({ ...BASE, holeDepth: 15 });
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
    expect(r.validation.errors.some((e) => e.code === 'INVALID_HOLE_DEPTH')).toBe(true);
    expect(r.validation.errors.some((e) => e.message.includes('Profundidade do furo e menor que a profundidade da rosca'))).toBe(true);
  });

  it('regra inexistente → INVALID_HOLE_RULE', () => {
    const r = validateThreadInput({ ...BASE, holeRule: 'process:nao-existe', holeDepth: 25 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === 'INVALID_HOLE_RULE')).toBe(true);
  });

  it('margem negativa → INVALID_HOLE_MARGIN', () => {
    const r = validateThreadInput({ ...BASE, holeMargin: -1, holeDepth: 25 });
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.code === 'INVALID_HOLE_MARGIN')).toBe(true);
  });

  it('personalizada com fator zero → INVALID_HOLE_CUSTOM_FACTOR', () => {
    const r = validateThreadInput({ ...BASE, holeRule: CUSTOM_RULE_ID, customFactor: 0, customReference: 'threadDiameter', holeDepth: 25 });
    expect(r.errors.some((e) => e.code === 'INVALID_HOLE_CUSTOM_FACTOR')).toBe(true);
  });

  it('personalizada com referência inválida → INVALID_HOLE_CUSTOM_REFERENCE', () => {
    const r = validateThreadInput({ ...BASE, holeRule: CUSTOM_RULE_ID, customFactor: 3, customReference: 'raio', holeDepth: 25 });
    expect(r.errors.some((e) => e.code === 'INVALID_HOLE_CUSTOM_REFERENCE')).toBe(true);
  });

  it('programa .H documenta o furo cego e a regra usada (fluido pelo modelo)', () => {
    const r = solveThread({ ...BASE, holeRule: 'process:5x-thread-diameter', holeDepth: 50 });
    const program = buildThreadProgram(r.model, { programName: 'ROSCA_FURO' });
    expect(program).toContain('Furo cego: prof. 50 mm');
    expect(program).toContain('regra de processo 5 × Ø da rosca');
    expect(program).toContain('margem 5 mm');
  });

  it('regra default da página (2,5 × r.) mantém o padrão em solvers legados', () => {
    const r = solveThread({ threadId: 'metric:M10X1.5', toolNumber: 1, rpm: 500, depth: 20 });
    expect(r.valid).toBe(true);
    expect(r.model.holeDepth).toBe(25);
    expect(r.model.depth).toBe(20); // a rosca NÃO é alterada pela regra
  });
});

describe('casos de borda documentados (margem padrão e prioridade global)', () => {
  it('DEFAULT_HOLE_MARGIN é configurável e não é "norma"', () => {
    expect(DEFAULT_HOLE_MARGIN).toBe(5);
  });

  it('prioridade global 1>2>3 — desenho > operador > regra > default', () => {
    // desenho explícito vence a regra
    const r = resolveHoleFromInput({ depth: 20, holeRule: 'process:5x-thread-diameter', holeDepth: 25, holeMargin: 5 }, M10);
    expect(r.final).toBe(25);
    // sem desenho nem operador, a regra manda
    const r2 = resolveHoleFromInput({ depth: 20, holeRule: 'process:5x-thread-diameter', holeMargin: 5 }, M10);
    expect(r2.final).toBe(50);
    // sem regra: default 2,5 × Ø
    const r3 = resolveHoleFromInput({ depth: 20, holeMargin: 5 }, M10);
    expect(r3.suggested).toBe(25);
  });

  it('BLIND_HOLE_DEFAULT_RULES usa estrutura process-rule (id/name/reference/factor)', () => {
    for (const r of BLIND_HOLE_DEFAULT_RULES) {
      expect(r.id).toBeTruthy();
      expect(r.name).toBeTruthy();
      expect(['threadDiameter', 'drillDiameter']).toContain(r.reference);
      expect(typeof r.factor).toBe('number');
    }
  });
});