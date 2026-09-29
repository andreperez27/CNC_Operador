import { describe, it, expect } from 'vitest';
import { decidirResgate } from '../supabase/functions/resgatar/decision.ts';

/**
 * Lógica de decisão do resgate Beta (a Edge Function em si não roda em
 * vitest — Deno + service-role). Cobre: admin nunca consome, beta
 * existente atualiza para a expiração mais distante, novo insere.
 */

describe('decidirResgate — resgate de convite Beta', () => {
  it("admin existente nao consome o convite (already-admin)", () => {
    expect(
      decidirResgate({ tipo: 'admin', data_expiracao: null }, '2026-12-31T00:00:00.000Z'),
    ).toEqual({ kind: 'already-admin' });
  });

  it('beta existente com convite mais distante atualiza para a data do convite', () => {
    expect(
      decidirResgate(
        { tipo: 'beta', data_expiracao: '2026-10-01T00:00:00.000Z' },
        '2026-12-31T00:00:00.000Z',
      ),
    ).toEqual({ kind: 'update-beta', data_expiracao: '2026-12-31T00:00:00.000Z' });
  });

  it('beta existente com data atual mais distante mantem a data atual (nunca encurta)', () => {
    expect(
      decidirResgate(
        { tipo: 'beta', data_expiracao: '2026-12-31T00:00:00.000Z' },
        '2026-10-01T00:00:00.000Z',
      ),
    ).toEqual({ kind: 'update-beta', data_expiracao: '2026-12-31T00:00:00.000Z' });
  });

  it('datas iguais mantem a expiracao do convite', () => {
    const d = '2026-11-15T00:00:00.000Z';
    expect(decidirResgate({ tipo: 'beta', data_expiracao: d }, d)).toEqual({
      kind: 'update-beta',
      data_expiracao: d,
    });
  });

  it('beta existente sem expiracao adota a do convite', () => {
    expect(
      decidirResgate({ tipo: 'beta', data_expiracao: null }, '2026-12-31T00:00:00.000Z'),
    ).toEqual({ kind: 'update-beta', data_expiracao: '2026-12-31T00:00:00.000Z' });
  });

  it('uid sem linha insere beta com a expiracao do convite', () => {
    expect(decidirResgate(null, '2026-12-31T00:00:00.000Z')).toEqual({
      kind: 'insert-beta',
      data_expiracao: '2026-12-31T00:00:00.000Z',
    });
  });
});
