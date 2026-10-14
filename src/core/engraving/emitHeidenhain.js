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

/**
 * @param {object} args { layout, machining?, fontMeta? ({slug, version,
 *   name}), programName?, block? ({ w, h, margin, fits, overW, overH }) }
 *   Com bloco: registra sempre as dimensões; se não couber, acrescenta o
 *   aviso de excesso (o programa NÃO é bloqueado).
 * @returns {string} texto .H completo (com BEGIN/END PGM numerados).
 */
export function buildEngravingProgram({ layout, machining = {}, fontMeta = null, programName = null, block = null }) {
  const { blocks, machining: m } = buildToolpath(layout, machining);
  const meta = fontMeta || { slug: '?', version: '?', name: '?' };

  const headLines = [
    'Gravador de Textos CNC',
    `Fonte: ${meta.name} (${meta.slug} v${meta.version})`,
    'SIMULAR ANTES DE USAR',
    '',
  ];
  if (block) {
    headLines.push(`Bloco: ${block.w}x${block.h} mm (margem ${block.margin} mm)`);
    const excess = formatExcess(block);
    if (!block.fits) {
      headLines.push(`AVISO: texto não cabe no bloco${excess ? ' — ' + excess : ''}`);
    }
    headLines.push('');
  }

  const head = [
    createBlock(TYPES.COMMENT, { lines: headLines }),
    createBlock(TYPES.TOOL_CALL, { tool: m.ferramenta, axis: 'Z', speed: m.rpm }),
    createBlock(TYPES.RAPID, { coords: { z: round3(m.zInicio) }, mcode: 'M3' }),
  ];
  const tail = [
    createBlock(TYPES.RAPID, { coords: { z: round3(m.zInicio) }, mcode: 'M30' }),
  ];

  const name = programName || buildProgramName('gravacao');
  return postprocess([...head, ...blocks, ...tail], null, null, name);
}
