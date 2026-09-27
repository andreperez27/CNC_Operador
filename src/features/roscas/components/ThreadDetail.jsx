import styles from '../RoscasPage.module.css';

function num(v) {
  return Number(v).toFixed(2).replace('.', ',');
}

export default function ThreadDetail({ thread, suggestedDepth }) {
  // Só o que o operador precisa na hora: identificação + furo + passo.
  // Família/Norma/Fonte/Vc ficam no banco/docs, fora da tela.
  const rows = [
    ['Ø nominal', num(thread.nominal) + ' mm'],
    ['Passo', num(thread.pitch) + ' mm'],
  ];
  if (thread.tpi) {
    rows.push(['TPI', String(thread.tpi)]);
  }
  rows.push(['Ø furo', num(thread.hole) + ' mm']);
  const sug = Number(suggestedDepth);
  if (Number.isFinite(sug)) {
    rows.push(['Profundidade', num(sug) + ' mm']);
  }

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
    </div>
  );
}