/**
 * Single source of truth for Heidenhain program names.
 *
 * Used by:
 *  - ProgramDisplay: file name of the exported .H file
 *  - Heidenhain postprocessor: BEGIN PGM / END PGM blocks inside the file
 *
 * Guarantees the name written inside the file is identical to the
 * name of the saved .H file.
 */

function pad2(n) {
  return String(n).padStart(2, '0');
}

function todayStamp(date) {
  const d = date || new Date();
  return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
}

export function buildProgramName(operationId, date) {
  const base = (operationId || 'PROGRAM').toUpperCase();
  return base + '_' + todayStamp(date);
}

// Nome do .H do Gravador a partir do texto: 5 primeiros [a-z0-9] da
// primeira linha (minúsculas, sem acento) + _MMAA. Ex.: "ANDRE HENRIQUE"
// em out/2026 → "andre_1026". Sem letras/números válidos → "gravacao".
export function buildEngravingFileName(text, date) {
  const line = String(text ?? '').split('\n')[0] ?? '';
  const slug = line
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 5) || 'gravacao';
  const d = date || new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yy = String(d.getFullYear()).slice(-2);
  return `${slug}_${mm}${yy}`;
}

// Higieniza o nome ajustado pelo operador (mesmas regras + "_" permitido,
// teto 16 para controles antigos). Vazio/inválido → '' (a tela volta ao
// automático).
export function sanitizeProgramName(name) {
  return String(name ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 16);
}
