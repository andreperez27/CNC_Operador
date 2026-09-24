import styles from './HomePage.module.css';

function RoscaIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M9 3h6v3l-1.5 1.5v9L12 20l-1.5-3.5v-9L9 6z" />
      <line x1="9" y1="10" x2="15" y2="10" />
      <line x1="9" y1="13" x2="15" y2="13" />
      <line x1="10" y1="16" x2="14" y2="16" />
    </svg>
  );
}

function TrianguloIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19L19 19L5 6z" />
      <path d="M5 15h4v4" />
    </svg>
  );
}

function GcodeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h7l9 9-7 7-9-9z" />
      <circle cx="9" cy="9" r="1.6" />
    </svg>
  );
}

function HuronIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
      <circle cx="12" cy="12" r="0.8" fill="currentColor" />
    </svg>
  );
}

const MODULES = [
  { id: 'roscas', title: 'Roscas', sub: 'Tabela métrica + programa .H', Icon: RoscaIcon },
  { id: 'trigonometria', title: 'Trigonometria', sub: 'Triângulo retângulo', Icon: TrianguloIcon },
  { id: 'gcoderapido', title: 'G-Code Rápido', sub: 'Chanfro e raio ext./int.', Icon: GcodeIcon },
  { id: 'huron', title: 'Cabeçote Huron', sub: 'Flanges do Portal Feller', Icon: HuronIcon },
];

export default function HomePage({ onNavigate }) {
  return (
    <div className="page">
      <div className={styles.hint}>Escolha um módulo</div>
      <div className={styles.grid}>
        {MODULES.map(({ id, title, sub, Icon }) => (
          <button key={id} type="button" className={styles.card} onClick={() => onNavigate(id)}>
            <span className={styles.icon}><Icon /></span>
            <span className={styles.title}>{title}</span>
            <span className={styles.sub}>{sub}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
