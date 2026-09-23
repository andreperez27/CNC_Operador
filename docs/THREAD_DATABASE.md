# BANCO DE DADOS DE ROSCAS — CNC Operador

> DADOS NORMALIZADOS DA ROSCA (a "tabela"). Não confundir com REGRA DE PROCESSO
> (ver `THREAD_PROCESS_RULES.md`).

## 1. O que vive aqui

O banco de roscas armazena **características normalizadas da rosca**:

| Campo | Exemplo | Significado |
|---|---|---|
| `id` | `metric:M10X1.5` | chave estável da rosca |
| `familyId` | `metric` | família (ver §3) |
| `designation` | `M10 × 1,5` | designação padrão exibida |
| `nominal` | `10` | Ø nominal (mm) |
| `pitch` | `1,5` | passo (mm) |
| `hole` | `8,5` | Ø da broca recomendado (mm) — série padrão da tabela (rosca.xlsx / ISO 261, ≈ Ø nominal − passo) |
| `method` | `rigid` / `helical` | estratégia (rigida → ciclo 207) |
| `standard` | `ISO 724` | norma que define a característica |
| `source` | `rosca.xlsx` | origem dos dados validados |
| `recommendations` | – | observações de fábrica |

**Estrutura**: `src/core/machining/thread/database.js` — **45 registros**:
32 métricas (M1–M64) + 13 métricas finas (ISO 724 / DIN 13).

**Não pertence aqui**: critérios de *fabricação* (profundidade de furo cego, fator
× diâmetro etc.). Isso é regra de processo → `core/process/rules` (separado).

## 2. Furo como dado da rosca (NÃO regra)

O "Ø de furação recomendado" (`hole`) é dado técnico da rosca (geometria).
Ele define **onde** a rosca será feita.

No banco atual o furo NÃO é calculado por uma fórmula única — cada registro
carrega o valor da **tabela padrão de broca** (≈ Ø nominal − passo; ex. M10 × 1,5
→ Ø 8,5). Onde a planilha `rosca.xlsx` cobre, o valor dela sobrepõe a tabela
legada (ex. M8: 6,75 → 6,8; M12: 10,25 → 10,2). Evite derivar `hole` por fórmula
dentro do código: consulte `database.js`.

A **profundidade total do furo cego** é decisão de processo — a peça sendo furo
cego ou passante muda *quanto fundo furar*, nunca o Ø do furo.

## 3. Famílias

| id | Descrição | Status |
|---|---|---|
| `metric` | Métricas ISO 261, passo coarse padrão (M1–M64) | available |
| `fine` | Métricas finas ISO 724 / DIN 13 | available |
| `unc` | UNC (ASME B1.1) — sem dados confiáveis locais | pending |
| `unf` | UNF (ASME B1.1) — sem dados confiáveis locais | pending |
| `bsp` | BSP (ISO 228-1) — sem dados confiáveis locais | pending |

## 4. Ciclos

- Rosca feita em furo pré-furado usa **CYCL DEF 207** (iTNC 530) quando
  `method = rigid`.
- **Regra da fábrica**: `nominal > 24` → `method = helical` (interpolação
  helicoidal, CC/CP com fresa de roscar); `nominal ≤ 24` → `rigid`. Vale para
  métrica e métrica fina. A planilha indicava CYCL 207 também para M30 — a regra
  M24+ tem precedência (ver §6, decisão 5).

## 5. Como consultar

```js
import { getThread, searchThreads, getAvailableFamilies } from '../core/machining/thread';
getThread('metric:M10X1.5');
searchThreads('M10');            // → todas as opções de passo
getAvailableFamilies();          // → famílias com dados
```

## 6. Auditoria v1 — inventário real e decisões

Verificação executada nesta versão (build ✓, lint 0 erros, **141 testes**):

| Item | Resultado |
|---|---|
| Banco | 45 registros (32 métricas M1–M64 + 13 finas), 5 famílias (metric/fine disponíveis) |
| Busca | variantes `M10`, `M10x1.5`, `M10 X 1,5`, `M10×1,5`, `M10 1.5`, `M10,1.5` → `metric:M10X1.5` **✓** (correção: vírgula como separador) |
| Programa rígido | CYCL DEF 207 com Q200/Q203/Q335/Q239/Q201/Q253/Q358/Q359/Q254 (paridade com template de fábrica) |
| Programa helicoidal | `TOOL CALL n Z S<RPM>` + `CC/CP IPA±360 IZ−passo DR± F<av>` (voltas = ⌈prof/passo⌉) |
| Exibido = exportado | `ProgramDisplay` copia/exporta o `textContent` do mesmo `<pre>` (mesmo nome BEGIN/END PGM via `buildProgramName`) |
| Registros gerados | M10×1,5 rígida (`ROSCARIGIDA_<data>.H`) e M27×3 helicoidal (`ROSCAHELICOIDAL_<data>.H`) verificados |

### Decisões registradas

1. **Ciclo 207 extra fieldset (Q335/Q253/Q358/Q359/Q254)**: o manual iTNC 530 lista
   apenas Q200/Q201/Q239/Q203/Q204 para o ciclo 207. Os parâmetros adicionais **preservam
   o template de produção da fábrica** (fonte primária). Mantidos; caso uma versão do
   controle os rejeite, remover apenas eles (Q200/Q203/Q239/Q201 seguem o manual).
2. **Avanço rígida**: `av = rpm × passo` (informativo no comentário do .H); o controle
   autosincroniza a alimentação — não é avanço inserido pelo operador.
3. **Método por registro do banco** (`thread.method`): a rosca define rígida vs. helicoidal;
   o formulário apenas oferece os campos do método vigente.
4. **Correções de documentação (v1)**: contagem real (45, não 231), famílias reais
   (5, não 17), fórmula do furo (série padrão ≈ Ø nominal − passo; `rosca.xlsx` sobrepõe),
   `thread-report-v1.md` removido (projeto de arquitetura nunca construído e conflitante).
5. **Método por diâmetro (regra da fábrica, v2)**: `nominal > 24` → `helical` para todas as
   famílias (métrica e fina). Precede a planilha (`rosca.xlsx` indicava CYCL 207 para M30 —
   agora `helical`, com furo 26,5 mantido da planilha). Busca e validação inalteradas;
   teste "acima de M24 usa interpolação helicoidal" registra a regra.