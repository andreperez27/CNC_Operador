/**
 * Encaixe em bloco do Gravador de Textos CNC (puro, sem React).
 *
 * Diz se o texto cabe num bloco (largura × altura, com margem) e qual a
 * maior altura de letra que cabe — ajustando SÓ a altura, nunca a
 * proporção (escala uniforme) e sem tocar no espaçamento extra (mm reais).
 *
 * Usa a caixa de TINTA real (bbox dos traços), não o avanço: `layoutText`
 * mede por linha (width, gaps) na altura de referência com espaçamento
 * zero; com escala s = h/height_ref, `largura(h) = s*W0 + gaps*extra`.
 */
import { ValidationError } from '../validation/validationEngine';
import { layoutText } from './layout';

const FIT_TOL = 1e-9;
const VERIFY_TOL = 1e-6;

function usableArea(blockW, blockH, margin) {
  return { availW: blockW - 2 * margin, availH: blockH - 2 * margin };
}

// Texto de excesso ("passa X mm na largura e Y mm na altura", só lados
// violados; '' se cabe). Fonte única da prévia e do cabeçalho do .H.
export function formatExcess(fit) {
  if (!fit || fit.fits) return '';
  const fmt = (v) => String(Number(v.toFixed(3)));
  const parts = [];
  if (fit.overW > 0) parts.push(`passa ${fmt(fit.overW)} mm na largura`);
  if (fit.overH > 0) parts.push(`passa ${fmt(fit.overH)} mm na altura`);
  return parts.join(' e ');
}

function checkBlock(blockW, blockH, margin) {
  if (
    ![blockW, blockH].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0) ||
    !(typeof margin === 'number' && Number.isFinite(margin) && margin >= 0)
  ) {
    throw new ValidationError('INVALID_BLOCK', 'bloco', 'Bloco com dimensões inválidas.');
  }
}

/**
 * @param {string} text texto (pode ter \n)
 * @param {object} font fonte validada
 * @param {object} params { height, letterSpacing=0, lineHeightFactor=1.6,
 *   blockW, blockH, margin=0 }
 * @returns {{ fits, inkWidth, inkHeight, availW, availH, overW, overH,
 *   maxHeight, limitedBy: 'largura'|'altura'|null, message }}
 *   ink/over na altura pedida; maxHeight arredondado PARA BAIXO a 0,1 mm
 *   (null + mensagem quando não cabe em nenhuma altura).
 */
export function fitInBlock(text, font, params = {}) {
  const {
    height,
    letterSpacing = 0,
    lineHeightFactor = 1.6,
    blockW,
    blockH,
    margin = 0,
  } = params;
  checkBlock(blockW, blockH, margin);
  const { availW, availH } = usableArea(blockW, blockH, margin);
  const href = font.font.height_ref;
  const empty = {
    fits: false, inkWidth: 0, inkHeight: 0, availW, availH,
    overW: 0, overH: 0, maxHeight: null, limitedBy: null,
    message: 'Bloco/margem sem área útil para gravar.',
  };
  if (!(availW > 0 && availH > 0)) return empty;

  // Medição na altura de referência, espaçamento zero (layoutText lança
  // INVALID_TEXT/INVALID_HEIGHT quando não há o que medir).
  const ref = layoutText(text, font, { height: href, letterSpacing: 0, lineHeightFactor, x0: 0, y0: 0 });
  const perLine = ref.lines.map((l) => ({ w: l.width, gaps: l.gaps }));
  const maxGaps = Math.max(0, ...perLine.map((l) => l.gaps));

  // Tinta na altura pedida (medição real, não fórmula).
  const atH = layoutText(text, font, { height, letterSpacing, lineHeightFactor, x0: 0, y0: 0 });
  const inkWidth = atH.bounds.width;
  const inkHeight = atH.bounds.height;
  const fits = inkWidth <= availW + FIT_TOL && inkHeight <= availH + FIT_TOL;

  // Limite pela largura, por linha (a mais longa com extra pode não ser a
  // mais longa sem extra — por isso o máximo sobre as linhas).
  let hW = Infinity;
  if (letterSpacing * maxGaps >= availW) {
    return {
      fits, inkWidth, inkHeight, availW, availH,
      overW: Math.max(0, inkWidth - availW),
      overH: Math.max(0, inkHeight - availH),
      maxHeight: null,
      limitedBy: null,
      message: `Não cabe em nenhuma altura: o espaçamento extra (${letterSpacing} mm × ${maxGaps} intervalos) já excede a largura útil (${availW} mm).`,
    };
  }
  for (const l of perLine) {
    if (!(l.w > 0)) continue;
    const h = ((availW - l.gaps * letterSpacing) * href) / l.w;
    if (h < hW) hW = h;
  }
  // Limite pela altura: h*(1 + (linhas-1)*fator).
  const nLines = ref.lines.length;
  const heightDiv = 1 + (nLines - 1) * lineHeightFactor;
  const hH = heightDiv > 0 ? availH / heightDiv : Infinity;

  let maxHeight = Math.floor(Math.min(hW, hH) * 10) / 10;
  const limitedBy = hW <= hH ? 'largura' : 'altura';
  if (maxHeight > 0) {
    // Re-verificação independente (tol 1e-6): garante contra poeira float;
    // um degrau de 0,1 cobre qualquer divergência residual.
    const check = layoutText(text, font, { height: maxHeight, letterSpacing, lineHeightFactor, x0: 0, y0: 0 });
    if (!(check.bounds.width <= availW + VERIFY_TOL && check.bounds.height <= availH + VERIFY_TOL)) {
      maxHeight = Math.floor((maxHeight - 0.1) * 10) / 10;
    }
  }

  return {
    fits,
    inkWidth,
    inkHeight,
    availW,
    availH,
    overW: Math.max(0, inkWidth - availW),
    overH: Math.max(0, inkHeight - availH),
    maxHeight: maxHeight > 0 ? maxHeight : 0,
    limitedBy,
    message: null,
  };
}

/**
 * Ancora o layout no bloco: com bloco, (x0,y0) é o canto inferior esquerdo
 * do bloco. Centralizado (padrão): caixa de tinta centrada na área útil;
 * sem centralizar: tinta ancorada em (x0+margem, y0+margem), compensando o
 * xmin/ymin (translação pura — dimensões intactas).
 *
 * @returns layout novo (strokes/bounds/lines deslocados; resto igual).
 */
export function anchorInBlock(layout, { x0, y0, blockW, blockH, margin = 0, center = true }) {
  checkBlock(blockW, blockH, margin);
  const { availW, availH } = usableArea(blockW, blockH, margin);
  const { minX, minY, maxX, maxY } = layout.bounds;
  const inkW = maxX - minX;
  const inkH = maxY - minY;
  const tx = center ? x0 + margin + (availW - inkW) / 2 : x0 + margin;
  const ty = center ? y0 + margin + (availH - inkH) / 2 : y0 + margin;
  const dx = tx - minX;
  const dy = ty - minY;
  const move = (p) => [p[0] + dx, p[1] + dy];
  return {
    ...layout,
    strokes: layout.strokes.map((st) => ({
      from: move(st.from),
      segs: st.segs.map((sg) =>
        sg.t === 'L'
          ? { t: 'L', to: move(sg.to) }
          : { t: 'A', to: move(sg.to), c: move(sg.c), cw: sg.cw },
      ),
    })),
    bounds: {
      minX: minX + dx,
      minY: minY + dy,
      maxX: maxX + dx,
      maxY: maxY + dy,
      width: inkW,
      height: inkH,
    },
    lines: layout.lines.map((l) => ({ ...l, y: l.y + dy })),
  };
}
