import styles from '../RoscasPage.module.css';

function num(v) {
  return Number(v).toFixed(2).replace('.', ',');
}

export default function ThreadDetail({ thread }) {
  const rows = [
    ['Ø nominal', num(thread.nominal) + ' mm'],
    ['Passo', num(thread.pitch) + ' mm'],
    ['Ø furo', num(thread.hole) + ' mm'],
    ['Família', thread.familyId === 'fine' ? 'Métrica Fina' : 'Métrica ISO'],
    ['Estratégia', thread.method === 'rigid' ? 'Rosca rígida' : 'Interpolação helicoidal'],
    ['Ciclo', thread.cycle === 207 ? 'CYCL DEF 207' : '— (helicoidal)'],
    ['Norma', thread.standard],
    ['Fonte', thread.source],
  ];

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <span className={styles.detailTitle}>ROSCA {thread.designation.toUpperCase()}</span>
      </div>
      <div className={styles.detailGrid}>
        {rows.map(([k, v]) => (
          <div key={k} className={styles.detailRow}>
            <span className={styles.detailKey}>{k}</span>
            <span className={styles.detailValue}>{v}</span>
          </div>
        ))}
      </div>
      {thread.recommendations?.length > 0 && (
        <div className={styles.vcRow}>
          <span className={styles.vcLabel}>Vc recomendado:</span>
          {thread.recommendations.map((r) => (
            <span key={r.material} className={styles.vcChip}>
              {r.material} {r.vc} m/min
            </span>
          ))}
        </div>
      )}
    </div>
  );
}