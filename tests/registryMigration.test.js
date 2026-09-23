import { describe, it, expect } from 'vitest';
import { getGenerator } from '../src/features/gcode/registry/registry';

describe('migração do G-Code legado — chanfro via pipeline canônico', () => {
  const gen = getGenerator('chanfro_aresta_reta_torica');

  it('gerador legado registrado com solve/generate canônicos', () => {
    expect(gen).not.toBeNull();
    expect(gen.validate).toBeTypeOf('function');
    expect(gen.solve).toBeTypeOf('function');
    expect(gen.generate).toBeTypeOf('function');
    expect(gen.previewComponent).toBeTypeOf('function'); // componente React
  });

  it('solve produz modelo canônico compatível com o preview legado', () => {
    const solved = gen.solve({ L: 100, C: 2, A: 45, D: 12, r: 2, passeZ: 0.3, rpm: 3000, av: 600 });
    expect(solved).not.toBeNull();
    expect(solved.profZ).toBeCloseTo(1.4142135624, 9);
    expect(solved.largX).toBeCloseTo(1.4142135624, 9);
    expect(solved.nPasses).toBeGreaterThan(0);
    expect(solved.type).toBe('external');
  });

  it('solve retorna null para entrada inválida (sem crash)', () => {
    expect(gen.solve({ L: 100, C: 2, A: 0, D: 12, r: 2, passeZ: 0.3, rpm: 3000, av: 600 })).toBeNull();
    expect(gen.solve({ L: 100, C: 2, A: 45, D: 12, r: 12, passeZ: 0.3, rpm: 3000, av: 600 })).toBeNull();
    expect(gen.solve({ L: 100, C: 2, A: 45, D: 12, r: 2, passeZ: 0, rpm: 3000, av: 600 })).toBeNull();
  });

  it('generate produz programa Heidenhain IR (BEGIN/END PGM)', () => {
    const solved = gen.solve({ L: 100, C: 2, A: 45, D: 12, r: 2, passeZ: 0.3, rpm: 3000, av: 600 });
    const program = gen.generate(null, solved);
    expect(program).toContain('BEGIN PGM CHAMFEREXTERNAL_');
    expect(program).toContain('END PGM CHAMFEREXTERNAL_');
    expect(program).toContain('FN 12: IF +Q30 LT +Q31 GOTO LBL 1');
    expect(program).toContain('M90'); // loop compacto de produção
    expect(program).toContain('M30');
  });

  it('generate sem modelo retorna mensagem de erro (padrão legado)', () => {
    expect(gen.generate(null, null)).toBe('; Erro: parametros invalidos ou insuficientes.');
  });

  it('validate legado continua bloqueando parâmetros <= 0', () => {
    expect(gen.validate({ L: 0, C: 2, A: 45, D: 12, r: 2, passeZ: 0.3, rpm: 3000, av: 600 })).not.toBeNull();
    expect(gen.validate({ L: 100, C: 2, A: 45, D: 12, r: 2, passeZ: 0.3, rpm: 3000, av: 600 })).toBeNull();
  });
});