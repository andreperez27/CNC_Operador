// Edge Function: editar-convite — edita apelido/datas de convite (somente admin).
//
// - apelido: qualquer situação (rótulo, sem efeito funcional).
// - expiracao_beta: ativo (futuros resgates) e usado (PROPAGA exato para
//   `app_users.data_expiracao` — inclusive encurtando, por ser ato explícito
//   do admin; diferente do resgate, que nunca encurta).
// - validade_convite_dias (expira_em): só ativo.
// Em cancelado/expirado, datas são rejeitadas (409).
//
// Deploy (manual, fora desta fase):
//   supabase functions deploy editar-convite
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (nunca no frontend).

import { serviceClient, requireAdmin, json, handleOptions } from '../_shared/auth.ts';
import { decidirEdicao } from '../_shared/convitesAdmin.ts';

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'Método inválido.' }, 405, origin);

  try {
    await requireAdmin(req);
  } catch (e) {
    return e instanceof Response ? e : json({ error: 'Erro interno.' }, 500, origin);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const id = String(body?.id ?? '');
  if (!id) return json({ error: 'Convite não informado.' }, 400, origin);

  const svc = serviceClient();
  const { data: invite, error: readError } = await svc
    .from('beta_convites')
    .select('id,status,apelido,expiracao_beta,expira_em,usado_por')
    .eq('id', id)
    .maybeSingle();
  if (readError) return json({ error: 'Não foi possível ler o convite.' }, 500, origin);

  const decisao = decidirEdicao(invite ?? null, {
    apelido: body.apelido as string | null | undefined,
    expiracao_beta: body.expiracao_beta as string | undefined,
    validade_convite_dias: body.validade_convite_dias as number | undefined,
  }, new Date().toISOString());
  if (!decisao.ok) return json({ error: decisao.message }, decisao.code, origin);

  const { error: updateError } = await svc
    .from('beta_convites')
    .update(decisao.updates)
    .eq('id', id);
  if (updateError) return json({ error: 'Não foi possível atualizar o convite.' }, 500, origin);

  // Propagação (usado + nova expiracao_beta): ajusta o acesso já concedido.
  // Não mexe em `ativo`: desativação explícita continua valendo.
  let acessoAtualizado = false;
  if (decisao.propagar) {
    const usadoPor = invite?.usado_por as string | null;
    if (usadoPor) {
      const { error: linkError } = await svc
        .from('app_users')
        .update({ data_expiracao: decisao.updates.expiracao_beta })
        .eq('id', usadoPor);
      if (linkError) return json({ error: 'Convite atualizado, mas o acesso não.' }, 500, origin);
      acessoAtualizado = true;
    }
  }

  const { data: convite } = await svc
    .from('beta_convites')
    .select('id,apelido,status,expiracao_beta,expira_em,usado_em,usado_por,criado_em')
    .eq('id', id)
    .maybeSingle();

  return json({ ok: true, convite, acessoAtualizado }, 200, origin);
});
