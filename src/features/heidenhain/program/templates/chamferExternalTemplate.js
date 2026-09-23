import { createBlock, TYPES } from '../../../../core/program/types';
import { postprocess } from '../../../../core/postprocessors/heidenhain';

/*
 * ═══════════════════════════════════════════════════════════════════
 *  CHANFRO EXTERNO — LOOP COMPACTO COM ESTRATEGIA REAL DE PRODUCAO
 *  (referencia: CHANFRO_EXT_RETO.H)
 * ═══════════════════════════════════════════════════════════════════
 *
 *  ZERO PECA: vertice da regiao do chanfro (aresta em X0, topo em Z0).
 *  O material bruto estende-se para -X, -Y e -Z.
 *
 *  LOOP COMPACTO (LBL 1 / FN 12) — aritmetica simples, sem TAN/SIN/COS:
 *    Q30 = Q30 + 1           contador de passes
 *    Q20 = Q30 * Q4          profundidade do passe (Q4 = incremento do motor)
 *    Q21 = Q10 + Q20 * Q22   X de contato (Q10 = X inicial, Q22 = cotangente)
 *
 *  Isso NAO recalcula a geometria: Q4, Q10 e Q22 ja sao constantes
 *  calculadas pelo motor em JavaScript (chamferExternalMath.js +
 *  strategyEngine.js); o loop apenas repete soma/multiplicacao.
 *
 *  SEQUENCIA DE MOVIMENTO POR PASSE (dentro do loop):
 *    a. Reposiciona no canto seguro em X e Y, rapido (FMAX)
 *    b. Desce reto em Z ate a profundidade do passe, com feed e M90
 *    c. Avanca em X ate o ponto de contato do chanfro, com feed e M90
 *    d. Usina ao longo do comprimento em Y, com feed e M90
 *    e. Recua em diagonal (X de volta ao canto seguro + alivio IZ+1),
 *       com feed e M90 (NAO FMAX)
 *
 *  Q30 = contador, Q31 = total de passes; FN 12: IF +Q30 LT +Q31 GOTO LBL 1
 * ═══════════════════════════════════════════════════════════════════
 */

function isBlank(v) {
  return v === '' || v === undefined || v === null || Number.isNaN(v);
}

function intDecimals(v) {
  return Number.isInteger(v) ? 0 : 3;
}

function buildIR(qParams, model) {
  const {
    Q1: a, Q2: c, Q3: d, Q4: inc, Q5: rq, Q10: xc,
    Q11: seg, Q12: xCorner, Q22: cotA, Q31: np, Q33: L, Q34: yTotal,
  } = Object.fromEntries(
    Object.entries(qParams.obj).map(([k, v]) => [k, v.value])
  );

  const rpm = model.params?.rpm ?? 3000;
  const av = model.params?.av ?? 600;
  const halfAv = Math.round(av * 0.5);
  const toolName = model.toolTypeName || 'Fresa Torica';
  const toolNumber = model.params?.numeroFerramenta ?? 1;

  // BLK FORM opcional: so emite se ao menos um campo for preenchido;
  // campos faltantes recebem defaults razoaveis.
  const { blocoW, blocoL, blocoH } = model.params || {};
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
    // ── Header ──
    block(TYPES.COMMENT, { lines: ['ZERAMENTO OU DESLOCAMENTO - SEMPRE NO VERTICE DA REGIAO DO CHANFRO'] }),
    block(TYPES.COMMENT, { lines: ['CHANFRO EXTERNO - ARESTA RETA | GERADO PELO CNC OPERATOR'] }),
    block(TYPES.COMMENT, { lines: ['FRESAMENTO COM ' + toolName.toUpperCase()] }),
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
    block(TYPES.COMMENT, { lines: [''] }),
  ];

  // ── Stock envelope (opcional) ──
  if (blkDims) {
    blocks.push(block(TYPES.BLK_FORM, blkDims));
  }

  // ── Tool call ──
  blocks.push(block(TYPES.TOOL_CALL, { tool: toolNumber, axis: 'Z', speed: rpm }));

  // ── Literal inputs (FN 0) ──
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

  // ── Computed constants (motor JS — emitidos prontos) ──
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

  // ── Pass cycle (loop compacto) ──
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

  // ── Safe return ──
  blocks.push(block(TYPES.SPINDLE_STOP, {}));

  return blocks;
}

export function chamferExternalTemplate(qParams, model, programName) {
  if (!qParams?.obj || !model) {
    return '; Erro: parametros insuficientes';
  }

  const blocks = buildIR(qParams, model);
  return postprocess(blocks, qParams, model, programName);
}
