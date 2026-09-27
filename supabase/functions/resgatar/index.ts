// Edge Function: resgatar — consome um convite Beta e vincula o uid
// (sessão comum ou anônima) a uma linha beta em app_users.
//
// Deploy (manual, fora desta fase):
//   supabase functions deploy resgatar
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (nunca no frontend).

import { serviceClient, getCallerUid, json, handleOptions } from '../_shared/auth.ts';

async function sha256hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'Método inválido.' }, 405, origin);

  let uid: string;
  try {
    uid = await getCallerUid(req);
  } catch (e) {
    return e instanceof Response ? e : json({ error: 'Erro interno.' }, 500, origin);
  }

  let token = '';
  try {
    token = String((await req.json())?.token ?? '');
  } catch {
    token = '';
  }
  if (!token) return json({ error: 'Convite inválido ou expirado.' }, 410, origin);

  const svc = serviceClient();
  // Consumo ATÔMICO em uma única instrução: sob concorrência, exatamente
  // um resgate vence. Não é necessária função SQL transacional privada.
  const { data: invite, error: consumeError } = await svc
    .from('beta_convites')
    .update({ usado_em: new Date().toISOString(), usado_por: uid, status: 'usado' })
    .eq('token_hash', await sha256hex(token))
    .eq('status', 'ativo')
    .is('usado_em', null)
    .gte('expira_em', new Date().toISOString())
    .select('id,expiracao_beta')
    .maybeSingle();

  // Mensagem única de propósito: não distingue inexistente/expirado/
  // usado/cancelado (anti-enumeração de convites).
  if (consumeError || !invite) {
    return json({ error: 'Convite inválido ou expirado.' }, 410, origin);
  }

  // Vincula o uid sem nunca rebaixar linha existente (ex.: admin testando
  // o próprio fluxo continua admin). apelido fica no convite p/ auditoria.
  const { error: linkError } = await svc.from('app_users').upsert(
    { id: uid, tipo: 'beta', ativo: true, data_expiracao: invite.expiracao_beta },
    { onConflict: 'id', ignoreDuplicates: true }
  );
  if (linkError) return json({ error: 'Não foi possível ativar o acesso.' }, 500, origin);

  return json({ ok: true }, 200, origin);
});
