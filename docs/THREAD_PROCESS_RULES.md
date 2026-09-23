# REGRAS DE PROCESSO — PROFUNDIDADE DE FURO CEGO

> Documenta a separação entre **norma** e **regra de processo** e as regras de
> profundidade de furo cego implementadas no módulo de Roscas.

## 1. NORMA ≠ REGRA DE PROCESSO

| | NORMA | REGRA DE PROCESSO |
|---|---|---|
| Define | características **normalizadas** da rosca | critério de **fabricação** usado por empresa/processo |
| Exemplo | Ø nominal, passo, Ø broca (ISO 724) | profundidade do furo cego = 2,5 × Ø da rosca |
| Onde | `core/machining/thread/database` (`THREAD_DATABASE.md`) | `core/process/rules` (este doc) |
| Origem | documentação técnica publicada | empresa, operador, processo |

⚠️ **Não tratar regra de empresa como norma.** O exemplo "GM = 5 × Ø da rosca"
informado pelo usuário fica cadastrado como **regra de processo informada pelo
usuário** — só se torna fato normativo com documentação oficial que comprove a
origem (registrar a fonte nesse caso).

## 2. Profundidade da rosca × profundidade do furo

- **Profundidade útil da rosca**: trecho efetivamente rosqueado.
- **Profundidade total do furo**: fundo do furo cego.

São **parâmetros independentes**. O sistema NUNCA altera automaticamente a
profundidade da rosca para "bater" com a regra do furo.

A diferença entre as duas é espaço para ponta da broca, entrada/saída da
ferramenta, cavacos e geometria incompleta. **Não existe margem universal** —
a margem inferior é informada pelo operador (`holeMargin`, padrão 5 mm).

## 3. Regras disponíveis (todas via fórmula genérica `profundidade = fator × referência`)

| id | Nome | Referência | Fator | Fórmula |
|---|---|---|---|---|
| `process:2.5x-thread-diameter` | 2,5 × Ø da rosca | `threadDiameter` | 2,5 | `prof = 2,5 × Ø rosca` |
| `process:4x-drill-diameter` | 4 × Ø da broca | `drillDiameter` | 4 | `prof = 4 × Ø broca` |
| `process:5x-thread-diameter` | 5 × Ø da rosca | `threadDiameter` | 5 | `prof = 5 × Ø rosca` |
| `process:custom` | Personalizada | escolhida | livre | `prof = fator × referência` |

Todas são `type = 'process-rule'`, `origem = 'informada pelo usuario'`,
`normative = false`.

### Exemplo obrigatório — M10 × 1,5 (Ø rosca 10 mm · Ø broca 8,5 mm)

| Regra | Cálculo | Resultado |
|---|---|---|
| 2,5 × Ø da rosca | 2,5 × 10 | **25 mm** |
| 4 × Ø da broca | 4 × 8,5 | **34 mm** |
| 5 × Ø da rosca | 5 × 10 | **50 mm** |

⚠️ São **critérios de processo diferentes** — não são três resultados
equivalentes. A tela mostra qual regra foi usada, qual diâmetro (referência) foi
usado e qual foi o resultado.

## 4. Arquitetura

```
threadDatabase            core/machining/thread/database.js   (Ø, passo, furo)
   └── threadData                                               (dados da rosca)

processRules              core/process/rules/                  (regras de fabricação)
   └── blindHoleDepthRules blindHoleDepth.js
```

Fluxo do programa (a regra alimenta o modelo validado, nunca o template):

```
Thread → Regra de processo → Profundidade calculada → Validação
      → Estratégia → Trajetória → IR → Postprocessor Heidenhain → .H
```

- `calculateBlindHoleDepth({ rule, threadDiameter, drillDiameter })` — **solver
  puro**, retorna `{ depth, rule, reference, factor }` e NUNCA gera G-Code.
  Mantém precisão interna (não arredonda no cálculo; formatação só na UI).
  Nunca retorna NaN/Infinity (validação `isFinite*`).
- `resolveHoleFromInput(input, thread)` — aplica a **prioridade** dentro do
  pipeline de rosca:
  1. valor explícito do desenho (`holeDepth` informado);
  2. regra de processo selecionada (sugestão);
  3. mínimo físico = profundidade da rosca + margem;
  4. sugestão padrão (2,5 × Ø da rosca).

## 5. Como cadastrar uma nova regra

1. Adicione o objeto em `BLIND_HOLE_DEFAULT_RULES` em
   `src/core/process/rules/blindHoleDepth.js`:

   ```js
   {
     id: 'process:6x-thread-diameter',
     name: '6 × Ø da rosca',
     reference: BLIND_HOLE_REFERENCES.THREAD_DIAMETER,
     factor: 6,
   }
   ```

2. A fórmula é genérica (`factor × reference`) — **não** criar `if (selected ===
   "M10") depth = …`.

Futuro: perfis de processo/empresa ("PADRÃO GERAL", "CLIENTE A", "EMPREGA A",
"GM"…) usarão a mesma estrutura (`core/process/rules`) com campo de origem
documentada. Não há integração com clientes externos nesta etapa.

## 6. Validações

- Profundidade da rosca > 0 (`INVALID_DEPTH`).
- Profundidade do furo > 0 (`INVALID_HOLE_DEPTH`).
- Profundidade do furo ≥ profundidade da rosca (furo cego) — mensagem:
  **"Profundidade do furo é menor que a profundidade da rosca."** → não gera
  programa.
- Margem ≥ 0 (`INVALID_HOLE_MARGIN`); regra inexistente (`INVALID_HOLE_RULE`);
  personalizada: fator > 0 (`INVALID_HOLE_CUSTOM_FACTOR`) e referência válida
  (`INVALID_HOLE_CUSTOM_REFERENCE`).

## 7. Interface (tela Roscas, furo cego)

```
Ø nominal 10,00 mm · Passo 1,50 mm · Ø broca 8,50 mm
Prof. da rosca            [20,00]
Regra do furo             [5 × Ø da rosca ▼]
Prof. sugerida            50,00 mm — nota: "Profundidade sugerida pela regra de processo."
Margem inferior do furo   [5,00]
Prof. final do furo       [50,00]
```

A tela é compacta, com cards/campos empilhados no celular (preserva PC,
notebook, tablet, celular, ES2018, PWA/offline, touch ≥ 44px).