import styles from './NavTabs.module.css';

const TABS = [
  { id: 'roscas', label: 'Roscas' },
  { id: 'trigonometria', label: 'Trigon.' },
  { id: 'gcoderapido', label: 'G-Code Rapido' },
];

export default function NavTabs({ active, onChange }) {
  return (
    <nav className={styles.nav}>
      {TABS.map(tab => (
        <button
          key={tab.id}
          className={`${styles.btn} ${active === tab.id ? styles.on : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
