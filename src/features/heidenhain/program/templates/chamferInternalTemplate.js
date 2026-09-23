import { createBlock, TYPES } from '../../../../core/program/types';
import { postprocess } from '../../../../core/postprocessors/heidenhain';

/*
 * ═══════════════════════════════════════════════════════════════════
 *  VERIFICAÇÃO GEOMÉTRICA DO TEMPLATE — CHANFRO INTERNO
 * ═══════════════════════════════════════════════════════════════════
 *
 *  SISTEMA DE COORDENADAS REAL DA MÁQUINA (Z-up, X-right)
 *  ─────────────────────────────────────────────────────────
 *  Origem no canto do bolsão: parede em X=0, fundo em Z=0.
 *
 *  P1 (topo do chanfro, na parede): X=0,            Z=+C·senA
 *  P2 (pé do chanfro, no fundo):    X=−C·cosA,      Z=0
 *
 *  O centro da ferramenta desloca-se de +senA·Reff na direção X
 *  e +cosA·Reff na direção Z em relação ao ponto de contato.
 *  O resultado é que o centro da ferramenta AFASTA-SE da parede
 *  (X→ mais negativo) à medida que a profundidade aumenta.
 *
 *  FÓRMULA: Q21 = Q10 − Q20 · Q22
 *  ─────────────────────────────────
 *  Q10 = xCentro = senA · Reff  (posição X no topo do chanfro)
 *  Q20 = profundidade do passe (crescente: 0 → profZ)
 *  Q22 = cotA = largX / profZ
 *
 *  Caso de teste: A=45°, C=5, D=16, r=0,8, alojamento=50
 *    largX=3,536  profZ=3,536  cotA=1,0  Reff=0,8  xCentro=0,566
 *    nPasses=12  incReal=0,295
 *
 *              Q20        Q21 = Q10 − Q20·Q22   (coordenada máquina X)
 *    ──────────────────────────────────────────────────────────────
 *    Passe  1:  0,295  →  +0,271   ← perto da parede, X ligeiramente >0
 *    Passe  2:  0,590  →  −0,024   ← cruza X=0 (entra no bolsão)
 *    Passe  6:  1,768  →  −1,202   ← dentro do bolsão
 *    Passe 12:  3,536  →  −2,970   ← fundo do chanfro
 *
 *  O sinal MENOS é CORRETO: Q21 DECRESCE (vai para esquerda)
 *  conforme Q20 cresce, afastando o centro da ferramenta da
 *  parede (X=0) em direção ao interior do bolsão.
 *
 *  Se trocássemos para Q10 + Q20·Q22, Q21 AUMENTARIA com a
 *  profundidade, empurrando a ferramenta CONTRA a parede — errado.
 * ═══════════════════════════════════════════════════════════════════
 */

function buildIR(qParams, model) {
  const {
    Q1: a, Q2: c, Q3: pz, Q4: inc, Q5: lx,
    Q6: reff, Q7: d, Q8: np, Q9: L, Q10: xc, Q11: sob,
    Q12: ys, Q13: ye, Q14: safe, Q15: retr,
    Q22: cotA,
  } = Object.fromEntries(
    Object.entries(qParams.obj).map(([k, v]) => [k, v.value])
  );

  const rpm = model.params?.rpm ?? 3000;
  const av = model.params?.av ?? 600;
  const toolName = model.toolTypeName || 'Fresa Torica';
  const halfAv = Math.round(av * 0.5);
  const pocketWidth = model.params?.alojamentoLargura ?? 0;

  const block = (type, data) => createBlock(type, data);

  return [
    // ── Header ──
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

    // ── Q Parameters ──
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

    // ── Control variables ──
    block(TYPES.SECTION, { title: 'Variaveis de controle' }),
    block(TYPES.ASSIGN, { target: '$30', expression: '0', comment: 'Contador de passes' }),
    block(TYPES.DEFINE, { param: '$31', value: np, decimals: 0, label: 'Total de passes' }),
    block(TYPES.COMMENT, { lines: [''] }),

    // ── Initial positioning ──
    block(TYPES.SECTION, { title: 'Posicionamento inicial' }),
    block(TYPES.SPINDLE, { speed: rpm, direction: 'cw' }),
    block(TYPES.RAPID, { coords: { x: '$10', y: '$12' } }),
    block(TYPES.COMMENT, { lines: [''] }),

    // ── Pass cycle ──
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

    // ── Safe return ──
    block(TYPES.SECTION, { title: 'Retorno seguro' }),
    block(TYPES.SPINDLE_STOP, {}),
    block(TYPES.COMMENT, { lines: [''] }),
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
    block(TYPES.COMMENT, { lines: ['Fim do programa'] }),
    block(TYPES.COMMENT, { lines: ['='.repeat(60)] }),
  ];
}

export function chamferInternalTemplate(qParams, model, programName) {
  if (!qParams?.obj || !model) {
    return '; Erro: parametros insuficientes';
  }

  const blocks = buildIR(qParams, model);
  return postprocess(blocks, qParams, model, programName);
}
