/**
 * Validação da entrada do solver de Raio (canônico, core).
 *
 * Regras executadas na porta de entrada de `solveRadius` — nada é calculado
 * enquanto houver erro. Códigos estáveis:
 *
 *   INVALID_RADIUS        R ausente/<= 0/não numérica (NaN/Infinity)
 *   INVALID_TOOL_DIAMETER D ausente/<= 0/não numérica
 *   INVALID_TOOL_RADIUS   r < 0 ou r > D/2 (fresa tórica)
 *   INVALID_INCREMENT     incrZ ausente/<= 0/não numérica
 *   INVALID_RADIUS_RANGE  R < r — geometria impossível com fresa tórica
 *   INVALID_LENGTH        comprimento L ausente/<= 0
 *   INVALID_TOOL_TYPE     tipo de ferramenta incompatível com Raio
 *   INVALID_POCKET_WIDTH  largura do bolsão ausente/<= 0 (raio interno)
 *   INVALID_CLEARANCE     ferramenta não cabe no bolsão (raio interno)
 *   INVALID_FEED          avanço ausente/<= 0
 *   INVALID_SPINDLE_SPEED RPM ausente/<= 0
 *
 * Segurança (docs/RELATORIO_AUDITORIA_RAIO.md §5):
 *   1. NaN/±Infinity são bloqueados por `isFinitePositive`/`isFiniteNumber`.
 *   2. R < r é rejeitado de forma estruturada (canto da fresa maior que o
 *      raio desejado não usina a concavidade).
 *   3. incrZ <= 0 é bloqueado ANTES de gerar loop infinito (ceil(R/0)).
 *   4. No raio interno, o bolsão precisa ter largura > D + margem (mesma
 *      regra INVALID_CLEARANCE do chanfro interno).
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

export const RADIUS_TYPES = ['external', 'internal'];

const RADIUS_TOOL_TYPES = ['toroidal', 'endMill'];

const TOROIDAL = 'toroidal';

export function validateRadiusInput(input) {
  const v = createValidation();

  if (!input || typeof input !== 'object') {
    addError(v, 'INVALID_INPUT', null, 'Entrada invalida: objeto de parametros nao informado.');
    return finalize(v);
  }

  if (input.type && !RADIUS_TYPES.includes(input.type)) {
    addError(v, 'INVALID_TYPE', 'tipo',
      'Tipo de raio invalido (use external ou internal).');
  } else if (input.origin && !['vertex', 'corner'].includes(input.origin)) {
    addError(v, 'INVALID_ORIGIN', 'origem', 'Origem invalida (use vertex ou corner).');
  }

  guard(v, isFinitePositive(input.radius), 'INVALID_RADIUS', 'R',
    'Raio do arredondamento R deve ser um numero maior que zero.');

  const tool = input.tool;
  if (!tool || typeof tool !== 'object') {
    addError(v, 'INVALID_TOOL', 'toolType', 'Ferramenta nao informada.');
  } else {
    if (!RADIUS_TOOL_TYPES.includes(tool.type)) {
      addError(v, 'INVALID_TOOL_TYPE', 'toolType',
        'Tipo de ferramenta compatível com raio: toroidal ou endMill.');
    }
    guard(v, isFinitePositive(tool.diameter), 'INVALID_TOOL_DIAMETER', 'D',
      'Diametro da ferramenta deve ser maior que zero.');
    if (tool.type === TOROIDAL) {
      if (tool.radius === undefined || tool.radius === null || !isFiniteNumber(tool.radius) || tool.radius < 0) {
        addError(v, 'INVALID_TOOL_RADIUS', 'r',
          'Raio de canto r deve ser um numero maior ou igual a zero.');
      } else if (isFinitePositive(tool.diameter) && tool.radius > tool.diameter / 2) {
        addError(v, 'INVALID_TOOL_RADIUS', 'r',
          'Raio de canto r deve ser menor ou igual a D/2 (' + (tool.diameter / 2).toFixed(1) + ' mm).');
      }
    }
  }

  guard(v, isFinitePositive(input.strategy?.passDepth), 'INVALID_INCREMENT', 'incrZ',
    'Incremento por passe deve ser maior que zero (incrZ=0 trava o calculo).');

  if (isFinitePositive(input.radius)) {
    const rValid = tool?.type === TOROIDAL
      ? isFiniteNumber(tool.radius) && tool.radius >= 0
      : true;
    if (rValid) {
      const rUsed = tool?.type === TOROIDAL ? tool.radius : 0;
      if (input.radius < rUsed) {
        addError(v, 'INVALID_RADIUS_RANGE', 'r',
          'Raio do arredondamento R deve ser maior ou igual ao raio de canto r ('
          + 'R=' + input.radius.toFixed(1) + ', r=' + rUsed.toFixed(1) + ').');
      } else if (isFiniteNumber(rUsed) && input.radius === rUsed) {
        addWarning(v, 'WARN_R_EQUALS_R', 'R',
          'R = r: limite de usinagem com fresa torica — a tangencia e degenerada.');
      }
    }
  }

  guard(v, isFinitePositive(input.length), 'INVALID_LENGTH', 'L',
    'Comprimento da aresta deve ser maior que zero.');

  guard(v, isFinitePositive(input.feed), 'INVALID_FEED', 'av',
    'Avanco deve ser maior que zero.');
  guard(v, isFinitePositive(input.rpm), 'INVALID_SPINDLE_SPEED', 'rpm',
    'RPM deve ser maior que zero.');

  if (input.type === 'internal') {
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