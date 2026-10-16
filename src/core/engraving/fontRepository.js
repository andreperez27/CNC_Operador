/**
 * Repositorio da fonte de gravacao atras de `getFont(slug): Promise<Font>`.
 *
 * Hoje so `embeddedFontRepository` (JSON embutido, validado ao carregar).
 * Regras futuras ja embutidas na interface (ver diario/BETA do gravador):
 * pacote versionado e completo, versao publicada imutavel, offline-first
 * (copia embutida como piso), `validateFont` antes de aceitar fonte externa
 * e, entre validas, vale a mais alta.
 */
import { validateFont } from './validateFont';
// Piso embutido: v2 (47 caracteres). A v1 segue no repo, imutavel,
// so para testes de compatibilidade.
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
      throw new Error(`Fonte embutida inv\u00e1lida (${slug}): ${check.errors[0]}`);
    }
    return font;
  },
};

export function getFont(slug, repo = embeddedFontRepository) {
  return repo.getFont(slug);
}
