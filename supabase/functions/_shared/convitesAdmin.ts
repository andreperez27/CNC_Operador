// Regras puras de administração de convites Beta (sem I/O): edição e
// exclusão pelo painel admin. A execução (service_role) vive nas Edge
// Functions `editar-convite` e `excluir-convite`; aqui vai só a DECISÃO,
// coberta em vitest (mesmo padrão de `resgatar/decision.ts`).
//
// Semântica decidida com o administrador:
// - EXCLUIR: bloqueado para convite USADO (auditoria de quem/quando
//   resgatou é preservada). Ativo/expirado/cancelado podem ser excluídos.
//   Excluir NUNCA remove acesso: o vínculo mora em `app_users`, tabela
//   independente — excluir um convite usado nem seria possível por aqui.
// - EDITAR apelido: qualquer situação (rótulo, sem efeito funcional).
// - EDITAR expiracao_beta: ativo (vale p/ futuros resgates) e usado
//   (PROPAGA para `app_users.data_expiracao`, valor exato — inclusive
//   encurtando, pois é ato explícito do admin, diferente do resgate que
//   nunca encurta). Cancelado/expirado: rejeitado (nada a resgatar).
// - EDITAR validade (expira_em, em dias): só ativo. Em usado não faz
//   sentido (já consumido); em encerrado, idem.

export type ConviteRow = {
  id: string;
  status: string;
  apelido: string | null;
  expiracao_beta: string;
  expira_em: string;
  usado_por: string | null;
};

export type EdicaoPatch = {
  apelido?: string | null;
  expiracao_beta?: string;
  validade_convite_dias?: number;
};

export type DecisaoEdicao =
  | { ok: true; updates: Record<string, string | null>; propagar: boolean }
  | { ok: false; code: 400 | 404 | 409; message: string };

export type DecisaoExclusao =
  | { ok: true }
  | { ok: false; code: 404 | 409; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidDate(s: unknown): s is string {
  return typeof s === 'string' && DATE_RE.test(s) && !Number.isNaN(Date.parse(s));
}

function normalizarApelido(v: string | null | undefined): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim().slice(0, 60);
  return t ? t : null;
}

function limitarDias(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return Math.min(30, Math.max(1, Math.floor(n)));
}

export function decidirEdicao(
  invite: ConviteRow | null | undefined,
  patch: EdicaoPatch,
  nowIso: string,
): DecisaoEdicao {
  if (!invite) return { ok: false, code: 404, message: 'Convite não encontrado.' };

  if (patch.expiracao_beta !== undefined && !isValidDate(patch.expiracao_beta)) {
    return { ok: false, code: 400, message: 'expiracao_beta inválida (AAAA-MM-DD).' };
  }

  let dias: number | null = null;
  if (patch.validade_convite_dias !== undefined) {
    dias = limitarDias(patch.validade_convite_dias);
    if (dias === null) return { ok: false, code: 400, message: 'validade_convite_dias inválida (1–30).' };
  }

  const updates: Record<string, string | null> = {};
  let propagar = false;

  if (patch.apelido !== undefined) {
    const normalizado = normalizarApelido(patch.apelido);
    if ((invite.apelido ?? null) !== normalizado) updates.apelido = normalizado;
  }

  if (patch.expiracao_beta !== undefined) {
    if (invite.status === 'cancelado' || invite.status === 'expirado') {
      return { ok: false, code: 409, message: 'Convite encerrado: datas não se aplicam.' };
    }
    if (patch.expiracao_beta !== invite.expiracao_beta) {
      updates.expiracao_beta = patch.expiracao_beta;
      propagar = invite.status === 'usado';
    }
  }

  if (dias !== null) {
    if (invite.status !== 'ativo') {
      return {
        ok: false,
        code: 409,
        message:
          invite.status === 'usado'
            ? 'Convite já utilizado: validade não se aplica.'
            : 'Convite encerrado: validade não se aplica.',
      };
    }
    updates.expira_em = new Date(new Date(nowIso).getTime() + dias * 86400000).toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return { ok: false, code: 400, message: 'Nada para atualizar.' };
  }
  return { ok: true, updates, propagar };
}

export function podeExcluir(invite: ConviteRow | null | undefined): DecisaoExclusao {
  if (!invite) return { ok: false, code: 404, message: 'Convite não encontrado.' };
  if (invite.status === 'usado') {
    return { ok: false, code: 409, message: 'Convite já utilizado — mantido para auditoria.' };
  }
  return { ok: true };
}
