import { solveChamferLegacy, chamferProgramFromModel } from './canonicalChamfer';
import { solveRadiusLegacy, radiusProgramFromModel } from './canonicalRadius';
import { roundingSolver } from '../solvers/roundingSolver';
import { roundingTemplate } from '../templates/roundingTemplate';
import { validateParams } from '../utils/validators';
import ChamferEdgePreview from '../preview/ChamferEdgePreview';
import RoundingEdgePreview from '../preview/RoundingEdgePreview';
import RadiusPreview from '../preview/RadiusPreview';

const GENERATORS = {
  chanfro_aresta_reta_torica: {
    id: 'chanfro_aresta_reta_torica',
    name: 'Chanfro em Areta Reta - Ferramenta Torica',
    description: 'Chanfro em aresta reta usando fresa com raio de canto (torica).',
    params: [
      { id: 'L', label: 'Comprimento da aresta (mm)', val: 100, step: 'any' },
      { id: 'C', label: 'Largura do chanfro (mm)', val: 2, step: 'any' },
      { id: 'A', label: 'Angulo do chanfro (°)', val: 45, step: 'any' },
      { id: 'D', label: 'Diametro da fresa D (mm)', val: 12, step: 'any' },
      { id: 'r', label: 'Raio de canto r (mm)', val: 2, step: 'any' },
      { id: 'passeZ', label: 'Prof. por passe Z (mm)', val: 0.3, step: 'any' },
      { id: 'rpm', label: 'RPM', val: 3000, step: '1' },
      { id: 'av', label: 'Avano (mm/min)', val: 600, step: '1' },
    ],
    previewKind: 'external',
    validate: (p) => validateParams(p, ['L', 'C', 'A', 'D', 'r', 'passeZ', 'rpm', 'av']),
    solve: solveChamferLegacy,
    generate: (params, solved) => chamferProgramFromModel(solved),
    previewComponent: ChamferEdgePreview,
  },

  arredondamento_aresta_reta_torica: {
    id: 'arredondamento_aresta_reta_torica',
    name: 'Arredondamento em Aresta Reta - Ferramenta Torica',
    description: 'Raio de arredondamento em aresta reta usando fresa torica.',
    params: [
      { id: 'L', label: 'Comprimento da aresta (mm)', val: 100, step: 'any' },
      { id: 'R', label: 'Raio de arredondamento R (mm)', val: 5, step: 'any' },
      { id: 'D', label: 'Diametro da fresa D (mm)', val: 12, step: 'any' },
      { id: 'r', label: 'Raio de canto r (mm)', val: 2, step: 'any' },
      { id: 'incrZ', label: 'Incremento Z (mm)', val: 0.2, step: 'any' },
      { id: 'rpm', label: 'RPM', val: 3000, step: '1' },
      { id: 'av', label: 'Avano (mm/min)', val: 500, step: '1' },
    ],
    previewKind: 'external',
    validate: (p) => validateParams(p, ['L', 'R', 'D', 'r', 'incrZ', 'rpm', 'av']),
    solve: roundingSolver,
    generate: roundingTemplate,
    previewComponent: RoundingEdgePreview,
    // LEGADO DIVERGENTE da planilha (docs/RAIO_SPREADSHEET_REFERENCE.md §6):
    // arco R em vez de R+r, X relativo em vez de absoluto. Mantido apenas
    // para teste/regressão — usar `raio_aresta_reta_torica` (canônico).
  },

  raio_aresta_reta_torica: {
    id: 'raio_aresta_reta_torica',
    name: 'Raio em Aresta Reta - Ferramenta Torica (canonico)',
    description: 'Raio de arredondamento externo (aresta reta) ou interno (canto de bolsao) pelo pipeline canonico (referencia: planilha de setor).',
    params: [
      {
        id: 'tipo',
        label: 'Tipo de raio',
        kind: 'select',
        options: [
          { value: 'external', label: 'Externo (aresta reta)' },
          { value: 'internal', label: 'Interno (canto de bolsao)' },
        ],
        val: 'external',
      },
      { id: 'L', label: 'Comprimento da aresta/bolsao (mm)', val: 100, step: 'any' },
      { id: 'R', label: 'Raio do arredondamento R (mm)', val: 20, step: 'any' },
      { id: 'D', label: 'Diametro da fresa D (mm)', val: 25, step: 'any' },
      { id: 'r', label: 'Raio de canto r (mm)', val: 0.8, step: 'any' },
      { id: 'alojamentoLargura', label: 'Largura do bolsao (mm)', val: 40, step: 'any', showWhen: { tipo: 'internal' } },
      { id: 'incrZ', label: 'Incremento Z (mm)', val: 0.5, step: 'any' },
      { id: 'rpm', label: 'RPM', val: 3000, step: '1' },
      { id: 'av', label: 'Avano (mm/min)', val: 500, step: '1' },
    ],
    previewKind: 'external',
    validate: (p) => {
      const base = validateParams(p, ['L', 'R', 'D', 'r', 'incrZ', 'rpm', 'av']);
      if (base) return base;
      if (p.tipo === 'internal') {
        const w = p.alojamentoLargura;
        if (w === undefined || w === null || isNaN(w) || w <= 0) {
          return ['Parametro "alojamentoLargura" (largura do bolsao) deve ser um valor positivo para o tipo interno.'];
        }
        if (w <= p.D + 2) {
          return [`Largura do bolsao deve ser maior que D + 2 = ${(p.D + 2).toFixed(1)} mm para caber a ferramenta.`];
        }
      }
      return null;
    },
    solve: solveRadiusLegacy,
    generate: (params, solved) => radiusProgramFromModel(solved),
    previewComponent: RadiusPreview,
  },
};

export function getGenerator(id) {
  return GENERATORS[id] || null;
}

export function getAllGenerators() {
  return Object.values(GENERATORS);
}

export function getGeneratorList() {
  return Object.entries(GENERATORS).map(([id, gen]) => ({
    id,
    name: gen.name,
  }));
}
