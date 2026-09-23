/**
 * Motor do chanfro INTERNO — adapter do motor canônico (core).
 *
 * Mantém a API legada (`solveInternalChamfer(params)`) e os valores
 * validados de produção (inclusive o lançamento de erro quando a
 * ferramenta não cabe no bolsão — INVALID_CLEARANCE, mesma mensagem
 * de `validateToolClearance`).
 *
 * SEGURANÇA nova (sem mudar resultados válidos):
 *   - A=0° ou A>=90°  → ValidationError INVALID_ANGLE;
 *   - passeZ <= 0     → ValidationError INVALID_PASS_DEPTH (loop
 *                       infinito/OOM bloqueado no core);
 *   - r > D/2 (tórica)→ ValidationError INVALID_TOOL_RADIUS;
 *   - bolsão estreito → ValidationError INVALID_CLEARANCE (era throw
 *                       Error com a mesma mensagem).
 *
 * O modelo retornado é SUPERSET do modelo legado (chamfer.top/bottom/
 * midpoint, clearance, trajXEnd etc.), com o mesmo formato consumido
 * pela HeidenhainPage.
 */

import { solveChamfer } from '../../../core/machining/chamfer';
import { raiseFirstError } from '../../../core/validation/validationEngine';

export function toCanonicalInput(params) {
  return {
    type: 'internal',
    width: params.C,
    angle: params.A,
    tool: { type: params.toolType, diameter: params.D, radius: params.r },
    strategy: { passDepth: params.passeZ },
    plane: 'XZ',
    origin: 'corner',
    length: params.L,
    feed: params.av,
    rpm: params.rpm,
    safety: params.distanciaSeguranca,
    toolNumber: params.numeroFerramenta,
    clearance: { pocketWidth: params.alojamentoLargura },
    sobre: params.sobre,
  };
}

export function solveInternalChamfer(params) {
  const input = toCanonicalInput(params);
  const result = solveChamfer(input);
  if (!result.valid) {
    raiseFirstError(result.validation);
  }
  return result.model;
}