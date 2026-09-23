# REFERÊNCIA DE PRODUÇÃO — ARREDONDAMENTO (RAIO EXTERNO EM RETO)

Documento que confronta o bloco **"Raio de canto externo"** da planilha de
setor `calculo_chanfro_parametrizado.xlsx` (fonte primária do operador, iTNC
530) com a geração atual de arredondamento no CNC Operator e com o que o módulo
"Raio" do CNC Operator deve reproduzir. A planilha é a **autoridade de
engenharia** (foi validada em produção) e **NUNCA é modificada**.

## 1. Referências

| Item | Caminho |
|---|---|
| Planilha (autoridade) | `calculo_chanfro_parametrizado.xlsx` — aba `Calculo Chanfro CNC` (raiz do projeto) |
| Bloco auditado | linhas 17–24 — "Raio de canto externo" |
| G-Code atual | `src/features/gcode/solvers/roundingSolver.js` + `templates/roundingTemplate.js` |
| Preview atual | `src/features/gcode/preview/buildRoundingPreviewModel.js` + `RoundingEdgePreview.jsx` |
| Convenção de coordenadas | `docs/COORDINATE_SYSTEM.md` |
| Referência de chanfro (modelo) | `docs/CHAMFER_PRODUCTION_REFERENCE.md` |
| Reprodução numérica (auditoria) | script `audit_raio_num.py` (temp, reproduz fórmulas byte-a-byte) |

## 2. Transcrição do bloco (autoridade)

| Q (planilha) | Célula | Valor | Fórmula | Significado (label da planilha) |
|---|---|---|---|---|
| Q1 | B19 | 20 | — | **Altura/Profundidade do chanfro — na prática o RAIO R** |
| Q2 | B20 | 25 | — | Diâmetro da ferramenta |
| Q3 | B21 | 0,8 | — | Raio da ponta da ferramenta |
| Q4 | B22 | `-8,3` | `=-B19+((B20/2)-B21)` | X inicial da Ferramenta em Z=0 |
| Q5 | B23 | 20 | — | **Incremento** (Z por passo) |
| Q6 | B24 | `12,484609690826531` | `=((SQRT((B19+B21)^2-(B19+B21-B23)^2))+((B20/2)-B21)-B19)` | Deslocamento em X |

Notação adotada adiante: `R = Q1`, `D = Q2`, `r = Q3`, `inc = Q5`.

## 3. Fórmulas — forma funcional (reprodução exata)

```
Q4(R,D,r) = −R + (D/2 − r)
Q6(R,D,r,inc) = SQRT((R+r)² − ((R+r) − inc)²) + (D/2 − r) − R
```

Verificado numericamente (script): entrada do próprio exemplo
(R=20, D=25, r=0,8, inc=20) → `Q4 = −8,3`, `Q6 = 12,484609690826531`
(valores idênticos aos cacheados na planilha).

**Tabela numerada de casos (planilha fiel):**

| R | D | r | inc | Q4 | Q6 |
|---|---|---|---|---|---|
| 20,00 | 25 | 0,80 | 20,00 | −8,3000 | 12,4846 |
| 20,00 | 25 | 0,80 | 10,00 | −8,3000 | 9,4764 |
| 20,00 | 25 | 0,80 | 41,60 | −8,3000 | −8,3000 |
| 0,80 | 25 | 0,80 | 0,80 | 10,9000 | 12,2856 |
| 0,50 | 25 | 0,80 | 0,50 | 11,2000 | 12,2247 |
| 25,00 | 25 | 0,80 | 25,00 | −13,3000 | 12,4876 |
| 40,00 | 25 | 0,80 | 40,00 | −28,3000 | 12,4922 |

## 4. Interpretação geométrica (identidade do círculo)

A trajetória do **centro da fresa** é um arco de círculo:

- **raio** = `ρ = R + r` (compensação do raio de canto da fresa tórica);
- **centro** em `Xc = Q4 = (D/2 − r) − R`, a uma profundidade `ρ` abaixo do
  topo (Z=0);
- **ponto de partida** no topo: à profundidade 0, `X = Xc` (= `Q4`);
- posição em X conforme `z` cresce (descida em Z):

```
X(z) = Q4 + SQRT(z·(2·ρ − z)),   0 ≤ z ≤ 2·ρ
```

Linhas da trajetória para o exemplo (R=20, D=25, r=0,8, ρ=20,8):

| z (mm) | X centro fresa |
|---|---|
| 0,00 | −8,300 |
| 5,00 | 5,228 |
| 10,00 | 9,476 |
| 18,00 | 12,311 |
| 20,00 (Q6 do exemplo) | 12,485 |
| 20,80 (= ρ, ponto mais à direita) | 12,500 |
| 41,60 (= 2·ρ, retorno ao nível inicial) | −8,300 |

> **Atenção à convenção:** na planilha `z` é profundidade positiva (descida). No
> iTNC, Z é negativo para baixo — a conversão de sinal é responsabilidade do
> módulo/IR na geração.

**Nariz da fresa (canto tórico):** o caminho do **centro do raio de canto r**
é o mesmo arco deslocado de `(D/2 − r)` em X:

```
X_nariz(z) = −R + SQRT(z·(2·ρ − z))
```

que é exatamente um círculo de raio `ρ = R + r` centrado em
`(X = −R, profundidade = ρ)`. Ou seja: a fresa rola sobre um **raio de peça R**
concêntrico com o centro `(X=−R, ρ)`. A tangência com o raio de canto é o
invariante de projeto.

## 5. Bloco "traduzido" para o fluxo canônico (contrato do módulo Raio)

| Grandeza | Fórmula (planilha) | Contrato do módulo |
|---|---|---|
| X inicial (topo, Z=0) | `Q4 = (D/2 − r) − R` | `xCentro(z=0)` |
| Raio trajetória centro | `ρ = R + r` | `rTraj` |
| X em profundidade z | `Q4 + SQRT(z(2ρ−z))` | `xCentro(z)` |
| Profundidade útil (passe final) | `z = R` (caso de produção Q5=20=R) | `profFinal = min(inc, R)` do ciclo |
| Deslocamento por passo | `Q5` (incremento em Z) | `incrZ` |

## 6. Confronto com o G-Code atual (G-Code rápido)

O G-Code legado de arredondamento (F7) existe apenas para o tab "G-Code". Registro:
`arredondamento_aresta_reta_torica` (params `L, R, D, r, incrZ, rpm, av`).

Propriedade | Planilha (autoridade) | G-Code atual (F7)
---|---|---|
Raio do arco seguido pelo centro fresa | `ρ = R + r` | solver calcula `rTraj = R + r`, mas o laço **não** usa `rTraj` como raio |
Forma da posição X | **absoluto** `Q4 + SQRT(z(2ρ−z))`, centro em `Xc=(D/2−r)−R` | **relativo** `IX−Q13`, com `Q13 = rTraj − SQRT(R² − (R−z)²)` |
Centro do arco usado no laço | `(Xc, ρ)` — com compensação tórica e offset `D/2−r` | `(X=0, z=R)` — raio `R`, **sem** compensação r no arco |
Offset vertical do vértice | topo em `z=0`, arco até `z=2ρ` | arco de `z=0` a `z=R` |
Passes | incremento em Z com passo fixo `Q5` | `nPasses = ceil(R/incrZ)`, `passoZ = R/nPasses` |
Terminação | passo exato e contagem (limitada em `2ρ`) | `IF Q10 LT R` com passe final fixo |

**Divergência matemática (classe C):** o G-Code atual usa `Q13 = rTraj −
SQRT(R² − (R−z)²)`, que gera um arco de raio **R** (do centro na aresta) para o
**centro da fresa** — sem adicionar o raio de canto `r` à curva. A planilha usa
raio `ρ = R + r` no arco da trajetória. Para o mesmo caso
(R=20, D=25, r=0,8, z=20): planilha `X = 12,485` (centro fresa) vs G-Code
`X = SQRT(400−0) = 20,000` (inicia em `rTraj=20,8`, recua `Q13=0,8` →
`X = 20,000`). O G-Code não reproduz a geometria da planilha.

## 7. Divergências classificadas (modelo Prompt 004 §5)

| Classe | Diferença | Registrada em teste |
|---|---|---|
| **A — Formatação** | Planilha exibe `0.000` nos resultados e inputs azuis `DDEBF7`; G-Code legado tem cabeçalho próprio | — |
| **B — Arquitetura** | Planilha pré-calcula apenas `Q4` e `Q6` por passo; o G-Code atual recalcula `SQRT` a cada laço e usa HQuança relativa | estrutura |
| **C — Matemática** | Raio do arco da trajetória: `ρ = R + r` (planilha) vs `R` (G-Code atual) — diferença de **~7,5 mm** em X no exemplo | reprodução numérica |
| **D — Trajetória** | Planilha: X absoluto com centro em `(D/2−r)−R`; G-Code: X relativo partindo de `rTraj` | esqueleto |

Nenhuma classe **E (perigosa)** identificada na planilha — a fórmula é fechada e
limitada; o valor máximo de `Q6` é finito (`≤ 2·ρ`).

## 8. Decisão

| Critério | Resultado |
|---|---|
| Reprodução das fórmulas (script) | **Idêntica** (Q4=−8,3; Q6=12,484609690826531) |
| Fonte primária | **válida** para o módulo "Raio" |
| G-Code legado vs planilha | **DIVERGENTE (C)** — arco `R` vs `R+r`, X relativo vs absoluto |
| Heidenhain nativo | **inexistente** — o módulo "Raio" (Heidenhain) será o primeiro a implementar a geometria da planilha |

**Veredito: a planilha é a referência oficial do módulo "Raio".** O G-Code legado
que ficou será documentado como divergente e **não** como base de reprodução; o
módulo canônico Heidenhain seguirá a planilha (raio `R+r`, X absoluto, contagem
de passes exata).

_Nenhum código foi alterado nesta auditoria — a planilha permanece intacta e o
G-Code legado inalterado._