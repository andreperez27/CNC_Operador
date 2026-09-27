import { useAuth } from './useAuth';
import LoginPage from './LoginPage';
import BlockedPage from './BlockedPage';
import { getInviteTokenFromUrl } from './convites';

// Portão na entrada do app: sem sessão válida + perfil autorizado no banco,
// nenhuma página é montada.
export default function AuthGate({ children }) {
  const auth = useAuth();

  if (!auth || auth.status === 'loading') {
    return (
      <div className="page">
        <div className="info">CARREGANDO...</div>
      </div>
    );
  }
  if (auth.status === 'signed-out') return <LoginPage />;
  if (auth.status === 'denied') {
    // Convite pendente + sessão órfã (sem linha em app_users): dá chance ao
    // aceite antes de bloquear, senão o token na URL jamais seria lido
    // (é o LoginPage que o processa, e ele nunca montaria). Demais negações
    // (inativo, expirado, sem rede com janela estourada) seguem bloqueadas.
    if (auth.reason === 'no-profile' && getInviteTokenFromUrl()) {
      return <LoginPage />;
    }
    return <BlockedPage />;
  }
  return children;
}
