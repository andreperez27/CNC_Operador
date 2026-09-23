export function roundingSolver(params) {
  const { L, R, D, r, incrZ } = params;

  // Raio efetivo da ferramenta (canto torico)
  const rEfet = r;

  // Raio da trajetoria do centro da fresa (para o arco de arredondamento)
  // O centro do arco de arredondamento esta a distancia R da aresta
  // O centro da fresa segue um arco de raio (R + rEfet) ao redor do centro do arredondamento
  const rTraj = R + rEfet;

  // Numero de passes em Z
  const nPasses = Math.ceil(R / incrZ);
  const passoZ = R / nPasses;

  // Angulo maximo (90° para aresta reta)
  const angMax = 90;

  return {
    L, R, D, r,
    rEfet,
    rTraj,
    nPasses,
    passoZ,
    angMax,
    rpm: params.rpm,
    av: params.av,
  };
}
