import { useState, useEffect, useCallback } from 'react';
import Card from '../../components/Card';
import CopyButton from '../../components/CopyButton';
import { useAuth } from '../auth/useAuth';
import { supabase } from '../auth/supabaseClient';
import { classificarConvite, CONVITE_STATUS_LABEL, conviteStatusColor } from './convitesStatus';

// Data-calendário (AAAA-MM-DD) formatada sem cair no fuso (new Date()
// puro deslocaria o dia em UTC−3).
function fmtDateOnly(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || ''));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
}

function fmtDateTime(s) {
  if (!s) return '—';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR');
}

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
  const [lista, setLista] = useState([]);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erroLista, setErroLista] = useState(null);
  const [revogandoId, setRevogandoId] = useState(null);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [excluindoId, setExcluindoId] = useState(null);

  const carregarLista = useCallback(async () => {
    if (profile?.tipo !== 'admin' || !supabase) return;
    setCarregandoLista(true);
    setErroLista(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('listar-convites', {});
      if (fnError || !data?.ok) {
        setErroLista('Não foi possível carregar os convites.');
        return;
      }
      setLista(Array.isArray(data.convites) ? data.convites : []);
    } catch {
      setErroLista('Sem conexão com o serviço de convites.');
    } finally {
      setCarregandoLista(false);
    }
  }, [profile]);

  useEffect(() => {
    carregarLista();
  }, [carregarLista]);

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
      carregarLista();
    } finally {
      setBusy(false);
    }
  };

  const handleRevogar = async (id, apelido) => {
    if (revogandoId) return;
    const nome = apelido || 'sem apelido';
    if (typeof window !== 'undefined'
      && !window.confirm(`Revogar o convite "${nome}"? Ele não poderá mais ser resgatado.`)) {
      return;
    }
    setRevogandoId(id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('revogar-convite', {
        body: { id },
      });
      if (fnError || !data?.ok) {
        setErroLista(data?.error || 'Não foi possível revogar o convite.');
        return;
      }
      await carregarLista();
    } catch {
      setErroLista('Sem conexão com o serviço de convites.');
    } finally {
      setRevogandoId(null);
    }
  };

  const handleClose = () => {
    setCreated(null);
    setError(null);
  };

  const handleEditar = (c) => {
    setErroLista(null);
    setEditando({
      id: c.id,
      nome: c.apelido || 'sem apelido',
      apelido: c.apelido || '',
      expiracao_beta: c.expiracao_beta || '',
      validade: '7',
      situacao: classificarConvite(c),
    });
  };

  const handleSalvar = async (e) => {
    e.preventDefault();
    if (!editando || salvando) return;
    const patch = { id: editando.id, apelido: editando.apelido.trim() || null };
    if (editando.situacao === 'ativo' || editando.situacao === 'usado') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(editando.expiracao_beta)) {
        setErroLista('Informe a expiração do Beta (AAAA-MM-DD).');
        return;
      }
      patch.expiracao_beta = editando.expiracao_beta;
    }
    if (editando.situacao === 'ativo') {
      patch.validade_convite_dias = Number(editando.validade) || 7;
    }
    setSalvando(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('editar-convite', {
        body: patch,
      });
      if (fnError || !data?.ok) {
        setErroLista(data?.error || 'Não foi possível salvar o convite.');
        return;
      }
      setEditando(null);
      await carregarLista();
    } catch {
      setErroLista('Sem conexão com o serviço de convites.');
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async (id, apelido, situacao) => {
    if (excluindoId) return;
    const nome = apelido || 'sem apelido';
    const motivo = situacao === 'ativo'
      ? `Excluir o convite "${nome}"? O link morrerá e não poderá ser resgatado. Ação irreversível.`
      : `Excluir o convite "${nome}" do histórico? Ação irreversível.`;
    if (typeof window !== 'undefined' && !window.confirm(motivo)) {
      return;
    }
    setExcluindoId(id);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('excluir-convite', {
        body: { id },
      });
      if (fnError || !data?.ok) {
        setErroLista(data?.error || 'Não foi possível excluir o convite.');
        return;
      }
      await carregarLista();
    } catch {
      setErroLista('Sem conexão com o serviço de convites.');
    } finally {
      setExcluindoId(null);
    }
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
      <Card title="Acompanhamento">
        <div className="btn-row" style={{ marginBottom: 8 }}>
          <button className="btn btn-s" type="button" onClick={carregarLista} disabled={carregandoLista}>
            {carregandoLista ? 'CARREGANDO...' : 'ATUALIZAR'}
          </button>
        </div>
        {erroLista && (
          <div className="info" role="alert" style={{ color: 'var(--red)' }}>{erroLista}</div>
        )}
        {editando && (
          <form onSubmit={handleSalvar}>
            <div className="info">EDITAR CONVITE — {editando.nome}</div>
            <div className="fg">
              <label className="fl" htmlFor="cv-edit-apelido">Apelido</label>
              <input
                id="cv-edit-apelido"
                className="fi"
                type="text"
                autoComplete="off"
                value={editando.apelido}
                onChange={(e) => setEditando((p) => ({ ...p, apelido: e.target.value }))}
              />
            </div>
            {(editando.situacao === 'ativo' || editando.situacao === 'usado') && (
              <div className="fg">
                <label className="fl" htmlFor="cv-edit-expiracao">Expiração do Beta</label>
                <input
                  id="cv-edit-expiracao"
                  className="fi"
                  type="date"
                  value={editando.expiracao_beta}
                  onChange={(e) => setEditando((p) => ({ ...p, expiracao_beta: e.target.value }))}
                  required
                />
              </div>
            )}
            {editando.situacao === 'ativo' && (
              <div className="fg">
                <label className="fl" htmlFor="cv-edit-validade">Validade do convite (dias, a partir de agora)</label>
                <input
                  id="cv-edit-validade"
                  className="fi"
                  type="number"
                  min="1"
                  max="30"
                  step="1"
                  value={editando.validade}
                  onChange={(e) => setEditando((p) => ({ ...p, validade: e.target.value }))}
                />
              </div>
            )}
            {editando.situacao === 'usado' && (
              <div className="info">Salvar a expiração atualiza também o acesso já concedido.</div>
            )}
            {editando.situacao !== 'ativo' && editando.situacao !== 'usado' && (
              <div className="info">Convite encerrado: só o apelido pode ser alterado.</div>
            )}
            <div className="btn-row">
              <button className="btn btn-p" type="submit" disabled={salvando}>
                {salvando ? 'SALVANDO...' : 'SALVAR'}
              </button>
              <button className="btn btn-s" type="button" onClick={() => setEditando(null)} disabled={salvando}>
                CANCELAR
              </button>
            </div>
          </form>
        )}
        {!erroLista && !carregandoLista && lista.length === 0 && (
          <div className="info">Nenhum convite gerado ainda.</div>
        )}
        {lista.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ color: 'var(--text2)', textAlign: 'left' }}>
                  <th style={{ padding: '6px 8px' }}>Apelido</th>
                  <th style={{ padding: '6px 8px' }}>Beta até</th>
                  <th style={{ padding: '6px 8px' }}>Convite válido até</th>
                  <th style={{ padding: '6px 8px' }}>Situação</th>
                  <th style={{ padding: '6px 8px' }}>Resgatado em</th>
                  <th style={{ padding: '6px 8px' }}>Ação</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const situacao = classificarConvite(c);
                  const podeRevogar = situacao === 'ativo';
                  return (
                    <tr key={c.id} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: '6px 8px' }}>{c.apelido || '—'}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)' }}>{fmtDateOnly(c.expiracao_beta)}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)' }}>{fmtDateTime(c.expira_em)}</td>
                      <td style={{ padding: '6px 8px', color: conviteStatusColor(situacao), fontWeight: 'bold' }}>
                        {CONVITE_STATUS_LABEL[situacao]}
                      </td>
                      <td style={{ padding: '6px 8px', fontFamily: 'var(--mono)' }}>{fmtDateTime(c.usado_em)}</td>
                      <td style={{ padding: '6px 8px' }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {podeRevogar && (
                            <button
                              className="btn btn-s"
                              type="button"
                              disabled={revogandoId === c.id}
                              onClick={() => handleRevogar(c.id, c.apelido)}
                            >
                              {revogandoId === c.id ? 'REVOGANDO...' : 'REVOGAR'}
                            </button>
                          )}
                          <button
                            className="btn btn-s"
                            type="button"
                            onClick={() => handleEditar(c)}
                          >
                            EDITAR
                          </button>
                          {situacao !== 'usado' && (
                            <button
                              className="btn btn-s"
                              type="button"
                              disabled={excluindoId === c.id}
                              onClick={() => handleExcluir(c.id, c.apelido, situacao)}
                            >
                              {excluindoId === c.id ? 'EXCLUINDO...' : 'EXCLUIR'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
