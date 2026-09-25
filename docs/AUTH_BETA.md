# Controle de acesso Beta — Supabase

Estrutura de autorização do CNC Operador (fase Beta). Código em
`src/features/auth/`; migration em
`supabase/migrations/20260924_create_app_users.sql` (**ainda não aplicada**).

## Como aplicar (manual, Dashboard do projeto `Operador_cnc`)

1. SQL Editor → colar a migration → Run.
2. Authentication → criar cada usuário (email + senha, sem auto-cadastro).
3. Table Editor → `app_users` → uma linha por usuário com `id` = UID do Auth:
   admin (`tipo='admin'`, sem expiração) e betas (`tipo='beta'`,
   `ativo=true`, `data_expiracao` quando houver).
4. Repo → Settings → Secrets → Actions: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY`. Só então o deploy passa a exigir login.

## Tabela `app_users`

| Campo | Tipo | Regras |
|---|---|---|
| `id` | uuid PK, FK `auth.users(id)` ON DELETE CASCADE, NOT NULL | **É a chave de autorização** (`auth.uid() = id`) |
| `email` | text, NULL | informativo; nunca decide acesso |
| `nome` | text, NULL | exibição |
| `tipo` | text NOT NULL DEFAULT `'beta'`, CHECK `('admin','beta')` | sem roles complexas |
| `ativo` | boolean NOT NULL DEFAULT true | `false` = bloqueado |
| `data_expiracao` | date, NULL | dia-calendário inclusive; NULL = sem expiração |

## RLS

- `ENABLE ROW LEVEL SECURITY` + 1 policy: `app_users_select_own`
  (`FOR SELECT TO authenticated USING (auth.uid() = id)`).
- **Nenhuma policy de INSERT/UPDATE/DELETE** (default-deny): Beta não
  altera a própria autorização; admin via Dashboard.
- `REVOKE ALL ... FROM anon, authenticated` + `GRANT SELECT ... TO authenticated`
  explícitos (sem depender de padrão implícito).

## O que o app espera

Após login, lê a própria linha e libera se existir, `ativo=true` e
(`data_expiracao` nula ou >= hoje). Sem linha / inativo / vencido → tela de
bloqueio genérica. Tolerância offline de 7 dias via concessão local
(`src/features/auth/offlinePolicy.js`).

## Pendências (fora desta migration)

Admin e betas no Dashboard · secrets no GitHub · tela de administração
futura · licenças/empresas futuras.
