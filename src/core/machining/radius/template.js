/**
 * Template IR canônico do Raio (core).
 *
 * Constrói os blocos IR do programa Heidenhain a partir do MODELO
 * (geometria + estratégia + trajetória) — NUNCA a partir de sintaxe de
 * dialeto. O postprocessor faz a tradução para o texto .H.
 *
 * NUMERAÇÃO DOS Q — fiel à planilha de setor (bloco linhas 17–24):
 *   Q1 = R          raio do arredondamento
 *   Q2 = D          diâmetro da ferramenta
 *   Q3 = r          raio de canto da ferramenta
 *   Q4 = Xc         X inicial da ferramenta em Z=0
 *   Q5 = incReal    incremento por passe
 *   Q6 = (no laço)  X do centro na profundidade — deslocamento em X
 *   Q22 = 2·(R+r)   diâmetro do círculo da trajetória
 *
 * ARITMÉTICA DO LAÇO (reproduz Q6 da planilha, SEM trigonometria):
 *   Q20 = Q30·Q5                          profundidade do passe
 *   Q21 = Q4 ± SQRT(Q20·Q22 − Q20·Q20)    X do centro (Q6(z))
 *   — equivalente algébrica exata de
 *     SQRT((R+r)² − ((R+r)−z)²) + (D/2 − r) − R   com z = Q20, 2·(R+r) = Q22
 *   onde '+' é o raio EXTERNO (X crescente) e '−' o raio INTERNO (X decrescente,
 *   espelho em X — docs/COORDINATE_SYSTEM.md).
 *
 * ESQUELETO POR PASSE (mesmo do chanfro externo aprovado): rápido ao canto
 * seguro (X = Q12 = Q4 − seguranca), mergulho Z, deslocamento X+Q21,
 * varredura Y−Q34, retração diagonal X+Q12 IZ+1.
 *
 * Os valores emitidos são arredondados com os MESMOS decimais dos mapas Q
 * das features (formatos do projeto).
 */

import { createBlock, TYPES } from '../../program/types';
import { postprocess } from '../../postprocessors/heidenhain';
import { buildProgramName } from '../../postprocessors/programName';

function isBlank(v) {
  return v === '' || v === undefined || v === null || Number.isNaN(v);
}

function intDecimals(v) {
  return Number.isInteger(v) ? 0 : 3;
}

function roundTo(v, decimals) {
  return Number(v.toFixed(decimals));
}

const RADIUS_MAP_DECIMALS = {
  R: 1,
  D: 3,
  r: 3,
  seguranca: 1,
  L: 3,
  incReal: 3,
  xCenter: 3,
  xCorner: 3,
  twoRho: 3,
  nPasses: 0,
  yTotal: 3,
};

export function buildRadiusIR(model) {
  const p = model.params || {};
  const dec = RADIUS_MAP_DECIMALS;
  const isInternal = model.type === 'internal';

  const R = roundTo(p.R, dec.R);
  const d = roundTo(p.D, dec.D);
  const rq = roundTo(p.r, dec.r);
  const seg = roundTo(model.seguranca, dec.seguranca);
  const L = roundTo(p.L, dec.L);
  const inc = roundTo(model.incReal, dec.incReal);
  const xc = roundTo(model.xCenter, dec.xCenter);
  const xCorner = roundTo(model.xCorner, dec.xCorner);
  const twoRho = roundTo(2 * model.rho, dec.twoRho);
  const np = roundTo(model.nPasses, dec.nPasses);
  const yTotal = roundTo(model.yTotal, dec.yTotal);

  const rpm = p.rpm ?? 3000;
  const av = p.av ?? 600;
  const halfAv = Math.round(av * 0.5);
  const toolName = 'Fresa Torica';
  const toolNumber = p.numeroFerramenta ?? 1;
  const radiusName = isInternal ? 'INTERNO' : 'EXTERNO';

  const { blocoW, blocoL, blocoH } = p;
  const hasBlk = [blocoW, blocoL, blocoH].some((v) => !isBlank(v));
  const blkDims = hasBlk
    ? {
        w: isBlank(blocoW) ? 100 : Number(blocoW),
        l: isBlank(blocoL) ? 100 : Number(blocoL),
        h: isBlank(blocoH) ? 100 : Number(blocoH),
      }
    : null;

  const block = (type, data) => createBlock(type, data);

  const blocks = [
    block(TYPES.COMMENT, { lines: ['ZERAMENTO OU DESLOCAMENTO - SEMPRE NO VERTICE DA REGIAO DO RAIO'] }),
    block(TYPES.COMMENT, { lines: ['RAIO ' + radiusName + ' - ARESTA RETA | GERADO PELO CNC OPERATOR'] }),
    block(TYPES.COMMENT, { lines: ['FRESAMENTO COM ' + toolName.toUpperCase()] }),
    block(TYPES.COMMENT, { lines: ['RAIO DA TRAJETORIA DO CENTRO = R + r = ' + model.rho.toFixed(3) + ' mm'] }),
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
    block(TYPES.COMMENT, { lines: [''] }),
  ];

  if (blkDims) {
    blocks.push(block(TYPES.BLK_FORM, blkDims));
  }

  blocks.push(block(TYPES.TOOL_CALL, { tool: toolNumber, axis: 'Z', speed: rpm }));

  blocks.push(
    block(TYPES.COMMENT, { lines: ['----PARAMETROS DO RAIO--------'] }),
    block(TYPES.FN0, { param: '$1', value: R, decimals: intDecimals(R), label: 'RAIO DE ARREDONDAMENTO' + (isInternal ? ' (BOLSAO)' : '') }),
    block(TYPES.FN0, { param: '$2', value: d, decimals: intDecimals(d), label: 'DIA. DA FERRAMENTA' }),
    block(TYPES.FN0, { param: '$3', value: rq, decimals: intDecimals(rq), label: 'RAIO DE CANTO DA FERRAMENTA' }),
    block(TYPES.FN0, { param: '$4', value: xc, decimals: intDecimals(xc), label: 'X INICIAL FERRAMENTA EM Z0' }),
    block(TYPES.FN0, { param: '$5', value: inc, decimals: intDecimals(inc), label: 'INCREMENTO POR PASSE (Z)' }),
    block(TYPES.FN0, { param: '$11', value: seg, decimals: intDecimals(seg), label: isInternal ? 'DIST. DE SEGURANCA DA PAREDE DO BOLSAO' : 'DISTANCIA DE SEGURANCA DA PECA' }),
    block(TYPES.FN0, { param: '$33', value: L, decimals: intDecimals(L), label: 'COMPRIMENTO DA ' + (isInternal ? 'BOLSAO' : 'ARESTA') }),
    block(TYPES.COMMENT, { lines: [';'.repeat(32)] }),
  );

  blocks.push(
    block(TYPES.DEFINE, { param: '$12', value: xCorner, decimals: 3, label: isInternal ? 'POS. X DO CANTO SEGURO (BOLSAO)' : 'POS. X DO CANTO SEGURO' }),
    block(TYPES.DEFINE, { param: '$22', value: twoRho, decimals: 3, label: 'DIA. DO CIRCULO DA TRAJETORIA (2 x (R + r))' }),
    block(TYPES.DEFINE, { param: '$31', value: np, decimals: 0, label: 'TOTAL DE PASSES' }),
    block(TYPES.DEFINE, { param: '$34', value: yTotal, decimals: 3, label: 'COMPRIMENTO TOTAL DO PASSE (Y)' }),
    block(TYPES.ASSIGN, { target: '$30', expression: '0', comment: 'CONTADOR DE PASSES' }),
    block(TYPES.COMMENT, { lines: [';'.repeat(32)] }),
  );

  blocks.push(
    block(TYPES.LABEL, { id: '1' }),
    block(TYPES.ASSIGN, { target: '$30', expression: '$30 + 1' }),
    block(TYPES.ASSIGN, { target: '$20', expression: '$30 * $5' }),
    block(TYPES.ASSIGN, { target: '$21', expression: '$4 ' + (isInternal ? '-' : '+') + ' SQRT($20 * $22 - $20 * $20)' }),
    block(TYPES.RAPID, { coords: { x: '$12', y: '$11' } }),
    block(TYPES.LINEAR, { coords: { z: '-$20' }, feed: halfAv, m90: true }),
    block(TYPES.LINEAR, { coords: { x: '$21' }, feed: av, m90: true }),
    block(TYPES.LINEAR, { coords: { y: '-$34' }, feed: av, m90: true }),
    block(TYPES.LINEAR, { coords: { x: '$12', iz: 1 }, feed: halfAv, m90: true }),
    block(TYPES.JUMP, { label: '1', condition: '$30 LT $31' }),
    block(TYPES.COMMENT, { lines: [''] }),
  );

  blocks.push(block(TYPES.SPINDLE_STOP, {}));

  return blocks;
}

/** Programa Heidenhain completo (texto .H) a partir do modelo canônico. */
export function buildRadiusProgram(model, options) {
  if (!model) return '; Erro: modelo invalido';

  const blocks = buildRadiusIR(model);
  const operationId = model.operationId || 'radiusExternal';
  const programName = options?.programName || buildProgramName(operationId);

  return postprocess(blocks, null, model, programName);
}