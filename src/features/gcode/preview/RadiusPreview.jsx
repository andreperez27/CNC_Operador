import { useState } from 'react';
import { VIEW, COLORS } from '../../heidenhain/preview/previewGeometry';
import { buildRadiusPreviewScene } from '../../heidenhain/preview/buildRadiusPreviewScene';
import styles from './preview.module.css';
import iterStyles from '../../heidenhain/preview/preview.module.css';

const toolPathD = (cx, cy, r, left, right, top, bottom) =>
  `M ${left},${cy} A ${r},${r} 0 0,0 ${cx},${bottom} L ${right},${bottom} L ${right},${top} L ${left},${top} Z`;

export default function RadiusPreview({ model, solved, options }) {
  const [curPass, setCurPass] = useState(0);
  const modelSrc = solved || model;
  if (!modelSrc) {
    return <div className={styles.placeholder}>Ajuste os parametros para visualizar o preview</div>;
  }

  const m = buildRadiusPreviewScene(modelSrc);
  const opt = options || {};
  const show = (k) => opt[k] !== false;

  const np = m.nPasses || 1;
  const showAll = curPass === 0;
  const selIdx = showAll ? -1 : curPass - 1;
  const passOpacity = (i) => (showAll ? '0.3' : i === selIdx ? '1.0' : '0.08');
  const isHighlight = (i) => showAll || i === selIdx;

  const labels = Array.isArray(m.labels) ? m.labels : [];
  const labelFor = (id) => labels.find((l) => l.id === id);

  const renderLabel = (l, pointer = false) =>
    l ? (
      <g key={`lab${l.id}`}>
        {l.leader && (
          <line {...l.leader} stroke={l.color} strokeWidth="0.7" strokeDasharray="2,2"
                opacity={pointer ? '0.5' : '0.45'} />
        )}
        <text x={l.x} y={l.y + l.fontSize} fill={l.color}
              fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize}>
          {l.text}
        </text>
      </g>
    ) : null;

  return (
    <div>
      <svg viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} className={styles.svg}
           preserveAspectRatio="xMidYMid meet" style={{ background: COLORS.bg }}>
        {/* Perfil bruto */}
        {show('rawProfile') && (
          <polygon
            points={m.workpiece.raw.join(' ')}
            fill={COLORS.pieceRaw}
            stroke={COLORS.pieceRawEdge}
            strokeWidth="1"
            strokeDasharray="4,3"
            strokeLinejoin="round"
            opacity="0.5"
          />
        )}

        {/* Perfil acabado */}
        {show('finProfile') && (
          <polygon
            points={m.workpiece.finished.join(' ')}
            fill={COLORS.piece}
            stroke={COLORS.pieceEdge}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}

        {/* Linha de seguranca */}
        {show('safety') && (
          <line x1={30} y1={m.safety} x2={VIEW.W - 20} y2={m.safety}
                stroke={COLORS.safety} strokeWidth="1" strokeDasharray="5,4" opacity="0.4" />
        )}

        {/* Linhas de profundidade por passe */}
        {show('passes') && m.trajectory.map((pt, i) => (
          <line
            key={`pass${i}`}
            x1={pt.x} y1={pt.y} x2={VIEW.W - 18} y2={pt.y}
            stroke={COLORS.trajectoryLine}
            strokeWidth={isHighlight(i) ? (pt.isLast ? 1.8 : 1.2) : 0.4}
            strokeDasharray={pt.isLast ? 'none' : i === 0 ? '3,3' : '2,4'}
            opacity={passOpacity(i)}
          />
        ))}

        {/* Segmentos da trajetoria */}
        {show('trajectory') && m.trajectory.length > 1 && (
          <g>
            {m.trajectory.slice(1).map((pt, i) => {
              const prev = m.trajectory[i];
              const hl = isHighlight(pt.pass - 1) || isHighlight(i);
              return (
                <line
                  key={`seg${i}`}
                  x1={prev.x} y1={prev.y} x2={pt.x} y2={pt.y}
                  stroke={COLORS.trajectoryLine}
                  strokeWidth={hl ? 1.5 : 0.5}
                  strokeDasharray="3,3"
                  opacity={hl ? 0.45 : 0.06}
                />
              );
            })}
          </g>
        )}

        {/* Setas de direcao */}
        {show('trajectory') && m.direction && m.direction.arrows && (
          <g opacity="0.6">
            {m.direction.arrows.map((pts, i) => (
              <polygon key={`dir${i}`} points={pts} fill={COLORS.active} />
            ))}
          </g>
        )}

        {/* Arco do raio (destaque) */}
        {show('radius') && m.radiusHighlight && (
          <g>
            <polyline
              points={m.radiusHighlight.polyline}
              fill="none"
              stroke={COLORS.chamfer}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.9"
            />
            {renderLabel(labelFor('radius'))}
          </g>
        )}

        {/* Linha do ultimo passe */}
        {show('passes') && m.lastPass && (
          <g>
            <line {...m.lastPass.line} stroke={COLORS.active} strokeWidth="1"
                  strokeDasharray="6,3" opacity="0.5" />
            {renderLabel(labelFor('lastPass'))}
          </g>
        )}

        {/* Geometria de contato: circulo de referencia, contato, nariz */}
        {show('contactGeo') && (
          <g>
            <circle
              cx={m.tangency.center.x} cy={m.tangency.center.y}
              r={m.tangency.radius}
              fill="none" stroke={COLORS.normalVec} strokeWidth="1.5"
              strokeDasharray="4,3" opacity="0.45"
            />
            <line
              x1={m.tangency.center.x} y1={m.tangency.center.y}
              x2={m.tangency.point.x} y2={m.tangency.point.y}
              stroke={COLORS.contact} strokeWidth="0.8" strokeDasharray="2,2" opacity="0.6"
            />
            <circle cx={m.tangency.point.x} cy={m.tangency.point.y} r="4" fill={COLORS.contact} opacity="0.9" />
            <circle cx={m.contactGeo.toolCenter.x} cy={m.contactGeo.toolCenter.y} r="3" fill={COLORS.normalVec} opacity="0.9" />
            {renderLabel(labelFor('centro'))}
            {renderLabel(labelFor('contato'))}
            {renderLabel(labelFor('rho'))}
          </g>
        )}

        {/* Centros da ferramenta por passe */}
        {show('toolCenter') && m.centers.map((pt, i) => (
          <circle key={`c${i}`} cx={pt.x} cy={pt.y}
                  r={isHighlight(i) ? 3 : 1.5} fill={COLORS.toolCenterFill} opacity={passOpacity(i)} />
        ))}

        {/* Ferramenta no ultimo passe */}
        {show('tool') && (
          <g>
            <rect
              x={m.tool.shankX} y={m.tool.shankTop}
              width={m.tool.shankW} height={m.tool.shankH}
              fill={COLORS.toolFill} stroke={COLORS.toolEdge} strokeWidth="0.8"
            />
            {(() => {
              const a = m.tool.left + m.tool.cornerR;
              const b = m.tool.bottom - m.tool.cornerR;
              return (
                <g>
                  <path
                    d={toolPathD(a, b, m.tool.cornerR, m.tool.left, m.tool.right, m.tool.top, m.tool.bottom)}
                    fill={COLORS.toolFill} stroke={COLORS.toolEdge} strokeWidth="1.2" strokeLinejoin="round"
                  />
                  <line x1={a} y1={m.tool.bottom} x2={m.tool.right} y2={m.tool.bottom}
                        stroke={COLORS.toolBase} strokeWidth="3" strokeLinecap="round" />
                </g>
              );
            })()}
          </g>
        )}

        {/* Eixos */}
        {show('axes') && m.axes && m.axes.map((ax, i) => (
          <g key={`ax${i}`} opacity="0.55">
            <line {...ax.line} stroke={ax.color} strokeWidth="1" />
            <polygon points={ax.arrow} fill={ax.color} />
            {renderLabel(labelFor(ax.labelId))}
          </g>
        ))}

        {/* Cotas */}
        {show('dims') && m.dimLines && m.dimLines.map((dl, i) => (
          <g key={`dl${i}`}>
            <line {...dl.line} stroke={dl.color} strokeWidth="1" opacity="0.8" />
            {dl.ticks.map((t, j) => (
              <line key={`dt${j}`} {...t} stroke={dl.color} strokeWidth="1" opacity="0.8" />
            ))}
            {renderLabel(labelFor(dl.labelId))}
          </g>
        ))}

        {/* Origem */}
        {show('origin') && (
          <g>
            <line x1={m.origin.x - 6} y1={m.origin.y} x2={m.origin.x + 6} y2={m.origin.y}
                  stroke={COLORS.originMarker} strokeWidth="1.2" opacity="0.5" />
            <line x1={m.origin.x} y1={m.origin.y - 6} x2={m.origin.x} y2={m.origin.y + 6}
                  stroke={COLORS.originMarker} strokeWidth="1.2" opacity="0.5" />
            <circle cx={m.origin.x} cy={m.origin.y} r="2" fill={COLORS.originMarker} opacity="0.7" />
            {renderLabel(labelFor('origin'))}
          </g>
        )}

        {/* Inicio / fim */}
        {show('startPoint') && m.start && (
          <g>
            <circle cx={m.start.x} cy={m.start.y} r="3.5" fill="none" stroke={COLORS.contact} strokeWidth="1.2" opacity="0.7" />
            {renderLabel(labelFor('inicio'))}
          </g>
        )}
        {show('endPoint') && m.end && (
          <g>
            <circle cx={m.end.x} cy={m.end.y} r="3.5" fill="none" stroke={COLORS.contact} strokeWidth="1.2" opacity="0.7" />
            {renderLabel(labelFor('fim'))}
          </g>
        )}

        {/* PERFIL BRUTO */}
        {show('rawProfile') && renderLabel(labelFor('raw'))}
      </svg>

      {/* Simulador */}
      {np > 1 && (
        <div className={iterStyles.simulator}>
          <button className={`${iterStyles.simBtn} ${showAll ? iterStyles.simBtnActive : ''}`}
                  onClick={() => setCurPass(0)}>Todas</button>
          <span className={iterStyles.simLabel}>Passe:</span>
          <input
            type="range" min={1} max={np}
            value={showAll ? 1 : curPass}
            onChange={(e) => setCurPass(parseInt(e.target.value))}
            className={iterStyles.simSlider}
          />
          <span className={iterStyles.simValue}>{showAll ? '—' : `${curPass} / ${np}`}</span>
        </div>
      )}
    </div>
  );
}