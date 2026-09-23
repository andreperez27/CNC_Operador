import { describe, it, expect } from 'vitest';
import { TOOL_TYPES, TOOL_TYPE_LIST, getToolType, isKnownToolType } from '../src/core/tools/toolTypes';

describe('core/tools/toolTypes — catálogo canônico', () => {
  it('lista os 4 tipos de ferramenta', () => {
    expect(TOOL_TYPE_LIST.map((t) => t.id).sort()).toEqual(
      ['ballNose', 'chamferMill', 'endMill', 'toroidal']
    );
  });

  it('Reff conforme o tipo (referência T2–T4 do inventário)', () => {
    expect(TOOL_TYPES.TOROIDAL.getReff(16, 0.8)).toBe(0.8);
    expect(TOOL_TYPES.BALL_NOSE.getReff(16, 0.8)).toBe(8); // D/2, r ignorado
    expect(TOOL_TYPES.END_MILL.getReff(16, 0.8)).toBe(0);  // r ignorado
    expect(TOOL_TYPES.CHAMFER_MILL.getReff(16, 0.8)).toBe(0);
  });

  it('getToolType por id e fallback tórica', () => {
    expect(getToolType('endMill').id).toBe('endMill');
    expect(getToolType('inexistente').id).toBe('toroidal');
  });

  it('isKnownToolType distingue tipos válidos', () => {
    expect(isKnownToolType('toroidal')).toBe(true);
    expect(isKnownToolType('furadeira')).toBe(false);
    expect(isKnownToolType(undefined)).toBe(false);
  });
});