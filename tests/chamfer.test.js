import { describe, it, expect } from 'vitest';
import { solveChamfer, buildChamferProgram } from '../src/core/machining/chamfer/index';
import { solveExternalChamfer } from '../src/features/heidenhain/math/chamferExternalMath';
import { solveInternalChamfer } from '../src/features/heidenhain/math/chamferInternalMath';
import { buildPassStrategy } from '../src/features/heidenhain/strategy/strategyEngine';
import { chamferExternalTemplate } from '../src/features/heidenhain/program/templates/chamferExternalTemplate';
import { chamferInternalTemplate } from '../src/features/heidenhain/program/templates/chamferInternalTemplate';
import { toQParams, EXTERNAL_CHAMFER_MAP, DEFAULT_MAP } from '../src/features/heidenhain/params/parameterEngine';

const EXT_PARAMS = {
  A: 45, C: 5, D: 16, r: 0.8, L: 100, passeZ: 0.3,
  sobre: 0, rpm: 3000, av: 600, numeroFerramenta: 1,
  distanciaSeguranca: 10, blocoW: '', blocoL: '', blocoH: '',
  toolType: 'toroidal',
};

const INT_PARAMS = { ...EXT_PARAMS, alojamentoLargura: 50 };

const BASE_INPUT = {
  type: 'external',
  width: 5, angle: 45,
  tool: { type: 'toroidal', diameter: 16, radius: 0.8 },
  strategy: { passDepth: 0.3 },
  plane: 'XZ', origin: 'vertex',
  length: 100, feed: 600, rpm: 3000, safety: 10, toolNumber: 1,
  sobre: 0, stock: { w: '', l: '', h: '' },
};

function externalInput(overrides) {
  return { ...BASE_INPUT, ...overrides };
}

function internalInput(overrides) {
  return {
    ...BASE_INPUT,
    type: 'internal',
    origin: 'corner',
    clearance: { pocketWidth: 50 },
    ...overrides,
  };
}

describe('solveChamfer — números de referência (inventário T1–T13)', () => {
  it('EXTERNO 45°/C5/D16/r0,8 — T1 (valores executados/validados)', () => {
    const r = solveChamfer(externalInput());
    expect(r.valid).toBe(true);
    const m = r.model;
    expect(m.profZ).toBeCloseTo(3.5355339059, 9);
    expect(m.largX).toBeCloseTo(3.5355339059, 9);
    expect(m.cotA).toBeCloseTo(1, 12);
    expect(m.Reff).toBe(0.8);
    expect(m.xCentro).toBeCloseTo(-2.4041630560, 9);
    expect(m.nPasses).toBe(12);
    expect(m.incReal).toBeCloseTo(0.2946278255, 9);
    expect(m.passes).toHaveLength(12);
    expect(m.passes[11].x).toBeCloseTo(1.1313708499, 9);
    expect(m.passes[11].z).toBeCloseTo(3.5355339059, 9);
    expect(m.passes[11].isLast).toBe(true);
    expect(m.chamfer.vertical.x).toBeCloseTo(0, 12);
    expect(m.chamfer.vertical.z).toBeCloseTo(3.5355339059, 9);
    expect(m.chamfer.horizontal.x).toBeCloseTo(-3.5355339059, 9);
    expect(m.chamfer.horizontal.z).toBeCloseTo(0, 12);
  });

  it('EXTERNO fresa esférica (ballNose) — T2', () => {
    const r = solveChamfer(externalInput({ tool: { type: 'ballNose', diameter: 16, radius: 0.8 } }));
    expect(r.model.Reff).toBe(8);
    expect(r.model.xCentro).toBeCloseTo(7.7781745931, 9);
  });

  it('EXTERNO fresa topo (endMill) — T4', () => {
    const r = solveChamfer(externalInput({ tool: { type: 'endMill', diameter: 16, radius: 0 } }));
    expect(r.model.Reff).toBe(0);
    expect(r.model.xCentro).toBeCloseTo(-3.5355339059, 9);
  });

  it('EXTERNO A=1° — xCentro grande mas finito (~40,84) + aviso', () => {
    const r = solveChamfer(externalInput({ angle: 1 }));
    expect(r.valid).toBe(true);
    expect(r.model.xCentro).toBeCloseTo(40.8397123231, 7);
    expect(r.model.profZ).toBeCloseTo(0.0872620322, 9);
    expect(r.validation.warnings.some((w) => w.code === 'WARN_SMALL_ANGLE')).toBe(true);
  });

  it('INTERNO 45°/C5/D16/r0,8 — xCentro, trajXEnd, folga', () => {
    const r = solveChamfer(internalInput());
    expect(r.valid).toBe(true);
    const m = r.model;
    expect(m.xCentro).toBeCloseTo(0.5656854249, 9);
    expect(m.trajXEnd).toBeCloseTo(-2.9698484810, 9);
    expect(m.clearance.valid).toBe(true);
    expect(m.chamfer.top).toEqual({ x: 0, z: 0 });
    expect(m.chamfer.bottom.x).toBeCloseTo(-3.5355339059, 9);
    expect(m.chamfer.bottom.z).toBeCloseTo(-3.5355339059, 9);
    expect(m.passes[11].x).toBeCloseTo(-2.9698484810, 9); // Q21 = Q10 − Q20·Q22
  });

  it('paridade com os motores legados (Heidenhain)', () => {
    const legacyExt = solveExternalChamfer(EXT_PARAMS);
    const canExt = solveChamfer(externalInput());
    expect(legacyExt.xCentro).toBe(canExt.model.xCentro);
    expect(legacyExt.profZ).toBe(canExt.model.profZ);
    expect(legacyExt.largX).toBe(canExt.model.largX);
    expect(legacyExt.cotA).toBe(canExt.model.cotA);
    expect(legacyExt.Reff).toBe(canExt.model.Reff);
    expect(legacyExt.contact.toolCenter).toEqual(canExt.model.contact.toolCenter);

    const legacyInt = solveInternalChamfer(INT_PARAMS);
    const canInt = solveChamfer(internalInput());
    expect(legacyInt.xCentro).toBe(canInt.model.xCentro);
    expect(legacyInt.trajXEnd).toBe(canInt.model.trajXEnd);
    expect(legacyInt.clearance.required).toBe(canInt.model.clearance.required);
  });

  it('estratégia (HeidenhainPage) == estratégia canônica, inclusive sinal interno', () => {
    const legacyExt = solveExternalChamfer(EXT_PARAMS);
    const stratExt = buildPassStrategy(legacyExt, EXT_PARAMS);
    const canExt = solveChamfer(externalInput());
    expect(stratExt.nPasses).toBe(canExt.model.nPasses);
    expect(stratExt.incReal).toBe(canExt.model.incReal);
    for (let i = 0; i < stratExt.passes.length; i++) {
      expect(stratExt.passes[i].x).toBe(canExt.model.passes[i].x);
    }

    const legacyInt = solveInternalChamfer(INT_PARAMS);
    const stratInt = buildPassStrategy(legacyInt, INT_PARAMS);
    const canInt = solveChamfer(internalInput());
    for (let i = 0; i < stratInt.passes.length; i++) {
      expect(stratInt.passes[i].x).toBe(canInt.model.passes[i].x);
    }
  });
});

describe('solveChamfer — entradas inválidas (segurança)', () => {
  it('A=0° → INVALID_ANGLE (nunca Infinity)', () => {
    const r = solveChamfer(externalInput({ angle: 0 }));
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
    expect(r.validation.errors[0].code).toBe('INVALID_ANGLE');
    expect(r.validation.errors[0].field).toBe('A');
  });

  it('A=90° → INVALID_ANGLE', () => {
    const r = solveChamfer(externalInput({ angle: 90 }));
    expect(r.valid).toBe(false);
    expect(r.validation.errors[0].code).toBe('INVALID_ANGLE');
  });

  it('A=-5 → INVALID_ANGLE', () => {
    const r = solveChamfer(externalInput({ angle: -5 }));
    expect(r.valid).toBe(false);
  });

  it('passeZ=0 → INVALID_PASS_DEPTH (protege contra loop infinito/OOM)', () => {
    const r = solveChamfer(externalInput({ strategy: { passDepth: 0 } }));
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
    expect(r.validation.errors[0].code).toBe('INVALID_PASS_DEPTH');
  });

  it('passeZ negativo → INVALID_PASS_DEPTH', () => {
    const r = solveChamfer(externalInput({ strategy: { passDepth: -0.5 } }));
    expect(r.valid).toBe(false);
    expect(r.validation.errors[0].code).toBe('INVALID_PASS_DEPTH');
  });

  it('passeZ NaN → INVALID_PASS_DEPTH', () => {
    const r = solveChamfer(externalInput({ strategy: { passDepth: NaN } }));
    expect(r.valid).toBe(false);
    expect(r.validation.errors[0].code).toBe('INVALID_PASS_DEPTH');
  });

  it('largura 0/negativa → INVALID_WIDTH', () => {
    expect(solveChamfer(externalInput({ width: 0 })).validation.errors[0].code).toBe('INVALID_WIDTH');
    expect(solveChamfer(externalInput({ width: -2 })).validation.errors[0].code).toBe('INVALID_WIDTH');
  });

  it('D=0 → INVALID_TOOL_DIAMETER', () => {
    const r = solveChamfer(externalInput({ tool: { type: 'toroidal', diameter: 0, radius: 0.8 } }));
    expect(r.validation.errors[0].code).toBe('INVALID_TOOL_DIAMETER');
  });

  it('r > D/2 (tórica) → INVALID_TOOL_RADIUS', () => {
    const r = solveChamfer(externalInput({ tool: { type: 'toroidal', diameter: 16, radius: 9 } }));
    expect(r.validation.errors[0].code).toBe('INVALID_TOOL_RADIUS');
    expect(r.validation.errors[0].field).toBe('r');
  });

  it('r negativo → INVALID_TOOL_RADIUS', () => {
    const r = solveChamfer(externalInput({ tool: { type: 'toroidal', diameter: 16, radius: -1 } }));
    expect(r.validation.errors[0].code).toBe('INVALID_TOOL_RADIUS');
  });

  it('tipo de ferramenta desconhecido → INVALID_TOOL_TYPE', () => {
    const r = solveChamfer(externalInput({ tool: { type: 'furadeira', diameter: 16, radius: 0.8 } }));
    expect(r.validation.errors[0].code).toBe('INVALID_TOOL_TYPE');
  });

  it('tipo de chanfro desconhecido → INVALID_TYPE', () => {
    const r = solveChamfer(externalInput({ type: 'raio' }));
    expect(r.validation.errors[0].code).toBe('INVALID_TYPE');
  });

  it('interno: bolsão estreito (D=60, alojamento=50) → INVALID_CLEARANCE', () => {
    const r = solveChamfer(internalInput({
      tool: { type: 'toroidal', diameter: 60, radius: 2 },
      clearance: { pocketWidth: 50 },
    }));
    expect(r.valid).toBe(false);
    const e = r.validation.errors[0];
    expect(e.code).toBe('INVALID_CLEARANCE');
    expect(e.field).toBe('alojamentoLargura');
    expect(e.message).toContain('nao cabe no espaco');
  });

  it('interno: sem largura do bolsão → INVALID_POCKET_WIDTH', () => {
    const r = solveChamfer(internalInput({ clearance: { pocketWidth: 0 } }));
    expect(r.validation.errors[0].code).toBe('INVALID_POCKET_WIDTH');
  });

  it('depth override valido altera profZ e cotA de forma coerente', () => {
    const r = solveChamfer(externalInput({ depth: 4 }));
    expect(r.valid).toBe(true);
    expect(r.model.profZ).toBe(4);
    expect(r.model.cotA).toBeCloseTo(3.5355339059 / 4, 9);
    expect(r.model.passes[r.model.nPasses - 1].z).toBe(4);
    expect(r.validation.warnings.some((w) => w.code === 'WARN_DEPTH_OVERRIDE')).toBe(true);
  });

  it('depth override <= 0 → INVALID_DEPTH', () => {
    const r = solveChamfer(externalInput({ depth: 0 }));
    expect(r.validation.errors[0].code).toBe('INVALID_DEPTH');
  });

  it('muitos passes → aviso WARN_MANY_PASSES (sem travar)', () => {
    const r = solveChamfer(externalInput({ strategy: { passDepth: 0.005 } }));
    expect(r.valid).toBe(true);
    expect(r.model.nPasses).toBeGreaterThan(200);
    expect(r.validation.warnings.some((w) => w.code === 'WARN_MANY_PASSES')).toBe(true);
  });
});

describe('buildChamferProgram — paridade byte-a-byte com templates validados', () => {
  function fullModel(geo, params, op) {
    const strat = buildPassStrategy(geo, params);
    const toolD = Number(params.D) || 0;
    const seguranca = Number(params.distanciaSeguranca) || 0;
    return {
      ...geo,
      ...strat,
      seguranca,
      xCorner: seguranca + toolD / 2,
      dMeio: toolD / 2,
      yTotal: (params.L || 100) + seguranca,
      yStart: -(params.L || 100) / 2,
      yEnd: (params.L || 100) / 2,
      safeZ: 5,
      retrZ: 0.5,
      operationId: op,
    };
  }

  const NAME = 'PARIDADE_TESTE_H';

  it('chanfro externo — mesmo texto .H', () => {
    const legacyExt = solveExternalChamfer(EXT_PARAMS);
    const fullExt = fullModel(legacyExt, EXT_PARAMS, 'chamferExternal');
    const qExt = toQParams(fullExt, EXTERNAL_CHAMFER_MAP);
    const expected = chamferExternalTemplate(qExt, fullExt, NAME);

    const canExt = solveChamfer(externalInput());
    const actual = buildChamferProgram(canExt.model, { programName: NAME });

    expect(actual).toBe(expected);
  });

  it('chanfro interno — mesmo texto .H', () => {
    const legacyInt = solveInternalChamfer(INT_PARAMS);
    const fullInt = fullModel(legacyInt, INT_PARAMS, 'chamferInternal');
    const qInt = toQParams(fullInt, DEFAULT_MAP);
    const expected = chamferInternalTemplate(qInt, fullInt, NAME);

    const canInt = solveChamfer(internalInput());
    const actual = buildChamferProgram(canInt.model, { programName: NAME });

    expect(actual).toBe(expected);
  });

  it('programa contém BEGIN/END PGM com o nome informado', () => {
    const canExt = solveChamfer(externalInput());
    const program = buildChamferProgram(canExt.model, { programName: 'CHANFRO_20260910' });
    expect(program).toContain('BEGIN PGM CHANFRO_20260910 MM ');
    expect(program).toContain('END PGM CHANFRO_20260910 MM ');
    expect(program).toContain('BEGIN PGM');
  });

  it('programa sem nome usa buildProgramName(operationId)', () => {
    const canExt = solveChamfer(externalInput());
    const program = buildChamferProgram(canExt.model);
    expect(program).toContain('BEGIN PGM CHAMFEREXTERNAL_');
    const canInt = solveChamfer(internalInput());
    expect(buildChamferProgram(canInt.model)).toContain('BEGIN PGM CHAMFERINTERNAL_');
  });
});

describe('adapters legados — comportamento de exceção preservado', () => {
  it('solveExternalChamfer lança ValidationError com code para A=0', () => {
    try {
      solveExternalChamfer({ ...EXT_PARAMS, A: 0 });
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect(e.code).toBe('INVALID_ANGLE');
      expect(e.field).toBe('A');
    }
  });

  it('solveExternalChamfer lança para passeZ=0 (antes: loop infinito/OOM)', () => {
    try {
      solveExternalChamfer({ ...EXT_PARAMS, passeZ: 0 });
      throw new Error('deveria ter lançado');
    } catch (e) {
      expect(e.code).toBe('INVALID_PASS_DEPTH');
    }
  });

  it('solveInternalChamfer mantém erro de folga (mensagem válida de produção)', () => {
    expect(() => solveInternalChamfer({ ...INT_PARAMS, D: 60, r: 2, alojamentoLargura: 50 }))
      .toThrow('nao cabe no espaco');
  });
});