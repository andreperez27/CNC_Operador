import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdateBanner.module.css';

// Aviso de versão nova: com registerType autoUpdate o SW novo se instala
// sozinho, mas a aba aberta continua no código antigo até recarregar —
// sem aviso, o próximo chunk lazy dá 404 (hashes trocados no deploy).
export default function UpdateBanner() {
  const { needRefresh, updateServiceWorker } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className={styles.banner} role="status">
      <span>Nova versão disponível.</span>
      <button
        type="button"
        className={styles.reload}
        onClick={() => updateServiceWorker(true)}
      >
        RECARREGAR
      </button>
    </div>
  );
}
