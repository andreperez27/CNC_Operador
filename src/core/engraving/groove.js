/**
 * Largura do risco de gravacao (pura, sem React).
 *
 * Convencao (documentada porque define os numeros):
 * - Superficie plana, trajetoria 2D, profundidade constante, ferramenta ideal.
 * - `p` = profundidade a partir do ponto mais baixo da ferramenta.
 * - Topo reto: o risco tem a largura do diametro, em qualquer profundidade.
 * - Esferica (diametro D): calota de altura p -> largura 2??(p?(D-p));
 *   a partir de p ? D/2 o equador manda: largura = D.
 * - Gravador em V: a = angulo/2 (metade do incluido).
 *   Ponta PLANA (padrao, modelo de catalogo: d0 = diametro da ponta, o
 *   "tool nose", padrao 0,1; cone truncado): largura = d0 + 2?p?tan a
 *   (d0 = 0 vira o V ideal). A largura e limitada pelo diametro da haste
 *   (padrao 3,175).
 *   Ponta ARREDONDADA (opcao, r = raio da ponta: esfera de raio r tangente
 *   ao cone). Altura de tangencia ht = r?(1-sen a). Ate ht so a esfera
 *   corta: 2??(p?(2r-p)); acima, esfera cheia (2?r?cos a) mais cone
 *   (2?(p-ht)?tan a). Com r = 0 vira o V ideal: 2?p?tan a.
 *   Forma legada `{ angle, radius }` = ponta arredondada; `{ angle,
 *   tipDiameter }` (ou so `{ angle }`) = ponta plana.
 *
 * Hipoteses assumidas (nao verificadas aqui): ferramenta nova/sem
 * desgaste, sem batimento nem deflexao, material homogeneo. Ver o texto
 * de limitacoes exibido junto ao diagnostico.
 */
import { ValidationError } from '../validation/validationEngine';

function num(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ValidationError('INVALID_TOOL', 'ferramenta', `${name} deve ser n\u00famero v\u00e1lido.`);
  }
  return v;
}

export function checkTool(tool) {
  if (!tool || typeof tool !== 'object') {
    throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Tipo de ferramenta inv\u00e1lido.');
  }
  if (tool.type === 'flat' || tool.type === 'ball') {
    num(tool.diameter, 'Di\u00e2metro');
    if (!(tool.diameter > 0)) {
      throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Di\u00e2metro deve ser maior que zero.');
    }
  } else if (tool.type === 'vee') {
    num(tool.angle, '\u00c2ngulo');
    const hasFlat = tool.tipDiameter !== undefined && tool.tipDiameter !== null;
    const hasRound = tool.radius !== undefined && tool.radius !== null;
    if (!(tool.angle > 0 && tool.angle < 180)) {
      throw new ValidationError(
        'INVALID_TOOL', 'ferramenta',
        '\u00c2ngulo do V deve estar entre 0 e 180 graus (exclusive) \u2014 \u00e9 o \u00e2ngulo inclu\u00eddo da ponta.',
      );
    }
    if (hasFlat && hasRound) {
      throw new ValidationError(
        'INVALID_TOOL', 'ferramenta',
        'Informe a ponta de um jeito s\u00f3: tipDiameter (plana) ou radius (arredondada).',
      );
    }
    if (hasFlat) {
      num(tool.tipDiameter, 'Di\u00e2metro da ponta');
      if (!(tool.tipDiameter >= 0)) {
        throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Di\u00e2metro da ponta n\u00e3o pode ser negativo (0 = V ideal).');
      }
    }
    if (hasRound) {
      num(tool.radius, 'Raio da ponta');
      if (!(tool.radius >= 0)) {
        throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Raio da ponta n\u00e3o pode ser negativo (0 = V ideal).');
      }
    }
    if (tool.shank !== undefined && tool.shank !== null) {
      num(tool.shank, 'Di\u00e2metro da haste');
      if (!(tool.shank > 0)) {
        throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Di\u00e2metro da haste deve ser maior que zero.');
      }
    }
  } else {
    throw new ValidationError('INVALID_TOOL', 'ferramenta', "Tipo deve ser 'flat', 'ball' ou 'vee'.");
  }
  if (tool.maxDiameter !== undefined && tool.maxDiameter !== null) {
    num(tool.maxDiameter, 'Di\u00e2metro m\u00e1ximo');
    if (!(tool.maxDiameter > 0)) {
      throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Di\u00e2metro m\u00e1ximo deve ser maior que zero.');
    }
  }
  return tool;
}

// Altura de tangencia esfera?cone no V (mm); null sem esfera (r = 0).
export function tangentHeight(angleDeg, r) {
  if (!(r > 0)) return null;
  const a = (angleDeg * Math.PI) / 180 / 2;
  return r * (1 - Math.sin(a));
}

/**
 * Largura do risco em mm para profundidade p (mm).
 * @returns {number|null} null quando p ? 0 (sem corte: a chamada exibe
 *   aviso em vez de estimar largura).
 */
export function grooveWidth(tool, p) {
  checkTool(tool);
  if (!(typeof p === 'number' && Number.isFinite(p)) || p <= 0) return null;
  const t = tool.type;
  let w;
  if (t === 'flat') {
    w = tool.diameter;
  } else if (t === 'ball') {
    const D = tool.diameter;
    w = p >= D / 2 ? D : 2 * Math.sqrt(p * (D - p));
  } else {
    const a = ((tool.angle * Math.PI) / 180 / 2);
    const hasFlat = tool.tipDiameter !== undefined && tool.tipDiameter !== null;
    const hasRound = tool.radius !== undefined && tool.radius !== null;
    if (hasFlat || !hasRound) {
      const d0 = hasFlat ? tool.tipDiameter : 0.1;
      w = d0 + 2 * p * Math.tan(a);
    } else {
      const r = tool.radius;
      const ht = r > 0 ? r * (1 - Math.sin(a)) : 0;
      if (p <= ht) {
        w = 2 * Math.sqrt(p * (2 * r - p));
      } else {
        w = 2 * r * Math.cos(a) + 2 * (p - ht) * Math.tan(a);
      }
    }
  }
  // Teto: explicito (maxDiameter) ou, no V, a haste (padrao 3,175).
  let cap = tool.maxDiameter;
  if (t === 'vee' && (cap === undefined || cap === null)) {
    cap = tool.shank !== undefined && tool.shank !== null ? tool.shank : 3.175;
  }
  if (cap !== undefined && cap !== null) {
    w = Math.min(w, cap);
  }
  return w;
}

// Medida real (calibracao com a peca) substitui a calculada.
export function resolveGrooveWidth(measured, calculated) {
  if (measured !== undefined && measured !== null && measured !== '') {
    const m = Number(measured);
    if (!Number.isFinite(m) || !(m > 0)) {
      throw new ValidationError(
        'INVALID_GROOVE', 'larguraMedida',
        'Largura medida deve ser n\u00famero maior que zero (ou vazio para usar a calculada).',
      );
    }
    return m;
  }
  return calculated;
}

// Margem efetiva do bloco: o risco invade meia largura alem da linha
// central, entao a margem nunca pode ser menor que isso.
export function effectiveMargin(margin, grooveWidthValue) {
  const m = typeof margin === 'number' && Number.isFinite(margin) && margin >= 0 ? margin : 0;
  if (typeof grooveWidthValue === 'number' && Number.isFinite(grooveWidthValue) && grooveWidthValue > 0) {
    return Math.max(m, grooveWidthValue / 2);
  }
  return m;
}

const trim = (v) => String(Number(v.toFixed(3))).replace('.', ',');

// Descricao curta para o cabecalho do .H.
export function describeTool(tool) {
  checkTool(tool);
  if (tool.type === 'flat') return `topo reto D ${trim(tool.diameter)} mm`;
  if (tool.type === 'ball') return `esf\u00e9rica D ${trim(tool.diameter)} mm`;
  const hasFlat = tool.tipDiameter !== undefined && tool.tipDiameter !== null;
  if (hasFlat || tool.radius === undefined || tool.radius === null) {
    const d0 = hasFlat ? tool.tipDiameter : 0.1;
    return `V ${trim(tool.angle)}\u00b0 ponta ${trim(d0)} mm`;
  }
  return `V ${trim(tool.angle)}\u00b0 r ${trim(tool.radius)} mm`;
}
