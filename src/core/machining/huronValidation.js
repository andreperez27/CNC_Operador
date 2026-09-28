/**
 * Validação da entrada do Cabeçote Huron (adapter do ValidationEngine).
 *
 * Espelha `chamfer/validation.js`: acumula erros estruturados
 * `{code, field, message}` sem calcular nada. A regra geométrica pertence
 * EXCLUSIVAMENTE a `validateHuronReachability` (huronReachability.js) —
 * este adapter apenas a invoca e converte o veredito para o contrato.
 */

import {
  createValidation,
  addError,
  guard,
  finalize,
  isFiniteNumber,
} from '../validation/validationEngine';
import { validateHuronReachability } from './huronReachability';

/**
 * @param {{A?: number, B?: number, C?: number}} input ângulos 3D ROT
 * @returns {{valid: boolean, errors: Array, warnings: Array}}
 */
export function validateHuronInput(input) {
  const v = createValidation();

  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    addError(v, 'INVALID_INPUT', null, 'Entrada invalida: objeto de parametros nao informado.');
    return finalize(v);
  }

  guard(v, isFiniteNumber(input.A), 'INVALID_ANGLE', 'A',
    'Informe um número válido em graus.');
  guard(v, isFiniteNumber(input.B), 'INVALID_ANGLE', 'B',
    'Informe um número válido em graus.');
  guard(v, isFiniteNumber(input.C), 'INVALID_ANGLE', 'C',
    'Informe um número válido em graus.');

  if (v.valid) {
    const reach = validateHuronReachability({ A: input.A, B: input.B, C: input.C });
    if (!reach.reachable) {
      addError(v, reach.reason, 'orientacao', reach.message);
    }
  }

  return finalize(v);
}
