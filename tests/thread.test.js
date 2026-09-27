import { describe, it, expect } from 'vitest';
import {
  THREAD_RECORDS,
  THREAD_FAMILIES,
  getThread,
  getAvailableFamilies,
  pitchMmFromTpi,
  inchToMm,
  imperialFractionToInches,
  isFineThread,
} from '../src/core/machining/thread/database';
import {
  normalizeThreadQuery,
  parseThreadQuery,
  searchThreads,
} from '../src/core/machining/thread/search';
import { solveThread } from '../src/core/machining/thread/solver';
import { validateThreadInput } from '../src/core/machining/thread/validation';
import { buildThreadIR, buildThreadProgram } from '../src/core/machining/thread/template';
import { postprocess } from '../src/core/postprocessors/heidenhain';

const M10_15 = getThread('metric:M10X1.5');
const M10_125 = getThread('fine:M10X1.25');

const RIGID_INPUT = {
  threadId: 'metric:M10X1.5',
  toolNumber: 1,
  rpm: 500,
  depth: 20,
  safety: 5,
  zStart: 0,
};

const HELICAL_INPUT = {
  threadId: 'metric:M64X6',
  toolNumber: 2,
  rpm: 400,
  depth: 30,
  toolDiameter: 20,
  feed: 120,
  direction: 'cw',
  safety: 5,
  zStart: 0,
};

describe('database — estrutura e famílias', () => {
  it('registros possuem campos obrigatórios', () => {
    for (const r of THREAD_RECORDS) {
      expect(r.id).toBeTruthy();
      expect(r.familyId).toBeTruthy();
      expect(r.nome).toBeTruthy();
      expect(r.designation).toBeTruthy();
      expect(r.normalized).toBeTruthy();
      expect(typeof r.nominal).toBe('number');
      expect(typeof r.pitch).toBe('number');
      expect(typeof r.hole).toBe('number');
      expect(['rigid', 'helical']).toContain(r.method);
      expect(r.standard).toBeTruthy();
      expect(r.source).toBeTruthy();
    }
  });

  it('designação M10 × 1,5 resolvida e dados da planilha', () => {
    expect(M10_15.designation).toBe('M10 × 1,5');
    expect(M10_15.nominal).toBe(10);
    expect(M10_15.pitch).toBe(1.5);
    expect(M10_15.hole).toBe(8.5);
    expect(M10_15.method).toBe('rigid');
    expect(M10_15.source).toBe('rosca.xlsx');
    expect(M10_15.recommendations.length).toBeGreaterThan(0);
  });

  it('furo M8 e M12 seguem a planilha (não o legado)', () => {
    expect(getThread('metric:M8X1.25').hole).toBe(6.8);
    expect(getThread('metric:M12X1.75').hole).toBe(10.2);
  });

  it('acima de M24 usa interpolação helicoidal (regra da fábrica)', () => {
    expect(getThread('metric:M27X3').method).toBe('helical');
    expect(getThread('metric:M30X3.5').method).toBe('helical'); // planilha indicava 207; regra M24+ prevalece
    expect(getThread('metric:M30X3.5').cycle).toBeNull();
    expect(getThread('metric:M64X6').method).toBe('helical');
    expect(getThread('metric:M64X6').cycle).toBeNull();
    expect(getThread('fine:M27X2').method).toBe('helical');
    expect(getThread('fine:M30X2').method).toBe('helical');
  });

  it('M24 e abaixo permanecem rígida (CYCL DEF 207)', () => {
    expect(getThread('metric:M24X3').method).toBe('rigid');
    expect(getThread('metric:M24X3').cycle).toBe(207);
    expect(getThread('metric:M22X2.5').cycle).toBe(207);
  });

  it('M30 mantém o furo da planilha mesmo sendo helical', () => {
    expect(getThread('metric:M30X3.5').hole).toBe(26.5);
  });

  it('MÉTRICA FINA disponível com passos padrão ISO 724', () => {
    expect(M10_125.pitch).toBe(1.25);
    expect(getThread('fine:M10X1').nominal).toBe(10);
    expect(getThread('fine:M20X1.5').hole).toBe(18.5);
  });

  it('famílias pendentes (UNC/UNF/BSP) ficam sem dados', () => {
    for (const id of ['unc', 'unf', 'bsp']) {
      const f = THREAD_FAMILIES.find((x) => x.id === id);
      expect(f.status).toBe('pending');
      expect(THREAD_RECORDS.some((r) => r.familyId === id)).toBe(false);
    }
  });

  it('ids únicos e normalizados únicos por família', () => {
    const ids = new Set(THREAD_RECORDS.map((r) => r.id));
    expect(ids.size).toBe(THREAD_RECORDS.length);
  });

  it('getAvailableFamilies retorna somente disponíveis', () => {
    const fams = getAvailableFamilies();
    expect(fams.length).toBeGreaterThanOrEqual(2);
    expect(fams.every((f) => f.status === 'available')).toBe(true);
  });
});

describe('search — normalização e busca', () => {
  it('normaliza maiúsculas, ×/x, vírgula/ponto, espaços', () => {
    expect(normalizeThreadQuery('m10 x 1,5')).toBe('M10X1.5');
    expect(normalizeThreadQuery('M10x1.5')).toBe('M10X1.5');
    expect(normalizeThreadQuery('M10 1.5')).toBe('M10X1.5');
    expect(normalizeThreadQuery('10x1.5')).toBe('M10X1.5');
    expect(normalizeThreadQuery('M12 × 1,25')).toBe('M12X1.25');
    expect(normalizeThreadQuery('M6')).toBe('M6');
    expect(normalizeThreadQuery('M10,1.5')).toBe('M10X1.5'); // vírgula como separador diâmetro×passo
    expect(normalizeThreadQuery('10,1.5')).toBe('M10X1.5');
  });

  it('parseThreadQuery extrai nominal/paço', () => {
    const p = parseThreadQuery('M10 x 1,5');
    expect(p.valid).toBe(true);
    expect(p.nominal).toBe(10);
    expect(p.pitch).toBe(1.5);
    const p2 = parseThreadQuery('M12');
    expect(p2.valid).toBe(true);
    expect(p2.pitch).toBeNull();
    expect(parseThreadQuery('M99').valid).toBe(true); // parse válido; busca não acha
    expect(parseThreadQuery('XYZ').valid).toBe(false);
  });

  it('M10 retorna todas as opções compatíveis (múltiplos passos)', () => {
    const r = searchThreads('M10');
    expect(r.map((t) => t.pitch).sort()).toEqual([1, 1.25, 1.5]);
  });

  it('busca precisa pelo passo: M10 x 1,5', () => {
    const r = searchThreads('M10 x 1,5');
    expect(r).toHaveLength(1);
    expect(r[0].designation).toBe('M10 × 1,5');
  });

  it('busca por ponto, sem M e com espaço resolve igual', () => {
    expect(searchThreads('M10 1.5')[0].id).toBe('metric:M10X1.5');
    expect(searchThreads('10x1.5')[0].id).toBe('metric:M10X1.5');
    expect(searchThreads('m10x1,5')[0].id).toBe('metric:M10X1.5');
  });

  it('busca por vírgula separadora "M10,1.5" resolve igual', () => {
    expect(searchThreads('M10,1.5')).toHaveLength(1);
    expect(searchThreads('M10,1.5')[0].id).toBe('metric:M10X1.5');
    expect(searchThreads('M10,1.5')[0].designation).toBe('M10 × 1,5');
  });

  it('M12x1.25 resolve para a fina', () => {
    const r = searchThreads('M12x1.25');
    expect(r).toHaveLength(1);
    expect(r[0].designation).toBe('M12 × 1,25');
  });

  it('rosca inexistente -> []', () => {
    expect(searchThreads('M99')).toEqual([]);
    expect(searchThreads('XYZ')).toEqual([]);
    expect(searchThreads('')).toEqual([]);
  });

  it('busca respeita a família', () => {
    const fine = searchThreads('M10', 'fine');
    expect(fine).toHaveLength(2); // M10 × 1,25 e M10 × 1,0
    expect(fine.every((t) => t.familyId === 'fine')).toBe(true);
    expect(fine.map((t) => t.pitch).sort()).toEqual([1, 1.25]);
  });
});

describe('solver — rosca rígida e fina', () => {
  it('M10 × 1,5 rígida — modelo completo', () => {
    const r = solveThread(RIGID_INPUT);
    expect(r.valid).toBe(true);
    const m = r.model;
    expect(m.method).toBe('rigid');
    expect(m.cycle).toBe(207);
    expect(m.operationId).toBe('roscaRigida');
    expect(m.feed).toBe(750); // 500 × 1.5
    expect(m.depth).toBe(20);
    expect(m.zStart).toBe(0);
    expect(m.zEnd).toBe(-20);
    expect(m.designation).toBe('M10 × 1,5');
    expect(m.radius).toBeNull();
  });

  it('M10 × 1,25 fina — rígida com passo fino', () => {
    const r = solveThread({ ...RIGID_INPUT, threadId: 'fine:M10X1.25' });
    expect(r.valid).toBe(true);
    expect(r.model.pitch).toBe(1.25);
    expect(r.model.cycle).toBe(207);
  });

  it('interpolação helicoidal — raio/voltas/sentido', () => {
    const r = solveThread(HELICAL_INPUT);
    expect(r.valid).toBe(true);
    const m = r.model;
    expect(m.method).toBe('helical');
    expect(m.radius).toBe((64 - 20) / 2);
    expect(m.nPasses).toBe(Math.ceil(30 / 6)); // 5
    expect(m.direction).toBe('cw');
    expect(m.trajectory.points.length).toBe(m.nPasses * 24 + 1);
    expect(m.operationId).toBe('roscaHelicoidal');
    expect(m.zEnd).toBe(-30);
  });

  it('projeção da hélice começa no raio e termina na profundidade', () => {
    const r = solveThread(HELICAL_INPUT);
    const first = r.model.trajectory.points[0];
    const last = r.model.trajectory.points[r.model.trajectory.points.length - 1];
    expect(first.x).toBeCloseTo(22, 6);
    expect(first.z).toBe(0);
    expect(last.x).toBeCloseTo(22, 6);
    expect(last.z).toBeCloseTo(-30, 6);
  });

  it('casos inválidos -> valid false e model null', () => {
    expect(solveThread({ ...RIGID_INPUT, rpm: 0 }).valid).toBe(false);
    expect(solveThread({ ...RIGID_INPUT, depth: -5 }).valid).toBe(false);
    expect(solveThread({ ...RIGID_INPUT, threadId: 'metric:NADA' }).valid).toBe(false);
    expect(solveThread({ ...HELICAL_INPUT, toolDiameter: 70 }).valid).toBe(false); // raio negativo
    expect(solveThread({ ...HELICAL_INPUT, feed: NaN }).valid).toBe(false);
  });
});

describe('validation — regras de segurança', () => {
  it('profundidade zero/negativa/NaN/Infinity', () => {
    expect(validateThreadInput({ ...RIGID_INPUT, depth: 0 }).errors[0].code).toBe('INVALID_DEPTH');
    expect(validateThreadInput({ ...RIGID_INPUT, depth: -1 }).errors[0].code).toBe('INVALID_DEPTH');
    expect(validateThreadInput({ ...RIGID_INPUT, depth: NaN }).errors[0].code).toBe('INVALID_DEPTH');
    expect(validateThreadInput({ ...RIGID_INPUT, depth: Infinity }).errors[0].code).toBe('INVALID_DEPTH');
  });

  it('RPM zero/NaN/Infinity', () => {
    expect(validateThreadInput({ ...RIGID_INPUT, rpm: 0 }).errors[0].code).toBe('INVALID_SPINDLE_SPEED');
    expect(validateThreadInput({ ...RIGID_INPUT, rpm: NaN }).errors[0].code).toBe('INVALID_SPINDLE_SPEED');
    expect(validateThreadInput({ ...RIGID_INPUT, rpm: Infinity }).errors[0].code).toBe('INVALID_SPINDLE_SPEED');
  });

  it('avanço zero', () => {
    expect(validateThreadInput({ ...HELICAL_INPUT, feed: 0 }).errors[0].code).toBe('INVALID_FEED');
  });

  it('ferramenta inválida (não inteiro / negativo)', () => {
    expect(validateThreadInput({ ...RIGID_INPUT, toolNumber: -1 }).errors[0].code).toBe('INVALID_TOOL_NUMBER');
    expect(validateThreadInput({ ...RIGID_INPUT, toolNumber: 1.5 }).errors[0].code).toBe('INVALID_TOOL_NUMBER');
  });

  it('diâmetro de ferramenta incompatível (raio <= 0)', () => {
    expect(validateThreadInput({ ...HELICAL_INPUT, toolDiameter: 64 }).errors[0].code).toBe('INVALID_INTERP_RADIUS');
  });

  it('fresa não entra no pré-furo (diam >= furo)', () => {
    const r = validateThreadInput({ ...HELICAL_INPUT, toolDiameter: 60 }); // M64 furo 58
    expect(r.errors[0].code).toBe('INVALID_TOOL_FIT');
  });

  it('sentido inválido', () => {
    expect(validateThreadInput({ ...HELICAL_INPUT, direction: 'x' }).errors[0].code).toBe('INVALID_DIRECTION');
  });

  it('rosca inexistente', () => {
    expect(validateThreadInput({ ...RIGID_INPUT, threadId: 'xyz' }).errors[0].code).toBe('INVALID_THREAD');
  });
});

describe('IR — o solver NUNCA devolve sintaxe Heidenhain', () => {
  const KNOWN_TYPES = [
    'section', 'comment', 'define', 'fn0', 'blkForm', 'toolCall', 'assign',
    'label', 'jump', 'rapid', 'linear', 'cycleDef', 'cycleCall', 'helix',
    'spindle', 'spindleStop',
  ];

  it('buildThreadIR retorna objetos IR estruturados (sem textão de dialeto)', () => {
    const rigid = solveThread(RIGID_INPUT);
    const ir1 = buildThreadIR(rigid.model);
    const serialized1 = JSON.stringify(ir1);
    expect(serialized1).not.toContain('BEGIN PGM');
    expect(serialized1).not.toContain(' MM ');
    expect(serialized1).not.toContain('FN 0:');
    for (const b of ir1) {
      expect(KNOWN_TYPES).toContain(b.type);
    }

    const hel = solveThread(HELICAL_INPUT);
    const ir2 = buildThreadIR(hel.model);
    const serialized2 = JSON.stringify(ir2);
    expect(serialized2).not.toContain('CP ');
    expect(serialized2).not.toContain('IPA');
    expect(serialized2).not.toContain('DR-');
    expect(serialized2).not.toContain('Q335');
    for (const b of ir2) {
      expect(KNOWN_TYPES).toContain(b.type);
    }
  });

  it('CYCLE_DEF carrega parâmetros estruturados (não string de ciclo)', () => {
    const ir = buildThreadIR(solveThread(RIGID_INPUT).model);
    const cycle = ir.find((b) => b.type === 'cycleDef');
    expect(cycle.cycle).toBe(207);
    expect(Array.isArray(cycle.params)).toBe(true);
    const q201 = cycle.params.find((p) => p.q === 201);
    expect(q201.value).toBe(-20);
    expect(typeof q201.value).toBe('number');
  });

  it('contém os blocos esperados (CYCLE_DEF, HELIX, TOOL_CALL)', () => {
    const rigid = buildThreadIR(solveThread(RIGID_INPUT).model);
    expect(rigid.some((b) => b.type === 'cycleDef')).toBe(true);
    expect(rigid.some((b) => b.type === 'cycleCall')).toBe(true);

    const hel = buildThreadIR(solveThread(HELICAL_INPUT).model);
    expect(hel.some((b) => b.type === 'helix')).toBe(true);
    expect(hel.filter((b) => b.type === 'helix')).toHaveLength(5);
    expect(hel.some((b) => b.type === 'toolCall')).toBe(true);
  });
});

describe('postprocessor — programa final', () => {
  it('teste fundamental: Rosca -> IR -> postprocess -> .H completo', () => {
    const r = solveThread(RIGID_INPUT);
    const blocks = buildThreadIR(r.model);
    const program = postprocess(blocks, null, r.model, 'ROSCA_10X1_5');
    expect(program).toContain('BEGIN PGM ROSCA_10X1_5 MM ');
    expect(program).toContain('END PGM ROSCA_10X1_5 MM ');
    expect(program).toContain('TOOL CALL 1 Z S500');
    expect(program).toContain('CYCL DEF 207 ROSCA RIGIDA');
    expect(program).toContain('CYCL CALL M3');
    expect(program).toContain('M30');
    // linhas numeradas pelo postprocessor
    const lines = program.split('\n');
    expect(lines.every((l, i) => l.startsWith(String(i).padEnd(2, ' ')))).toBe(true);
  });

  it('buildThreadProgram embute BEGIN/END com o nome informado', () => {
    const program = buildThreadProgram(solveThread(RIGID_INPUT).model, { programName: 'PARIDADE_ROSCA' });
    expect(program).toContain('BEGIN PGM PARIDADE_ROSCA MM ');
    expect(program).toContain('END PGM PARIDADE_ROSCA MM ');
  });

  it('buildThreadProgram sem nome usa buildProgramName(operationId)', () => {
    const rigid = buildThreadProgram(solveThread(RIGID_INPUT).model);
    expect(rigid).toContain('BEGIN PGM ROSCARIGIDA_');
    const hel = buildThreadProgram(solveThread(HELICAL_INPUT).model);
    expect(hel).toContain('BEGIN PGM ROSCAHELICOIDAL_');
  });

  it('interpolação -> CC/CP helicoidal com IZ e DR coerentes (cw = DR-)', () => {
    const r = solveThread(HELICAL_INPUT);
    const program = buildThreadProgram(r.model, { programName: 'HELIX_TESTE' });
    expect(program).toContain('CC X+0  Y+0');
    expect(program).toContain('CP IPA-360  IZ-6,000 DR- F120');
    expect(program).toContain('L Z +5 R0 FMAX M3');
    expect(program).toContain('L X +22');
  });

  it('sentido ccw -> DR+ e IPA+', () => {
    const r = solveThread({ ...HELICAL_INPUT, direction: 'ccw' });
    const program = buildThreadProgram(r.model, { programName: 'HELIX_CCW' });
    expect(program).toContain('CP IPA+360  IZ-6,000 DR+ F120');
  });
});

describe('ROSCAS 2.0 — conversão TPI→mm (função única, precisão total)', () => {
  it('pitchMmFromTpi: valores de referência (§3)', () => {
    const cases = [
      [40, 0.635], [24, 1.058333333333], [20, 1.27], [18, 1.411111111111],
      [16, 1.5875], [14, 1.814285714286], [12, 2.116666666667],
      [11, 2.309090909091], [10, 2.54], [9, 2.822222222222], [8, 3.175],
    ];
    for (const [tpi, expected] of cases) {
      expect(pitchMmFromTpi(tpi)).toBeCloseTo(expected, 9);
    }
  });

  it('inchToMm + imperialFractionToInches', () => {
    expect(inchToMm(0.25)).toBeCloseTo(6.35, 12);
    expect(imperialFractionToInches('1/4')).toBe(0.25);
    expect(imperialFractionToInches('3/16')).toBeCloseTo(0.1875, 12);
    expect(imperialFractionToInches('1')).toBe(1);
    expect(imperialFractionToInches('')).toBeNull();
    expect(imperialFractionToInches('1/0')).toBeNull();
    expect(imperialFractionToInches('abc')).toBeNull();
  });

  it('isFineThread: só familyId fine', () => {
    expect(isFineThread(getThread('fine:M10X1.25'))).toBe(true);
    expect(isFineThread(getThread('metric:M10X1.5'))).toBe(false);
    expect(isFineThread(getThread('bsw:1/4-20'))).toBe(false);
    expect(isFineThread(null)).toBe(false);
  });
});

describe('ROSCAS 2.0 — família BSW (BS 84:2007)', () => {
  const bsw = THREAD_RECORDS.filter((r) => r.familyId === 'bsw');

  it('11 registros (1/8 a 1"), tpi/diameterIn preservados', () => {
    expect(bsw).toHaveLength(11);
    for (const r of bsw) {
      expect(typeof r.tpi).toBe('number');
      expect(typeof r.diameterIn).toBe('number');
      expect(r.standard).toBe('BS 84:2007');
      expect(r.source).toContain('gewinde-normen.de');
    }
  });

  it('1/4-20 → 6,35 mm, 20 TPI, passo 1,27, furo 4,72, rígida', () => {
    const t = getThread('bsw:1/4-20');
    expect(t.nominal).toBeCloseTo(6.35, 9);
    expect(t.tpi).toBe(20);
    expect(t.pitch).toBeCloseTo(1.27, 9);
    expect(t.hole).toBe(4.72);
    expect(t.method).toBe('rigid');
    expect(t.cycle).toBe(207);
    expect(t.designation).toBe('1/4" - 20 BSW');
  });

  it('3/8-16 e 1/2-12 (casos §14)', () => {
    const a = getThread('bsw:3/8-16');
    expect(a.nominal).toBeCloseTo(9.525, 9);
    expect(a.pitch).toBeCloseTo(1.5875, 9);
    const b = getThread('bsw:1/2-12');
    expect(b.nominal).toBeCloseTo(12.7, 9);
    expect(b.pitch).toBeCloseTo(2.116666666667, 9);
  });

  it('W1" cai em helical pela regra >24 (25,4 mm)', () => {
    const t = getThread('bsw:1-8');
    expect(t.nominal).toBeCloseTo(25.4, 9);
    expect(t.method).toBe('helical');
    expect(t.cycle).toBeNull();
  });

  it('família bsw disponível; unc/unf/bsp seguem pendentes sem registros', () => {
    expect(getAvailableFamilies().some((f) => f.id === 'bsw')).toBe(true);
    expect(THREAD_RECORDS.some((r) => r.familyId === 'unc')).toBe(false);
  });
});

describe('ROSCAS 2.0 — busca imperial', () => {
  it('todos os formatos BSW (§9)', () => {
    for (const q of ['1/4-20', '1/4 - 20', '1/4" - 20', '1/4 20', '1/4 BSW', 'W1/4-20']) {
      const hits = searchThreads(q, 'bsw');
      expect(hits.map((h) => h.id)).toContain('bsw:1/4-20');
    }
  });

  it('fração sem TPI lista o diâmetro; TPI filtra o passo', () => {
    expect(searchThreads('1/4', 'bsw').map((h) => h.id)).toContain('bsw:1/4-20');
    expect(searchThreads('1/2-12', 'bsw')[0].id).toBe('bsw:1/2-12');
  });

  it('busca métrica inalterada', () => {
    expect(searchThreads('M10x1.5')[0].id).toBe('metric:M10X1.5');
    expect(searchThreads('M10', 'fine')).toHaveLength(2);
  });
});

describe('ROSCAS 2.0 — Q239 com sentido (Cycle 207)', () => {
  const BSW_RIGID = {
    threadId: 'bsw:1/4-20',
    toolNumber: 1,
    rpm: 500,
    depth: 10,
    safety: 5,
    zStart: 0,
  };

  function q239Of(model) {
    const ir = buildThreadIR(model);
    const cyc = ir.find((b) => b.type === 'cycleDef');
    return cyc.params.find((p) => p.q === 239).value;
  }

  it('IR carrega Q239 = +passo na direita (default)', () => {
    const r = solveThread(BSW_RIGID);
    expect(r.valid).toBe(true);
    expect(q239Of(r.model)).toBeCloseTo(1.27, 9);
  });

  it('esquerda inverte o sinal no IR', () => {
    const r = solveThread({ ...BSW_RIGID, hand: 'left' });
    expect(r.valid).toBe(true);
    expect(q239Of(r.model)).toBeCloseTo(-1.27, 9);
  });

  it('texto .H: Q239 com sinal e vírgula decimal', () => {
    const right = buildThreadProgram(solveThread(BSW_RIGID).model, { programName: 'BSW_R' });
    expect(right).toContain('Q239=+1,270');
    const left = buildThreadProgram(solveThread({ ...BSW_RIGID, hand: 'left' }).model, { programName: 'BSW_L' });
    expect(left).toContain('Q239=-1,270');
  });

  it('M10x1.5: +1,500 direita / −1,500 esquerda', () => {
    const right = buildThreadProgram(solveThread(RIGID_INPUT).model, { programName: 'M_R' });
    expect(right).toContain('Q239=+1,500');
    const left = buildThreadProgram(solveThread({ ...RIGID_INPUT, hand: 'left' }).model, { programName: 'M_L' });
    expect(left).toContain('Q239=-1,500');
  });

  it('sentido inválido → INVALID_HAND (estruturado)', () => {
    const r = solveThread({ ...RIGID_INPUT, hand: 'x' });
    expect(r.valid).toBe(false);
    expect(r.model).toBeNull();
    expect(r.validation.errors[0].code).toBe('INVALID_HAND');
    expect(r.validation.errors[0].field).toBe('sentidoRosca');
  });
});