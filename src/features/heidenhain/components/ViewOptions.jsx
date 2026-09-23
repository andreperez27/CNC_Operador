import styles from './ViewOptions.module.css';

const OPTIONS = [
  { id: 'tool', label: 'Ferramenta' },
  { id: 'trajectory', label: 'Trajetoria' },
  { id: 'toolCenter', label: 'Centro da ferramenta' },
  { id: 'origin', label: 'Origem' },
  { id: 'startPoint', label: 'Ponto inicial' },
  { id: 'endPoint', label: 'Ponto final' },
  { id: 'passes', label: 'Passadas' },
  { id: 'rawProfile', label: 'Perfil bruto' },
  { id: 'finProfile', label: 'Perfil final' },
  { id: 'safety', label: 'Linha de seguranca' },
];

export default function ViewOptions({ options, onChange }) {
  const toggle = (id) => {
    onChange({ ...options, [id]: options?.[id] === false });
  };

  return (
    <div className={styles.panel}>
      <div className={styles.title}>Visualizacao</div>
      <div className={styles.grid}>
        {OPTIONS.map((o) => {
          const on = options?.[o.id] !== false;
          return (
            <button
              key={o.id}
              className={`${styles.btn} ${on ? styles.on : ''}`}
              onClick={() => toggle(o.id)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
