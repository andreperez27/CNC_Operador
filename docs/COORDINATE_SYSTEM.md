# CONVENÇÃO DE COORDENADAS — CHANFRO (core/machining/chamfer)

Documento de referência da convenção usada pelo pipeline canônico de chanfro.
Qualquer novo módulo de usinagem (arredondamento, bolsão, furação, rosca) deve
seguir a mesma convenção.

## Sistema de coordenadas

- **Plano de trabalho:** XZ (corte lateral da peça). O eixo **Y** não é usado
  pelo chanfro (aresta reta percorrida em Y pelo movimento de corte).
- **Orientação:** Z **positivo para cima** (padrão de máquina ferramenta;
  profundidade é Z negativo). X positivo para a direita.
- **Unidades:** milímetros. Ângulos em graus na entrada; convertidos com
  `toRad/toDeg` de `core/geometry/angle.js`.

## Origem (zero-peça)

| Tipo | Origem | Descrição |
|---|---|---|
| `external` | `origin='vertex'` | vértice superior da região retangular: aresta X=0 no topo Z=0 |
| `internal` | `origin='corner'` | canto superior interno do bolsão: parede X=0 no topo Z=0 |

O tipo é mapeado implicitamente para a origem pelo solver (`external` →
`vertex`, `internal` → `corner`); a página exibe a origem ao usuário.

## Geometria do chanfro

- O chanfro é o triângulo retângulo de catetos `profZ = C·sen(A)` (vertical)
  e `largX = C·cos(A)` (horizontal), com a hipotenusa na superfície do chanfro.
- O plano do chanfro é definido pela linha que desce da aresta/coanto:
  - **externo:** da origem (aresta superior) para dentro da peça (para a esquerda
    no sistema XZ adotado) — X negativo;
  - **interno:** da parede do bolsão (canto) para dentro do bolsão (para a
    direita) — X positivo.

## Sinais de X (regra central)

O sinal da coordenada X do centro da ferramenta depende do **tipo de chanfro**:

| Tipo | xCentro | Efeito no laço |
|---|---|---|
| `external` | `xCentro = −largX + Reff/sen(A)` (negativo) | a cada passe X **cresce** (aproxima de 0) |
| `internal` | `xCentro = +sen(A)·Reff` (positivo) | a cada passe X **decresce** (afasta da parede) |

Consequências no template de loop compacto:
- externo: `Q21 = Q10 + Q20·Q22` (X cresce com o passe);
- interno: `Q21 = Q10 − Q20·Q22` (X decresce com o passe).

**Não alterar o sinal do interno para `+`** — já causou erro histórico
(documentado nos testes T12/T13).

## Superfícies côncavas — normal invertida

`core/machining/contactGeometry.js`: para `convexity='concave'` (chanfro
interno) a normal da superfície é **invertida** antes de calcular o centro da
ferramenta (`Ct = Pc + n_efetiva·Reff`), pois o centro fica do lado oposto do
ponto de contato em relação à face externa.

## Estratégia de passes (core/machining/chamfer/strategy.js)

- `nPasses = ⌈profZ/passeZ⌉`; `incReal = profZ/nPasses`.
- Os passes são numerados de **1 a nPasses** (descendo de Z para Z negativo).
- `passeZ <= 0` lança `ValidationError('INVALID_PASS_DEPTH')` — nunca loop.
- O sinal da coordenada X de cada passe é definido pelo `model.type` (mesma
  regra de sinais acima), nunca pela estratégia.

## Saída canônica

`solveChamfer(...)` retorna `{ valid, validation, model }`:

```
model = {
  type, plane, origin,
  params: { A, C, D, r, L, depth, passeZ, ... },   // normalizado (legado-compatível)
  profZ, largX, cotA,
  toolCornerR,                                      // Reff (toolTypes)
  nPasses,
  passes: [{ x, y, z, pass, isLast }],              // TRAJETÓRIA única
  contact: { point: {x,z}, normal, tangent, toolCenter: {x,z}, radius },
  operationId, toolType, feed, rpm, toolNumber,
}
```

- `passes[]` é a **fonte única** para: preview SVG (Heidenhain e G-Code Rápido),
  template IR (`buildChamferProgram`) e Q-params (`toQParams`).
- Coordenadas em `passes`/`contact` usam **y** como substituto de **z** no plano
  XZ (convenção interna compatível com `core/geometry/vector2d`).
- `INVALID_*` codes e mensagens PT: ver `src/core/machining/chamfer/validation.js`.

## Regra de ouro

Nenhum módulo novo deve recalcular `profZ`, `largX`, `cotA`, `Reff`,
`xCentro`, contato ou trajetória. Tudo em `core/machining/chamfer` — importar
e consumir, nunca duplicar (D4 eliminado, D3/D1 pendentes).