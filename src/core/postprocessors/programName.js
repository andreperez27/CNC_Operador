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
