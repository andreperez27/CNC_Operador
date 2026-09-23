/*
 * chamferInternalPreviewModel — modelo de preview do chanfro interno
 * (bolsão).
 *
 * Delega ao construtor compartilhado `buildChamferPreviewScene` com o
 * tipo 'internal'. Mantém a API consumida pelos componentes e testes
 * (tests/previewContract.test.js).
 */

import { buildChamferPreviewScene } from './buildPreviewScene';

export function buildChamferInternalPreviewModel(model) {
  return buildChamferPreviewScene(model, 'internal');
}
