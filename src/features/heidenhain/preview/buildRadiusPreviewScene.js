/*
 * buildRadiusPreviewScene — cena SVG do Raio externo (Heidenhain/G-Code).
 *
 * Consome o modelo canônico do Raio (core/machining/radius) e produz TODAS
 * as coordenadas de tela (px) em um único passe, usando `fitTransform` para
 * escalar/centralizar (responsivo: viewBox + preserveAspectRatio) e
 * `layoutLabels` para rótulos sem sobreposição.
 *
 * Convenção de eixos (mesma de docs/COORDINATE_SYSTEM.md):
 *   xOf(x) = ox + x·scale   (X para a direita)
 *   yOf(z) = oy + z·scale   (Z positivo = profundidade, para baixo no SVG)
 *
 * O que é desenhado e como:
 *   - PEÇA: perfil convencional do canto arredondado — topo em Z0, face
 *     vertical em X0, arco de raio R centrado em (−R, R), do topo (−R,0)
 *     até a face (0,R). (O desenho da peça é convencional; a MÁTEMATICA de
 *     referência é o círculo da trajetória — ver abaixo.)
 *   - TRAJETÓRIA: pontos reais do modelo (Q6 da planilha) + círculo de
 *     referência (centro Xc, rho / raio rho) em tracejado — é ELE que é
 *     testado (identidade do círculo).
 *   - FERRAMENTA: corpo D×1,3·D com canto tórico r na quina INFERIOR-
 *     ESQUERDA (o nariz está em centro −(D/2−r) em X). O arco do canto é
 *     desenhado no quadrante inferior-esquerdo (sweep=0), SEM a inversão de
 *     quadrante já corrigida no chanfro.
 *   - PONTO DE CONTATO: centro do nariz no último passe (passe final),
 *     ligeiramente sobre o arco convencional (vértice do perfil).
 */

import { fitTransform, layoutLabels, arrowHeadPoints, clamp } from './previewLayout';
import { VIEW, COLORS } from './previewGeometry';

function partArcSamples(R, steps = 24) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const th = -Math.PI / 2 + (i / steps) * (Math.PI / 2);
    pts.push({ x: -R + R * Math.cos(th), z: R + R * Math.sin(th) });
  }
  return pts;
}

export function buildRadiusPreviewScene(model) {
  const R = model.params?.R ?? model.R ?? 20;
  const D = model.params?.D ?? model.D ?? 25;
  const r = model.params?.r ?? model.r ?? 0.8;
  const rho = model.rho ?? 0;
  const Xc = model.xCenter ?? 0;
  const profZ = model.profZ ?? R;
  const nPasses = model.nPasses ?? 1;
  const passes = Array.isArray(model.passes) ? model.passes : [];

  const toolH = D * 1.3;
  const shankW = D * 0.44;

  // ── Perfis da peça (mm) ──
  const pad = R * 0.7 + 6;
  const arcPts = partArcSamples(R);
  const finPts = [
    { x: -R - pad, z: 0 },
    ...arcPts,
    { x: 0, z: R + pad },
    { x: -R - pad, z: R + pad },
  ];
  const rawPts = [
    { x: -R - pad, z: -8 },
    { x: 0, z: -8 },
    { x: 0, z: R + pad },
    { x: -R - pad, z: R + pad },
  ];

  // ── Ferramenta no último passe ──
  const last = passes.length ? passes[passes.length - 1] : { x: Xc, z: 0 };
  const cx = last.x;
  const cy = last.z;
  const tL = cx - D / 2;
  const tR = tL + D;
  const tB = cy + r;
  const tT = tB - toolH;
  const shankTopZ = tT - toolH * 0.35;

  const contact = model.contact?.noseCenter
    ? { x: model.contact.noseCenter.x, z: model.contact.noseCenter.z }
    : { x: cx - (D / 2 - r), z: cy };

  // ── BBox para o fit ──
  const fitPts = [];
  const add = (x, z) => {
    if (Number.isFinite(x) && Number.isFinite(z)) fitPts.push({ x, z });
  };
  for (const p of finPts) add(p.x, p.z);
  for (const p of rawPts) add(p.x, p.z);
  add(tL, tT);
  add(tR, tB);
  add(tL, shankTopZ);
  add(tR, shankTopZ);
  add(Xc - rho, rho);
  add(Xc + rho, rho);
  add(Xc, rho - rho);
  add(Xc, rho + rho);
  add(contact.x, contact.z);
  for (const p of passes) add(p.x, p.z);

  const fit = fitTransform(fitPts, VIEW.W, VIEW.H, 96, 84, 1, 60);
  const s = fit.scale;
  const xOf = fit.xOf;
  const yOf = fit.yOf;

  const P = (x, z) => ({ x: xOf(x), y: yOf(z) });
  const origin = P(0, 0);

  const tool = {
    left: xOf(tL),
    right: xOf(tR),
    top: yOf(tT),
    bottom: yOf(tB),
    width: s * D,
    height: s * toolH,
    cornerR: s * r,
    shankX: xOf(tL + (s * D - s * shankW) / 2 / 1),
    shankW: s * shankW,
    shankH: s * toolH * 0.35,
    shankTop: yOf(shankTopZ),
  };
  tool.shankX = xOf(tL) + (s * D - s * shankW) / 2;

  const workpiece = {
    raw: rawPts.map((p) => `${xOf(p.x)},${yOf(p.z)}`),
    finished: finPts.map((p) => `${xOf(p.x)},${yOf(p.z)}`),
  };

  const trajectory = passes.map((p) => ({
    x: xOf(p.x),
    y: yOf(p.z),
    pass: p.pass,
    isFirst: p.isFirst,
    isLast: p.isLast,
    zDepth: p.zDepth,
  }));

  const toolCenterPx = P(cx, cy);
  const contactPx = P(contact.x, contact.z);
  const circleCenterPx = P(Xc, rho);
  const circleRadiusPx = s * rho;

  const centers = passes.map((p) => ({
    x: xOf(p.x),
    y: yOf(p.z),
    pass: p.pass,
    isLast: p.isLast,
  }));

  const safety = yOf(-5);
  const arcMid = arcPts[Math.floor(arcPts.length / 2)];

  // ── Eixos ──
  const axisLen = 74;
  const axes = [
    {
      line: { x1: origin.x, y1: origin.y, x2: origin.x + axisLen, y2: origin.y },
      arrow: arrowHeadPoints(origin.x, origin.y, origin.x + axisLen, origin.y),
      labelId: 'axisX',
      color: COLORS.axis,
    },
    {
      line: { x1: origin.x, y1: origin.y, x2: origin.x, y2: origin.y + axisLen },
      arrow: arrowHeadPoints(origin.x, origin.y, origin.x, origin.y + axisLen),
      labelId: 'axisZ',
      color: COLORS.axis,
    },
  ];

  // ── Cotas ──
  const arcCenterPx = P(-R, R);
  const dimLineR = {
    line: {
      x1: arcCenterPx.x,
      y1: arcCenterPx.y,
      x2: xOf(arcMid.x),
      y2: yOf(arcMid.z),
    },
    ticks: [
      { x1: arcCenterPx.x, y1: arcCenterPx.y, x2: arcCenterPx.x, y2: arcCenterPx.y },
      { x1: xOf(arcMid.x), y1: yOf(arcMid.z), x2: xOf(arcMid.x), y2: yOf(arcMid.z) },
    ],
    labelId: 'dimR',
    color: COLORS.chamfer,
  };
  const dimLineD = {
    line: { x1: tool.left, y1: tool.bottom + 16, x2: tool.right, y2: tool.bottom + 16 },
    ticks: [
      { x1: tool.left, y1: tool.bottom + 10, x2: tool.left, y2: tool.bottom + 22 },
      { x1: tool.right, y1: tool.bottom + 10, x2: tool.right, y2: tool.bottom + 22 },
    ],
    labelId: 'dimD',
    color: COLORS.dimLine,
  };
  const profZLine = {
    line: { x1: xOf(0) + 34, y1: yOf(0), x2: xOf(0) + 34, y2: yOf(profZ) },
    ticks: [
      { x1: xOf(0) + 28, y1: yOf(0), x2: xOf(0) + 40, y2: yOf(0) },
      { x1: xOf(0) + 28, y1: yOf(profZ), x2: xOf(0) + 40, y2: yOf(profZ) },
    ],
    labelId: 'dimProfZ',
    color: COLORS.dimLine,
  };
  const dimLines = [dimLineR, dimLineD, profZLine];

  const arcMidPx = P(arcMid.x, arcMid.z);
  const rhoMidPx = P(Xc + rho * Math.cos(-Math.PI / 4), rho + rho * Math.sin(-Math.PI / 4));

  // ── Rótulos ──
  const first = trajectory[0];
  const lastP = trajectory[trajectory.length - 1];
  const labelSpecs = [
    { id: 'origin', text: 'X0 Z0', anchorX: origin.x, anchorY: origin.y, priority: 8, color: COLORS.originMarker, fontSize: 10 },
    { id: 'radius', text: 'RAIO R', anchorX: arcMidPx.x, anchorY: arcMidPx.y, priority: 7, color: COLORS.chamferLabel, fontSize: 9 },
    { id: 'centro', text: 'CENTRO DA TRAJETORIA', anchorX: circleCenterPx.x, anchorY: circleCenterPx.y, priority: 6, color: COLORS.toolCenter, fontSize: 8 },
    { id: 'contato', text: 'PONTO DE CONTATO', anchorX: contactPx.x, anchorY: contactPx.y, priority: 5, color: COLORS.contact, fontSize: 8 },
    { id: 'rho', text: `rho = ${rho.toFixed(3)} mm`, anchorX: rhoMidPx.x, anchorY: rhoMidPx.y, priority: 5, color: COLORS.normalVec, fontSize: 10 },
    ...(first ? [{ id: 'inicio', text: 'INICIO', anchorX: first.x, anchorY: first.y, priority: 4, color: COLORS.label, fontSize: 9 }] : []),
    ...(lastP ? [{ id: 'fim', text: 'FIM', anchorX: lastP.x, anchorY: lastP.y, priority: 4, color: COLORS.label, fontSize: 9 }] : []),
    { id: 'dimR', text: `R = ${R.toFixed(2)} mm`, anchorX: (arcCenterPx.x + xOf(arcMid.x)) / 2, anchorY: (arcCenterPx.y + yOf(arcMid.z)) / 2, priority: 5, color: COLORS.chamferLabel, fontSize: 8 },
    { id: 'dimD', text: `D = ${D.toFixed(1)} mm`, anchorX: (tool.left + tool.right) / 2, anchorY: tool.bottom + 16, priority: 4, color: COLORS.dimLine, fontSize: 8 },
    { id: 'dimProfZ', text: `prof = ${profZ.toFixed(2)} mm`, anchorX: xOf(0) + 34, anchorY: (yOf(0) + yOf(profZ)) / 2, priority: 4, color: COLORS.dimLine, fontSize: 8 },
    { id: 'raw', text: 'PERFIL BRUTO', anchorX: xOf(rawPts[0].x), anchorY: yOf(rawPts[0].z), priority: 3, color: COLORS.rawLabel, fontSize: 8 },
    { id: 'axisX', text: 'X', anchorX: origin.x + axisLen, anchorY: origin.y, priority: 2, color: COLORS.axisLabel, fontSize: 11 },
    { id: 'axisZ', text: 'Z', anchorX: origin.x, anchorY: origin.y + axisLen, priority: 2, color: COLORS.axisLabel, fontSize: 11 },
    ...(lastP ? [{ id: 'lastPass', text: `Ultimo passe ${profZ.toFixed(2)} mm`, anchorX: lastP.x, anchorY: lastP.y + 14, priority: 3, color: COLORS.active, fontSize: 8 }] : []),
  ];

  const labels = layoutLabels(labelSpecs, VIEW.W, VIEW.H);

  const directionArrows = [];
  if (trajectory.length > 1) {
    directionArrows.push(
      arrowHeadPoints(trajectory[trajectory.length - 2].x, trajectory[trajectory.length - 2].y, lastP.x, lastP.y, 9)
    );
    const step = Math.max(1, Math.floor(trajectory.length / 4));
    for (let i = step; i < trajectory.length - 1; i += step) {
      const a = trajectory[i];
      const b = trajectory[Math.min(i + 1, trajectory.length - 1)];
      directionArrows.push(arrowHeadPoints(a.x, a.y, b.x, b.y, 7));
    }
  }

  return {
    type: 'external',
    view: { w: VIEW.W, h: VIEW.H },
    mmToPx: s,
    origin,
    workpiece,
    tool,
    tangency: {
      center: circleCenterPx,
      point: contactPx,
      radius: circleRadiusPx,
    },
    contactGeo: {
      contactPoint: contactPx,
      toolCenter: toolCenterPx,
      radius: s * r,
      noseCenter: contactPx,
      vecLen: Math.min(s * rho, 50),
    },
    trajectory,
    centers,
    start: first,
    end: lastP,
    safety,
    nPasses,
    params: model.params,
    dims: { R, D, r, rho, Xc, profZ, nPasses, incReal: model.incReal ?? 0 },
    axes,
    dimLines,
    radiusHighlight: {
      polyline: arcPts.map((p) => `${xOf(p.x)},${yOf(p.z)}`).join(' '),
    },
    direction: { arrows: directionArrows },
    lastPass: lastP
      ? { line: { x1: lastP.x, y1: lastP.y, x2: VIEW.W - 18, y2: lastP.y }, labelId: 'lastPass' }
      : null,
    clamps: { clampPt: (p) => ({ x: clamp(p.x, 8, VIEW.W - 8), y: clamp(p.y, 8, VIEW.H - 8) }) },
    labels,
  };
}