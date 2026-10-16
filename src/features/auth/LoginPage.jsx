import { useState, useEffect } from 'react';
import Card from '../../components/Card';
import { useAuth } from './useAuth';
import { getInviteTokenFromUrl, clearInviteTokenFromUrl, acceptInvite, extractInviteToken } from './convites';

export default function LoginPage() {
  const { signIn, signOut, authError, refresh } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteError, setInviteError] = useState(null);
  const [linkText, setLinkText] = useState('');
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState(null);

  // Aceite compartilhado: link na URL (efeito abaixo) e link colado
  // (botão). Devolve o resultado do aceite para cada chamada exibir a
  // mensagem correspondente.
  const runAccept = async (token) => {
    const res = await acceptInvite(token);
    clearInviteTokenFromUrl();
    return res;
  };

  const inviteMessage = (res) => {
    if (res.error === 'no-backend') return 'Serviço indisponível. Tente novamente com internet.';
    return 'Convite inválido ou expirado.';
  };

  // Ponto de entrada do aceite de convite: só roda deslogado, uma vez por
  // montagem. O login normal abaixo continua intacto.
  useEffect(() => {
    const token = getInviteTokenFromUrl();
    if (!token) return undefined;
    let cancelled = false;
    (async () => {
      setInviteBusy(true);
      setInviteError(null);
      const res = await runAccept(token);
      if (cancelled) return;
      if (res.ok) {
        await refresh();
      } else {
        // Falha: destrói a sessão anônima órfã para não virar tela de
        // bloqueio minutos depois (sem linha + sem token = denied).
        await signOut();
        if (cancelled) return;
        setInviteError(inviteMessage(res));
      }
      setInviteBusy(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh, signOut]);

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

  // Testador sem sessão e com o link em mãos (ex.: link quebrado pelo
  // navegador interno, fragmento perdido ao copiar, troca de aparelho):
  // cola o link ou o token e cai no mesmo aceite do link direto. Sem
  // convite válido continua bloqueado — não há entrada sem resgate.
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    if (linkBusy) return;
    const token = extractInviteToken(linkText);
    if (!token) {
      setLinkError('Cole o link do convite ou o token.');
      return;
    }
    setLinkBusy(true);
    setLinkError(null);
    try {
      const res = await runAccept(token);
      if (res.ok) {
        setLinkText('');
        await refresh();
      } else {
        await signOut();
        setLinkError(inviteMessage(res));
      }
    } finally {
      setLinkBusy(false);
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
        <form onSubmit={handleInviteSubmit}>
          <div className="fg">
            <label className="fl" htmlFor="login-invite">Tem um link de convite? Cole aqui</label>
            <input
              id="login-invite"
              className="fi"
              type="text"
              autoComplete="off"
              placeholder="https://…#convite=… ou o token"
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
            />
          </div>
          {linkError && (
            <div className="info" role="alert" style={{ color: 'var(--red)' }}>{linkError}</div>
          )}
          <div className="btn-row">
            <button className="btn btn-s" type="submit" disabled={linkBusy}>
              {linkBusy ? 'VALIDANDO...' : 'VALIDAR CONVITE'}
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}
