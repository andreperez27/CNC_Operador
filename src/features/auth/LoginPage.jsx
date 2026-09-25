import { useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from './useAuth';

export default function LoginPage() {
  const { signIn, authError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <Card title="Acesso — CNC Operador">
        <form onSubmit={handleSubmit}>
          <div className="fg">
            <label className="fl" htmlFor="login-email">E-mail</label>
            <input
              id="login-email"
              className="fi"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="fg">
            <label className="fl" htmlFor="login-pass">Senha</label>
            <input
              id="login-pass"
              className="fi"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {authError && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{authError}</div>
          )}
          <div className="btn-row">
            <button className="btn btn-p" type="submit" disabled={busy}>
              {busy ? 'ENTRANDO...' : 'ENTRAR'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
