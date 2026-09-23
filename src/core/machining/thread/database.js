/**
 * Banco de dados de roscas (core).
 *
 * Fonte primaria = `rosca.xlsx` (projeto) — campos `broca` (= furo/broca),
 * `passo`, `ciclo`, `material`, `vc`. Onde a planilha nao cobre, e mantido o
 * dataset metrico legado (M1–M64). Nenhum valor foi inventado: cada
 * registro carrega a sua `source`.
 *
 * Leitura do xlsx (analise do arquivo real):
 *   nome,broca,passo,ciclo,material,vc
 *   M3,2.5,0.5,CYCL DEF 207,Aco 1045,10
 *   M4,3.3,0.7,CYCL DEF 207,Aco 1045,10
 *   M5,4.2,0.8,CYCL DEF 207,Aco 1045,10
 *   M6,5.0,1.0,CYCL DEF 207,Aco 1045,10    | Aluminio,25
 *   M8,6.8,1.25,CYCL DEF 207,Aco 1045,10
 *   M10,8.5,1.5,CYCL DEF 207,Aco 1045,10   | Aluminio,25
 *   M12,10.2,1.75,CYCL DEF 207,Aco 1045,10 | Aluminio,25 | Inox 304,6
 *   M16,14.0,2.0,CYCL DEF 207,Aco 1045,10
 *   M20,17.5,2.5,CYCL DEF 207,Aco 1045,10
 *   M30,26.5,3.5,CYCL DEF 207,Aco 1045,10
 *
 * Divergencias com o dataset legado resolvidas PELA PLANILHA:
 *   M8  furo: legado 6.75  -> planilha 6.8
 *   M12 furo: legado 10.25 -> planilha 10.2
 *   M3, M4, M5, M6, M8, M10, M12, M16, M20 -> furo da planilha
 *
 * METODO (regra da fabrica):
 *   - nominal <= 24 -> `rigid`    (machos de roscar, CYCL DEF 207)
 *   - nominal >  24 -> `helical`  (interpolacao helicoidal com fresa de
 *     roscar). A planilha indicava CYCL DEF 207 tambem para M30; a regra
 *     da fabrica acima de M24 tem precedencia (documentado em
 *     docs/THREAD_DATABASE.md §6).
 *
 * Familias:
 *   metric (Metrica ISO)      — dados disponiveis  (ISO 261 + rosca.xlsx)
 *   fine   (Metrica Fina)     — dados disponiveis  (ISO 724 / DIN 13)
 *   unc, unf, bsp             — SEM dados confiaveis locais -> pendentes.
 */

function pt(v) {
  return String(Math.round(v * 100) / 100).replace('.', ',');
}

function normalized(nominal, pitch) {
  return 'M' + nominal + 'X' + pitch;
}

function designation(nominal, pitch) {
  return 'M' + pt(nominal) + ' × ' + pt(pitch);
}

export const THREAD_FAMILIES = [
  {
    id: 'metric',
    name: 'Métrica ISO',
    standard: 'ISO 261 / ISO 724',
    status: 'available',
    source: 'rosca.xlsx (broca/passo/ciclo) + dataset métrico legado (M1–M64)',
  },
  {
    id: 'fine',
    name: 'Métrica Fina',
    standard: 'ISO 724 / DIN 13',
    status: 'available',
    source: 'série de passos finos métricos (ISO 724 / DIN 13) + regra de furo D − P',
  },
  { id: 'unc', name: 'UNC', standard: 'ASME B1.1', status: 'pending', source: null },
  { id: 'unf', name: 'UNF', standard: 'ASME B1.1', status: 'pending', source: null },
  { id: 'bsp', name: 'BSP', standard: 'ISO 228-1', status: 'pending', source: null },
];

const FAMILY_BY_ID = {};
THREAD_FAMILIES.forEach((f) => {
  FAMILY_BY_ID[f.id] = f;
});

export function getFamily(id) {
  return FAMILY_BY_ID[id] || THREAD_FAMILIES[0];
}

const METRIC_VC = {
  M3: [{ material: 'Aço 1045', vc: 10 }],
  M4: [{ material: 'Aço 1045', vc: 10 }],
  M5: [{ material: 'Aço 1045', vc: 10 }],
  M6: [
    { material: 'Aço 1045', vc: 10 },
    { material: 'Alumínio', vc: 25 },
  ],
  M8: [{ material: 'Aço 1045', vc: 10 }],
  M10: [
    { material: 'Aço 1045', vc: 10 },
    { material: 'Alumínio', vc: 25 },
  ],
  M12: [
    { material: 'Aço 1045', vc: 10 },
    { material: 'Alumínio', vc: 25 },
    { material: 'Inox 304', vc: 6 },
  ],
  M16: [{ material: 'Aço 1045', vc: 10 }],
  M20: [{ material: 'Aço 1045', vc: 10 }],
  M30: [{ material: 'Aço 1045', vc: 10 }],
};

// [nome, passo, furo] — base legada M1–M64.
const METRIC_LEGACY = [
  ['M1', 0.25, 0.75],
  ['M1.2', 0.25, 0.95],
  ['M1.4', 0.3, 1.1],
  ['M1.6', 0.35, 1.25],
  ['M2', 0.4, 1.6],
  ['M2.5', 0.45, 2.05],
  ['M3', 0.5, 2.5],
  ['M4', 0.7, 3.3],
  ['M5', 0.8, 4.2],
  ['M6', 1, 5],
  ['M7', 1, 6],
  ['M8', 1.25, 6.75],
  ['M10', 1.5, 8.5],
  ['M12', 1.75, 10.25],
  ['M14', 2, 12],
  ['M16', 2, 14],
  ['M18', 2.5, 15.5],
  ['M20', 2.5, 17.5],
  ['M22', 2.5, 19.5],
  ['M24', 3, 21],
  ['M27', 3, 24],
  ['M30', 3.5, 26.5],
  ['M33', 3.5, 29.5],
  ['M36', 4, 32],
  ['M39', 4, 35],
  ['M42', 4.5, 37.5],
  ['M45', 4.5, 40.5],
  ['M48', 5, 43],
  ['M52', 5, 47],
  ['M56', 5.5, 50.5],
  ['M60', 5.5, 54.5],
  ['M64', 6, 58],
];

// Correcoes da planilha: [nome, furo] — a planilha e a fonte primaria do Ø
// de furação onde ela cobre; o restante usa a tabela legada.
const XLSX_OVERRIDE = {
  M3: 2.5,
  M4: 3.3,
  M5: 4.2,
  M6: 5,
  M8: 6.8,
  M10: 8.5,
  M12: 10.2,
  M16: 14,
  M20: 17.5,
  M30: 26.5,
};

function buildMetricRecords() {
  return METRIC_LEGACY.map(([nome, passo, furo]) => {
    const recFuro = XLSX_OVERRIDE[nome] !== undefined ? XLSX_OVERRIDE[nome] : furo;
    const nominal = parseFloat(nome.replace('M', ''));
    const isHelical = nominal > 24; // regra da fábrica: acima de M24 → helical
    return {
      id: 'metric:' + normalized(nominal, passo),
      familyId: 'metric',
      nome,
      designation: designation(nominal, passo),
      normalized: normalized(nominal, passo),
      nominal,
      pitch: passo,
      hole: recFuro,
      method: isHelical ? 'helical' : 'rigid',
      cycle: isHelical ? null : 207,
      standard: 'ISO 261',
      source: XLSX_OVERRIDE[nome] !== undefined ? 'rosca.xlsx' : 'dataset métrico legado (ISO 261)',
      recommendations: METRIC_VC[nome] || [],
    };
  });
}

// [nominal, passo, furo] — MÉTRICA FINA (ISO 724 / DIN 13).
// Furo = broca padrão para rosqueamento interno (D − P, tabela padrão).
const FINE_ROWS = [
  [8, 1.0, 7.0],
  [10, 1.25, 8.8],
  [10, 1.0, 9.0],
  [12, 1.5, 10.5],
  [12, 1.25, 10.8],
  [14, 1.5, 12.5],
  [16, 1.5, 14.5],
  [18, 1.5, 16.5],
  [20, 1.5, 18.5],
  [22, 1.5, 20.5],
  [24, 2.0, 22.0],
  [27, 2.0, 25.0],
  [30, 2.0, 28.0],
];

function buildFineRecords() {
  return FINE_ROWS.map(([nominal, passo, furo]) => ({
    id: 'fine:' + normalized(nominal, passo),
    familyId: 'fine',
    nome: 'M' + nominal,
    designation: designation(nominal, passo),
    normalized: normalized(nominal, passo),
    nominal,
    pitch: passo,
    hole: furo,
    method: nominal <= 24 ? 'rigid' : 'helical',
    cycle: nominal <= 24 ? 207 : null,
    standard: 'ISO 724 / DIN 13',
    source: 'ISO 724 / DIN 13 (passo fino padrão) — furo D − P',
    recommendations: [],
  }));
}

export const THREAD_RECORDS = buildMetricRecords().concat(buildFineRecords());

const RECORD_BY_ID = {};
THREAD_RECORDS.forEach((r) => {
  RECORD_BY_ID[r.id] = r;
});

export function getThread(id) {
  return RECORD_BY_ID[id];
}

export function getThreads() {
  return THREAD_RECORDS;
}

export function getAvailableFamilies() {
  return THREAD_FAMILIES.filter((f) => f.status === 'available');
}