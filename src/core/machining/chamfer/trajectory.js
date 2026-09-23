/**
 * Trajetória da ferramenta (canônico, core).
 *
 * Fonte ÚNICA de pontos do chanfro: o preview e o template IR derivam
 * dos MESMOS `points` (via modelo). Nada é recalculado em outras
 * camadas com fórmulas diferentes.
 *
 * PONTOS (coordenadas do motor, plano XZ):
 *   x     — X do centro da ferramenta no passe (mesma lei do loop do
 *           programa: externo xCentro + d·cotA, interno xCentro − d·cotA)
 *   z     — profundidade (positiva, de 0 até profZ)
 *
 * O template traduz estes pontos para as constantes do loop Q
 * (Q10=xCentro, Q22=cotA, Q4=incReal) — a mesma lei, sem trigonometria
 * no controle.
 */

export function buildTrajectory(model, strategy) {
  const passes = strategy.passes;
  return {
    points: passes,
    start: passes[0],
    end: passes[passes.length - 1],
    nPasses: strategy.nPasses,
    incReal: strategy.incReal,
    safeZ: model.trajectory.safeZ,
  };
}