/**
 * REGRA DE PROCESSO — Profundidade de furo cego para rosca.
 *
 * Distinção central (NUNCA confundir):
 *   - NORMA: define características NORMALIZADAS da rosca (Ø nominal, passo,
 *     Ø broca recomendado, série…). Esses dados vivem no banco da rosca
 *     (core/machining/thread/database.js).
 *   - REGRA DE PROCESSO: critério de FABRICAÇÃO usado por uma empresa,
 *     operador ou processo (ex.: profundidade do furo cego = fator × diâmetro).
 *     Vive aqui, separada da tabela de roscas (core/process/rules).
 *
 * As regras cadastradas abaixo são REGRAS DE PROCESSO informadas pelo usuário
 * (type = 'process-rule', origem = 'informada pelo usuario', normative = false).
 * Nenhuma delas é "norma ISO", "norma ABNT" nem "norma GM" — isso só acontece
 * quando existir documentação oficial que comprove a origem (ver
 * docs/THREAD_PROCESS_RULES.md).
 *
 * O solver é PURO: não gera G-Code e não conhece o pipeline de
 * pós-processamento. Nunca retorna NaN/Infinity — toda entrada passa por
 * isFinite* antes de qualquer cálculo.
 */

export const PROCESS_TYPE = 'process-rule';

export const BLIND_HOLE_REFERENCES = {
  THREAD_DIAMETER: 'threadDiameter',
  DRILL_DIAMETER: 'drillDiameter',
};

export const BLIND_HOLE_REFERENCE_LABELS = {
  [BLIND_HOLE_REFERENCES.THREAD_DIAMETER]: 'Ø da rosca',
  [BLIND_HOLE_REFERENCES.DRILL_DIAMETER]: 'Ø da broca',
};

export const CUSTOM_RULE_ID = 'process:custom';

export const BLIND_HOLE_DEFAULT_RULES = [
  {
    id: 'process:2.5x-thread-diameter',
    name: '2,5 × Ø da rosca',
    reference: BLIND_HOLE_REFERENCES.THREAD_DIAMETER,
    factor: 2.5,
  },
  {
    id: 'process:4x-drill-diameter',
    name: '4 × Ø da broca',
    reference: BLIND_HOLE_REFERENCES.DRILL_DIAMETER,
    factor: 4,
  },
  {
    id: 'process:5x-thread-diameter',
    name: '5 × Ø da rosca',
    reference: BLIND_HOLE_REFERENCES.THREAD_DIAMETER,
    factor: 5,
  },
];

function isFiniteNumber(v) {
  return typeof v === 'number' && Number.isFinite(v);
}

function isPositive(v) {
  return isFiniteNumber(v) && v > 0;
}

function isValidReference(ref) {
  return ref === BLIND_HOLE_REFERENCES.THREAD_DIAMETER
    || ref === BLIND_HOLE_REFERENCES.DRILL_DIAMETER;
}

function describeRule(r) {
  return {
    id: r.id,
    name: r.name,
    reference: r.reference,
    factor: r.factor,
    formula: formatBlindHoleFormula(r.factor, r.reference),
    type: PROCESS_TYPE,
    origem: 'informada pelo usuario',
    normative: false,
  };
}

export function formatFactor(factor) {
  return String(Number(factor)).replace('.', ',');
}

export function formatBlindHoleFormula(factor, reference) {
  const ref = BLIND_HOLE_REFERENCE_LABELS[reference] || reference || '—';
  if (!isPositive(factor)) return '—';
  return formatFactor(factor) + ' × ' + ref;
}

/** Lista as regras cadastradas (todas com type/origem/normative explícitos). */
export function listBlindHoleRules() {
  return BLIND_HOLE_DEFAULT_RULES.map(describeRule);
}

/** Retorna a regra pelo id (string) ou null. Equivalente a resolveRuleObject(id). */
export function getBlindHoleRule(id) {
  return resolveRuleObject(id);
}

/**
 * Resolve uma regra a partir de:
 *   - string id (regras pré-cadastradas ou CUSTOM_RULE_ID);
 *   - objeto inline { reference, factor } (regra personalizada/usuário).
 * Retorna null para id inexistente.
 */
export function resolveRuleObject(rule) {
  if (!rule) return null;
  if (typeof rule === 'string') {
    if (rule === CUSTOM_RULE_ID) {
      return {
        id: CUSTOM_RULE_ID,
        name: 'Personalizada',
        reference: null,
        factor: null,
        type: PROCESS_TYPE,
        origem: 'informada pelo usuario',
        normative: false,
      };
    }
    const found = BLIND_HOLE_DEFAULT_RULES.find((r) => r.id === rule);
    return found ? describeRule(found) : null;
  }
  if (typeof rule !== 'object') return null;
  return {
    ...rule,
    id: rule.id || CUSTOM_RULE_ID,
    type: rule.type || PROCESS_TYPE,
    origem: rule.origem || 'informada pelo usuario',
    normative: rule.normative === true,
  };
}

/**
 * SOLVER PURO da regra de profundidade de furo cego.
 *
 *   calculateBlindHoleDepth({ rule, threadDiameter, drillDiameter })
 *     rule            — id string, objeto { reference, factor } ou null
 *     threadDiameter  — Ø nominal da rosca (mm)
 *     drillDiameter   — Ø da broca / furo (mm)
 *
 * Retorna { depth, rule, reference, factor, diameter, formula } quando válido
 * ou { valid: false, code, error, depth: null } caso contrário. Mantém precisão
 * interna (sem arredondamento) — a formatação é responsabilidade da UI.
 *
 * Códigos de erro estáveis:
 *   INVALID_RULE        regra inexistente / vazia
 *   INVALID_REFERENCE   referência fora de threadDiameter | drillDiameter
 *   INVALID_FACTOR      fator ausente, NaN, Infinity, zero ou negativo
 *   INVALID_DIAMETER    diâmetro da referência ausente, NaN, Infinity, zero ou negativo
 */
export function calculateBlindHoleDepth({ rule, threadDiameter, drillDiameter }) {
  const r = resolveRuleObject(rule);
  if (!r) {
    return invalid('INVALID_RULE', 'Regra inexistente.', null, null);
  }

  const reference = r.reference || r.referenceOf || null;
  if (!isValidReference(reference)) {
    return invalid('INVALID_REFERENCE',
      'Referencia invalida da regra (use threadDiameter ou drillDiameter).',
      r, reference);
  }

  const factor = r.factor;
  if (!isPositive(factor)) {
    return invalid('INVALID_FACTOR',
      'Fator da regra deve ser um numero maior que zero.', r, reference, factor);
  }

  const diameter = reference === BLIND_HOLE_REFERENCES.THREAD_DIAMETER
    ? threadDiameter
    : drillDiameter;

  if (!isPositive(diameter)) {
    const label = reference === BLIND_HOLE_REFERENCES.THREAD_DIAMETER
      ? 'diametro da rosca'
      : 'diametro da broca';
    return invalid('INVALID_DIAMETER',
      'O ' + label + ' da referencia deve ser um numero maior que zero.',
      r, reference, factor, diameter);
  }

  const depth = factor * diameter; // precisão interna — sem arredondamento prematuro

  return {
    valid: true,
    depth,
    rule: r,
    reference,
    factor,
    diameter,
    formula: formatBlindHoleFormula(factor, reference),
  };
}

function invalid(code, error, rule, reference, factor, diameter) {
  return {
    valid: false,
    code,
    error,
    depth: null,
    rule,
    reference: reference ?? null,
    factor: factor ?? null,
    diameter: diameter ?? null,
    formula: null,
  };
}

export const isBlindHoleRuleId = (id) =>
  !!id && (BLIND_HOLE_DEFAULT_RULES.some((r) => r.id === id) || id === CUSTOM_RULE_ID);
