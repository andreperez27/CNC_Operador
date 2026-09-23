/**
 * Trajetória da rosca (canônico, core) — fonte única para preview e para o
 * template IR.
 *
 *   RIGID: ponto único sobre o eixo do furo (a trajetória é o próprio ciclo).
 *   HELICAL: pontos da hélice 3D (x, y, z) — passo por volta, sentido
 *            { cw: −360°/volta, ccw: +360°/volta }. `points` entrega a
 *            projeção XZ (usada no preview) e `points3d` a hélice completa.
 */

const STEPS_PER_REV = 24;

export function buildThreadTrajectory(strategy) {
  if (strategy.method === 'helical') {
    const angleSign = strategy.direction === 'cw' ? -1 : 1;
    const totalAngle = angleSign * strategy.nPasses * 360;
    const totalSteps = strategy.nPasses * STEPS_PER_REV;
    const points = [];
    const points3d = [];
    for (let i = 0; i <= totalSteps; i++) {
      const frac = i / totalSteps;
      const rad = (frac * totalAngle * Math.PI) / 180;
      const x = strategy.radius * Math.cos(rad);
      const y = strategy.radius * Math.sin(rad);
      const z = strategy.zStart - frac * strategy.depth;
      points.push({ x, z });
      points3d.push({ x, y, z });
    }
    return {
      start: { x: strategy.radius, y: 0, z: strategy.zStart },
      end: points3d[points3d.length - 1],
      center: { x: 0, y: 0 },
      entryPoint: { x: strategy.radius, y: 0, z: strategy.zStart },
      points,
      points3d,
      radius: strategy.radius,
      direction: strategy.direction,
      nPasses: strategy.nPasses,
      totalAngle,
    };
  }

  return {
    start: { x: 0, y: 0, z: strategy.zStart },
    end: { x: 0, y: 0, z: strategy.zEnd },
    center: { x: 0, y: 0 },
    entryPoint: { x: 0, y: 0, z: strategy.zStart },
    points: [
      { x: 0, z: strategy.zStart },
      { x: 0, z: strategy.zEnd },
    ],
    points3d: [
      { x: 0, y: 0, z: strategy.zStart },
      { x: 0, y: 0, z: strategy.zEnd },
    ],
    radius: 0,
    direction: null,
    nPasses: 1,
    totalAngle: 0,
  };
}