# Controle de acesso Beta — Supabase

Estrutura de autorização do CNC Operador (fase Beta). Código em
`src/features/auth/`; migration em
`supabase/migrations/20260924_create_app_users.sql` (**aplicada em
2026-09-27** no projeto `Operador_cnc` — ver diário de 2026-09-27,
"Convites Beta — CONCLUÍDO e validado ponta a ponta").

## Como foi aplicado [Registro — já executado em 2026-09-27]

1. SQL Editor → migration colada → Run.
2. Authentication → usuários criados (email + senha, sem auto-cadastro).
3. Table Editor → `app_users` → uma linha por usuário com `id` = UID do Auth:
   admin (`tipo='admin'`, sem expiração) e betas (`tipo='beta'`,
   `ativo=true`, `data_expiracao` quando houver).
4. Repo → Settings → Secrets → Actions: `VITE_SUPABASE_URL`,
   `VITE_SUPABASE_ANON_KEY` configurados (deploy verde com login
   funcionando comprova). A partir daí o deploy passou a exigir login.

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

- ~~secrets no GitHub~~ — **concluído** (deploy verde com login comprova);
- tela de administração completa (listar/revogar) — o mini-admin de
  geração existe (`features/admin/AdminConvitesPage.jsx`); falta o resto;
- Admin e betas no Dashboard (gestão contínua) · licenças/empresas futuras.

## Convites sem e-mail

Ver `docs/BETA_LINK.md` (tabela `beta_convites` + Edge Functions
`convidar`/`resgatar` + aceite no login). O login e-mail/senha e o gate
permanecem inalterados.
