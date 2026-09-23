/*
 * buildInternalRadiusPreviewModel
 *
 * Preview para raio em canto interno (L).
 *
 * Peça em L:
 *   parede vertical à esquerda (x=WALL); base horizontal em y=BASE.
 *   Canto interno em (WALL, BASE).
 *
 * Raio interno (canto substituído por arco de raio R):
 *   centro do arco: (WALL + R, BASE + R)
 *   arco vai da parede (WALL, BASE+R) até a base (WALL+R, BASE)
 *   ângulos: de π a 3π/2 (padrão matemático)
 *
 * Tangência:
 *   O centro do raio útil da ponta da ferramenta (r) deve estar à
 *   distância R+r do centro do arco da peça, na direção da bissetriz
 *   do canto interno que aponta para o vão (esquerda+cima em SVG = -x, -y):
 *     vetor bissetriz: vb = (-√2/2, -√2/2)
 *     centro da ferramenta: Ct = C_arco + (R+r)·vb
 *
 *   Corpo da ferramenta ancorado em Ct (mesma lógica do chanfro interno):
 *     right = Ct.x + r
 *     bottom = Ct.y + r
 *     left = right - D
 *     top = bottom - D·1.3
 */

export function buildInternalRadiusPreviewModel(params, solved) {
  const { R, D, r } = params;

  // escala visual
  const baseScale = Math.min(1.6, 0.5 + D * 0.07);
  const dPx = Math.max(60, Math.min(130, 50 + D * baseScale * 3));
  const rPx = Math.max(6, Math.min(30, 2 + r * baseScale * 3));
  const rArcPx = Math.max(10, Math.min(48, 4 + R * baseScale * 4));

  // ── Peça em L ───────────────────────────────────────────
  const WALL = 80;
  const BASE = 180;
  const LEFT = 20;
  const TOP = 30;
  const RIGHT = 380;
  const BOTTOM = 270;

  // Centro do arco do raio interno
  const arcCX = WALL + rArcPx;
  const arcCY = BASE + rArcPx;

  // Pontos do arco na parede e na base
  const arcWx = WALL;
  const arcWy = BASE + rArcPx;      // ponto na parede
  const arcBx = WALL + rArcPx;      // ponto na base
  const arcBy = BASE;

  // ── Tangência ───────────────────────────────────────────
  // Bissetriz do canto interno (aponta para o vão: esquerda+cima em SVG)
  const bis = Math.SQRT1_2; // √2/2 ≈ 0.707
  const nx = -bis;  // para a esquerda
  const ny = -bis;  // para cima

  const dist = rArcPx + rPx;
  const Ctx = arcCX + dist * nx;
  const Cty = arcCY + dist * ny;

  // Ponto de tangência sobre o arco da peça
  const Tx = arcCX + rArcPx * nx;
  const Ty = arcCY + rArcPx * ny;

  // ── Corpo da ferramenta ─────────────────────────────────
  const tR = Ctx + rPx;
  const tB = Cty + rPx;
  const tL = tR - dPx;
  const tH = dPx * 1.3;
  const tT = tB - tH;

  const shankW = dPx * 0.44;
  const shankH = tH * 0.35;
  const shankX = tL + (dPx - shankW) / 2;
  const shankTop = tT - shankH;

  // ── Ângulos do arco para SVG ──────────────────────────
  // O arco vai do ângulo π (esquerda) ao ângulo 3π/2 (cima).
  // Em SVG (y invertido), usamos os mesmos ângulos padrão matemáticos.
  // a1: ângulo inicial (na parede = π)
  // a2: ângulo final (na base = 3π/2)
  const a1 = Math.PI;
  const a2 = 1.5 * Math.PI;

  // ── Monta modelo ────────────────────────────────────────
  const model = {
    kind: 'internal',
    piece: {
      arc: {
        start: [arcWx, arcWy],
        end: [arcBx, arcBy],
        center: [arcCX, arcCY],
        radius: rArcPx,
        a1, a2,
      },
    },
    tool: {
      left: tL, right: tR, top: tT, bottom: tB,
      width: dPx, height: tH, cornerR: rPx,
      shankX, shankW, shankH, shankTop,
    },
    tangency: {
      point: [Tx, Ty],
      center: [Ctx, Cty],
      normal: [nx, ny],
      radius: rPx,
      workpieceRadius: rArcPx,
    },
    cavity: {
      left: LEFT,
      wall: WALL,
      base: BASE,
      top: TOP,
      right: RIGHT,
    },
    params,
  };

  // ── Cotas destacáveis ──────────────────────────────────
  model.highlights = {};

  model.highlights.R = {
    arc: { cx: arcCX, cy: arcCY, r: rArcPx, a1: Math.PI, a2: 1.5 * Math.PI },
    label: `R ${params.R}`,
    cx: arcCX - 6,
    cy: arcCY + 4,
  };

  model.highlights.D = {
    label: `D ${params.D}`,
    cx: tR + 16,
    cy: (tT + tB) / 2,
  };

  model.highlights.r = {
    arc: { cx: Ctx, cy: Cty, r: rPx, a1: Math.PI, a2: 1.5 * Math.PI },
    label: `r ${params.r}`,
    cx: tL - 6,
    cy: Cty - 2,
  };

  model.highlights.incrZ = {
    pts: [WALL - 18, arcWy, WALL - 18, BASE + rArcPx],
    label: `dZ ${params.incrZ}`,
    cx: WALL - 26,
    cy: (arcWy + BASE + rArcPx) / 2,
  };

  model.highlights.L = {
    pts: [WALL + rArcPx, BASE - 16, RIGHT, BASE - 16],
    label: `L ${params.L}`,
    cx: (WALL + rArcPx + RIGHT) / 2,
    cy: BASE - 25,
  };

  return model;
}
