# REFERÊNCIA DE PRODUÇÃO — CHANFRO EXTERNO (ARESTA RETA)

Documento que confronta o programa real de produção `CHANFRO EXT RETO.H`
(iTNC 530, operador) com o programa canônico gerado pelo CNC Operator para o
mesmo chanfro. Este é o registro de validação do Prompt 004 — **o arquivo real
NUNCA é modificado**; é lido como fixture de referência de engenharia.

## 1. Referências

| Item | Caminho |
|---|---|
| Programa real (autoridade) | `CHANFRO EXT RETO.H` (raiz do projeto) |
| Fixture byte-idêntica | `tests/fixtures/CHANFRO_EXT_RETO_TESTE.H` |
| Teste de validação | `tests/productionReference.test.js` (13 testes) |
| Template legado referenciado | `chamferExternalTemplate.js` (declara "referencia: CHANFRO_EXT_RETO.H") |
| Pipeline canônico | `src/core/machining/chamfer` |
| Convenção de coordenadas | `docs/COORDINATE_SYSTEM.md` |

A fixture é verificada byte-a-byte contra o programa real nos testes
(espera: idêntica).

## 2. Programa real (transcrição)

```
0  BEGIN PGM CHANFRO EXT RETO MM
1  ;ZERAMENTO OU DESLOCAMEMTO - SEMPRE NO VERTICE DA REGIAO DO CHANFRO
2  BLK FORM 0.1 Z  X-100  Y-100  Z-100
3  BLK FORM 0.2  X+0  Y+0  Z+0
4  TOOL CALL 1 Z S2000
5  ;----PARAMETROS DO CHANFRO--------
6  FN 0: Q1 =+30 ;ANGULO DO CHANFRO
7  FN 0: Q2 =+50 ;ALTURA DO CHANFRO
8  FN 0: Q3 =+52 ;DIA. DA FERRAMENTA
9  FN 0: Q4 =+6 ;RAIO DA FERRAMENTA
10 ;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
11 ;***PARAMETROS DO INICIO DO PGM***
12 FN 0: Q11 =+10 ;DISTANCIA DE SEGURANCA DA PECA
13 FN 0: Q22 =+0.2
14 FN 0: Q33 =+100 ;COMPRIMENTO CHANFRO
15 ;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
16 Q12 = Q11 + ( Q3 / 2 )
17 Q5 = ( ( ( ( Q3 / 2 ) - Q4 ) - ( TAN Q1 * Q2 ) ) - ( TAN Q1 * ( Q4 - SIN Q1 * Q4 ) ) + ( COS Q1 * Q4 ) ) ;POS.X INICIAL EM Z0
18 FN 0: Q21 =+0
19 FN 4: Q7 =+Q3 DIV +2
20 FN 1: Q34 =+Q33 + +Q11
21 L  X+Q12  Y+Q11 R0 FMAX
22 L  Z+Q21 R0 FMAX
23 LBL 1
24 FN 1: Q21 =+Q21 + +Q22
25 Q6 = Q5 + ( TAN Q1 * Q21 )
26 L  X+Q12  Y+Q11 R0 FMAX
27 L  Z-Q21 R0 F2222 M90
28 L  X+Q6 R0 M90
29 L  Y-Q34 R0 M90
30 L  X+Q12 IZ+1 R0 M90
31 FN 12: IF +Q6 LT +Q7 GOTO LBL 1
32 L  Z+100 R0 FMAX M30
33 END PGM CHANFRO EXT RETO MM
```

## 3. Mapa de Q-parameters (real ↔ canônico)

| Q (real) | Significado real | Equivalente canônico | Q (canônico) |
|---|---|---|---|
| Q1 = 30 | Ângulo **da vertical** | `A = 90 − Q1` (complemento) | FN0 `Q1` |
| Q2 = 50 | **ALTURA** do chanfro (Z) | `C = Q2 / cos(A)` (largura da superfície) | FN0 `Q2` |
| Q3 = 52 | Diâmetro da ferramenta | `D` | FN0 `Q3` |
| Q4 = 6 | **RAIO** da ferramenta | `r` (em `Q5`) | DEFINE `Q5` |
| Q5 = calc. | X inicial em Z0 (corpo) | `xCentro` | DEFINE `Q10` |
| Q6 = calc. | X de contato por passe | `Q21 = Q10 + Q20·Q22` | DEFINE `Q21` |
| Q7 = 26 | Limite geométrico `D/2` (DIV) | — (termina por contagem) | — |
| Q11 = 10 | Distância de segurança | `seguranca` | FN0 `Q11` |
| Q12 = 36 | X do canto seguro | `xCorner = seg + D/2` | DEFINE `Q12` |
| Q21 = 0→acum | Profundidade acumulada (Z) | `Q20 = Q30·Q4` (prof. do passe) | DEFINE `Q20` |
| Q22 = 0.2 | Incremento por passe (Z) | `incReal` (em `Q4`) | DEFINE `Q4` |
| Q33 = 100 | Comprimento do chanfro | `L` | FN0 `Q33` |
| Q34 = 110 | Comprimento total (Y) | `yTotal = L + seg` | DEFINE `Q34` |
| — | — | `cotA` (cotangente) | DEFINE `Q22` |
| — | — | Total de passes | DEFINE `Q31` |
| — | — | Contador de passes | ASSIGN `Q30` |

**Conclusão do mapa:** os números Q **não são compatíveis 1:1**. O canônico
reorganiza a semântica (raio em `Q5` vs `Q4`, cotangente em `Q22` vs incremento,
profundidade acumulada em `Q20`/`Q30` vs `Q21`). É uma diferença **estrutural
(B)** intencional — o canônico remove TAN/SIN/COS do laço pré-calculando
constantes em JavaScript.

## 4. Fórmulas — confronto analítico

A validação usa **dois modos de comparação**:

- **Modo A (teste)** — os números do real são alimentados literalmente no
  canônico (`A=30`, `C=50`). Expõe a divergência de semântica de ângulo/altura
  (seção 7, entrada de teste).
- **Modo B (equivalente)** — os parâmetros do real são **convertidos** para a
  semântica canônica, reproduzindo a MESMA geometria: `A = 60°` (complemento de
  Q1=30°), `C = 57,735` (C·cos60 = 28,867 = Q2·tan30 ✓ altura Z=50 ✓), `D = 52`,
  `r = 6`, `passeZ = 0,2`, `L = 100`, `seg = 10`.

Valores do **Modo B**:

| Grandeza | Real | Canônico |
|---|---|---|
| Q5 / xCentro (X inicial Z0) | `(D/2−r) − tanA·Q2 − tanA·(r−senA·r) + cosA·r` = **−5,403** | `xCentro = −largX + Reff/senA` = **−21,939** |
| X de contato por passe | `Q6 = Q5 + tanA·Q21` | `Q21 = xCentro + prof·cotA` |
| Inclinação (Z→X) | `tan(30°) = 0,5774` | `cot(60°) = 0,5774` (idêntica) |
| Offsets | constante 23,464 da linha do chanfro | tangente exata (distância = Reff) |
| Fim do laço | por limite X: `Q6 < Q7 = D/2` | por contagem: `Q30 < Q31` |
| Profundidade final | ultrapassa Q2=50 → **54,4** (~272 passos) | termina **exato em 50** (~250 passos) |
| Diferença de X em Z0 | — | **≈ 16,5 mm** (xCentro vs Q5) |

**Tangência:** o canônico é exatamente tangente à linha do chanfro em todos os
passes (invariante comprovado nos testes: distância centro→reta = `Reff` para
todo Z). O programa real desloca o corpo da ferramenta por uma constante
empírica (≈23,464 mm da linha), que **não** mantém tangência com o raio de 6 mm.

## 5. Diferenças classificadas (Prompt 004, seção 5)

| Classe | Diferença | Registrada em teste |
|---|---|---|
| **A — Formatação** | Comentários/BLK FORM: real tem `BLK FORM 0.1/0.2` fixo e comentários próprios; canônico tem comentários gerados e BLK FORM opcional | fixture (assinatura) |
| **B — Arquitetura** | Laço real recalcula `TAN/SIN/COS` (Q5, Q6); canônico pré-calcula constantes em JS e repete soma/multiplicação | estrutura |
| **C — Matemática** | `xCentro` (tangente) vs `Q5` (empírico, offset 23,464) — diferença de **~16,5 mm** em X0 | `SIM.q5` vs `MODEL.xCentro` |
| **C — Matemática** | Semântica de `A` (real: da vertical; canônico: da horizontal) e de `Q2` (real: altura; canônico: largura da superfície) | complemento `A=90−Q1` |
| **D — Trajetória** | Terminação: real por limite X com **overshoot de 4,4 mm** (54,4 vs 50); canônico termina exato por contagem | 272 vs 289 passos |
| **E — Perigosa** | Nenhuma divergência considerada perigosa — o canônico **reduz** risco (não ultrapassa `profZ`, feed idêntico F2222, M90 mantido em todos os movimentos de corte) | — |

## 6. Estrutura do laço — equivalência

Sequência de movimentos por passe (ambos, na ordem):

1. Rápido ao canto seguro: `L X+Q12 Y+Q11 R0 FMAX`
2. Desce em Z até a profundidade do passe com feed + M90
3. Avança em X até o ponto de contato com feed + M90
4. Usina em Y (comprimento) com feed + M90
5. Recua em diagonal: `L X+Q12 IZ+1 R0 M90`
6. Condição de laço: `FN 12` (real: `IF +Q6 LT +Q7`; canônico: `IF +Q30 LT +Q31`)
7. Retorno seguro: `L Z+100 R0 FMAX M30`

O esqueleto de movimentos é **idêntico**; diferem apenas a condição de
terminação e os Q envolvidos na aritmética (seção 4).

## 7. Verificação numérica (testes)

`tests/productionReference.test.js` (13 testes) cobre:

- fixture idêntica byte-a-byte ao real (inesperado mas comprovado);
- assinatura do programa real presente na fixture;
- esqueleto de movimentos do canônico reproduz o do real;
- Q12/Q34 coincidem com os valores calculados pelo real (36 / 110);
  - divergências C/D documentadas com valores exatos (Modo A — entrada
    `A=30, C=50` alimentada literalmente, expondo a semântica divergente):
    - `Q5 real = −5,403411845` vs `xCentro canônico = −31,3012701892` — o
      canônico interpreta (A,C) como (ângulo da horizontal, largura da
      superfície) e mede `largX = 43,30`, `profZ = 25`; o real trata (ângulo da
      vertical, altura) e mede `28,87 × 50`. Diferença ≈ 25,90 mm em X0;
    - inclinações complementares: `tan30 = 0,5774` = `1/cot60`;
    - geometria do chanfro: real `28,87 × 50` vs canônico `43,30 × 25` para o
      mesmo par (A,C) — **semântica diferente** de ângulo/altura;
    - laço: real 272 passos / profundidade 54,4 (overshoot) vs canônico 125
      passos / exato 25,0 (entrada de teste);
  - invariante de tangência do canônico em todos os passes;
  - ausência de `DIV`, `Q7`, `IF +Q6 LT +Q7` no canônico.

## 8. Decisão

| Critério | Resultado |
|---|---|
| Esqueleto de movimentos | **Equivalente** (estrutura A/B) |
| Matemática de deslocamento X | **DIVERGENTE** (C) — empírico vs tangente |
| Terminação do laço | **DIVERGENTE** (D) — limite X com overshoot vs contagem exata |
| Riscos | Nenhuma diferença perigosa (E) — canônico é conservador |

**Veredito: NÃO APROVADO para equivalência geométrica 1:1 com o programa real.**
O canônico é matematicamente exato (tangente, sem overshoot) e estruturalmente
fiel ao laço real, mas NÃO reproduz o deslocamento empírico de X do operador
(que não preserva tangência com o raio). Para tornar o canônico reprodutor
fiel do real seria necessário adotar o offset constante empírico — o que
violaria a regra de ouro da tangência. **Decisão do módulo: manter o canônico
tangente** e registrar esta referência como o mapa oficial da divergência.

_Nenhum código foi alterado em função das divergências C/D — o canônico
permanece exato e a referência documenta a diferença (Prompt 004 §17)._
