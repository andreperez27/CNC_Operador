-- Migration: convites Beta de uso único (fase Beta Link).
--
-- OBJETIVO: tabela public.beta_convites para convites individuais resgatáveis
-- sem e-mail (sessão anônima + Edge Functions). Ver docs/BETA_LINK.md.
--
-- COMO APLICAR (manual, sem automação nesta fase):
--   Supabase Dashboard → projeto Operador_cnc → SQL Editor → colar este
--   arquivo → Run. NÃO foi executado pela automação.
--
-- REVERSÃO: drop table public.beta_convites;

-- ---------------------------------------------------------------------------
-- Tabela: o convite é identificado pelo HASH SHA-256 do token. O token puro
-- existe somente no instante da criação (Edge Function) e no link entregue
-- ao admin: nunca é persistido, nunca trafega além do resgate.
-- ---------------------------------------------------------------------------
create table public.beta_convites (
  id uuid primary key default gen_random_uuid(),

  -- SHA-256 em hex (64 chars) do token opaco. UNIQUE garante um resgate.
  token_hash text not null unique,

  -- Quem gerou (auditoria). RESTRICT: não apaga admin com convites.
  criado_por uuid not null references public.app_users (id) on delete restrict,

  criado_em timestamptz not null default now(),

  -- Validade do CONVITE (momento exato; distinto da validade do Beta).
  expira_em timestamptz not null,

  -- Preenchidos no resgate. NULL = ainda não usado.
  usado_em timestamptz null,

  -- SET NULL: se o usuário anônimo for limpo, o registro do uso permanece.
  usado_por uuid null references auth.users (id) on delete set null,

  status text not null default 'ativo'
    check (status in ('ativo', 'usado', 'cancelado', 'expirado')),

  -- Apelido opcional (ex. "Testador 01"), só exibição futura.
  apelido text null,

  -- Validade do Beta criado por este convite (dia-calendário, como app_users).
  expiracao_beta date not null
);

create index beta_convites_expira_idx on public.beta_convites (expira_em);

comment on table public.beta_convites is
  'Convites Beta de uso único: só o hash do token é guardado.';
comment on column public.beta_convites.token_hash is
  'SHA-256 hex do token opaco. O token puro nunca é persistido.';
comment on column public.beta_convites.expiracao_beta is
  'Validade (dia-calendário) do Beta criado por este convite.';

-- ---------------------------------------------------------------------------
-- RLS deny-all no cliente: ZERO policies. Leitura e escrita SOMENTE via
-- service_role dentro das Edge Functions (convidar/resgatar). Nem o
-- administrador lê esta tabela pelo aplicativo (usa o Dashboard).
-- ---------------------------------------------------------------------------
alter table public.beta_convites enable row level security;
