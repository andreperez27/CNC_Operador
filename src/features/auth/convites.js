import { supabase, isSupabaseConfigured } from './supabaseClient';

// Fluxo de aceite de convite Beta (sem e-mail): detecta o token na URL,
// garante sessão anônima, resgata via Edge Function e limpa a URL.
// O token vive só em memória durante o resgate — nunca é persistido.
// Preferência pelo fragmento (#convite=): não viaja em HTTP Referer;
// query (?convite=) aceita como alternativa.

// Extraído de useAuth para não acoplar o aceite ao provider.
export function getInviteTokenFromUrl() {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.match(/[#&]convite=([^&]+)/);
  if (hash) {
    try {
      return decodeURIComponent(hash[1]);
    } catch {
      return null;
    }
  }
  try {
    return new URLSearchParams(window.location.search).get('convite');
  } catch {
    return null;
  }
}

export function clearInviteTokenFromUrl() {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  const { pathname, search, hash } = window.location;
  const cleanHash = hash.replace(/[#&]convite=[^&]*/g, '').replace(/^#&/, '#');
  let cleanSearch = search;
  try {
    const params = new URLSearchParams(search);
    params.delete('convite');
    const s = params.toString();
    cleanSearch = s ? `?${s}` : '';
  } catch {
    cleanSearch = search;
  }
  const cleanFrag = cleanHash && cleanHash !== '#' ? cleanHash : '';
  window.history.replaceState(null, '', pathname + cleanSearch + cleanFrag);
}

// Chamadas concorrentes com o mesmo token (ex.: StrictMode monta o efeito
// 2x em dev) aguardam a MESMA promessa: um único POST voa por token.
// O servidor continua com uso único (só o primeiro resgate vence).
const inFlight = new Map();

export function acceptInvite(token) {
  if (!isSupabaseConfigured || !supabase) return Promise.resolve({ ok: false, error: 'no-backend' });
  if (!token) return Promise.resolve({ ok: false, error: 'invalid' });
  if (inFlight.has(token)) return inFlight.get(token);
  const p = (async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data?.session) {
        // Sessão anônima SOMENTE neste fluxo; o login normal continua intacto.
        const { error } = await supabase.auth.signInAnonymously();
        if (error) return { ok: false, error: 'signin' };
      }
      const { data: res, error } = await supabase.functions.invoke('resgatar', {
        body: { token },
      });
      if (error || !res?.ok) return { ok: false, error: 'invalid' };
      // `note: 'already-admin'` (admin resgatando link válido): continua
      // sucesso — o note só distingue o caso para a UI, sem quebrar nada.
      return { ok: true, note: res?.note };
    } catch {
      return { ok: false, error: 'network' };
    } finally {
      inFlight.delete(token);
    }
  })();
  inFlight.set(token, p);
  return p;
}
