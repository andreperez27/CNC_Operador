/**
 * Resolução da profundidade do FURO CEGO dentro do pipeline de rosca.
 *
 * Fluxo (canônico):
 *   Thread → Regra de processo → Profundidade calculada → Validação
 *          → Estratégia → Trajetória → IR → Postprocessor Heidenhain → .H
 *
 * PRIORIDADE dos valores (§13 do prompt de regras de processo):
 *   1. valor explícito do desenho (holeDepth informado pelo operador);
 *   2. regra de processo selecionada (sugestão calculada);
 *   3. mínimo físico (profundidade da rosca + margem inferior);
 *   4. sugestão padrão (regra default quando nenhuma foi escolhida).
 *
 * A regra é SUGESTÃO — nunca substitui silenciosamente um valor do desenho.
 * A margem inferior NÃO é universal: é informada pelo usuário
 * (profundidade do furo ≠ profundidade útil da rosca — espaço para entrada da
 * ferramenta, ponta da broca, cavacos, saída…).
 *
 * A profundidade útil da rosca NUNCA é alterada pela regra: são parâmetros
 * independentes.
 */

import {
  BLIND_HOLE_REFERENCES,
  CUSTOM_RULE_ID,
  resolveRuleObject,
  calculateBlindHoleDepth,
} from '../../process/rules/blindHoleDepth';

export const DEFAULT_HOLE_MARGIN = 5;
export const DEFAULT_HOLE_RULE = 'process:2.5x-thread-diameter';

function blank(v) {
  return v === undefined || v === null || v === '';
}

export function resolveHoleFromInput(input, thread) {
  if (!input || !thread) {
    return {
      valid: false,
      suggested: null,
      minimum: null,
      final: null,
      margin: null,
      threadDepth: null,
      ruleId: null,
      ruleProvided: false,
      reference: null,
      factor: null,
      formula: null,
      error: 'Entrada invalida para resolucao de furo cego.',
      code: 'INVALID_INPUT',
    };
  }

  const threadDepth = Number(input.depth);
  const margin = blank(input.holeMargin) ? DEFAULT_HOLE_MARGIN : Number(input.holeMargin);
  const marginValid = Number.isFinite(margin) && margin >= 0;

  const ruleProvided = !blank(input.holeRule);

  let rule = null;
  if (ruleProvided) {
    if (input.holeRule === CUSTOM_RULE_ID) {
      rule = resolveRuleObject({
        reference: input.customReference || BLIND_HOLE_REFERENCES.THREAD_DIAMETER,
        factor: input.customFactor,
      });
    } else {
      rule = resolveRuleObject(input.holeRule) || resolveRuleObject(DEFAULT_HOLE_RULE);
    }
  } else {
    rule = resolveRuleObject(DEFAULT_HOLE_RULE);
  }

  const computed = calculateBlindHoleDepth({
    rule,
    threadDiameter: thread.nominal,
    drillDiameter: thread.hole,
  });

  const minHole = (Number.isFinite(threadDepth) ? threadDepth : 0)
    + (Number.isFinite(margin) ? margin : DEFAULT_HOLE_MARGIN);

  const suggested = computed.valid
    ? Math.max(computed.depth, minHole)
    : minHole;

  // Prioridade 1: valor explícito informado pelo operador/desenho
  const operator = blank(input.holeDepth) ? null : Number(input.holeDepth);
  const final = operator !== null && Number.isFinite(operator) && operator > 0
    ? operator
    : suggested;

  const finalUsable = Number.isFinite(final) && final > 0;
  const enough = !Number.isFinite(threadDepth) || final >= threadDepth;

  const valid = marginValid && finalUsable && enough;

  return {
    valid,
    suggested,
    minimum: minHole,
    final,
    margin,
    threadDepth: Number.isFinite(threadDepth) ? threadDepth : null,
    ruleId: rule ? rule.id : null,
    ruleProvided,
    reference: computed.reference,
    factor: computed.factor,
    formula: computed.formula,
    error: valid
      ? null
      : !marginValid
        ? 'Margem do furo deve ser um numero maior ou igual a zero.'
        : !finalUsable
          ? 'Profundidade do furo deve ser um numero maior que zero.'
          : 'Profundidade do furo e menor que a profundidade da rosca.',
    code: valid ? null : !marginValid ? 'INVALID_HOLE_MARGIN' : !finalUsable ? 'INVALID_HOLE_DEPTH' : 'INVALID_HOLE_DEPTH',
  };
}
