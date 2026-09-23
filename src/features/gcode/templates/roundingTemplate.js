export function roundingTemplate(params, solved) {
  if (!solved) {
    return '; Erro: parametros invalidos ou insuficientes.';
  }

  const { L, R, D, r, rpm, av } = params;
  const { rTraj, nPasses, passoZ } = solved;

  const raioCentro = rTraj;

  let codigo = `; === ARREDONDAMENTO EM ARESTA RETA - FERRAMENTA TORICA ===
; Parametros de entrada:
;   Comprimento aresta L = ${L} mm
;   Raio arredondamento R = ${R} mm
;   Fresa D = ${D} mm, raio canto r = ${r} mm
;
; Dados calculados:
;   Raio trajetoria centro = ${rTraj.toFixed(3)} mm
;   Passes em Z: ${nPasses} x ${passoZ.toFixed(3)} mm
;
; ZERO PECA: aresta em X0, superficie topo em Z0
;
Q1=${R.toFixed(3)}     ;RAIO DE ARREDONDAMENTO
Q2=${r.toFixed(3)}     ;RAIO DE CANTO DA FRESA
Q3=${rTraj.toFixed(3)} ;RAIO TRAJETORIA CENTRO (R + r)
Q4=${passoZ.toFixed(3)} ;INCREMENTO Z POR PASSE
Q5=${D.toFixed(3)}     ;DIAMETRO DA FRESA
Q6=${rpm.toFixed(0)}   ;RPM
Q7=${av.toFixed(0)}    ;AVANCO MM/MIN
Q10=0                   ;DEFASAGEM Z ATUAL
Q11=${rTraj.toFixed(3)} ;POSICAO X INICIAL (centro fresa)
Q12=${R.toFixed(3)}    ;PROFUNDIDADE MAXIMA
;
; Posicionamento inicial
L Z+5 R0 FMAX M3 S${rpm.toFixed(0)}
L X${rTraj.toFixed(3)} Y-${(L / 2).toFixed(3)} R0 FMAX
;
LBL 2
  Q10=Q10+Q4
  ; Calcula offset X para o arco circular
  Q13=${rTraj.toFixed(3)} - SQRT((${R.toFixed(3)} * ${R.toFixed(3)}) - ((${R.toFixed(3)} - Q10) * (${R.toFixed(3)} - Q10)))
  L Z-Q10 R0 F${Math.round(av * 0.5)}
  L IX-Q13 F${av.toFixed(0)}
  L Y+${(L / 2).toFixed(3)} R0 F${av.toFixed(0)}
  L IX+Q13 F${av.toFixed(0)}
  L Z+0.5 R0 FMAX
  L X${rTraj.toFixed(3)} Y-${(L / 2).toFixed(3)} R0 FMAX
IF Q10 LT ${R.toFixed(3)} GOTO LBL 2
;
; Passe final de acabamento
Q10=${R.toFixed(3)}
Q13=${rTraj.toFixed(3)} - SQRT((${R.toFixed(3)} * ${R.toFixed(3)}) - ((${R.toFixed(3)} - Q10) * (${R.toFixed(3)} - Q10)))
L Z-${R.toFixed(3)} R0 F${Math.round(av * 0.5)}
L IX-Q13 F${av.toFixed(0)}
L Y+${(L / 2).toFixed(3)} R0 F${av.toFixed(0)}
;
L Z+50 R0 FMAX M5`;

  return codigo;
}
