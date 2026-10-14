/**
 * Motor geométrico do Gravador de Textos CNC (puro, sem React).
 *
 * `layoutText` posiciona os traços da fonte em coordenadas absolutas
 * (máquina, mm, Y para cima, origem do texto em (x0, y0)).
 *
 * Três medidas horizontais (não confundir):
 *  - largura geométrica: o que o desenho ocupa (bbox);
 *  - avanço do caractere: origem→origem, já com o espaço natural dentro;
 *    ESCALA junto com a altura;
 *  - espaçamento extra: ajuste do operador, somado ao avanço, em mm reais
 *    SEM escala (o valor digitado é o que se mede na peça).
 */
import { ValidationError } from '../validation/validationEngine';

const DIACRITICS = /[̀-ͯ]/g;

function normalizeChar(raw) {
  const stripped = raw.normalize('NFD').replace(DIACRITICS, '');
  return { stripped, upper: stripped.toUpperCase() };
}

// Ângulo varrido (graus, 0–360) e flags SVG de um arco, a partir do ponto
// inicial e do segmento. `cw: true` = horário visto de +Z. Como a prévia
// inverte o Y (tela Y-para-baixo, ponto (x,−y)), o sentido espelha: na tela,
// horário-na-máquina percorre ângulo CRESCENTE — logo cw:true → sweep-flag
// 1, cw:false → sweep-flag 0 (o inverso do que a intuição sugere; provado
// pelo teste de regressão do ponto médio). `large-arc` segue só do ângulo
// varrido (arcos acima de 180° existem: 2, 3, S).
export function describeArc(from, seg) {
  const r = Math.hypot(from[0] - seg.c[0], from[1] - seg.c[1]);
  const a0 = Math.atan2(from[1] - seg.c[1], from[0] - seg.c[0]);
  const a1 = Math.atan2(seg.to[1] - seg.c[1], seg.to[0] - seg.c[0]);
  let sweep = seg.cw ? a0 - a1 : a1 - a0;
  while (sweep <= 0) sweep += 2 * Math.PI;
  const sweepDeg = (sweep * 180) / Math.PI;
  return {
    radius: r,
    sweepDeg,
    largeArc: sweepDeg > 180 ? 1 : 0,
    sweepFlag: seg.cw ? 1 : 0,
  };
}

// Comprimento total de corte dos traços (retas + arcos), em mm.
export function measureCutLength(strokes) {
  let total = 0;
  for (const st of strokes) {
    let cur = st.from;
    for (const s of st.segs) {
      if (s.t === 'L') {
        total += Math.hypot(s.to[0] - cur[0], s.to[1] - cur[1]);
      } else if (s.t === 'A') {
        const { radius, sweepDeg } = describeArc(cur, s);
        total += radius * (sweepDeg * Math.PI) / 180;
      }
      cur = s.to;
    }
  }
  return total;
}

function sampleSeg(cur, s, push) {
  push(cur);
  if (s.t === 'A') {
    const r = Math.hypot(cur[0] - s.c[0], cur[1] - s.c[1]);
    const a0 = Math.atan2(cur[1] - s.c[1], cur[0] - s.c[0]);
    const { sweepDeg } = describeArc(cur, s);
    const sweep = (sweepDeg * Math.PI) / 180;
    const n = Math.max(8, Math.ceil((sweep / (2 * Math.PI)) * 72));
    for (let i = 1; i < n; i++) {
      const a = s.cw ? a0 - (sweep * i) / n : a0 + (sweep * i) / n;
      push([s.c[0] + r * Math.cos(a), s.c[1] + r * Math.sin(a)]);
    }
  }
  push(s.to);
}

const fmtNum = (v) => String(Number(v.toFixed(3)));

/**
 * @param {string} text texto (pode ter \n)
 * @param {object} font fonte validada `{ font: { height_ref }, glyphs }`
 * @param {object} params { height=10, letterSpacing=0, lineHeightFactor=1.6,
 *   x0=0, y0=0, availableWidth?, availableHeight? }
 * @returns {{ strokes, warnings, bounds, lines, stats }}
 *   strokes: [{ from:[x,y], segs:[{t,to[,c,cw]}] }] absolutos, em ordem,
 *   sem otimização de percurso; warnings: string[]; bounds:
 *   {minX,minY,maxX,maxY,width,height}; lines: [{index,text,y}];
 *   stats: {chars, cutLength}.
 * @throws {ValidationError} INVALID_HEIGHT (altura ≤ 0) ou INVALID_TEXT
 *   (sem geometria gravável).
 */
export function layoutText(text, font, params = {}) {
  const {
    height = 10,
    letterSpacing = 0,
    lineHeightFactor = 1.6,
    x0 = 0,
    y0 = 0,
    availableWidth = null,
    availableHeight = null,
  } = params;

  if (!(typeof height === 'number' && Number.isFinite(height)) || height <= 0) {
    throw new ValidationError('INVALID_HEIGHT', 'height', 'Altura deve ser maior que zero.');
  }
  if (typeof text !== 'string') {
    throw new ValidationError('INVALID_TEXT', 'text', 'Informe o texto a gravar.');
  }

  const s = height / font.font.height_ref;
  const glyphs = new Map(font.glyphs.map((g) => [g.char, g]));
  const strokes = [];
  const warnings = [];
  const lines = [];
  const accents = [];
  const ignored = [];
  let provisional = false;
  let cutChars = 0;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const eat = (p) => {
    if (p[0] < minX) minX = p[0];
    if (p[1] < minY) minY = p[1];
    if (p[0] > maxX) maxX = p[0];
    if (p[1] > maxY) maxY = p[1];
  };

  const rawLines = text.split('\n');
  rawLines.forEach((rawLine, li) => {
    const yBase = y0 - li * height * lineHeightFactor;
    let cursorX = x0;
    let normLine = '';
    let firstInk = -1;
    let lastInk = -1;
    let lineMinX = Infinity;
    let lineMaxX = -Infinity;
    let charIdx = 0;
    for (const rawCh of rawLine) {
      charIdx += 1;
      const { stripped, upper } = normalizeChar(rawCh);
      if (stripped !== rawCh && !accents.some((a) => a.from === rawCh)) {
        accents.push({ from: rawCh, to: upper.length === 1 ? upper : stripped });
      }
      const glyph = upper.length === 1 ? glyphs.get(upper) : undefined;
      if (!glyph) {
        if (!ignored.includes(rawCh)) ignored.push(rawCh);
        continue;
      }
      normLine += upper;
      if (glyph.provisional) provisional = true;
      if (glyph.strokes.length > 0) {
        cutChars += 1;
        if (firstInk < 0) firstInk = charIdx;
        lastInk = charIdx;
      }
      for (const st of glyph.strokes) {
        const from = [cursorX + st.from[0] * s, yBase + st.from[1] * s];
        const segs = st.segs.map((sg) => {
          if (sg.t === 'L') return { t: 'L', to: [cursorX + sg.to[0] * s, yBase + sg.to[1] * s] };
          return {
            t: 'A',
            to: [cursorX + sg.to[0] * s, yBase + sg.to[1] * s],
            c: [cursorX + sg.c[0] * s, yBase + sg.c[1] * s],
            cw: sg.cw,
          };
        });
        let cur = from;
        const eatBoth = (p) => {
          eat(p);
          if (p[0] < lineMinX) lineMinX = p[0];
          if (p[0] > lineMaxX) lineMaxX = p[0];
        };
        for (const sg of segs) {
          sampleSeg(cur, sg, eatBoth);
          cur = sg.to;
        }
        strokes.push({ from, segs });
      }
      cursorX += glyph.advance * s + letterSpacing;
    }
    lines.push({
      index: li,
      text: normLine,
      y: yBase,
      width: lineMaxX >= lineMinX ? lineMaxX - lineMinX : 0,
      gaps: lastInk > firstInk ? lastInk - firstInk : 0,
    });
  });

  if (strokes.length === 0) {
    throw new ValidationError('INVALID_TEXT', 'text', 'Texto sem caracteres graváveis.');
  }

  if (accents.length > 0) {
    warnings.push(`Acentos removidos: ${accents.map((a) => `${a.from}→${a.to}`).join(', ')}`);
  }
  if (ignored.length > 0) {
    warnings.push(`Ignorados sem glifo: ${ignored.join(', ')}`);
  }
  if (provisional) {
    warnings.push('Zero provisório em uso (desenho do O)');
  }

  const bounds = {
    minX, minY, maxX, maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
  if (availableWidth !== null && availableWidth !== undefined && bounds.width > availableWidth) {
    warnings.push(`Texto excede a área disponível: largura ${fmtNum(bounds.width)} mm > ${fmtNum(availableWidth)} mm`);
  }
  if (availableHeight !== null && availableHeight !== undefined && bounds.height > availableHeight) {
    warnings.push(`Texto excede a área disponível: altura ${fmtNum(bounds.height)} mm > ${fmtNum(availableHeight)} mm`);
  }

  return { strokes, warnings, bounds, lines, stats: { chars: cutChars, cutLength: measureCutLength(strokes) } };
}
