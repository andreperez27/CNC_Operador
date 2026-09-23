# INVENTÁRIO FUNCIONAL — CNC Operador

> Levantamento do estado atual. A partir da Fase 2 (G-Code Rápido — Chanfro),
> funcionalidades marcadas com **★** foram migradas para o pipeline canônico
> (`src/core/machining/chamfer` + ValidationEngine + IR → postprocessor).
> Classificação: **A** pronta/reutilizável · **B** funciona, precisa refatoração ·
> **C** incompleta · **D** duplicada · **E** deve ser substituída futuramente.

---

## 1. Visão geral das funcionalidades

| # | Funcionalidade | Arquivo(s) | Engine | Class. |
|---|---|---|---|---|
| F1 | Banco de dados canônico de roscas ★ MIGRADO | `core/machining/thread/database.js` | 45 roscas (32 métricas M1–M64 + 13 finas ISO 724/DIN 13), 5 famílias (`metric`/`fine` disponíveis, `unc`/`unf`/`bsp` pendentes); furo = série padrão de broca ≈ Ø nominal − passo (rosca.xlsx sobrepõe o legado); `source` explícito por registro | **A** |
| F2 | Motor de rosca rígida/helicoidal (CYCL DEF 207) ★ MIGRADO | `core/machining/thread/{solver,strategy,trajectory,index}.js` | `solveThread` → `buildThreadStrategy` (rigid: av = rpm × passo, informativo — controle autosincroniza; helical: raio `(dN − dF)/2`, voltas ⌈prof/passo⌉, sentido DR−/DR+) + `buildThreadTrajectory` (hélice 3D p/ preview); `operationId` roscaRigida/roscaHelicoidal. Templates legados removidos | **A** |
| F3 | IR de rosca + postprocessing ★ MIGRADO | `core/machining/thread/template.js` + `core/program/types` + `core/postprocessors/heidenhain` | rígida → CYCL DEF 207 (Q200/Q203/Q335/Q239/Q201/Q253/Q358/Q359/Q254 — Q335+ preservam o template de fábrica; ver THREAD_DATABASE.md §6); helicoidal → CC/CP (IPA/IZ/DR) | **A** |
| F4 | Triângulo retângulo (solver) | `features/trigonometria/solver/triangleSolver.js` | sen/cos/tan/arcos (10 combinações de 2 entradas) | **A** |
| F5 | Preview SVG do triângulo | `features/trigonometria/components/TriangleSvg.jsx` | 4 configs estáticas + botão girar | **B** |
| F6 | G-Code rápido — chanfro aresta reta (tórica) **★ MIGRADO (D4)** | `features/gcode/registry/registry.js` (gen. `chanfro_aresta_reta_torica`) + `registry/canonicalChamfer.js` | passa a usar `solveChamfer` (core canônico) + `buildChamferProgram` (IR → postprocessor); `chamferSolver.js`/`chamferTemplate.js` removidos | **A** |
| F7 | G-Code rápido — arredondamento aresta reta | `registry.js` (`arredondamento_aresta_reta_torica`) + `solvers/roundingSolver.js` + `templates/roundingTemplate.js` | rTraj= R + rEfet; passoZ= R/nPasses; arco no controle via `SQRT` em Q13 | **B** / **E** (geração) |
| F8 | Preview SVG chanfro externo (G-Code) | `gcode/preview/buildChamferPreviewModel.js` + `ChamferEdgePreview.jsx` | tangência exata por normal; clamp anti-corte | **A** |
| F9 | Preview SVG arredondamento externo | `gcode/preview/buildRoundingPreviewModel.js` + `RoundingEdgePreview.jsx` | tangência por bissetriz (canto côncavo) | **A** |
| F10 | Preview SVG chanfro/raio interno (G-Code) | `gcode/preview/buildInternalChamferPreviewModel.js`, `buildInternalRadiusPreviewModel.js`, `InternalChamferPreview.jsx`, `InternalRadiusPreview.jsx` | tangência com convexity côncava | **A** (antes **C**/órfãos — agora consumidos pelo registry `raio_aresta_reta_torica` com tipo internal e pela página G-Code Rápido) |
| F11 | Chanfro externo Heidenhain — motor matemático | `features/heidenhain/math/chamferExternalMath.js` | profZ, largX, cotA, Reff (toolTypes), xCentro= −largX + Reff/senA, contato/tangência via `contactGeometry` | **A** (com ressalvas §6.3) |
| F12 | Chanfro interno Heidenhain — motor matemático | `features/heidenhain/math/chamferInternalMath.js` | idem + xCentro= senA·Reff, validação de folga no bolsão (throw) | **A** |
| F13 | Estratégia de passes | `features/heidenhain/strategy/strategyEngine.js` | nPasses= ⌈profZ/passeZ⌉, incReal, lista de passes | **B** (sem guarda p/ passeZ≤0) |
| F14 | Q-parameters (mapas + fórmulas + ordenação topológica) | `core/params/parameterEngine.js`, `features/heidenhain/params/parameterEngine.js` | mapas `EXTERNAL_CHAMFER_MAP`/`DEFAULT_MAP`; fórmulas com extração de dependências | **A** |
| F15 | Template chanfro externo (loop compacto LBL 1 / FN 12, M90, BLK FORM opcional, FN 0 literais, TOOL CALL) | `features/heidenhain/program/templates/chamferExternalTemplate.js` | IR puro → postprocessor | **A** |
| F16 | Template chanfro interno | `features/heidenhain/program/templates/chamferInternalTemplate.js` | IR puro (seções, posicionamento, loop) | **A** |
| F17 | IR + postprocessor Heidenhain (numeração, vírgula decimal, BEGIN/END PGM, `$N`→`QN`, M90, M30) | `core/program/types.js`, `core/postprocessors/heidenhain.js`, `programName.js` | texto final | **A** |
| F18 | Nome de programa + download .H | `core/postprocessors/programName.js`, `core/export/downloadProgram.js`, `components/ProgramDisplay.jsx` | `<OP>_AAAAMMDD.H` | **A** |
| F19 | Preview Heidenhain chanfro externo/interno (SVG com trajetória, contato, validação) | `features/heidenhain/preview/chamferExternalPreviewModel.js`, `chamferInternalPreviewModel.js`, `ChamferExternalPreview.jsx`, `ChamferInternalPreview.jsx`, `previewGeometry.js` | conversão máquina→SVG; contato via motor | **A** |
| F20 | Tipos de ferramenta | `features/heidenhain/math/toolTypes.js` | endMill/toroidal/ballNose/chamferMill | **B** (só Heidenhain; G-Code ignora) |
| F21 | Validação de folga de ferramenta | `core/validators/validateToolClearance.js` | D + margem ≤ espaço; mensagem PT | **A** |
| F22 | Validação genérica de parâmetros (positivos) | `features/gcode/utils/validators.js` | `> 0` | **B** (não cobre NaN/Inf/limites) |
| F23 | Validação de tangência | `features/heidenhain/math/contactGeometry.js` (`validateContact`) | |dist − Reff| < 0.001 | **A** |
| F24 | Gerador de programa de teste (script) | `scripts/generate-test-program.mjs` | mesmo pipeline F11→F17 | **A** |
| F25 | Geração de ícones PWA (script) | `scripts/generate-icons.mjs` | PNG puro | **A** |
| F26 | **Pipeline canônico de chanfro** (solver + validação + geometria + estratégia + trajetória + IR) | `core/machining/chamfer/{solver,validation,geometry,strategy,trajectory,template,index}.js` | fonte única de verdade; consumido pela página G-Code Rápido, pelos adapters Heidenhain e pelo G-Code legado (D4) | **A** |
| F27 | **Motor de validação estruturada (ValidationEngine)** | `core/validation/validationEngine.js` | `createValidation/addError/addWarning/finalize/guard/raiseFirstError`, códigos INVALID_*/WARN_* | **A** |
| F28 | **Catálogo canônico de ferramentas** | `core/tools/toolTypes.js` | endMill/toroidal/ballNose/chamferMill; `getToolType`/`isKnownToolType` | **A** |
| F29 | **Página "G-Code Rápido"** (chanfro externo/interno) | `features/gcoderapido/{GCodeRapidoPage,components/{ChamferForm,ValidationPanel}}` | form completo, validação ✓/❌ por campo + painel, resultados, preview canônico, Q-params, exportar/copiar .H | **A** |
| F30 | **Testes de regressão automatizados (vitest)** | `tests/{chamfer,validation,toolTypes,triangle,registryMigration,productionReference,previewContract,thread,processRules}.test.js` | 140 testes: T1–T13, inválidos estruturados, paridade byte-a-byte com templates legados, roscas via solveThread, regras de processo (solver puro + prioridade + consistência) | **A** |
| F31 | **Pipeline canônico de roscas** | `core/machining/thread/{database,solver,strategy,trajectory,search,holeDepth,template,index}.js` | fonte única de verdade (dados + geometria + solver + IR); consumido pela página Roscas; `searchThreads`/`getAvailableFamilies` para seleção | **A** |
| F32 | **Página "Roscas" reconstruída** | `features/roscas/{RoscasPage,components/{ThreadSelector,ThreadDetail,ThreadForm,ThreadPreview}}` | busca por família/designação, detalhes, formulário rígido/helicoidal, preview do programa, copiar/download .H | **A** |
| F33 | **Regras de processo — furo cego** | `core/process/rules/blindHoleDepth.js` + `core/machining/thread/holeDepth.js` | banco separado da tabela de roscas (norma ≠ regra); `calculateBlindHoleDepth` (solver puro, nunca NaN/Inf), regras 2,5×Ø rosca / 4×Ø broca / 5×Ø rosca / personalizada; `resolveHoleFromInput` com prioridade desenho > operador > regra > padrão; margem inferior configurável; validação furo ≥ rosca | **A** |
| F34 | **Pipeline canônico de raio externo (arredondamento)** | `core/machining/radius/{model,solver,validation,geometry,strategy,trajectory,template,index}.js` | Reproduz a planilha de setor (§ bloco "Raio de canto externo", `docs/RAIO_SPREADSHEET_REFERENCE.md`): `rho = R + r`, `Xc = Q4 = (D/2 − r) − R`, `Q6(z) = Xc + SQRT(z(2·rho − z))` (identidade do círculo testável), passe final exato em `z = R`, validação estruturada (`INVALID_RADIUS`, `INVALID_RADIUS_RANGE` R<r, `INVALID_TOOL_DIAMETER/RADIUS`, `INVALID_INCREMENT`, `WARN_R_EQUALS_R`, `WARN_SINGLE_PASS`, `WARN_MANY_PASSES`), IR puro → postprocessor; converte Z no IR | **A** |
| F35 | **Raio no registry + preview + G-Code Rápido** | `features/gcode/registry/canonicalRadius.js`, `registry.js` (`raio_aresta_reta_torica`), `heidenhain/preview/buildRadiusPreviewScene.js`, `gcode/preview/RadiusPreview.jsx`, `gcode/components/preview/GcodePreviewPanel.jsx` (PREVIEW_MAP), `gcode/preview/RoundingEdgePreview`/`RoundEdge` (legado divergente classificado), página G-Code Rápido (seletor Operação Chanfro/Raio + `features/gcoderapido/components/RadiusForm.jsx`) | registry gera via pipeline canônico (mesma saída do G-Code Rápido); `EXTERNAL_RADIUS_MAP` em `heidenhain/params/parameterEngine.js`; preview SVG dedicado (perfil/raios de profundidade/traj. círculo ρ/contato/ferramenta tórica/simulador); o legado `arredondamento_aresta_reta_torica` (arco R, X relativo) mantido só para regressão — classificado **E** | **A** |

## 2. Entradas e saídas por funcionalidade principal

| Funcionalidade | Entradas | Cálculos | Saída | G-Code | Preview |
|---|---|---|---|---|---|
| Chanfro externo (Heidenhain) | A, C, D, r, L, passeZ, sobre, rpm, av, toolType, numeroFerramenta, distanciaSeguranca, blocoW/L/H | profZ, largX, cotA, Reff, xCentro, nPasses, incReal, xCorner, yTotal | modelo + qParams + programa .H (loop LBL 1) | Sim (IR→post) | Sim (SVG) |
| Chanfro interno (Heidenhain) | idem + alojamentoLargura | + xCentro= senA·Reff, trajXEnd, folga | modelo + qParams + programa .H | Sim (IR→post) | Sim (SVG) |
| Chanfro rápido (G-Code) | L, C, A, D, r, passeZ, rpm, av | profZ, largX, offsetX, contatoX, xCentro, nPasses | texto Q1..Q11 + LBL 1 | Sim (string) | Sim (SVG) |
| Arredondamento (G-Code) | L, R, D, r, incrZ, rpm, av | rTraj, nPasses, passoZ | texto Q1..Q13 + LBL 2 | Sim (string) | Sim (SVG) |
| **Raio externo/interno (canônico)** | tipo, L, R, D, r, incrZ, rpm, av (+ alojamentoLargura no interno) | rho=R+r; externo: Xc=(D/2−r)−R, Q6(z)=Xc+SQRT(z(2ρ−z)); interno (espelho em X): Xc=R−(D/2−r), Q6(z)=Xc−SQRT(z(2ρ−z)), xCorner=segurança+D/2, folga D+2; nPasses=⌈R/incrZ⌉, incReal | modelo + qParams (`EXTERNAL_RADIUS_MAP`) + programa .H (loop LBL 1, `Q21=Q4±SQRT(Q20·Q22−Q20²)`, M90) | Sim (IR→post) | Sim (SVG canônico ext.; esquemático int.) |
| Roscas | família/designação (M10X1.5…), prof. rosca, (furo cego: regra de processo, margem, prof. final), rpm, (diamFresa) | av= rpm×passo (CYCL 207, só informativo — controle autosincroniza); helicoidal: raioInterp `(dN − dF)/2`, voltas ⌈prof/passo⌉; furo cego: fator×referência (2,5×Ø rosca / 4×Ø broca / 5×Ø rosca / personalizada), sugerido = max(regra, rosca+margem) | IR → texto: CYCL DEF 207 (rígida) ou CC/CP/IPA/IZ/DR (helicoidal); comentário do furo cego no .H | Sim (IR→post) | Sim (SVG: ROSCA/FOLGA) |
| Trigonometria | 2 de {a, b, c, A, B} | Pitágoras/trig inversa | a,b,c,A,B,C=90 | Não | Sim (SVG estático) |

## 3. Mapa da matemática (Tarefa 2)

### GEOMETRIA (core/geometry, plano XZ)
- Vetores: `add, sub, scale, dot, cross, length, normalize, distance, rotate` — `core/geometry/vector2d.js`
- Linha: `fromPoints, fromPointDirection, footOfPerpendicular, distanceFromPoint, pointAt, projectPoint` — `core/geometry/line2d.js`
- Círculo/reta: `tangentCenter, validateTangency, tangentCenterAtOffset, circleCircleTangent` — `core/geometry/circleLine.js`
- Ângulos: `toRad, toDeg, cot, normalFromAngle, tangentFromAngle` — `core/geometry/angle.js`

### TRIGONOMETRIA
- `solveTriangle` (10 combinações: a²+b², asin, atan2, tan/cos/sin) — `trigonometria/solver/triangleSolver.js`
- Uso de sen/cos por todo o motor de chanfros (via `toRad`).

### USINAGEM (RPM / avanço)
- Avanço rosca rígida: `av = rpm × passo` (informativo; o controle iTNC autosincroniza) — `core/machining/thread/strategy.js`
- Helicoidal: raioInterp `(dN − dF)/2`, voltas ⌈prof/passo⌉ — `thread/strategy.js`; hélice 3D — `thread/trajectory.js`
- Feeds chanfro: `halfAv = av/2` (mergulho/recuo), `av` (corte) — templates Heidenhain e G-Code
- **Não existe** calculadora de velocidade de corte (Vc), avanço por dente etc. (Fase 3).

### ROSCAS
- Passo/furo: banco canônico (45 registros; furo = série padrão de broca ≈ Ø nominal − passo, rosca.xlsx sobrepõe o legado). **Método por diâmetro**: nominal > 24 → `helical` (CC/CP); ≤ 24 → `rigid` (CYCL 207).
- Raio de interpolação: `(dNominal − dFresa)/2`; voltas = ⌈prof/passo⌉.
- Beacons `FTHREAD_*` (262/267) **não implementados** nesta versão — o pipeline de rosca usa IR canônico (CYCL DEF 207 rígida; CC/CP helicoidal).

### FERRAMENTAS
- `Reff`: toroidal→`r`; ballNose→`D/2`; endMill/chamferMill→`0` — `heidenhain/math/toolTypes.js`
- `toolCornerR`: ballNose→`D/2`, senão `r`.
- G-Code rápido assume sempre `rEfet = r` (toroidal) — não consulta o catálogo.

### G-CODE
- Loop compacto externo: `Q20=Q30*Q4`, `Q21=Q10+Q20*Q22`, `FN 12: IF +Q30 LT +Q31 GOTO LBL 1`
- Loop interno: `Q21=Q10−Q20*Q22`
- Arredondamento: `Q13 = rTraj − √(R² − (R−Q10)²)` no controle (SQRT na máquina)
- **Raio canônico**: `Q21 = Q4 + SQRT(Q20·Q22 − Q20·Q20)` (Q20 = profundidade, Q22 = 2·(R+r)); passe final exato em z=R
- Formatos: `L X+… Y+… Z+… R0 F…`, `CP IPA−360 IZ−… DR− F…`, `CYCL DEF 207 …`, `TOOL CALL n Z S…`, `BLK FORM 0.1/0.2`, `FN 0: Qn =+val ;coment`

## 4. Cálculos duplicados (Tarefa 2 — identificação)

| Cálculo | Onde | Obs. |
|---|---|---|
| `profZ = C·senA` / `largX = C·cosA` | chamferExternalMath, chamferInternalMath, chamferSolver (G-Code), buildChamferPreviewModel (fallback), cabeçalhos/comentários dos templates | 3 engines + 1 preview com fonte real |
| `cotA = largX/profZ` | chamferExternalMath, chamferInternalMath | — |
| `Reff` (definição de raio efetivo) | toolTypes.js, chamferSolver (`rEfet=r`), previews (`r` como cornerR) | 3 definições divergentes |
| `nPasses = ⌈profZ/passeZ⌉` | strategyEngine (Heidenhain), chamferSolver (G-Code), roundingSolver | — |
| Tangência (centro = ponto + normal×Reff) | core/geometry/circleLine (canônico), buildChamferPreviewModel, buildRoundingPreviewModel, buildInternal* (inline em px) | conceito duplicado em px por preview |
| `arcPath` + `VIEW/COLORS` | gcode/preview/previewGeometry.js e heidenhain/preview/previewGeometry.js | cópias quase idênticas |
| Defaults de parâmetros | HeidenhainPage `DEFAULT_PARAMS`, ParamPanel `FIELD_SETS`, registry G-Code `params[].val` | 3 fontes |
| Nome do programa | programName.js (única fonte) — OK | — |

## 5. Ferramentas (Tarefa 5)

| Tipo | id | Reff | Observações / limitações |
|---|---|---|---|
| Fresa de topo | `endMill` | 0 | Reff=0 → tangência degenerada (centro = ponto de contato); sem validação de cantos vivos |
| Tórica | `toroidal` | r | Tipo padrão do app; único usado pelos geradores G-Code |
| Esférica (ball nose) | `ballNose` | D/2 | `toolCornerR=D/2`; no externo `xCentro` dispara (Reff grande, ex.: D=16 → xCentro ≈ 7,78 p/ A=45°) |
| Fresa de chanfro | `chamferMill` | 0 | Igual endMill no motor; não há semântica própria (cone 90°) |

Não há: catálogo por número de ferramenta, tabela de compensação (RL/RR/R0),
relação ferramenta ↔ operação validada. Estrutura futura: `core/tools`.

## 6. Validações (Tarefa 7)

### Existentes
| Validação | Onde | Comportamento |
|---|---|---|
| **ValidationEngine estruturado (canônico)** ★ | `core/validation/validationEngine.js` + `core/machining/chamfer/validation.js` | `{valid, errors[{code,field,message}], warnings[]}`; códigos `INVALID_TYPE/WIDTH/ANGLE/DEPTH/PASS_DEPTH/TOOL_TYPE/TOOL_DIAMETER/TOOL_RADIUS/LENGTH/POCKET_WIDTH/CLEARANCE/SPINDLE_SPEED/FEED` + `WARN_SMALL_ANGLE/DEPTH_OVERRIDE/MANY_PASSES`; bloqueia A=0/90, passeZ≤0 (evita loop infinito), r>D/2, D≤0, r<0 |
| Folga de ferramenta no bolsão (D+margem ≤ alojamento, margem 2 mm) | `core/machining/chamfer/validation.js` (INVALID_CLEARANCE) — chamferInternalMath mantém `throw` legado por compatibilidade | erro estruturado com a MESMA mensagem PT ("Ferramenta D60.0 nao cabe…") |
| Tangência (dist centro−contato = Reff ± 0.001) | core/machining/contactGeometry.validateContact | OK/ERRO, usado nos previews |
| Parâmetros positivos (G-Code rápido legado) | gcode/utils/validators | `≤0`, NaN → lista de erros PT (mantido na aba G-Code) |
| A+B=90° (trigonometria) | triangleSolver | erro "A + B deve ser 90°" |
| Hipotenusa < cateto | triangleSolver | erro "Hipotenusa menor que cateto" |

### Ausentes (próximas fases)
- Validação de folga externa (curso da máquina), arco impossível (R≤r no arredondamento interno), coordenadas fora de curso.
- Consistência de valores entre operação e preview — resolvido no chanfro (mesma trajetória), pendente no arredondamento legado.

## 7. Duplicações e código morto (Tarefa 1, classes D/E)

- **D1** — `gcode/components/preview/{ChamferEdgePreview, RoundingEdgePreview, chamferPreviewHelpers, roundingPreviewHelpers, preview.module.css}` são cópias obsoletas; todos os imports vivos apontam para `gcode/preview/*`.
- **D2** — Previews internos (`InternalChamferPreview`, `InternalRadiusPreview`, build models) órfãos: **RESOLVIDA** — voltaram a ter consumidor (registry `raio_aresta_reta_torica` com tipo internal + página G-Code Rápido); resta apenas a limpeza das cópias obsoletas D1.
- **D3** — `previewGeometry.js` duplicado entre gcode e heidenhain (arcPath/VIEW/COLORS).
- **D4** — Funcionalidade "chanfro" nos dois pipelines: **RESOLVIDA (Fase 2)** — G-Code legado e página G-Code Rápido usam o mesmo pipeline canônico (`solveChamfer` → IR → postprocessor). Página Heidenhain consome via adapters (`base/math/toCanonicalInput` + `buildChamferProgram`); templates legados `chamferExternalTemplate.js`/`chamferInternalTemplate.js` mantidos como fontes validadas (o IR canônico reproduz byte-a-byte ambos).
- **D5** — Roscas: `ciclo` como convenção dupla (207 | null) resolvida por `isRigida` — fragilidade de dados, baixo risco. **RESOLVIDA**: banco canônico com `method` explícito por registro; **regra da fábrica**: nominal ≤ 24 → `rigid` (207), nominal > 24 → `helical` (CC/CP).

## 8. Componentes reutilizáveis (Tarefa 1 — possibilidade de reutilização)

- `Card`, `ResultBox`, `CopyButton`, `Header`, `NavTabs` — UI genérica pronta.
- `core/geometry/*` — núcleo vetorial puro, sem React: reutilizável por qualquer feature futura (analisador, simulador, validação).
- `core/program` + `core/postprocessors` — base única para todos os novos geradores.
- `core/params/parameterEngine` — motor de Q-parameters genérico.
- `core/postprocessors/programName` + `core/export/downloadProgram` — utilitários.
- `shared/utils/formatters` — formatação numérica.
- Registry pattern (gcode/registry) — molde para registrar operações novas.

## 9. Telas atuais (Tarefa 8)

| Tela | Finalidade | Controles | Navegação |
|---|---|---|---|
| Roscas | Busca por família/designação + programa .H (pipeline canônico) | busca (família/designação), detalhe, formulário (prof. rosca, rpm, furo cego, fresa p/ helicoidal), preview SVG, copiar/download .H | tab “Roscas” |
| Trigon. | Cálculo de triângulo retângulo | 5 campos numéricos, CALCULAR/LIMPAR/GIRAR | tab “Trigon.” |
| G-Code Rápido ★ | Programa Heidenhain de chanfro (ext./int.) em poucos campos | tipo, largura/ângulo/profundidade/passeZ, ferramenta (tipo/D/r), RPM/avanço, origem exibida, validação ✓/❌ por campo + painel, preview SVG canônico, resultados, Q-params, exportar/copiar .H | tab “G-Code Rapido” |
| G-Code | Chanfro/arredondamento rápido (legado) | seletor de operação, formulário, preview com destaque por foco | **desmontada** (arquivo `features/gcode/GCodePage.jsx` existe, sem rota — classe E) |
| Heidenhain | Programa .H completo | seletor de operação (ext./int.), painel de parâmetros + tipo de ferramenta, toggles de visualização, copy/export | **desmontada** (arquivo `features/heidenhain/pages/HeidenhainPage.jsx` existe, sem rota — classe E) |

Proposta futura de navegação (INÍCIO, G-Code Rápido, Cálculos, Roscas, Usinagem,
Heidenhain, Manual, Analisador de desenho, Simulador) — não implementar agora.

## 10. Testes de regressão (Tarefa 10) — plano e casos registrados

Vitest instalado (devDependency, `npm test`). **188 testes passando** em
`tests/` (números vigentes; ver README.md): `chamfer` (31), `validation` (7), `toolTypes` (4), `triangle` (3),
`registryMigration` (6), `productionReference` (13), `previewContract` (4),
`thread` (40), `processRules` (34), `radius` (46).

### 10.1 Casos críticos com valores esperados

| # | Caso | Entrada | Esperado | Status |
|---|---|---|---|---|
| T1 | Chanfro externo (motor) | A=45, C=5, D=16, r=0.8, L=100, toroidal | profZ=3.535534, largX=3.535534, cotA=1.000000, Reff=0.8, xCentro=−2.404163, toolCornerR=0.8 | ✅ |
| T2 | Estratégia de passes | T1 + passeZ=0.3 | nPasses=12, incReal=0.294628, último z=3.535534 | ✅ |
| T3 | Ball nose externo | A=45, C=5, D=16, r=0.8, ballNose | Reff=8, xCentro=7.778175 | ✅ |
| T4 | End mill externo | idem, endMill | Reff=0, xCentro=−3.535534 | ✅ |
| T5 | Chanfro interno | A=45, C=5, D=16, r=0.8, aloj=50 | xCentro=0.565685, cotA=1, trajEndX=−2.969848 | ✅ |
| T6 | Folga interna | D=60, aloj=50 | erro estruturado INVALID_CLEARANCE c/ mensagem PT (e `throw` no adapter legado) | ✅ |
| T7 | Triângulo | a=3, b=4 | c=5, A=53.130102354, B=36.869897646 | ✅ |
| T8 | Triângulo | a=3, c=5 | b=4, A=53.130102354, B=36.869897646 | ✅ |
| T9 | Rosca rígida | M8, prof=20, rpm=300 | `av=300` (rpm×passo 1.0 → 300) no texto CYCL DEF 207 via `solveThread` | ✅ |
| T10 | Postprocessor | FN0 Q1=45 | linha `FN 0: Q1  = +45,0 ;…` com vírgula decimal | ✅ (coberto nos testes de paridade) |
| T11 | Postprocessor | SPINDLE_STOP | `L Z+100 R0 FMAX M30` como último bloco numérico | ✅ (paridade) |
| T12 | Loop externo (invariante) | qualquer | p/ todo passe i: `x_contato(i) = xCentro + i·incReal·cotA` (batendo na reta do chanfro) | ✅ |
| T13 | Loop interno (invariante) | qualquer | `x_contato(i) = xCentro − i·incReal·cotA` | ✅ |
| T14 | Inválidos estruturados | A=0, A=90, A=−5, C=0, passeZ=0/−1/NaN, D=0, r<0, r>D/2, tipo desconhecido, bolsão estreito, L=0 | `valid=false` + código INVALID_* com campo e mensagem; **nunca** Infinity/NaN/loop | ✅ |

### 10.2 Casos problemáticos já conhecidos (registrados)

1. **A=0° no chanfro externo** → antes `xCentro = Infinity`; agora erro estruturado `INVALID_ANGLE` na porta de entrada (nada é calculado).
2. **passeZ=0 no strategyEngine** → antes loop infinito/OOM; agora erro `INVALID_PASS_DEPTH` (guarda na estratégia e na validação).
3. **r > D/2** → antes aceito silenciosamente; agora erro `INVALID_TOOL_RADIUS`.
4. **Sinal de Q21 no chanfro interno** — fórmula `Q10 − Q20·Q22` verificada por teste de invariante e paridade de template (não regredir para `+`).
5. **Preview cortado/desproporcional** — corrigido com clamp; manter regressão visual dos previews.
6. **Separador decimal** — .H usa vírgula (padrão iTNC); conversão só no postprocessor. Não misturar com a matemática (ponto).
7. **Triângulo com A=0 ou B=0** → retorna `null` silenciosamente — documentar/decidir comportamento (Fase 3).
8. **C=0 no chanfro** → profZ=0, 1 passe de profundidade 0 (programa inócuo, não perigoso) — agora bloqueado por `INVALID_WIDTH`.

Prioridade de cobertura (Tarefa 10): chanfro (T1–T6, T12–T13) → arco/arredondamento
(rTraj/Q13) → trigonometria (T7–T8) → roscas (T9) → ferramentas (T3–T4) → geração
G-Code (T10–T11).

## 11. Recomendação de próximo módulo

Ver `ARCHITECTURE.md` §7 e `ROADMAP.md`. **Fase 2, item 1 (G-Code Rápido — Chanfro)
CONCLUÍDA**: página nova sobre o pipeline canônico, G-Code legado migrado (D4),
ValidationEngine operacional e 51 testes. **Roscas reconstruída sobre pipeline
canônico (F31/F32)**: banco `core/machining/thread` + página com
selector/detalhe/formulário/preview, 40 testes; templates legados removidos.
**Raio externo/interno canônico (F34/F35) CONCLUÍDA (Prompt 014 + interno)**: pipeline
`core/machining/radius` reproduzindo a planilha, registry `raio_aresta_reta_torica`
com seletor de tipo, preview SVG dedicado e seletor Externo/Interno (bolsão)
na página G-Code Rápido (aba "Raio"); 46 testes.
Próximos passos da Fase 2: arco, furação, padrão de furos; e as fases 3+.

## 12. Convenção de coordenadas (Fase 2)

Documentada em `docs/COORDINATE_SYSTEM.md` (criado na Fase 2): plano XZ com
Z positivo para cima, origem no vértice da região (externo) ou no canto do
bolsão (interno), sinais de X por tipo de chanfro, normal invertida em
superfícies côncavas (convexity='concave'), cot(A) > 0 definindo o sentido do
laço de passes (externo: X cresce com profundidade; interno: X decresce).