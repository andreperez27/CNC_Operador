/**
 * Motor do chanfro EXTERNO — adapter do motor canônico (core).
 *
 * Mantém a API legada (`solveExternalChamfer(params)`) e os valores
 * validados de produção, agora passando pelo pipeline canônico
 * (validação → geometria → estratégia → trajetória) em
 * `core/machining/chamfer`.
 *
 * SEGURANÇA nova (sem mudar resultados válidos):
 *   - A=0° ou A>=90°  → ValidationError INVALID_ANGLE (não mais
 *                       xCentro = Infinity em silêncio);
 *   - passeZ <= 0     → ValidationError INVALID_PASS_DEPTH (não mais
 *                       loop infinito/OOM);
 *   - r > D/2 (tórica)→ ValidationError INVALID_TOOL_RADIUS;
 *   - D <= 0, C <= 0, L <= 0 → erro estruturado correspondente.
 *
 * O modelo retornado é SUPERSET do modelo legado: conserva params,
 * toolType, toolTypeName, toolCornerR, profZ, largX, angRad, cotA,
 * Reff, xCentro, chamfer, contact, contactValidation, tangency e
 * trajectory (start/end/safeZ), além de type, nPasses, incReal,
 * passes, seguranca, xCorner, dMeio, yTotal, yStart, yEnd, safeZ e
 * retrZ — mesma forma consumida pela HeidenhainPage.
 */

import { solveChamfer, normalizeChamferInput } from '../../../core/machining/chamfer';
import { raiseFirstError } from '../../../core/validation/validationEngine';

export function toCanonicalInput(params) {
  return {
    type: 'external',
    width: params.C,
    angle: params.A,
    tool: { type: params.toolType, diameter: params.D, radius: params.r },
    strategy: { passDepth: params.passeZ },
    plane: 'XZ',
    origin: 'vertex',
    length: params.L,
    feed: params.av,
    rpm: params.rpm,
    safety: params.distanciaSeguranca,
    toolNumber: params.numeroFerramenta,
    stock: {
      w: params.blocoW,
      l: params.blocoL,
      h: params.blocoH,
    },
    sobre: params.sobre,
  };
}

export function solveExternalChamfer(params) {
  const input = toCanonicalInput(params);
  const result = solveChamfer(input);
  if (!result.valid) {
    raiseFirstError(result.validation);
  }
  return result.model;
}

export { normalizeChamferInput };