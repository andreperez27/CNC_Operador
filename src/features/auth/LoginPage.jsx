import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { useAuth } from './useAuth';
import { getInviteTokenFromUrl, clearInviteTokenFromUrl, acceptInvite } from './convites';

export default function LoginPage() {
  const { signIn, authError, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);

  // Ponto de entrada do aceite de convite: só roda deslogado, uma vez por
  // montagem. O login normal abaixo continua intacto.
  useEffect(() => {
    const token = getInviteTokenFromUrl();
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      setInviteBusy(true);
      setInviteError(null);
      const res = await acceptInvite(token);
      clearInviteTokenFromUrl();
      if (cancelled) return;
      if (res.ok) {
        await refresh();
      } else if (res.error === 'no-backend') {
        setInviteError('Serviço indisponível. Tente novamente com internet.');
      } else {
        setInviteError('Convite inválido ou expirado.');
      }
      setInviteBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

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
        {inviteBusy && (
          <div className="info">Validando convite...</div>
        )}
        {inviteError && (
          <div className="info" role="alert" style={{ color: 'var(--red)' }}>{inviteError}</div>
        )}
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
