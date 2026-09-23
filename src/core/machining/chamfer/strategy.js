/**
 * Estratégia de passes do chanfro (canônico, core).
 *
 * Calcula o número de passes e o incremento real a partir do modelo
 * geométrico:
 *
 *   nPasses = max(1, ceil(profZ / passeZ))
 *   incReal = profZ / nPasses
 *
 * SEGURANÇA: passeZ <= 0 lança `ValidationError` (INVALID_PASS_DEPTH).
 * Sem esta guarda, `ceil(profZ/0) = Infinity` produziria um loop
 * infinito e travaria o navegador (confirmado por execução — OOM).
 *
 * SINAL DE X POR TIPO:
 *   externo: X = xCentro + profundidade·cotA   (Q21 = Q10 + Q20·Q22)
 *   interno: X = xCentro − profundidade·cotA   (Q21 = Q10 − Q20·Q22)
 *
 * O parâmetro `model.type` é definido pela geometria canônica
 * (e pelos adapters das features); quando ausente, o sinal é inferido
 * pela presença de `chamfer.top` (interno) — comportamento padrão:
 * externo.
 */

import { ValidationError } from '../../validation/validationEngine';

function chamferSign(model) {
  if (model.type === 'internal' || model.chamfer?.top) return -1;
  return 1;
}

export function buildPassStrategy(model, params) {
  const profZ = model.profZ;
  const xCentro = model.xCentro;
  const cotA = model.cotA;
  const passeZ = params?.passeZ ?? params?.passDepth ?? model.params?.passeZ;

  if (!(typeof passeZ === 'number') || !Number.isFinite(passeZ) || passeZ <= 0) {
    throw new ValidationError(
      'INVALID_PASS_DEPTH',
      'passeZ',
      'Profundidade por passe deve ser maior que zero (passeZ=0 trava o calculo).'
    );
  }

  const sign = chamferSign(model);
  const nPasses = Math.max(1, Math.ceil(profZ / passeZ));
  const incReal = profZ / nPasses;

  const passes = [];
  for (let i = 1; i <= nPasses; i++) {
    const zDepth = i * incReal;
    passes.push({
      pass: i,
      x: xCentro + sign * zDepth * cotA,
      z: zDepth,
      zDepth,
      isLast: i === nPasses,
    });
  }

  return { nPasses, incReal, passes };
}