import { describe, it, expect } from 'vitest';
import {
  deveProcessarConviteComSessao,
  mensagemConviteError,
  CONVITE_JA_ADMIN,
} from '../src/features/auth/conviteFlow';

/**
 * Aceite de convite COM sessão já ativa (admin ou beta em dia): o LoginPage
 * nunca monta nesse estado, então antes o token ficava preso na URL e o
 * resgate não chegava ao banco (convite seguia "Ativo" no painel).
 */

const TOKEN = 'abc123';

describe('deveProcessarConviteComSessao — quem precisa do aceite fora do LoginPage', () => {
  it('sem token: nada a processar em nenhum estado', () => {
    for (const status of ['loading', 'signed-out', 'granted', 'denied']) {
      expect(deveProcessarConviteComSessao({ status, reason: null, token: null })).toBe(false);
      expect(deveProcessarConviteComSessao({ status, reason: null, token: '' })).toBe(false);
    }
  });

  it('loading e signed-out são do LoginPage (evita POST em duplicado)', () => {
    expect(deveProcessarConviteComSessao({ status: 'loading', reason: null, token: TOKEN })).toBe(false);
    expect(deveProcessarConviteComSessao({ status: 'signed-out', reason: null, token: TOKEN })).toBe(false);
  });

  it('denied sem perfil é do LoginPage (sessão órfã precisa dele montado)', () => {
    expect(deveProcessarConviteComSessao({ status: 'denied', reason: 'no-profile', token: TOKEN })).toBe(false);
  });

  it('granted com token: sim (bug do admin/beta em dia que nunca resgatava)', () => {
    expect(deveProcessarConviteComSessao({ status: 'granted', reason: null, token: TOKEN })).toBe(true);
  });

  it('denied por inativo/expirado com token: sim (renovar acesso com convite novo)', () => {
    expect(deveProcessarConviteComSessao({ status: 'denied', reason: 'inactive', token: TOKEN })).toBe(true);
    expect(deveProcessarConviteComSessao({ status: 'denied', reason: 'expired', token: TOKEN })).toBe(true);
  });

  it('argumentos ausentes ou estado desconhecido não quebram', () => {
    expect(deveProcessarConviteComSessao()).toBe(false);
    expect(deveProcessarConviteComSessao({})).toBe(false);
    expect(deveProcessarConviteComSessao({ status: undefined, reason: undefined, token: TOKEN })).toBe(false);
  });
});

describe('mensagemConviteError — texto exibido por desfecho', () => {
  it('erros conhecidos têm texto próprio', () => {
    expect(mensagemConviteError('no-backend')).toMatch(/indispon/i);
    expect(mensagemConviteError('signin')).toMatch(/sess/i);
    expect(mensagemConviteError('network')).toMatch(/rede/i);
    expect(mensagemConviteError('invalid')).toMatch(/inv/i);
  });

  it('erro desconhecido cai no genérico (nunca vaza texto cru da função)', () => {
    expect(mensagemConviteError('HTTP 500')).toBe(mensagemConviteError('invalid'));
    expect(mensagemConviteError(undefined)).toBe(mensagemConviteError('invalid'));
  });

  it('convite de admin explica que o convite NÃO foi consumido', () => {
    expect(CONVITE_JA_ADMIN).toMatch(/não foi consumido/i);
    expect(CONVITE_JA_ADMIN).toMatch(/anônima/i);
  });
});
