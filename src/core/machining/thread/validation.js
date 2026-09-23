/**
 * Validação da entrada do solver de rosca (canônico).
 *
 * Executada na porta de entrada de `solveThread` — nunca calcula com dados
 * inválidos. Códigos estáveis:
 *
 *   INVALID_INPUT          entrada ausente/não-objeto
 *   INVALID_THREAD         rosca não encontrada no banco
 *   INVALID_SPINDLE_SPEED  RPM ausente/<= 0/não numérico (NaN/Inf)
 *   INVALID_DEPTH          profundidade ausente/<= 0/não numérica
 *   INVALID_TOOL_NUMBER    número da ferramenta não inteiro >= 0
 *   INVALID_Z_START        posição inicial Z não numérica
 *   INVALID_SAFETY         distância de segurança negativa
 *   INVALID_TOOL_DIAMETER  (helicoidal) diâmetro da fresa ausente/<= 0
 *   INVALID_INTERP_RADIUS  (helicoidal) raio de interpolação <= 0
 *   INVALID_TOOL_FIT       (helicoidal) fresa não entra no pré-furo
 *   INVALID_FEED           (helicoidal) avanço ausente/<= 0
 *   INVALID_DIRECTION      (helicoidal) sentido fora de cw/ccw
 *   INVALID_HOLE_RULE      regra de furo cego inexistente
 *   INVALID_HOLE_MARGIN    margem inferior do furo negativa/não numérica
 *   INVALID_HOLE_CUSTOM_FACTOR     (personalizada) fator ausente/<= 0
 *   INVALID_HOLE_CUSTOM_REFERENCE  (personalizada) referência fora de threadDiameter|drillDiameter
 *   INVALID_HOLE_DEPTH     profundidade do furo ausente/<= 0 ou MENOR que a da rosca
 *
 * Regras de segurança: nenhum NaN/Infinity entra no cálculo (isFinite*).
 */

import {
  createValidation,
  addError,
  addWarning,
  guard,
  finalize,
  isFinitePositive,
  isFiniteNumber,
} from '../../validation/validationEngine';
import { getThread } from './database';
import {
  BLIND_HOLE_REFERENCES,
  CUSTOM_RULE_ID,
  getBlindHoleRule,
} from '../../process/rules/blindHoleDepth';
import { resolveHoleFromInput } from './holeDepth';

/**
 * Valida a entrada do solver de rosca.
 * ctx opcional: { thread, hole } evita recomputar a resolução do furo quando
 * o caller (solver) já resolveu (resolveHoleFromInput).
 */
export function validateThreadInput(input, ctx) {
  const v = createValidation();

  if (!input || typeof input !== 'object') {
    addError(v, 'INVALID_INPUT', null, 'Entrada invalida: objeto de parametros nao informado.');
    return finalize(v);
  }

  const thread = ctx?.thread || (input.threadId ? getThread(input.threadId) : input.thread);
  if (!thread) {
    addError(v, 'INVALID_THREAD', 'rosca', 'Rosca nao encontrada no banco de dados.');
    return finalize(v);
  }

  guard(v, isFinitePositive(input.rpm), 'INVALID_SPINDLE_SPEED', 'rpm',
    'RPM deve ser um numero maior que zero.');
  guard(v, isFinitePositive(input.depth), 'INVALID_DEPTH', 'profundidade',
    'Profundidade da rosca deve ser um numero maior que zero.');

  const toolNumber = input.toolNumber === undefined ? 1 : input.toolNumber;
  if (!isFiniteNumber(toolNumber) || toolNumber < 0 || !Number.isInteger(toolNumber)) {
    addError(v, 'INVALID_TOOL_NUMBER', 'ferramenta',
      'Numero da ferramenta deve ser um inteiro maior ou igual a zero.');
  }

  if (input.zStart !== undefined && input.zStart !== null) {
    guard(v, isFiniteNumber(input.zStart), 'INVALID_Z_START', 'posicaoInicial',
      'Posicao inicial Z deve ser um numero.');
  }

  if (input.safety !== undefined && input.safety !== null) {
    guard(v, isFiniteNumber(input.safety) && input.safety >= 0, 'INVALID_SAFETY',
      'distanciaSeguranca', 'Distancia de seguranca deve ser um numero maior ou igual a zero.');
  }

  if (thread.method === 'helical') {
    const toolDiameter = input.toolDiameter;
    guard(v, isFinitePositive(toolDiameter), 'INVALID_TOOL_DIAMETER', 'diamFerramenta',
      'Diametro da ferramenta de roscar deve ser maior que zero.');

    guard(v, isFinitePositive(input.feed), 'INVALID_FEED', 'av',
      'Avanco de usinagem deve ser maior que zero.');

    const direction = input.direction || 'cw';
    if (!['cw', 'ccw'].includes(direction)) {
      addError(v, 'INVALID_DIRECTION', 'sentido',
        'Sentido de rotacao invalido (use cw ou ccw).');
    }

    if (isFinitePositive(toolDiameter)) {
      const radius = (thread.nominal - toolDiameter) / 2;
      if (radius <= 0) {
        addError(v, 'INVALID_INTERP_RADIUS', 'diamFerramenta',
          'Raio de interpolacao deve ser maior que zero (fresa deve ser menor que o '
          + 'diametro nominal ' + thread.nominal.toFixed(1) + ' mm).');
      } else if (toolDiameter >= thread.hole) {
        addError(v, 'INVALID_TOOL_FIT', 'diamFerramenta',
          'Fresa D' + toolDiameter.toFixed(1) + ' nao entra no pre-furo Ø'
          + thread.hole.toFixed(2) + ' mm (use uma fresa menor).');
      }
    }

    if (isFinitePositive(input.depth) && thread.pitch > 0) {
      const nPasses = Math.ceil(input.depth / thread.pitch);
      if (nPasses > 60) {
        addWarning(v, 'WARN_MANY_TURNS', 'profundidade',
          'Roscamento helicoidal com ' + nPasses + ' voltas — confira a profundidade '
          + 'e o passo (o controle limita o total de graus por trecho).');
      }
    }
  }

  // ── FURO CEGO — regra de processo (profundidade do furo ≠ rosca) ──
  const hole = ctx?.hole || resolveHoleFromInput(input, thread);

  // regra selecionada deve existir (exceto personalizada)
  if (input.holeRule && input.holeRule !== CUSTOM_RULE_ID && !getBlindHoleRule(input.holeRule)) {
    addError(v, 'INVALID_HOLE_RULE', 'regra',
      'Regra de profundidade do furo nao cadastrada.');
  }

  // regra personalizada: fator > 0 e referência válida
  if (input.holeRule === CUSTOM_RULE_ID) {
    guard(v, isFinitePositive(Number(input.customFactor)), 'INVALID_HOLE_CUSTOM_FACTOR', 'fator',
      'Fator da regra personalizada deve ser um numero maior que zero.');
    if (input.customReference
      && input.customReference !== BLIND_HOLE_REFERENCES.THREAD_DIAMETER
      && input.customReference !== BLIND_HOLE_REFERENCES.DRILL_DIAMETER) {
      addError(v, 'INVALID_HOLE_CUSTOM_REFERENCE', 'referencia',
        'Referencia invalida da regra personalizada (use threadDiameter ou drillDiameter).');
    }
  }

  // profundidade do furo explícita (operador/desenho) deve ser um número > 0
  if (input.holeDepth !== undefined && input.holeDepth !== null && input.holeDepth !== '') {
    guard(v, isFinitePositive(Number(input.holeDepth)), 'INVALID_HOLE_DEPTH', 'profundidadeFuro',
      'Profundidade do furo deve ser um numero maior que zero.');
  }

  // consistência do furo cego: margem válida e furo >= profundidade da rosca
  if (hole && !hole.valid) {
    const isMargin = hole.code === 'INVALID_HOLE_MARGIN';
    addError(v, isMargin ? 'INVALID_HOLE_MARGIN' : 'INVALID_HOLE_DEPTH',
      isMargin ? 'margem' : 'profundidadeFuro', hole.error);
  }

  return finalize(v);
}