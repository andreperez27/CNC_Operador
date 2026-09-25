import { useAuth } from './useAuth';
import LoginPage from './LoginPage';
import BlockedPage from './BlockedPage';

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
  if (auth.status === 'denied') return <BlockedPage />;
  return children;
}
