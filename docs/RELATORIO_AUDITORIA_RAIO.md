# RELATÓRIO DE AUDITORIA — MÓDULO "RAIO" (canônico Heidenhain)

Auditoria preparatória para a implementação do módulo **Raio de arredondamento
externo em aresta reta** (Heidenhain unificado), com a planilha de setor como
fonte primária. Nenhum código foi alterado — este relatório registra decisões e
status da fase de auditoria.

## 1. Escopo e fontes

| Fonte | Caminho | Papel |
|---|---|---|
| Planilha de setor | `calculo_chanfro_parametrizado.xlsx` | Autoridade de engenharia (bloco linhas 17–24 "Raio de canto externo") |
| Referência extraída | `docs/RAIO_SPREADSHEET_REFERENCE.md` | Mapa oficial fórmulas ↔ geometria ↔ contrato |
| G-Code arredondamento | `features/gcode/{solvers/roundingSolver,templates/roundingTemplate}` | Legado a confrontar |
| Preview arredondamento | `gcode/preview/` (build/model + RoundingEdge/InternalRadius orphan) | Legado de UI |
| Registro | `gcode/registry/registry.js` (`arredondamento_aresta_reta_torica`) | Entrada do legado |
| Chamfro (modelo de doc/tests) | `docs/CHAMFER_PRODUCTION_REFERENCE.md`, `tests/productionReference.test.js` | Padrão a seguir |

## 2. Status geral

**Estado da auditoria: C — aprovado como referência, com divergências
matemáticas registradas no legado.** A planilha é fiel e implementável 1:1; o
G-Code legado existente **não** reproduz a geometria da planilha (arco `R` vs
`R+r`, X relativo vs absoluto) e está classificado **DIVERGENTE (C)**.

## 3. Entregáveis — status

| # | Entregável | Status | Observação |
|---|---|---|---|
| A | Copy/grade e semântica dos parâmetros | **Concluído (A/B)** | Mapa Q (planilha) → contrato: Q1=R, Q2=D, Q3=r, Q5=incrZ; labels da planilha e do contrato **não** coincidem 1:1 (estrutural) |
| B | Estrutura do laço / passes | **Concluído (A/B)** | Planilha: X absoluto com raio `ρ=R+r`; G-Code legado: X relativo |arco `R`; contagem de passes por `incrZ` |
| C | Fórmulas matemáticas | **Concluído (A)** | Reprodução numérica IDÊNTICA: `Q4=−(R−(D/2−r))`, `Q6=SQRT((R+r)²−((R+r)−inc)²)+(D/2−r)−R`; limites `0 ≤ z ≤ 2ρ` |
| D | Formatação de número | **Concluído (A)** | Inputs azuis `DDEBF7`; resultados `0.000` (tela) — o contrato mantém precisão interna total |
| E | Trajetória (ordem de movimentos por passe) | **Concluído (A/B)** | Esqueleto derivável da planilha: topo `z=0` → descida no arco → X conforme `Q6` → recuo; conversão de sinal Z (planilha usa profundidade positiva) fica no IR |
| F | Laço e terminação por contagem | **Concluído (A)** | `z` acumulado; terminação quando `z ≥ prof útil` do ciclo (planilha cobre `0..2ρ`; o ciclo usa `min(inc, R)`) |
| G | Comparação linha-a-linha (byte) | **Concluído (A/B)** | Planilha: 2 fórmulas-fonte a reproduzir (Q4/Q6); não há programa .H para raio — referência lógica |
| H | Deltas (M-Y vs planilha) | **Concluído (C)** | Ver tabela §4 |
| I | Casos numerados (modelo de produção) | **Concluído (A)** | 7 casos na referência (§3 da doc); exemplo canônico (20,25,0.8,20) |
| J | Invariantes de segurança | **Concluído (A)** | `R>0`, `r<R` (obrigatório para tórica), festa arco máximo `z=2ρ`; validação no módulo |
| K | Riscos/perigos da divergência | **Concluído (A)** | Nenhuma divergência perigosa (E) na planilha; o legado é que é divergente |
| L | Relatório final | **Concluído (A)** | Este documento |
| M | Registro de módulo (registry unificado) | **Concluído (A)** | Prompt 014 — entrada `raio_aresta_reta_torica` em `gcode/registry/registry.js` (solve `canonicalRadius.solveRadiusLegacy`, generate `radiusProgramFromModel` IR→post) |
| N | Implementação (solver + template + preview) | **Concluído (A)** | `core/machining/radius/{model,solver,geometry,validation,strategy,trajectory,template,index}.js` + preview `heidenhain/preview/buildRadiusPreviewScene.js` + `gcode/preview/RadiusPreview.jsx`; página G-Code Rápido com seletor Operação (Chanfro/Raio externo) |
| O | Testes (referência/tangência/limites) | **Concluído (A)** | `tests/radius.test.js` (33 testes): planilha (Q4/Q6), identidade do círculo, limites (R<r, D=0, r>D/2, inc≤0), IR, postprocessor .H, confronto com o legado divergente, registry, preview |

## 4. Deltas registrados (planilha vs legado G-Code)

| Grandeza | Planilha (autoridade) | G-Code legado | Diferença |
|---|---|---|---|
| Raio do arco (trajetória centro fresa) | `ρ = R + r` | `R` (no laço Q13; `R+r` só no solver) | **~7,5 mm em X** no exemplo |
| Natureza da posição X | absoluto (centro em `(D/2−r)−R`) | relativo (`IX−Q13` de `X=rTraj`) | estrutural |
| Passe final | pela contagem do ciclo | `Q10=R` fixo | estrutural |
| Cobertura do arco | até `2ρ` (retorno ao início) | até `R` | matemática |

## 5. Riscos

- **Misturar a geometria do legado** com a da planilha ao implementar → propagar
  o erro de arco `R`. Mitigação: implementar **somente** a planilha; arquivar o
  legado como referência divergente.
- **Sinal de Z** (planilha usa profundidade positiva, iTNC negativo) → conversão
  no IR, nunca no cálculo da superfície (padrão do chamfro canônico).
- **Conv fatores de UI**: `r ≥ R` deve ser rejeitado (fresa tórica não usina
  raio menor que o próprio canto — validação análoga à do chamfro).

## 6. Recomendação de contrato do módulo (spec de referência)

- Parâmetros: `L` (comprimento aresta), `R` (raio arredondamento), `D` (diâmetro
  fresa), `r` (raio de canto), `incrZ` (incremento Z), `rpm`, `av`.
- Solver: `rTraj = R + r`; `xCentro(0) = (D/2 − r) − R`; a cada profundidade
  `z`: `X = xCentro(0) + SQRT(z(2·rTraj − z))`; limite `0 ≤ z ≤ 2·rTraj`;
  número de passes = ⌈prof útil / incrZ⌉ com `passoZ = prof útil / nPasses`;
  `prof útil = prof do ciclo (default R)`.
- Tangência: convenção — manter o invariante do nariz (distância do centro da
  fresa ao centro do arco = `R + r` em todos os passes), como exigido para o
  chamfro.
- IR Heidenhain: `X−` (negativo) e `Z−` na descida; movimentos por passe na
  ordem do esqueleto do chamfro (seguro → desce → avança X → varre Y → recua).

## 7. Evidência da auditoria

- Scripts de reprodução (temp): `audit_raio_num.py`, `audit_raio_num2.py`,
  `raio_block.py`.
- Resultado da reprodução: fórmulas idênticas; tabelas em
  `RAIO_SPREADSHEET_REFERENCE.md`.

_Itens M–O CONCLUSOS (Prompt 014 — implementação canônica do Raio externo)._
_Pós-implementação: `npm test` (175), `npm run lint` (0 erros), `npm run build` (OK) em `cnc-operator/`._

_Adendo (preparação do primeiro commit — sem reescrever a auditoria): o módulo
Raio passou a cobrir também o tipo interno (bolsão) — `RADIUS_TYPES =
['external','internal']`, espelho em X (`Xc = R − (D/2 − r)`,
`Q21 = Q4 − SQRT(...)`), validação de folga (`INVALID_POCKET_WIDTH`,
`INVALID_CLEARANCE`) — e a aba "Raio externo" do G-Code Rápido passou a
"Raio", com seletor Externo / Interno (bolsão). Números vigentes de testes e
build: ver README.md._