/**
 * Adapter canônico para o gerador G-Code legado (chanfro).
 *
 * O gerador `chanfro_aresta_reta_torica` do caminho legado agora usa o
 * pipeline canônico (core/machining/chamfer): o solve retorna o MODELO
 * canônico (mesmos profZ/largX do preview legado) e o generate produz o
 * programa Heidenhain via IR + postprocessor — a mesma saída da aba
 * Heidenhain, eliminando a duplicação de pipelines (D4 do inventário).
 *
 * Entradas inválidas (A=0°, passeZ<=0, r>D/2, D<=0...) retornam null
 * em vez de lançar — preservando o comportamento defensivo da página
 * legada (sem crash).
 */

import { solveChamfer, buildChamferProgram } from '../../../core/machining/chamfer';

const LEGACY_DEFAULTS = {
  toolType: 'toroidal',
  safety: 10,
  toolNumber: 1,
  sobre: 0,
};

export function solveChamferLegacy(params) {
  if (!params) return null;

  const result = solveChamfer({
    type: 'external',
    width: params.C,
    angle: params.A,
    depth: params.depth,
    tool: {
      type: params.toolType || LEGACY_DEFAULTS.toolType,
      diameter: params.D,
      radius: params.r,
    },
    strategy: { passDepth: params.passeZ },
    plane: 'XZ',
    origin: 'vertex',
    length: params.L,
    feed: params.av,
    rpm: params.rpm,
    safety: LEGACY_DEFAULTS.safety,
    toolNumber: LEGACY_DEFAULTS.toolNumber,
    sobre: LEGACY_DEFAULTS.sobre,
  });

  return result.valid ? result.model : null;
}

export function chamferProgramFromModel(model) {
  if (!model) return '; Erro: parametros invalidos ou insuficientes.';
  return buildChamferProgram(model);
}