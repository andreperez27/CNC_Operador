/**
 * Heidenhain iTNC 530 postprocessor.
 *
 * Translates IR blocks (from src/core/program/types.js) into
 * Heidenhain conversational G-code text.
 *
 * All `$N` parameter references are mapped to `QN`.
 *
 * Output format follows the real control standard (see CHF45X15.H):
 *  - every line starts with a sequential block number (width 2,
 *    single digits padded with a trailing space: "0 ", "9 ";
 *    two digits unpadded: "10", "21"), followed by one space
 *  - first block is "BEGIN PGM <name> MM ", last is "END PGM <name> MM "
 *    (same name, from programName.js, matching the saved file name)
 *  - decimal values use comma as decimal separator (",")
 *  - safe return block ends the program (M30, which also stops the
 *    spindle and cancels active cycles — M5 is redundant)
 *
 * The math engine keeps using "." (JavaScript) internally; conversion
 * happens only here, at final text formatting time.
 */

import { buildProgramName } from './programName';

function indent(block) {
  return block.indent ? '  ' : '';
}

/**
 * Central formatter for every numeric value emitted by this postprocessor.
 * Converts the JavaScript decimal point to the comma used by the control.
 */
function formatDecimal(value, decimals) {
  const sign = value < 0 ? '-' : '+';
  const num = Math.abs(value).toFixed(decimals).replace('.', ',');
  return sign + num;
}

function emitDefine(block) {
  const q = block.param.replace('$', 'Q');
  const val = formatDecimal(block.value, block.decimals);
  const prefix = q.padEnd(3) + ' = ' + val;
  const pad = Math.max(1, 16 - prefix.length);
  return indent(block) + prefix + ' '.repeat(pad) + '; ' + block.label;
}

/**
 * Literal user input — same data as DEFINE, but emitted in the
 * "FN 0: Qn =+valor ;comentario" form used by the real programs
 * for values typed by the operator.
 */
function emitFn0(block) {
  const q = block.param.replace('$', 'Q');
  const val = formatDecimal(block.value, block.decimals);
  return indent(block) + 'FN 0: ' + q + ' =' + val + ' ;' + block.label;
}

/**
 * Stock envelope — two lines (0.1 = negative corner, 0.2 = origin),
 * each one gets its own block number.
 */
function fmtStock(value) {
  const sign = value < 0 ? '-' : '+';
  const decimals = Number.isInteger(value) ? 0 : 3;
  return sign + Math.abs(value).toFixed(decimals).replace('.', ',');
}

function emitBlkForm(block) {
  const neg = (v) => fmtStock(-v);
  return (
    'BLK FORM 0.1 Z X' + neg(block.w) + ' Y' + neg(block.l) + ' Z' + neg(block.h) +
    '\n' +
    'BLK FORM 0.2 X+0 Y+0 Z+0'
  );
}

function emitToolCall(block) {
  return 'TOOL CALL ' + block.tool + ' ' + (block.axis || 'Z') + ' S' + block.speed;
}

function emitAssign(block) {
  const tgt = block.target.replace('$', 'Q').padEnd(3);
  const expr = block.expression.replace(/\$/g, 'Q');
  const prefix = indent(block) + tgt + ' = ' + expr;
  const pad = Math.max(1, 26 - prefix.length);
  const comment = block.comment ? ' '.repeat(pad) + '; ' + block.comment : '';
  return prefix + comment;
}

function emitLabel(block) {
  return 'LBL ' + block.id;
}

function emitJump(block) {
  const cond = block.condition.replace(/\$/g, 'Q');
  const condFormatted = cond.replace(/\b(Q\d+)\b/g, '+$1');
  return indent(block) + 'FN 12: IF ' + condFormatted + ' GOTO LBL ' + block.label;
}

function formatCoords(coords) {
  const entries = Object.entries(coords);
  const isSingle = entries.length === 1;
  return entries
    .map(function (entry) {
      const raw = String(entry[1]).replace(/\$/g, 'Q');
      const qv = /^-?\d+\.\d+$/.test(raw) ? raw.replace('.', ',') : raw;
      const k = entry[0].toUpperCase();
      if (qv.startsWith('-')) {
        return isSingle ? k + ' ' + qv : k + qv;
      }
      return isSingle ? k + ' +' + qv : k + '+' + qv;
    })
    .join(' ');
}

function emitRapid(block) {
  const cmd = indent(block) + 'L ' + formatCoords(block.coords) + ' R0 FMAX';
  const mcode = block.mcode ? ' ' + block.mcode : '';
  return block.comment ? cmd + mcode + '  ; ' + block.comment : cmd + mcode;
}

function emitLinear(block) {
  const cmd = indent(block) + 'L ' + formatCoords(block.coords) + ' R0 F' + block.feed;
  const m90 = block.m90 ? ' M90' : '';
  const mcode = block.mcode ? ' ' + block.mcode : '';
  return block.comment ? cmd + m90 + mcode + '  ; ' + block.comment : cmd + m90 + mcode;
}

function emitSpindle(block) {
  return 'L Z+Q14 R0 FMAX M3 S' + block.speed;
}

function emitSpindleStop() {
  return 'L Z+100 R0 FMAX M30';
}

function emitCycleDef(block) {
  const lines = ['CYCL DEF ' + block.cycle + ' ' + block.title + ' ~'];
  for (const prm of block.params || []) {
    const q = 'Q' + prm.q;
    const val = formatDecimal(prm.value, prm.decimals);
    const prefix = '    ' + q + '=' + val;
    const pad = Math.max(1, 26 - prefix.length);
    lines.push(prefix + ' '.repeat(pad) + ';' + (prm.label || ''));
  }
  return lines.join('\n');
}

function emitCycleCall(block) {
  return 'CYCL CALL' + (block.spindle ? ' ' + block.spindle : '');
}

function signedInt(value) {
  return value < 0 ? '-' + Math.abs(value) : '+' + value;
}

function emitHelix(block) {
  const cc = 'CC X+' + block.center.x + '  Y+' + block.center.y;
  const ipa = 'IPA' + signedInt(block.angle);
  const iz = 'IZ' + formatDecimal(block.zStep, 3);
  const dr = block.direction === 'cw' ? 'DR-' : 'DR+';
  const cp = 'CP ' + ipa + '  ' + iz + ' ' + dr + ' F' + block.feed;
  return block.comment ? cc + '\n' + cp + '  ; ' + block.comment : cc + '\n' + cp;
}

function emitComment(block) {
  return block.lines.map(function (line) {
    if (line === '') return ';';
    return line.startsWith(';') ? line : '; ' + line;
  }).join('\n');
}

function emitSection(block) {
  return '; -- ' + block.title + ' --';
}

const EMITTERS = {
  define: emitDefine,
  fn0: emitFn0,
  blkForm: emitBlkForm,
  toolCall: emitToolCall,
  assign: emitAssign,
  label: emitLabel,
  jump: emitJump,
  rapid: emitRapid,
  linear: emitLinear,
  spindle: emitSpindle,
  spindleStop: emitSpindleStop,
  cycleDef: emitCycleDef,
  cycleCall: emitCycleCall,
  helix: emitHelix,
  comment: emitComment,
  section: emitSection,
};

function numberBlocks(lines) {
  return lines
    .map(function (line, i) {
      return String(i).padEnd(2, ' ') + ' ' + line;
    })
    .join('\n');
}

export const fileExtension = '.H';

export function postprocess(blocks, qParams, model, programName) {
  const parts = [];
  for (const b of blocks) {
    const fn = EMITTERS[b.type];
    if (!fn) {
      parts.push('; (bloco desconhecido: ' + b.type + ')');
      continue;
    }
    parts.push(fn(b));
  }

  const name = programName || buildProgramName(model && model.operationId);

  const lines = ['BEGIN PGM ' + name + ' MM ']
    .concat(parts.join('\n').split('\n'))
    .concat(['END PGM ' + name + ' MM ']);

  return numberBlocks(lines);
}
