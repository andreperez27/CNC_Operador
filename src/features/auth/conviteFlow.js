// Decisões puras do aceite de convite Beta quando JÁ EXISTE sessão.
//
// O aceite tradicional roda no LoginPage (só monta deslogado). Quem abre um
// link de convite com sessão ativa — admin testando o próprio fluxo ou um
// beta em dia — nunca monta o LoginPage, então o token ficava preso na URL e
// o resgate não chegava ao banco: o convite continuava "Ativo" no painel sem
// qualquer aviso. Estes helpers decidem, sem efeitos, quando o aceite precisa
// rodar fora do LoginPage e qual mensagem exibir em cada desfecho.

export const CONVITE_JA_ADMIN =
  'Você já tem acesso administrativo: o convite não foi consumido. Para testar o resgate, abra o link em uma janela anônima, sem nenhuma sessão.';

const MENSAGENS = {
  'no-backend': 'Serviço indisponível. Tente novamente com internet.',
  signin: 'Não foi possível iniciar a sessão do convite. Tente novamente.',
  network: 'Falha de rede ao validar o convite. Tente novamente.',
  invalid: 'Convite inválido ou expirado.',
};

// Fallback genérico: nunca expõe erro cru da função ao usuário.
export function mensagemConviteError(erro) {
  return MENSAGENS[erro] || MENSAGENS.invalid;
}

// `loading` e `signed-out` (e `denied` sem perfil) são do LoginPage: rodar o
// aceite nos dois lugares chamaria a função em duplicado. A lista é fechada
// de propósito: estado desconhecido (ex.: auth ainda sem status) não pode
// disparar resgate. Só entram granted (admin/beta em dia) e denied por
// inativo/expirado, que nunca montam o LoginPage.
export function deveProcessarConviteComSessao({ status, reason, token } = {}) {
  if (!token) return false;
  if (status === 'granted') return true;
  if (status === 'denied') return reason !== 'no-profile';
  return false;
}
