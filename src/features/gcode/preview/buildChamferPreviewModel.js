/*
 * buildChamferPreviewModel — geometria exata por tangência
 *
 * Peça: bloco retangular com o canto superior-direito chanfrado
 * (largura projetada = C·cosA, profundidade = C·senA — os mesmos
 * termos calculados pelo chamferSolver, garantindo que o desenho
 * reflita exatamente o que a máquina vai executar).
 *
 * Ferramenta: posicionada por tangência exata ao chanfro, mas com
 * as dimensões visuais LIMITADAS ("clamp") ao espaço disponível no
 * canvas, para que nunca seja cortada nem fique desproporcional em
 * relação à peça — este era o defeito principal do preview anterior.
 */

const VIEW_W = 400;
const VIEW_H = 280;
const MARGIN = 14;

export function buildChamferPreviewModel(params, solved) {
  const { C, A, D, r } = params;
  const angRad = (A * Math.PI) / 180;

  // ── Peça (bloco fixo, sempre no mesmo lugar) ─────────────
  const wpL = 36;
  const wpR = 176;
  const wpT = 70;
  const wpB = 250;

  // Chanfro em termos reais (mm), iguais aos usados no G-code
  const profZ = solved?.profZ ?? C * Math.sin(angRad);
  const largX = solved?.largX ?? C * Math.cos(angRad);

  // Conversão mm → px do chanfro, com limites para manter legibilidade
  // (o corte nunca deve "sumir" quando pequeno nem invadir a peça toda
  // quando grande)
  const mmToPx = 6;
  const cutMax = Math.min(wpR - wpL, wpB - wpT) * 0.5;
  const largXpx = clamp(largX * mmToPx, 10, cutMax);
  const profZpx = clamp(profZ * mmToPx, 10, cutMax);

  // Vértice original (aresta viva, canto superior-direito)
  const vx = wpR;
  const vy = wpT;

  // Pontos do chanfro
  const fx = vx - largXpx; // sobre a face superior (horizontal)
  const fy = vy + profZpx; // sobre a face direita (vertical)

  // ── Ferramenta — tamanho proporcional, sempre dentro do canvas ──
  const rPx = clamp(3 + r * 1.6, 5, 16);
  let dPx = clamp(30 + D * 3.2, 40, 92);

  // ── Tangência: reta do chanfro vai de (vx,vy) a (fx,fy) ──
  const dx = fx - vx;
  const dy = fy - vy;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;

  // Normal externa (aponta para fora da peça, onde fica a ferramenta)
  const nx = uy;
  const ny = -ux;

  // Ponto de tangência (meio do chanfro)
  const t = 0.42;
  const Px = vx + t * (fx - vx);
  const Py = vy + t * (fy - vy);

  // Centro do raio útil da ferramenta
  const Ctx = Px + rPx * nx;
  const Cty = Py + rPx * ny;

  // Corpo da ferramenta: raio útil no canto inferior-esquerdo
  let tL = Ctx - rPx;
  let tB = Cty + rPx;
  let tH = dPx * 1.05;
  let tR = tL + dPx;
  let tT = tB - tH;

  // ── Ajuste final: garante que a ferramenta (corpo + haste) nunca
  // seja cortada — limita altura/largura ao espaço realmente livre
  // no canvas, preservando a proporção do retângulo.
  const totalH = tH * 1.3; // corpo + haste superior
  const availH = tB - MARGIN;
  const availW = VIEW_W - MARGIN - tL;
  const shrink = Math.min(1, availH / totalH, availW / dPx);
  if (shrink < 1) {
    dPx *= shrink;
    tH *= shrink;
    tR = tL + dPx;
    tT = tB - tH;
  }

  const model = {
    view: { w: VIEW_W, h: VIEW_H },
    piece: {
      body: [wpL, wpB, wpR, wpB, wpR, wpT, fx, fy, wpL, fy],
    },
    tool: {
      left: tL, right: tR, top: tT, bottom: tB,
      width: dPx, height: tH,
      cornerR: rPx,
      shankX: tL + dPx * 0.3,
      shankW: dPx * 0.4,
      shankH: tH * 0.3,
      shankTop: tT - tH * 0.3,
    },
    tangency: {
      point: [Px, Py],
      center: [Ctx, Cty],
      normal: [nx, ny],
      radius: rPx,
    },
    chamfer: {
      start: [vx, vy],
      end: [fx, fy],
    },
    // Pontos de referência exibidos sobre a ferramenta (estilo
    // "centro de rotação + cantos de referência"), como nas peças
    // de referência do chanfro/arredondamento.
    markers: {
      center: [tL + dPx * 0.42, tB - tH * 0.3],
      refA: [tL + dPx * 0.3, tB - tH * 0.14],
      refB: [tL + dPx * 0.58, tB - tH * 0.14],
    },
    dims: { wpL, wpR, wpT, wpB, vx, vy, fx, fy },
    params,
  };

  model.highlights = {
    L: {
      pts: [wpL, wpT - 18, wpR, wpT - 18],
      label: `L=${params.L}`,
      cx: (wpL + wpR) / 2, cy: wpT - 28,
    },
    C: {
      pts: [vx, vy, fx, fy],
      label: `C=${params.C}`,
      cx: (vx + fx) / 2, cy: (vy + fy) / 2 - 10,
    },
    A: {
      arc: { cx: vx, cy: vy, r: Math.min(18, largXpx * 0.5), a1: 0, a2: angRad },
      label: `${params.A}°`,
      cx: vx + Math.min(18, largXpx * 0.5) + 6, cy: vy - 7,
    },
    D: {
      pts: [tR + 10, tT + 8, tR + 10, tB - 8],
      label: `D=${params.D}`,
      cx: tR + 26, cy: (tT + tB) / 2 + 4,
    },
    r: {
      arc: { cx: Ctx, cy: Cty, r: rPx, a1: Math.PI, a2: 1.5 * Math.PI },
      label: `r=${params.r}`,
      cx: tL - rPx - 10, cy: Cty - 2,
    },
    passeZ: {
      pts: [wpL - 20, vy, wpL - 20, fy],
      label: `pZ=${params.passeZ}`,
      cx: wpL - 28, cy: (vy + fy) / 2 + 4,
    },
  };

  return model;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
