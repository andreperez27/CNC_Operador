import { describe, it, expect } from 'vitest';
import { buildProgramName, buildEngravingFileName, sanitizeProgramName } from '../src/core/postprocessors/programName';

/**
 * Nome do .H do Gravador: 5 letras do texto + _MMAA (operador pode ajustar).
 */

const OCT2026 = new Date(2026, 9, 15, 12, 0, 0);

describe('buildProgramName — esquema atual preservado', () => {
  it('gravacao + carimbo AAAAMMDD', () => {
    expect(buildProgramName('gravacao', OCT2026)).toBe('GRAVACAO_20261015');
  });
});

describe('buildEngravingFileName — texto + _MMAA', () => {
  it('ANDRE HENRIQUE em out/2026 → andre_1026', () => {
    expect(buildEngravingFileName('ANDRE HENRIQUE', OCT2026)).toBe('andre_1026');
  });

  it('só 5 [a-z0-9] da primeira linha, sem acento, minúsculas', () => {
    expect(buildEngravingFileName('JOSÉ das Peças', OCT2026)).toBe('josed_1026');
    expect(buildEngravingFileName('A-B_C.D/E+F', OCT2026)).toBe('abcde_1026');
    expect(buildEngravingFileName('  AN', OCT2026)).toBe('an_1026');
    expect(buildEngravingFileName('CNC\nOPERADOR', OCT2026)).toBe('cnc_1026');
  });

  it('sem letras/números → gravacao; mês com zero', () => {
    expect(buildEngravingFileName('---', OCT2026)).toBe('gravacao_1026');
    expect(buildEngravingFileName('', new Date(2026, 0, 5))).toBe('gravacao_0126');
    expect(buildEngravingFileName(null, OCT2026)).toBe('gravacao_1026');
  });
});

describe('sanitizeProgramName — ajuste do operador', () => {
  it('minúsculas, sem acento, mantém _, teto 16', () => {
    expect(sanitizeProgramName('Minha Peça 42!')).toBe('minhapeca42');
    expect(sanitizeProgramName('abcdefghijklmnopqrs')).toBe('abcdefghijklmnop');
    expect(sanitizeProgramName('---')).toBe('');
    expect(sanitizeProgramName('')).toBe('');
  });
});
