export function getRoundingPreviewLayout(params, solved) {
  const { R, D, r } = params;

  const dPx = Math.max(60, Math.min(130, 50 + D * 5));
  const rPx = Math.max(8, Math.min(32, 4 + r * 7));
  const rArcPx = Math.max(12, Math.min(48, 6 + R * 7));

  // Workpiece — bloco sólido à esquerda
  const wpL = 36;
  const wpR = 176;
  const wpT = 104;
  const wpB = 256;

  // Ponto do arredondamento
  const arcCX = wpR;
  const arcCY = wpT;
  const fx = wpR - rArcPx;
  const fy = wpT + rArcPx;

  // Ferramenta — à direita, maior
  const tW = dPx;
  const tH = dPx * 1.3;
  const tL = wpR - 6;
  const tR = tL + tW;
  const tT = wpT - tH * 0.55;
  const tB = tT + tH;

  return {
    wpL, wpR, wpT, wpB,
    arcCX, arcCY, fx, fy, rArcPx,
    tL, tR, tT, tB, tW, tH,
    rPx, dPx,
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
  R: {
    label: 'Raio de arredondamento',
    get(l) {
      return {
        arc: { cx: l.arcCX, cy: l.arcCY, r: l.rArcPx, a1: 0, a2: Math.PI / 2 },
        label: `R=${l.params.R}`,
        cx: l.arcCX - l.rArcPx * 0.35, cy: l.arcCY + l.rArcPx * 0.35 - 10,
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
  incrZ: {
    label: 'Incremento Z',
    get(l) {
      const x = l.wpL - 22;
      return {
        pts: [x, l.arcCY, x, l.fy],
        label: `dZ=${l.params.incrZ}`,
        cx: x - 28, cy: (l.arcCY + l.fy) / 2 + 4,
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
