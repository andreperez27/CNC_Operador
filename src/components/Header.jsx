import styles from './Header.module.css';
// Versão 256px do logo oficial (src/assets/logo-cnc-operador.png, original
// integral de 1254px): idêntico em tela, sem estourar o limite de 2 MiB do
// precache do PWA.
import logoCncOperador from '../assets/logo-cnc-operador-256.png';
import { useAuth } from '../features/auth/useAuth';

export default function Header() {
  const auth = useAuth();
  const signedIn = auth?.status === 'granted';

  return (
    <header className={styles.header}>
      <img src={logoCncOperador} className={styles.logoImg} alt="CNC Operador" />
      <div className={styles.title}>CNC OPERADOR</div>
      {signedIn ? (
        <button type="button" className={`btn btn-sm ${styles.logoutBtn}`} onClick={() => auth.signOut()}>
          SAIR
        </button>
      ) : null}
    </header>
  );
}
