export function solveTriangle(inputs) {
  let { a, b, c, A, B } = inputs;

  if (A && B) {
    if (Math.abs(A + B - 90) > 0.01) {
      return { error: 'A + B deve ser 90°' };
    }
  }
  if (A) B = 90 - A;
  if (B) A = 90 - B;

  try {
    if (a && b) {
      c = Math.sqrt(a * a + b * b);
      A = Math.atan2(b, a) * 180 / Math.PI;
      B = 90 - A;
    } else if (a && c) {
      if (c < a) return { error: 'Hipotenusa menor que cateto' };
      b = Math.sqrt(c * c - a * a);
      B = Math.asin(a / c) * 180 / Math.PI;
      A = 90 - B;
    } else if (b && c) {
      if (c < b) return { error: 'Hipotenusa menor que cateto' };
      a = Math.sqrt(c * c - b * b);
      A = Math.asin(b / c) * 180 / Math.PI;
      B = 90 - A;
    } else if (a && A) {
      const r = A * Math.PI / 180;
      b = a / Math.tan(r);
      c = a / Math.sin(r);
      B = 90 - A;
    } else if (a && B) {
      A = 90 - B;
      const r = A * Math.PI / 180;
      b = a / Math.tan(r);
      c = a / Math.sin(r);
    } else if (b && A) {
      const r = A * Math.PI / 180;
      a = b * Math.tan(r);
      c = b / Math.cos(r);
      B = 90 - A;
    } else if (b && B) {
      A = 90 - B;
      const r = A * Math.PI / 180;
      a = b * Math.tan(r);
      c = b / Math.cos(r);
    } else if (c && A) {
      const r = A * Math.PI / 180;
      a = c * Math.sin(r);
      b = c * Math.cos(r);
      B = 90 - A;
    } else if (c && B) {
      A = 90 - B;
      const r = A * Math.PI / 180;
      a = c * Math.sin(r);
      b = c * Math.cos(r);
    } else {
      return null;
    }

    return {
      a: round(a), b: round(b), c: round(c),
      A: round(A), B: round(B), C: 90,
    };
  } catch {
    return { error: 'Erro no calculo.' };
  }
}

function round(x) {
  return Math.round(x * 1e9) / 1e9;
}
