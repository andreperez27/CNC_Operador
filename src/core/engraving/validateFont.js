/**
 * Validação dos dados de uma fonte de gravação (pura, sem I/O).
 *
 * Usada nos testes e — no futuro — antes de aceitar qualquer fonte vinda
 * do banco (`supabaseFontRepository`): se falhar, o app continua com a
 * última versão válida. Uma versão publicada é imutável; corrigir uma
 * letra gera uma nova versão.
 *
 * @param {object} font objeto `{ font: {...}, glyphs: [...] }`
 * @returns {{ valid: boolean, errors: string[] }}
 */
const ARC_TOL = 0.001;

const isPt = (p) =>
  Array.isArray(p) && p.length === 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]);

function checkArc(charLabel, from, seg, errors) {
  if (!isPt(seg.to) || !isPt(seg.c) || typeof seg.cw !== 'boolean') {
    errors.push(`${charLabel}: arco com to/c/cw inválidos.`);
    return;
  }
  const r0 = Math.hypot(from[0] - seg.c[0], from[1] - seg.c[1]);
  const r1 = Math.hypot(seg.to[0] - seg.c[0], seg.to[1] - seg.c[1]);
  if (Math.abs(r0 - r1) > ARC_TOL) {
    errors.push(`${charLabel}: raio de início (${r0}) difere do de fim (${r1}).`);
  }
  if (Math.hypot(from[0] - seg.to[0], from[1] - seg.to[1]) < 1e-9) {
    errors.push(`${charLabel}: arco com início igual ao fim (círculo completo deve ser dividido).`);
  }
}

function checkStroke(charLabel, st, bbox, errors) {
  if (!st || !isPt(st.from) || !Array.isArray(st.segs)) {
    errors.push(`${charLabel}: traço sem from/segs válidos.`);
    return;
  }
  const [xmin, ymin, xmax, ymax] = bbox;
  const inside = (p) => p[0] >= xmin - 1e-9 && p[0] <= xmax + 1e-9 && p[1] >= ymin - 1e-9 && p[1] <= ymax + 1e-9;
  let cur = st.from;
  if (!inside(cur)) errors.push(`${charLabel}: ponto fora do bbox: [${cur}].`);
  for (const s of st.segs) {
    if (!s || (s.t !== 'L' && s.t !== 'A')) {
      errors.push(`${charLabel}: segmento com tipo inválido.`);
      return;
    }
    if (!isPt(s.to)) {
      errors.push(`${charLabel}: segmento sem destino válido.`);
      return;
    }
    if (!inside(s.to)) errors.push(`${charLabel}: ponto fora do bbox: [${s.to}].`);
    if (s.t === 'A') {
      checkArc(charLabel, cur, s, errors);
      // Amostra a curva: o arco pode sair do bbox mesmo com pontas dentro.
      const r = Math.hypot(cur[0] - s.c[0], cur[1] - s.c[1]);
      let a0 = Math.atan2(cur[1] - s.c[1], cur[0] - s.c[0]);
      const a1 = Math.atan2(s.to[1] - s.c[1], s.to[0] - s.c[0]);
      let sweep = s.cw ? a0 - a1 : a1 - a0;
      while (sweep <= 0) sweep += 2 * Math.PI;
      const n = Math.max(8, Math.ceil((sweep / (2 * Math.PI)) * 72));
      for (let i = 1; i < n; i++) {
        const a = s.cw ? a0 - (sweep * i) / n : a0 + (sweep * i) / n;
        const p = [s.c[0] + r * Math.cos(a), s.c[1] + r * Math.sin(a)];
        if (!inside(p)) {
          errors.push(`${charLabel}: curva fora do bbox em [${p.map((v) => v.toFixed(3))}].`);
          break;
        }
      }
    }
    cur = s.to;
  }
}

export function validateFont(font) {
  const errors = [];
  if (!font || typeof font !== 'object' || !font.font || !Array.isArray(font.glyphs)) {
    return { valid: false, errors: ['fonte sem estrutura { font, glyphs }.'] };
  }
  const ref = font.font.height_ref;
  if (!(typeof ref === 'number' && Number.isFinite(ref) && ref > 0)) {
    errors.push('height_ref deve ser número positivo.');
  }
  const seen = new Set();
  for (const g of font.glyphs) {
    const label = `glifo '${g?.char ?? '?'}'`;
    if (typeof g?.char !== 'string' || g.char.length !== 1) {
      errors.push(`${label}: char inválido (1 caractere).`);
      continue;
    }
    if (seen.has(g.char)) errors.push(`caractere duplicado: '${g.char}'.`);
    seen.add(g.char);
    if (!(typeof g.advance === 'number' && Number.isFinite(g.advance) && g.advance > 0)) {
      errors.push(`'${g.char}': advance deve ser número maior que zero.`);
    }
    const bb = g.bbox;
    if (!Array.isArray(bb) || bb.length !== 4 || !bb.every(Number.isFinite)) {
      errors.push(`'${g.char}': bbox deve ser [xmin, ymin, xmax, ymax] finitos.`);
      continue;
    }
    if (!Array.isArray(g.strokes)) {
      errors.push(`'${g.char}': strokes deve ser lista.`);
      continue;
    }
    for (const st of g.strokes) checkStroke(`'${g.char}'`, st, bb, errors);
  }
  return { valid: errors.length === 0, errors };
}
