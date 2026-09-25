/**
 * Política de tolerância offline (Beta).
 *
 * Após uma validação online bem-sucedida, o acesso segue liberado sem
 * internet por OFFLINE_TOLERANCE_MS. Guarda-se SOMENTE { uid, granted, at }:
 * sem senha, sem token (a sessão continua com o Supabase) e sem transformar
 * o cache em autoridade — online, o banco sempre decide.
 */

export const OFFLINE_TOLERANCE_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

const KEY = 'cnc-operador:offline-access';

function storage() {
  try {
    if (typeof localStorage === 'undefined') return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function readOfflineGrant() {
  const s = storage();
  if (!s) return null;
  try {
    const p = JSON.parse(s.getItem(KEY));
    if (!p || typeof p !== 'object') return null;
    if (p.granted !== true || typeof p.uid !== 'string' || !Number.isFinite(p.at)) return null;
    return { uid: p.uid, at: p.at };
  } catch {
    return null;
  }
}

export function writeOfflineGrant(uid) {
  const s = storage();
  if (!s) return;
  try {
    s.setItem(KEY, JSON.stringify({ uid, granted: true, at: Date.now() }));
  } catch {
    /* armazenamento indisponível — sem tolerância offline */
  }
}

export function clearOfflineGrant() {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(KEY);
  } catch {
    /* ignora */
  }
}

export function isGrantFresh(at, now = Date.now()) {
  return now - at <= OFFLINE_TOLERANCE_MS;
}
