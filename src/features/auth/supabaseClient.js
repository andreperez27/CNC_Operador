import { createClient } from '@supabase/supabase-js';

// Configurado via .env.local (dev) ou secrets do CI (build).
// Sem essas variáveis — ou com URL malformada — o app trava na tela de
// bloqueio com mensagem de serviço indisponível: nunca libera acesso sem
// backend e nunca quebra em tela vazia por erro de inicialização.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

function isValidHttpUrl(value) {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export const isSupabaseConfigured = Boolean(anonKey) && isValidHttpUrl(url);

export const supabase = isSupabaseConfigured ? createClient(url.trim(), anonKey) : null;
