/**
 * Cabeçote 45 Huron — cinemática de duas flanges (cada uma com offset fixo de 45°).
 *
 * NOTA DE ESCOPO: este modelo é válido para o cabeçote universal das máquinas
 * PORTAL FELLER especificamente — não é uma fórmula genérica de cabeçote
 * inclinável. Outros fabricantes/modelos exigem seu próprio módulo
 * (ex.: o cabeçote da segunda máquina, ainda não modelado).
 *
 * Converte os ângulos espaciais do 3D ROT (A, B, C, em graus) nos dois ângulos
 * mecânicos que o operador precisa ajustar nas flanges: bFlange (inferior, 45°)
 * e cFlange (superior).
 *
 * Modelo validado empiricamente contra 10 leituras reais da máquina (iTNC 530,
 * G-code READ_45HURON.MM, FN16-FPRINT). Ver tests/huronHead.test.js.
 *
 * Destino sugerido: src/core/machining/huronHead.js
 */

const toRad = (deg) => (deg * Math.PI) / 180;
const toDeg = (rad) => (rad * 180) / Math.PI;

/**
 * @param {{A?: number, B?: number, C?: number}} spatialAngles ângulos do 3D ROT, em graus
 * @returns {{bFlange: number, cFlange: number}} ângulos mecânicos das flanges, em graus
 */
export function calculateHuronFlanges({ A = 0, B = 0, C = 0 }) {
  const a = toRad(A);
  const b = toRad(B);
  const c = toRad(C);

  // Magnitude da inclinação resultante: depende só de A e B do 3D ROT, não de C.
  const cosTheta = Math.cos(a) * Math.cos(b);
  const clamped = Math.min(1, Math.max(-1, cosTheta));
  const bFlange = 2 * toDeg(Math.acos(Math.sqrt(Math.max(0, clamped))));

  if (bFlange < 1e-9) {
    // Sem inclinação nenhuma: a direção não tem sentido, a própria máquina zera C.
    return { bFlange: 0, cFlange: 0 };
  }

  // Direção (azimute) do vetor-ferramenta resultante, a partir dos três ângulos.
  const x = Math.cos(c) * Math.sin(b) * Math.cos(a) + Math.sin(c) * Math.sin(a);
  const y = Math.sin(c) * Math.sin(b) * Math.cos(a) - Math.cos(c) * Math.sin(a);
  const phi = Math.atan2(y, x);

  // Correção de fase introduzida pela própria abertura da flange inferior.
  const bf = toRad(bFlange);
  const psi = Math.atan2(-Math.sin(bf) / Math.SQRT2, (1 - Math.cos(bf)) / 2);

  let cFlange = toDeg(phi - psi) + 90;
  cFlange = (((cFlange + 180) % 360) + 360) % 360 - 180; // normaliza p/ (-180, 180]

  return { bFlange, cFlange };
}

/**
 * Compensação de desvio de montagem do anel de graduação das flanges.
 *
 * A fórmula em calculateHuronFlanges() assume que o "zero" de cada anel de
 * graduação coincide com o zero geométrico do modelo. Na prática, ao montar
 * o cabeçote na máquina, o anel pode ter sido travado girado em relação a
 * esse zero teórico — sobretudo o da flange superior. Esta função aplica um
 * desvio fixo (medido uma vez, na calibração física) por cima do resultado
 * já validado, sem alterar a fórmula original.
 *
 * O valor final é normalizado pra 0–360°, porque é assim que se lê um anel
 * de graduação físico (uma volta completa, sem sinal negativo).
 *
 * Destino sugerido: mesmo arquivo, src/core/machining/huronHead.js
 * (função adicional, não substitui calculateHuronFlanges)
 */

const wrap360 = (deg) => ((deg % 360) + 360) % 360;

/**
 * @param {{bFlange: number, cFlange: number}} raw resultado de calculateHuronFlanges()
 * @param {{bRingOffset?: number, cRingOffset?: number}} calibration desvios medidos
 *        do anel de cada flange, em graus (quanto o zero físico do anel está
 *        deslocado do zero teórico). Positivo ou negativo, conforme o sentido
 *        medido na prática.
 * @returns {{bFlangeRing: number, cFlangeRing: number}} valores prontos pra
 *          discar diretamente no anel físico
 */
export function applyRingCalibration(
  { bFlange, cFlange },
  { bRingOffset = 0, cRingOffset = 0 } = {}
) {
  return {
    bFlangeRing: wrap360(bFlange + bRingOffset),
    cFlangeRing: wrap360(cFlange + cRingOffset),
  };
}
