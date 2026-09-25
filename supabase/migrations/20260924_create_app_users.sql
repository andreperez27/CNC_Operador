-- Migration: controle de acesso Beta — tabela public.app_users
--
-- OBJETIVO: primeira estrutura de autorização do CNC Operador (fase Beta).
-- O aplicativo consulta esta tabela após o login no Supabase Auth e libera
-- o uso somente se a linha do usuário existir, estiver ativa e dentro da
-- validade. Ver docs/AUTH_BETA.md e src/features/auth/.
--
-- COMO APLICAR (manual, sem automação nesta fase):
--   Supabase Dashboard → projeto Operador_cnc → SQL Editor → colar este
--   arquivo → Run. NÃO foi executado pela automação.
--
-- REVERSÃO: drop policy "app_users_select_own"; drop table public.app_users;

-- ---------------------------------------------------------------------------
-- Tabela: a chave de autorização é SEMPRE o id (uuid = auth.users.id).
-- O email é apenas informativo e NUNCA decide acesso.
-- data_expiracao é dia-calendário (date, sem hora): NULL = sem expiração.
-- O app compara data_expiracao < dia local; no vencimento, bloqueia.
-- ---------------------------------------------------------------------------
create table public.app_users (
  -- PK + FK: o id É o auth.users.id. ON DELETE CASCADE remove a linha
  -- quando o usuário é excluído no Auth (sem órfãos).
  id uuid primary key references auth.users (id) on delete cascade not null,

  -- Informativo. NULL permitido: a linha pode ser criada pelo admin antes
  -- da confirmação do email, e a autorização nunca usa este campo.
  email text null,

  -- Nome de exibição. NULL permitido.
  nome text null,

  -- Papel mínimo da fase Beta. CHECK fechado: sem roles complexas agora.
  tipo text not null default 'beta' check (tipo in ('admin', 'beta')),

  -- Interruptor de acesso. DEFAULT true para não travar cadastros manuais.
  ativo boolean not null default true,

  -- Dia-calendário limite (inclusive). NULL = sem expiração.
  data_expiracao date null
);

comment on table public.app_users is
  'Autorização do Beta: uma linha por usuário, id = auth.users.id.';
comment on column public.app_users.data_expiracao is
  'Dia-calendário limite de acesso (inclusive). NULL = sem expiração.';

-- ---------------------------------------------------------------------------
-- RLS: leitura SOMENTE da própria linha (auth.uid() = id).
-- ---------------------------------------------------------------------------
alter table public.app_users enable row level security;

-- Sem esta policy, nem o dono lê (RLS default-deny). Com ela, o autenticado
-- lê EXCLUSIVAMENTE a linha cujo id é o seu uid: não enxerga admins, betas
-- ou qualquer outra pessoa.
create policy "app_users_select_own"
  on public.app_users
  for select
  to authenticated
  using (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- ESCRITA: nenhuma policy de INSERT/UPDATE/DELETE nesta fase (default-deny).
-- O usuário Beta não altera a própria autorização; criação/alteração é feita
-- pelo administrador no Supabase Dashboard (service_role do dashboard,
-- que contorna RLS e NUNCA entra no aplicativo).
-- Grants explícitos para não depender de padrão implícito:
-- ---------------------------------------------------------------------------
revoke all on public.app_users from anon, authenticated;
grant select on public.app_users to authenticated;
