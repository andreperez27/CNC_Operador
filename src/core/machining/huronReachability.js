/**
 * Gate de alcançabilidade do cabeçote HURON 45 (Portal Feller).
 *
 * Separado da transformação matemática (`huronHead.js`, que permanece
 * intocada): este módulo responde "a orientação desejada pode ser realizada
 * pela cinemática modelada?" ANTES de qualquer cálculo ser apresentado.
 *
 * Critério (derivado do próprio modelo + rejeição real da máquina, sem
 * nenhum parâmetro mecânico inventado): a direção da ferramenta tem
 * tilt = acos(cosA·cosB); com dois desvios de 45° em série o tilt máximo
 * é 90°, ou seja, a orientação é alcançável ⟺ cosA·cosB >= 0.
 * Fora do domínio, a fórmula dobraria o resultado sobre o valor de
 * fronteira (bFlange = 180°) sem avisar — por isso o gate vem antes.
 *
 * NÃO é caixa em |A|<=90/|B|<=90: triplas fora da caixa podem ser
 * alcançáveis (ex.: A=B=100° → tilt 88,27°) e o gate as aceita com os
 * flanges corretos, pois o resultado depende só da direção.
 */

export const REACH_COS_TOL = 1e-9; // ≈6e-8 de grau: só ruído float, nunca 0,01° real

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

function isFiniteTriple({ A, B, C }) {
  return [A, B, C].every((v) => typeof v === 'number' && Number.isFinite(v));
}

/**
 * @param {{A?: number, B?: number, C?: number}} spatial ângulos 3D ROT em graus
 * @returns {{reachable: boolean, tiltDeg: number|null, reason: string|null, message: string|null}}
 */
export function validateHuronReachability({ A = 0, B = 0, C = 0 } = {}) {
  if (!isFiniteTriple({ A, B, C })) {
    return {
      reachable: false,
      tiltDeg: null,
      reason: 'INVALID_INPUT',
      message: 'Ângulos inválidos: informe A, B e C numéricos.',
    };
  }
  const cosTheta = Math.cos(toRad(A)) * Math.cos(toRad(B));
  const tiltDeg = toDeg(Math.acos(Math.min(1, Math.max(-1, cosTheta))));
  if (cosTheta < -REACH_COS_TOL) {
    return {
      reachable: false,
      tiltDeg,
      reason: 'TILT_EXCEEDS_90',
      message: 'Orientação não alcançável nesta configuração do cabeçote.',
    };
  }
  return { reachable: true, tiltDeg, reason: null, message: null };
}
