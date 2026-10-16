/**
 * Emissor Heidenhain .H do Gravador de Textos CNC (formato principal; ISO
 * fora da v1 por decisão — sem emissor ISO nem opção na tela).
 *
 * Monta o programa a partir dos blocos IR (`toolpath.js`) e delega o texto
 * ao postprocessor existente (`core/postprocessors/heidenhain.js`):
 * abertura `TOOL CALL` + `L Z+100 R0 FMAX M3`, fim `L Z+100 R0 FMAX M30`,
 * arcos como `CC` + `C DR∓`. Somente coordenadas absolutas na v1
 * (incremental adiado: exigiria semântica de laço/offset no programa).
 */
import { TYPES, createBlock } from '../program/types';
import { postprocess } from '../postprocessors/heidenhain';
import { buildProgramName } from '../postprocessors/programName';
import { buildToolpath, round3 } from './toolpath';
import { formatExcess } from './fit';
import { describeWorst } from './legibility';

/**
 * ASCII p/ comentário de máquina antiga: NFD tira os acentos (ç→c, é→e),
 * grau vira "graus", travessões viram "-"; a rede final troca qualquer
 * resto não-ASCII por "?" para nada passar batido.
 */
export function toAscii(s) {
  const mapped = String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/°/g, 'graus')
    .replace(/[—–]/g, '-');
  let out = '';
  for (const ch of mapped) {
    out += ch.codePointAt(0) <= 0x7f ? ch : '?';
  }
  return out;
}

/**
 * @param {object} args { layout, machining?, fontMeta? ({slug, version,
 *   name}), programName?, tooling?, block? ({ w, h, margin, fits, overW,
 *   overH }) }
 *   tooling? ({ description, depth?, zSurf?, width?, measured?, folga?,
 *   nivel?, pior? }): linhas de ferramenta e diagnóstico no cabeçalho.
 *   Com bloco: registra sempre as dimensões; se não couber, acrescenta o
 *   aviso de excesso (o programa NÃO é bloqueado).
 * @returns {string} texto .H completo (com BEGIN/END PGM numerados).
 */
export function buildEngravingProgram({ layout, machining = {}, fontMeta = null, programName = null, tooling = null, block = null }) {
  const { blocks, machining: m } = buildToolpath(layout, machining);
  const meta = fontMeta || { slug: '?', version: '?', name: '?' };
  // Números do cabeçalho: no máximo 3 casas, vírgula decimal (igual ao corpo).
  const hnum = (v) => String(Number(v.toFixed(3))).replace('.', ',');

  const headLines = [
    'Gravador de Textos CNC',
    `Fonte: ${meta.name} (${meta.slug} v${meta.version})`,
    'SIMULAR ANTES DE USAR',
    '',
  ];
  if (tooling) {
    headLines.push(`Ferramenta: ${tooling.description}`);
    if (tooling.depth !== undefined && tooling.depth !== null) {
      headLines.push(`Profundidade: ${hnum(tooling.depth)} mm (Z superficie ${hnum(tooling.zSurf ?? 0)})`);
    }
    headLines.push(
      tooling.width !== undefined && tooling.width !== null
        ? `Largura do risco: ${hnum(tooling.width)} mm (${tooling.measured ? 'medida' : 'calculada'})`
        : 'Largura do risco: nao calculada (ver parametros)',
    );
    if (tooling.nivel) {
      const folgaTxt = Number.isFinite(tooling.folga) ? `${hnum(tooling.folga)} mm` : 'sem pares';
      const worst = describeWorst(tooling.pior);
      headLines.push(`Diagnostico: ${String(tooling.nivel).toUpperCase()} — folga minima ${folgaTxt}${worst ? ` (pior ponto: ${worst})` : ''}`);
    }
    headLines.push('');
  }
  if (block) {
    headLines.push(`Bloco: ${hnum(block.w)}x${hnum(block.h)} mm (margem ${hnum(block.margin)} mm)`);
    const excess = formatExcess(block);
    if (!block.fits) {
      headLines.push(`AVISO: texto não cabe no bloco${excess ? ' — ' + excess : ''}`);
    }
    headLines.push('');
  }

  const head = [
    createBlock(TYPES.COMMENT, { lines: headLines.map(toAscii) }),
    createBlock(TYPES.TOOL_CALL, { tool: m.ferramenta, axis: 'Z', speed: m.rpm }),
    createBlock(TYPES.RAPID, { coords: { z: round3(m.zInicio) }, mcode: 'M3' }),
  ];
  const tail = [
    createBlock(TYPES.RAPID, { coords: { z: round3(m.zInicio) }, mcode: 'M30' }),
  ];

  const name = programName || buildProgramName('gravacao');
  return postprocess([...head, ...blocks, ...tail], null, null, name);
}
