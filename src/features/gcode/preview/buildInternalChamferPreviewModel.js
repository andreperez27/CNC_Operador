/*
 * buildInternalChamferPreviewModel
 *
 * Preview para chanfro em canto interno (L).
 *
 * Peça em L:
 *   parede vertical à esquerda (x=WALL) da qual o material sólido se estende
 *   para a esquerda; base horizontal em y=BASE da qual o material se estende
 *   para baixo. O encontro forma um canto interno em (WALL, BASE).
 *
 * Chanfro interno (canto substituído por reta inclinada, ângulo A da horizontal):
 *   ponto na parede: (WALL, BASE + C·sen A)
 *   ponto na base:   (WALL + C·cos A, BASE)
 *   direção da reta: d = (cos A, -sen A)
 *
 * Tangência do raio útil da ferramenta:
 *   O centro do raio útil (r) da ponta da fresa deve estar à distância r
 *   da reta do chanfro, do lado do vão. O vão do canto interno L é a região
 *   x > WALL e y < BASE.
 *
 *   Usamos a normal n = (sen A, cos A): centro vai para direita+abaixo
 *   em relação ao ponto de tangência P sobre o chanfro. O corpo da ferramenta
 *   estende-se para cima (dentro do vão) e para a esquerda (para fora do vão).
 *
 *   Centro: Ct = P + r·n
 *   Ferramenta ancorada em Ct:
 *     right = Ct.x + r
 *     bottom = Ct.y + r
 *     left = right - D
 *     top = bottom - D·1.3
 */

export function buildInternalChamferPreviewModel(params, solved) {
  const { C, A, D, r } = params;
  const angRad = A * Math.PI / 180;

  // escala visual
  const baseScale = Math.min(1.6, 0.5 + D * 0.07);
  const dPx = Math.max(60, Math.min(130, 50 + D * baseScale * 3));
  const rPx = Math.max(6, Math.min(30, 2 + r * baseScale * 3));
  const cPx = Math.max(12, Math.min(50, 4 + C * baseScale * 4));

  // ── Peça em L ───────────────────────────────────────────
  // Parede vertical face direita em WALL; material sólido à esquerda.
  // Base horizontal face superior em BASE; material sólido abaixo.
  const WALL = 80;
  const BASE = 180;
  const LEFT = 20;       // borda esquerda do desenho (fundo da parede)
  const TOP = 30;        // topo do desenho
  const RIGHT = 380;     // borda direita da base
  const BOTTOM = 270;    // fundo do desenho

  // Pontos do chanfro no canto interno
  const dChe = cPx * Math.sin(angRad); // descida na parede (para baixo = +y)
  const dChb = cPx * Math.cos(angRad); // avanço na base (para direita = +x)

  const chPx = WALL;
  const chPy = BASE + dChe;            // topo do chanfro na parede
  const chBx = WALL + dChb;            // fim do chanfro na base
  const chBy = BASE;

  // ── Tangência ───────────────────────────────────────────
  // Ponto de tangência no meio do chanfro
  const Px = (chPx + chBx) / 2;
  const Py = (chPy + chBy) / 2;

  // Direção: do chanfro (da parede → base) = (cos A, -sen A)
  // Normal apontando para o vão (direita+abaixo):
  const nx = Math.sin(angRad);
  const ny = Math.cos(angRad);

  // Centro do raio útil da ponta da ferramenta
  const Ctx = Px + rPx * nx;
  const Cty = Py + rPx * ny;

  // ── Corpo da ferramenta ─────────────────────────────────
  // A ferramenta é uma fresa tórica: corpo cilíndrico D, raio de canto r.
  // Na seção transversal: retângulo (D × H) com canto inferior direito
  // arredondado (r). O centro do raio está em (right-r, bottom-r).
  const tR = Ctx + rPx;
  const tB = Cty + rPx;
  const tL = tR - dPx;
  const tH = dPx * 1.3;
  const tT = tB - tH;

  // Haste (parte superior do corpo)
  const shankW = dPx * 0.44;
  const shankH = tH * 0.35;
  const shankX = tL + (dPx - shankW) / 2;
  const shankTop = tT - shankH;

  // ── Perfil da peça ──────────────────────────────────────
  // Polígono do sólido em L: começa no topo da parede, contorna
  // o chanfro e a base, desce à direita, volta pelo fundo.
  // ── Perfil da peça em L côncavo ──────────────────────────
  // Trajeto no sentido horário:
  //   (LEFT,TOP) → topo do desenho
  //   (WALL,TOP) → topo da face da parede (LINHA HORIZONTAL)
  //   (WALL,chPy) → desce pela FACE VERTICAL DA PAREDE até o chanfro
  //   (chBx,BASE) → chanfro (reta inclinada substituindo o canto interno)
  //   (RIGHT,BASE) → FACE HORIZONTAL DA BASE para a direita
  //   (RIGHT,BOTTOM) → desce borda direita
  //   (LEFT,BOTTOM) → fundo para a esquerda
  //   (fecha) → sobe borda esquerda
  const bodyPoints = [
    LEFT, TOP,
    WALL, TOP,         // horizontal: topo da face da parede
    WALL, chPy,        // vertical: face da parede
    chBx, BASE,        // chanfro interno (canto substituído)
    RIGHT, BASE,       // horizontal: face da base
    RIGHT, BOTTOM,     // vertical: borda direita externa
    LEFT, BOTTOM,      // horizontal: fundo
  ];

  // ── Monta modelo ────────────────────────────────────────
  const model = {
    kind: 'internal',
    piece: { body: bodyPoints },
    tool: {
      left: tL, right: tR, top: tT, bottom: tB,
      width: dPx, height: tH, cornerR: rPx,
      shankX, shankW, shankH, shankTop,
    },
    tangency: {
      point: [Px, Py],
      center: [Ctx, Cty],
      normal: [nx, ny],
      radius: rPx,
    },
    chanfro: {
      parede: [chPx, chPy],
      base: [chBx, chBy],
    },
    cavity: {
      wall: WALL,
      base: BASE,
      top: TOP,
      right: RIGHT,
    },
    params,
  };

  // ── Cotas destacáveis ──────────────────────────────────
  model.highlights = {};

  model.highlights.C = {
    pts: [chPx, chPy, chBx, chBy],
    label: `C ${params.C}`,
    cx: (chPx + chBx) / 2 + 6,
    cy: (chPy + chBy) / 2 - 6,
  };

  model.highlights.A = {
    arc: { cx: WALL, cy: BASE, r: Math.min(20, cPx * 0.4), a1: Math.PI / 2, a2: Math.PI / 2 + angRad },
    label: `${params.A}°`,
    cx: WALL + Math.min(20, cPx * 0.4) * 0.7 + 4,
    cy: BASE + 4,
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

  model.highlights.passeZ = {
    pts: [WALL - 18, chPy, WALL - 18, BASE],
    label: `pZ ${params.passeZ}`,
    cx: WALL - 26,
    cy: (chPy + BASE) / 2,
  };

  model.highlights.L = {
    pts: [chBx, BASE - 16, RIGHT, BASE - 16],
    label: `L ${params.L}`,
    cx: (chBx + RIGHT) / 2,
    cy: BASE - 25,
  };

  return model;
}
