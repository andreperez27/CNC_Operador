import { useEffect, useState } from 'react';
import Card from '../../components/Card';
import { useAuth } from './useAuth';
import LoginPage from './LoginPage';
import BlockedPage from './BlockedPage';
import { getInviteTokenFromUrl, clearInviteTokenFromUrl, acceptInvite } from './convites';
import { deveProcessarConviteComSessao, mensagemConviteError, CONVITE_JA_ADMIN } from './conviteFlow';

// Desfecho do aceite com sessão já ativa: ou o usuário já tinha acesso (botão
// para seguir usando o app) ou está bloqueado (só resta sair).
function ConviteAviso({ erro, info, onContinuar, onSair }) {
  return (
    <div className="page">
      <Card title="Convite Beta">
        <div className="info" role="alert" style={erro ? { color: 'var(--red)' } : undefined}>
          {erro || info}
        </div>
        <div className="btn-row">
          {onContinuar ? (
            <button className="btn btn-p" type="button" onClick={onContinuar}>ENTRAR NO APP</button>
          ) : (
            <button className="btn btn-s" type="button" onClick={onSair}>SAIR</button>
          )}
        </div>
      </Card>
    </div>
  );
}

// Portão na entrada do app: sem sessão válida + perfil autorizado no banco,
// nenhuma página é montada.
export default function AuthGate({ children }) {
  const auth = useAuth();
  const refresh = auth?.refresh;
  const token = getInviteTokenFromUrl();
  const processar = deveProcessarConviteComSessao({
    status: auth?.status,
    reason: auth?.reason,
    token,
  });
  const [convite, setConvite] = useState({ busy: false, erro: null, info: null });
  const [verApp, setVerApp] = useState(false);

  // Convite aberto COM sessão ativa: o LoginPage nunca monta, então o token
  // ficava preso na URL e o resgate nunca chegava ao banco. O servidor é quem
  // decide o efeito (admin não consome o convite; beta existente estende a
  // validade; sem linha, cria a beta) — aqui só orquestramos e avisamos.
  useEffect(() => {
    if (!processar) return undefined;
    let cancelled = false;
    (async () => {
      setConvite({ busy: true, erro: null, info: null });
      setVerApp(false);
      const res = await acceptInvite(token);
      clearInviteTokenFromUrl();
      if (cancelled) return;
      if (!res.ok) {
        setConvite({ busy: false, erro: mensagemConviteError(res.error), info: null });
        return;
      }
      if (res.note === 'already-admin') {
        setConvite({ busy: false, erro: null, info: CONVITE_JA_ADMIN });
        return;
      }
      setConvite({ busy: false, erro: null, info: null });
      await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [processar, token, refresh]);

  if (!auth || auth.status === 'loading') {
    return (
      <div className="page">
        <div className="info">CARREGANDO...</div>
      </div>
    );
  }
  if (convite.busy) {
    return (
      <div className="page">
        <div className="info">VALIDANDO CONVITE...</div>
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
    if (!verApp && (convite.erro || convite.info)) {
      return (
        <ConviteAviso
          erro={convite.erro}
          info={convite.info}
          onSair={auth.signOut}
        />
      );
    }
    return <BlockedPage />;
  }
  if (!verApp && (convite.erro || convite.info)) {
    return (
      <ConviteAviso
        erro={convite.erro}
        info={convite.info}
        onContinuar={() => setVerApp(true)}
      />
    );
  }
  return children;
}
