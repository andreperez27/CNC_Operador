/**
 * Geometria do Raio (canônico, core) — pura, sem estratégia e sem G-Code.
 *
 * Reproduz EXATAMENTE o bloco "Raio de canto externo" da planilha de setor
 * (linhas 17–24), com as fórmulas auditadas:
 *
 *   rho  = R + r
 *   Xc   = (D/2 − r) − R                       (Q4 / X inicial em Z=0)
 *   xAt(z) = SQRT((R+r)² − ((R+r)−z)²) + (D/2 − r) − R   (Q6(z))
 *
 * RAIO INTERNO (canto do bolsão — parede X0 / fundo Z0): espelho em X do
 * externo, mesma identidade de círculo com X decrescente (mesma regra de
 * sinais do chanfro interno — docs/COORDINATE_SYSTEM.md):
 *
 *   Xc   = R − (D/2 − r)
 *   xAt(z) = R − (D/2 − r) − SQRT(z·(2·rho − z))
 *
 * A TANGÊNCIA usa a identidade círculo-círculo (`circleCircleTangent` de
 * core/geometry): o centro do nariz da ferramenta fica à distância R + r do
 * centro do arco da peça — mesmo invariante do preview interno
 * `buildInternalRadiusPreviewModel`.
 *
 * Convenção de coordenadas (docs/RAIO_SPREADSHEET_REFERENCE.md §4):
 *   z é PROFUNDIDADE POSITIVA para baixo (0 = topo da peça / fundo do bolsão);
 *   X positivo para a direita.
 *
 * Identidade geométrica do círculo (usada no teste de tangência):
 *   centro do círculo da trajetória = (Xc, rho), raio = rho
 *   → (X − Xc)² + (Z − rho)² = rho² para todo ponto da trajetória.
 *
 * Domínio: 0 ≤ z ≤ 2·rho (fora disso a raiz fica imaginária — o incremento
 * é validado antes de chegar aqui; docs/RELATORIO_AUDITORIA_RAIO.md §3).
 *
 * Valores de referência (externo R=20, D=25, r=0,8):
 *   rho = 20,8 | Xc = −8,3 | xAt(20) = 12,484609690826531
 * (interno R=5, D=16, r=0,8): rho=5,8 | Xc=−2,2 | xAt(5)=−7,9445626465
 */

import { circleCircleTangent } from '../../geometry/circleLine';

export function radiusGeometry({ R, D, r, type }) {
  const isInternal = type === 'internal';
  const rho = R + r;
  const offset = D / 2 - r;
  const xCenter = isInternal ? R - offset : offset - R;
  const profZ = R;
  const partCenter = { x: isInternal ? R : -R, z: rho };

  /** Centro do raio de canto (nariz) da ferramenta na profundidade z.
   *  Nariz = partCenter + direção·(R + r) — identidade círculo-círculo. */
  function noseCenter(z) {
    const s = Math.sqrt(Math.pow(rho, 2) - Math.pow(rho - z, 2));
    const dir = { x: isInternal ? -s : s, z: z - rho };
    return circleCircleTangent(partCenter, R, r, dir);
  }

  /** X do centro da ferramenta na profundidade z (fórmula Q6 da planilha). */
  function xAt(z) {
    const nose = noseCenter(z);
    return nose.x + (isInternal ? -offset : offset);
  }

  const xZero = xAt(0);
  const trajMaxX = isInternal ? xCenter - rho : xCenter + rho;

  /** Ponto de contato com o arco da peça (raio R) na profundidade z. */
  function contactAt(z) {
    const nose = noseCenter(z);
    const dx = nose.x - partCenter.x;
    const dz = nose.z - partCenter.z;
    const len = Math.hypot(dx, dz) || 1;
    return {
      x: partCenter.x + (R / len) * dx,
      z: partCenter.z + (R / len) * dz,
    };
  }

  return {
    type,
    R,
    D,
    r,
    rho,
    xCenter,
    q4: xCenter,
    profZ,
    xAt,
    xZero,
    trajMaxX,
    noseCenter,
    contactAt,
    center: { x: xCenter, z: rho },
    radius: rho,
    partCenter,
  };
}