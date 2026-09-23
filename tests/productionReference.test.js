import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { solveChamfer, buildChamferProgram } from '../src/core/machining/chamfer';
import { toRad } from '../src/core/geometry/angle';

/**
 * Refereˆncia de producËa˜o — CHANFRO EXT RETO.H (iTNC 530, programa real do
 * operador). O arquivo NUNCA e modifica por estes testes: e lido como fixture.
 *
 * Os testes registram as DIVERGENCIAS comprovadas (classes C/D do
 * Prompt 004) com valores exatos — na˜o forcËam igualdade onde existe
 * diferencËa intencional.
 */

const FIXTURE_PATH = new URL('./fixtures/CHANFRO_EXT_RETO_TESTE.H', import.meta.url);
// Referência real vendorizada no repo (cópia byte-idêntica de CHANFRO EXT RETO.H,
// programa de produção iTNC 530). Leitura direta: se o arquivo não existir,
// readFileSync lança e o teste FALHA (sem aprovação vacuosa).
const ORIGINAL_PATH = new URL('./fixtures/CHANFRO_EXT_RETO.H', import.meta.url);

const REAL = {
  A: 30, // Q1
  C: 50, // Q2 (ALTURA DO CHANFRO)
  D: 52, // Q3
  r: 6, // Q4
  seguranca: 10, // Q11
  inc: 0.2, // Q22
  L: 100, // Q33
  rpm: 2000,
  av: 2222,
};

function simulateRealProgram() {
  const A = toRad(REAL.A);
  const sinA = Math.sin(A);
  const cosA = Math.cos(A);
  const tanA = Math.tan(A);

  const q12 = REAL.seguranca + REAL.D / 2;
  const q7 = Math.floor(REAL.D / 2); // FN 4: DIV (inteiro)
  const q34 = REAL.L + REAL.seguranca;
  const q5 =
    (REAL.D / 2 - REAL.r - tanA * REAL.C) -
    (tanA * (REAL.r - sinA * REAL.r)) +
    (cosA * REAL.r);

  let q21 = 0;
  let passes = 0;
  let q6 = q5;
  while (q6 < q7 - 1e-9) {
    q21 += REAL.inc;
    q6 = q5 + tanA * q21;
    passes++;
    if (passes > 100000) throw new Error('loop infinito na simulacao real');
  }
  return { q5, q6, q7, q12, q34, passes, depth: q21, q6atEnd: q6 };
}

const SIM = simulateRealProgram();

function generateCanonical() {
  const result = solveChamfer({
    type: 'external',
    width: REAL.C,
    angle: REAL.A,
    tool: { type: 'toroidal', diameter: REAL.D, radius: REAL.r },
    strategy: { passDepth: REAL.inc },
    plane: 'XZ',
    origin: 'vertex',
    length: REAL.L,
    feed: REAL.av,
    rpm: REAL.rpm,
    safety: REAL.seguranca,
    toolNumber: 1,
    sobre: 0,
  });
  expect(result.valid).toBe(true);
  return result.model;
}

const MODEL = generateCanonical();
const PROGRAM = buildChamferProgram(MODEL);

describe('sauda: fixture da referencia de producao', () => {
  it('fixture carregado e possui a assinatura do programa real', () => {
    const txt = readFileSync(FIXTURE_PATH, 'utf8');
    expect(txt).toContain('BEGIN PGM CHANFRO EXT RETO MM');
    expect(txt).toContain('END PGM CHANFRO EXT RETO MM');
    expect(txt).toContain('TOOL CALL 1 Z S2000');
    expect(txt).toContain('FN 0: Q1 =+30');
    expect(txt).toContain('FN 4: Q7 =+Q3 DIV +2');
    expect(txt).toContain('FN 12: IF +Q6 LT +Q7 GOTO LBL 1');
    expect(txt).toContain('L  X+Q12 IZ+1 R0 M90');
    expect(txt).toContain('L  Z+100 R0 FMAX M30');
  });

  it('fixture identico byte-a-byte ao programa real versionado', () => {
    const fixture = readFileSync(FIXTURE_PATH, 'utf8');
    const original = readFileSync(ORIGINAL_PATH, 'utf8');
    expect(fixture).toBe(original);
  });
});

describe('estruttura: programa canonico reproduz o esqueleto de movimentos', () => {
  it('BEGIN/END PGM, TOOL CALL e retorno M30 presentes', () => {
    expect(PROGRAM).toContain('BEGIN PGM CHAMFEREXTERNAL_');
    expect(PROGRAM).toContain('END PGM CHAMFEREXTERNAL_');
    expect(PROGRAM).toContain('TOOL CALL 1 Z S2000');
    expect(PROGRAM).toContain('L Z+100 R0 FMAX M30');
    expect(PROGRAM).toMatch(/END PGM CHAMFEREXTERNAL_\d{8} MM/);
  });

  it('sequencia de movimentos do loop identica ao programa real', () => {
    const motion = [
      'L X+Q12 Y+Q11 R0 FMAX',
      'L Z -Q21 R0 F1111 M90',
      'L X +Q21 R0 F2222 M90',
      'L Y -Q34 R0 F2222 M90',
      'L X+Q12 IZ+1 R0 F1111 M90',
    ];
    for (const line of motion) expect(PROGRAM).toContain(line);
    expect(PROGRAM).toContain('FN 12: IF +Q30 LT +Q31 GOTO LBL 1');
    expect(PROGRAM).toContain('LBL 1');
  });

  it('valores coincidentes com o real: Q12 e Q34', () => {
    expect(SIM.q12).toBe(36);
    expect(SIM.q34).toBe(110);
    expect(MODEL.xCorner).toBe(36);
    expect(MODEL.yTotal).toBe(110);
    // o mesmo valor que o real calcularia (Q12=Q11+Q3/2, Q34=Q33+Q11)
    expect(MODEL.params.numeroFerramenta ?? 1).toBe(1);
  });
});

describe('numerico — divergencias DOCUMENTADAS (classes C/D)', () => {
  it('real: Q5 (X inicial com corpo da ferramenta) vs canonico: xCentro', () => {
    // Q5 real = D/2 - r - tanA*C - tanA*(r - sinA*r) + cosA*r  => -5,4034
    expect(SIM.q5).toBeCloseTo(-5.403411845, 6);
    // xCentro canonico = -C*cosA + Reff/sinA  => -31,3013
    expect(MODEL.xCentro).toBeCloseTo(-31.3012701892, 6);
    // diferença comprovada: ~25,90 mm (o real considera D/2 e o sentido do chanfro)
    expect(MODEL.xCentro - SIM.q5).toBeCloseTo(-25.8978583, 6);
  });

  it('real: inclinacao tan(Q1) = 0,57735; canonico: cotA = 1,73205 (complementares)', () => {
    expect(MODEL.cotA).toBeCloseTo(1.7320508076, 6);
    expect(Math.tan(toRad(REAL.A))).toBeCloseTo(0.5773502692, 6);
    expect(1 / MODEL.cotA).toBeCloseTo(Math.tan(toRad(REAL.A)), 9);
  });

  it('real: geometria do chanfro (28,87 x 50) vs canonico (43,30 x 25) para o MESMO (A,C)', () => {
    // real: largura = tan(30)*50 = 28,87 ; altura = 50
    expect(Math.tan(toRad(REAL.A)) * REAL.C).toBeCloseTo(28.86751346, 6);
    // canonico: largX = C*cosA = 43,30 ; profZ = C*sinA = 25
    expect(MODEL.largX).toBeCloseTo(43.3012701892, 6);
    expect(MODEL.profZ).toBeCloseTo(25, 6);
  });

  it('real: loop termina em X=D/2 (272 passes, profundidade 54,4); canonico: 125 passes, 25,0', () => {
    expect(SIM.q7).toBe(26);
    expect(SIM.passes).toBe(272);
    expect(SIM.depth).toBeCloseTo(54.4, 6);
    expect(SIM.q6atEnd).toBeGreaterThanOrEqual(SIM.q7);

    expect(MODEL.nPasses).toBe(125);
    expect(MODEL.incReal).toBeCloseTo(0.2, 9);
    // ultimo passe canonico bate exatamente em profZ (nunca ultrapassa)
    const last = MODEL.passes[MODEL.passes.length - 1];
    expect(last.z).toBeCloseTo(25, 9);
    expect(last.isLast).toBe(true);
  });

  it('canonico: invariante do laço — contato bate na reta do chanfro em todos os passes', () => {
    const faceXAtDepth = (z) => MODEL.xCentro + MODEL.cotA * z;
    // no ultimo passe o centro recai em Reff/sinA = 12
    expect(faceXAtDepth(MODEL.profZ)).toBeCloseTo(12, 6);
    expect(faceXAtDepth(MODEL.profZ)).toBeCloseTo(MODEL.Reff / Math.sin(toRad(REAL.A)), 6);
    for (const p of MODEL.passes) {
      expect(p.x).toBeCloseTo(faceXAtDepth(p.z), 5);
    }
  });
});

describe('classificacao da divergencia (Prompt 004, secao 5)', () => {
  it('aponta a divergencia de semantica de Q22 (incremento vs cotangente)', () => {
    // real: Q22 =+0.2 (incremento) — FN 0
    expect(PROGRAM).not.toContain('FN 0: Q22 =+0.2');
    // canonico: Q22 = 1,7321 (cotangente) — DEFINE
    expect(PROGRAM).toContain('Q22 = +1,7321');
  });

  it('aponta a divergencia de atribuicao do numero Q do raio (Q4 real vs Q5 canonico)', () => {
    expect(PROGRAM).toContain('FN 0: Q5 =+6 ;RAIO DA FERRAMENTA');
    expect(PROGRAM).not.toContain('FN 0: Q4');
  });

  it('aponta a ausencia de DIV e do limite geometrico Q7 no canonico', () => {
    expect(PROGRAM).not.toContain('DIV');
    expect(PROGRAM).not.toMatch(/Q7 =/);
    expect(PROGRAM).not.toContain('IF +Q6 LT +Q7');
  });
});