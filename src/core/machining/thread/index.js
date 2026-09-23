/**
 * Rosca — módulo canônico (core/machining/thread).
 *
 * Pipeline único: banco → busca → validação → estratégia → trajetória
 * → IR → postprocessor Heidenhain. Consumido pela página Roscas e por
 * futuros consumidores (nunca gera string de dialeto diretamente).
 */

export {
  THREAD_FAMILIES,
  THREAD_RECORDS,
  getFamily,
  getThread,
  getThreads,
  getAvailableFamilies,
} from './database';
export {
  normalizeThreadQuery,
  parseThreadQuery,
  matchesThread,
  searchThreads,
} from './search';
export { validateThreadInput } from './validation';
export { resolveHoleFromInput, DEFAULT_HOLE_MARGIN, DEFAULT_HOLE_RULE } from './holeDepth';
export { buildThreadStrategy, RIGID, HELICAL } from './strategy';
export { buildThreadTrajectory } from './trajectory';
export { buildThreadIR, buildThreadProgram } from './template';
export { solveThread, assembleThreadModel } from './solver';