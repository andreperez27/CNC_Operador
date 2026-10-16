/**
 * Trajetoria do Gravador de Textos CNC (pura, sem React): transforma os
 * tracos do layout em blocos IR (posicionamento, descida, corte, subida).
 *
 * Por traco (sempre com plunge/approach): rapido em XY no Z de
 * seguranca -> rapido ate a altura de aproximacao -> mergulho no avanco
 * de mergulho ate o Z de gravacao -> corte (retas e arcos) no avanco de
 * corte -> subida rapida ao Z de seguranca. Sem otimizacao de percurso
 * nesta versao (ordem dos tracos preservada).
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
  feed: 500,
  rpm: 1000,
  ferramenta: 2,
  zInicio: 100,
};

function num(v, fallback) {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

// Valores efetivos (fonte unica para nucleo e tela): vazio vira default,
// o resto passa direto (validado depois).
export function effectivePlunge(feed, plungeFeed) {
  if (plungeFeed === undefined || plungeFeed === null) {
    return typeof feed === 'number' && Number.isFinite(feed) && feed > 0 ? 0.25 * feed : null;
  }
  return plungeFeed;
}

export function effectiveApproach(zGravacao, approach) {
  if (approach === undefined || approach === null) {
    return typeof zGravacao === 'number' && Number.isFinite(zGravacao) ? zGravacao + 2 : null;
  }
  return approach;
}

// Aviso (sem bloquear) quando o mergulho passa de 50% do corte.
// Devolve a mensagem ou null.
export function plungeWarning(feed, plunge) {
  if (
    typeof feed === 'number' && Number.isFinite(feed) && feed > 0 &&
    typeof plunge === 'number' && Number.isFinite(plunge) && plunge > 0.5 * feed
  ) {
    return 'Mergulho acima de 50% do corte: risco em ponta fina (aviso, sem bloquear).';
  }
  return null;
}

/**
 * @param {{ strokes }} layout saida de layoutText (coordenadas absolutas)
 * @param {object} machining { zGravacao=0, zSeguranca=10, feed=500,
 *   rpm=1000, ferramenta=2, zInicio=100, plungeFeed=null (auto 25% do
 *   feed), approach=null (auto zGravacao+2) }
 *   plungeFeed: > 0 e <= feed (erro); > 50% do feed avisa sem bloquear.
 *   approach (Z absoluto): >= 0,1 e < zSeguranca (erro).
 * @returns {{ blocks, machining, warnings, plunge }} blocos IR (tipos de
 *   `core/program/types.js`); machining traz os valores efetivos;
 *   plunge diz se a sequencia com aproximacao foi usada.
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
  if (!(m.feed > 0)) throw new ValidationError('INVALID_MACHINING', 'feed', 'Avanco deve ser maior que zero.');
  if (!(m.rpm > 0)) throw new ValidationError('INVALID_MACHINING', 'rpm', 'Rotacao deve ser maior que zero.');
  if (!(m.ferramenta > 0)) throw new ValidationError('INVALID_MACHINING', 'ferramenta', 'Ferramenta deve ser maior que zero.');

  const rawPlunge = machining.plungeFeed;
  const rawApproach = machining.approach;
  if (typeof rawPlunge === 'number' && Number.isNaN(rawPlunge)) {
    throw new ValidationError('INVALID_MACHINING', 'plunge', 'Avanco de mergulho deve ser numero valido.');
  }
  if (typeof rawApproach === 'number' && Number.isNaN(rawApproach)) {
    throw new ValidationError('INVALID_MACHINING', 'approach', 'Altura de aproximacao deve ser numero valido.');
  }

  const blocks = [];
  const warnings = [];
  const plunge = effectivePlunge(m.feed, rawPlunge);
  if (!(plunge > 0)) throw new ValidationError('INVALID_MACHINING', 'plunge', 'Avanco de mergulho deve ser maior que zero.');
  if (!(plunge <= m.feed)) throw new ValidationError('INVALID_MACHINING', 'plunge', 'Avanco de mergulho nao pode passar do avanco de corte.');
  const approach = effectiveApproach(m.zGravacao, rawApproach);
  if (!(approach >= 0.1)) throw new ValidationError('INVALID_MACHINING', 'approach', 'Altura de aproximacao deve ser no minimo 0,1 mm.');
  if (!(approach < m.zSeguranca)) throw new ValidationError('INVALID_MACHINING', 'approach', 'Altura de aproximacao deve ser menor que o Z de seguranca.');
  const warn = plungeWarning(m.feed, plunge);
  if (warn) warnings.push(warn);

  layout.strokes.forEach((st, i) => {
    // Primeiro posiciona XY ainda no alto (Z de inicio), depois desce para
    // o Z de seguranca - nunca o contrario.
    blocks.push({
      type: 'rapid',
      coords: { x: round3(st.from[0]), y: round3(st.from[1]) },
    });
    if (i === 0 && m.zSeguranca !== m.zInicio) {
      blocks.push({ type: 'rapid', coords: { z: round3(m.zSeguranca) } });
    }
    // FMAX ate a aproximacao; mergulho so ate a profundidade, no avanco
    // de mergulho; corte (retas e arcos) no avanco de corte.
    blocks.push({ type: 'rapid', coords: { z: round3(approach) } });
    blocks.push({
      type: 'linear',
      coords: { z: round3(m.zGravacao) },
      feed: plunge,
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
  return { blocks, machining: { ...m, plungeFeed: plunge, approach }, warnings, plunge: true };
}
