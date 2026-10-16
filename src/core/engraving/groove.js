/**
 * Largura do risco de gravação (pura, sem React).
 *
 * Convenção (documentada porque define os números):
 * - Superfície plana, trajetória 2D, profundidade constante, ferramenta ideal.
 * - `p` = profundidade a partir do ponto mais baixo da ferramenta.
 * - Topo reto: o risco tem a largura do diâmetro, em qualquer profundidade.
 * - Esférica (diâmetro D): calota de altura p → largura 2·√(p·(D−p));
 *   a partir de p ≥ D/2 o equador manda: largura = D.
 * - Gravador em V: a = ângulo/2 (metade do incluído).
 *   Ponta PLANA (padrão, modelo de catálogo: d0 = diâmetro da ponta, o
 *   "tool nose", padrão 0,1; cone truncado): largura = d0 + 2·p·tan a
 *   (d0 = 0 vira o V ideal). A largura é limitada pelo diâmetro da haste
 *   (padrão 3,175).
 *   Ponta ARREDONDADA (opção, r = raio da ponta: esfera de raio r tangente
 *   ao cone). Altura de tangência ht = r·(1−sen a). Até ht só a esfera
 *   corta: 2·√(p·(2r−p)); acima, esfera cheia (2·r·cos a) mais cone
 *   (2·(p−ht)·tan a). Com r = 0 vira o V ideal: 2·p·tan a.
 *   Forma legada `{ angle, radius }` = ponta arredondada; `{ angle,
 *   tipDiameter }` (ou só `{ angle }`) = ponta plana.
 *
 * Hipóteses assumidas (não verificadas aqui): ferramenta nova/sem
 * desgaste, sem batimento nem deflexão, material homogêneo. Ver o texto
 * de limitações exibido junto ao diagnóstico.
 */
import { ValidationError } from '../validation/validationEngine';

function num(v, name) {
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new ValidationError('INVALID_TOOL', 'ferramenta', `${name} deve ser número válido.`);
  }
  return v;
}

export function checkTool(tool) {
  if (!tool || typeof tool !== 'object') {
    throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Tipo de ferramenta inválido.');
  }
  if (tool.type === 'flat' || tool.type === 'ball') {
    num(tool.diameter, 'Diâmetro');
    if (!(tool.diameter > 0)) {
      throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Diâmetro deve ser maior que zero.');
    }
  } else if (tool.type === 'vee') {
    num(tool.angle, 'Ângulo');
    const hasFlat = tool.tipDiameter !== undefined && tool.tipDiameter !== null;
    const hasRound = tool.radius !== undefined && tool.radius !== null;
    if (!(tool.angle > 0 && tool.angle < 180)) {
      throw new ValidationError(
        'INVALID_TOOL', 'ferramenta',
        'Ângulo do V deve estar entre 0 e 180 graus (exclusive) — é o ângulo incluído da ponta.',
      );
    }
    if (hasFlat && hasRound) {
      throw new ValidationError(
        'INVALID_TOOL', 'ferramenta',
        'Informe a ponta de um jeito só: tipDiameter (plana) ou radius (arredondada).',
      );
    }
    if (hasFlat) {
      num(tool.tipDiameter, 'Diâmetro da ponta');
      if (!(tool.tipDiameter >= 0)) {
        throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Diâmetro da ponta não pode ser negativo (0 = V ideal).');
      }
    }
    if (hasRound) {
      num(tool.radius, 'Raio da ponta');
      if (!(tool.radius >= 0)) {
        throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Raio da ponta não pode ser negativo (0 = V ideal).');
      }
    }
    if (tool.shank !== undefined && tool.shank !== null) {
      num(tool.shank, 'Diâmetro da haste');
      if (!(tool.shank > 0)) {
        throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Diâmetro da haste deve ser maior que zero.');
      }
    }
  } else {
    throw new ValidationError('INVALID_TOOL', 'ferramenta', "Tipo deve ser 'flat', 'ball' ou 'vee'.");
  }
  if (tool.maxDiameter !== undefined && tool.maxDiameter !== null) {
    num(tool.maxDiameter, 'Diâmetro máximo');
    if (!(tool.maxDiameter > 0)) {
      throw new ValidationError('INVALID_TOOL', 'ferramenta', 'Diâmetro máximo deve ser maior que zero.');
    }
  }
  return tool;
}

// Altura de tangência esfera↔cone no V (mm); null sem esfera (r = 0).
export function tangentHeight(angleDeg, r) {
  if (!(r > 0)) return null;
  const a = (angleDeg * Math.PI) / 180 / 2;
  return r * (1 - Math.sin(a));
}

/**
 * Largura do risco em mm para profundidade p (mm).
 * @returns {number|null} null quando p ≤ 0 (sem corte: a chamada exibe
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
  // Teto: explícito (maxDiameter) ou, no V, a haste (padrão 3,175).
  let cap = tool.maxDiameter;
  if (t === 'vee' && (cap === undefined || cap === null)) {
    cap = tool.shank !== undefined && tool.shank !== null ? tool.shank : 3.175;
  }
  if (cap !== undefined && cap !== null) {
    w = Math.min(w, cap);
  }
  return w;
}

// Medida real (calibração com a peça) substitui a calculada.
export function resolveGrooveWidth(measured, calculated) {
  if (measured !== undefined && measured !== null && measured !== '') {
    const m = Number(measured);
    if (!Number.isFinite(m) || !(m > 0)) {
      throw new ValidationError(
        'INVALID_GROOVE', 'larguraMedida',
        'Largura medida deve ser número maior que zero (ou vazio para usar a calculada).',
      );
    }
    return m;
  }
  return calculated;
}

// Margem efetiva do bloco: o risco invade meia largura além da linha
// central, então a margem nunca pode ser menor que isso.
export function effectiveMargin(margin, grooveWidthValue) {
  const m = typeof margin === 'number' && Number.isFinite(margin) && margin >= 0 ? margin : 0;
  if (typeof grooveWidthValue === 'number' && Number.isFinite(grooveWidthValue) && grooveWidthValue > 0) {
    return Math.max(m, grooveWidthValue / 2);
  }
  return m;
}

const trim = (v) => String(Number(v.toFixed(3))).replace('.', ',');

// Descrição curta para o cabeçalho do .H.
export function describeTool(tool) {
  checkTool(tool);
  if (tool.type === 'flat') return `topo reto D ${trim(tool.diameter)} mm`;
  if (tool.type === 'ball') return `esférica D ${trim(tool.diameter)} mm`;
  const hasFlat = tool.tipDiameter !== undefined && tool.tipDiameter !== null;
  if (hasFlat || tool.radius === undefined || tool.radius === null) {
    const d0 = hasFlat ? tool.tipDiameter : 0.1;
    return `V ${trim(tool.angle)}° ponta ${trim(d0)} mm`;
  }
  return `V ${trim(tool.angle)}° r ${trim(tool.radius)} mm`;
}
