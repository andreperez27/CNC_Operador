/**
 * Trajetória do Raio (canônico, core) — fonte única de pontos.
 *
 * Resposta do módulo: o solver diz QUAL é a geometria; a trajetória diz
 * QUAIS pontos/movimentos devem ser executados. O preview e o template IR
 * derivam dos MESMOS `points` (nada recalculado com fórmula diferente em
 * outras camadas).
 *
 * PONTOS (coordenadas do motor, plano XZ, profundidade Z positiva para baixo):
 *   x    — X do centro da ferramenta (lei Q6 da planilha)
 *   z    — profundidade do passe (de incReal até profZ = R)
 *
 * `circle` entrega a identidade geométrica da referência:
 *   centro (Xc, rho) e raio rho — usada no teste de tangência:
 *   |dist(ponto, centro) − rho| <= tolerância.
 */

export function buildTrajectory(geometry, strategy) {
  const passes = strategy.passes;
  return {
    points: passes,
    start: passes[0],
    end: passes[passes.length - 1],
    nPasses: strategy.nPasses,
    incReal: strategy.incReal,
    profZ: strategy.profZ,
    circle: {
      center: { x: geometry.xCenter, z: geometry.rho },
      radius: geometry.rho,
    },
    safeZ: 5,
  };
}