// Situação exibida de um convite Beta no painel admin.
//
// O banco guarda `status` (ativo/usado/cancelado/expirado), mas nada marca
// 'expirado' sozinho — por isso a expiração é DERIVADA aqui (expira_em já
// passou e ninguém usou). Resgate vence validade: convite usado continua
// "Usado" mesmo após expira_em.
export function classificarConvite(row, now = Date.now()) {
  if (!row || typeof row !== 'object') return 'desconhecido';
  if (row.status === 'usado' || row.usado_em) return 'usado';
  if (row.status === 'cancelado') return 'cancelado';
  if (row.status === 'expirado') return 'expirado';
  const exp = Date.parse(row.expira_em);
  if (Number.isFinite(exp) && exp < now) return 'expirado';
  return 'ativo';
}

export const CONVITE_STATUS_LABEL = {
  ativo: 'Ativo',
  usado: 'Usado',
  expirado: 'Expirado',
  cancelado: 'Cancelado',
  desconhecido: '—',
};

const STATUS_COLOR = {
  ativo: 'var(--green)',
  usado: 'var(--blue)',
  expirado: 'var(--orange)',
  cancelado: 'var(--red)',
  desconhecido: 'var(--text2)',
};

export function conviteStatusColor(situacao) {
  return STATUS_COLOR[situacao] || 'var(--text2)';
}
