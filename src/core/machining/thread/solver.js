/**
 * solver — entrada canônica da rosca (core).
 *
 * `solveThread(input)` executa o pipeline completo:
 *
 *   1. VALIDAÇÃO (ValidationEngine) — nunca calcula com dados inválidos
 *   2. ROsca      — resolve o registro do banco (threadId | thread)
 *   3. ESTRATÉGIA — buildThreadStrategy (rigid CYCL 207 | helical)
 *   4. TRAJETÓRIA — buildThreadTrajectory (pontos da hélice / eixo do furo)
 *   5. MODELO     — assembleOperationModel (dados do programa + preview)
 *
 * ENTRADA (canônica):
 *   solveThread({
 *     threadId,                  // id do registro (ou `thread` direto)
 *     toolNumber, rpm, depth,    // depth = profundidade ÚTIL da rosca
 *     safety, zStart,            // zStart = topo da rosca (0 por padrão)
 *     toolDiameter, feed, direction,  // apenas método helical
 *     holeRule,                  // regra de furo cego (processo) — veja core/process
 *     customFactor, customReference,  // se holeRule = 'process:custom'
 *     holeMargin,                // margem inferior do furo (default 5 mm)
 *     holeDepth,                 // profundidade TOTAL do furo (desenho/operador)
 *     stock: { w, l, h }         // opcional -> BLK FORM no programa
 *   })
 *
 * SAÍDA: { valid, validation, model }
 */
import { getThread, getFamily } from './database';
import { validateThreadInput } from './validation';
import { resolveHoleFromInput } from './holeDepth';
import { buildThreadStrategy } from './strategy';
import { buildThreadTrajectory } from './trajectory';

function isBlank(v) {
  return v === '' || v === undefined || v === null;
}

export function assembleThreadModel(thread, strategy, trajectory, params) {
  const family = getFamily(thread.familyId);

  const stock = params.stock;
  const stockDims =
    stock && [stock.w, stock.l, stock.h].every((v) => !isBlank(v))
      ? { w: Number(stock.w), l: Number(stock.l), h: Number(stock.h) }
      : null;

  const hole = params.hole;
  const holeRule = hole && hole.ruleId
    ? {
        id: hole.ruleId,
        reference: hole.reference,
        factor: hole.factor,
        formula: hole.formula,
      }
    : null;

  return {
    thread,
    family,
    designation: thread.designation,
    nominal: thread.nominal,
    pitch: thread.pitch,
    hole: thread.hole, // Ø broca (furo prévio) — dado da rosca
    familyName: family.name,
    standard: thread.standard,
    source: thread.source,
    recommendations: thread.recommendations || [],
    method: strategy.method,
    cycle: strategy.cycle,
    operationId: strategy.method === 'rigid' ? 'roscaRigida' : 'roscaHelicoidal',
    depth: params.depth, // profundidade útil da rosca
    threadDepth: params.depth,
    // furo cego (regra de processo)
    holeDepth: hole ? hole.final : params.depth,
    holeMinimum: hole ? hole.minimum : params.depth,
    holeSuggested: hole ? hole.suggested : params.depth,
    holeMargin: hole ? hole.margin : 0,
    holeRule,
    holeRuleProvided: hole ? hole.ruleProvided : false,
    zStart: strategy.zStart,
    zEnd: strategy.zEnd,
    toolNumber: params.toolNumber,
    rpm: params.rpm,
    safety: params.safety ?? 0,
    feed: strategy.feed,
    radius: strategy.radius ?? null,
    toolDiameter: strategy.toolDiameter ?? null,
    direction: strategy.direction ?? null,
    nPasses: strategy.nPasses,
    strategy,
    trajectory,
    stockDims,
    params,
  };
}

export function solveThread(input) {
  const thread = input && (input.threadId ? getThread(input.threadId) : input.thread);
  const hole = resolveHoleFromInput(input, thread);
  const validation = validateThreadInput(input, { thread, hole });
  if (!validation.valid) {
    return { valid: false, validation, model: null };
  }

  const params = {
    toolNumber: input.toolNumber === undefined ? 1 : input.toolNumber,
    rpm: input.rpm,
    depth: input.depth,
    toolDiameter: input.toolDiameter,
    feed: input.feed,
    direction: input.direction || 'cw',
    zStart: input.zStart ?? 0,
    safety: input.safety ?? 0,
    stock: input.stock,
    hole,
  };

  const strategy = buildThreadStrategy(thread, params);
  const trajectory = buildThreadTrajectory(strategy);
  const model = assembleThreadModel(thread, strategy, trajectory, params);

  return { valid: true, validation, model };
}