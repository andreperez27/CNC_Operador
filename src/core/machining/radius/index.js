/**
 * Raio — módulo canônico (core/machining/radius).
 *
 * Pipeline único: validação → geometria → estratégia → trajetória → IR
 * → postprocessor. Consumido pelo G-Code Rápido, pelos adapters das
 * features (Heidenhain) e pelo registry do G-Code.
 *
 * A matemática reproduz EXATAMENTE a planilha de setor
 * (`calculo_chanfro_parametrizado.xlsx`, bloco "Raio de canto externo"):
 * docs/RAIO_SPREADSHEET_REFERENCE.md.
 *
 * TIPOS: 'external' (canto externo em aresta reta — planilha) e 'internal'
 * (canto do bolsão — espelho em X, mesma identidade de círculo).
 */

export { normalizeRadiusInput } from './model';
export { solveRadius, assembleOperationModel } from './solver';
export { validateRadiusInput, RADIUS_TYPES } from './validation';
export { radiusGeometry } from './geometry';
export { buildPassStrategy } from './strategy';
export { buildTrajectory } from './trajectory';
export { buildRadiusIR, buildRadiusProgram } from './template';