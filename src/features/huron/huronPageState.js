// Estado da página Cabeçote Huron em lógica pura (testável sem DOM).
//
// O componente (HuronPage.jsx) só despacha ações e renderiza; todas as
// transições vivem aqui para cobrir em teste o caso central da auditoria:
// editar qualquer campo (ou o offset do anel) após calcular INVALIDA o
// resultado — sem isso a tela exibe número obsoleto sem aviso (ex.: valor
// de C=45 com o campo já em C=40).
//
// Efeitos colaterais (persistir calibração no localStorage) continuam no
// componente; aqui só há cálculo e transição de estado.

import { calculateHuronFlanges, applyRingCalibration } from '../../core/machining/huronHead';
import { validateHuronInput } from '../../core/machining/huronValidation';
import { getCalibracaoAnel } from './ringCalibrationStore';

export const RING_OPTIONS = [0, 90, 180, 270];

export function parseAngle(raw) {
  if (raw === '' || raw === null || raw === undefined) return null;
  // Teclado mobile pt-BR pode entregar vírgula como separador decimal.
  const n = Number(String(raw).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

export function parseAngles(values) {
  return {
    A: parseAngle(values?.A),
    B: parseAngle(values?.B),
    C: parseAngle(values?.C),
  };
}

// Monta o resultado a partir dos números usados no cálculo (fonte única do
// eco "calculado para A/B/C" exibido na tela). Sem validação aqui: quem
// chama (reducer CALCULATE) só chega com entrada válida.
export function buildHuronResult(nums, ring) {
  const raw = calculateHuronFlanges({ A: nums.A, B: nums.B, C: nums.C });
  // Sempre compensa: o anel físico só lê 0–360°, então um teórico negativo
  // vira seu equivalente (ex.: −45° → 315°) mesmo com desvio zero.
  const dial = applyRingCalibration(raw, { bRingOffset: ring.b, cRingOffset: ring.c });
  return {
    input: { A: nums.A, B: nums.B, C: nums.C },
    raw,
    bFlange: dial.bFlangeRing,
    cFlange: dial.cFlangeRing,
  };
}

// Linha pequena sob o resultado; o copyText do componente já inclui os
// mesmos valores (formato preservado).
export function formatResultEcho(input) {
  if (!input) return '';
  return `calculado para A=${input.A}° B=${input.B}° C=${input.C}°`;
}

export function initHuronPageState(machineId) {
  // Valores fora das 4 posições voltam pra 0 (o anel só trava a cada 90°).
  const saved = getCalibracaoAnel(machineId);
  const snap = (v) => (RING_OPTIONS.includes(v) ? v : 0);
  return {
    values: { A: 0, B: 0, C: 0 },
    submitted: false,
    result: null,
    ring: { b: snap(saved.bRingOffset), c: snap(saved.cRingOffset) },
  };
}

export function huronPageReducer(state, action) {
  switch (action.type) {
    case 'FIELD_EDIT':
      // toggleSign do formulário passa por aqui (via onChange), então o
      // botão +/− também invalida. submitted=false esconde os badges de
      // erro até o próximo CALCULAR.
      return {
        ...state,
        values: { ...state.values, [action.id]: action.raw },
        submitted: false,
        result: null,
      };
    case 'RING_CHANGE':
      // O resultado depende do offset: trocar o anel invalida.
      return {
        ...state,
        ring: { ...state.ring, [action.id]: action.value },
        submitted: false,
        result: null,
      };
    case 'CALCULATE': {
      const nums = parseAngles(state.values);
      if (!validateHuronInput(nums).valid) {
        return { ...state, submitted: true, result: null };
      }
      return { ...state, submitted: true, result: buildHuronResult(nums, state.ring) };
    }
    case 'CLEAR':
      // LIMPAR zera campos/resultado, mas preserva o anel (comportamento atual).
      return {
        ...state,
        values: { A: 0, B: 0, C: 0 },
        submitted: false,
        result: null,
      };
    default:
      return state;
  }
}
