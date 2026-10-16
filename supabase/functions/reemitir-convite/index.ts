// Edge Function: reemitir-convite — gera novo link p/ convite ativo (somente admin).
//
// O link original NUNCA pode ser exibido de novo (só o hash é guardado):
// aqui o token é TROCADO (hash novo) — o link antigo morre na hora e o
// novo aparece uma única vez na resposta. Só convite ainda ativo; usado
// está consumido e encerrado não ressuscita (datas se editam à parte).
// Troca condicional e atômica (nunca troca hash já usado, mesmo em
// corrida com um resgate simultâneo).
//
// Deploy (manual, fora desta fase):
//   supabase functions deploy reemitir-convite
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL (nunca no frontend).

import { serviceClient, requireAdmin, json, handleOptions } from '../_shared/auth.ts';
import { podeReemitir } from '../_shared/convitesAdmin.ts';

const APP_URL = (Deno.env.get('APP_URL') ?? 'https://andreperez27.github.io/CNC_Operador').replace(/\/+$/, '');

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function sha256hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

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

  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const token_hash = await sha256hex(token);

  const svc = serviceClient();
  // Troca condicional e atômica: só convite ainda ativo ganha hash novo.
  const { data: rotated, error: rotateError } = await svc
    .from('beta_convites')
    .update({ token_hash })
    .eq('id', id)
    .eq('status', 'ativo')
    .select('id,expira_em')
    .maybeSingle();
  if (rotateError) return json({ error: 'Não foi possível reemitir o convite.' }, 500, origin);
  if (rotated) {
    return json({ ok: true, link: `${APP_URL}/#convite=${token}`, expira_em: rotated.expira_em }, 200, origin);
  }

  // Nada trocado: distingue inexistente de encerrado/utilizado.
  const { data: row } = await svc.from('beta_convites').select('id,status').eq('id', id).maybeSingle();
  const decisao = podeReemitir(row ?? null);
  if (decisao.ok) return json({ error: 'Não foi possível reemitir o convite.' }, 500, origin);
  return json({ error: decisao.message }, decisao.code, origin);
});
