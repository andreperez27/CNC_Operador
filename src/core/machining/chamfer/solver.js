/**
 * solver — entrada canônica do chanfro (core).
 *
 * `solveChamfer(input)` executa o pipeline completo:
 *
 *   1. VALIDAÇÃO (ValidationEngine) — nunca calcula com dados inválidos
 *   2. GEOMETRIA  — chamferGeometry (profZ, largX, cotA, Reff, xCentro...)
 *   3. ESTRATÉGIA — buildPassStrategy (nPasses, incReal, passes)
 *   4. TRAJETÓRIA — buildTrajectory (pontos únicos para preview/template)
 *   5. MODELO     — assembleOperationModel (campos de programa: seguranca,
 *                   xCorner, yTotal, yStart/yEnd, safeZ, retrZ...)
 *
 * ENTRADA (normalizada — veja a doc abaixo) e SAÍDA:
 *   { valid, validation: {valid, errors, warnings}, model }
 *
 * `model.params` preserva o formato usado pelo restante do app
 * (A, C, D, r, L, passeZ, rpm, av, toolType, alojamentoLargura...),
 * mantendo compatíveis previews, mapas Q e templates existentes.
 *
 * ENTRADA CANÔNICA:
 *   solveChamfer({
 *     type,                      // 'external' | 'internal'
 *     width, angle,              // C (mm), A (graus)
 *     depth,                     // opcional: profZ total (override de C·senA)
 *     tool: { type, diameter, radius },
 *     strategy: { passDepth },   // profundidade por passe (mm)
 *     plane: 'XZ', origin,       // 'vertex' | 'corner'
 *     length, feed, rpm, safety, toolNumber, sobre,
 *     stock: { w, l, h } | undefined,
 *     clearance: { pocketWidth } | undefined,   // apenas interno
 *   })
 */

import { validateChamferInput } from './validation';
import { chamferGeometry } from './geometry';
import { buildPassStrategy } from './strategy';
import { buildTrajectory } from './trajectory';
import { validateToolClearance } from '../../validators/validateToolClearance';
import { validateContact } from '../contactGeometry';

export function normalizeChamferInput(input) {
  const tool = input.tool || {};
  return {
    A: input.width,
    C: input.width,
    D: tool.diameter,
    r: tool.radius,
    L: input.length,
    passeZ: input.strategy?.passDepth,
    rpm: input.rpm,
    av: input.feed,
    toolType: tool.type,
    alojamentoLargura: input.clearance?.pocketWidth,
    numeroFerramenta: input.toolNumber,
    distanciaSeguranca: input.safety,
    blocoW: input.stock?.w,
    blocoL: input.stock?.l,
    blocoH: input.stock?.h,
    sobre: input.sobre,
  };
}

function assembleOperationModel(type, geometry, strategy, trajectory, params) {
  const D = params.D;
  const L = params.L;
  const seguranca = Number(params.distanciaSeguranca) || 0;
  const halfL = (params.L || 100) / 2;

  const model = {
    ...geometry,
    ...strategy,
    trajectory,
    type,
    plane: 'XZ',
    operationId: type === 'internal' ? 'chamferInternal' : 'chamferExternal',
    params,
    seguranca,
    xCorner: seguranca + D / 2,
    dMeio: D / 2,
    yTotal: (L || 100) + seguranca,
    yStart: -halfL,
    yEnd: halfL,
    safeZ: 5,
    retrZ: 0.5,
  };

  model.contactValidation = validateContact(geometry.contact);

  if (type === 'internal') {
    const pWidth = params.alojamentoLargura ?? 0;
    model.clearance = validateToolClearance(D, pWidth, 2);
  }

  return model;
}

export function solveChamfer(input) {
  const validation = validateChamferInput(input);
  if (!validation.valid) {
    return { valid: false, validation, model: null };
  }

  const params = normalizeChamferInput(input);
  const geometry = chamferGeometry(input.type, {
    width: input.width,
    angle: input.angle,
    tool: input.tool,
  });

  if (input.depth !== undefined && input.depth !== null && input.depth !== '') {
    geometry.profZ = input.depth;
    geometry.cotA = geometry.largX / geometry.profZ;
    if (input.type === 'internal') {
      geometry.chamfer.bottom = { x: -geometry.largX, z: -geometry.profZ };
    } else {
      geometry.chamfer.vertical = { x: 0, z: geometry.profZ };
    }
    geometry.trajectory = {
      start: geometry.trajectory.start,
      end: input.type === 'internal'
        ? { x: geometry.trajXEnd, z: -geometry.profZ }
        : { x: geometry.xCentro + geometry.profZ * geometry.cotA, z: geometry.profZ },
      safeZ: geometry.trajectory.safeZ,
    };
  }

  const strategy = buildPassStrategy(geometry, params);
  const trajectory = buildTrajectory(geometry, strategy);
  const model = assembleOperationModel(input.type, geometry, strategy, trajectory, params);

  if (model.nPasses > 200) {
    validation.warnings.push({
      code: 'WARN_MANY_PASSES',
      field: 'passeZ',
      message: 'Numero de passes alto (' + model.nPasses + ') — confira a profundidade por passe.',
    });
  }

  return { valid: true, validation, model };
}