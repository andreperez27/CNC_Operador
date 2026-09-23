/**
 * Adapter canônico para o gerador G-Code (raio — novo pipeline).
 *
 * A operação `raio_aresta_reta_torica` usa o pipeline canônico
 * (core/machining/radius): o solve retorna o MODELO (com q4/q6 e a
 * trajetória) e o generate produz o programa Heidenhain via IR +
 * postprocessor — mesma saída do G-Code Rápido, eliminando o uso do
 * caminho legado `roundingSolver + roundingTemplate` (classificado
 * DIVERGENTE da planilha — docs/RAIO_SPREADSHEET_REFERENCE.md §6).
 *
 * Entradas inválidas (R=0, r>D/2, R<r, incrZ<=0..., bolsao sem largura no
 * interno) retornam null em vez de lançar — preservando o comportamento
 * defensivo da página legada.
 *
 * TIPO: `params.tipo` = 'external' (default) | 'internal'. No interno,
 * `params.alojamentoLargura` é a largura do bolsão (validação de folga da
 * ferramenta — INVALID_CLEARANCE).
 */

import { solveRadius, buildRadiusProgram } from '../../../core/machining/radius';

const LEGACY_DEFAULTS = {
  toolType: 'toroidal',
  safety: 10,
  toolNumber: 1,
  sobre: 0,
};

export function solveRadiusLegacy(params) {
  if (!params) return null;

  const type = params.tipo === 'internal' ? 'internal' : 'external';

  const result = solveRadius({
    type,
    radius: params.R,
    tool: {
      type: params.toolType || LEGACY_DEFAULTS.toolType,
      diameter: params.D,
      radius: params.r,
    },
    strategy: { passDepth: params.incrZ },
    plane: 'XZ',
    origin: 'vertex',
    length: params.L,
    feed: params.av,
    rpm: params.rpm,
    safety: LEGACY_DEFAULTS.safety,
    toolNumber: params.toolNumber ?? LEGACY_DEFAULTS.toolNumber,
    sobre: LEGACY_DEFAULTS.sobre,
    ...(type === 'internal' ? { clearance: { pocketWidth: params.alojamentoLargura } } : {}),
  });

  return result.valid ? result.model : null;
}

export function radiusProgramFromModel(model) {
  if (!model) return '; Erro: parametros invalidos ou insuficientes.';
  return buildRadiusProgram(model);
}