/**
 * Chamfer — módulo canônico (core/machining/chamfer).
 *
 * Pipeline único: validação → geometria → estratégia → trajetória → IR
 * → postprocessor. Consumido pelo G-Code Rápido, pelos adapters das
 * features (Heidenhain) e pela migração do G-Code legado.
 */

export { solveChamfer, normalizeChamferInput } from './solver';
export { validateChamferInput, CHAMFER_TYPES } from './validation';
export { chamferGeometry } from './geometry';
export { buildPassStrategy } from './strategy';
export { buildTrajectory } from './trajectory';
export {
  buildChamferProgram,
  buildExternalChamferIR,
  buildInternalChamferIR,
} from './template';