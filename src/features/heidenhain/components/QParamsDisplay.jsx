import styles from './QParamsDisplay.module.css';

export default function QParamsDisplay({ qParams }) {
  if (!qParams?.list?.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.title}>Parametros Q</div>
        <div className={styles.empty}>Preencha os parametros para gerar Q</div>
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Parametros Q</div>
      <div className={styles.table}>
        {qParams.list.map(({ q, label, value }) => (
          <div key={q} className={styles.row}>
            <span className={styles.q}>{q}</span>
            <span className={styles.label}>{label}</span>
            <span className={styles.value}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
