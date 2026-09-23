/**
 * Pesquisa de roscas (core) — normaliza a consulta do operador e retorna
 * os registros compatíveis do banco.
 *
 * Aceita (indiferente a maiúsculas, ".", ",", espaços, x/X/×):
 *   M10        -> todos os passos do Ø 10
 *   M10x1.5    / M10 x 1,5  / M10 1.5  / 10x1.5  / M10 1,50
 *   M12x1.25   / M12 x 1,25
 *   rosca inexistente -> []
 */

import { getThreads } from './database';

function toNum(v) {
  return Number(String(v).replace(',', '.'));
}/**
 * Normaliza a consulta bruta para o formato canônico "M<diam>[X<passo>]"
 * com ponto decimal (ex.: "M10X1.5"). Retorna '' quando vazia.
 */
export function normalizeThreadQuery(raw) {
  if (raw === undefined || raw === null) return '';
  let q = String(raw).trim().toUpperCase();
  q = q.replace(/×/g, 'X').replace(/x/g, 'X');
  // "M10,1.5" — vírgula separando diâmetro e passo (passo decimal com ponto)
  q = q.replace(/^M?(\d+),(\d+(?:\.\d+))$/, 'M$1X$2');
  q = q.replace(/,/g, '.');
  // "10x1.5" -> "M10X1.5"  (sem o prefixo M)
  q = q.replace(/^\d/, 'M$&');
  // "M10 1.5" / "M10 x 1,5" -> insere X entre os dois numeros separados por espaco
  q = q.replace(/^M?(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)$/, 'M$1X$2');
  return q.replace(/\s+/g, '');
}

/**
 * Interpreta a consulta em { nominal, pitch?, valid }.
 */
export function parseThreadQuery(raw) {
  const n = normalizeThreadQuery(raw);
  if (!n) return { raw: '', nominal: null, pitch: null, valid: false };
  const m = n.match(/^M(\d+(?:\.\d+)?)(?:X(\d+(?:\.\d+)?))?$/);
  if (!m) return { raw: n, nominal: null, pitch: null, valid: false };
  return {
    raw: n,
    nominal: toNum(m[1]),
    pitch: m[2] !== undefined ? toNum(m[2]) : null,
    valid: true,
  };
}

export function matchesThread(record, parsed) {
  if (!parsed || !parsed.valid) return false;
  if (Math.abs(record.nominal - parsed.nominal) > 1e-9) return false;
  if (parsed.pitch !== null && Math.abs(record.pitch - parsed.pitch) > 1e-9) {
    return false;
  }
  return true;
}

/**
 * Busca registros por consulta normalizada. `familyId` opcional restringe a
 * família. Sem consulta válida retorna [].
 */
export function searchThreads(raw, familyId) {
  const parsed = parseThreadQuery(raw);
  if (!parsed.valid) return [];
  return getThreads().filter((t) => {
    if (familyId && t.familyId !== familyId) return false;
    return matchesThread(t, parsed);
  });
}