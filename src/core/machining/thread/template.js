/**
 * Template IR canônico da rosca (core).
 *
 * Constrói os blocos IR do programa Heidenhain a partir do MODELO
 * (estratégia + trajetória) — NUNCA a partir de sintaxe de dialeto.
 * O postprocessor faz a tradução para o texto .H.
 *
 * ESTRUTURA (mesma filosofia do referencial real `CHANFRO EXT RETO.H`):
 *
 *   RIGID    comentários -> TOOL CALL -> posiciona centro -> CYCL DEF 207
 *            -> CYCL CALL -> retorno seguro M30
 *   HELICAL  comentários -> TOOL CALL -> centro -> liga fuso -> raio ->
 *            voltas HELIX (CP/CC) -> retorno -> M30
 *
 * DECISÕES:
 *   - BLK FORM é opcional via `model.stockDims` (input.stock). Para uma
 *     operação de furo único ela não é obrigatória; fica disponível por API
 *     (documentado em docs/CURRENT_FUNCTIONAL_INVENTORY.md, F31/F33).
 *   - Ciclo 207: parâmetros Q335/Q358/Q359/Q254 preservam o template de
 *     produção da fábrica (roscaRigida legado); Q200 (segurança) e Q203
 *     (superfície) seguem o manual iTNC e usam os parâmetros do operador.
 */

import { createBlock, TYPES } from '../../program/types';
import { postprocess } from '../../postprocessors/heidenhain';
import { buildProgramName } from '../../postprocessors/programName';

function fmt(v) {
  return String(Number(v.toFixed(2))).replace('.', ',');
}

export function buildThreadIR(model) {
  const t = model.thread;
  const p = model.params;
  const s = model.strategy;
  const block = (type, data) => createBlock(type, data);
  const blocks = [];

  const header = model.method === 'rigid'
    ? 'ROSCA ' + model.designation + ' - CYCL DEF 207 (ROSCA RIGIDA)'
    : 'ROSCA ' + model.designation + ' - INTERPOLACAO HELICOIDAL';

  blocks.push(block(TYPES.COMMENT, { lines: ['='.repeat(60)] }));
  blocks.push(block(TYPES.COMMENT, { lines: [header] }));
  blocks.push(block(TYPES.COMMENT, { lines: ['Gerado pelo CNC Operator - Heidenhain iTNC 530'] }));
  blocks.push(block(TYPES.COMMENT, { lines: ['Pre-furo: Ø' + fmt(t.hole) + ' mm | Passo: ' + fmt(t.pitch) + ' mm'] }));
  blocks.push(block(TYPES.COMMENT, { lines: ['Prof. rosca: ' + fmt(model.depth) + ' mm'] }));
  if (model.holeRuleProvided) {
    const rule = model.holeRule ? model.holeRule.formula : 'sugestao';
    blocks.push(block(TYPES.COMMENT, {
      lines: ['Furo cego: prof. ' + fmt(model.holeDepth) + ' mm — regra de processo ' + rule
        + (model.holeMargin > 0 ? ' + margem ' + fmt(model.holeMargin) + ' mm' : '')],
    }));
  }
  if (model.method === 'rigid') {
    blocks.push(block(TYPES.COMMENT, { lines: ['Avanco (auto): ' + Math.round(s.feed) + ' mm/min'] }));
  } else {
    blocks.push(block(TYPES.COMMENT, { lines: ['Fresa: Ø' + fmt(s.toolDiameter) + ' mm | Raio interp: ' + fmt(s.radius) + ' mm'] }));
    blocks.push(block(TYPES.COMMENT, { lines: ['Voltas: ' + s.nPasses + ' | Sentido: ' + (s.direction === 'cw' ? 'horario' : 'anti-horario')] }));
  }
  blocks.push(block(TYPES.COMMENT, { lines: [''] }));

  if (model.stockDims) {
    blocks.push(block(TYPES.BLK_FORM, model.stockDims));
  }

  blocks.push(block(TYPES.TOOL_CALL, { tool: p.toolNumber, axis: 'Z', speed: p.rpm }));

  if (model.method === 'rigid') {
    blocks.push(
      block(TYPES.COMMENT, { lines: ['----ROSCA RIGIDA - CYCL DEF 207--------'] }),
      block(TYPES.RAPID, { coords: { x: '0', y: '0' }, comment: 'Centro do furo (furação prévia pronta)' }),
      block(TYPES.CYCLE_DEF, {
        cycle: 207,
        title: 'ROSCA RIGIDA',
        params: [
          { q: 200, value: p.safety, decimals: 1, label: 'DIST. SEGURANCA' },
          { q: 203, value: p.zStart, decimals: 3, label: 'SUPERFICIE PECA' },
          { q: 335, value: t.hole, decimals: 3, label: 'DIAMETRO NOMINAL' },
          { q: 239, value: t.pitch, decimals: 3, label: 'PASSO' },
          { q: 201, value: -p.depth, decimals: 3, label: 'PROFUNDIDADE ROSCA' },
          { q: 253, value: 750, decimals: 0, label: 'VEL.POSICIONAMENTO' },
          { q: 358, value: 0, decimals: 0, label: 'SENTIDO ROTACAO AO ENTRAR' },
          { q: 359, value: 0, decimals: 0, label: 'SENTIDO ROTACAO AO SAIR' },
          { q: 254, value: 0, decimals: 0, label: 'ESPERA NO FUNDO' },
        ],
      }),
      block(TYPES.CYCLE_CALL, { spindle: 'M3' }),
      block(TYPES.COMMENT, { lines: [''] }),
    );
  } else {
    blocks.push(
      block(TYPES.COMMENT, { lines: ['----INTERPOLACAO HELICOIDAL--------'] }),
      block(TYPES.RAPID, { coords: { x: '0', y: '0' }, comment: 'Centro do furo' }),
      block(TYPES.RAPID, {
        coords: { z: p.zStart + p.safety },
        mcode: s.direction === 'cw' ? 'M3' : 'M4',
        comment: 'Liga fuso na altura de seguranca',
      }),
      block(TYPES.LINEAR, {
        coords: { x: s.radius },
        feed: s.entryFeed,
        comment: 'Desloca ao raio de interpolacao (ponto tangente)',
      }),
      block(TYPES.COMMENT, { lines: ['Entrada + usinagem helicoidal (' + s.nPasses + ' volta(s) de 360°)'] }),
    );

    for (let i = 0; i < s.nPasses; i++) {
      blocks.push(block(TYPES.HELIX, {
        center: { x: '0', y: '0' },
        angle: s.direction === 'cw' ? -360 : 360,
        zStep: -t.pitch,
        direction: s.direction,
        feed: p.feed,
        comment: i === 0 ? 'Entrada' : null,
      }));
    }

    blocks.push(
      block(TYPES.LINEAR, { coords: { x: '0' }, feed: p.feed, comment: 'Retorno ao centro' }),
      block(TYPES.COMMENT, { lines: [''] }),
    );
  }

  blocks.push(block(TYPES.SPINDLE_STOP, {}));
  blocks.push(block(TYPES.COMMENT, { lines: [''] }));
  blocks.push(block(TYPES.COMMENT, { lines: ['='.repeat(60)] }));
  blocks.push(block(TYPES.COMMENT, { lines: ['Fim do programa'] }));
  blocks.push(block(TYPES.COMMENT, { lines: ['='.repeat(60)] }));

  return blocks;
}

/** Programa Heidenhain completo (texto .H) a partir do modelo canônico. */
export function buildThreadProgram(model, options) {
  if (!model) return '; Erro: modelo invalido';
  const blocks = buildThreadIR(model);
  const programName = options?.programName || buildProgramName(model.operationId);
  return postprocess(blocks, null, model, programName);
}