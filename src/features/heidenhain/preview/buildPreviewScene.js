/*
 * buildPreviewScene — construtor compartilhado do preview SVG (Heidenhain).
 *
 * Consome o modelo canônico do chanfro (externo OU interno) e produz
 * TODAS as coordenadas de tela (px) em um único passe, usando
 * `fitTransform` para escalar/centralizar o desenho no canvas e
 * `layoutLabels` para posicionar rótulos sem sobreposição.
 *
 * O modelo retornado é SUPERSET do contrato legado dos builders
 * (`chamferExternalPreviewModel` / `chamferInternalPreviewModel`):
 * mantém os campos consumidos pelos componentes e adiciona
 * `axes`, `dimLines`, `chamferHighlight`, `direction`, `lastPass` e
 * `labels` (todos com rótulos posicionados via layout).
 *
 * Convenção de eixos (idêntica nos dois tipos):
 *   xOf(x) = ox + x·scale   (X para a direita)
 *   yOf(z) = oy + z·scale   (Z positivo = para baixo no SVG)
 *
 * A diferença externo/interno fica nos VALORES de Z:
 *   externo : z positivo = profundidade (chanfro desce da superfície)
 *   interno : z negativo = profundidade (chanfro sobe do fundo do
 *             bolsão) — os passes do modelo usam profundidade
 *             positiva, então são invertidos por `zSign`.
 *
 * O ponto de contato desenhado é a PROJEÇÃO perpendicular do centro
 * da ferramenta sobre a linha do chanfro, garantindo tangência visual
 * consistente nos dois tipos (o modelo interno tem normal degenerada).
 */

import { validateContact } from '../math/contactGeometry';
import { fitTransform, layoutLabels, arrowHeadPoints, clamp } from './previewLayout';
import { VIEW, COLORS } from './previewGeometry';

export function buildChamferPreviewScene(model, kind) {
  const internal = kind === 'internal';
  const zSign = internal ? -1 : 1;

  const profZ = model.profZ ?? 0;
  const largX = model.largX ?? 0;
  const nPasses = model.nPasses ?? 1;
  const passes = Array.isArray(model.passes) ? model.passes : [];
  const Reff = model.Reff ?? 0;
  const toolCornerR = model.toolCornerR ?? Reff;
  const D = model.params?.D ?? 16;
  const L = model.params?.L ?? 100;
  const C = model.params?.C ?? Math.hypot(profZ, largX);
  const Adeg = Math.round((Math.atan2(profZ, largX) * 180) / Math.PI * 100) / 100;

  const contact = model.contact ?? {};
  const tcx = contact.toolCenter?.x ?? 0;
  const tcz = contact.toolCenter?.z ?? 0;
  const cpx = contact.contactPoint?.x ?? 0;
  const cpz = contact.contactPoint?.z ?? 0;

  // Extensões do chanfro em coords de máquina (z como será desenhado)
  const chA = internal ? { x: 0, z: 0 } : { x: -largX, z: 0 };
  const chB = internal ? { x: -largX, z: -profZ } : { x: 0, z: profZ };

  // Geometria da ferramenta (mm, z como desenhado)
  const toolH = D * 1.3;
  const shankW = D * 0.44;
  const tL = tcx - toolCornerR;
  const tR = tL + D;
  const tB = tcz + toolCornerR;
  const tT = tB - toolH;
  const shankTopZ = tT - toolH * 0.35;

  // Pontos usados no fit (bbox do desenho)
  const fitPts = [];
  const add = (x, z) => {
    if (Number.isFinite(x) && Number.isFinite(z)) fitPts.push({ x, z });
  };
  add(chA.x, chA.z);
  add(chB.x, chB.z);
  add(0, 0);
  add(tL, tcz);
  add(tR, tB);
  add(tR, tT);
  add(tL, tT);
  add(tL, shankTopZ);
  add(tR, shankTopZ);
  add(tcx, tcz);
  add(cpx, cpz);
  for (const p of passes) add(p.x, zSign * p.z);

  const fit = fitTransform(fitPts, VIEW.W, VIEW.H, 96, 84, 1, 60);
  const s = fit.scale;
  const xOf = fit.xOf;
  const yOf = fit.yOf;
  const mmToPx = s;

  const P = (x, z) => ({ x: xOf(x), y: yOf(z) });
  const Apx = P(chA.x, chA.z);
  const Bpx = P(chB.x, chB.z);
  const origin = P(0, 0);
  const modelCenter = P(tcx, tcz);
  const reffPx = s * Reff;
  const cornerRPx = s * toolCornerR;

  // Linha do chanfro
  const clDx = Bpx.x - Apx.x;
  const clDy = Bpx.y - Apx.y;
  const clLen = Math.hypot(clDx, clDy) || 1;

  // Validação (compat com legado)
  const validation = model.contactValidation ?? validateContact(contact);

  // Passes → SVG
  const trajPoints = passes.map((p) => ({
    x: xOf(p.x),
    y: yOf(zSign * p.z),
    pass: p.pass,
    isLast: p.isLast,
    zDepth: p.zDepth,
  }));

  // Contato robusto: pé da perpendicular do centro → linha do chanfro
  const tProj = ((modelCenter.x - Apx.x) * clDx + (modelCenter.y - Apx.y) * clDy) / (clLen * clLen);
  const cpPx = {
    x: Apx.x + tProj * clDx,
    y: Apx.y + tProj * clDy,
  };

  // Lado da ferramenta: escolhe a perpendicular do chanfro voltada para a
  // trajetória (passes). No interno o centro do modelo é degenerado (cai
  // SOBRE a linha do chanfro), então o centro de desenho é RECOMPOSTO como
  // contato + Reff na normal → tangência visual garantida nos dois tipos.
  const chamMid = { x: (Apx.x + Bpx.x) / 2, y: (Apx.y + Bpx.y) / 2 };
  let passMid = { x: chamMid.x, y: chamMid.y };
  if (trajPoints.length) {
    passMid = trajPoints.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
    passMid.x /= trajPoints.length;
    passMid.y /= trajPoints.length;
  }
  const perpA = { x: -clDy / clLen, y: clDx / clLen };
  const sd = (passMid.x - chamMid.x) * perpA.x + (passMid.y - chamMid.y) * perpA.y;
  const sgn = sd >= 0 ? 1 : -1;
  const nx = perpA.x * sgn;
  const ny = perpA.y * sgn;

  // Centro da ferramenta em tela (tangente ao chanfro, no lado da trajetória)
  const toolCenter = { x: cpPx.x + reffPx * nx, y: cpPx.y + reffPx * ny };

  const tx = clDx / clLen;
  const ty = clDy / clLen;
  const vecLen = Math.min(reffPx * 2.5, 50);
  const centers = passes.map((p) => ({
    x: xOf(p.x),
    y: yOf(zSign * p.z),
    pass: p.pass,
    isLast: p.isLast,
  }));

  const safetyY = yOf(internal ? 5 : -5);

  // Ferramenta (px)
  const tool = {
    left: toolCenter.x - cornerRPx,
    right: toolCenter.x - cornerRPx + s * D,
    top: toolCenter.y + cornerRPx - s * toolH,
    bottom: toolCenter.y + cornerRPx,
    width: s * D,
    height: s * toolH,
    cornerR: cornerRPx,
    shankX: toolCenter.x - cornerRPx + (s * D - s * shankW) / 2,
    shankW: s * shankW,
    shankH: s * toolH * 0.35,
    shankTop: toolCenter.y + cornerRPx - s * toolH - s * toolH * 0.35,
  };

  // Peça (polígonos em px)
  const pad = 70;
  let workpiece;
  if (internal) {
    const cornerPx = origin;
    const xMin = Math.min(Bpx.x - pad, cornerPx.x - s * largX - 40);
    const xMax = cornerPx.x + pad;
    const yTop = Bpx.y - 26;
    const yBot = cornerPx.y + 56;
    const fin = [
      cornerPx.x, yTop,
      xMax, yTop,
      xMax, yBot,
      xMin, yBot,
      xMin, cornerPx.y,
      cornerPx.x, cornerPx.y,
    ];
    const raw = [xMin, yTop, xMax, yTop, xMax, yBot, xMin, yBot];
    workpiece = { raw, finished: fin, corner: cornerPx, wallTop: { x: cornerPx.x, y: yTop }, floorEnd: { x: xMin, y: cornerPx.y } };
  } else {
    const topSurfPx = Apx;
    const vertFacePx = Bpx;
    const wpLeft = Math.min(topSurfPx.x - pad, origin.x - s * largX - 40);
    const wpRight = origin.x + pad;
    const wpTop = origin.y - 26;
    const wpBottom = vertFacePx.y + 56;
    const fin = [wpLeft, wpTop, topSurfPx.x, topSurfPx.y, vertFacePx.x, vertFacePx.y, wpRight, wpBottom, wpLeft, wpBottom];
    const raw = [wpLeft, wpTop, wpRight, wpTop, wpRight, wpBottom, wpLeft, wpBottom];
    workpiece = { raw, finished: fin, corner: origin, wallTop: { x: origin.x, y: wpTop }, floorEnd: { x: wpLeft, y: origin.y } };
  }

  // Linha do chanfro estendida (clamp no canvas)
  const clampPt = (p) => ({ x: clamp(p.x, 8, VIEW.W - 8), y: clamp(p.y, 8, VIEW.H - 8) });
  const chamferLine = { start: Apx, end: Bpx };
  const chamferLineExtended = {
    start: clampPt({ x: Apx.x - clDx * 1.5, y: Apx.y - clDy * 1.5 }),
    end: clampPt({ x: Bpx.x + clDx * 1.5, y: Bpx.y + clDy * 1.5 }),
  };

  const perpProjection = { footX: cpPx.x, footY: cpPx.y };

  // ── Eixos de coordenadas ──
  const axisLen = 74;
  const axisLines = [
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

  // ── Linhas de cota ──
  const largeXLine = {
    line: { x1: xOf(-largX), y1: yOf(0) - 34, x2: xOf(0), y2: yOf(0) - 34 },
    ticks: [
      { x1: xOf(-largX), y1: yOf(0) - 40, x2: xOf(-largX), y2: yOf(0) - 28 },
      { x1: xOf(0), y1: yOf(0) - 40, x2: xOf(0), y2: yOf(0) - 28 },
    ],
    labelId: 'dimLargX',
    color: COLORS.dimLine,
  };
  const profZLine = {
    line: { x1: xOf(0) + 34, y1: yOf(0), x2: xOf(0) + 34, y2: yOf(internal ? -profZ : profZ) },
    ticks: [
      { x1: xOf(0) + 28, y1: yOf(0), x2: xOf(0) + 40, y2: yOf(0) },
      { x1: xOf(0) + 28, y1: yOf(internal ? -profZ : profZ), x2: xOf(0) + 40, y2: yOf(internal ? -profZ : profZ) },
    ],
    labelId: 'dimProfZ',
    color: COLORS.dimLine,
  };
  const dimLineD = {
    line: { x1: tool.left, y1: tool.bottom + 18, x2: tool.right, y2: tool.bottom + 18 },
    ticks: [
      { x1: tool.left, y1: tool.bottom + 12, x2: tool.left, y2: tool.bottom + 24 },
      { x1: tool.right, y1: tool.bottom + 12, x2: tool.right, y2: tool.bottom + 24 },
    ],
    labelId: 'dimD',
    color: COLORS.dimLine,
  };
  // Cota do chanfro: paralela à linha do chanfro, deslocada para o lado
  // da ferramenta (ar), fora do material.
  const mid = { x: (Apx.x + Bpx.x) / 2, y: (Apx.y + Bpx.y) / 2 };
  let offX = toolCenter.x - mid.x;
  let offY = toolCenter.y - mid.y;
  const offLen = Math.hypot(offX, offY) || 1;
  offX /= offLen;
  offY /= offLen;
  const cOff = 18;
  const dimLineC = {
    line: {
      x1: Apx.x + offX * cOff,
      y1: Apx.y + offY * cOff,
      x2: Bpx.x + offX * cOff,
      y2: Bpx.y + offY * cOff,
    },
    ticks: [
      { x1: Apx.x, y1: Apx.y, x2: Apx.x + offX * cOff, y2: Apx.y + offY * cOff },
      { x1: Bpx.x, y1: Bpx.y, x2: Bpx.x + offX * cOff, y2: Bpx.y + offY * cOff },
    ],
    labelId: 'dimC',
    color: COLORS.chamfer,
  };
  const dimLines = [largeXLine, profZLine, dimLineD, dimLineC];

  // ── Rótulos (layout sem sobreposição) ──
  const rawCornerAnchor = internal ? { x: workpiece.raw[0], y: workpiece.raw[1] } : { x: workpiece.raw[0], y: workpiece.raw[1] };
  const last = trajPoints[trajPoints.length - 1];
  const first = trajPoints[0];

  const labelSpecs = [
    { id: 'origin', text: 'X0 Z0', anchorX: origin.x, anchorY: origin.y, priority: 8, color: COLORS.originMarker, fontSize: 10 },
    { id: 'chamfer', text: 'CHANFRO', anchorX: mid.x, anchorY: mid.y, priority: 7, color: COLORS.chamferLabel, fontSize: 9 },
    { id: 'centro', text: 'CENTRO DA FERRAMENTA', anchorX: toolCenter.x, anchorY: toolCenter.y, priority: 6, color: COLORS.toolCenter, fontSize: 8 },
    { id: 'contato', text: 'PONTO DE CONTATO', anchorX: cpPx.x, anchorY: cpPx.y, priority: 5, color: COLORS.contact, fontSize: 8 },
    { id: 'reff', text: `Reff = ${Reff.toFixed(3)} mm`, anchorX: (toolCenter.x + cpPx.x) / 2, anchorY: (toolCenter.y + cpPx.y) / 2 - 8, priority: 5, color: COLORS.normalVec, fontSize: 10 },
    ...(first ? [{ id: 'inicio', text: 'INICIO', anchorX: first.x, anchorY: first.y, priority: 4, color: COLORS.label, fontSize: 9 }] : []),
    ...(last ? [{ id: 'fim', text: 'FIM', anchorX: last.x, anchorY: last.y, priority: 4, color: COLORS.label, fontSize: 9 }] : []),
    { id: 'dimLargX', text: `largX = ${largX.toFixed(2)} mm`, anchorX: (xOf(-largX) + xOf(0)) / 2, anchorY: yOf(0) - 34, priority: 5, color: COLORS.dimLine, fontSize: 8 },
    { id: 'dimProfZ', text: `profZ = ${profZ.toFixed(2)} mm`, anchorX: xOf(0) + 34, anchorY: (yOf(0) + yOf(internal ? -profZ : profZ)) / 2, priority: 5, color: COLORS.dimLine, fontSize: 8 },
    { id: 'dimD', text: `D = ${D.toFixed(1)} mm`, anchorX: (tool.left + tool.right) / 2, anchorY: tool.bottom + 18, priority: 4, color: COLORS.dimLine, fontSize: 8 },
    { id: 'dimC', text: `C = ${C.toFixed(2)} mm`, anchorX: mid.x + offX * cOff, anchorY: mid.y + offY * cOff, priority: 3, color: COLORS.chamferLabel, fontSize: 8 },
    { id: 'raw', text: 'PERFIL BRUTO', anchorX: rawCornerAnchor.x, anchorY: rawCornerAnchor.y, priority: 3, color: COLORS.rawLabel, fontSize: 8 },
    { id: 'axisX', text: 'X', anchorX: origin.x + axisLen, anchorY: origin.y, priority: 2, color: COLORS.axisLabel, fontSize: 11 },
    { id: 'axisZ', text: 'Z', anchorX: origin.x, anchorY: origin.y + axisLen, priority: 2, color: COLORS.axisLabel, fontSize: 11 },
    ...(last ? [{ id: 'lastPass', text: `Ultimo passe ${profZ.toFixed(2)} mm`, anchorX: last.x, anchorY: last.y + 14, priority: 3, color: COLORS.active, fontSize: 8 }] : []),
  ];

  const labels = layoutLabels(labelSpecs, VIEW.W, VIEW.H);
  const labelById = Object.fromEntries(labels.map((l) => [l.id, l]));

  // ── Seta de direção da usinagem ──
  const directionArrows = [];
  if (trajPoints.length > 1) {
    directionArrows.push(arrowHeadPoints(trajPoints[trajPoints.length - 2].x, trajPoints[trajPoints.length - 2].y, last.x, last.y, 9));
    const step = Math.max(1, Math.floor(trajPoints.length / 3));
    for (let i = step; i < trajPoints.length - 1; i += step) {
      const a = trajPoints[i];
      const b = trajPoints[Math.min(i + 1, trajPoints.length - 1)];
      directionArrows.push(arrowHeadPoints(a.x, a.y, b.x, b.y, 7));
    }
  }

  return {
    type: internal ? 'internal' : 'external',
    kind,
    view: { w: VIEW.W, h: VIEW.H },
    mmToPx,
    origin,
    workpiece,
    tool,
    tangency: {
      center: toolCenter,
      point: cpPx,
      radius: reffPx,
    },
    contactGeo: {
      contactPoint: cpPx,
      toolCenter,
      radius: reffPx,
      normal: { x: nx, y: ny },
      tangent: { x: tx, y: ty },
      vecLen,
    },
    validation,
    chamferLine,
    chamferLineExtended,
    perpProjection,
    trajectory: trajPoints,
    centers,
    start: first,
    end: last,
    safety: safetyY,
    nPasses,
    passes,
    params: model.params,
    dims: { D, A: Adeg, profZ, largX, nPasses, incReal: model.incReal ?? 0, Reff, L, C },
    axes: axisLines,
    dimLines,
    chamferHighlight: { x1: Apx.x, y1: Apx.y, x2: Bpx.x, y2: Bpx.y },
    chamferLabel: labelById.chamfer ?? { x: mid.x, y: mid.y },
    direction: { arrows: directionArrows },
    lastPass: last
      ? { line: { x1: last.x, y1: last.y, x2: VIEW.W - 18, y2: last.y }, labelId: 'lastPass' }
      : null,
    labels,
  };
}
