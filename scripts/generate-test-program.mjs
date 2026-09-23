/*
 * Gera o arquivo de teste do CHANFRO EXTERNO no padrao real de
 * producao (referencia: CHANFRO_EXT_RETO.H).
 *
 * Uso: npx tsx scripts/generate-test-program.mjs
 *
 * Parametros padrao: A=45, C=45, D=52, r=6, L=100, numeroFerramenta=1,
 * BLK FORM vazio (bloco omitido), demais valores = defaults do app.
 */

import { writeFileSync } from 'fs';
import { solveExternalChamfer } from '../src/features/heidenhain/math/chamferExternalMath';
import { buildPassStrategy } from '../src/features/heidenhain/strategy/strategyEngine';
import { toQParams, EXTERNAL_CHAMFER_MAP } from '../src/features/heidenhain/params/parameterEngine';
import { generateProgram } from '../src/features/heidenhain/program';
import { buildProgramName } from '../src/core/postprocessors/programName';

const params = {
  A: 45,
  C: 45,
  D: 52,
  r: 6,
  L: 100,
  passeZ: 0.3,
  sobre: 0,
  rpm: 3000,
  av: 600,
  numeroFerramenta: 1,
  distanciaSeguranca: 10,
  blocoW: '',
  blocoL: '',
  blocoH: '',
  toolType: 'toroidal',
};

const geo = solveExternalChamfer(params);
const strat = buildPassStrategy(geo, params);
const toolD = Number(params.D) || 0;
const seguranca = Number(params.distanciaSeguranca) || 0;

const model = {
  ...geo,
  ...strat,
  seguranca,
  xCorner: seguranca + toolD / 2,
  dMeio: toolD / 2,
  yTotal: params.L + seguranca,
  yStart: -params.L / 2,
  yEnd: params.L / 2,
  safeZ: 5,
  retrZ: 0.5,
};

const qParams = toQParams(model, EXTERNAL_CHAMFER_MAP);
const program = generateProgram(
  'chamferExternal',
  qParams,
  model,
  buildProgramName('chamferExternal')
);

writeFileSync('CHANFRO_EXT_RETO_TESTE.H', program, 'utf8');
console.log(program);
