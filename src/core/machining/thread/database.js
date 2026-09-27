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
 *   bsw    (Whitworth BSW)    — dados disponiveis  (BS 84:2007, via tabela
 *            mm gewinde-normen.de; passo derivado de TPI, furo da tabela)
 *   unc, unf, bsp             — SEM dados confiaveis locais -> pendentes.
 *
 * CONVERSAO IMPERIAL (BSW): pitch_mm = 25.4 / tpi e nominal_mm = inch * 25.4,
 * calculados com precisao total (`pitchMmFromTpi`/`inchToMm`); arredondamento
 * SOMENTE na exibicao. O registro guarda `tpi` e `diameterIn` originais.
 *
 * DIVERGENCIA DE BROCAS BSW ENTRE FONTES (reportada, nao escolhida em
 * silencio — primaria: gewinde-normen.de):
 *   1/8: 2,36 (alt. 2,55) · 1/4: 4,72 (alt. 5,10) · 1/2: 9,99 (alt. 10,50)
 *   3/4: 15,80 (alt. 16,25) · 1: 21,34 (alt. 22,00) — alternates m-techmetal.
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

export const THREAD_FAMILIES = [  {
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
  {
    id: 'bsw',
    name: 'Whitworth BSW',
    standard: 'BS 84:2007',
    status: 'available',
    source: 'gewinde-normen.de (série BSW, BS 84) + conversão TPI→mm',
  },
];

const FAMILY_BY_ID = {};
THREAD_FAMILIES.forEach((f) => {
  FAMILY_BY_ID[f.id] = f;
});

export function getFamily(id) {
  return FAMILY_BY_ID[id] || THREAD_FAMILIES[0];
}

/**
 * Conversão polegada → mm (BSW e futuras famílias imperiais).
 * Precisão total — arredondar SOMENTE na exibição.
 */
export function inchToMm(inches) {
  return inches * 25.4;
}

/**
 * passo_mm = 25.4 / tpi — função única e testável (§3 ROSCAS 2.0).
 * Precisão total para o gerador CNC; arredondar SOMENTE na exibição.
 */
export function pitchMmFromTpi(tpi) {
  return 25.4 / tpi;
}

/** Fração imperial ("1/4", "3/16", "1") → polegadas decimais. */
export function imperialFractionToInches(text) {
  if (text === undefined || text === null) return null;
  const s = String(text).trim();
  if (s === '') return null;
  const parts = s.split('/');
  if (parts.length === 1) {
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }
  if (parts.length === 2) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (Number.isFinite(a) && Number.isFinite(b) && b !== 0) return a / b;
  }
  return null;
}

/** Verdadeiro somente para rosca métrica fina (família `fine`) — §11. */
export function isFineThread(thread) {
  return thread?.familyId === 'fine';
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

// [fração polegada, TPI, broca_mm] — WHITWORTH BSW (BS 84:2007).
// Broca = fonte primária gewinde-normen.de (mm); alternates m-techmetal
// documentados no `source` de cada registro (ver divergências no cabeçalho).
const BSW_ROWS = [
  ['1/8', 40, 2.36],
  ['3/16', 24, 3.41],
  ['1/4', 20, 4.72],
  ['5/16', 18, 6.13],
  ['3/8', 16, 7.49],
  ['7/16', 14, 8.79],
  ['1/2', 12, 9.99],
  ['5/8', 11, 12.92],
  ['3/4', 10, 15.80],
  ['7/8', 9, 18.61],
  ['1', 8, 21.34],
];

const BSW_DRILL_ALTERNATES = {
  '1/8': '2,55',
  '1/4': '5,10',
  '1/2': '10,50',
  '3/4': '16,25',
  '1': '22,00',
};

function buildBswRecords() {
  return BSW_ROWS.map(([frac, tpi, drill]) => {
    const inches = imperialFractionToInches(frac);
    const nominal = inchToMm(inches);
    const pitch = pitchMmFromTpi(tpi);
    const isHelical = nominal > 24; // mesma regra da fábrica (só W1" cai aqui)
    const alt = BSW_DRILL_ALTERNATES[frac];
    return {
      id: 'bsw:' + frac + '-' + tpi,
      familyId: 'bsw',
      nome: frac + '"',
      designation: frac + '" - ' + tpi + ' BSW',
      normalized: 'W' + frac + '-' + tpi,
      nominal,
      pitch,
      hole: drill,
      tpi,
      diameterIn: inches,
      method: isHelical ? 'helical' : 'rigid',
      cycle: isHelical ? null : 207,
      standard: 'BS 84:2007',
      source: 'gewinde-normen.de (BSW, BS 84)'
        + (alt ? ' — broca altern. m-techmetal ' + alt + ' mm' : ''),
      recommendations: [],
    };
  });
}

export const THREAD_RECORDS = buildMetricRecords().concat(buildFineRecords(), buildBswRecords());

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