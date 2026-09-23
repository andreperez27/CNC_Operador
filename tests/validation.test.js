import { describe, it, expect } from 'vitest';
import {
  createValidation,
  addError,
  addWarning,
  finalize,
  isFiniteNumber,
  isFinitePositive,
  guard,
  raiseFirstError,
  ValidationError,
} from '../src/core/validation/validationEngine';

describe('core/validation/validationEngine', () => {
  it('cria resultado válido sem erros', () => {
    const v = createValidation();
    expect(v).toEqual({ valid: true, errors: [], warnings: [] });
  });

  it('addError invalida o resultado com código/campo/mensagem', () => {
    const v = createValidation();
    addError(v, 'INVALID_ANGLE', 'A', 'msg');
    expect(v.valid).toBe(false);
    expect(v.errors).toEqual([{ code: 'INVALID_ANGLE', field: 'A', message: 'msg' }]);
  });

  it('addWarning não invalida', () => {
    const v = createValidation();
    addWarning(v, 'WARN_SMALL_ANGLE', 'A', 'aviso');
    finalize(v);
    expect(v.valid).toBe(true);
    expect(v.warnings).toHaveLength(1);
  });

  it('isFiniteNumber/isFinitePositive rejeitam NaN/Infinity/string', () => {
    expect(isFiniteNumber(1)).toBe(true);
    expect(isFiniteNumber(NaN)).toBe(false);
    expect(isFiniteNumber(Infinity)).toBe(false);
    expect(isFiniteNumber('2')).toBe(false);
    expect(isFinitePositive(0)).toBe(false);
    expect(isFinitePositive(-1)).toBe(false);
  });

  it('guard registra erro apenas quando a condição falha', () => {
    const v = createValidation();
    expect(guard(v, true, 'X', 'f', 'ok')).toBe(true);
    expect(v.valid).toBe(true);
    expect(guard(v, false, 'Y', 'f2', 'erro')).toBe(false);
    expect(v.valid).toBe(false);
  });

  it('raiseFirstError lança ValidationError estrutural', () => {
    const v = createValidation();
    addError(v, 'INVALID_PASS_DEPTH', 'passeZ', 'profundidade por passe');
    expect(() => raiseFirstError(v)).toThrowError(ValidationError);
    try {
      raiseFirstError(v);
    } catch (e) {
      expect(e.code).toBe('INVALID_PASS_DEPTH');
      expect(e.field).toBe('passeZ');
      expect(e.message).toBe('profundidade por passe');
    }
  });

  it('raiseFirstError em resultado válido não lança', () => {
    expect(() => raiseFirstError(createValidation())).not.toThrow();
  });
});