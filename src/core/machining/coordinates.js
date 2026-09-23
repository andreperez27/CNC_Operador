/**
 * Convenções de coordenadas (canônico, core).
 *
 * Todas as operações trabalham no plano XZ (ferramenta se move em X e Z;
 * Y é o eixo de avanço ao longo do chanfro).
 *
 * Convenção da MÁQUINA (Heidenhain iTNC 530): sistema cartesiano
 * destro, Z-positivo para cima, X-positivo para a direita. O zero da
 * peça é definido pelo operador conforme a operação:
 *
 *   EXTERNO — origem no VÉRTICE da região do chanfro
 *             (aresta em X0, topo em Z0); o material bruto estende-se
 *             para −X, −Y e −Z. profZ = C·sen(A) mede a profundidade
 *             do chanfro a partir do topo.
 *
 *   INTERNO — origem no CANTO DO BOLSÃO
 *             (parede em X0, fundo em Z0); a parede sobe em +Z, o
 *             fundo estende-se para −X, o vão do bolsão fica em
 *             X<0 e Z>0. O chanfro liga (0, C·senA) na parede a
 *             (−C·cosA, 0) no fundo.
 *
 * IMPORTANTE — as duas convenções NÃO são intercambiáveis: os sinais
 * das fórmulas de X do centro da ferramenta diferem entre elas
 * (externo: X = xCentro + profundidade·cotA ; interno: X = xCentro −
 * profundidade·cotA). Ver docs/COORDINATE_SYSTEM.md.
 */

export const PLANE_XZ = 'XZ';

export const PLANES = [
  { id: PLANE_XZ, name: 'Plano XZ' },
];

export const CHAMFER_ORIGINS = {
  external: { id: 'vertex', name: 'Vertice da regiao (aresta X0 / topo Z0)' },
  internal: { id: 'corner', name: 'Canto do bolsao (parede X0 / fundo Z0)' },
};

export function originFor(type) {
  return CHAMFER_ORIGINS[type] || CHAMFER_ORIGINS.external;
}