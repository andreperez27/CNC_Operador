-- SQL OPERACIONAL — vincular o administrador Beta (NÃO é migration).
--
-- Rodar MANUALMENTE uma única vez no SQL Editor do projeto Operador_cnc.
-- Pré-requisitos: migration 20260924_create_app_users.sql aplicada;
-- usuário já criado em Authentication > Users. Pode ser reexecutado sem
-- risco (idempotente: nunca apaga nem altera email/nome já preenchidos).
-- Rode logado no Dashboard (postgres contorna RLS; fora do aplicativo).

-- UUID do admin (Supabase Auth > Users):
--   cd1bbc17-fcd6-4f49-9b62-2b31d05659d8
insert into public.app_users (id, email, nome, tipo, ativo, data_expiracao)
values (
  'cd1bbc17-fcd6-4f49-9b62-2b31d05659d8',
  null,    -- completar pelo Dashboard (Table Editor) se desejar
  null,    -- idem; email/nome são informativos, nunca decidem acesso
  'admin',
  true,
  null     -- sem expiração
)
on conflict (id) do update set
  tipo = excluded.tipo,
  ativo = excluded.ativo,
  data_expiracao = excluded.data_expiracao;

-- Conferência (somente leitura):
select id, email, nome, tipo, ativo, data_expiracao
  from public.app_users
 where id = 'cd1bbc17-fcd6-4f49-9b62-2b31d05659d8';
