/*
 * previewLayout — helpers de layout para os previews SVG (Heidenhain).
 *
 * - textSize: largura/altura estimadas de um rótulo monoespaçado.
 * - clamp: limita valor a um intervalo.
 * - fitTransform: ajusta o conjunto de pontos (coords de máquina XZ)
 *   para preencher o canvas SVG com margens (escala uniforme, origem
 *   centralizada). `yFlip` = 1 (externo, Z para baixo) | -1 (interno,
 *   Z para cima).
 * - layoutLabels: posiciona rótulos SEM sobreposição (colisão entre
 *   caixas + limites do canvas) e gera linha de chamada (leader) do
 *   ponto âncora até a caixa do rótulo.
 * - arrowHeadPoints: triângulo de seta a partir de um segmento.
 */

export function textSize(text, fontSize) {
  const w = String(text).length * fontSize * 0.62;
  return { w, h: fontSize * 1.25 };
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export function fitTransform(points, viewW, viewH, padX, padY, yFlip, maxScale = 55) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) continue;
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z);
    maxZ = Math.max(maxZ, p.z);
  }
  if (!Number.isFinite(minX)) {
    minX = 0; maxX = 1; minZ = 0; maxZ = 1;
  }

  const spanX = Math.max(maxX - minX, 1e-6);
  const spanZ = Math.max(maxZ - minZ, 1e-6);
  const availW = Math.max(viewW - padX * 2, 1);
  const availH = Math.max(viewH - padY * 2, 1);
  const scale = Math.min(availW / spanX, availH / spanZ, maxScale);

  const centerX = (minX + maxX) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const ox = viewW / 2 - centerX * scale;
  const oy = viewH / 2 - yFlip * centerZ * scale;

  return {
    scale,
    ox,
    oy,
    xOf: (x) => ox + x * scale,
    yOf: (z) => oy + yFlip * z * scale,
    spanX,
    spanZ,
    minX,
    maxX,
    minZ,
    maxZ,
  };
}

const CANDIDATES = [
  [1, 0],
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 1],
  [-1, -1],
  [-1, 1],
  [2, 0],
  [-2, 0],
  [0, -2],
  [0, 2],
];

function boxOverlap(a, b) {
  return !(a.x + a.w < b.x || a.x > b.x + b.w || a.y + a.h < b.y || a.y > b.y + b.h);
}

export function layoutLabels(labels, viewW, viewH, pad = 6) {
  const placed = [];
  return labels
    .slice()
    .sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    .map((L) => {
      const { w, h } = textSize(L.text, L.fontSize);
      const gap = 6;
      let best = null;
      for (const [dx, dy] of CANDIDATES) {
        let bx = L.anchorX + dx * (w / 2 + gap);
        let by = L.anchorY + dy * (h / 2 + gap);
        bx = clamp(bx, pad, Math.max(pad, viewW - w - pad));
        by = clamp(by, pad, Math.max(pad, viewH - h - pad));
        const box = { x: bx, y: by, w, h };
        if (!placed.some((p) => boxOverlap(box, p))) {
          best = box;
          break;
        }
      }
      if (!best) {
        best = {
          x: clamp(L.anchorX + gap, pad, Math.max(pad, viewW - w - pad)),
          y: clamp(L.anchorY + gap, pad, Math.max(pad, viewH - h - pad)),
          w,
          h,
        };
      }
      placed.push(best);

      const lx = clamp(L.anchorX, best.x, best.x + best.w);
      const ly = clamp(L.anchorY, best.y, best.y + best.h);
      return {
        ...L,
        x: best.x,
        y: best.y,
        w: best.w,
        h: best.h,
        leader: { x1: L.anchorX, y1: L.anchorY, x2: lx, y2: ly },
      };
    });
}

export function arrowHeadPoints(x1, y1, x2, y2, size = 7) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const bx = x2 - ux * size;
  const by = y2 - uy * size;
  return `${x2},${y2} ${bx - uy * size * 0.45},${by + ux * size * 0.45} ${bx + uy * size * 0.45},${by - ux * size * 0.45}`;
}
