/**
 * solver — entrada canônica do Raio (core).
 *
 * `solveRadius(input)` executa o pipeline completo:
 *
 *   1. VALIDAÇÃO  (validateRadiusInput) — nunca calcula com dados inválidos
 *   2. GEOMETRIA  — radiusGeometry (rho, Xc/Q4, xAt/Q6, centro e raio do
 *                   círculo da trajetória)
 *   3. ESTRATÉGIA — buildPassStrategy (nPasses, incReal, passes)
 *   4. TRAJETÓRIA — buildTrajectory (pontos únicos; identidade do círculo)
 *   5. MODELO     — assembleOperationModel (campos de programa)
 *
 * ENTRADA (normalizada — ver `normalizeRadiusInput` e `model.js`):
 *   { type: 'external' | 'internal', radius: R,
 *     tool: { type, diameter: D, radius: r },
 *     strategy: { passDepth: incrZ },
 *     plane, origin, length: L, feed, rpm, safety, toolNumber, sobre, stock,
 *     clearance: { pocketWidth } | undefined }   // apenas interno
 *
 * SAÍDA: { valid, validation: {valid, errors, warnings}, model }
 *
 * `model.params` preserva o formato usado pelo restante do app
 * (R, D, r, L, incrZ, rpm, av, toolType, numeroFerramenta, ...).
 * `model.q4` e `model.q6` expõem as duas fórmulas da planilha auditada.
 */

import { validateRadiusInput } from './validation';
import { normalizeRadiusInput } from './model';
import { radiusGeometry } from './geometry';
import { buildPassStrategy } from './strategy';
import { buildTrajectory } from './trajectory';
import { validateToolClearance } from '../../validators/validateToolClearance';

export function assembleOperationModel(type, geometry, strategy, trajectory, params) {
  const D = params.D;
  const L = params.L;
  const seguranca = Number(params.distanciaSeguranca) || 0;
  const halfL = (params.L || 100) / 2;

  const last = trajectory.end;

  const model = {
    ...geometry,
    ...strategy,
    trajectory,
    type,
    plane: 'XZ',
    operationId: type === 'internal' ? 'radiusInternal' : 'radiusExternal',
    params,
    seguranca,
    xCorner: type === 'internal' ? seguranca + D / 2 : geometry.xCenter - seguranca,
    dMeio: D / 2,
    yTotal: (L || 100) + seguranca,
    yStart: -halfL,
    yEnd: halfL,
    safeZ: 5,
    retrZ: 0.5,
    q4: geometry.xCenter,
    q6: last ? last.x : geometry.xAt(geometry.profZ),
    rho: geometry.rho,
    contact: {
      toolCenter: last ? { x: last.x, z: last.z } : null,
      noseCenter: last ? geometry.noseCenter(last.z) : null,
      contactPoint: last ? geometry.contactAt(last.z) : null,
    },
  };

  if (type === 'internal') {
    const pWidth = params.clearance?.pocketWidth ?? 0;
    model.clearance = validateToolClearance(D, pWidth, 2);
  }

  return model;
}

export function solveRadius(input) {
  const validation = validateRadiusInput(input);
  if (!validation.valid) {
    return { valid: false, validation, model: null };
  }

  const params = normalizeRadiusInput(input);
  const geometry = radiusGeometry({ R: params.R, D: params.D, r: params.r, type: input.type });

  const strategy = buildPassStrategy(geometry, params);
  const trajectory = buildTrajectory(geometry, strategy);
  const model = assembleOperationModel(input.type, geometry, strategy, trajectory, params);

  if (model.nPasses > 200) {
    validation.warnings.push({
      code: 'WARN_MANY_PASSES',
      field: 'incrZ',
      message: 'Numero de passes alto (' + model.nPasses + ') — confira o incremento por passe.',
    });
  } else if (model.nPasses === 1) {
    validation.warnings.push({
      code: 'WARN_SINGLE_PASS',
      field: 'incrZ',
      message: 'Incremento maior ou igual a R: percurso executado em um unico passe.',
    });
  }

  return { valid: true, validation, model };
}