export function fmtN(x) {
  if (x === null || x === undefined || isNaN(x)) return '—';
  if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
  return x.toFixed(4);
}

export function fmtDim(x) {
  if (x === null || x === undefined || isNaN(x)) return '—';
  return x.toFixed(3);
}

export function fmtInt(x) {
  if (x === null || x === undefined || isNaN(x)) return '—';
  return String(Math.round(x));
}
