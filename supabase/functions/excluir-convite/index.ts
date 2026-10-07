// Edge Function: excluir-convite — apaga convite não utilizado (somente admin).
//
// Usado NUNCA apaga (409): o registro de quem/quando resgatou é auditoria.
// Excluir NÃO remove acesso: o vínculo mora em `app_users`, independente —
// para cortar acesso, desative a linha do usuário no Dashboard.
// A exclusão é condicional e atômica (nunca apaga 'usado', mesmo em corrida
// com um resgate simultâneo).
//
// Deploy (manual, fora desta fase):
//   supabase functions deploy excluir-convite
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (nunca no frontend).

import { serviceClient, requireAdmin, json, handleOptions } from '../_shared/auth.ts';
import { podeExcluir } from '../_shared/convitesAdmin.ts';

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
  // Exclusão condicional e atômica: 'usado' nunca sai, nem em corrida.
  const { data: deleted, error: deleteError } = await svc
    .from('beta_convites')
    .delete()
    .eq('id', id)
    .neq('status', 'usado')
    .select('id')
    .maybeSingle();
  if (deleteError) return json({ error: 'Não foi possível excluir o convite.' }, 500, origin);
  if (deleted) return json({ ok: true }, 200, origin);

  // Nada saiu: distingue inexistente de já utilizado.
  const { data: row } = await svc.from('beta_convites').select('id,status').eq('id', id).maybeSingle();
  const decisao = podeExcluir(row ?? null);
  if (decisao.ok) return json({ error: 'Não foi possível excluir o convite.' }, 500, origin);
  return json({ error: decisao.message }, decisao.code, origin);
});
