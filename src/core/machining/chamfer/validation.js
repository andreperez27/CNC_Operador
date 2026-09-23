/**
 * Validação da entrada do solver de chanfro (canônico).
 *
 * Regras executadas na porta de entrada de `solveChamfer` — nada é
 * calculado enquanto houver erro. Códigos estáveis:
 *
 *   INVALID_TYPE           tipo desconhecido (não é external/internal)
 *   INVALID_WIDTH          largura C ausente/<= 0/não numérica
 *   INVALID_ANGLE          ângulo A ausente/<= 0/>= 90 (A=0 → Infinity)
 *   INVALID_DEPTH          profundidade override <= 0
 *   INVALID_PASS_DEPTH     passeZ <= 0 (evita loop infinito/OOM)
 *   INVALID_TOOL_TYPE      tipo de ferramenta desconhecido
 *   INVALID_TOOL_DIAMETER  D ausente/<= 0
 *   INVALID_TOOL_RADIUS    r < 0 ou r > D/2 (fresa tórica)
 *   INVALID_LENGTH         comprimento L ausente/<= 0
 *   INVALID_POCKET_WIDTH   largura do bolsão ausente/<= 0 (interno)
 *   INVALID_CLEARANCE      ferramenta não cabe no bolsão (interno)
 *   INVALID_SPINDLE_SPEED  RPM ausente/<= 0
 *   INVALID_FEED           avanço ausente/<= 0
 *
 * A mensagem de INVALID_CLEARANCE é a MESMA de `validateToolClearance`
 * (mantida por compatibilidade com o comportamento atual do chanfro
 * interno, que lança essa mensagem).
 */

import {
  createValidation,
  addError,
  addWarning,
  guard,
  finalize,
  isFinitePositive,
  isFiniteNumber,
} from '../../validation/validationEngine';
import { isKnownToolType, getToolType } from '../../tools/toolTypes';
import { toRad } from '../../geometry/angle';

export const CHAMFER_TYPES = ['external', 'internal'];

export function validateChamferInput(input) {
  const v = createValidation();

  if (!input || typeof input !== 'object') {
    addError(v, 'INVALID_INPUT', null, 'Entrada invalida: objeto de parametros nao informado.');
    return finalize(v);
  }

  const type = input.type;
  if (!CHAMFER_TYPES.includes(type)) {
    addError(v, 'INVALID_TYPE', 'tipo', 'Tipo de chanfro invalido (use external ou internal).');
  } else if (input.origin && !['vertex', 'corner'].includes(input.origin)) {
    addError(v, 'INVALID_ORIGIN', 'origem', 'Origem invalida (use vertex ou corner).');
  }

  guard(v, isFinitePositive(input.width), 'INVALID_WIDTH', 'C',
    'Largura do chanfro deve ser um numero maior que zero.');

  const angle = input.angle;
  if (!isFiniteNumber(angle)) {
    addError(v, 'INVALID_ANGLE', 'A', 'Angulo do chanfro deve ser um numero.');
  } else if (angle <= 0 || angle >= 90) {
    addError(v, 'INVALID_ANGLE', 'A',
      'Angulo deve estar entre 0° e 90° (0° tornaria o X da ferramenta infinito).');
  } else if (angle < 10) {
    addWarning(v, 'WARN_SMALL_ANGLE', 'A',
      'Angulo pequeno: o centro da ferramenta fica muito afastado da aresta '
      + '(X inicial grande). Confira a folga da maquina.');
  }

  if (input.depth !== undefined && input.depth !== null && input.depth !== '') {
    if (!isFinitePositive(input.depth)) {
      addError(v, 'INVALID_DEPTH', 'profundidade',
        'Profundidade total deve ser um numero maior que zero.');
    } else if (isFinitePositive(input.width) && isFiniteNumber(angle) && angle > 0 && angle < 90) {
      const natural = input.width * Math.sin(toRad(angle));
      if (Math.abs(input.depth - natural) > 0.01) {
        addWarning(v, 'WARN_DEPTH_OVERRIDE', 'profundidade',
          'Profundidade informada difere de C·sen(A) = ' + natural.toFixed(3)
          + ' mm — o angulo efetivo do chanfro sera '
          + (Math.atan(input.depth / (input.width * Math.cos(toRad(angle)))) * 180 / Math.PI).toFixed(2) + '°.');
      }
    }
  }

  guard(v, isFinitePositive(input.strategy?.passDepth), 'INVALID_PASS_DEPTH', 'passeZ',
    'Profundidade por passe deve ser maior que zero (passeZ=0 trava o calculo).');

  const tool = input.tool;
  if (!tool || typeof tool !== 'object') {
    addError(v, 'INVALID_TOOL', 'toolType', 'Ferramenta nao informada.');
  } else {
    guard(v, isKnownToolType(tool.type), 'INVALID_TOOL_TYPE', 'toolType',
      'Tipo de ferramenta desconhecido.');
    guard(v, isFinitePositive(tool.diameter), 'INVALID_TOOL_DIAMETER', 'D',
      'Diametro da ferramenta deve ser maior que zero.');
    if (tool.radius !== undefined && tool.radius !== null) {
      if (!isFiniteNumber(tool.radius) || tool.radius < 0) {
        addError(v, 'INVALID_TOOL_RADIUS', 'r',
          'Raio de canto deve ser um numero maior ou igual a zero.');
      } else if (isKnownToolType(tool.type)
        && getToolType(tool.type).id === 'toroidal'
        && isFinitePositive(tool.diameter)
        && tool.radius > tool.diameter / 2) {
        addError(v, 'INVALID_TOOL_RADIUS', 'r',
          'Raio de canto r deve ser menor ou igual a D/2 ('
          + (tool.diameter / 2).toFixed(1) + ' mm).');
      }
    }
  }

  guard(v, isFinitePositive(input.length), 'INVALID_LENGTH', 'L',
    'Comprimento do chanfro deve ser maior que zero.');

  guard(v, isFinitePositive(input.feed), 'INVALID_FEED', 'av',
    'Avanco deve ser maior que zero.');
  guard(v, isFinitePositive(input.rpm), 'INVALID_SPINDLE_SPEED', 'rpm',
    'RPM deve ser maior que zero.');

  if (type === 'internal') {
    const pocketWidth = input.clearance?.pocketWidth;
    if (!isFinitePositive(pocketWidth)) {
      addError(v, 'INVALID_POCKET_WIDTH', 'alojamentoLargura',
        'Largura do bolsao deve ser maior que zero.');
    } else if (isFinitePositive(input.tool?.diameter)) {
      const CLEARANCE_MARGIN = 2;
      const required = input.tool.diameter + CLEARANCE_MARGIN;
      if (pocketWidth < required) {
        addError(v, 'INVALID_CLEARANCE', 'alojamentoLargura',
          'Ferramenta D' + input.tool.diameter.toFixed(1)
          + ' nao cabe no espaco ' + pocketWidth.toFixed(1)
          + ' (necessario ' + required.toFixed(1) + ' com margem '
          + CLEARANCE_MARGIN.toFixed(1) + ')');
      }
    }
  }

  return finalize(v);
}