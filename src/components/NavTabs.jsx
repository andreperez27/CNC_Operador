import styles from './NavTabs.module.css';
import { useAuth } from '../features/auth/useAuth';

const TABS = [
  { id: 'inicio', label: 'Início' },
  { id: 'roscas', label: 'Roscas' },
  { id: 'trigonometria', label: 'Trigon.' },
  { id: 'gcoderapido', label: 'G-Code Rapido' },
  { id: 'huron', label: 'Cabeçote Huron' },
  { id: 'convites', label: 'Convites', adminOnly: true },
];

export default function NavTabs({ active, onChange }) {
  const auth = useAuth();
  // Filtro puramente visual: a autorização real de gerar convites é
  // server-side, na Edge Function `convidar`.
  const visible = TABS.filter((t) => !t.adminOnly || auth?.profile?.tipo === 'admin');

  return (
    <nav className={styles.nav}>
      {visible.map(tab => (
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
