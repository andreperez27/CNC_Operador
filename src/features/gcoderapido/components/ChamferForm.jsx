import styles from '../GCodeRapidoPage.module.css';
import { TOOL_TYPE_LIST } from '../../heidenhain/math/toolTypes';

const FIELDS = {
  L:    { label: 'Comprimento (mm)', min: 0.1, step: 'any' },
  C:    { label: 'Largura do chanfro (mm)', min: 0.1, step: 'any' },
  A:    { label: 'Angulo (graus)', min: 0.1, max: 89, step: 'any' },
  profundidade: { label: 'Profundidade total (opcional)', min: 0.1, step: 'any' },
  passeZ: { label: 'Profundidade por passe (mm)', min: 0.01, step: 'any' },
  D:    { label: 'Diametro D (mm)', min: 0.1, step: 'any' },
  r:    { label: 'Raio de canto r (mm)', min: 0, step: 'any' },
  alojamentoLargura: { label: 'Largura do bolsao (mm)', min: 0.1, step: 'any' },
  rpm:  { label: 'RPM', min: 1, step: '1' },
  av:   { label: 'Avanco (mm/min)', min: 1, step: '1' },
};

const ORIGIN_LABEL = {
  external: 'Vertice da regiao (aresta X0 / topo Z0)',
  internal: 'Canto do bolsao (parede X0 / fundo Z0)',
};

function Field({ id, value, errors, validOverall, onFieldChange }) {
  const def = FIELDS[id];
  const err = errors.find((e) => e.field === id);
  const showOk = validOverall && !err;

  return (
    <label className={`${styles.field} ${err ? styles.fieldError : ''}`}>
      <span className={styles.label}>
        {def.label}
        {err ? <span className={styles.badgeX}>❌</span> : showOk ? <span className={styles.badgeOk}>✓</span> : null}
      </span>
      <input
        className={styles.input}
        type="number"
        inputMode="decimal"
        value={value}
        min={def.min}
        max={def.max || undefined}
        step={def.step}
        onChange={(e) => onFieldChange(id, e.target.value)}
      />
      {err && <span className={styles.msg}>{err.message}</span>}
    </label>
  );
}

export default function ChamferForm({ values, errors, validOverall, onChange }) {
  const handleField = (id, raw) => onChange(id, raw === '' ? '' : Number(raw));
  const handleTool = (e) => onChange('toolType', e.target.value);
  const isInternal = values.tipo === 'internal';
  const isCircular = values.formato === 'circular';

  const visible = ['L', 'C', 'A', 'profundidade', 'passeZ'];
  if (isInternal) visible.push('alojamentoLargura');

  const showToolRadius = values.toolType === 'toroidal';
  const showToolD = values.toolType !== 'chamferMill';

  const toolErr = errors.find((e) => e.field === 'toolType');

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      <div className={styles.sectionLabel}>Formato da aresta</div>
      <div className={styles.tipoRow}>
        <button
          type="button"
          className={`${styles.opBtn} ${!isCircular ? styles.opBtnActive : ''}`}
          onClick={() => onChange('formato', 'reta')}
        >
          Reta
        </button>
        <span className={styles.tipoItem} title="chanfro/raio ao redor de furo ou ressalto circular, usando interpolacao CC/CP">
          <button
            type="button"
            className={`${styles.opBtn} ${isCircular ? styles.opBtnActive : ''} ${styles.opBtnDisabled}`}
            disabled
          >
            Circular <span className={styles.badgeSoon}>em breve</span>
          </button>
        </span>
      </div>

      <div className={styles.sectionLabel}>Tipo de chanfro</div>
      <div className={styles.tipoRow}>
        <button
          type="button"
          className={`${styles.opBtn} ${!isInternal ? styles.opBtnActive : ''}`}
          onClick={() => onChange('tipo', 'external')}
        >
          Externo
        </button>
        <button
          type="button"
          className={`${styles.opBtn} ${isInternal ? styles.opBtnActive : ''}`}
          onClick={() => onChange('tipo', 'internal')}
        >
          Interno (bolsao)
        </button>
      </div>

      <div className={styles.grid}>
        {visible.map((id) => (
          <Field
            key={id}
            id={id}
            value={values[id] ?? ''}
            errors={errors}
            validOverall={validOverall}
            onFieldChange={handleField}
          />
        ))}
      </div>

      <div className={styles.sectionLabel}>Ferramenta</div>
      <label className={`${styles.field} ${toolErr ? styles.fieldError : ''}`}>
        <span className={styles.label}>
          Tipo de ferramenta
          {toolErr ? <span className={styles.badgeX}>❌</span> : showToolRadius ? <span className={styles.badgeOk}>✓</span> : null}
        </span>
        <select className={styles.input} value={values.toolType} onChange={handleTool}>
          {TOOL_TYPE_LIST.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
        {toolErr && <span className={styles.msg}>{toolErr.message}</span>}
      </label>

      <div className={styles.grid}>
        {showToolD && (
          <Field key="D" id="D" value={values.D} errors={errors} validOverall={validOverall} onFieldChange={handleField} />
        )}
        {showToolRadius && (
          <Field key="r" id="r" value={values.r} errors={errors} validOverall={validOverall} onFieldChange={handleField} />
        )}
        <Field id="rpm" value={values.rpm} errors={errors} validOverall={validOverall} onFieldChange={handleField} />
        <Field id="av" value={values.av} errors={errors} validOverall={validOverall} onFieldChange={handleField} />
      </div>

      <div className={styles.infoBox}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Plano</span>
          <span className={styles.infoValue}>XZ</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Origem (zero peca)</span>
          <span className={styles.infoValue}>{ORIGIN_LABEL[values.tipo]}</span>
        </div>
      </div>
    </form>
  );
}