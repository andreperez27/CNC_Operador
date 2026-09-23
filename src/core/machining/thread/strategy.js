/**
 * Estratégia de roscamento (canônico, core).
 *
 * Uma rosca do banco define o método:
 *
 *   rigid   — rosca rígida  → ciclo CYCL DEF 207 (iTNC 530). O avanço é
 *             calculado pelo controle a partir do RPM (auto-sincronizado);
 *             aqui apenas informativo (feed = RPM × passo).
 *   helical — interpolação helicoidal (fresa de roscar). O solver calcula o
 *             raio da trajetória do centro da ferramenta, o número de voltas
 *             e o sentido:
 *               raio    = (diametroNominal − diametroFresa) / 2
 *               nVoltas = ceil(profundidade / passo)
 *               DR de Heidenhain: cw → DR− | ccw → DR+
 */

export const RIGID = 'rigid';
export const HELICAL = 'helical';

export function buildThreadStrategy(thread, params) {
  const zEnd = (params.zStart ?? 0) - params.depth;

  const baseHole = {
    holeDepth: params.hole?.final ?? params.depth,
    holeMinimum: params.hole?.minimum ?? params.depth,
    holeSuggested: params.hole?.suggested ?? params.depth,
    holeMargin: params.hole?.margin ?? 0,
  };

  if (thread.method === HELICAL) {
    return {
      method: HELICAL,
      cycle: null,
      radius: (thread.nominal - params.toolDiameter) / 2,
      toolDiameter: params.toolDiameter,
      direction: params.direction || 'cw',
      nPasses: Math.max(1, Math.ceil(params.depth / thread.pitch)),
      zStart: params.zStart ?? 0,
      zEnd,
      depth: params.depth,
      pitch: thread.pitch,
      feed: params.feed,
      rpm: params.rpm,
      entryFeed: params.feed,
      ...baseHole,
    };
  }

  return {
    method: RIGID,
    cycle: thread.cycle || 207,
    nPasses: 1,
    zStart: params.zStart ?? 0,
    zEnd,
    depth: params.depth,
    pitch: thread.pitch,
    feed: params.rpm * thread.pitch,
    rpm: params.rpm,
    ...baseHole,
  };
}