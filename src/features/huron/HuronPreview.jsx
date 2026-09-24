import styles from './HuronPage.module.css';

/**
 * Preview técnico do cabeçote 45 Huron: duas vistas SVG (perfil da flange
 * inferior + topo da flange superior), reagindo aos valores já compensados
 * pelo anel (bFlange, cFlange, em graus).
 *
 * Convertido diretamente do protótipo aprovado — a matemática de desenho não
 * deve ser alterada, só a integração com o restante do componente/estilos
 * do projeto, se necessário.
 *
 * Destino sugerido: src/features/huron/HuronPreview.jsx (substitui o arquivo
 * atual por completo)
 */

const DEG2RAD = Math.PI / 180;

export default function HuronPreview({ bFlange = 0, cFlange = 0 }) {
  const hasAngle = bFlange > 0.01;

  // ---- vista de perfil (flange inferior) ----
  const cx = 150, pivotY = 120, bodyHalf = 32, bodyTop = 25, discR = 42, toolLen = 95, arcR = 30;
  const rad = bFlange * DEG2RAD;
  const dirX = Math.sin(rad), dirY = Math.cos(rad);
  const perpX = Math.cos(rad), perpY = -Math.sin(rad);

  const discP1 = { x: cx + perpX * discR, y: pivotY + perpY * discR };
  const discP2 = { x: cx - perpX * discR, y: pivotY - perpY * discR };
  const toolTip = { x: cx + dirX * toolLen, y: pivotY + dirY * toolLen };
  const refEnd = { x: cx, y: pivotY + toolLen };
  const arcStart = { x: cx, y: pivotY + arcR };
  const arcEnd = { x: cx + dirX * arcR, y: pivotY + dirY * arcR };
  const largeArcB = bFlange > 180 ? 1 : 0;
  const boxBX = Math.min(discP1.x + 20, 240);

  // ---- vista de topo (flange superior) ----
  const topCx = 150, topCy = 150, topR = 95, topArcR = 30;
  const cRad = cFlange * DEG2RAD;
  const tip = { x: topCx + topR * Math.sin(cRad), y: topCy - topR * Math.cos(cRad) };
  const largeArcC = cFlange > 180 ? 1 : 0;

  return (
    <div className={styles.views}>
      <div className={styles.view}>
        <div className={styles.viewTitle}>Perfil — flange inferior</div>
        <svg viewBox="0 0 300 320" className={styles.svg}>
          <ellipse cx={cx} cy={bodyTop} rx={bodyHalf} ry={9} fill="none" stroke="#c7ccd4" strokeWidth="1.5" />
          <line x1={cx - bodyHalf} y1={bodyTop} x2={cx - bodyHalf} y2={pivotY} stroke="#c7ccd4" strokeWidth="1.5" />
          <line x1={cx + bodyHalf} y1={bodyTop} x2={cx + bodyHalf} y2={pivotY} stroke="#c7ccd4" strokeWidth="1.5" />

          <line x1={cx} y1={pivotY} x2={refEnd.x} y2={refEnd.y} stroke="#4a5262" strokeWidth="1.2" strokeDasharray="4 4" />

          <line x1={discP1.x} y1={discP1.y} x2={discP2.x} y2={discP2.y} stroke="#e7e9ec" strokeWidth="2.5" />

          <line x1={cx} y1={pivotY} x2={toolTip.x} y2={toolTip.y} stroke="#f5a623" strokeWidth="3" />
          <circle cx={cx} cy={pivotY} r="4" fill="#f5a623" />

          {hasAngle && (
            <path
              d={`M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 ${largeArcB} 1 ${arcEnd.x} ${arcEnd.y}`}
              fill="none"
              stroke="#4a5262"
              strokeWidth="1.2"
            />
          )}

          <line x1={discP1.x} y1={discP1.y} x2={boxBX} y2="34" stroke="#4a5262" strokeWidth="1" strokeDasharray="3 3" />
          <rect x={boxBX} y="20" width="120" height="30" fill="none" stroke="#c7ccd4" strokeWidth="1" />
          <text x={boxBX + 8} y="40" fill="#6ec6ff" fontFamily="monospace" fontSize="15">
            B = {bFlange.toFixed(4)}°
          </text>
        </svg>
      </div>

      <div className={styles.view}>
        <div className={styles.viewTitle}>Topo — flange superior</div>
        <svg viewBox="0 0 300 320" className={styles.svg}>
          <circle cx={topCx} cy={topCy} r={topR} fill="none" stroke="#c7ccd4" strokeWidth="1.5" />
          <line x1={topCx} y1={topCy - topR} x2={topCx} y2={topCy - topR - 12} stroke="#4a5262" strokeWidth="1.2" />
          <circle cx={topCx} cy={topCy} r="4" fill="#f5a623" />

          {hasAngle && (
            <>
              <line x1={topCx} y1={topCy} x2={tip.x} y2={tip.y} stroke="#f5a623" strokeWidth="3" />
              <path
                d={`M ${topCx} ${topCy - topArcR} A ${topArcR} ${topArcR} 0 ${largeArcC} 1 ${topCx + topArcR * Math.sin(cRad)} ${topCy - topArcR * Math.cos(cRad)}`}
                fill="none"
                stroke="#4a5262"
                strokeWidth="1.2"
              />
              <line x1={tip.x} y1={tip.y} x2="60" y2="270" stroke="#4a5262" strokeWidth="1" strokeDasharray="3 3" />
            </>
          )}

          <rect x="30" y="260" width="120" height="30" fill="none" stroke="#c7ccd4" strokeWidth="1" />
          <text x="38" y="280" fill="#6ec6ff" fontFamily="monospace" fontSize="15">
            C = {hasAngle ? cFlange.toFixed(4) : '0.0000'}°
          </text>
        </svg>
      </div>
    </div>
  );
}
