// Decisão pura do resgate Beta (usada pela Edge Function `resgatar`).
//
// Separa a ESCOLHA (testável em vitest) do EFEITO (consultas Supabase,
// que só existem no Edge). Regras, nesta ordem:
//
//   1. Linha existente com tipo 'admin' → NÃO consome o convite
//      ('already-admin'); admin nunca é rebaixado nem gasta convite.
//   2. Linha existente como beta → consome e ATUALIZA data_expiracao
//      para a mais distante entre a atual e a do convite (nunca encurta),
//      com ativo: true.
//   3. Sem linha → consome e INSERE a linha beta com a expiração do convite.
//
// Datas ISO-8601 comparam lexicograficamente (mesmo formato que a função
// já grava via `new Date().toISOString()`), sem dependência de Date/timezone.

export type LinhaExistente = {
  tipo: string;
  data_expiracao: string | null;
};

export type AcaoResgate =
  | { kind: 'already-admin' }
  | { kind: 'update-beta'; data_expiracao: string }
  | { kind: 'insert-beta'; data_expiracao: string };

export function decidirResgate(
  existente: LinhaExistente | null,
  expiracaoConvite: string,
): AcaoResgate {
  if (existente && existente.tipo === 'admin') {
    return { kind: 'already-admin' };
  }
  if (existente) {
    const atual = existente.data_expiracao;
    const maisDistante = !atual || expiracaoConvite >= atual ? expiracaoConvite : atual;
    return { kind: 'update-beta', data_expiracao: maisDistante };
  }
  return { kind: 'insert-beta', data_expiracao: expiracaoConvite };
}

// Decisão de USO do convite (um link vale reentradas, não só o 1º uso):
//
//   - `consume`: primeiro uso — marca usado_em/usado_por/status (auditoria
//     da origem, preservada para sempre).
//   - `reenter`: convite já usado (e ainda dentro da validade): NÃO toca
//     na linha, só vincula a sessão atual (nova linha beta ou extensão).
//   - `reject`: inexistente, expirado (mesmo que usado) ou encerrado —
//     a função responde o 410 genérico, sem distinguir (anti-enumeração).
//
// A validade do LINK (expira_em) limita a reutilização no tempo; a validade
// do BETA (expiracao_beta) vai para a linha vinculada a cada entrada.
export type ConviteParaUso = {
  status: string;
  expira_em: string;
  usado_em: string | null;
};

export type DecisaoConsumo =
  | { kind: 'consume' }
  | { kind: 'reenter' }
  | { kind: 'reject' };

export function decidirConsumo(
  invite: ConviteParaUso | null | undefined,
  nowIso: string,
): DecisaoConsumo {
  if (!invite || !invite.expira_em || invite.expira_em < nowIso) return { kind: 'reject' };
  if (invite.status === 'usado' || invite.usado_em) return { kind: 'reenter' };
  if (invite.status === 'ativo') return { kind: 'consume' };
  return { kind: 'reject' };
}
