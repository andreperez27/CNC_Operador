/**
 * Template IR canônico do chanfro (core).
 *
 * Constrói os blocos IR do programa Heidenhain a partir do MODELO
 * (geometria + estratégia + trajetória) — NUNCA a partir de sintaxe
 * de dialeto. O postprocessor faz a tradução para o texto .H.
 *
 * Os dois formatos reproduzem EXATAMENTE os templates de produção
 * validados:
 *
 *   EXTERNO  — loop compacto LBL 1 / FN 12 (referência:
 *              CHANFRO_EXT_RETO.H), com M90 e canto seguro:
 *                Q20 = Q30·Q4      (profundidade do passe)
 *                Q21 = Q10 + Q20·Q22  (X de contato)
 *   INTERNO  — chanfro no canto inferior do bolsão, com a mesma
 *              aritmética porém Q21 = Q10 − Q20·Q22.
 *
 * Os valores emitidos são arredondados com os MESMOS decimais dos
 * mapas Q (features/heidenhain/params/parameterEngine.js), garantindo
 * saída byte-idêntica aos templates legados para as mesmas entradas
 * (verificado por teste de regressão).
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

const EXTERNAL_MAP_DECIMALS = {
  A: 1, C: 3, D: 3, r: 3, seguranca: 1, L: 3,
  incReal: 3, xCentro: 3, xCorner: 3, cotA: 4, nPasses: 0, yTotal: 3,
};

const INTERNAL_MAP_DECIMALS = {
  A: 1, C: 3, profZ: 3, incReal: 3, largX: 3, Reff: 3, D: 3,
  nPasses: 0, L: 3, xCentro: 3, sobre: 3, yStart: 3, yEnd: 3,
  safeZ: 1, retrZ: 1, cotA: 4,
};

export function buildExternalChamferIR(model) {
  const p = model.params || {};
  const dec = EXTERNAL_MAP_DECIMALS;

  const a = roundTo(p.A, dec.A);
  const c = roundTo(p.C, dec.C);
  const d = roundTo(p.D, dec.D);
  const rq = roundTo(p.r, dec.r);
  const seg = roundTo(model.seguranca, dec.seguranca);
  const L = roundTo(p.L, dec.L);
  const inc = roundTo(model.incReal, dec.incReal);
  const xc = roundTo(model.xCentro, dec.xCentro);
  const xCorner = roundTo(model.xCorner, dec.xCorner);
  const cotA = roundTo(model.cotA, dec.cotA);
  const np = roundTo(model.nPasses, dec.nPasses);
  const yTotal = roundTo(model.yTotal, dec.yTotal);

  const rpm = p.rpm ?? 3000;
  const av = p.av ?? 600;
  const halfAv = Math.round(av * 0.5);
  const toolName = model.toolTypeName || 'Fresa Torica';
  const toolNumber = p.numeroFerramenta ?? 1;

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
    block(TYPES.COMMENT, { lines: ['ZERAMENTO OU DESLOCAMENTO - SEMPRE NO VERTICE DA REGIAO DO CHANFRO'] }),
    block(TYPES.COMMENT, { lines: ['CHANFRO EXTERNO - ARESTA RETA | GERADO PELO CNC OPERATOR'] }),
    block(TYPES.COMMENT, { lines: ['FRESAMENTO COM ' + toolName.toUpperCase()] }),
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
    block(TYPES.COMMENT, { lines: [''] }),
  ];

  if (blkDims) {
    blocks.push(block(TYPES.BLK_FORM, blkDims));
  }

  blocks.push(block(TYPES.TOOL_CALL, { tool: toolNumber, axis: 'Z', speed: rpm }));

  blocks.push(
    block(TYPES.COMMENT, { lines: ['----PARAMETROS DO CHANFRO--------'] }),
    block(TYPES.FN0, { param: '$1', value: a, decimals: intDecimals(a), label: 'ANGULO DO CHANFRO' }),
    block(TYPES.FN0, { param: '$2', value: c, decimals: intDecimals(c), label: 'LARGURA DO CHANFRO' }),
    block(TYPES.FN0, { param: '$3', value: d, decimals: intDecimals(d), label: 'DIA. DA FERRAMENTA' }),
    block(TYPES.FN0, { param: '$5', value: rq, decimals: intDecimals(rq), label: 'RAIO DA FERRAMENTA' }),
    block(TYPES.FN0, { param: '$11', value: seg, decimals: intDecimals(seg), label: 'DISTANCIA DE SEGURANCA DA PECA' }),
    block(TYPES.FN0, { param: '$33', value: L, decimals: intDecimals(L), label: 'COMPRIMENTO CHANFRO' }),
    block(TYPES.COMMENT, { lines: [';'.repeat(32)] }),
  );

  blocks.push(
    block(TYPES.DEFINE, { param: '$4', value: inc, decimals: 3, label: 'INCREMENTO POR PASSE' }),
    block(TYPES.DEFINE, { param: '$10', value: xc, decimals: 3, label: 'POS. X INICIAL EM Z0' }),
    block(TYPES.DEFINE, { param: '$12', value: xCorner, decimals: 3, label: 'POS. X DO CANTO SEGURO' }),
    block(TYPES.DEFINE, { param: '$22', value: cotA, decimals: 4, label: 'COTANGENTE DO ANGULO' }),
    block(TYPES.DEFINE, { param: '$31', value: np, decimals: 0, label: 'TOTAL DE PASSES' }),
    block(TYPES.DEFINE, { param: '$34', value: yTotal, decimals: 3, label: 'COMPRIMENTO TOTAL DO PASSE (Y)' }),
    block(TYPES.ASSIGN, { target: '$30', expression: '0', comment: 'CONTADOR DE PASSES' }),
    block(TYPES.COMMENT, { lines: [';'.repeat(32)] }),
  );

  blocks.push(
    block(TYPES.LABEL, { id: '1' }),
    block(TYPES.ASSIGN, { target: '$30', expression: '$30 + 1' }),
    block(TYPES.ASSIGN, { target: '$20', expression: '$30 * $4' }),
    block(TYPES.ASSIGN, { target: '$21', expression: '$10 + $20 * $22' }),
    block(TYPES.RAPID, { coords: { x: '$12', y: '$11' } }),
    block(TYPES.LINEAR, { coords: { z: '-$21' }, feed: halfAv, m90: true }),
    block(TYPES.LINEAR, { coords: { x: '$21' }, feed: av, m90: true }),
    block(TYPES.LINEAR, { coords: { y: '-$34' }, feed: av, m90: true }),
    block(TYPES.LINEAR, { coords: { x: '$12', iz: 1 }, feed: halfAv, m90: true }),
    block(TYPES.JUMP, { label: '1', condition: '$30 LT $31' }),
    block(TYPES.COMMENT, { lines: [''] }),
  );

  blocks.push(block(TYPES.SPINDLE_STOP, {}));

  return blocks;
}

export function buildInternalChamferIR(model) {
  const p = model.params || {};
  const dec = INTERNAL_MAP_DECIMALS;

  const a = roundTo(p.A, dec.A);
  const c = roundTo(p.C, dec.C);
  const pz = roundTo(model.profZ, dec.profZ);
  const inc = roundTo(model.incReal, dec.incReal);
  const lx = roundTo(model.largX, dec.largX);
  const reff = roundTo(model.Reff, dec.Reff);
  const d = roundTo(p.D, dec.D);
  const np = roundTo(model.nPasses, dec.nPasses);
  const L = roundTo(p.L, dec.L);
  const xc = roundTo(model.xCentro, dec.xCentro);
  const sob = roundTo(p.sobre ?? 0, dec.sobre);
  const ys = roundTo(model.yStart, dec.yStart);
  const ye = roundTo(model.yEnd, dec.yEnd);
  const safe = roundTo(model.safeZ, dec.safeZ);
  const retr = roundTo(model.retrZ, dec.retrZ);
  const cotA = roundTo(model.cotA, dec.cotA);

  const rpm = p.rpm ?? 3000;
  const av = p.av ?? 600;
  const halfAv = Math.round(av * 0.5);
  const toolName = model.toolTypeName || 'Fresa Torica';
  const pocketWidth = p.alojamentoLargura ?? 0;

  const block = (type, data) => createBlock(type, data);

  return [
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
    block(TYPES.COMMENT, { lines: ['CHANFRO INTERNO - CANTO INFERIOR DO BOLSAO'] }),
    block(TYPES.COMMENT, { lines: ['Fresamento com ' + toolName] }),
    block(TYPES.COMMENT, { lines: [''] }),
    block(TYPES.COMMENT, { lines: ['Gerado pelo CNC Operator - Heidenhain iTNC 530'] }),
    block(TYPES.COMMENT, { lines: [''] }),
    block(TYPES.COMMENT, { lines: ['ZERO PECA: parede do bolsao em X0, fundo em Z0'] }),
    block(TYPES.COMMENT, { lines: ['Bolsao largura ' + pocketWidth.toFixed(1) + ' mm, ferramenta D' + d.toFixed(1)] }),
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
    block(TYPES.COMMENT, { lines: [''] }),

    block(TYPES.SECTION, { title: 'Parametros Q' }),
    block(TYPES.DEFINE, { param: '$1', value: a, decimals: 1, label: 'Angulo do chanfro' }),
    block(TYPES.DEFINE, { param: '$2', value: c, decimals: 3, label: 'Largura do chanfro' }),
    block(TYPES.DEFINE, { param: '$3', value: pz, decimals: 3, label: 'Profundidade total Z' }),
    block(TYPES.DEFINE, { param: '$4', value: inc, decimals: 3, label: 'Incremento por passe' }),
    block(TYPES.DEFINE, { param: '$5', value: lx, decimals: 3, label: 'Largura projetada X' }),
    block(TYPES.DEFINE, { param: '$6', value: reff, decimals: 3, label: 'Raio efetivo da ferramenta' }),
    block(TYPES.DEFINE, { param: '$7', value: d, decimals: 3, label: 'Diametro da ferramenta' }),
    block(TYPES.DEFINE, { param: '$8', value: np, decimals: 0, label: 'Numero de passes' }),
    block(TYPES.DEFINE, { param: '$9', value: L, decimals: 3, label: 'Comprimento do bolsao' }),
    block(TYPES.DEFINE, { param: '$10', value: xc, decimals: 3, label: 'Posicao X inicial (centro ferramenta)' }),
    block(TYPES.DEFINE, { param: '$11', value: sob, decimals: 3, label: 'Sobremetal' }),
    block(TYPES.DEFINE, { param: '$12', value: ys, decimals: 3, label: 'Y inicio' }),
    block(TYPES.DEFINE, { param: '$13', value: ye, decimals: 3, label: 'Y fim' }),
    block(TYPES.DEFINE, { param: '$14', value: safe, decimals: 1, label: 'Altura de seguranca' }),
    block(TYPES.DEFINE, { param: '$15', value: retr, decimals: 1, label: 'Altura de retracao entre passes' }),
    block(TYPES.DEFINE, { param: '$22', value: cotA, decimals: 4, label: 'Cotangente do angulo (largX / profZ)' }),
    block(TYPES.COMMENT, { lines: [''] }),

    block(TYPES.SECTION, { title: 'Variaveis de controle' }),
    block(TYPES.ASSIGN, { target: '$30', expression: '0', comment: 'Contador de passes' }),
    block(TYPES.DEFINE, { param: '$31', value: np, decimals: 0, label: 'Total de passes' }),
    block(TYPES.COMMENT, { lines: [''] }),

    block(TYPES.SECTION, { title: 'Posicionamento inicial' }),
    block(TYPES.SPINDLE, { speed: rpm, direction: 'cw' }),
    block(TYPES.RAPID, { coords: { x: '$10', y: '$12' } }),
    block(TYPES.COMMENT, { lines: [''] }),

    block(TYPES.SECTION, { title: 'Ciclo de passes' }),
    block(TYPES.LABEL, { id: '1' }),
    block(TYPES.ASSIGN, { target: '$30', expression: '$30 + 1', comment: 'Incrementa contador', indent: true }),
    block(TYPES.ASSIGN, { target: '$20', expression: '$30 * $4', comment: 'Profundidade Z deste passe', indent: true }),
    block(TYPES.ASSIGN, { target: '$21', expression: '$10 - $20 * $22', comment: 'Posicao X para esta profundidade', indent: true }),
    block(TYPES.LINEAR, { coords: { x: '$21', z: '-$20' }, feed: halfAv, comment: 'Desce para profundidade', indent: true }),
    block(TYPES.LINEAR, { coords: { y: '$13' }, feed: av, comment: 'Usina ao longo do comprimento', indent: true }),
    block(TYPES.RAPID, { coords: { z: '$15' }, comment: 'Retrai para altura de retracao', indent: true }),
    block(TYPES.RAPID, { coords: { x: '$10' }, comment: 'Retorna X inicial', indent: true }),
    block(TYPES.RAPID, { coords: { y: '$12' }, comment: 'Retorna Y inicial', indent: true }),
    block(TYPES.JUMP, { label: '1', condition: '$30 LT $31', indent: true }),
    block(TYPES.COMMENT, { lines: [''] }),

    block(TYPES.SECTION, { title: 'Retorno seguro' }),
    block(TYPES.SPINDLE_STOP, {}),
    block(TYPES.COMMENT, { lines: [''] }),
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
    block(TYPES.COMMENT, { lines: ['Fim do programa'] }),
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
  ];
}

/** Programa Heidenhain completo (texto .H) a partir do modelo canônico. */
export function buildChamferProgram(model, options) {
  if (!model) return '; Erro: modelo invalido';

  const isInternal = model.type === 'internal' || model.chamfer?.top;
  const blocks = isInternal
    ? buildInternalChamferIR(model)
    : buildExternalChamferIR(model);

  const operationId = model.operationId
    || (isInternal ? 'chamferInternal' : 'chamferExternal');
  const programName = options?.programName || buildProgramName(operationId);

  return postprocess(blocks, null, model, programName);
}