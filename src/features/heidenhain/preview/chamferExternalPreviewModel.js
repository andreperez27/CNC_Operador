/*
 * chamferExternalPreviewModel — modelo de preview do chanfro externo.
 *
 * Delega ao construtor compartilhado `buildChamferPreviewScene` com o
 * tipo 'external'. Mantém a API consumida pelos componentes e testes
 * (tests/previewContract.test.js).
 */

import { buildChamferPreviewScene } from './buildPreviewScene';

export function buildChamferExternalPreviewModel(model) {
  return buildChamferPreviewScene(model, 'external');
}
