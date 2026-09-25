import { useState, useEffect, useCallback } from 'react';
import { AuthContext } from './auth-context';
import { supabase, isSupabaseConfigured } from './supabaseClient';
import { readOfflineGrant, writeOfflineGrant, clearOfflineGrant, isGrantFresh } from './offlinePolicy';

function todayLocal() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function evaluateAccess(profile) {
  if (!profile) return { access: 'denied', reason: 'no-profile' };
  if (profile.ativo === false) return { access: 'denied', reason: 'inactive' };
  if (profile.data_expiracao && profile.data_expiracao < todayLocal()) {
    return { access: 'denied', reason: 'expired' };
  }
  return { access: 'granted', reason: null };
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading'); // loading|signed-out|granted|denied
  const [reason, setReason] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [offline, setOffline] = useState(false);

  const checkAccess = useCallback(async () => {
    if (!isSupabaseConfigured) {
      setProfile(null);
      setReason('no-backend');
      setStatus('denied');
      setOffline(false);
      return;
    }
    let session = null;
    try {
      const { data } = await supabase.auth.getSession();
      session = data?.session || null;
    } catch {
      session = null;
    }
    if (!session) {
      // Estado A: sem sessão não há a quem aplicar tolerância.
      clearOfflineGrant();
      setProfile(null);
      setReason(null);
      setStatus('signed-out');
      setOffline(false);
      return;
    }
    try {
      const { data: row, error } = await supabase
        .from('app_users')
        .select('id,email,nome,tipo,ativo,data_expiracao')
        .eq('id', session.user.id)
        .maybeSingle();
      if (error || !row) {
        // Estado F: online e sem linha → bloqueia e limpa tolerância.
        await supabase.auth.signOut();
        clearOfflineGrant();
        setProfile(null);
        setReason('no-profile');
        setStatus('denied');
        setOffline(false);
        return;
      }
      const verdict = evaluateAccess(row);
      if (verdict.access === 'granted') {
        // Estado E: renova a janela de tolerância.
        writeOfflineGrant(session.user.id);
        setProfile(row);
        setReason(null);
        setStatus('granted');
        setOffline(false);
      } else {
        // Estados G/H: negado online → sem tolerância.
        clearOfflineGrant();
        setProfile(row);
        setReason(verdict.reason);
        setStatus('denied');
        setOffline(false);
      }
    } catch {
      // Estado I: erro de rede. Usa tolerância se houver concessão válida
      // para ESTE usuário dentro da janela; senão, bloqueia (estado D).
      const grant = readOfflineGrant();
      if (grant && grant.uid === session.user.id && isGrantFresh(grant.at)) {
        setReason(null);
        setStatus('granted');
        setOffline(true);
      } else {
        setProfile(null);
        setReason('offline');
        setStatus('denied');
        setOffline(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setReason('no-backend');
      setStatus('denied');
      return undefined;
    }
    checkAccess();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      checkAccess();
    });
    // Revalida periodicamente com rede: revogação/expiração não depende
    // de o usuário relogar.
    const timer = setInterval(checkAccess, 5 * 60 * 1000);
    return () => {
      listener?.subscription?.unsubscribe();
      clearInterval(timer);
    };
  }, [checkAccess]);

  const signIn = useCallback(async (email, password) => {
    setAuthError(null);
    if (!isSupabaseConfigured) {
      setAuthError('Serviço de acesso indisponível. Entre em contato com o administrador.');
      return false;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      // Mensagem genérica de propósito: não distingue senha errada de
      // conta inexistente/sem perfil (anti-enumeração). Exceção: sem rede
      // no primeiro acesso, quando a orientação útil é conectar-se.
      const msg = String(error.message || '');
      const offlineHint = typeof navigator !== 'undefined' && navigator.onLine === false;
      const networkHint = /failed to fetch|network|load failed/i.test(msg);
      if (offlineHint || networkHint) {
        setAuthError('Sem conexão com a internet. O primeiro acesso exige conexão.');
      } else {
        setAuthError('Credenciais inválidas ou acesso não autorizado.');
      }
      return false;
    }
    await checkAccess();
    return true;
  }, [checkAccess]);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) await supabase.auth.signOut();
    clearOfflineGrant();
    setProfile(null);
    setReason(null);
    setStatus('signed-out');
    setOffline(false);
  }, []);

  return (
    <AuthContext.Provider value={{ status, reason, profile, offline, authError, signIn, signOut, refresh: checkAccess }}>
      {children}
    </AuthContext.Provider>
  );
}
