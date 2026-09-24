import styles from './HuronPage.module.css';

const FIELDS = {
  A: { label: 'A — inclinação YZ (°)', step: 'any' },
  B: { label: 'B — inclinação XZ (°)', step: 'any' },
  C: { label: 'C — inclinação XY (°)', step: 'any' },
};

function toggleSign(raw, onFieldChange, id) {
  const s = String(raw ?? '');
  if (s === '') { onFieldChange(id, '-'); return; }
  if (s === '-') { onFieldChange(id, ''); return; }
  const n = Number(s.replace(',', '.'));
  onFieldChange(id, Number.isFinite(n) ? String(-n) : '');
}

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
      <span className={styles.inputRow}>
        <button
          type="button"
          className={styles.signBtn}
          title="Inverter sinal (+/-)"
          onClick={() => toggleSign(value, onFieldChange, id)}
        >
          +/−
        </button>
        <input
          className={styles.input}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onFieldChange(id, e.target.value)}
        />
      </span>
      {err && <span className={styles.msg}>{err.message}</span>}
    </label>
  );
}

export default function HuronForm({ values, errors, validOverall, onChange, onCalculate, onClear }) {
  const handleField = (id, raw) => onChange(id, raw);

  return (
    <>
      <div className="info">Ângulos do 3D ROT da máquina, em graus (mesma convenção da tela real).</div>
      <div className={styles.grid}>
        {['A', 'B', 'C'].map((id) => (
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
      <div className="btn-row">
        <button className="btn btn-p" onClick={onCalculate}>CALCULAR</button>
        <button className="btn btn-s" onClick={onClear}>LIMPAR</button>
      </div>
    </>
  );
}
