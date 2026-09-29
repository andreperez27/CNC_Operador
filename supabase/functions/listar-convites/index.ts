// Edge Function: listar-convites — lista convites Beta (somente admin).
//
// Deploy (manual, fora desta fase):
//   supabase functions deploy listar-convites
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (nunca no frontend).

import { serviceClient, requireAdmin, json, handleOptions } from '../_shared/auth.ts';

const LIMITE = 200;

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

  // token_hash NUNCA sai daqui: só metadados de acompanhamento.
  const { data, error } = await serviceClient()
    .from('beta_convites')
    .select('id,apelido,status,expira_em,expiracao_beta,usado_em,usado_por,criado_em')
    .order('criado_em', { ascending: false })
    .limit(LIMITE);
  if (error) return json({ error: 'Não foi possível listar os convites.' }, 500, origin);

  return json({ ok: true, convites: data ?? [] }, 200, origin);
});
