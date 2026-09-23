/**
 * Estratégia de passes do Raio (canônico, core).
 *
 * Decide o plano de usinagem a partir da GEOMETRIA (pura):
 *
 *   nPasses = max(1, ceil(profZ / incrZ))
 *   incReal = profZ / nPasses
 *
 * onde `profZ = R` (arco útil do canto: do topo Z0 até a tangência com a
 * face vertical na profundidade R — mesma profundidade usada no exemplo de
 * produção da planilha Q5 = R).
 *
 * SEGURANÇA: incrZ <= 0 lança `ValidationError` (INVALID_INCREMENT) — sem
 * esta guarda, `ceil(R/0) = Infinity` produziria loop infinito (OOM).
 *
 * ÚLTIMO PASSE: `z = nPasses·incReal = R` exato (incReal é derivado de R,
 * não do incremento informado) — sem overshoot e sem passe adicional.
 *
 * SENTIDO: externo — o arco percorre profundidade Z crescente (desce); a
 * varredura de usinagem é ao longo do comprimento Y da aresta, no sentido
 * = −Y (mesma sequência dos programas aprovados de chanfro externo).
 *
 * SEQUÊNCIA POR PASSE (movimentos, em ordem):
 *   1. rápido ao canto seguro (X = Xc − seguranca; Y início)
 *   2. mergulho em Z até a profundidade do passe
 *   3. deslocamento em X até o ponto do arco (Q6)
 *   4. varredura ao longo de Y (comprimento da aresta)
 *   5. retração diagonal (X canto seguro + IZ+1)
 */

import { ValidationError } from '../../validation/validationEngine';

export function buildPassStrategy(geometry, params) {
  const profZ = geometry.profZ;
  const incrZ = typeof params === 'object' && params !== null
    ? params.incrZ ?? params.passDepth ?? params.passeZ
    : undefined;

  if (!(typeof incrZ === 'number') || !Number.isFinite(incrZ) || incrZ <= 0) {
    throw new ValidationError(
      'INVALID_INCREMENT',
      'incrZ',
      'Incremento por passe deve ser maior que zero (incrZ=0 trava o calculo).'
    );
  }

  const nPasses = Math.max(1, Math.ceil(profZ / incrZ));
  const incReal = profZ / nPasses;

  const passes = [];
  for (let i = 1; i <= nPasses; i++) {
    const zDepth = i * incReal;
    passes.push({
      pass: i,
      x: geometry.xAt(zDepth),
      z: zDepth,
      zDepth,
      isLast: i === nPasses,
      isFirst: i === 1,
    });
  }

  return {
    nPasses,
    incReal,
    profZ,
    passes,
    sense: 'down',
    sweep: 'alongY',
    moveSequence: [
      'rapidCorner',
      'plungeZ',
      'arcX',
      'sweepY',
      'retractDiagonal',
    ],
  };
}