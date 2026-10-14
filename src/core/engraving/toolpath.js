/**
 * Trajetória do Gravador de Textos CNC (pura, sem React): transforma os
 * traços do layout em blocos IR (posicionamento, descida, corte, subida).
 *
 * Por traço: rápido em XY no Z de segurança → descida no avanço →
 * corte (retas e arcos) → subida rápida ao Z de segurança. Sem
 * otimização de percurso nesta versão (ordem dos traços preservada).
 */
import { ValidationError } from '../validation/validationEngine';

// Arredonda para 3 casas; nunca devolve -0 (proibido no programa).
export function round3(v) {
  const r = Math.round(v * 1000) / 1000;
  return (r === 0 ? 0 : r).toFixed(3);
}

const DEFAULTS = {
  zGravacao: 0,
  zSeguranca: 10,
  feed: 2000,
  rpm: 1000,
  ferramenta: 2,
  zInicio: 100,
};

function num(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

/**
 * @param {{ strokes }} layout saída de layoutText (coordenadas absolutas)
 * @param {object} machining { zGravacao=0, zSeguranca=10, feed=2000,
 *   rpm=1000, ferramenta=2, zInicio=100 }
 * @returns {object[]} blocos IR (tipos de `core/program/types.js`).
 */
export function buildToolpath(layout, machining = {}) {
  const m = {
    zGravacao: num(machining.zGravacao, DEFAULTS.zGravacao),
    zSeguranca: num(machining.zSeguranca, DEFAULTS.zSeguranca),
    feed: num(machining.feed, DEFAULTS.feed),
    rpm: num(machining.rpm, DEFAULTS.rpm),
    ferramenta: num(machining.ferramenta, DEFAULTS.ferramenta),
    zInicio: num(machining.zInicio, DEFAULTS.zInicio),
  };
  if (!(m.feed > 0)) throw new ValidationError('INVALID_MACHINING', 'feed', 'Avanço deve ser maior que zero.');
  if (!(m.rpm > 0)) throw new ValidationError('INVALID_MACHINING', 'rpm', 'Rotação deve ser maior que zero.');
  if (!(m.ferramenta > 0)) throw new ValidationError('INVALID_MACHINING', 'ferramenta', 'Ferramenta deve ser maior que zero.');

  const blocks = [];
  layout.strokes.forEach((st, i) => {
    // Primeiro posiciona XY ainda no alto (Z de início), depois desce para
    // o Z de segurança — nunca o contrário.
    blocks.push({
      type: 'rapid',
      coords: { x: round3(st.from[0]), y: round3(st.from[1]) },
    });
    if (i === 0 && m.zSeguranca !== m.zInicio) {
      blocks.push({ type: 'rapid', coords: { z: round3(m.zSeguranca) } });
    }
    blocks.push({
      type: 'linear',
      coords: { z: round3(m.zGravacao) },
      feed: m.feed,
    });
    for (const s of st.segs) {
      if (s.t === 'L') {
        blocks.push({
          type: 'linear',
          coords: { x: round3(s.to[0]), y: round3(s.to[1]) },
          feed: m.feed,
        });
      } else {
        blocks.push({
          type: 'arc',
          center: { x: round3(s.c[0]), y: round3(s.c[1]) },
          end: { x: round3(s.to[0]), y: round3(s.to[1]) },
          direction: s.cw ? 'cw' : 'ccw',
          feed: m.feed,
        });
      }
    }
    blocks.push({ type: 'rapid', coords: { z: round3(m.zSeguranca) } });
  });
  return { blocks, machining: m };
}
