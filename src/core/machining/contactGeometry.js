/**
 * Geometria de contato ferramenta/superfície (canônico, core).
 *
 * Define a posição do CENTRO da ferramenta a partir de um ponto de
 * contato sobre o chanfro:  Ct = Pc + n_efetiva · Reff.
 *
 * Para superfícies côncavas (chanfro interno) a normal geométrica é
 * invertida (`convexity='concave'`), pois o centro fica do outro lado
 * do ponto de contato em relação à superfície externa.
 *
 * A validação `validateContact` confere a distância centro→contato
 * contra Reff (tolerância 0,001 mm).
 */

import { tangentCenter, validateTangency } from '../geometry/circleLine';

export function buildContactGeometry(contactPoint, normal, tangent, Reff, convexity) {
  const conv = convexity || 'convex';
  const effectiveNormal = conv === 'concave'
    ? { x: -normal.x, z: -normal.z }
    : normal;
  const toolCenter = tangentCenter(contactPoint, effectiveNormal, Reff);
  return {
    contactPoint,
    surfaceNormal: normal,
    surfaceTangent: tangent,
    toolCenter,
    toolRadius: Reff,
    convexity: conv,
  };
}

export function validateContact(geo) {
  const result = validateTangency(geo.toolCenter, geo.contactPoint, geo.toolRadius);
  return {
    ...result,
    message: result.valid
      ? `OK: dist = ${result.distance.toFixed(4)} = Reff = ${result.expected.toFixed(4)}`
      : `ERRO: dist = ${result.distance.toFixed(4)} != Reff = ${result.expected.toFixed(4)} (dif = ${result.error.toFixed(6)})`,
  };
}