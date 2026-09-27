// Helpers compartilhados das Edge Functions do Beta Link.
// Service role NUNCA sai daqui: só via Deno.env nas funções, jamais em
// resposta, log ou JWT do frontend.

import { createClient } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const ALLOWED_ORIGINS = [
  'https://andreperez27.github.io',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

export function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Rede privada (testes em LAN): só é alcançável por quem já está dentro da
// rede local, então ecoar a origem não expõe nada à internet.
function isAllowedOrigin(origin?: string | null): boolean {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  return /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(:\d+)?$/.test(origin);
}

function corsHeaders(origin?: string | null): Record<string, string> {
  const allow = typeof origin === 'string' && isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export function json(body: unknown, status = 200, origin?: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  });
}

export function handleOptions(req: Request): Response | null {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(req.headers.get('origin')) });
  }
  return null;
}

function bearerUid(req: Request): Promise<string | null> {
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!jwt) return Promise.resolve(null);
  return serviceClient()
    .auth.getUser(jwt)
    .then(({ data, error }) => (error ? null : (data?.user?.id ?? null)));
}

// Exige admin ativo em app_users. Retorna o uid ou lança Response 401/403.
// NUNCA confia em `tipo` enviado pelo frontend: a checagem é server-side.
export async function requireAdmin(req: Request): Promise<string> {
  const origin = req.headers.get('origin');
  const uid = await bearerUid(req);
  if (!uid) throw json({ error: 'Não autorizado.' }, 401, origin);
  const { data: row } = await serviceClient()
    .from('app_users')
    .select('tipo,ativo')
    .eq('id', uid)
    .maybeSingle();
  if (!row || row.tipo !== 'admin' || row.ativo !== true) {
    throw json({ error: 'Acesso negado.' }, 403, req.headers.get('origin'));
  }
  return uid;
}

// UID do chamador (sessão comum ou anônima). 401 sem sessão válida.
export async function getCallerUid(req: Request): Promise<string> {
  const uid = await bearerUid(req);
  if (!uid) throw json({ error: 'Sessão necessária.' }, 401, req.headers.get('origin'));
  return uid;
}
