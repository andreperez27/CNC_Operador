# ROADMAP — CNC Operador

> Guia Digital do Operador CNC · foco inicial: HEIDENHAIN iTNC 530.
> Estado: **Fase 2 — Chanfro (item 1), Raio externo/interno (item 2) e Rosca
> (item 6) concluidos**. Proximas: itens 3–5 (Arco, Furacao, Padrao de furos).
> Regra: cada fase so avanca apos revisao. O projeto permanece separado do simulador.

---

## FASE 1 — Arquitetura e inventario (concluida)

- `ARCHITECTURE.md` — arquitetura atual, problemas identificados, proposta de arquitetura futura.
- `docs/CURRENT_FUNCTIONAL_INVENTORY.md` — inventario completo (funcionalidades, matematica, ferramentas, G-Code, validacoes, duplicacoes, plano de testes).
- Plataforma validada: PWA offline, mobile-first, lazy loading, target ES2018.

## FASE 2 — G-Code Rapido

Pipeline canonico unico (solver -> validacao -> estrategia -> trajetoria -> IR -> postprocessor).
Migrar os geradores legados de string para o pipeline IR, reutilizando o core matematico.

### Primeiras operacoes

1. **Chanfro — CONCLUIDO (D4)**:
   - `core/machining/chamfer/*` (solver, validation, geometry, strategy, trajectory, template) — fonte unica;
   - `core/validation/validationEngine.js` (ValidationEngine estruturado, INVALID_*/WARN_*);
   - `core/tools/toolTypes.js` (catalogo canonico);
   - `core/machining/{contactGeometry,coordinates}.js`;
   - Pagina **G-Code Rapido** (`features/gcoderapido`): form completo, validacao ✓/❌, preview canonico (mesma trajetoria do gerador), Q-params, exportar/copiar .H;
   - G-Code legado migrado (`registry/canonicalChamfer.js`; `chamferSolver.js`/`chamferTemplate.js` removidos);
   - Adapters Heidenhain delegando ao core (APIs legadas preservadas, templates byte-a-byte iguais);
   - **51 testes vitest** (T1–T14 + invalidos estruturados + paridade templates + migracao do registry);
   - Docs: `docs/COORDINATE_SYSTEM.md` criado; arquitetura/inventario/roadmap atualizados.
2. **Raio — CONCLUIDO (externo + interno/bolsao)**: pipeline canonico
   `core/machining/radius` reproduzindo a planilha (`rho = R + r`,
   `Q21 = Q4 ± SQRT(...)`); seletor Externo/Interno na pagina G-Code Rapido
   e no registry `raio_aresta_reta_torica`; `tests/radius.test.js`
3. Arco
4. Furacao
5. Padrao de furos
6. **Rosca — CONCLUIDA**: pipeline canonico `core/machining/thread`
   (banco de 45 roscas, rigida CYCL DEF 207 / helicoidal CC/CP, furo cego)
   + pagina Roscas reconstruida; `tests/thread.test.js` + `tests/processRules.test.js`

Criterios de saida: 6 operacoes no registry, todas via IR + postprocessor,
preview por operacao, testes de regressao T1–T14 do inventario passando.

## FASE 3 — Calculadora CNC

- trigonometria (evolucao do solver de triangulo: angulos maiores que 90, catetos orientados);
- coordenadas (ponto medio, distancias, deslocamentos, polares <-> retangulares);
- arco e tangencia (reusar `core/geometry/circleLine`);
- RPM, avanco, velocidade de corte (Vc = pi * D * rpm / 1000, avanco por dente).

## FASE 4 — Cabecote Huron

- angulos de inclinacao e calculos de deslocamento;
- tabelas de angulos por posicao;
- integracao com a calculadora de coordenadas.

## FASE 5 — Heidenhain iTNC 530

- ciclos (CYCL DEF usados na fabrica);
- consulta rapida de G/M codes;
- Q parameters (catalogo + exemplos);
- consultas e exemplos de programas reais.

## FASE 6 — Validacao CNC

- ~~`ValidationEngine` central~~ — **adiantada na Fase 2** (cobre chanfro):
  valores, NaN/Infinity, divisao por zero, geometria impossivel, folga de
  ferramenta; **pendente**: estender aos demais solvers (arredondamento,
  roscas, trigonometria) e coordenadas fora de curso.
- mensagens em portugues, exibicao na UI (painel de validacao na pagina G-Code Rapido).

## FASE 7 — Analisador de desenho tecnico

Entrada:
- PDF, PNG, JPG (offline-first; processamento local ou servico online isolado)

Extracao:
- dimensoes, furos, raios, chanfros, angulos, roscas, tolerancias

Saida: modelo geometrico unico -> operacoes (Fase 8).

## FASE 8 — Estrategia de usinagem

```
DESENHO
  -> CARACTERISTICAS
  -> OPERACOES
  -> FERRAMENTAS
  -> PARAMETROS
  -> TRAJETORIA
  -> G-CODE
```

## FASE 9 — Assistente CNC

Perguntas em linguagem natural (base de conhecimento offline + IA online isolada):

- "Como faco um R8?"
- "Qual broca para M10?"
- "Como calculo essa coordenada?"
- "Qual angulo devo colocar no cabecote?"

## FASE 10 — Integracao futura com o simulador

- Somente por interface definida (core matematico compartilhado);
- manter os dois projetos independentes;
- sem acoplamento de UI.