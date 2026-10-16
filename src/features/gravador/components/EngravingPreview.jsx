import { svgPathForStroke, svgPathForLoop, svgViewBox, blockOutlines, unionBounds, trimNum } from './engravingPaths';
import styles from './EngravingPreview.module.css';

// Prévia SVG a partir da MESMA geometria do layout (nunca de segunda
// fonte): polilinhas + arcos. Mapeamento (x, y) → (x, −y) com viewBox
// deslocado (Y da máquina para cima, Y do SVG para baixo); flags do arco
// via describeArc (large-arc pelo ângulo varrido; cw-na-máquina percorre
// ângulo crescente na tela, logo sweep-flag 1).
// Com bloco: o enquadramento une tinta + bloco, desenha o retângulo, a
// área útil tracejada e o marcador de origem (canto inferior esquerdo).
export default function EngravingPreview({ strokes, bounds, block = null, origin = null, grooveWidthMm = null, critical = null }) {
  if (!Array.isArray(strokes) || strokes.length === 0 || !bounds) {
    return <div className={styles.placeholder}>Ajuste os parâmetros para visualizar</div>;
  }

  // Área usinada estimada: mesmos paths com a largura real do risco em mm
  // (o viewBox já está em mm), pontas/junções arredondadas e
  // semitransparência para a sobreposição aparecer. Sem largura válida,
  // volta à linha central (trajetória).
  const wide = typeof grooveWidthMm === 'number' && Number.isFinite(grooveWidthMm) && grooveWidthMm > 0;

  const rects = block ? blockOutlines(block) : null;
  const frame = rects
    ? unionBounds(bounds, {
        minX: block.x0,
        minY: block.y0,
        maxX: block.x0 + block.blockW,
        maxY: block.y0 + block.blockH,
      })
    : bounds;
  const paths = strokes.map((st) => svgPathForStroke(st));
  const ox = origin ? trimNum(origin.x) : null;
  const oy = origin ? trimNum(-origin.y) : null;
  // Marcador em mm proporcional à vista (r e hastes escalam com o zoom).
  const arm = Math.max(frame.maxX - frame.minX, frame.maxY - frame.minY) * 0.03;
  const rr = trimNum(arm / 2);

  return (
    <svg
      viewBox={svgViewBox(frame)}
      className={styles.svg}
      preserveAspectRatio="xMidYMid meet"
    >
      {rects && (
        <path d={svgPathForLoop(rects.block)} fill="none" stroke="#5d7a96" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      )}
      {rects && (
        <path d={svgPathForLoop(rects.usable)} fill="none" stroke="#8ab4d0" strokeWidth="1" strokeDasharray="4,3" vectorEffect="non-scaling-stroke" />
      )}
      {paths.map((d, i) => (
        <path
          key={i}
          d={d}
          fill="none"
          stroke={wide ? '#f59e0b' : '#38bdf8'}
          strokeWidth={wide ? grooveWidthMm : 1.5}
          vectorEffect={wide ? undefined : 'non-scaling-stroke'}
          strokeOpacity={wide ? 0.45 : 1}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {critical && (
        <circle
          cx={trimNum(critical.x)}
          cy={trimNum(-critical.y)}
          r={trimNum(Math.max(wide ? grooveWidthMm / 2 : 0, arm / 2))}
          fill="none"
          stroke="#ef4444"
          strokeWidth="1.5"
        />
      )}
      {origin && (
        <g stroke="#8ab4d0" strokeWidth="1.5" vectorEffect="non-scaling-stroke">
          <circle cx={ox} cy={oy} r={rr} fill="none" />
          <line x1={trimNum(origin.x - arm)} y1={oy} x2={trimNum(origin.x + arm)} y2={oy} />
          <line x1={ox} y1={trimNum(-origin.y - arm)} x2={ox} y2={trimNum(-origin.y + arm)} />
        </g>
      )}
    </svg>
  );
}
