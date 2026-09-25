import { createClient } from '@supabase/supabase-js';

// Configurado via .env.local (dev) ou secrets do CI (build).
// Sem essas variáveis o app trava na tela de bloqueio com mensagem
// de serviço indisponível — nunca libera acesso sem backend.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

export const supabase = isSupabaseConfigured ? createClient(url, anonKey) : null;
