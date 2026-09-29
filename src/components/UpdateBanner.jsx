import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import styles from './UpdateBanner.module.css';

// Aviso de versão nova (modo prompt): o banner só aparece quando há um SW
// novo esperando, e o botão o ativa (skip-waiting) + recarrega a aba.
// (No modo autoUpdate o updateServiceWorker() do plugin é no-op e o
// needRefresh vinha como tupla sempre-truthy: banner eterno e botão morto.)
//
// Mobile deixa a aba/PWA aberta por dias em segundo plano: a checagem padrão
// do SW só roda no carregamento, então sem checagem ativa a versão nova
// nunca é detectada no celular. Por isso há reforço periódico + ao voltar
// para o app (visibilitychange/focus).
const UPDATE_CHECK_MS = 30 * 60 * 1000; // 30 min

export default function UpdateBanner() {
  const [registration, setRegistration] = useState(null);
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, reg) {
      setRegistration(reg || null);
    },
  });

  useEffect(() => {
    if (!registration || typeof registration.update !== 'function') return undefined;
    const check = () => {
      registration.update().catch(() => {});
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    const timer = window.setInterval(check, UPDATE_CHECK_MS);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [registration]);

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
