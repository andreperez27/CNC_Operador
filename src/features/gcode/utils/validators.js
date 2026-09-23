export function validateParams(params, required) {
  const errors = [];
  for (const key of required) {
    const v = params[key];
    if (v === undefined || v === null || isNaN(v) || v <= 0) {
      errors.push(`Parametro "${key}" deve ser um valor positivo.`);
    }
  }
  return errors.length ? errors : null;
}
