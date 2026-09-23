import { describe, it, expect } from 'vitest';
import {
  solveRadius,
  buildRadiusProgram,
  buildRadiusIR,
} from '../src/core/machining/radius/index';
import { getGenerator, getGeneratorList } from '../src/features/gcode/registry/registry';
import { roundingSolver } from '../src/features/gcode/solvers/roundingSolver';
import { roundingTemplate } from '../src/features/gcode/templates/roundingTemplate';
import { solveRadiusLegacy } from '../src/features/gcode/registry/canonicalRadius';
import { buildRadiusPreviewScene } from '../src/features/heidenhain/preview/buildRadiusPreviewScene';

const BOOK_VALUES = { R: 20, D: 25, r: 0.8, incremento: 20 }; // planilha linhas 17–24

function defaultInput(overrides) {
  return {
    type: 'external',
    radius: BOOK_VALUES.R,
    tool: { type: 'toroidal', diameter: BOOK_VALUES.D, radius: BOOK_VALUES.r },
    strategy: { passDepth: BOOK_VALUES.incremento },
    plane: 'XZ',
    origin: 'vertex',
    length: 100,
    feed: 600,
    rpm: 3000,
    safety: 10,
    toolNumber: 1,
    sobre: 0,
    ...overrides,
  };
}

describe('solveRadius — valores de referência da planilha', () => {
  it('Q4 e Q6 reproduzem a planilha (R=20,D=25,r=0,8,inc=20)', () => {
    const r = solveRadius(defaultInput());
    expect(r.valid).toBe(true);
    expect(r.model.q4).toBeCloseTo(-8.3, 9);              // Q4 = −8,3
    expect(r.model.q6).toBeCloseTo(12.484609690826531, 9); // Q6 = 12,484609690826531
  });

  it('grandezas geométricas: rho = R+r, Xc = (D/2−r)−R', () => {
    const r = solveRadius(defaultInput());
    const m = r.model;
    expect(m.rho).toBeCloseTo(20.8, 12);
    expect(m.xCenter).toBeCloseTo(-8.3, 10);
    expect(m.q4).toBeCloseTo(m.xCenter, 12);
  });

  it('incremento variado converge para o mesmo círculo (raio ρ constante)', () => {
    for (const inc of [0.5, 1, 7, 12, 19.99, 20, 30, 40]) {
      const r = solveRadius(defaultInput({ strategy: { passDepth: inc } }));
      expect(r.valid).toBe(true);
      for (const p of r.model.passes) {
        const d = Math.hypot(p.x - r.model.xCenter, p.z - r.model.rho);
        expect(Math.abs(d - r.model.rho)).toBeLessThanOrEqual(1e-9);
      }
    }
  });
});

describe('solveRadius — casos geométricos (Prompt 014 §9)', () => {
  it('R > r — válido', () => {
    const r = solveRadius(defaultInput({ radius: 5, tool: { type: 'toroidal', diameter: 12, radius: 2 } }));
    expect(r.valid).toBe(true);
    expect(r.validation.errors).toHaveLength(0);
  });

  it('R = r — válido com aviso (limite de tangência)', () => {
    const r = solveRadius(defaultInput({ radius: 2, tool: { type: 'toroidal', diameter: 12, radius: 2 } }));
    expect(r.valid).toBe(true);
    expect(r.validation.warnings.some((w) => w.code === 'WARN_R_EQUALS_R')).toBe(true);
  });

  it('R < r — INVALID_RADIUS_RANGE (estruturado, não calcula)', () => {
    const r = solveRadius(defaultInput({ radius: 1, tool: { type: 'toroidal', diameter: 12, radius: 2 } }));
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
    expect(r.validation.errors[0].code).toBe('INVALID_RADIUS_RANGE');
    expect(r.validation.errors[0].field).toBe('r');
  });

  it('r = 0 (fresa topo) — válido, rho = R', () => {
    const r = solveRadius(defaultInput({ radius: 5.6, tool: { type: 'endMill', diameter: 12, radius: 0 } }));
    expect(r.valid).toBe(true);
    expect(r.model.rho).toBe(5.6);
  });

  it('R = 0 — INVALID_RADIUS', () => {
    const r = solveRadius(defaultInput({ radius: 0 }));
    expect(r.valid).toBe(false);
    expect(r.validation.errors[0].code).toBe('INVALID_RADIUS');
  });

  it('D = 0 — INVALID_TOOL_DIAMETER', () => {
    const r = solveRadius(defaultInput({ tool: { type: 'toroidal', diameter: 0, radius: 0.8 } }));
    expect(r.valid).toBe(false);
    expect(r.validation.errors[0].code).toBe('INVALID_TOOL_DIAMETER');
  });

  it('r > D/2 (tórica) — INVALID_TOOL_RADIUS', () => {
    const r = solveRadius(defaultInput({ tool: { type: 'toroidal', diameter: 16, radius: 9 } }));
    expect(r.valid).toBe(false);
    expect(r.validation.errors[0].code).toBe('INVALID_TOOL_RADIUS');
  });

  it('incremento = 0 — INVALID_INCREMENT (sem loop infinito)', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: 0 } }));
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
    expect(r.validation.errors[0].code).toBe('INVALID_INCREMENT');
  });

  it('incremento negativo — INVALID_INCREMENT', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: -2 } }));
    expect(r.valid).toBe(false);
    expect(r.validation.errors[0].code).toBe('INVALID_INCREMENT');
  });

  it('incremento maior que o domínio — passe único explícito (aviso)', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: 500 } }));
    expect(r.valid).toBe(true);
    expect(r.model.nPasses).toBe(1);
    expect(r.model.passes[0].z).toBeCloseTo(20, 12);
    expect(r.validation.warnings.some((w) => w.code === 'WARN_SINGLE_PASS')).toBe(true);
  });

  it('incremento muito pequeno — aviso WARN_MANY_PASSES (sem travar)', () => {
    const r = solveRadius(defaultInput({ radius: 5, strategy: { passDepth: 0.005 } }));
    expect(r.valid).toBe(true);
    expect(r.model.nPasses).toBeGreaterThan(200);
    expect(r.validation.warnings.some((w) => w.code === 'WARN_MANY_PASSES')).toBe(true);
  });

  it('R = NaN — INVALID_RADIUS', () => {
    const r = solveRadius(defaultInput({ radius: NaN }));
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
  });

  it('R = Infinity — INVALID_RADIUS', () => {
    const r = solveRadius(defaultInput({ radius: Infinity }));
    expect(r.valid).toBe(false);
  });

  it('incremento = NaN — INVALID_INCREMENT', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: NaN } }));
    expect(r.valid).toBe(false);
  });
});

describe('solveRadius — trajetória (último passe, overshoot, tangência)', () => {
  it('último passe termina EXATO em z = R (sem overshoot, sem passe extra)', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: 0.7 } }));
    const passes = r.model.passes;
    expect(passes[passes.length - 1].z).toBeCloseTo(20, 9);
    expect(passes[passes.length - 1].isLast).toBe(true);
    expect(passes[0].isFirst).toBe(true);
    for (const p of passes) {
      expect(p.z).toBeLessThanOrEqual(20 + 1e-9);
    }
  });

  it('todos os pontos pertencem ao círculo (X−Xc)²+(Z−ρ)² = ρ²', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: 1.3 } }));
    for (const p of r.model.passes) {
      const lhs = Math.pow(p.x - r.model.xCenter, 2) + Math.pow(p.z - r.model.rho, 2);
      expect(Math.abs(lhs - Math.pow(r.model.rho, 2))).toBeLessThanOrEqual(1e-9);
    }
  });

  it('X nunca ultrapassa Xc + ρ (máximo geométrico do círculo)', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: 0.3 } }));
    for (const p of r.model.passes) {
      expect(p.x).toBeLessThanOrEqual(r.model.xCenter + r.model.rho + 1e-9);
    }
  });

  it('trajetória identifica primeiro/intermediário/último passe', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: 5 } }));
    const passes = r.model.passes;
    const first = passes.filter((p) => p.isFirst);
    const last = passes.filter((p) => p.isLast);
    expect(first).toHaveLength(1);
    expect(last).toHaveLength(1);
    expect(first[0].pass).toBe(1);
    expect(last[0].pass).toBe(passes.length);
  });

  it('ponto final (position final) = último ponto da trajetória', () => {
    const r = solveRadius(defaultInput());
    expect(r.model.trajectory.end).toEqual(r.model.passes[r.model.passes.length - 1]);
    expect(r.model.trajectory.start).toEqual(r.model.passes[0]);
  });
});

describe('IR canônico', () => {
  it('buildRadiusIR produz blocos IR (sem sintaxe de dialeto embutida)', () => {
    const r = solveRadius(defaultInput());
    const blocks = buildRadiusIR(r.model);
    const types = blocks.map((b) => b.type);
    expect(types).toContain('toolCall');
    expect(types).toContain('fn0');
    expect(types).toContain('define');
    expect(types).toContain('label');
    expect(types).toContain('jump');
    expect(types).toContain('linear');
    expect(types).toContain('spindleStop');

    const q21 = blocks.find((b) => b.type === 'assign' && b.target === '$21');
    expect(q21).toBeTruthy();
    expect(q21.expression).toBe('$4 + SQRT($20 * $22 - $20 * $20)');
  });

  it('tool call usa o número da ferramenta do operador (T5) e RPM do operador', () => {
    const r = solveRadius(defaultInput({ toolNumber: 5, rpm: 4500 }));
    const blocks = buildRadiusIR(r.model);
    const tc = blocks.find((b) => b.type === 'toolCall');
    expect(tc.tool).toBe(5);
    expect(tc.speed).toBe(4500);
  });
});

describe('postprocessor e programa .H', () => {
  it('programa passa pelo postprocessor (BEGIN/END PGM, numeração, M30)', () => {
    const r = solveRadius(defaultInput());
    const prog = buildRadiusProgram(r.model, { programName: 'RAIO_TESTE_20260910' });
    expect(prog).toContain('BEGIN PGM RAIO_TESTE_20260910 MM ');
    expect(prog).toContain('END PGM RAIO_TESTE_20260910 MM ');
    expect(prog).toMatch(/^0 {2}/);             // numeração iniciada em 0
    expect(prog).toContain('L Z+100 R0 FMAX M30'); // retorno seguro
    expect(prog).toContain('M90');               // cantos arredondados na varredura
  });

  it('avanço e RPM do operador chegam ao .H (sem valores fixos)', () => {
    const r = solveRadius(defaultInput({ feed: 500, rpm: 2200, toolNumber: 2 }));
    const prog = buildRadiusProgram(r.model, { programName: 'RAIO_FEED_TEST' });
    expect(prog).toContain('TOOL CALL 2 Z S2200');
    expect(prog).toContain('F250');   // mergulho = av/2
    expect(prog).toContain('F500');   // avanço de corte
  });

  it('cabeçalho Q da planilha no programa (Q1=R, Q2=D, Q3=r, Q4=Xc, Q5=inc)', () => {
    const r = solveRadius(defaultInput());
    const prog = buildRadiusProgram(r.model, { programName: 'RAIO_HEADER_TEST' });
    expect(prog).toContain('FN 0: Q1 =+20 ;RAIO DE ARREDONDAMENTO');
    expect(prog).toContain('FN 0: Q5 =+20 ;INCREMENTO POR PASSE (Z)');
  });

  it('programa sem nome usa buildProgramName(operationId)', () => {
    const r = solveRadius(defaultInput());
    const prog = buildRadiusProgram(r.model);
    expect(prog).toContain('BEGIN PGM RADIUSEXTERNAL_');
  });
});

describe('pipeline end-to-end (input → solver → strategy → trajectory → IR → postprocessor → .H)', () => {
  it('produz programa válido pelo pipeline canônico', () => {
    const input = defaultInput({ toolNumber: 3, av: 400, rpm: 3000 });
    const result = solveRadius(input);
    expect(result.valid).toBe(true);

    const model = result.model;
    expect(model.nPasses).toBeGreaterThan(0);
    expect(model.passes.length).toBe(model.nPasses);
    expect(model.trajectory.points.length).toBe(model.nPasses);

    const program = buildRadiusProgram(model);
    expect(typeof program).toBe('string');
    expect(program.length).toBeGreaterThan(400);
    expect(program).toContain('BEGIN PGM');
    expect(program).toContain('TOOL CALL 3 Z S3000');
    expect(program).toContain('END PGM');
  });
});

describe('confronto com o legado (roundingTemplate) — divergência documentada', () => {
  it('novo ≠ legado: o novo reproduz a planilha (raio ρ), o legado usa arco R', () => {
    const legacy = roundingSolver({ L: 100, R: 20, D: 25, r: 0.8, incrZ: 20, rpm: 3000, av: 600 });
    expect(legacy.rTraj).toBe(20.8);

    const legacyProg = roundingTemplate(
      { L: 100, R: 20, D: 25, r: 0.8, incrZ: 20, rpm: 3000, av: 600 },
      legacy
    );

    const novo = solveRadius(defaultInput());
    const novoProg = buildRadiusProgram(novo.model, { programName: 'RAIO_DIVERG_TEST' });

    expect(novoProg).toContain('SQRT(Q20 * Q22 - Q20 * Q20)'); // arco de raio R + r
    expect(legacyProg).not.toContain('Q20 * Q22 - Q20 * Q20'); // legado: SQRT(R²−(R−Q10)²)
    // Y no último passe (z=R): planilha Q6 = 12,484609690826531; legado = 20,000
    expect(Math.abs(novo.model.q6 - 12.484609690826531)).toBeLessThan(1e-9);
    expect(Math.abs(novo.model.q6 - 20)).toBeGreaterThan(7);   // ≥ 7 mm de diferença
  });
});

describe('registry — raio localizável (G-Code Rápido via registry)', () => {
  it('entrada `raio_aresta_reta_torica` presente e com pipeline canônico', () => {
    const ids = getGeneratorList().map((g) => g.id);
    expect(ids).toContain('raio_aresta_reta_torica');
    const gen = getGenerator('raio_aresta_reta_torica');
    expect(gen).toBeTruthy();
    const params = { L: 100, R: 20, D: 25, r: 0.8, incrZ: 20, rpm: 3000, av: 600, toolNumber: 1 };
    const solved = gen.solve(params);
    expect(solved).toBeTruthy();
    expect(solved.q4).toBeCloseTo(-8.3, 9);
    expect(solved.q6).toBeCloseTo(12.484609690826531, 9);
    const texto = gen.generate(params, solved);
    expect(texto).toContain('BEGIN PGM RADIUSEXTERNAL_');
  });

  it('adapter legado-para-canônico (canonicalRadius) retorna modelo ou null', () => {
    const m = solveRadiusLegacy({ L: 100, R: 20, D: 25, r: 0.8, incrZ: 20, rpm: 3000, av: 600 });
    expect(m).toBeTruthy();
    expect(m.operationId).toBe('radiusExternal');
    expect(solveRadiusLegacy({ L: 100, R: 4, D: 25, r: 9, incrZ: 20, rpm: 3000, av: 600 })).toBeNull();
  });

  it('adapter aceita tipo interno com largura de bolsao (clearance + operationId)', () => {
    const m = solveRadiusLegacy({
      L: 60, R: 5, D: 16, r: 0.8, incrZ: 1, rpm: 3000, av: 600,
      tipo: 'internal', alojamentoLargura: 30,
    });
    expect(m).toBeTruthy();
    expect(m.operationId).toBe('radiusInternal');
    expect(m.clearance).toBeTruthy();
    expect(m.clearance.valid).toBe(true);
    expect(solveRadiusLegacy({
      L: 60, R: 5, D: 16, r: 0.8, incrZ: 1, rpm: 3000, av: 600,
      tipo: 'internal', alojamentoLargura: 17,
    })).toBeNull();
  });

  it('generator do G-Code Rapido alterna tipo no solve e valida bolsao', () => {
    const gen = getGenerator('raio_aresta_reta_torica');
    const pExt = { L: 100, R: 20, D: 25, r: 0.8, incrZ: 0.5, rpm: 3000, av: 600, tipo: 'external' };
    expect(gen.validate(pExt)).toBeNull();
    expect(gen.solve(pExt).operationId).toBe('radiusExternal');

    const pInt = { ...pExt, tipo: 'internal', alojamentoLargura: 30, L: 60, R: 5, D: 16 };
    expect(gen.validate(pInt)).toBeNull();
    expect(gen.solve(pInt).operationId).toBe('radiusInternal');
    expect(gen.validate({ ...pInt, alojamentoLargura: 1 })).toBeTruthy();
    expect(gen.validate({ ...pInt, alojamentoLargura: undefined })).toBeTruthy();
  });
});

describe('preview geométrico', () => {
  it('modelo de preview é finito e coerente (tool sem inversão de arco)', () => {
    const r = solveRadius(defaultInput({ strategy: { passDepth: 2 } }));
    const scene = buildRadiusPreviewScene(r.model, 'external');
    expect(Number.isNaN(scene.origin.x)).toBe(false);
    expect(scene.tool.width).toBeGreaterThan(0);
    expect(scene.tool.height).toBeGreaterThan(0);
    expect(scene.tool.cornerR).toBeGreaterThan(0);
    expect(scene.tool.left).toBeLessThan(scene.tool.right);
    expect(scene.tool.top).toBeLessThan(scene.tool.bottom);
    expect(scene.tangency.radius).toBeGreaterThan(0);
    expect(scene.workpiece.raw.length % 2).toBe(0);
    expect(scene.labels.length).toBeGreaterThan(0);
    for (const pt of scene.trajectory) {
      expect(Number.isFinite(pt.x)).toBe(true);
      expect(Number.isFinite(pt.y)).toBe(true);
    }
  });
});

describe('solveRadius — raio INTERNO (canto do bolsão, espelho em X)', () => {
  const INT = { radius: 5, tool: { type: 'toroidal', diameter: 16, radius: 0.8 }, length: 60 };

  function intInput(overrides) {
    return defaultInput({
      type: 'internal',
      ...INT,
      clearance: { pocketWidth: 30 },
      ...overrides,
    });
  }

  it('geometria: Xc = R − (D/2 − r), xAt(R) = −7,944562646538, rho = 5,8', () => {
    const r = solveRadius(intInput());
    expect(r.valid).toBe(true);
    const m = r.model;
    expect(m.rho).toBeCloseTo(5.8, 12);
    expect(m.xCenter).toBeCloseTo(-2.2, 10);          // 5 − 7,2
    expect(m.q4).toBeCloseTo(-2.2, 12);
    expect(m.xAt(m.profZ)).toBeCloseTo(-7.944562646538, 9);
  });

  it('todos os pontos pertencem ao círculo espelhado (X−Xc)²+(Z−ρ)² = ρ²', () => {
    const r = solveRadius(intInput({ strategy: { passDepth: 0.9 } }));
    for (const p of r.model.passes) {
      const lhs = Math.pow(p.x - r.model.xCenter, 2) + Math.pow(p.z - r.model.rho, 2);
      expect(Math.abs(lhs - Math.pow(r.model.rho, 2))).toBeLessThanOrEqual(1e-9);
    }
  });

  it('X nunca ultrapassa o mínimo geométrico Xc − ρ (sentido invertido)', () => {
    const r = solveRadius(intInput({ strategy: { passDepth: 0.4 } }));
    for (const p of r.model.passes) {
      expect(p.x).toBeGreaterThanOrEqual(r.model.xCenter - r.model.rho - 1e-9);
      expect(p.x).toBeLessThanOrEqual(r.model.xAt(0) + 1e-9); // X decrescente
    }
  });

  it('xCorner fica dentro do bolsão (seguranca + D/2), não além da parede', () => {
    const r = solveRadius(intInput({ safety: 10 }));
    expect(r.model.xCorner).toBeCloseTo(18, 9); // 10 + 16/2
    expect(r.model.xCorner).toBeGreaterThan(r.model.xCenter);
  });

  it('operationId = radiusInternal', () => {
    const r = solveRadius(intInput());
    expect(r.model.operationId).toBe('radiusInternal');
  });

  it('clearance válido computado (pocketWidth ≥ D + 2)', () => {
    const r = solveRadius(intInput());
    expect(r.validation.errors).toHaveLength(0);
    expect(r.model.clearance).toBeTruthy();
    expect(r.model.clearance.valid).toBe(true);
  });

  it('bolsão sem largura — INVALID_POCKET_WIDTH', () => {
    const r = solveRadius(intInput({ clearance: undefined }));
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
    expect(r.validation.errors.some((e) => e.code === 'INVALID_POCKET_WIDTH')).toBe(true);
  });

  it('ferramenta não cabe no bolsão — INVALID_CLEARANCE', () => {
    const r = solveRadius(intInput({ clearance: { pocketWidth: 17 } }));
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
    const err = r.validation.errors.find((e) => e.code === 'INVALID_CLEARANCE');
    expect(err).toBeTruthy();
    expect(err.message).toContain('18.0');
  });

  it('externo sem clearance continua válido (campo ignorado)', () => {
    const r = solveRadius(defaultInput());
    expect(r.valid).toBe(true);
  });
});

describe('IR e programa do raio INTERNO', () => {
  const INT = { radius: 5, tool: { type: 'toroidal', diameter: 16, radius: 0.8 }, length: 60 };

  it('Q21 usa SUBTRAÇÃO (espelho): Q4 − SQRT(...)', () => {
    const r = solveRadius(defaultInput({ type: 'internal', ...INT, clearance: { pocketWidth: 30 } }));
    const blocks = buildRadiusIR(r.model);
    const q21 = blocks.find((b) => b.type === 'assign' && b.target === '$21');
    expect(q21.expression).toBe('$4 - SQRT($20 * $22 - $20 * $20)');
  });

  it('comentários e rótulos do bolsão no programa .H', () => {
    const r = solveRadius(defaultInput({ type: 'internal', ...INT, clearance: { pocketWidth: 30 } }));
    const prog = buildRadiusProgram(r.model, { programName: 'RAIO_INT_TEST' });
    expect(prog).toContain('RAIO INTERNO - ARESTA RETA');
    expect(prog).toContain('COMPRIMENTO DA BOLSAO');
    expect(prog).toContain('DIST. DE SEGURANCA DA PAREDE DO BOLSAO');
    expect(prog).toContain('Q4 - SQRT(Q20 * Q22 - Q20 * Q20)');
  });
});