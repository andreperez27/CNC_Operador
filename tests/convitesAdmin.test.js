import { describe, it, expect } from 'vitest';
import { decidirEdicao, podeExcluir, isValidDate } from '../supabase/functions/_shared/convitesAdmin';

/**
 * Regras puras de edição/exclusão de convites (painel admin).
 * Semântica decidida: usado nunca exclui (auditoria); apelido edita
 * sempre; expiracao_beta em usado PROPAGA exato para app_users.
 */

const NOW = '2026-10-07T12:00:00.000Z';

const ATIVO = {
  id: 'a', status: 'ativo', apelido: 'Teste', expiracao_beta: '2026-10-06',
  expira_em: '2026-10-06T12:00:00.000Z', usado_por: null,
};
const USADO = {
  id: 'b', status: 'usado', apelido: 'Perez', expiracao_beta: '2026-10-01',
  expira_em: '2026-10-06T12:00:00.000Z', usado_por: 'uid-1',
};
const CANCELADO = { ...ATIVO, id: 'c', status: 'cancelado' };

describe('podeExcluir — usado preserva auditoria', () => {
  it('ativo/expirado/cancelado podem', () => {
    expect(podeExcluir(ATIVO)).toEqual({ ok: true });
    expect(podeExcluir({ ...ATIVO, status: 'expirado' })).toEqual({ ok: true });
    expect(podeExcluir(CANCELADO)).toEqual({ ok: true });
  });

  it('usado bloqueia com 409', () => {
    const r = podeExcluir(USADO);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe(409);
      expect(r.message).toMatch(/auditoria/);
    }
  });

  it('inexistente dá 404', () => {
    const r = podeExcluir(null);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe(404);
  });
});

describe('decidirEdicao — apelido, datas e propagação', () => {
  it('inexistente dá 404; patch vazio dá 400', () => {
    expect(decidirEdicao(null, { apelido: 'x' }, NOW)).toMatchObject({ ok: false, code: 404 });
    expect(decidirEdicao(ATIVO, {}, NOW)).toMatchObject({ ok: false, code: 400 });
  });

  it('data inválida dá 400', () => {
    expect(decidirEdicao(ATIVO, { expiracao_beta: '06/10/2026' }, NOW)).toMatchObject({ ok: false, code: 400 });
    expect(isValidDate('2026-13-40')).toBe(false);
    expect(isValidDate('2026-10-06')).toBe(true);
  });

  it('ativo: apelido + beta + validade; sem propagação', () => {
    const r = decidirEdicao(
      ATIVO, { apelido: ' Novo ', expiracao_beta: '2026-12-01', validade_convite_dias: 7 }, NOW,
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.updates.apelido).toBe('Novo');
      expect(r.updates.expiracao_beta).toBe('2026-12-01');
      expect(r.updates.expira_em).toBe('2026-10-14T12:00:00.000Z');
      expect(r.propagar).toBe(false);
    }
  });

  it('usado: expiracao_beta propaga exato para o acesso', () => {
    const r = decidirEdicao(USADO, { expiracao_beta: '2026-12-01' }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.updates).toEqual({ expiracao_beta: '2026-12-01' });
      expect(r.propagar).toBe(true);
    }
  });

  it('usado: validade rejeitada; só apelido não propaga', () => {
    expect(decidirEdicao(USADO, { validade_convite_dias: 7 }, NOW)).toMatchObject({ ok: false, code: 409 });
    const r = decidirEdicao(USADO, { apelido: 'Perez 2' }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.propagar).toBe(false);
  });

  it('cancelado/expirado: datas rejeitadas, apelido ok', () => {
    expect(decidirEdicao(CANCELADO, { expiracao_beta: '2026-12-01' }, NOW)).toMatchObject({ ok: false, code: 409 });
    expect(decidirEdicao(CANCELADO, { validade_convite_dias: 7 }, NOW)).toMatchObject({ ok: false, code: 409 });
    expect(decidirEdicao(CANCELADO, { apelido: 'x' }, NOW).ok).toBe(true);
  });

  it('valor igual ao atual não conta como mudança', () => {
    expect(decidirEdicao(ATIVO, { apelido: 'Teste', expiracao_beta: '2026-10-06' }, NOW))
      .toMatchObject({ ok: false, code: 400 });
  });
});
