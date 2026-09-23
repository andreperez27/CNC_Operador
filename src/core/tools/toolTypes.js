/**
 * Catálogo canônico de ferramentas (core).
 *
 * Fonte única de verdade para os tipos de ferramenta usados pelo
 * motor matemático. As features (ex.: `features/heidenhain/math/
 * toolTypes.js`) re-exportam este catálogo — nunca definem os seus.
 *
 * Cada tipo descreve como calcular o RAIO EFETIVO (Reff) no ponto de
 * contato com o chanfro:
 *
 *   END_MILL    — fresa de topo reta: Reff = 0 (tangência degenerada,
 *                 o contato é no próprio canto da ferramenta)
 *   TOROIDAL    — fresa com raio de canto r: Reff = r
 *   BALL_NOSE   — fresa esférica: Reff = D/2 (r é ignorado)
 *   CHAMFER_MILL— fresa de chanfro: Reff = 0 (corte no vértice do bisel)
 *
 * Valores de referência (testes T2–T4 do inventário, A=45°, C=5, D=16, r=0,8):
 *   toroidal → Reff = 0,8 ;  xCentro = −2,404163
 *   ballNose → Reff = 8   ;  xCentro = 7,778175
 *   endMill  → Reff = 0   ;  xCentro = −3,535534
 */

export const TOOL_TYPES = {
  END_MILL: {
    id: 'endMill',
    name: 'Fresa Topo',
    getReff: () => 0,
  },
  TOROIDAL: {
    id: 'toroidal',
    name: 'Fresa Torica',
    getReff: (_D, r) => r,
  },
  BALL_NOSE: {
    id: 'ballNose',
    name: 'Fresa Esferica',
    getReff: (D, _r) => D / 2,
  },
  CHAMFER_MILL: {
    id: 'chamferMill',
    name: 'Fresa de Chanfro',
    getReff: () => 0,
  },
};

export const TOOL_TYPE_LIST = Object.values(TOOL_TYPES);

const TOOL_BY_ID = {};
TOOL_TYPE_LIST.forEach((t) => {
  TOOL_BY_ID[t.id] = t;
});

export function getToolType(id) {
  return TOOL_BY_ID[id] || TOOL_TYPES.TOROIDAL;
}

export function isKnownToolType(id) {
  return Boolean(id && TOOL_BY_ID[id]);
}
