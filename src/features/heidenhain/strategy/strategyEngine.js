/**
 * Estratégia de passes — re-export do motor canônico (core).
 *
 * Mesma API legada `buildPassStrategy(model, params)`, agora com:
 *   - guarda contra passeZ <= 0 (ValidationError INVALID_PASS_DEPTH,
 *     antes: loop infinito/OOM);
 *   - sinal de X por tipo (externo +, interno −) usando `model.type`,
 *     alinhando o preview com o programa gerado.
 */

export { buildPassStrategy } from '../../../core/machining/chamfer/strategy';