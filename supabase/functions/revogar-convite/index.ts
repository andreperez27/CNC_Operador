// Edge Function: revogar-convite — cancela convite ativo (somente admin).
//
// Deploy (manual, fora desta fase):
//   supabase functions deploy revogar-convite
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (nunca no frontend).

import { serviceClient, requireAdmin, json, handleOptions } from '../_shared/auth.ts';

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

  let id = '';
  try {
    id = String((await req.json())?.id ?? '');
  } catch {
    id = '';
  }
  if (!id) return json({ error: 'Convite não informado.' }, 400, origin);

  const svc = serviceClient();
  // Cancelamento condicional e atômico: só convite ainda ativo muda.
  const { data: cancelled, error: cancelError } = await svc
    .from('beta_convites')
    .update({ status: 'cancelado' })
    .eq('id', id)
    .eq('status', 'ativo')
    .select('id')
    .maybeSingle();
  if (cancelError) return json({ error: 'Não foi possível revogar o convite.' }, 500, origin);
  if (cancelled) return json({ ok: true }, 200, origin);

  // Não estava ativo: distingue inexistente de já encerrado.
  const { data: row } = await svc.from('beta_convites').select('id').eq('id', id).maybeSingle();
  if (!row) return json({ error: 'Convite não encontrado.' }, 404, origin);
  return json({ error: 'Convite já não está ativo.' }, 409, origin);
});
