export function getChamferPreviewLayout(params, solved) {
  const { C, A, D, r } = params;

  const angRad = A * Math.PI / 180;

  // Tool dimensions — maior e mais dominante
  const dPx = Math.max(60, Math.min(130, 50 + D * 5));
  const rPx = Math.max(8, Math.min(32, 4 + r * 7));
  const chamPx = Math.max(14, Math.min(50, 6 + C * 8));

  const cDx = chamPx * Math.cos(angRad);
  const cDy = chamPx * Math.sin(angRad);

  // Workpiece — bloco sólido à esquerda
  const wpL = 36;
  const wpR = 176;
  const wpT = 104;
  const wpB = 256;

  // Vértice original e ponto final do chanfro
  const vx = wpR;
  const vy = wpT;
  const fx = wpR - cDx;
  const fy = wpT + cDy;

  // Ferramenta — à direita, maior, sobreposição leve no chanfro
  const tW = dPx;
  const tH = dPx * 1.3;
  const tL = vx - 6;
  const tR = tL + tW;
  const tT = vy - tH * 0.55;
  const tB = tT + tH;

  return {
    wpL, wpR, wpT, wpB,
    vx, vy, fx, fy,
    tL, tR, tT, tB, tW, tH,
    cDx, cDy, chamPx, rPx, dPx,
    params,
    W: 400, H: 280,
  };
}

const PARAM_DEFS = {
  L: {
    label: 'Comprimento da aresta',
    get(l) {
      const y = l.wpT - 20;
      return {
        pts: [l.wpL, y, l.wpR, y],
        label: `L=${l.params.L}`,
        cx: (l.wpL + l.wpR) / 2, cy: y - 10,
      };
    },
  },
  C: {
    label: 'Largura do chanfro',
    get(l) {
      return {
        pts: [l.vx, l.vy, l.fx, l.fy],
        label: `C=${l.params.C}`,
        cx: (l.vx + l.fx) / 2 - 16, cy: (l.vy + l.fy) / 2 - 8,
      };
    },
  },
  A: {
    label: 'Ângulo do chanfro',
    get(l) {
      const aR = Math.min(20, l.chamPx * 0.4);
      return {
        arc: { cx: l.vx, cy: l.vy, r: aR, a1: 0, a2: l.params.A * Math.PI / 180 },
        label: `${l.params.A}°`,
        cx: l.vx + aR + 8, cy: l.vy - aR * 0.5,
      };
    },
  },
  D: {
    label: 'Diâmetro da fresa',
    get(l) {
      const x = l.tR + 10;
      return {
        pts: [x, l.tT + 8, x, l.tB - 8],
        label: `D=${l.params.D}`,
        cx: x + 22, cy: (l.tT + l.tB) / 2 + 4,
      };
    },
  },
  r: {
    label: 'Raio de canto r',
    get(l) {
      return {
        arc: { cx: l.tL, cy: l.tB, r: l.rPx, a1: Math.PI, a2: 1.5 * Math.PI },
        label: `r=${l.params.r}`,
        cx: l.tL - l.rPx - 8, cy: l.tB - l.rPx * 0.5,
      };
    },
  },
  passeZ: {
    label: 'Profundidade por passe',
    get(l) {
      const x = l.wpL - 22;
      return {
        pts: [x, l.vy, x, l.fy],
        label: `pZ=${l.params.passeZ}`,
        cx: x - 28, cy: (l.vy + l.fy) / 2 + 4,
      };
    },
  },
};

export function getParamDefs() {
  return PARAM_DEFS;
}

export function getActiveHighlight(layout, activeParamId) {
  if (!activeParamId || !PARAM_DEFS[activeParamId]) return null;
  return {
    def: PARAM_DEFS[activeParamId],
    geo: PARAM_DEFS[activeParamId].get(layout),
  };
}
