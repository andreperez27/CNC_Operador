import { useState, useEffect, useMemo } from 'react';
import Card from '../../components/Card';
import ProgramDisplay from '../heidenhain/components/ProgramDisplay';
import { getFont } from '../../core/engraving/fontRepository';
import { layoutText } from '../../core/engraving/layout';
import { fitInBlock, anchorInBlock, formatExcess } from '../../core/engraving/fit';
import { grooveWidth, resolveGrooveWidth, effectiveMargin, describeTool } from '../../core/engraving/groove';
import { plungeWarning, effectivePlunge, effectiveApproach } from '../../core/engraving/toolpath';
import { analyzeLegibility, minLegibleHeight, viableRange, canExport, describeWorst } from '../../core/engraving/legibility';
import { toggleSignText } from './components/engravingPaths';
import { buildEngravingProgram } from '../../core/engraving/emitHeidenhain';
import { buildEngravingFileName, sanitizeProgramName } from '../../core/postprocessors/programName';
import EngravingPreview from './components/EngravingPreview';
import styles from './GravadorPage.module.css';

const FONT_SLUG = 'traco-simples-10';

const VEE_ANGLES = [10, 15, 20, 25, 30, 40, 45, 60, 90];

const LIMITS_TEXT = 'O resultado também depende de material, batimento, deflexão, desgaste, condições de corte e da geometria real da ferramenta, que pode diferir da nominal. A análise é geométrica e não substitui a simulação da máquina.';

const ABAS = [
  { id: 'texto', label: 'Texto' },
  { id: 'ferramenta', label: 'Ferramenta' },
  { id: 'bloco', label: 'Bloco' },
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
// programa Heidenhain .H absoluto (fonte v2, sem ISO e sem incremental).
export default function GravadorPage() {
  const [values, setValues] = useState({
    text: 'CNC OPERADOR',
    height: '10',
    spacing: '0',
    x0: '0',
    y0: '0',
    lineFactor: '1.6',
    availW: '',
    availH: '',
    toolKind: 'vee',
    toolDiam: '1',
    veeAngle: '60',
    veeCustom: '',
    tipKind: 'flat',
    tipSize: '0.1',
    maxDiam: '',
    zSurf: '0',
    depth: '0.2',
    measured: '',
    plunge: '',
    approach: '2',
    zSeg: '10',
    feed: '500',
    rpm: '1000',
    tool: '2',
    zStart: '100',
    blockW: '',
    blockH: '',
    margin: '0',
    center: true,
    fileName: '',
  });
  const [aba, setAba] = useState('texto');
  const [previewMode, setPreviewMode] = useState('usinado');
  const [ack, setAck] = useState({ key: null, ok: false });
  const [font, setFont] = useState(null);
  const [fontError, setFontError] = useState(null);
  // Altura máxima aplicada como liga/desliga: guarda a altura anterior
  // para reverter. Editar a altura manualmente desliga (usuário assumiu).
  const [maxAtivo, setMaxAtivo] = useState(null);
  // Mesmo esquema p/ o bloco ajustado ao texto: guarda bloco anterior.
  const [blocoAtivo, setBlocoAtivo] = useState(null);

  useEffect(() => {
    let live = true;
    getFont(FONT_SLUG)
      .then((f) => { if (live) setFont(f); })
      .catch(() => { if (live) setFontError('Não foi possível carregar a fonte de gravação.'); });
    return () => { live = false; };
  }, []);

  const onField = (id) => (e) => {
    const v = e.target.value;
    if ((id === 'blockW' || id === 'blockH') && blocoAtivo) setBlocoAtivo(null);
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

  // Atalho: mergulho como percentual do corte (campo segue editavel).
  const setPlungePct = (p) => {
    const f = num(values.feed, NaN);
    if (!(f > 0)) return;
    setValues((prev) => ({ ...prev, plunge: String(Number((f * p / 100).toFixed(3))) }));
  };

  const plungeHint = plungeWarning(
    num(values.feed, NaN),
    values.plunge === '' ? null : num(values.plunge, NaN),
  );

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

  // Bloco: ajusta as dimensões ao texto NO TAMANHO ATUAL (tinta + 2×margem
  // efetiva), com volta igual ao ajuste da fonte. Editar o bloco à mão
  // desliga a volta (usuário assumiu).
  const handleAjustarBloco = () => {
    if (!layout?.ok) return;
    if (blocoAtivo) {
      setValues((prev) => ({ ...prev, blockW: blocoAtivo.prevW, blockH: blocoAtivo.prevH }));
      setBlocoAtivo(null);
      return;
    }
    const m = blockDims
      ? blockDims.margin
      : effectiveMargin(Math.max(0, num(values.margin, 0)), groove.ok ? groove.width : null);
    const b = layout.value.bounds;
    setBlocoAtivo({ prevW: values.blockW, prevH: values.blockH });
    setValues((prev) => ({
      ...prev,
      blockW: trim(b.width + 2 * m),
      blockH: trim(b.height + 2 * m),
    }));
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

  // Ferramenta montada dos campos (pura; erro explica o motivo).
  const toolInfo = useMemo(() => {
    try {
      const maxD = values.maxDiam === '' ? null : num(values.maxDiam, NaN);
      const extra = maxD === null ? {} : { maxDiameter: maxD };
      let tool;
      if (values.toolKind === 'flat') {
        tool = { type: 'flat', diameter: num(values.toolDiam, NaN), ...extra };
      } else if (values.toolKind === 'ball') {
        tool = { type: 'ball', diameter: num(values.toolDiam, NaN), ...extra };
      } else {
        const angle = values.veeAngle === 'outro' ? num(values.veeCustom, NaN) : Number(values.veeAngle);
        const tip = values.tipSize === '' ? NaN : num(values.tipSize, NaN);
        tool = values.tipKind === 'flat'
          ? { type: 'vee', angle, tipDiameter: tip, ...extra }
          : { type: 'vee', angle, radius: tip, ...extra };
      }
      // Valida já (grooveWidth valida de novo no cálculo).
      grooveWidth(tool, 0.1);
      return { ok: true, tool };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [values.toolKind, values.toolDiam, values.veeAngle, values.veeCustom, values.tipKind, values.tipSize, values.maxDiam]);

  // Largura do risco: calculada da ferramenta+profundidade, ou a medida.
  const groove = useMemo(() => {
    if (!toolInfo.ok) return { ok: false, error: toolInfo.error };
    const depth = num(values.depth, NaN);
    if (!(depth > 0)) {
      return { ok: false, warning: 'Profundidade deve ser maior que zero para cortar (aviso, sem estimar largura).' };
    }
    try {
      const calc = grooveWidth(toolInfo.tool, depth);
      return { ok: true, calc, width: resolveGrooveWidth(values.measured, calc), depth };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [toolInfo, values.depth, values.measured]);

  const zSurf = num(values.zSurf, 0);
  const zGrav = groove.ok ? zSurf - groove.depth : zSurf;

  // Efetivos que saem no .H (iguais aos do nucleo, inclusive no automatico).
  const feedNum = num(values.feed, NaN);
  const effPlunge = effectivePlunge(feedNum, values.plunge === '' ? null : num(values.plunge, NaN));
  const effApproach = effectiveApproach(zGrav, values.approach === '' ? null : num(values.approach, NaN));
  const plungeAuto = values.plunge === '';
  const approachAuto = values.approach === '';

  // Bloco definido = largura e altura preenchidas e válidas. Margem efetiva:
  // maior entre a digitada e metade do risco (quando calculado).
  const blockDims = useMemo(() => {
    const w = optNum(values.blockW);
    const h = optNum(values.blockH);
    if (w === null || h === null || !(w > 0 && h > 0)) return null;
    return { w, h, margin: effectiveMargin(Math.max(0, num(values.margin, 0)), groove.ok ? groove.width : null) };
  }, [values.blockW, values.blockH, values.margin, groove]);

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

  // Diagnóstico de legibilidade sobre a geometria final + altura mínima
  // legível (bisseção) e faixa viável (mínima → máxima do bloco).
  const diag = useMemo(() => {
    if (!font || !placed || !groove.ok) return null;
    try {
      const a = analyzeLegibility(placed, groove.width);
      const min = minLegibleHeight({
        text: values.text,
        font,
        letterSpacing: num(values.spacing, 0),
        grooveWidth: groove.width,
      });
      return { ok: true, ...a, minLeg: min };
    } catch (e) {
      return { ok: false, error: e.message };
    }
  }, [font, placed, groove, values.text, values.spacing]);

  const viable = diag && diag.ok && diag.minLeg.legible && fit && fit.maxHeight > 0
    ? viableRange(diag.minLeg.height, fit.maxHeight)
    : null;

  // Faixa vazia (mínima além da máxima, ou ilegível) ou diagnóstico
  // vermelho: nunca dizer "Cabe no bloco" em verde.
  const rangeEmpty = !!fit && !!diag && diag.ok && (!diag.minLeg.legible || !viable || !viable.viable);
  const hideFits = rangeEmpty || (!!diag && diag.ok && diag.nivel === 'vermelho');

  const diagKey = diag && diag.ok
    ? `${diag.nivel}|${String(diag.folgaMinima)}|${values.text}|${groove.ok ? groove.width : 'x'}`
    : 'sem-diag';
  const exportOk = diag && diag.ok ? canExport(diag.nivel, ack.key === diagKey && ack.ok) : true;

  // Nome do .H: sugestão pelo texto (5 letras + _MMAA); o operador pode
  // ajustar antes de gerar. Vale igual p/ o arquivo e p/ o BEGIN/END PGM.
  const suggestedName = useMemo(() => buildEngravingFileName(values.text), [values.text]);
  const effName = values.fileName.trim() !== ''
    ? (sanitizeProgramName(values.fileName) || suggestedName)
    : suggestedName;

  const program = useMemo(() => {
    if (!placed) return null;
    try {
      return {
        ok: true,
        value: buildEngravingProgram({
          layout: placed,
          machining: {
            zGravacao: zGrav,
            zSeguranca: num(values.zSeg, 10),
            feed: num(values.feed, 500),
            rpm: num(values.rpm, 1000),
            ferramenta: num(values.tool, 2),
            zInicio: num(values.zStart, 100),
            plungeFeed: values.plunge === '' ? null : num(values.plunge, NaN),
            approach: values.approach === '' ? null : num(values.approach, NaN),
          },
          fontMeta: { slug: font.font.slug, version: font.font.version, name: font.font.name },
          programName: effName,
          tooling: toolInfo.ok ? {
            description: describeTool(toolInfo.tool),
            depth: groove.ok ? groove.depth : null,
            zSurf,
            width: groove.ok ? groove.width : null,
            measured: groove.ok && values.measured !== '',
            folga: diag && diag.ok ? diag.folgaMinima : null,
            nivel: diag && diag.ok ? diag.nivel : null,
            pior: diag && diag.ok ? diag.pior : null,
          } : null,
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
  }, [placed, blockDims, fit, font, values, zGrav, toolInfo, groove, zSurf, diag, effName]);

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

      {aba === 'texto' && (
        <Card title="Texto">
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
            <label className="fl" htmlFor="gv-height">Tamanho da fonte (mm)</label>
            <input id="gv-height" className="fi" type="number" inputMode="decimal" min="0.1" step="any" value={values.height} onChange={onHeight} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-spacing">Espaçamento extra (mm, sem escala)</label>
            <input id="gv-spacing" className="fi" type="number" inputMode="decimal" step="any" value={values.spacing} onChange={onField('spacing')} />
          </div>
          {font && (
            <div className="info">
              Fonte {font.font.slug} v{font.font.version} — {font.glyphs.length} caracteres suportados:
              {' '}{font.glyphs.map((g) => (g.char === ' ' ? '␣' : g.char)).join(' ')}
            </div>
          )}
          {layout && !layout.ok && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{layout.error}</div>
          )}
          {program && !program.ok && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{program.error}</div>
          )}
        </Card>
      )}

      {aba === 'ferramenta' && (
        <Card title="Ferramenta">
          <div className="fg">
            <label className="fl" htmlFor="gv-toolkind">Tipo de ferramenta</label>
            <select id="gv-toolkind" className="fi" value={values.toolKind} onChange={onField('toolKind')}>
              <option value="flat">Fresa de topo</option>
              <option value="ball">Fresa esférica</option>
              <option value="vee">Fresa de gravação V</option>
            </select>
          </div>
          {values.toolKind !== 'vee' && (
            <div className="fg">
              <label className="fl" htmlFor="gv-tooldiam">Diâmetro (mm)</label>
              <input id="gv-tooldiam" className="fi" type="number" inputMode="decimal" min="0.01" step="any" value={values.toolDiam} onChange={onField('toolDiam')} />
            </div>
          )}
          {values.toolKind === 'vee' && (
            <>
              <div className="fg">
                <label className="fl" htmlFor="gv-angle">Ângulo da ponta (graus, incluído)</label>
                <select id="gv-angle" className="fi" value={values.veeAngle} onChange={onField('veeAngle')}>
                  {VEE_ANGLES.map((a) => (
                    <option key={a} value={String(a)}>{a}°</option>
                  ))}
                  <option value="outro">Outro…</option>
                </select>
              </div>
              {values.veeAngle === 'outro' && (
                <div className="fg">
                  <label className="fl" htmlFor="gv-custom">Ângulo personalizado (0 a 180)</label>
                  <input id="gv-custom" className="fi" type="number" inputMode="decimal" min="0.1" max="179.9" step="any" value={values.veeCustom} onChange={onField('veeCustom')} />
                </div>
              )}
              <div className="fg">
                <label className="fl" htmlFor="gv-tipkind">Formato da ponta</label>
                <select id="gv-tipkind" className="fi" value={values.tipKind} onChange={onField('tipKind')}>
                  <option value="flat">Plana (padrão, diâmetro da ponta)</option>
                  <option value="round">Arredondada (raio da ponta)</option>
                </select>
              </div>
              <div className="fg">
                <label className="fl" htmlFor="gv-tipsize">
                  {values.tipKind === 'flat' ? 'Diâmetro da ponta (mm)' : 'Raio da ponta (mm)'}
                </label>
                <input id="gv-tipsize" className="fi" type="number" inputMode="decimal" min="0" step="any" value={values.tipSize} onChange={onField('tipSize')} />
              </div>
            </>
          )}
          <div className="fg">
            <label className="fl" htmlFor="gv-maxdiam">Diâmetro máximo (opcional; no V o padrão é a haste 3,175)</label>
            <input id="gv-maxdiam" className="fi" type="number" inputMode="decimal" min="0.01" step="any" value={values.maxDiam} onChange={onField('maxDiam')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-zsurf">Z da superfície da peça</label>
            <div className={styles.signRow}>
              <input id="gv-zsurf" className="fi" type="text" inputMode="decimal" autoComplete="off" value={values.zSurf} onChange={onField('zSurf')} />
              <button className="btn btn-s" type="button" title="Inverter sinal (+/-)" onClick={() => onToggleSign('zSurf')}>+/−</button>
            </div>
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-depth">Profundidade (mm)</label>
            <input id="gv-depth" className="fi" type="number" inputMode="decimal" min="0" step="any" value={values.depth} onChange={onField('depth')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-feed">Avanço (mm/min)</label>
            <input id="gv-feed" className="fi" type="number" inputMode="decimal" min="1" step="any" value={values.feed} onChange={onField('feed')} />
          </div>
          <div className="info">Z de gravação (calculado): {Number.isFinite(zGrav) ? `${trim(zGrav)} mm` : '—'}</div>
          <div className="fg">
            <label className="fl" htmlFor="gv-measured">Largura do risco medida (opcional, calibra com a peça)</label>
            <input id="gv-measured" className="fi" type="number" inputMode="decimal" min="0.01" step="any" value={values.measured} onChange={onField('measured')} />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-plunge">Avanco de mergulho (mm/min, vazio = 25% do corte)</label>
            <input id="gv-plunge" className="fi" type="number" inputMode="decimal" min="0.01" step="any" value={values.plunge} onChange={onField('plunge')} />
          </div>
          <div className="btn-row" role="group" aria-label="Atalho percentual do corte">
            {[10, 15, 25, 30].map((p) => (
              <button key={p} className="btn btn-s" type="button" onClick={() => setPlungePct(p)}>
                {p}% do corte
              </button>
            ))}
          </div>
          {plungeHint && (
            <div className="info" role="status">{plungeHint}</div>
          )}
          <div className="fg">
            <label className="fl" htmlFor="gv-approach">Altura de aproximacao (mm, padrao 2 acima da superficie)</label>
            <input id="gv-approach" className="fi" type="number" inputMode="decimal" min="0.1" step="any" value={values.approach} onChange={onField('approach')} />
          </div>
          <div className="info">
            Mergulho efetivo: {Number.isFinite(effPlunge) ? `${trim(effPlunge)} mm${plungeAuto ? ' (automatico 25%)' : ''}` : '-'}
            {' - '}Aproximacao efetiva: {Number.isFinite(effApproach) ? `Z ${trim(effApproach)}${approachAuto ? ' (automatica)' : ''}` : '-'}
          </div>
          <div className="fg">
            <label className="fl" htmlFor="gv-zseg">Z de segurança</label>
            <div className={styles.signRow}>
              <input id="gv-zseg" className="fi" type="text" inputMode="decimal" autoComplete="off" value={values.zSeg} onChange={onField('zSeg')} />
              <button className="btn btn-s" type="button" title="Inverter sinal (+/-)" onClick={() => onToggleSign('zSeg')}>+/−</button>
            </div>
          </div>
          {!toolInfo.ok && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{toolInfo.error}</div>
          )}
          {groove.ok === false && toolInfo.ok && (
            <div className="info" role="alert" style={{ color: groove.warning ? undefined : 'var(--red)' }}>
              {groove.warning || groove.error}
            </div>
          )}
          {groove.ok && (
            <div className="info">
              Largura do risco: {trim(groove.width)} mm ({values.measured !== '' ? 'medida' : 'calculada'})
              {groove.width !== groove.calc ? ` — calculada seria ${trim(groove.calc)} mm` : ''}
            </div>
          )}
          {diag && diag.ok && (
            <div className="info" role="status">
              Diagnóstico:{' '}
              <span style={{ color: diag.nivel === 'verde' ? 'var(--green)' : diag.nivel === 'amarelo' ? '#d97706' : 'var(--red)', fontWeight: 700 }}>
                {diag.nivel.toUpperCase()}
              </span>
              {' '}— folga mínima {Number.isFinite(diag.folgaMinima) ? `${trim(diag.folgaMinima)} mm` : '— (sem pares)'}
              {describeWorst(diag.pior) ? ` (pior ponto: ${describeWorst(diag.pior)})` : ''}
              {diag.minLeg.legible
                ? ` · altura mínima legível ${trim(diag.minLeg.height)} mm`
                : ' · ilegível com esta ferramenta e profundidade'}
              {viable ? (viable.viable ? ' · faixa viável OK' : ' · faixa viável VAZIA: use ferramenta mais fina ou menos profundidade') : ''}
              {diag.alertas.slice(0, 3).map((a, i) => (
                <div key={i}>• {a.causa} {a.sugestao}</div>
              ))}
              <div>{LIMITS_TEXT}</div>
            </div>
          )}
          {diag && !diag.ok && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{diag.error}</div>
          )}
        </Card>
      )}

      {aba === 'bloco' && (
        <Card title="Bloco">
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
          {blockDims && (
            <div className="info">Com bloco, X/Y é o canto inferior esquerdo do bloco.</div>
          )}
          {fit && (
            <>
              {hideFits ? (
                <div className="info" role="alert" style={{ color: 'var(--red)', fontWeight: 700 }}>
                  Faixa viável vazia: mínima legível{' '}
                  {diag.minLeg.legible ? `${trim(diag.minLeg.height)} mm` : '— (ilegível com esta ferramenta e profundidade)'}
                  {diag.minLeg.legible ? `, máxima que cabe ${trim(fit.maxHeight)} mm` : ` (máxima que cabe ${trim(fit.maxHeight)} mm)`}.
                  Com esta ferramenta e profundidade o texto não fica legível neste bloco.
                </div>
              ) : fit.fits ? (
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
                </>
          )}
          {layout?.ok && (
            <div className="btn-row">
              <button
                className="btn btn-s"
                type="button"
                onClick={handleAjustarBloco}
              >
                {blocoAtivo
                  ? `VOLTAR PARA ${(blocoAtivo.prevW === '' && blocoAtivo.prevH === '') ? 'anterior' : `${blocoAtivo.prevW || '—'}x${blocoAtivo.prevH || '—'}`}`
                  : 'AJUSTAR BLOCO AO TEXTO'}
              </button>
            </div>
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
                <div className="fg">
                  <label className="fl" htmlFor="gv-rpm">Rotação do fuso (RPM)</label>
                <input id="gv-rpm" className="fi" type="number" inputMode="decimal" min="1" step="1" value={values.rpm} onChange={onField('rpm')} />
              </div>
              <div className="fg">
                <label className="fl" htmlFor="gv-tool">Ferramenta (número)</label>
                <input id="gv-tool" className="fi" type="number" inputMode="decimal" min="1" step="1" value={values.tool} onChange={onField('tool')} />
              </div>
            </div>
          </details>
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
              <div className={styles.tabs} role="tablist" aria-label="Modo da prévia">
                {[{ id: 'trajeto', label: 'Trajetória' }, { id: 'usinado', label: 'Área usinada' }].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={previewMode === m.id}
                    className={`${styles.tab} ${previewMode === m.id ? styles.tabActive : ''}`}
                    onClick={() => setPreviewMode(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
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
                grooveWidthMm={previewMode === 'usinado' && groove.ok ? groove.width : null}
                critical={previewMode === 'usinado' && diag && diag.ok && diag.pior ? diag.pior.posicao : null}
              />
              <div className={styles.stats}>
                {trim(placed.bounds.width)} × {trim(placed.bounds.height)} mm
                {' · '}{placed.stats.chars} caracteres
                {' · '}corte {trim(placed.stats.cutLength)} mm
                {groove.ok && diag && diag.ok && (
                  <>
                    {' · '}risco {trim(groove.width)} mm
                    {toolInfo.ok ? ` (${describeTool(toolInfo.tool)}, prof ${trim(groove.depth)} mm)` : ''}
                    {' · '}folga {Number.isFinite(diag.folgaMinima) ? `${trim(diag.folgaMinima)} mm` : '—'}
                    {' · '}mín legível {diag.minLeg.legible ? `${trim(diag.minLeg.height)} mm` : '—'}
                    {fit && fit.maxHeight > 0 ? ` · máx bloco ${trim(fit.maxHeight)} mm` : ''}
                  </>
                )}
              </div>
              <div className="btn-row">
                {fit && fit.maxHeight > 0 && (
                  <button
                    className="btn btn-s"
                    type="button"
                    onClick={handleUsarMaxima}
                  >
                    {maxAtivo
                      ? `VOLTAR PARA ${maxAtivo.prev === '' ? 'anterior' : `${maxAtivo.prev} mm`}`
                      : 'USAR ALTURA MÁXIMA'}
                  </button>
                )}
                <button
                  className="btn btn-s"
                  type="button"
                  onClick={handleAjustarBloco}
                >
                  {blocoAtivo
                    ? `VOLTAR PARA ${(blocoAtivo.prevW === '' && blocoAtivo.prevH === '') ? 'anterior' : `${blocoAtivo.prevW || '—'}x${blocoAtivo.prevH || '—'}`}`
                    : 'AJUSTAR BLOCO AO TEXTO'}
                </button>
              </div>
              {layout.value.warnings.map((w, i) => (
                <div key={i} className="info">{w}</div>
              ))}
            </>
          )}
        </Card>
      )}

      {aba === 'programa' && (
        <>
          <div className="fg">
            <label className="fl" htmlFor="gv-filename">Nome do arquivo (vazio = automático)</label>
            <input
              id="gv-filename"
              className="fi"
              type="text"
              inputMode="text"
              autoComplete="off"
              placeholder={suggestedName}
              value={values.fileName}
              onChange={onField('fileName')}
            />
          </div>
          <div className="info">Arquivo e programa: {effName}.H</div>          {fit && !fit.fits && (
            <div className="info" role="alert" style={{ color: 'var(--red)', marginBottom: 8 }}>
              Não cabe no bloco: {formatExcess(fit) || 'sem área útil'} — o programa sai assim mesmo.
            </div>
          )}
          {diag && diag.ok && diag.nivel === 'amarelo' && (
            <div className="info" role="alert" style={{ color: '#d97706', marginBottom: 8 }}>
              Diagnóstico amarelo (folga {trim(diag.folgaMinima)} mm
              {describeWorst(diag.pior) ? `, ${describeWorst(diag.pior)}` : ''}): prossiga com atenção — a exportação segue liberada.
            </div>
          )}
          {diag && diag.ok && diag.nivel === 'vermelho' && (
            <>
              <div className="info" role="alert" style={{ color: 'var(--red)', marginBottom: 8 }}>
                Diagnóstico vermelho (folga {trim(diag.folgaMinima)} mm
                {describeWorst(diag.pior) ? `, ${describeWorst(diag.pior)}` : ''}): traços ou letras fundidos.
                Para baixar ou copiar, confirme abaixo.
              </div>
              <div className="fg">
                <label className="fl" htmlFor="gv-ack">
                  <input
                    id="gv-ack"
                    type="checkbox"
                    checked={ack.key === diagKey && ack.ok}
                    onChange={(e) => setAck({ key: diagKey, ok: e.target.checked })}
                    style={{ marginRight: 8 }}
                  />
                  Estou ciente do risco e quero exportar assim mesmo.
                </label>
              </div>
            </>
          )}
          <ProgramDisplay
            program={program?.ok ? program.value : null}
            operationId="gravacao"
            fileName={effName}
            exportLocked={!exportOk}
            lockNote={!exportOk ? 'Exportação bloqueada: confirme o risco acima.' : null}
          />
        </>
      )}
    </div>
  );
}
