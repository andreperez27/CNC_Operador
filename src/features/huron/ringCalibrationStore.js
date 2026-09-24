/**
 * Persistência da calibração do anel de graduação, identificada por máquina.
 *
 * Chave: `huron-calibracao:<machineId>` → `{ bRingOffset, cRingOffset }`.
 * Isola o acesso ao localStorage pra que a futura segunda máquina (e uma
 * eventual aba de Configurações) reutilizem as mesmas funções, sem duplicar
 * lógica. Sem Supabase neste projeto, a calibração física vive no navegador.
 */

const LEGACY_KEYS = [
  // Chave genérica da primeira versão (formato { b, c } em texto).
  { key: 'cnc-operador:huron-ring-offsets', map: (p) => ({ bRingOffset: num(p.b), cRingOffset: num(p.c) }) },
  // Identificador anterior, ambíguo ("pórtico" em geral) — ver Ajuste 1.
  { key: 'huron-calibracao:portico-huron45', map: (p) => ({ bRingOffset: num(p.bRingOffset), cRingOffset: num(p.cRingOffset) }) },
];

const keyFor = (machineId) => `huron-calibracao:${machineId}`;

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function readKey(store, key) {
  try {
    const raw = store.getItem(key);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    return p;
  } catch {
    return null;
  }
}

export function getCalibracaoAnel(machineId) {
  const fallback = { bRingOffset: 0, cRingOffset: 0 };
  if (typeof localStorage === 'undefined') return fallback;
  try {
    const current = readKey(localStorage, keyFor(machineId));
    if (current) {
      return {
        bRingOffset: num(current.bRingOffset),
        cRingOffset: num(current.cRingOffset),
      };
    }
    // Migração única das chaves antigas, na ordem (mais recente primeiro).
    for (const legacy of LEGACY_KEYS) {
      const found = readKey(localStorage, legacy.key);
      if (found) {
        const migrated = legacy.map(found);
        localStorage.setItem(keyFor(machineId), JSON.stringify(migrated));
        localStorage.removeItem(legacy.key);
        return migrated;
      }
    }
  } catch {
    /* armazenamento indisponível — usa zeros */
  }
  return fallback;
}

export function setCalibracaoAnel(machineId, { bRingOffset, cRingOffset }) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(
      keyFor(machineId),
      JSON.stringify({ bRingOffset: num(bRingOffset), cRingOffset: num(cRingOffset) })
    );
  } catch {
    /* armazenamento indisponível — calibração não persiste */
  }
}
