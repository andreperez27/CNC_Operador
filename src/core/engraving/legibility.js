/**
 * Legibilidade da gravacao (pura, sem React): com profundidade constante, a
 * regiao cortada e o traco central engrossado pela largura do risco.
 *
 * Metodo: distancia minima entre linhas centrais (a) dentro do mesmo
 * caractere, entre segmentos quaisquer (juncoes exatas dao distancia 0 e
 * caem na tolerancia abaixo), e (b) entre caracteres vizinhos da mesma
 * linha (ordinais de tinta consecutivos), medida na geometria real.
 * Folga livre = distancia - largura do risco.
 *
 * Juncoes e cruzamentos intencionais (vertice e barra do A, R, 4, Q)
 * tocam-se exatamente -> distancia 0 -> ignorados pela tolerancia de
 * 0,05 mm (que tambem absorve o erro de amostragem dos arcos). O, B e D
 * preservam o vazio interno pela propria geometria (sem casos especiais).
 * Cruzamentos sao testados por intersecao EXATA (segmento-segmento,
 * reta-circulo, circulo-circulo), nao so por amostragem; distancias em
 * arcos usam polilinha densificada (passo ? 5graus) com rejeicao por caixas.
 */
import { ValidationError } from '../validation/validationEngine';
import { layoutText } from './layout';

const IGNORE_DIST = 0.05;
const ARC_STEP_DEG = 5;
const EPS = 1e-9;

const trim = (v) => String(Number(v.toFixed(3)));

function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}
function cross(a, b) {
  return a[0] * b[1] - a[1] * b[0];
}

// Distancia ponto->segmento (com ponto mais proximo).
function ptSeg(p, a, b) {
  const ab = sub(b, a);
  const len2 = dot(ab, ab);
  let t = len2 > 0 ? dot(sub(p, a), ab) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const c = [a[0] + ab[0] * t, a[1] + ab[1] * t];
  return { dist: Math.hypot(p[0] - c[0], p[1] - c[1]), closest: c };
}

// Segmentoxsegmento exato (com intersecao, inclusive colinear sobreposta).
function segSeg(p1, p2, p3, p4) {
  const r = sub(p2, p1);
  const s = sub(p4, p3);
  const d = cross(r, s);
  if (Math.abs(d) > EPS) {
    const t = cross(sub(p3, p1), s) / d;
    const u = cross(sub(p3, p1), r) / d;
    if (t >= -EPS && t <= 1 + EPS && u >= -EPS && u <= 1 + EPS) {
      const tc = Math.max(0, Math.min(1, t));
      const hit = [p1[0] + r[0] * tc, p1[1] + r[1] * tc];
      return { dist: 0, touches: true, mid: hit };
    }
  } else if (Math.abs(cross(sub(p3, p1), r)) <= EPS) {
    // Colineares: sobreposicao de projecoes?
    const len2 = dot(r, r);
    if (len2 > 0) {
      const t0 = dot(sub(p3, p1), r) / len2;
      const t1 = dot(sub(p4, p1), r) / len2;
      const lo = Math.max(0, Math.min(t0, t1));
      const hi = Math.min(1, Math.max(t0, t1));
      if (hi >= lo - EPS) {
        const m = (lo + hi) / 2;
        const hit = [p1[0] + r[0] * m, p1[1] + r[1] * m];
        return { dist: 0, touches: true, mid: hit };
      }
    } else if (Math.hypot(p3[0] - p1[0], p3[1] - p1[1]) <= EPS) {
      return { dist: 0, touches: true, mid: [p1[0], p1[1]] };
    }
  }
  let best = null;
  for (const [p, a, b] of [[p1, p3, p4], [p2, p3, p4], [p3, p1, p2], [p4, p1, p2]]) {
    const r0 = ptSeg(p, a, b);
    if (!best || r0.dist < best.dist) best = { dist: r0.dist, mid: r0.closest };
  }
  return { dist: best.dist, touches: false, mid: best.mid };
}

// Angulo dentro da varredura do arco (origem a0, direcao por cw)?
function arcCovers(a0, sweep, cw, theta) {
  const twoPi = 2 * Math.PI;
  let rel = cw ? a0 - theta : theta - a0;
  rel = ((rel % twoPi) + twoPi) % twoPi;
  return rel <= sweep + 1e-9;
}

// Intersecao exata reta( p1p2 )xcirculo(c, r): pontos dentro do segmento.
function lineCircleHits(p1, p2, c, r) {
  const d = sub(p2, p1);
  const f = sub(p1, c);
  const a = dot(d, d);
  if (a <= 0) return [];
  const b = 2 * dot(f, d);
  const cc = dot(f, f) - r * r;
  const disc = b * b - 4 * a * cc;
  if (disc < -EPS) return [];
  const sq = Math.sqrt(Math.max(0, disc));
  return [(-b - sq) / (2 * a), (-b + sq) / (2 * a)]
    .filter((t) => t >= -EPS && t <= 1 + EPS)
    .map((t) => [p1[0] + d[0] * t, p1[1] + d[1] * t]);
}

// Intersecao exata circuloxcirculo.
function circleCircleHits(c0, r0, c1, r1) {
  const d = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]);
  if (d > r0 + r1 + EPS || d < Math.abs(r0 - r1) - EPS || d <= EPS) return [];
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d);
  const h2 = r0 * r0 - a * a;
  const xm = c0[0] + (a * (c1[0] - c0[0])) / d;
  const ym = c0[1] + (a * (c1[1] - c0[1])) / d;
  if (h2 <= EPS) return [[xm, ym]];
  const h = Math.sqrt(h2);
  const rx = (-(c1[1] - c0[1]) * h) / d;
  const ry = ((c1[0] - c0[0]) * h) / d;
  return [[xm + rx, ym + ry], [xm - rx, ym - ry]];
}

function arcRange(seg, from) {
  const r = Math.hypot(from[0] - seg.c[0], from[1] - seg.c[1]);
  const a0 = Math.atan2(from[1] - seg.c[1], from[0] - seg.c[0]);
  const a1 = Math.atan2(seg.to[1] - seg.c[1], seg.to[0] - seg.c[0]);
  let sweep = seg.cw ? a0 - a1 : a1 - a0;
  while (sweep <= 0) sweep += 2 * Math.PI;
  return { c: seg.c, r, a0, sweep, cw: seg.cw };
}

// Cruzamento exato entre dois segmentos originais (L ou A).
function crossesExact(s1, p1from, s2, p2from) {
  if (s1.t === 'L' && s2.t === 'L') {
    return segSeg(p1from, s1.to, p2from, s2.to).touches;
  }
  if (s1.t === 'A' && s2.t === 'A') {
    const A = arcRange(s1, p1from);
    const B = arcRange(s2, p2from);
    if (A.r <= EPS || B.r <= EPS) return false;
    return circleCircleHits(A.c, A.r, B.c, B.r).some(
      (p) =>
        arcCovers(A.a0, A.sweep, A.cw, Math.atan2(p[1] - A.c[1], p[0] - A.c[0])) &&
        arcCovers(B.a0, B.sweep, B.cw, Math.atan2(p[1] - B.c[1], p[0] - B.c[0])),
    );
  }
  const line = s1.t === 'L' ? { p: p1from, q: s1.to } : { p: p2from, q: s2.to };
  const arc = s1.t === 'A' ? { s: s1, from: p1from } : { s: s2, from: p2from };
  const R = arcRange(arc.s, arc.from);
  if (R.r <= EPS) return false;
  return lineCircleHits(line.p, line.q, R.c, R.r).some((p) =>
    arcCovers(R.a0, R.sweep, R.cw, Math.atan2(p[1] - R.c[1], p[0] - R.c[0])),
  );
}

// Densifica arco em subsegmentos (passo ? 5graus) + bbox; com memo por objeto.
const ARC_STEP_CAP = 5;

function densify(seg, from, cache) {
  const hit = cache.get(seg);
  if (hit) return hit;
  const R = arcRange(seg, from);
  const step = (ARC_STEP_CAP * Math.PI) / 180;
  const n = Math.max(1, Math.ceil((R.sweep + EPS) / step));
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = seg.cw ? R.a0 - (R.sweep * i) / n : R.a0 + (R.sweep * i) / n;
    pts.push([seg.c[0] + R.r * Math.cos(a), seg.c[1] + R.r * Math.sin(a)]);
  }
  const subs = [];
  for (let i = 0; i + 1 < pts.length; i++) subs.push([pts[i], pts[i + 1]]);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  }
  const out = { subs, bbox: { minX, minY, maxX, maxY } };
  cache.set(seg, out);
  return out;
}

function segBBoxL(from, to) {
  return {
    minX: Math.min(from[0], to[0]),
    minY: Math.min(from[1], to[1]),
    maxX: Math.max(from[0], to[0]),
    maxY: Math.max(from[1], to[1]),
  };
}

function bboxGap(a, b) {
  const dx = Math.max(0, Math.max(a.minX - b.maxX, b.minX - a.maxX));
  const dy = Math.max(0, Math.max(a.minY - b.maxY, b.minY - a.maxY));
  return Math.hypot(dx, dy);
}

// Menor distancia entre dois segmentos originais (com cruzamento exato).
function pairDistance(e1, e2, cache) {
  const { seg: s1, from: f1 } = e1;
  const { seg: s2, from: f2 } = e2;
  if (crossesExact(s1, f1, s2, f2)) {
    const m = [(f1[0] + f2[0]) / 2, (f1[1] + f2[1]) / 2];
    return { dist: 0, mid: m };
  }
  const subs1 = s1.t === 'L' ? [[f1, s1.to]] : densify(s1, f1, cache).subs;
  const subs2 = s2.t === 'L' ? [[f2, s2.to]] : densify(s2, f2, cache).subs;
  let best = null;
  for (const [a, b] of subs1) {
    for (const [c, d] of subs2) {
      const r = segSeg(a, b, c, d);
      if (!best || r.dist < best.dist) best = { dist: r.dist, mid: r.mid };
    }
  }
  return best;
}

function pairBBox(e, cache) {
  const { seg, from } = e;
  if (seg.t === 'L') return segBBoxL(from, seg.to);
  return densify(seg, from, cache).bbox;
}

/**
 * @param {object} layout saida de layoutText
 * @param {number} largura largura do risco (mm) - deve ser finita > 0
 * @param {object} opts { minClearanceFactor = 0.5 }
 * @returns {{ nivel: 'verde'|'amarelo'|'vermelho', folgaMinima,
 *   pior: null|{ caracteres, tipo, posicao }, alertas: [],
 *   dentro: null|{ distancia, folga, pior }, entre: null|{...} }}
 *   alerta = { tipo: 'dentro'|'entre', caracteres, folga, causa, sugestao,
 *   posicao: {x, y} }.
 *   dentro/entre trazem o minimo de cada tipo (null sem pares do tipo) e
 *   o pior alerta do tipo (null sem alerta); o global segue mandando no
 *   diagnostico. Ponto '.': dentro sempre aceito (ponto cheio - um risco
 *   que preencha o circulo nao e erro nem alerta); com vizinhos vale como
 *   traco comum. Folga infinita nunca vira pior ponto (pior so nasce de
 *   alerta real).
 */
export function analyzeLegibility(layout, largura, opts = {}) {
  if (!(typeof largura === 'number' && Number.isFinite(largura) && largura > 0)) {
    throw new ValidationError('INVALID_GROOVE', 'risco', 'Largura do risco deve ser n\u00famero maior que zero.');
  }
  const factor = opts.minClearanceFactor ?? 0.5;
  if (!(typeof factor === 'number' && Number.isFinite(factor) && factor >= 0)) {
    throw new ValidationError('INVALID_CLEARANCE', 'folga', 'Fator de folga m\u00ednima deve ser n\u00famero maior ou igual a zero.');
  }
  const minClear = factor * largura;
  const cache = new Map();

  // Agrupa tracos por caractere (linha, gi).
  const groups = new Map();
  for (const st of layout.strokes) {
    const key = `${st.line}:${st.gi}`;
    if (!groups.has(key)) groups.set(key, { ch: st.ch, line: st.line, segs: [] });
    const g = groups.get(key);
    let cur = st.from;
    for (const sg of st.segs) {
      g.segs.push({ seg: sg, from: cur });
      cur = sg.to;
    }
  }
  const ordered = [...groups.values()].sort((a, b) => a.line - b.line || 0);

  // Pares: (a) dentro do caractere; (b) entre vizinhos da mesma linha.
  // Duas podas independentes: alertas exigem avaliacao de todo par que
  // possa violar (gap < largura + minima); a folga minima global usa
  // branch-and-bound (pula par cujo gap ja supera o melhor achado).
  const limit = largura + minClear;
  const alertas = [];
  let bestDist = Infinity;
  let bestMid = null;
  const bestTipo = { dentro: { dist: Infinity, mid: null }, entre: { dist: Infinity, mid: null } };
  const piorTipo = { dentro: null, entre: null };

  const consider = (tipo, caracteres, e1, e2) => {
    const gap = bboxGap(pairBBox(e1, cache), pairBBox(e2, cache));
    // Poda segura para os DOIS minimos: a distancia real e ? gap, entao o
    // par so e inutil quando nao melhora nem o global nem o do tipo (um par
    // que nao melhora o global ainda pode ser o melhor do tipo). Pares com
    // gap < limit sempre avaliam (podem alertar).
    if (gap >= limit && gap >= bestDist && gap >= bestTipo[tipo].dist) return;
    const { dist, mid } = pairDistance(e1, e2, cache);
    if (dist < IGNORE_DIST) return;
    if (dist < bestDist) {
      bestDist = dist;
      bestMid = mid;
    }
    if (dist < bestTipo[tipo].dist) bestTipo[tipo] = { dist, mid };
    const folga = dist - largura;
    if (folga < minClear) {
      const alerta = {
        tipo,
        caracteres,
        folga,
        causa: `linhas centrais a ${trim(dist)} mm com risco ${trim(largura)} mm (folga ${trim(folga)} mm)`,
        sugestao: tipo === 'dentro'
          ? 'Aumentar o espa\u00e7amento n\u00e3o resolve: use altura maior ou ferramenta mais fina.'
          : 'Aumente o espa\u00e7amento extra entre letras.',
        posicao: { x: mid[0], y: mid[1] },
      };
      alertas.push(alerta);
      if (!piorTipo[tipo] || folga < piorTipo[tipo].folga) piorTipo[tipo] = alerta;
    }
  };

  for (const g of ordered) {
    // Ponto cheio: dentro do '.' qualquer risco e aceito, sem erro nem
    // alerta (o par das duas metades divide os extremos e seria aparente).
    if (g.ch === '.') continue;
    for (let i = 0; i < g.segs.length; i++) {
      for (let j = i + 1; j < g.segs.length; j++) {
        consider('dentro', g.ch, g.segs[i], g.segs[j]);
      }
    }
  }
  for (let k = 0; k + 1 < ordered.length; k++) {
    const a = ordered[k];
    const b = ordered[k + 1];
    if (a.line !== b.line) continue;
    for (const e1 of a.segs) {
      for (const e2 of b.segs) {
        consider('entre', `${a.ch}-${b.ch}`, e1, e2);
      }
    }
  }

  const nivel = alertas.some((a) => a.folga <= 0)
    ? 'vermelho'
    : alertas.length > 0
      ? 'amarelo'
      : 'verde';
  const folgaMinima = bestDist === Infinity ? Infinity : bestDist - largura;
  const pior =
    alertas.length > 0
      ? alertas.reduce((a, b) => (b.folga < a.folga ? b : a))
      : null;
  const piorOut = pior
    ? { caracteres: pior.caracteres, tipo: pior.tipo, posicao: pior.posicao }
    : null;
  const pack = (tipo) => {
    const b = bestTipo[tipo];
    if (b.dist === Infinity) return null;
    const w = piorTipo[tipo];
    return {
      distancia: b.dist,
      folga: b.dist - largura,
      pior: w ? { caracteres: w.caracteres, tipo: w.tipo, posicao: w.posicao } : null,
    };
  };
  return { nivel, folgaMinima, pior: piorOut, alertas, dentro: pack('dentro'), entre: pack('entre') };
}

// Texto unico do pior ponto para tela e cabecalho (fonte unica: nunca
// "undefined"). "dentro do K"; "entre R e I". Null sem pior ponto.
export function describeWorst(pior) {
  if (!pior || typeof pior.caracteres !== 'string' || typeof pior.tipo !== 'string') return null;
  if (pior.tipo === 'dentro') return `dentro do ${pior.caracteres}`;
  if (pior.tipo === 'entre') {
    const parts = pior.caracteres.split('-');
    if (parts.length === 2 && parts[0] && parts[1]) return `entre ${parts[0]} e ${parts[1]}`;
    return `entre ${pior.caracteres}`;
  }
  return `${pior.tipo} em ${pior.caracteres}`;
}

export function viableRange(minLegHeight, maxHeight) {
  const viable =
    typeof minLegHeight === 'number' &&
    Number.isFinite(minLegHeight) &&
    typeof maxHeight === 'number' &&
    Number.isFinite(maxHeight) &&
    minLegHeight <= maxHeight;
  return { viable };
}

/**
 * Altura minima legivel por bissecao (a folga cresce com a altura para
 * espacamento extra ? 0 e tinta dentro de [0, advance] - ver teste de
 * precondicao da fonte). Arredondada PARA CIMA a 0,1 mm.
 * @returns {{ legible: boolean, height: number|null }}
 */
export function minLegibleHeight({ text, font, letterSpacing = 0, lineHeightFactor = 1.6, grooveWidth, minClearanceFactor = 0.5 }) {
  if (!(typeof grooveWidth === 'number' && Number.isFinite(grooveWidth) && grooveWidth > 0)) {
    throw new ValidationError('INVALID_GROOVE', 'risco', 'Largura do risco deve ser n\u00famero maior que zero.');
  }
  if (letterSpacing < 0) {
    throw new ValidationError('INVALID_SPACING', 'espacamento', 'Espa\u00e7amento extra negativo inviabiliza a busca (use \u2265 0).');
  }
  const green = (h) =>
    analyzeLegibility(
      layoutText(text, font, { height: h, letterSpacing, lineHeightFactor, x0: 0, y0: 0 }),
      grooveWidth,
      { minClearanceFactor },
    ).nivel === 'verde';
  if (!green(50)) return { legible: false, height: null };
  let lo = 0;
  let hi = 50;
  for (let i = 0; i < 20; i++) {
    const mid = (lo + hi) / 2;
    if (green(mid)) hi = mid;
    else lo = mid;
  }
  // Menor decimo verde (a bissecao deixa hi logo acima do limiar; quando o
  // limiar cai num multiplo exato de 0,1, o ceil puro devolveria +0,1
  // desnecessario - ex.: ABE limita em 5,0 mas retornava 5,1).
  let tenths = Math.ceil(hi * 10 - 1e-9);
  for (let guard = 0; guard < 600 && tenths > 1; guard++) {
    if (!green((tenths - 1) / 10)) break;
    tenths -= 1;
  }
  return { legible: true, height: tenths / 10 };
}

// Exportacao exige confirmacao explicita so no vermelho.
export function canExport(nivel, acked) {
  if (nivel !== 'vermelho') return true;
  return acked === true;
}
