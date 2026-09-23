/**
 * Intermediate Representation (IR) for machining programs.
 *
 * This module defines a control-agnostic block format for describing
 * machining operations. Each block is a plain object with a `type`
 * field and type-specific data.
 *
 * The IR contains NO syntax specific to any CNC dialect (no "Q" prefix,
 * no Heidenhain "L Z+... FMAX", no Fanuc "G01", etc.). Parameter
 * references use the generic `$N` notation and are translated to the
 * target dialect by a postprocessor.
 *
 * ## Design goal
 *
 * This layer exists so that program generation logic can be written
 * once and reused across multiple control platforms:
 *
 *   chamferExternalBuilder(qParams, model) → IR blocks
 *                                            ↙︎       ↘︎
 *                                heidenhain.js    fanuc.js
 *                                    (future)
 *
 * To add support for a new control, you write only a new
 * postprocessor — no changes to the builder or the template.
 */

export const TYPES = {
  /** Section separator — rendered as a comment block.
   *  `{ type, title: string }` */
  SECTION: 'section',

  /** Single- or multi-line comment.
   *  `{ type, lines: string[] }` */
  COMMENT: 'comment',

  /** Parameter definition from resolved data.
   *  `{ type, param: string, value: number, decimals: number, label: string }` */
  DEFINE: 'define',

  /** Literal input parameter, emitted as "FN 0: Qn =+valor ;comentario".
   *  Used for user-entered values (angle, tool diameter, safety, length...).
   *  `{ type, param: string, value: number, decimals: number, label: string }` */
  FN0: 'fn0',

  /** Raw stock block, emitted as BLK FORM 0.1 / 0.2.
   *  `{ type, w: number, l: number, h: number }` (positive extents) */
  BLK_FORM: 'blkForm',

  /** Tool call with spindle speed.
   *  `{ type, tool: number, speed: number, axis?: string }` */
  TOOL_CALL: 'toolCall',

  /** Parameter assignment with arithmetic expression.
   *  Expression uses $N references (e.g. "$30 * $4").
   *  `{ type, target: string, expression: string, comment?: string }` */
  ASSIGN: 'assign',

  /** Program label (jump target).
   *  `{ type, id: string }` */
  LABEL: 'label',

  /** Conditional or unconditional jump.
   *  Condition uses $N references (e.g. "$30 LT $31").
   *  `{ type, label: string, condition?: string }` */
  JUMP: 'jump',

  /** Rapid positioning at maximum traverse speed.
   *  Coords: `{ x?: string, y?: string, z?: string }` where
   *  each value is a literal number like "+50" or a $N reference like "$14".
   *  `mcode` (optional) appends a miscellaneous function to the block
   *  (e.g. "M3" to switch the spindle on while positioning).
   *  `{ type, coords: object, comment?: string, mcode?: string }` */
  RAPID: 'rapid',

  /** Linear interpolation at a specific feed rate.
   *  Coords have the same format as RAPID. `m90: true` appends M90
   *  (rounded corner transitions), as used in the real chamfer programs.
   *  `mcode` (optional) appends a miscellaneous function to the block.
   *  `{ type, coords: object, feed: number, comment?: string, m90?: boolean, mcode?: string }` */
  LINEAR: 'linear',

  /** Fixed cycle definition (e.g. CYCL DEF 207). Never written as raw
   *  dialect text — the postprocessor builds the CYCL DEF syntax.
   *  `{ type, cycle: number, title: string,
   *      params: [{ q: number, value: number, decimals: number, label?: string }] }` */
  CYCLE_DEF: 'cycleDef',

  /** Cycle call to execute the previously defined fixed cycle.
   *  `spindle` (optional) appends a miscellaneous function (e.g. "M3").
   *  `{ type, spindle?: string }` */
  CYCLE_CALL: 'cycleCall',

  /** Helical (thread milling) segment around a center, one full revolution.
   *  Control-agnostic: `direction` is 'cw' | 'ccw' viewed from +Z (down);
   *  `angle` is the incremental polar angle in degrees (360 per revolution,
   *  sign = rotary sense — must match `direction`); `zStep` is the
   *  incremental Z travel per revolution (negative = descending).
   *  `{ type, center: { x: string, y: string }, angle: number, zStep: number,
   *      direction: 'cw' | 'ccw', feed: number, comment?: string }` */
  HELIX: 'helix',

  /** Spindle on.
   *  `{ type, speed: number, direction: 'cw' | 'ccw' }` */
  SPINDLE: 'spindle',

  /** Spindle stop.
   *  `{ type }` */
  SPINDLE_STOP: 'spindleStop',
};

export function createBlock(type, data) {
  return { type, ...data };
}
