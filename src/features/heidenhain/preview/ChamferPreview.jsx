import { useState } from 'react';
import { VIEW, COLORS } from './previewGeometry';
import { buildChamferExternalPreviewModel } from './chamferExternalPreviewModel';
import { buildChamferInternalPreviewModel } from './chamferInternalPreviewModel';
import styles from './preview.module.css';

function OriginMarker({ x, y }) {
  const s = 6;
  return (
    <g>
      <line x1={x - s} y1={y} x2={x + s} y2={y} stroke={COLORS.originMarker} strokeWidth="1.2" opacity="0.5" />
      <line x1={x} y1={y - s} x2={x} y2={y + s} stroke={COLORS.originMarker} strokeWidth="1.2" opacity="0.5" />
      <circle cx={x} cy={y} r="2" fill={COLORS.originMarker} opacity="0.7" />
    </g>
  );
}

function Arrow({ x1, y1, x2, y2, color, opacity }) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const as = 7;
  return (
    <g opacity={opacity ?? 0.7}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="1.2" />
      <polygon
        points={`${x2},${y2} ${x2 - as * ux - as * 0.4 * uy},${y2 - as * uy + as * 0.4 * ux} ${x2 - as * ux + as * 0.4 * uy},${y2 - as * uy - as * 0.4 * ux}`}
        fill={color}
      />
    </g>
  );
}

// Tool body path: arc at bottom-left (π/2 → π), body extends RIGHT and UP
// Em SVG Y-down, o arco de (left,cy) até (cx,bottom) com sweep=0 passa
// pelo quadrante inferior-esquerdo (tangente ao chanfro no contato).
const toolPathD = (cx, cy, r, left, right, top, bottom) =>
  `M ${left},${cy} A ${r},${r} 0 0,0 ${cx},${bottom} L ${right},${bottom} L ${right},${top} L ${left},${top} Z`;

export default function ChamferPreview({ model, options, kind }) {
  const [curPass, setCurPass] = useState(0);

  if (!model) {
    return <div className={styles.placeholder}>Ajuste os parametros para visualizar</div>;
  }

  const m = kind === 'internal'
    ? buildInternal(model)
    : buildExternal(model);

  const opt = options || {};
  const show = (k) => opt[k] !== false;
  const np = m.nPasses || 1;
  const showAll = curPass === 0;
  const selIdx = showAll ? -1 : curPass - 1;

  const passOpacity = (i) => (showAll ? '0.3' : i === selIdx ? '1.0' : '0.08');
  const isHighlight = (i) => showAll || i === selIdx;

  const v = m.validation;
  const validColor = v?.valid ? '#22c55e' : '#ef4444';

  const labels = Array.isArray(m.labels) ? m.labels : [];
  const labelFor = (id) => labels.find((l) => l.id === id);

  return (
    <div>
      <svg viewBox={`0 0 ${VIEW.W} ${VIEW.H}`} className={styles.svg} preserveAspectRatio="xMidYMid meet" style={{ background: COLORS.bg }}>
        {/* Raw profile */}
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

        {/* Finished profile */}
        {show('finProfile') && (
          <polygon
            points={m.workpiece.finished.join(' ')}
            fill={COLORS.piece}
            stroke={COLORS.pieceEdge}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        )}

        {/* Safety line */}
        {show('safety') && (
          <line
            x1={30} y1={m.safety}
            x2={VIEW.W - 20} y2={m.safety}
            stroke={COLORS.safety}
            strokeWidth="1"
            strokeDasharray="5,4"
            opacity="0.4"
          />
        )}

        {/* Pass Z-depth lines */}
        {show('passes') && m.trajectory.map((pt, i) => (
          <line
            key={`pass${i}`}
            x1={pt.x}
            y1={pt.y}
            x2={VIEW.W - 18}
            y2={pt.y}
            stroke={COLORS.trajectoryLine}
            strokeWidth={isHighlight(i) ? (pt.isLast ? 1.8 : 1.2) : 0.4}
            strokeDasharray={pt.isLast ? 'none' : i === 0 ? '3,3' : '2,4'}
            opacity={passOpacity(i)}
          />
        ))}

        {/* Trajectory segments between passes */}
        {show('trajectory') && m.trajectory.length > 1 && (
          <g>
            {m.trajectory.slice(1).map((pt, i) => {
              const prev = m.trajectory[i];
              const hl = isHighlight(pt.pass - 1) || isHighlight(i);
              return (
                <line
                  key={`seg${i}`}
                  x1={prev.x} y1={prev.y}
                  x2={pt.x} y2={pt.y}
                  stroke={COLORS.trajectoryLine}
                  strokeWidth={hl ? 1.5 : 0.5}
                  strokeDasharray="3,3"
                  opacity={hl ? 0.45 : 0.06}
                />
              );
            })}
          </g>
        )}

        {/* Direction arrows (sentido de usinagem) */}
        {show('trajectory') && m.direction && m.direction.arrows && (
          <g opacity="0.6">
            {m.direction.arrows.map((pts, i) => (
              <polygon key={`dir${i}`} points={pts} fill={COLORS.active} />
            ))}
          </g>
        )}

        {/* Chamfer highlight + label */}
        {show('chamfer') && m.chamferHighlight && (
          <g>
            <line
              x1={m.chamferHighlight.x1} y1={m.chamferHighlight.y1}
              x2={m.chamferHighlight.x2} y2={m.chamferHighlight.y2}
              stroke={COLORS.chamfer}
              strokeWidth="3"
              strokeLinecap="round"
              opacity="0.9"
            />
            {(() => {
              const l = labelFor('chamfer');
              return l ? (
                <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize} opacity="0.9">
                  {l.text}
                </text>
              ) : null;
            })()}
          </g>
        )}

        {/* Last pass depth line */}
        {show('passes') && m.lastPass && m.lastPass.labelId && (
          <g>
            <line
              x1={m.lastPass.line.x1} y1={m.lastPass.line.y1}
              x2={m.lastPass.line.x2} y2={m.lastPass.line.y2}
              stroke={COLORS.active}
              strokeWidth="1"
              strokeDasharray="6,3"
              opacity="0.5"
            />
            {(() => {
              const l = labelFor(m.lastPass.labelId);
              return l ? (
                <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize} opacity="0.8">
                  {l.text}
                </text>
              ) : null;
            })()}
          </g>
        )}

        {/* ── Chamfer line extended past workpiece (construction) ── */}
        {show('contactGeo') && m.chamferLineExtended && (
          <line
            x1={m.chamferLineExtended.start.x} y1={m.chamferLineExtended.start.y}
            x2={m.chamferLineExtended.end.x} y2={m.chamferLineExtended.end.y}
            stroke={COLORS.contactDim}
            strokeWidth="0.5"
            strokeDasharray="6,4"
            opacity="0.25"
          />
        )}

        {/* ── Contact geometry: tangency circle, vectors, markers ── */}
        {show('contactGeo') && (
          <g>
            <circle
              cx={m.contactGeo.toolCenter.x} cy={m.contactGeo.toolCenter.y}
              r={m.contactGeo.radius}
              fill="none"
              stroke={COLORS.normalVec}
              strokeWidth="1.5"
              strokeDasharray="4,3"
              opacity="0.6"
            />
            <line
              x1={m.contactGeo.toolCenter.x} y1={m.contactGeo.toolCenter.y}
              x2={m.perpProjection.footX} y2={m.perpProjection.footY}
              stroke={COLORS.normalVec}
              strokeWidth="1.5"
              strokeDasharray="8,4"
              opacity="0.8"
            />
            <Arrow
              x1={m.contactGeo.contactPoint.x} y1={m.contactGeo.contactPoint.y}
              x2={m.contactGeo.toolCenter.x} y2={m.contactGeo.toolCenter.y}
              color={COLORS.normalVec}
              opacity="0.7"
            />
            <Arrow
              x1={m.contactGeo.contactPoint.x} y1={m.contactGeo.contactPoint.y}
              x2={m.contactGeo.contactPoint.x + m.contactGeo.normal.y * m.contactGeo.vecLen}
              y2={m.contactGeo.contactPoint.y - m.contactGeo.normal.x * m.contactGeo.vecLen}
              color={COLORS.tangentVec}
              opacity="0.5"
            />
            <line
              x1={m.contactGeo.toolCenter.x} y1={m.contactGeo.toolCenter.y}
              x2={m.contactGeo.contactPoint.x} y2={m.contactGeo.contactPoint.y}
              stroke={COLORS.contact}
              strokeWidth="0.8"
              strokeDasharray="2,2"
              opacity="0.6"
            />
            <circle cx={m.contactGeo.contactPoint.x} cy={m.contactGeo.contactPoint.y} r="4" fill={COLORS.contact} opacity="0.9" />
            <circle cx={m.contactGeo.toolCenter.x} cy={m.contactGeo.toolCenter.y} r="3" fill={COLORS.normalVec} opacity="0.9" />
          </g>
        )}

        {/* Tool centers at each pass (dots only) */}
        {show('toolCenter') && m.centers.map((pt, i) => (
          <circle key={`c${i}`} cx={pt.x} cy={pt.y} r={isHighlight(i) ? 3 : 1.5} fill={COLORS.toolCenterFill} opacity={passOpacity(i)} />
        ))}

        {/* Tool body (showAll → at tangency position; else → at selected pass) */}
        {show('tool') && (showAll ? (
          <g>
            <rect
              x={m.tool.shankX} y={m.tool.shankTop}
              width={m.tool.shankW} height={m.tool.shankH}
              fill={COLORS.toolFill}
              stroke={COLORS.toolEdge}
              strokeWidth="0.8"
            />
            <path
              d={toolPathD(
                m.contactGeo.toolCenter.x, m.contactGeo.toolCenter.y,
                m.contactGeo.radius,
                m.tool.left, m.tool.right, m.tool.top, m.tool.bottom
              )}
              fill={COLORS.toolFill}
              stroke={COLORS.toolEdge}
              strokeWidth="1.2"
              strokeLinejoin="round"
            />
            <line
              x1={m.contactGeo.toolCenter.x} y1={m.tool.bottom}
              x2={m.tool.right} y2={m.tool.bottom}
              stroke={COLORS.toolBase}
              strokeWidth="3"
              strokeLinecap="round"
            />
          </g>
        ) : (
          m.centers.map((pt, i) => i === selIdx && (
            <g key={`toolSel`}>
              <path
                d={toolPathD(
                  pt.x, pt.y,
                  m.contactGeo.radius,
                  pt.x - m.tool.cornerR, pt.x - m.tool.cornerR + m.tool.width,
                  pt.y + m.tool.cornerR - m.tool.height, pt.y + m.tool.cornerR
                )}
                fill={COLORS.toolFill}
                stroke={COLORS.toolEdge}
                strokeWidth="1.2"
                strokeLinejoin="round"
              />
              <line
                x1={pt.x} y1={pt.y + m.tool.cornerR}
                x2={pt.x - m.tool.cornerR + m.tool.width} y2={pt.y + m.tool.cornerR}
                stroke={COLORS.toolBase}
                strokeWidth="3"
                strokeLinecap="round"
              />
            </g>
          ))
        ))}

        {/* Axes */}
        {show('axes') && m.axes && m.axes.map((ax, i) => (
          <g key={`ax${i}`} opacity="0.55">
            <line {...ax.line} stroke={ax.color} strokeWidth="1" />
            <polygon points={ax.arrow} fill={ax.color} />
            {(() => {
              const l = labelFor(ax.labelId);
              return l ? (
                <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize} fontWeight="bold">
                  {l.text}
                </text>
              ) : null;
            })()}
          </g>
        ))}

        {/* Dimension lines */}
        {show('dims') && m.dimLines && m.dimLines.map((dl, i) => (
          <g key={`dl${i}`}>
            <line {...dl.line} stroke={dl.color} strokeWidth="1" opacity="0.8" />
            {dl.ticks.map((t, j) => (
              <line key={`dt${j}`} {...t} stroke={dl.color} strokeWidth="1" opacity="0.8" />
            ))}
            {(() => {
              const l = labelFor(dl.labelId);
              return l ? (
                <g>
                  <line {...l.leader} stroke={l.color} strokeWidth="0.7" strokeDasharray="2,2" opacity="0.5" />
                  <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize}>
                    {l.text}
                  </text>
                </g>
              ) : null;
            })()}
          </g>
        ))}

        {/* Origin */}
        {show('origin') && <OriginMarker x={m.origin.x} y={m.origin.y} />}
        {show('origin') && labelFor('origin') && (() => {
          const l = labelFor('origin');
          return (
            <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize} opacity="0.55">
              {l.text}
            </text>
          );
        })()}

        {/* Start / end points */}
        {show('startPoint') && m.start && (
          <g>
            <circle cx={m.start.x} cy={m.start.y} r="3.5" fill="none" stroke={COLORS.contact} strokeWidth="1.2" opacity="0.7" />
            {labelFor('inicio') && (() => {
              const l = labelFor('inicio');
              return (
                <g>
                  <line {...l.leader} stroke={l.color} strokeWidth="0.7" strokeDasharray="2,2" opacity="0.5" />
                  <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize} opacity="0.7">
                    {l.text}
                  </text>
                </g>
              );
            })()}
          </g>
        )}
        {show('endPoint') && m.end && (
          <g>
            <circle cx={m.end.x} cy={m.end.y} r="3.5" fill="none" stroke={COLORS.contact} strokeWidth="1.2" opacity="0.7" />
            {labelFor('fim') && (() => {
              const l = labelFor('fim');
              return (
                <g>
                  <line {...l.leader} stroke={l.color} strokeWidth="0.7" strokeDasharray="2,2" opacity="0.5" />
                  <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize} opacity="0.7">
                    {l.text}
                  </text>
                </g>
              );
            })()}
          </g>
        )}

        {/* Centro / contato / Reff labels */}
        {show('contactGeo') && ['centro', 'contato', 'reff'].map((id) => {
          const l = labelFor(id);
          return l ? (
            <g key={id}>
              <line {...l.leader} stroke={l.color} strokeWidth="0.7" strokeDasharray="2,2" opacity="0.45" />
              <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize} opacity="0.8">
                {l.text}
              </text>
            </g>
          ) : null;
        })}

        {/* PERFIL BRUTO label */}
        {show('rawProfile') && labelFor('raw') && (() => {
          const l = labelFor('raw');
          return (
            <g>
              <line {...l.leader} stroke={l.color} strokeWidth="0.7" strokeDasharray="2,2" opacity="0.45" />
              <text x={l.x} y={l.y + l.fontSize} fill={l.color} fontFamily="Share Tech Mono,monospace" fontSize={l.fontSize} opacity="0.7">
                {l.text}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Validation result */}
      {v && (
        <div className={styles.validation} style={{ color: validColor }}>
          <span className={styles.validationDot} style={{ background: validColor }} />
          {v.message}
        </div>
      )}

      {/* Simulator controls */}
      {np > 1 && (
        <div className={styles.simulator}>
          <button className={`${styles.simBtn} ${showAll ? styles.simBtnActive : ''}`} onClick={() => setCurPass(0)}>Todas</button>
          <span className={styles.simLabel}>Passe:</span>
          <input
            type="range"
            min={1} max={np}
            value={showAll ? 1 : curPass}
            onChange={(e) => setCurPass(parseInt(e.target.value))}
            className={styles.simSlider}
          />
          <span className={styles.simValue}>{showAll ? '—' : `${curPass} / ${np}`}</span>
        </div>
      )}
    </div>
  );
}

const buildExternal = buildChamferExternalPreviewModel;
const buildInternal = buildChamferInternalPreviewModel;
