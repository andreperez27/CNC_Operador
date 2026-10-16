import { describe, it, expect } from 'vitest';
import { extractInviteToken, getInviteTokenFromUrl, clearInviteTokenFromUrl } from '../src/features/auth/convites';

/**
 * Entrada de testador via link colado (campo na LoginPage): aceita link
 * completo (#convite= ou ?convite=) ou o token opaco puro. Sem token
 * aproveitável, devolve null e a tela explica — nunca libera acesso.
 */

const TOKEN = 'AbC123_-xYz';

describe('extractInviteToken — link colado', () => {
  it('link completo com fragmento', () => {
    expect(extractInviteToken(`https://andreperez27.github.io/CNC_Operador/#convite=${TOKEN}`)).toBe(TOKEN);
  });

  it('link com query em vez de fragmento', () => {
    expect(extractInviteToken(`https://exemplo.com/app?convite=${TOKEN}`)).toBe(TOKEN);
  });

  it('fragmento com parâmetros extras', () => {
    expect(extractInviteToken(`https://exemplo.com/#/x?y=1&convite=${TOKEN}&z=2`)).toBe(TOKEN);
  });

  it('token opaco puro (base64url)', () => {
    expect(extractInviteToken(TOKEN)).toBe(TOKEN);
    expect(extractInviteToken(`  ${TOKEN}  `)).toBe(TOKEN);
  });

  it('token com escape percentual decodifica', () => {
    expect(extractInviteToken('#convite=%41%42%43')).toBe('ABC');
  });

  it('lixo, vazio e nulo devolvem null', () => {
    expect(extractInviteToken('')).toBeNull();
    expect(extractInviteToken('   ')).toBeNull();
    expect(extractInviteToken(null)).toBeNull();
    expect(extractInviteToken(undefined)).toBeNull();
    expect(extractInviteToken('convite de teste')).toBeNull();
    expect(extractInviteToken('https://exemplo.com/sem-token')).toBeNull();
  });

  it('sujeira de chat nas bordas não quebra o token', () => {
    expect(extractInviteToken(`"${TOKEN}"`)).toBe(TOKEN);
    expect(extractInviteToken(`https://exemplo.com/#convite=${TOKEN}.`)).toBe(TOKEN);
    expect(extractInviteToken(`convite: https://exemplo.com/#convite=${TOKEN} `)).toBe(TOKEN);
    expect(extractInviteToken(`'${TOKEN}'`)).toBe(TOKEN);
  });
});

describe('getInviteTokenFromUrl — leitura da URL (sem DOM: sem token)', () => {
  it('fora do navegador não há token e limpar é no-op', () => {
    expect(getInviteTokenFromUrl()).toBeNull();
    expect(() => clearInviteTokenFromUrl()).not.toThrow();
  });
});
