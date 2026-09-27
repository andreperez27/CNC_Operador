// Edge Function: convidar — gera convite Beta de uso único (somente admin).
//
// Deploy (manual, fora desta fase):
//   supabase functions deploy convidar
// Secrets no Dashboard (Edge Functions → Manage secrets):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_URL

import { serviceClient, requireAdmin, json, handleOptions } from '../_shared/auth.ts';

const APP_URL = (Deno.env.get('APP_URL') ?? 'https://andreperez27.github.io/CNC_Operador').replace(/\/+$/, '');
const MAX_VALIDITY_DAYS = 30;

function base64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

async function sha256hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'Método inválido.' }, 405, origin);

  let adminUid: string;
  try {
    adminUid = await requireAdmin(req);
  } catch (e) {
    return e instanceof Response ? e : json({ error: 'Erro interno.' }, 500, origin);
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const { apelido = null, expiracao_beta, validade_convite_dias = 7 } = body;
  if (!isValidDate(expiracao_beta)) {
    return json({ error: 'expiracao_beta inválida (AAAA-MM-DD).' }, 400, origin);
  }
  const days = Math.min(MAX_VALIDITY_DAYS, Math.max(1, Number(validade_convite_dias) || 7));

  // 256 bits criptograficamente seguros; persiste SÓ o hash.
  const token = base64url(crypto.getRandomValues(new Uint8Array(32)));
  const token_hash = await sha256hex(token);
  const expira_em = new Date(Date.now() + days * 86400000).toISOString();

  const { error } = await serviceClient().from('beta_convites').insert({
    token_hash,
    criado_por: adminUid,
    expira_em,
    expiracao_beta,
    apelido: typeof apelido === 'string' && apelido.trim() ? apelido.trim().slice(0, 60) : null,
    status: 'ativo',
  });
  if (error) return json({ error: 'Não foi possível criar o convite.' }, 500, origin);

  // O token sai daqui UMA única vez, dentro do link.
  return json({ link: `${APP_URL}/#convite=${token}`, expira_em }, 200, origin);
});
