# CNC Operador

PWA de ferramentas e calculadoras de apoio ao operador CNC — offline-first
(service worker + manifest), COM portão de acesso: login e convite Beta
exigem conexão na primeira validação (Supabase); depois, tolerância
offline de 7 dias via concessão local (o banco decide quando online).
Gera programas Heidenhain iTNC 530 (`.H`) com preview SVG, a partir de um
núcleo matemático canônico testado.

> Não é um simulador CNC completo. Suporte implementado apenas para
> Heidenhain iTNC 530; nenhum outro controlador é atendido.

## Estado atual (verificado)

Abas montadas no `App.jsx` — somente estas estão ativas:

| Aba | O que faz |
|---|---|
| Início | Cards de navegação dos módulos |
| Roscas | Busca em banco de 45 roscas (métricas M1–M64 + finas) + programa `.H` (rosca rígida CYCL DEF 207 ou helicoidal CC/CP), com regra de furo cego |
| Trigonometria | Solver de triângulo retângulo (10 combinações de entradas) + SVG |
| G-Code Rápido | Chanfro externo/interno (bolsão) e raio externo/interno (bolsão) em aresta reta: formulário com validação por campo, preview SVG da trajetória real, parâmetros Q e exportação/cópia do `.H` |
| Cabeçote Huron | Calculadora de ângulos do cabeçote HURON 45 (flanges de 45° a partir de A/B/C) com gate de alcançabilidade e calibração do anel |
| Convites | Admin-only: geração de links Beta via Edge Function |

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
│                 (chamfer, radius, thread, huron), validation
│                 (ValidationEngine), program (IR), postprocessors
│                 (heidenhain), params (Q), tools, process (regras),
│                 validators, export
├── features/     home, roscas, trigonometria, gcoderapido, huron (ativas)
│                 + auth (portão de acesso), admin (convites, admin-only)
│                 + gcode, heidenhain (motores/previews reutilizados;
│                 páginas legadas)
├── supabase/     Edge Functions (convidar/resgatar) + migrations
│                 (app_users, beta_convites) — deploy e SQL manuais
└── tests/        suíte vitest (ver abaixo)
```

Pipeline canônico de cada operação: validação estruturada → geometria →
estratégia de passes → trajetória (fonte única p/ preview e programa) → IR →
postprocessor → texto `.H`. Cálculos e regras de engenharia permanecem no
código; futuras tabelas de consulta poderão viver em dados versionados.

## Desenvolvimento

Node >= 22 é obrigatório (`engines` no `package.json` + `.nvmrc`).
Para o fluxo de acesso, copie `.env.example` para `.env.local` e preencha
`VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` (sem segredos no repo;
sem backend configurado o app nega acesso).

```text
npm install   instala dependências
npm run dev   servidor de desenvolvimento (Vite)
npm test      suíte de testes (vitest run)
npm run build build de produção (Vite + PWA)
npm run lint  lint (oxlint)
npm run preview pré-visualiza o build local
```

## Testes

**264/264 passando** (`npm test` — 14 arquivos): matemática das operações
(chanfro, raio ext/int, roscas, cabeçote Huron, furo cego), trajetórias,
invariantes de laço, inválidos estruturados (`INVALID_*`), decisão de
resgate Beta, paridade byte-a-byte com programa real de produção e
migração do registry. Sem testes de UI e sem configuração de cobertura.

## Build e PWA

`npm run build` OK: PWA `generateSW` (Workbox, `autoUpdate`), precache de 39
entradas (~1352 KiB), `navigateFallback` para `/index.html`, manifest "CNC Operador",
fontes e ícones locais (funciona sem internet após o primeiro acesso validado).

## Estrutura do repositório

```text
cnc-operator/
├── index.html · vite.config.js · package.json · package-lock.json · .nvmrc
├── .gitignore · .gitattributes · .oxlintrc.json · LICENSE · README.md
├── ARCHITECTURE.md · ROADMAP.md
├── public/      ícones + fontes (offline)
├── scripts/     generate-icons.mjs, generate-test-program.mjs
├── supabase/    functions (convidar, resgatar) + migrations
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
