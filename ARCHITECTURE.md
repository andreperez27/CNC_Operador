# ARCHITECTURE.md — CNC Operador

> Guia Digital do Operador CNC — foco inicial: **HEIDENHAIN iTNC 530**.
> Projeto separado do simulador CNC. Funciona 100% offline (PWA).

---

## 1. Visão geral atual

O aplicativo é um SPA React (Vite + PWA) composto por **3 abas montadas**
(`src/app/App.jsx` — somente estas estão ativas; páginas existentes porém
desmontadas, p. ex. `features/gcode/GCodePage.jsx` e
`features/heidenhain/pages/HeidenhainPage.jsx`, são legado classe E):

| Aba | Feature | Função |
|---|---|---|
| Roscas | `features/roscas` | Tabela métrica M1–M64 (passo/furo/ciclo) + geração de G-Code (rosca rígida CYCL DEF 207 e interpolação helicoidal) + furo cego |
| Trigon. | `features/trigonometria` | Solver de triângulo retângulo com preview SVG |
| G-Code Rapido | `features/gcoderapido` | Chanfro externo/interno e raio externo/interno (bolsão) com pipeline canônico (solver → validação → estratégia → IR → postprocessor), validação ✓/❌, preview e exportação .H |

Infraestrutura transversal:

- `core/geometry` — vetores/linhas/círculos/ângulos 2D (plano XZ), puro, sem React.
- `core/machining` — **pipeline canônico de usinagem**: `chamfer/` (solver,
  validação, geometria, estratégia, trajetória, template IR), `contactGeometry`,
  `coordinates` (convenção — ver `docs/COORDINATE_SYSTEM.md`).
- `core/validation` — **ValidationEngine** estruturado (`createValidation`,
  `addError/addWarning`, códigos `INVALID_*`/`WARN_*`).
- `core/tools` — catálogo canônico de ferramentas (`toolTypes`).
- `core/params/parameterEngine` — resolução de Q-parameters com fórmulas e detecção de dependência circular.
- `core/program` — **IR (Intermediate Representation)** de blocos de programa, independente de dialeto.
- `core/postprocessors/heidenhain` — traduz IR → texto Heidenhain (formato real de produção, referência `CHANFRO_EXT_RETO.H`).
- `core/validators`, `core/export` — validação de folga de ferramenta; download de arquivo.
- `components/*` — UI genérica (Card, ResultBox, CopyButton, Header, NavTabs).
- `shared/*` — formatação numérica e hook de copiar.
- `tests/*` — suite vitest (51 testes; `npm test`).

## 2. Fluxo de dados

### 2.0 Pipeline canônico (Fase 2 — core/machining/chamfer, usado por TUDO novo)

```
SOLVER (solveChamfer)
  validação estruturada na porta de entrada (ValidationEngine, INVALID_*)
  → geometria (chamferGeometry + contactGeometry + coordinates)
  → estratégia (buildPassStrategy — guarda passeZ<=0)
  → trajetória (buildTrajectory — model.passes, fonte única)
  → IR (buildChamferProgram) → postprocessor → texto .H

Consumidores:
  - Página G-Code Rápido (features/gcoderapido) — preview usa model.passes
  - Adapters Heidenhain (features/heidenhain/math→core) — página Heidenhain
  - G-Code legado migrado (features/gcode/registry/canonicalChamfer.js)
```

### 2.1 Fluxo canônico novo (Heidenhain) — recomendado para tudo novo

```
Interface (HeidenhainPage.jsx)
   ↓ params (A, C, D, r, L, passeZ, rpm, av, toolType...)
Math Engine (features/heidenhain/math/*.js)     → solveExternalChamfer/solveInternalChamfer
   ↓ modelo geométrico (profZ, largX, cotA, Reff, xCentro, contato, trajetória)
Strategy Engine (features/heidenhain/strategy/strategyEngine.js) → nPasses, incReal, passes
   ↓ fullModel
Parameter Engine (features/heidenhain/params/parameterEngine.js + core/params) → qParams (mapa Q)
   ↓
Program Engine (features/heidenhain/program/programEngine.js) → template por operação
   ↓ blocos IR (core/program/types.js)
Postprocessor (core/postprocessors/heidenhain.js) → texto .H numerado
   ↓
UI: ParamPanel + QParamsDisplay + Preview SVG + ProgramDisplay (copy/exportar .H)
```

Cadeia conceitual já implementada neste fluxo:

```
GEOMETRIA  →  ESTRATÉGIA  →  TRAJETÓRIA  →  PROGRAMA
(solver)   (passes)       (no template,  (template IR +
                           repetição      postprocessor)
                           LBL/FN 12)
```

### 2.2 Fluxo legado (G-Code) — chanfro MIGRADO, arredondamento pendente

```
GeneratorForm → chamferSolver/chamferTemplate  ❌ REMOVIDOS (Fase 2)
GeneratorForm → canonicalChamfer.js (solveChamferLegacy → buildChamferProgram)
             → roundingSolver/roundingTemplate (string, sem IR) — pendente
             → GcodeOutput (texto bruto, sem IR/postprocessor)
```

Aqui **geometria, estratégia, trajetória e formatação Heidenhain estão misturadas**
em template string com `Q1=...`, `LBL`, `IF ... GOTO` escritos manualmente.
Não é refatoração massiva nesta etapa — apenas documentação (ver §7).

### 2.3 Roscas

Seleção da rosca → formulário (prof, rpm, diamFresa) → template string direto
(`roscaRigida.js` / `interpolacaoHelicoidal.js`). Sem solver intermediário;
as fórmulas (avanço = rpm × passo) estão dentro dos templates.

### 2.4 Trigonometria

Formulário → `solveTriangle` (solver puro) → exibição em grid + SVG de
referência manual (4 configurações estáticas de desenho).

## 3. Design do núcleo de programa (IR + Postprocessor)

`src/core/program/types.js` define blocos genéricos (`$N` referencia Q):

`SECTION, COMMENT, DEFINE, FN0, BLK_FORM, TOOL_CALL, ASSIGN, LABEL, JUMP, RAPID, LINEAR, SPINDLE, SPINDLE_STOP`

- O template **nunca escreve sintaxe Heidenhain** — monta objetos IR.
- O postprocessor (`core/postprocessors/heidenhain.js`) faz toda a conversão:
  `$N`→`QN`, vírgula decimal, numeração de blocos (largura 2), `BEGIN/END PGM`,
  comentários `;`, sufixo `M90`, `FN 0:` literais, `BLK FORM 0.1/0.2`.
- Para suportar outro controle (fanuc) basta um novo postprocessor — **design isolado e reutilizável** (A).

## 4. Parameter Engine (core/params)

- Mapas Q → chave do modelo (`EXTERNAL_CHAMFER_MAP`, `DEFAULT_MAP`).
- Valores diretos ou `formula(ctx, geo)` com **extração de dependências por
  varredura do código-fonte** da função (`ctx.Q\d+`), ordenação topológica e
  detecção de dependência circular.
- Regra de produção dos chanfros: a geometria é calculada **no motor JS**;
  no controle o loop usa apenas soma/multiplicação (Q20=Q30*Q4, Q21=Q10±Q20*Q22),
  sem TAN/SIN/COS na máquina.

## 5. Registry pattern

- `heidenhain/registry/operations.js` — é o padrão documentado para registrar
  operações (solver + mapa + template + preview), embora hoje a a lista real
  de operações viva dentro de `HeidenhainPage.jsx` (só 2 operações, via switch).
- `heidenhain/program/programEngine.js` — registrador de templates por `operationId`.
- `gcode/registry/registry.js` — registrador de geradores com
  `params/validate/solve/generate/previewComponent` (padrão completo e funcional).

## 6. Problemas arquiteturais identificados (só documentação)

1. **Duas pipelines de geração G-Code** (Heidenhain IR vs. strings legadas do
   G-Code rápido/roscas) que produzem a mesma categoria de resultado.
   → **Chanfro MIGRADO para IR (Fase 2, D4)**; falta arredondamento e roscas.
2. **Duas convenções de origem Z nos chanfros**:
   - externo: origem na superfície (Z positivo para baixo, no preview `SVG_Y = +z`);
   - interno: origem no canto do bolsão (Z positivo para cima, preview `SVG_Y = −z`).
   → Convenção unificada documentada em `docs/COORDINATE_SYSTEM.md` (canônico).
3. **Tooltype do chanfro externo**: `xCentro = −largX + Reff/sen(A)`; para
   `A` pequeno explode (A=1° → xCentro ≈ 41 mm; A=0° → antes **Infinity** sem
   aviso). → Agora `INVALID_ANGLE` estruturado no canônico; adapter legado
   retorna `null` (sem crash).
4. **`buildPassStrategy` sem guarda para `passeZ=0`**: antes loop infinito (OOM
   confirmado). → Guarda `INVALID_PASS_DEPTH` no canônico (strategy + validation).
5. **Parâmetros default em 3 lugares** (defaults da página, `FIELD_SETS` do
   `ParamPanel`, defaults do registry GCode) — fontes de divergência.
6. **Código morto/duplicado** (detalhe no inventário):
   - `gcode/components/preview/*` (ChamferEdgePreview, RoundingEdgePreview,
     helpers, css) — cópias obsoletas.
   - `gcode/preview/Internal*` (preview interno órfão) — imports do registry
     removidos na Fase 2; arquivos aguardam remoção.
   - Helpers `*PreviewHelpers` e `arcPath`/`VIEW/COLORS` duplicados entre
     `gcode/preview` e `heidenhain/preview`.
7. **Cálculos duplicados entre features** — **eliminados para o chanfro (D4)**;
   pendente no arredondamento (profZ/largX/cotA continuam em 1 arquivo legado).
8. **Validação não centralizada** — **resolvido (Fase 2)**: ValidationEngine
   canônico (`core/validation`) com códigos estruturados cobre chanfro; falta
   estender aos demais módulos (arredondamento, roscas, trigonometria).
9. **Sem testes automatizados** — **resolvido (Fase 2)**: vitest + 51 testes
   (T1–T14 incl. paridade byte-a-byte com templates legados).

## 7. Proposta de arquitetura futura (não implementar agora)

> **ATUALIZADO (Fase 2):** GEOMETRY/MATH CORE (`core/machining/chamfer`),
> VALIDATION ENGINE (`core/validation`), STRATEGY, TRAJECTORY e IR→postprocessor
> **já existem** para o chanfro — o diagrama abaixo é o objetivo final para
> todos os módulos de usinagem (arredondamento, bolsão, furação, rosca).

```
                          ┌─────────────────────────────┐
User Interface            │  Home / Calculadoras /      │
 (features/*)             │  G-Code Rápido / Manual /   │
                          │  Analisador / Heidenhain …  │
                          └──────────────┬──────────────┘
                                         ↓
                          Feature (orquestra UI + chamadas)
                                         ↓
                          Solver (função pura por operação)
                                         ↓
                          GEOMETRY / MATH CORE (único)
                          core/math: point, line, arc, circle,
                          tangency, chamfer, radius, trig, usinagem
                                         ↓
                          VALIDATION ENGINE (central)
                          valores, NaN/Inf, divisão por 0,
                          folga, geometria impossível, arco
                                         ↓
                          STRATEGY ENGINE (passes, loops)
                                         ↓
                          TRAJECTORY (pontos/segmentos)
                                         ↓
                          G-CODE (IR → postprocessor por dialeto)
```

Princípios:

- **Matemática 100% pura** (sem React, sem DOM, sem `document`): qualquer
  consumidor (calculadora, G-Code rápido, analisador de desenho futuro,
  simulador futuro, validação) chama a mesma função.
  `calculateChamfer()` único, não um por tela.
- **Modelo geométrico único futuro**: `Point, Line, Arc, Circle, Polyline,
  Contour, Feature, Tool, Operation, Toolpath`. Hoje não existe equivalente
  unificado — as representações vivem espalhadas (ver inventário §3). Não criar
  modelo novo agora; criar quando a primeira feature nova (Fase 2) exigir.
- **Pipeline único**: toda geração de programa usa IR + postprocessor.
  Templates nunca emitem dialeto diretamente.
- **Validação obrigatória na porta de entrada** dos solvers (mensagem em
  português, sem throw silencioso) e opcional em camadas de UI.
- **Catálogo de ferramentas** (`core/tools`) central: end mill, toroidal,
  ball nose, chamfer mill (hoje só `heidenhain/math/toolTypes.js`, ver inventário §5).
- Integração futura com o simulador **apenas por interface definida** (Fase 10).

## 8. Estado de saúde

| Verificação | Estado |
|---|---|
| `vite build` | OK — precache 31 entradas (~502 KiB), PWA `generateSW` |
| `npm run lint` (oxlint) | 0 erros; 17 warnings pré-existentes (unused vars no legado, sem impacto) — 129 arquivos |
| `npm test` (vitest) | **188/188 testes passando** (chanfro, raio ext/int, roscas, regras de furo cego, paridade byte-a-byte, registry, trigonometria, validação) |
| PWA/offline | Fontes locais, service worker + navigateFallback, instalação (ícones PNG) |
| `build.target` | ES2018 (navegadores/sistemas antigos) |