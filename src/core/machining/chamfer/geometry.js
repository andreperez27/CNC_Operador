/**
 * Geometria do chanfro (canônico, core).
 *
 * Função pura: `chamferGeometry(type, { width, angle, tool })` →
 * modelo geométrico do chanfro externo ou interno, SEM estratégia
 * (passes) e SEM G-Code. A trajetória da ferramenta é derivada deste
 * modelo pelas camadas strategy/trajectory/template.
 *
 * As fórmulas reproduzem EXATAMENTE os motores validados de produção
 * (ver docs/CURRENT_FUNCTIONAL_INVENTORY.md, testes T1–T13):
 *
 * EXTERNO (origem: aresta X0 / topo Z0):
 *   profZ = C·sen(A)        profundidade do chanfro
 *   largX = C·cos(A)        largura projetada em X
 *   cotA  = largX/profZ     cotangente (passo X por mm de Z)
 *   Reff  = raio efetivo da ferramenta no contato
 *   xCentro = −largX + Reff/sen(A)     (X do centro no topo, Z0)
 *
 * INTERNO (origem: canto do bolsão, parede X0 / fundo Z0):
 *   xCentro  = sen(A)·Reff              (X do centro no topo do chanfro)
 *   trajXEnd = −largX + sen(A)·Reff     (X do centro no pé do chanfro)
 *   — contato usa normal invertida (concave), centro afasta-se da
 *     parede conforme a profundidade cresce.
 *
 * Valores de referência A=45°, C=5, D=16, r=0,8:
 *   EXT: profZ=3,535534  largX=3,535534  cotA=1  Reff=0,8
 *        xCentro=−2,404163  → passe final X=+1,131371
 *   INT: xCentro=+0,565685  trajXEnd=−2,969848
 */

import { getToolType } from '../../tools/toolTypes';
import { buildContactGeometry, validateContact } from '../contactGeometry';
import { toRad, normalFromAngle, tangentFromAngle } from '../../geometry/angle';

export function chamferGeometry(type, input) {
  const { width: C, angle: A, tool } = input;
  const angRad = toRad(A);

  const profZ = C * Math.sin(angRad);
  const largX = C * Math.cos(angRad);
  const cotA = largX / profZ;

  const toolInfo = getToolType(tool.type);
  const Reff = toolInfo.getReff(tool.diameter, tool.radius);
  const toolCornerR = tool.type === 'ballNose' ? tool.diameter / 2 : tool.radius;

  if (type === 'internal') {
    const chMidX = -largX / 2;
    const chMidZ = -profZ / 2;
    const geoNormal = { x: -Math.sin(angRad), z: -Math.cos(angRad) };
    const tangent = { x: Math.cos(angRad), z: Math.sin(angRad) };

    const contactGeo = buildContactGeometry(
      { x: chMidX, z: chMidZ },
      geoNormal,
      tangent,
      Reff,
      'concave'
    );

    const xCentro = Math.sin(angRad) * Reff;
    const trajXEnd = -largX + Math.sin(angRad) * Reff;

    return {
      type,
      toolType: toolInfo.id,
      toolTypeName: toolInfo.name,
      toolCornerR,
      profZ,
      largX,
      angRad,
      cotA,
      Reff,
      xCentro,
      trajXEnd,
      chamfer: {
        top: { x: 0, z: 0 },
        bottom: { x: -largX, z: -profZ },
        midpoint: { x: chMidX, z: chMidZ },
      },
      contact: contactGeo,
      contactValidation: validateContact(contactGeo),
      tangency: {
        center: { x: contactGeo.toolCenter.x, z: contactGeo.toolCenter.z },
        radius: Reff,
        point: { x: chMidX, z: chMidZ },
      },
      trajectory: {
        start: { x: xCentro, z: 5 },
        end: { x: trajXEnd, z: -profZ },
        safeZ: 5,
      },
    };
  }

  const chVert = { x: 0, z: profZ };
  const chHorz = { x: -largX, z: 0 };
  const chMidX = -largX / 2;
  const chMidZ = profZ / 2;

  const contactGeo = buildContactGeometry(
    { x: chMidX, z: chMidZ },
    normalFromAngle(angRad),
    tangentFromAngle(angRad),
    Reff
  );

  const xCentro = -largX + Reff / Math.sin(angRad);

  return {
    type,
    toolType: toolInfo.id,
    toolTypeName: toolInfo.name,
    toolCornerR,
    profZ,
    largX,
    angRad,
    cotA,
    Reff,
    xCentro,
    chamfer: {
      vertical: chVert,
      horizontal: chHorz,
      midpoint: { x: chMidX, z: chMidZ },
    },
    contact: contactGeo,
    contactValidation: validateContact(contactGeo),
    tangency: {
      center: { x: contactGeo.toolCenter.x, z: contactGeo.toolCenter.z },
      radius: Reff,
      point: { x: chMidX, z: chMidZ },
    },
    trajectory: {
      start: { x: xCentro, z: -5 },
      end: { x: xCentro + profZ * cotA, z: profZ },
      safeZ: 5,
    },
  };
}