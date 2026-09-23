import styles from '../RoscasPage.module.css';
import {
  CUSTOM_RULE_ID,
  BLIND_HOLE_REFERENCES,
  BLIND_HOLE_REFERENCE_LABELS,
  listBlindHoleRules,
} from '../../../core/process/rules/blindHoleDepth';

const MACHINING_FIELDS = [
  { id: 'toolNumber', label: 'Ferramenta (nº)', min: 0, step: '1' },
  { id: 'rpm', label: 'RPM', min: 1, step: '1' },
  { id: 'safety', label: 'Distância de segurança (mm)', min: 0, step: 'any' },
  { id: 'zStart', label: 'Posição inicial Z (topo da rosca)', min: -999, step: 'any' },
];

const HELICAL_FIELDS = [
  { id: 'toolDiameter', label: 'Diam. ferramenta de roscar (mm)', min: 0.1, step: 'any' },
  { id: 'feed', label: 'Avanço de usinagem (mm/min)', min: 1, step: '1' },
];

const RULES = listBlindHoleRules();

function fmt(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—';
  return Number(v).toFixed(2).replace('.', ',') + ' mm';
}

function Field({ id, label, value, err, validOverall, min, step, onChange }) {
  const showOk = validOverall && !err;
  return (
    <label className={`${styles.field} ${err ? styles.fieldError : ''}`}>
      <span className={styles.label}>
        {label}
        {err ? <span className={styles.badgeX}>❌</span> : showOk ? <span className={styles.badgeOk}>✓</span> : null}
      </span>
      <input
        className={styles.input}
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        step={step}
        onChange={(e) => onChange(id, e.target.value)}
      />
      {err && <span className={styles.msg}>{err.message}</span>}
    </label>
  );
}

export default function ThreadForm({ thread, values, errors, validOverall, onChange, hole, onUseSuggestion }) {
  const isHelical = thread.method === 'helical';
  const isCustom = values.holeRule === CUSTOM_RULE_ID;

  const err = (field) => errors.find((e) => e.field === field);
  const handleField = (id, raw) => onChange(id, raw === '' ? '' : Number(raw));

  const suggested = hole && hole.suggested != null ? Number(hole.suggested) : null;
  const finalDepth = values.holeDepth == null || values.holeDepth === '' ? null : Number(values.holeDepth);
  const suggestionUsed = suggested !== null && finalDepth !== null && Math.abs(finalDepth - suggested) < 1e-9;

  const ruleLabel = isCustom
    ? (Number(values.customFactor) > 0
      ? String(Number(values.customFactor)).replace('.', ',') + ' × '
        + (BLIND_HOLE_REFERENCE_LABELS[values.customReference] || '—')
      : 'Personalizada')
    : (RULES.find((r) => r.id === values.holeRule)?.name || '—');

  const sugErr = err('profundidadeFuro');
  const ruleErr = err('regra');
  const marginErr = err('margem');
  const factorErr = err('fator');
  const refErr = err('referencia');

  return (
    <form className={styles.form} onSubmit={(e) => e.preventDefault()}>
      {/* ── FURO CEGO — geometria + profundidade ── */}
      <div className={styles.sectionLabel}>Furo cego — geometria e profundidade</div>

      <div className={styles.threadInfoGrid}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Ø nominal</span>
          <span className={styles.infoValue}>{fmt(thread.nominal)}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Passo</span>
          <span className={styles.infoValue}>{fmt(thread.pitch)}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Ø broca (furo prévio)</span>
          <span className={styles.infoValue}>{fmt(thread.hole)}</span>
        </div>
      </div>

      <Field
        id="depth"
        label="Profundidade da rosca (mm)"
        value={values.depth ?? ''}
        err={err('profundidade')}
        validOverall={validOverall}
        min={0.1}
        step="any"
        onChange={handleField}
      />

      <label className={`${styles.field} ${ruleErr ? styles.fieldError : ''}`}>
        <span className={styles.label}>
          Regra do furo
          {ruleErr ? <span className={styles.badgeX}>❌</span> : <span className={styles.badgeOk}>✓</span>}
        </span>
        <select
          className={styles.input}
          value={values.holeRule}
          onChange={(e) => onChange('holeRule', e.target.value)}
        >
          {RULES.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
          <option value={CUSTOM_RULE_ID}>Personalizada</option>
        </select>
        {ruleErr && <span className={styles.msg}>{ruleErr.message}</span>}
      </label>

      {isCustom && (
        <div className={styles.customRuleRow}>
          <label className={`${styles.field} ${factorErr ? styles.fieldError : ''}`}>
            <span className={styles.label}>
              Fator
              {factorErr ? <span className={styles.badgeX}>❌</span> : <span className={styles.badgeOk}>✓</span>}
            </span>
            <input
              className={styles.input}
              type="number"
              inputMode="decimal"
              min={0.1}
              step="any"
              value={values.customFactor ?? ''}
              onChange={(e) => handleField('customFactor', e.target.value)}
            />
            {factorErr && <span className={styles.msg}>{factorErr.message}</span>}
          </label>
          <label className={`${styles.field} ${refErr ? styles.fieldError : ''}`}>
            <span className={styles.label}>
              Referência
              {refErr ? <span className={styles.badgeX}>❌</span> : <span className={styles.badgeOk}>✓</span>}
            </span>
            <select
              className={styles.input}
              value={values.customReference}
              onChange={(e) => onChange('customReference', e.target.value)}
            >
              <option value={BLIND_HOLE_REFERENCES.THREAD_DIAMETER}>Ø da rosca</option>
              <option value={BLIND_HOLE_REFERENCES.DRILL_DIAMETER}>Ø da broca</option>
            </select>
            {refErr && <span className={styles.msg}>{refErr.message}</span>}
          </label>
        </div>
      )}

      <div className={styles.suggestedBox}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Profundidade sugerida</span>
          <span className={styles.suggestedValue}>{fmt(suggested)}</span>
        </div>
        <div className={styles.suggestNote}>
          {ruleLabel} — sugestão pela regra de processo (origem: informada pelo usuário; não é
          norma ISO/ABNT). Referência usada: {isCustom
            ? (BLIND_HOLE_REFERENCE_LABELS[values.customReference] || '—')
            : (BLIND_HOLE_REFERENCE_LABELS[(RULES.find((r) => r.id === values.holeRule) || {}).reference] || '—')}.
        </div>
        <div className={styles.ruleHint}>Profundidade sugerida pela regra de processo.</div>
      </div>

      <Field
        id="holeMargin"
        label="Margem inferior do furo (mm)"
        value={values.holeMargin ?? ''}
        err={marginErr}
        validOverall={validOverall}
        min={0}
        step="any"
        onChange={handleField}
      />

      <div className={styles.finalDepthRow}>
        <Field
          id="holeDepth"
          label="Profundidade final do furo (mm)"
          value={values.holeDepth ?? ''}
          err={sugErr}
          validOverall={validOverall}
          min={0.1}
          step="any"
          onChange={handleField}
        />
        <button
          type="button"
          className={styles.miniBtn}
          onClick={onUseSuggestion}
          disabled={suggestionUsed || suggested === null}
        >
          usar sugestão
        </button>
      </div>
      <div className={styles.holeHint}>
        Profundidade total do furo ≥ profundidade da rosca (furo cego). A regra nunca altera a
        profundidade útil da rosca.
      </div>

      {/* ── USINAGEM ── */}
      <div className={styles.sectionLabel}>Parâmetros de usinagem</div>
      <div className={styles.grid}>
        {MACHINING_FIELDS.map((def) => (
          <Field
            key={def.id}
            id={def.id}
            label={def.label}
            value={values[def.id] ?? ''}
            err={err(def.id === 'toolNumber' ? 'ferramenta' : def.id === 'rpm' ? 'rpm' : def.id === 'safety' ? 'distanciaSeguranca' : 'posicaoInicial')}
            validOverall={validOverall}
            min={def.min}
            step={def.step}
            onChange={handleField}
          />
        ))}
      </div>

      {isHelical && (
        <>
          <div className={styles.grid}>
            {HELICAL_FIELDS.map((def) => (
              <Field
                key={def.id}
                id={def.id}
                label={def.label}
                value={values[def.id] ?? ''}
                err={err(def.id === 'toolDiameter' ? 'diamFerramenta' : 'av')}
                validOverall={validOverall}
                min={def.min}
                step={def.step}
                onChange={handleField}
              />
            ))}
            <label className={`${styles.field} ${err('sentido') ? styles.fieldError : ''}`}>
              <span className={styles.label}>
                Sentido de rotação
                {err('sentido') ? <span className={styles.badgeX}>❌</span> : <span className={styles.badgeOk}>✓</span>}
              </span>
              <select
                className={styles.input}
                value={values.direction}
                onChange={(e) => onChange('direction', e.target.value)}
              >
                <option value="cw">Horário (machos de mão direita)</option>
                <option value="ccw">Anti-horário</option>
              </select>
              {err('sentido') && <span className={styles.msg}>{err('sentido').message}</span>}
            </label>
          </div>
          <div className={styles.infoBox}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>Raio de interpolação</span>
              <span className={styles.infoValue}>
                {(thread.nominal - Number(values.toolDiameter || 0)) / 2 >= 0
                  ? (((thread.nominal - Number(values.toolDiameter || 0)) / 2).toFixed(2) + ' mm')
                  : '— inválido —'}
              </span>
            </div>
          </div>
        </>
      )}

      <div className={styles.infoBox}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Estratégia</span>
          <span className={styles.infoValue}>
            {isHelical ? 'Interpolação helicoidal' : 'Rosca rígida (CYCL DEF 207)'}
          </span>
        </div>
        {!isHelical && (
          <div className={styles.infoRow}>
            <span className={styles.infoLabel}>Avanço (auto)</span>
            <span className={styles.infoValue}>
              {Number(values.rpm || 0) * thread.pitch} mm/min
            </span>
          </div>
        )}
      </div>
    </form>
  );
}