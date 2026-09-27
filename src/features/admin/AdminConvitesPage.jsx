import { useState } from 'react';
import Card from '../../components/Card';
import CopyButton from '../../components/CopyButton';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../auth/supabaseClient';

// Área administrativa mínima: gerar convites Beta via Edge Function
// existente `convidar`. A autorização real é server-side (a função exige
// admin ativo); este gate visual só esconde a tela de não-admins.
export default function AdminConvitesPage() {
  const { profile } = useAuth();
  const [apelido, setApelido] = useState('');
  const [expiracao, setExpiracao] = useState('');
  const [validade, setValidade] = useState('7');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  if (profile?.tipo !== 'admin') {
    return (
      <div className="page">
        <Card title="Convites Beta">
          <div className="info">Acesso restrito ao administrador.</div>
        </Card>
      </div>
    );
  }

  const handleGenerate = async (e) => {
    e.preventDefault();
    if (busy) return;
    setError(null);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(expiracao)) {
      setError('Informe a expiração do Beta (AAAA-MM-DD).');
      return;
    }
    setBusy(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('convidar', {
        body: {
          apelido: apelido.trim() || null,
          expiracao_beta: expiracao,
          validade_convite_dias: Number(validade) || 7,
        },
      });
      if (fnError || !data?.link) {
        setError('Não foi possível criar o convite.');
        return;
      }
      // Token existe só aqui, em memória, até FECHAR. Nunca persistido.
      setCreated({ link: data.link, expira_em: data.expira_em });
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    setCreated(null);
    setError(null);
  };

  return (
    <div className="page">
      <Card title="Convites Beta">
        {!created ? (
          <form onSubmit={handleGenerate}>
            <div className="fg">
              <label className="fl" htmlFor="cv-apelido">Apelido (opcional)</label>
              <input
                id="cv-apelido"
                className="fi"
                type="text"
                autoComplete="off"
                placeholder="Ex.: Testador 01"
                value={apelido}
                onChange={(e) => setApelido(e.target.value)}
              />
            </div>
            <div className="fg">
              <label className="fl" htmlFor="cv-expiracao">Expiração do Beta</label>
              <input
                id="cv-expiracao"
                className="fi"
                type="date"
                value={expiracao}
                onChange={(e) => setExpiracao(e.target.value)}
                required
              />
            </div>
            <div className="fg">
              <label className="fl" htmlFor="cv-validade">Validade do convite (dias)</label>
              <input
                id="cv-validade"
                className="fi"
                type="number"
                min="1"
                max="30"
                step="1"
                value={validade}
                onChange={(e) => setValidade(e.target.value)}
              />
            </div>
            {error && (
              <div className="info" role="alert" style={{ color: 'var(--red)' }}>{error}</div>
            )}
            <div className="btn-row">
              <button className="btn btn-p" type="submit" disabled={busy}>
                {busy ? 'GERANDO...' : '+ GERAR NOVO CONVITE'}
              </button>
            </div>
          </form>
        ) : (
          <>
            <div className="info">Convite criado</div>
            <div className="fg">
              <label className="fl">Válido até</label>
              <div className="fi">{new Date(created.expira_em).toLocaleString('pt-BR')}</div>
            </div>
            <div className="fg">
              <label className="fl">Link (mostrado uma única vez)</label>
              <div className="fi" style={{ wordBreak: 'break-all' }}>{created.link}</div>
            </div>
            <CopyButton getText={() => created.link} label="COPIAR LINK" />
            <div className="btn-row">
              <button className="btn btn-s" type="button" onClick={handleClose}>FECHAR</button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
