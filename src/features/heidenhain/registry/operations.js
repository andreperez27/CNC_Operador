/*
 * operations — Registry of Heidenhain operations
 *
 * Each entry links its MathEngine solver, the Q-parameter mapping,
 * the program template (registered in programEngine), and the preview builder.
 *
 * To add a new operation in the future (e.g. chamferInternal, radiusExternal):
 *   1. Create a math engine (pure function)
 *   2. Create a program template
 *   3. Create a preview model builder
 *   4. Create a preview SVG component
 *   5. Register here
 */

const OPERATIONS = {};

export function registerOperation(id, def) {
  OPERATIONS[id] = def;
}

export function getOperation(id) {
  return OPERATIONS[id] || null;
}

export function getAllOperations() {
  return Object.values(OPERATIONS);
}

export function getOperationList() {
  return Object.entries(OPERATIONS).map(([id, op]) => ({
    id,
    name: op.name,
    description: op.description,
  }));
}
