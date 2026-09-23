/*
 * buildRoundingPreviewModel — geometria exata por tangência
 *
 * Peça: representada como um DEGRAU (parede + piso), porque o
 * arredondamento de "aresta reta" concordância mais comum na prática
 * é o canto REENTRANTE onde uma parede encontra o piso (rebaixo,
 * saliência, batente). O raio R concorda esse canto côncavo — por
 * isso o arco é desenhado "afundado" no canto, e não "quebrando"
 * um canto externo, como estava antes.
 *
 * Ferramenta: posicionada por tangência exata ao arco, com as
 * dimensões visuais limitadas ("clamp") ao espaço livre do canvas,
 * para nunca ficar cortada nem desproporcional à peça.
 */

const VIEW_W = 400;
const VIEW_H = 280;
const MARGIN = 14;

export function buildRoundingPreviewModel(params, solved) {
  const { R, D, r } = params;

  // ── Peça: piso (base) + parede (degrau à direita) ────────
  const floorL = 30;
  const floorR = 300;
  const floorB = 250;
  const floorT = 168; // topo do piso = onde a parede "pousa"

  const wallL = 210;
  const wallR = floorR; // parede alinhada com a borda direita do piso
  const wallT = 30;
  const wallB = floorT;

  // Vértice reentrante (canto côncavo onde parede encontra piso)
  const vx = wallL;
  const vy = floorT;

  // Raio do arredondamento em px, limitado ao espaço disponível
  // no canto (não pode ser maior que a parede é alta nem que o
  // piso é largo naquele trecho)
  const mmToPx = 6;
  const rMax = Math.min(vy - wallT, vx - floorL) * 0.6;
  const Rpx = clamp(R * mmToPx, 10, rMax);

  // Pontos onde o arco encontra as duas faces
  const arcTopPt = [vx, vy - Rpx];     // sobre a face vertical da parede
  const arcLeftPt = [vx - Rpx, vy];    // sobre a face horizontal do piso

  // Centro do arco: afastado do vértice na diagonal (para dentro
  // do material), criando a concordância côncava
  const archCx = vx - Rpx;
  const archCy = vy - Rpx;

  // ── Ferramenta — tamanho proporcional, sempre dentro do canvas ──
  const rPx = clamp(3 + r * 1.6, 5, 16);
  let dPx = clamp(30 + D * 3.2, 40, 92);

  // ── Tangência: ferramenta tangente ao arco, na bissetriz do canto ──
  // Direção externa (para fora do material, onde fica a ferramenta):
  // aponta para cima e para a esquerda (bissetriz do canto reentrante)
  const nx = -Math.SQRT1_2;
  const ny = -Math.SQRT1_2;

  // Distância entre centros para tangência externa entre dois arcos
  const dist = Rpx + rPx;
  const Ctx = archCx + dist * nx;
  const Cty = archCy + dist * ny;

  // Ponto de tangência sobre o arco da peça
  const Tx = archCx + Rpx * nx;
  const Ty = archCy + Rpx * ny;

  // Corpo da ferramenta: raio útil no canto inferior-direito
  // (a peça fica abaixo/à direita da ferramenta neste layout)
  let tR = Ctx + rPx;
  let tB = Cty + rPx;
  let tH = dPx * 1.05;
  let tL = tR - dPx;
  let tT = tB - tH;

  // ── Ajuste final: nunca cortar a ferramenta (corpo + haste) ──
  const totalH = tH * 1.3;
  const availH = tB - MARGIN;
  const availW = tR - MARGIN;
  const shrink = Math.min(1, availH / totalH, availW / dPx);
  if (shrink < 1) {
    dPx *= shrink;
    tH *= shrink;
    tL = tR - dPx;
    tT = tB - tH;
  }

  const model = {
    view: { w: VIEW_W, h: VIEW_H },
    piece: {
      // Contorno completo: piso + parede + arco côncavo no canto
      floor: { l: floorL, r: floorR, t: floorT, b: floorB },
      wall: { l: wallL, r: wallR, t: wallT, b: wallB },
      arc: { cx: archCx, cy: archCy, r: Rpx, from: arcTopPt, to: arcLeftPt },
    },
    tool: {
      left: tL, right: tR, top: tT, bottom: tB,
      width: dPx, height: tH,
      cornerR: rPx,
      shankX: tR - dPx * 0.7,
      shankW: dPx * 0.4,
      shankH: tH * 0.3,
      shankTop: tT - tH * 0.3,
    },
    tangency: {
      point: [Tx, Ty],
      center: [Ctx, Cty],
      normal: [nx, ny],
      radius: rPx,
      workpieceRadius: Rpx,
    },
    markers: {
      center: [tR - dPx * 0.42, tB - tH * 0.3],
      refA: [tR - dPx * 0.3, tB - tH * 0.14],
      refB: [tR - dPx * 0.58, tB - tH * 0.14],
    },
    dims: { wpL: floorL, wpR: floorR, wpT: wallT, wpB: floorB, vx, vy },
    params,
  };

  model.highlights = {
    L: {
      pts: [floorL, wallT - 18, floorR, wallT - 18],
      label: `L=${params.L}`,
      cx: (floorL + floorR) / 2, cy: wallT - 28,
    },
    R: {
      arc: { cx: archCx, cy: archCy, r: Rpx, a1: Math.PI, a2: 1.5 * Math.PI },
      label: `R=${params.R}`,
      cx: vx - Rpx * 0.6 - 14, cy: vy - Rpx * 0.6,
    },
    D: {
      pts: [tL - 10, tT + 8, tL - 10, tB - 8],
      label: `D=${params.D}`,
      cx: tL - 30, cy: (tT + tB) / 2 + 4,
    },
    r: {
      arc: { cx: Ctx, cy: Cty, r: rPx, a1: 0, a2: Math.PI / 2 },
      label: `r=${params.r}`,
      cx: tR + rPx + 12, cy: Cty - 2,
    },
    incrZ: {
      pts: [floorL - 20, vy, floorL - 20, arcTopPt[1]],
      label: `dZ=${params.incrZ}`,
      cx: floorL - 28, cy: (vy + arcTopPt[1]) / 2 + 4,
    },
  };

  return model;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
