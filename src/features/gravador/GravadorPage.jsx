import { useState, useEffect, useMemo } from 'react';
import Card from '../../components/Card';
import ProgramDisplay from '../heidenhain/components/ProgramDisplay';
import { getFont } from '../../core/engraving/fontRepository';
import { layoutText } from '../../core/engraving/layout';
import { fitInBlock, anchorInBlock, formatExcess } from '../../core/engraving/fit';
import { toggleSignText } from './components/engravingPaths';
import { buildEngravingProgram } from '../../core/engraving/emitHeidenhain';
import EngravingPreview from './components/EngravingPreview';
import styles from './GravadorPage.module.css';

const FONT_SLUG = 'traco-simples-10';

const ABAS = [
  { id: 'dados', label: 'Dados' },
  { id: 'previa', label: 'Prévia' },
  { id: 'programa', label: 'Programa' },
];

function num(v, fallback) {
  const n = Number(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
}

function optNum(v) {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function trim(v) {
  return String(Number(Number(v).toFixed(3)));
}

// Gravador de Textos CNC: texto → layout (mesma geometria da prévia) →
// programa Heidenhain .H absoluto (v1, sem ISO e sem incremental).
export default function GravadorPage() {
  const [values, setValues] = useState({
    text: 'ANDRE HENRIQUE',
    height: '10',
    spacing: '0',
    x0: '0',
    y0: '0',
    lineFactor: '1.6',
    availW: '',
    availH: '',
    zGrav: '0',
    zSeg: '10',
    feed: '2000',
    rpm: '1000',
    tool: '2',
    zStart: '100',
    blockW: '',
    blockH: '',
    margin: '0',
    center: true,
  });
  const [aba, setAba] = useState('dados');
  const [font, setFont] = useState(null);
  const [fontError, setFontError] = useState(null);
  // Altura máxima aplicada como liga/desliga: guarda a altura anterior
  // para reverter. Editar a altura manualmente desliga (usuário assumiu).
  const [maxAtivo, setMaxAtivo] = useState(null);

  useEffect(() => {
    let live = true;
    getFont(FONT_SLUG)
      .then((f) => { if (live) setFont(f); })
      .catch(() => { if (live) setFontError('Não foi possível carregar a fonte de gravação.'); });
    return () => { live = false; };
  }, []);

  const onField = (id) => (e) => {
    const v = e.target.value;
    setValues((prev) => ({ ...prev, [id]: v }));
  };

  const onCheck = (id) => (e) => {
    const v = e.target.checked;
    setValues((prev) => ({ ...prev, [id]: v }));
  };

  const onHeight = (e) => {
    const v = e.target.value;
    setValues((prev) => ({ ...prev, height: v }));
    setMaxAtivo(null);
  };

  const onToggleSign = (id) => {
    setValues((prev) => ({ ...prev, [id]: toggleSignText(prev[id]) }));
  };

  const handleUsarMaxima = () => {
    if (!fit || !(fit.maxHeight > 0)) return;
    if (maxAtivo) {
      setValues((prev) => ({ ...prev, height: maxAtivo.prev }));
      setMaxAtivo(null);
    } else {
      setMaxAtivo({ prev: values.height });
      setValues((prev) => ({ ...prev, height: String(fit.maxHeight) }));
    }
  };

  const layout = useMemo(() => {
    if (!font) return null;
    try {
      return {
        ok: true,
        value: layoutText(values.text, font, {
          height: num(values.height, NaN),
          letterSpacing: num(values.spacing, 0),
          lineHeightFactor: num(values.lineFactor, 1.6),
          x0: num(values.x0, 0),
          y0: num(values.y0, 0),
          availableWidth: optNum(values.availW),
          availableHeight: optNum(values.availH),
        }),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [font, values]);

  // Bloco definido = largura e altura preenchidas e válidas. Sem bloco,
  // sem encaixe (prévia/programa como antes).
  const blockDims = useMemo(() => {
    const w = optNum(values.blockW);
    const h = optNum(values.blockH);
    if (w === null || h === null || !(w > 0 && h > 0)) return null;
    return { w, h, margin: Math.max(0, num(values.margin, 0)) };
  }, [values.blockW, values.blockH, values.margin]);

  const fit = useMemo(() => {
    if (!font || !layout?.ok || !blockDims) return null;
    try {
      return fitInBlock(values.text, font, {
        height: num(values.height, NaN),
        letterSpacing: num(values.spacing, 0),
        lineHeightFactor: num(values.lineFactor, 1.6),
        blockW: blockDims.w,
        blockH: blockDims.h,
        margin: blockDims.margin,
      });
    } catch {
      return null;
    }
  }, [font, layout, values.text, values.height, values.spacing, values.lineFactor, blockDims]);

  // Geometria final: com bloco, posicionada no bloco (X/Y = canto inferior
  // esquerdo); sem bloco, direto do layout.
  const placed = useMemo(() => {
    if (!layout?.ok) return null;
    if (!blockDims) return layout.value;
    return anchorInBlock(layout.value, {
      x0: num(values.x0, 0),
      y0: num(values.y0, 0),
      blockW: blockDims.w,
      blockH: blockDims.h,
      margin: blockDims.margin,
      center: values.center,
    });
  }, [layout, blockDims, values.x0, values.y0, values.center]);

  const program = useMemo(() => {
    if (!placed) return null;
    try {
      return {
        ok: true,
        value: buildEngravingProgram({
          layout: placed,
          machining: {
            zGravacao: num(values.zGrav, 0),
            zSeguranca: num(values.zSeg, 10),
            feed: num(values.feed, 2000),
            rpm: num(values.rpm, 1000),
            ferramenta: num(values.tool, 2),
            zInicio: num(values.zStart, 100),
          },
          fontMeta: { slug: font.font.slug, version: font.font.version, name: font.font.name },
          block: blockDims && fit ? {
            w: blockDims.w,
            h: blockDims.h,
            margin: blockDims.margin,
            fits: fit.fits,
            overW: fit.overW,
            overH: fit.overH,
          } : null,
        }),
      };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [placed, blockDims, fit, font, values]);

  return (
    <div className="page">
      <div className={styles.header}>
        <h1 className={styles.title}>Gravador de Textos CNC</h1>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Seções da página">
        {ABAS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={aba === id}
            className={`${styles.tab} ${aba === id ? styles.tabActive : ''}`}
            onClick={() => setAba(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {aba === 'dados' && (
        <Card title="Dados da gravação">
          {!font && !fontError && <div className="info">Carregando fonte…</div>}
          {fontError && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{fontError}</div>
          )}
          <div className="fg">
            <label className="fl" htmlFor="gv-text">Texto (várias linhas)</label>
            <textarea
              id="gv-text"
              className="fi"
              rows={3}
              style={{ minHeight: 72, resize: 'vertical' }}
              value={values.text}
              onChange={onField('text')}
            />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-height">Altura (mm)</label>
            <input id="gv-height" className="fi" type="number" inputMode="decimal" min="0.1" step="any" value={values.height} onChange={onHeight} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-spacing">Espaçamento extra (mm, sem escala)</label>
            <input id="gv-spacing" className="fi" type="number" inputMode="decimal" step="any" value={values.spacing} onChange={onField('spacing')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-blockw">Bloco — largura (mm, vazio = sem bloco)</label>
            <input id="gv-blockw" className="fi" type="number" inputMode="decimal" min="0.1" step="any" value={values.blockW} onChange={onField('blockW')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-blockh">Bloco — altura (mm)</label>
            <input id="gv-blockh" className="fi" type="number" inputMode="decimal" min="0.1" step="any" value={values.blockH} onChange={onField('blockH')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-margin">Margem (mm de cada lado)</label>
            <input id="gv-margin" className="fi" type="number" inputMode="decimal" min="0" step="any" value={values.margin} onChange={onField('margin')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-center">
              <input
                id="gv-center"
                type="checkbox"
                checked={values.center}
                onChange={onCheck('center')}
                style={{ marginRight: 8 }}
              />
              Centralizar no bloco
            </label>
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-zgrav">Z de gravação (negativo desce)</label>
            <div className={styles.signRow}>
              <input id="gv-zgrav" className="fi" type="text" inputMode="decimal" autoComplete="off" value={values.zGrav} onChange={onField('zGrav')} />
              <button className="btn btn-s" type="button" title="Inverter sinal (+/-)" onClick={() => onToggleSign('zGrav')}>+/−</button>
            </div>
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-zseg">Z de segurança</label>
            <div className={styles.signRow}>
              <input id="gv-zseg" className="fi" type="text" inputMode="decimal" autoComplete="off" value={values.zSeg} onChange={onField('zSeg')} />
              <button className="btn btn-s" type="button" title="Inverter sinal (+/-)" onClick={() => onToggleSign('zSeg')}>+/−</button>
            </div>
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-feed">Avanço (mm/min)</label>
            <input id="gv-feed" className="fi" type="number" inputMode="decimal" min="1" step="any" value={values.feed} onChange={onField('feed')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-rpm">Rotação do fuso (RPM)</label>
            <input id="gv-rpm" className="fi" type="number" inputMode="decimal" min="1" step="1" value={values.rpm} onChange={onField('rpm')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-tool">Ferramenta (número)</label>
            <input id="gv-tool" className="fi" type="number" inputMode="decimal" min="1" step="1" value={values.tool} onChange={onField('tool')} />
          </div>
          {blockDims && (
            <div className="info">Com bloco, X/Y é o canto inferior esquerdo do bloco.</div>
          )}
          <details className={styles.collapse}>
            <summary className={styles.collapseSummary}>Detalhes técnicos</summary>
            <div className={styles.collapseBody}>
              <div className="fg">
                <label className="fl" htmlFor="gv-x0">Ponto inicial X</label>
                <div className={styles.signRow}>
                  <input id="gv-x0" className="fi" type="text" inputMode="decimal" autoComplete="off" value={values.x0} onChange={onField('x0')} />
                  <button className="btn btn-s" type="button" title="Inverter sinal (+/-)" onClick={() => onToggleSign('x0')}>+/−</button>
                </div>
              </div>
              <div className="fg">
                <label className="fl" htmlFor="gv-y0">Ponto inicial Y</label>
                <div className={styles.signRow}>
                  <input id="gv-y0" className="fi" type="text" inputMode="decimal" autoComplete="off" value={values.y0} onChange={onField('y0')} />
                  <button className="btn btn-s" type="button" title="Inverter sinal (+/-)" onClick={() => onToggleSign('y0')}>+/−</button>
                </div>
              </div>
              <div className="fg">
                <label className="fl" htmlFor="gv-availw">Área disponível — largura (opcional)</label>
                <input id="gv-availw" className="fi" type="number" inputMode="decimal" min="0.1" step="any" value={values.availW} onChange={onField('availW')} />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="gv-availh">Área disponível — altura (opcional)</label>
                <input id="gv-availh" className="fi" type="number" inputMode="decimal" min="0.1" step="any" value={values.availH} onChange={onField('availH')} />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="gv-linefactor">Fator entrelinhas</label>
                <input id="gv-linefactor" className="fi" type="number" inputMode="decimal" min="1" step="any" value={values.lineFactor} onChange={onField('lineFactor')} />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="gv-zstart">Z início/fim</label>
                <input id="gv-zstart" className="fi" type="number" inputMode="decimal" step="any" value={values.zStart} onChange={onField('zStart')} />
              </div>
            </div>
          </details>
          {layout && !layout.ok && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{layout.error}</div>
          )}
          {program && !program.ok && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{program.error}</div>
          )}
        </Card>
      )}

      {aba === 'previa' && (
        <Card title="Prévia">
          {!layout ? (
            <div className="info">Ajuste os dados para visualizar.</div>
          ) : !layout.ok ? (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{layout.error}</div>
          ) : (
            <>
              <EngravingPreview
                strokes={placed.strokes}
                bounds={placed.bounds}
                block={blockDims ? {
                  x0: num(values.x0, 0),
                  y0: num(values.y0, 0),
                  blockW: blockDims.w,
                  blockH: blockDims.h,
                  margin: blockDims.margin,
                } : null}
                origin={{ x: num(values.x0, 0), y: num(values.y0, 0) }}
              />
              <div className={styles.stats}>
                {trim(placed.bounds.width)} × {trim(placed.bounds.height)} mm
                {' · '}{placed.stats.chars} caracteres
                {' · '}corte {trim(placed.stats.cutLength)} mm
              </div>
              {fit && (
                <>
                  {fit.fits ? (
                    <div className="info" style={{ color: 'var(--green)' }}>Cabe no bloco.</div>
                  ) : (
                    <div className="info" role="alert" style={{ color: 'var(--red)' }}>
                      Não cabe: {formatExcess(fit) || 'sem área útil'}
                    </div>
                  )}
                  <div className="info">
                    Altura máxima que cabe: {fit.maxHeight == null || !(fit.maxHeight > 0)
                      ? '— (não cabe em nenhuma altura)'
                      : `${trim(fit.maxHeight)} mm (limitada pela ${fit.limitedBy})`}
                  </div>
                  {fit.maxHeight > 0 && (
                    <div className="btn-row">
                      <button
                        className="btn btn-s"
                        type="button"
                        onClick={handleUsarMaxima}
                      >
                        {maxAtivo
                          ? `VOLTAR PARA ${maxAtivo.prev === '' ? 'anterior' : `${maxAtivo.prev} mm`}`
                          : 'USAR ALTURA MÁXIMA'}
                      </button>
                    </div>
                  )}
                </>
              )}
              {layout.value.warnings.map((w, i) => (
                <div key={i} className="info">{w}</div>
              ))}
            </>
          )}
        </Card>
      )}

      {aba === 'programa' && (
        <>
          {fit && !fit.fits && (
            <div className="info" role="alert" style={{ color: 'var(--red)', marginBottom: 8 }}>
              Não cabe no bloco: {formatExcess(fit) || 'sem área útil'} — o programa sai assim mesmo.
            </div>
          )}
          <ProgramDisplay program={program?.ok ? program.value : null} operationId="gravacao" />
        </>
      )}
    </div>
  );
}
