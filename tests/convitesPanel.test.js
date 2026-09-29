import { describe, it, expect } from 'vitest';
import { classificarConvite, CONVITE_STATUS_LABEL, conviteStatusColor } from '../src/features/admin/convitesStatus';

/**
 * Situação exibida dos convites (as Edge Functions não rodam em vitest —
 * Deno + service-role; aqui vai só a derivação pura usada pelo painel).
 */

const NOW = Date.parse('2026-09-29T12:00:00.000Z');
const FUTURO = '2026-10-06T12:00:00.000Z';
const PASSADO = '2026-09-20T12:00:00.000Z';

describe('classificarConvite — situação do convite no painel admin', () => {
  it('ativo: status ativo com validade futura', () => {
    expect(classificarConvite({ status: 'ativo', expira_em: FUTURO, usado_em: null }, NOW)).toBe('ativo');
  });

  it('usado: resgate vence a validade (mesmo expirado no relógio)', () => {
    expect(classificarConvite({ status: 'usado', expira_em: PASSADO, usado_em: PASSADO }, NOW)).toBe('usado');
    expect(classificarConvite({ status: 'ativo', expira_em: FUTURO, usado_em: FUTURO }, NOW)).toBe('usado');
  });

  it('cancelado explícito', () => {
    expect(classificarConvite({ status: 'cancelado', expira_em: FUTURO, usado_em: null }, NOW)).toBe('cancelado');
  });

  it('expirado explícito', () => {
    expect(classificarConvite({ status: 'expirado', expira_em: PASSADO, usado_em: null }, NOW)).toBe('expirado');
  });

  it('expirado derivado: ativo com validade passada e sem uso', () => {
    expect(classificarConvite({ status: 'ativo', expira_em: PASSADO, usado_em: null }, NOW)).toBe('expirado');
  });

  it('limite: validade exatamente agora ainda conta como ativo', () => {
    const exato = new Date(NOW).toISOString();
    expect(classificarConvite({ status: 'ativo', expira_em: exato, usado_em: null }, NOW)).toBe('ativo');
  });

  it('linha ausente → desconhecido', () => {
    expect(classificarConvite(null, NOW)).toBe('desconhecido');
    expect(classificarConvite(undefined, NOW)).toBe('desconhecido');
  });

  it('rótulos e cores cobrem todas as situações', () => {
    for (const s of ['ativo', 'usado', 'expirado', 'cancelado', 'desconhecido']) {
      expect(CONVITE_STATUS_LABEL[s]).toBeTruthy();
      expect(conviteStatusColor(s)).toMatch(/^var\(--/);
    }
    expect(conviteStatusColor('x')).toBe('var(--text2)');
  });
});
