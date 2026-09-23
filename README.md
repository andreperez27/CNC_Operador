# CNC Operador

PWA de ferramentas e calculadoras de apoio ao operador CNC — 100% client-side
e offline-first (service worker + manifest). Gera programas Heidenhain iTNC 530
(`.H`) com preview SVG, a partir de um núcleo matemático canônico testado.

> Não é um simulador CNC completo. Suporte implementado apenas para
> Heidenhain iTNC 530; nenhum outro controlador é atendido.

## Estado atual (verificado)

Abas montadas no `App.jsx` — somente estas estão ativas:

| Aba | O que faz |
|---|---|
| Roscas | Busca em banco de 45 roscas (métricas M1–M64 + finas) + programa `.H` (rosca rígida CYCL DEF 207 ou helicoidal CC/CP), com regra de furo cego |
| Trigonometria | Solver de triângulo retângulo (10 combinações de entradas) + SVG |
| G-Code Rápido | Chanfro externo/interno (bolsão) e raio externo/interno (bolsão) em aresta reta: formulário com validação por campo, preview SVG da trajetória real, parâmetros Q e exportação/cópia do `.H` |

Páginas existentes porém **desmontadas** (legado, sem rota): `features/gcode/GCodePage.jsx`,
`features/heidenhain/pages/HeidenhainPage.jsx`.

## Arquitetura (resumo)

```text
src/
├── app/          SPA + navegação por abas (sem router)
├── components/   UI genérica (Card, ResultBox, CopyButton, Header, NavTabs)
├── shared/       formatadores + hook de clipboard
├── styles/       variáveis, global, fontes auto-hospedadas
├── core/         núcleo puro (sem React): geometry, machining/
│                 (chamfer, radius, thread), validation (ValidationEngine),
│                 program (IR), postprocessors (heidenhain), params (Q),
│                 tools, process (regras), validators, export
├── features/     roscas, trigonometria, gcoderapido (ativas) + gcode,
│                 heidenhain (motores/previews reutilizados; páginas legadas)
└── tests/        suíte vitest (ver abaixo)
```

Pipeline canônico de cada operação: validação estruturada → geometria →
estratégia de passes → trajetória (fonte única p/ preview e programa) → IR →
postprocessor → texto `.H`. Cálculos e regras de engenharia permanecem no
código; futuras tabelas de consulta poderão viver em dados versionados.

## Desenvolvimento

```text
npm install   instala dependências
npm run dev   servidor de desenvolvimento (Vite)
npm test      suíte de testes (vitest run)
npm run build build de produção (Vite + PWA)
npm run lint  lint (oxlint)
npm run preview pré-visualiza o build local
```

## Testes

**188/188 passando** (`npm test` — 10 arquivos): matemática das operações,
trajetórias, invariantes de laço, inválidos estruturados (`INVALID_*`),
paridade byte-a-byte com programa real de produção e migração do registry.
Sem testes de UI e sem configuração de cobertura.

## Build e PWA

`npm run build` OK: PWA `generateSW` (Workbox, `autoUpdate`), precache de 31
entradas, `navigateFallback` para `/index.html`, manifest "CNC Operador",
fontes e ícones locais (funciona sem internet).

## Estrutura do repositório

```text
cnc-operator/
├── index.html · vite.config.js · package.json · package-lock.json
├── .gitignore · .gitattributes · .oxlintrc.json · LICENSE · README.md
├── ARCHITECTURE.md · ROADMAP.md
├── public/      ícones + fontes (offline)
├── scripts/     generate-icons.mjs, generate-test-program.mjs
├── src/         app, components, shared, styles, core, features
├── tests/       suíte vitest + fixtures/
└── docs/        inventário, referências de produção, auditorias, coordenadas
```

## Referências técnicas

- `tests/fixtures/CHANFRO_EXT_RETO.H` — cópia byte-idêntica do programa real
  de produção `CHANFRO EXT RETO.H` (A=30, C=50, D=52, r=6), usada pelo teste
  de paridade `tests/productionReference.test.js`. O teste **falha** se o
  fixture não existir (sem aprovação silenciosa). `.gitattributes` congela
  os bytes dos fixtures (sem conversão de fim de linha).
- Referências externas (planilha de setor `calculo_chanfro_parametrizado.xlsx`,
  `rosca.xlsx`, `G-code de chanfro.docx`, `.H` originais) vivem **fora** deste
  repositório, na pasta irmã `App_CNC/` — ver `docs/*_REFERENCE.md`.

## Licença

MIT — ver `LICENSE`.
