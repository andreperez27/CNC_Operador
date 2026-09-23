/*
 * programEngine — Generates Heidenhain programs from Q parameters
 *
 * Pure function. No math, no SVG.
 * Delegates to templates registered for each operation.
 */

const TEMPLATES = {};

export function registerTemplate(operationId, templateFn) {
  TEMPLATES[operationId] = templateFn;
}

export function generateProgram(operationId, qParams, model, programName) {
  const fn = TEMPLATES[operationId];
  if (!fn) {
    return `; Erro: template nao encontrado para "${operationId}"`;
  }
  return fn(qParams, model, programName);
}

export function getRegisteredOperations() {
  return Object.keys(TEMPLATES);
}
