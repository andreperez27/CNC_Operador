/**
 * ValidationEngine — camada central de validação (independente de React).
 *
 * Todo solver canônico valida a sua entrada nesta camada ANTES de
 * calcular. O resultado é um objeto estruturado:
 *
 *   { valid, errors: [{ code, field, message }], warnings: [{ code, field, message }] }
 *
 * - `code`   — identificador estável do problema (ex.: INVALID_ANGLE),
 *              usado por testes e por lógica condicional da UI.
 * - `field`  — id do campo do formulário (ex.: 'A'), para exibir a
 *              mensagem ao lado do campo certo.
 * - `message`— mensagem em português para o operador.
 *
 * Regras de segurança (obrigatórias na porta de entrada dos solvers):
 *   1. NENHUM valor NaN/Infinity entra no cálculo.
 *   2. Divisão por zero é bloqueada ANTES de acontecer (ex.: A=0° não
 *      pode gerar xCentro = Infinity).
 *   3. passeZ <= 0 é bloqueado ANTES de gerar loop infinito (OOM).
 *
 * Para consumidores que preferem exceção (padrão legado, onde a página
 * envolve o cálculo em try/catch), use `raiseFirstError(validation)`.
 */

export class ValidationError extends Error {
  constructor(code, field, message) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
    this.field = field;
  }
}

export function createValidation() {
  return { valid: true, errors: [], warnings: [] };
}

export function addError(validation, code, field, message) {
  validation.errors.push({ code, field, message });
  validation.valid = false;
}

export function addWarning(validation, code, field, message) {
  validation.warnings.push({ code, field, message });
}

export function finalize(validation) {
  validation.valid = validation.errors.length === 0;
  return validation;
}

export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isFinitePositive(value) {
  return isFiniteNumber(value) && value > 0;
}

/**
 * Guarda genérica: se `ok` for falso, registra erro no campo `field`.
 * Retorna true quando a condição passou (sem erro registrado).
 */
export function guard(validation, ok, code, field, message) {
  if (!ok) addError(validation, code, field, message);
  return ok;
}

/** Lança o primeiro erro do resultado de validação (padrão legado). */
export function raiseFirstError(validation) {
  if (validation.valid) return;
  const e = validation.errors[0];
  throw new ValidationError(e.code, e.field, e.message);
}