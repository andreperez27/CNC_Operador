import { describe, it, expect } from 'vitest';
import { decidirResgate, decidirConsumo } from '../supabase/functions/resgatar/decision.ts';

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

describe('decidirConsumo — mesmo link vale reentrada (uso único acabou)', () => {
  const NOW = '2026-10-15T00:00:00.000Z';
  const FUTURE = '2026-12-31T00:00:00.000Z';
  const PAST = '2026-09-01T00:00:00.000Z';

  it('ativo dentro da validade: consome (primeiro uso marca auditoria)', () => {
    expect(
      decidirConsumo({ status: 'ativo', expira_em: FUTURE, usado_em: null }, NOW),
    ).toEqual({ kind: 'consume' });
  });

  it('usado dentro da validade: reentra sem tocar na linha', () => {
    expect(
      decidirConsumo({ status: 'usado', expira_em: FUTURE, usado_em: '2026-10-14T00:00:00.000Z' }, NOW),
    ).toEqual({ kind: 'reenter' });
  });

  it('usado com validade vencida: rejeita (vida útil do link acabou)', () => {
    expect(
      decidirConsumo({ status: 'usado', expira_em: PAST, usado_em: PAST }, NOW),
    ).toEqual({ kind: 'reject' });
  });

  it('ativo com validade vencida: rejeita', () => {
    expect(
      decidirConsumo({ status: 'ativo', expira_em: PAST, usado_em: null }, NOW),
    ).toEqual({ kind: 'reject' });
  });

  it('cancelado/expirado rejeitam; inexistente/sem expira rejeitam', () => {
    expect(decidirConsumo({ status: 'cancelado', expira_em: FUTURE, usado_em: null }, NOW))
      .toEqual({ kind: 'reject' });
    expect(decidirConsumo({ status: 'expirado', expira_em: FUTURE, usado_em: null }, NOW))
      .toEqual({ kind: 'reject' });
    expect(decidirConsumo(null, NOW)).toEqual({ kind: 'reject' });
    expect(decidirConsumo({ status: 'ativo', usado_em: null }, NOW)).toEqual({ kind: 'reject' });
  });

  it('ativo com usado_em anômalo: reentra (não consome de novo)', () => {
    expect(
      decidirConsumo({ status: 'ativo', expira_em: FUTURE, usado_em: FUTURE }, NOW),
    ).toEqual({ kind: 'reenter' });
  });
});
