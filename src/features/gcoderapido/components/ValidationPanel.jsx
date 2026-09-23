import styles from './ValidationPanel.module.css';

const SEVERITY_LABEL = {
  ERROR: 'impeditivo',
  WARNING: 'aviso',
};

export default function ValidationPanel({ result }) {
  if (!result) return null;
  const { validation } = result;
  if (validation.errors.length === 0 && validation.warnings.length === 0) {
    if (!result.valid) return null;
    return (
      <div className={`${styles.panel} ${styles.ok}`}>
        <span className={styles.icon}>✓</span>
        <span>Parametros validos — modelo calculado sem erros ou avisos.</span>
      </div>
    );
  }

  const order = { ERROR: 0, WARNING: 1 };
  const items = [...validation.errors, ...validation.warnings]
    .map((e) => ({ ...e, severity: e.severity || 'ERROR' }))
    .sort((a, b) => order[a.severity] - order[b.severity]);

  return (
    <div className={`${styles.panel} ${validation.errors.length > 0 ? styles.bad : styles.warn}`}>
      {items.map((item, i) => (
        <div key={`${item.code}-${i}`} className={styles.item}>
          <span className={item.severity === 'ERROR' ? styles.iconBad : styles.iconWarn}>
            {item.severity === 'ERROR' ? '❌' : '⚠'}
          </span>
          <span className={styles.text}>
            <b>{item.field ? `${item.field}: ` : ''}</b>
            {item.message}
          </span>
          <span className={styles.severity}>[{item.code} · {SEVERITY_LABEL[item.severity]}]</span>
        </div>
      ))}
    </div>
  );
}