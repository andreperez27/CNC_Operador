/**
 * Modelo canônico do Raio (externo em aresta reta) — core.
 *
 * Normaliza a entrada do solver e define os campos EXPLÍCITOS do modelo
 * geométrico, seguindo a referência oficial (planilha de setor):
 *
 *   Q1 = R          raio desejado da peça
 *   Q2 = D          diâmetro da ferramenta
 *   Q3 = r          raio de canto da ferramenta
 *   Q5 = incremento incremento/passe da trajetória
 *
 * RAIO INTERNO (canto do bolsão): espelho em X do externo — o centro do
 * círculo da trajetória fica em Xc = R − (D/2 − r) (vértice do canto em X=R)
 * e Q6(z) = Xc − SQRT(z·(2·rho − z)); o bolsão precisa caber a ferramenta
 * (validação INVALID_CLEARANCE). Tipo vem de `input.type` (default 'external').
 *
 * Grandezas derivadas (fórmulas da planilha — NÃO substituir):
 *
 *   rho  = R + r                        raio da trajetória do centro
 *   Xc   = (D/2 − r) − R                centro X do círculo (Q4)
 *   Q4   = Xc                           X inicial da ferramenta em Z=0
 *   Q6(z)= SQRT((R+r)² − ((R+r)−z)²) + (D/2 − r) − R     X na profundidade z
 *
 * A identidade geométrica do círculo (testável) é:
 *
 *   (X − Xc)² + (Z − Zc)² = rho²  com Zc = rho (profundidade positiva,
 *   mesma convenção de docs/RAIO_SPREADSHEET_REFERENCE.md §4).
 *
 * Campos esperados pelo modelo:
 *   params { R, D, r, L, incrZ, rpm, av, toolType, numeroFerramenta,
 *            distanciaSeguranca, blocoW, blocoL, blocoH, sobre }
 */

export function normalizeRadiusInput(input) {
  const tool = input.tool || {};
  const rEff = tool.type === 'endMill' ? 0 : tool.radius;
  return {
    R: input.radius,
    D: tool.diameter,
    r: rEff,
    L: input.length,
    incrZ: input.strategy?.passDepth,
    rpm: input.rpm,
    av: input.feed,
    toolType: tool.type,
    numeroFerramenta: input.toolNumber,
    distanciaSeguranca: input.safety,
    blocoW: input.stock?.w,
    blocoL: input.stock?.l,
    blocoH: input.stock?.h,
    sobre: input.sobre,
    type: input.type === 'internal' ? 'internal' : 'external',
    clearance: {
      pocketWidth: input.clearance?.pocketWidth,
    },
  };
}