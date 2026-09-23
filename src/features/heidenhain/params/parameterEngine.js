import { toQParams as coreToQParams, toQText, toQTable } from '../../../core/params/parameterEngine';

const DEFAULT_MAP = {
  Q1:  { key: 'A',       label: 'Angulo do chanfro',            decimals: 1 },
  Q2:  { key: 'C',       label: 'Largura do chanfro',           decimals: 3 },
  Q3:  { key: 'profZ',   label: 'Profundidade total Z',         decimals: 3 },
  Q4:  { key: 'incReal', label: 'Incremento por passe',         decimals: 3 },
  Q5:  { key: 'largX',   label: 'Largura projetada X',          decimals: 3 },
  Q6:  { key: 'Reff',    label: 'Raio efetivo da ferramenta',   decimals: 3 },
  Q7:  { key: 'D',       label: 'Diametro da ferramenta',       decimals: 3 },
  Q8:  { key: 'nPasses', label: 'Numero de passes',             decimals: 0 },
  Q9:  { key: 'L',       label: 'Comprimento da peca',          decimals: 3 },
  Q10: { key: 'xCentro', label: 'Posicao X inicial',            decimals: 3 },
  Q11: { key: 'sobre',   label: 'Sobremetal',                   decimals: 3 },
  Q12: { key: 'yStart',  label: 'Y inicio',                     decimals: 3 },
  Q13: { key: 'yEnd',    label: 'Y fim',                        decimals: 3 },
  Q14: { key: 'safeZ',   label: 'Altura de seguranca',          decimals: 1 },
  Q15: { key: 'retrZ',   label: 'Altura de retracao',           decimals: 1 },
  Q22: { key: 'cotA',    label: 'Cotangente do angulo',         decimals: 4 },
};

/*
 * Mapa do CHANFRO EXTERNO — numeracao baseada no programa real de
 * producao (CHANFRO_EXT_RETO.H), com ajuste para o loop compacto:
 *   Q1/Q2/Q3/Q5/Q11/Q33 = entradas literais (FN 0)
 *   Q4/Q10/Q12/Q22/Q31/Q34 = valores calculados pelo motor em JS
 *
 * Loop (aritmetica simples, sem trigonometria no controle):
 *   Q20 = Q30 * Q4          (Q4 = incremento por passe)
 *   Q21 = Q10 + Q20 * Q22   (Q10 = X inicial em Z0, Q22 = cotangente)
 */
export const EXTERNAL_CHAMFER_MAP = {
  Q1:  { key: 'A',        label: 'Angulo do chanfro',           decimals: 1 },
  Q2:  { key: 'C',        label: 'Largura do chanfro',          decimals: 3 },
  Q3:  { key: 'D',        label: 'Diametro da ferramenta',      decimals: 3 },
  Q4:  { key: 'incReal',  label: 'Incremento por passe',        decimals: 3 },
  Q5:  { key: 'r',        label: 'Raio da ferramenta',          decimals: 3 },
  Q10: { key: 'xCentro',  label: 'Pos. X inicial em Z0',        decimals: 3 },
  Q11: { key: 'seguranca', label: 'Distancia de seguranca',     decimals: 1 },
  Q12: { key: 'xCorner',  label: 'Pos. X do canto seguro',      decimals: 3 },
  Q22: { key: 'cotA',     label: 'Cotangente do angulo',        decimals: 4 },
  Q31: { key: 'nPasses',  label: 'Total de passes',             decimals: 0 },
  Q33: { key: 'L',        label: 'Comprimento do chanfro',      decimals: 3 },
  Q34: { key: 'yTotal',   label: 'Comprimento total do passe Y', decimals: 3 },
};

/*
 * Mapa do RAIO EXTERNO canônico — numeração alinhada ao programa de
 * setor (RAIO_EXT_RETO.H) e ao cabeçalho Q da planilha:
 *   Q1/Q2/Q3/Q5/Q33 = entradas literais (FN 0)
 *   Q4 (Xc), Q6 (X no último passe), Q31/Q34 = calculados pelo motor
 *
 * O loop do controle usa a identidade do círculo:
 *   Q21 = Q4 + SQRT(Q20 * Q22 - Q20 * Q20)
 *   (Q20 = Z do passe, Q22 = 2·rho da trajetória)
 */
export const EXTERNAL_RADIUS_MAP = {
  Q1:  { key: 'R',        label: 'Raio de arredondamento R',    decimals: 3 },
  Q2:  { key: 'D',        label: 'Diametro da ferramenta',      decimals: 3 },
  Q3:  { key: 'r',        label: 'Raio da ferramenta',          decimals: 3 },
  Q4:  { key: 'xCenter',  label: 'Pos. X do centro da traj.',    decimals: 3 },
  Q5:  { key: 'incReal',  label: 'Incremento por passe (Z)',    decimals: 3 },
  Q6:  { key: 'q6',       label: 'Pos. X no ultimo passe',      decimals: 3 },
  Q9:  { key: 'rho',      label: 'Raio da trajetoria',          decimals: 3 },
  Q11: { key: 'seguranca', label: 'Distancia de seguranca',     decimals: 1 },
  Q12: { key: 'xCorner',  label: 'Pos. X do canto seguro',      decimals: 3 },
  Q31: { key: 'nPasses',  label: 'Total de passes',             decimals: 0 },
  Q33: { key: 'L',        label: 'Comprimento da peca',         decimals: 3 },
  Q34: { key: 'yTotal',   label: 'Comprimento total do passe Y', decimals: 3 },
};

export function toQParams(model, map) {
  return coreToQParams(model, map || DEFAULT_MAP);
}

export { DEFAULT_MAP, toQText, toQTable };
