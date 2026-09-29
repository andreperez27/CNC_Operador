import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdateBanner.module.css';

// Aviso de versão nova (modo prompt): o banner só aparece quando há um SW
// novo esperando, e o botão o ativa (skip-waiting) + recarrega a aba.
// (No modo autoUpdate o updateServiceWorker() do plugin é no-op e o
// needRefresh vinha como tupla sempre-truthy: banner eterno e botão morto.)
export default function UpdateBanner() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();

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
