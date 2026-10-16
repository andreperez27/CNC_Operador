/**
 * Repositório da fonte de gravação atrás de `getFont(slug): Promise<Font>`.
 *
 * Hoje só `embeddedFontRepository` (JSON embutido, validado ao carregar).
 * Regras futuras já embutidas na interface (ver diário/BETA do gravador):
 * pacote versionado e completo, versão publicada imutável, offline-first
 * (cópia embutida como piso), `validateFont` antes de aceitar fonte externa
 * e, entre válidas, vale a mais alta.
 */
import { validateFont } from './validateFont';
// Piso embutido: v2 (47 caracteres). A v1 segue no repo, imutável,
// só para testes de compatibilidade.
import tracoSimples10 from './fonts/traco-simples-10.v2.json';

const EMBEDDED = {
  'traco-simples-10': tracoSimples10,
};

export const embeddedFontRepository = {
  async getFont(slug) {
    const font = EMBEDDED[slug];
    if (!font) throw new Error(`Fonte desconhecida: ${slug}.`);
    const check = validateFont(font);
    if (!check.valid) {
      throw new Error(`Fonte embutida inválida (${slug}): ${check.errors[0]}`);
    }
    return font;
  },
};

export function getFont(slug, repo = embeddedFontRepository) {
  return repo.getFont(slug);
}
