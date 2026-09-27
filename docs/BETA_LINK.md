# Convite Beta por link (sem e-mail)

Fluxo: admin gera link → testador abre → sessão anônima → resgate →
`app_users` → AuthGate/offline normais. Login e-mail/senha intacto.

## Peças

- `supabase/migrations/20260926_beta_convites.sql` — tabela + RLS deny-all
  (**não aplicada**; aplicar manual no SQL Editor).
- `supabase/functions/convidar/` — gera token 256 bits, grava só o SHA-256,
  somente admin (checagem server-side). Deploy manual:
  `supabase functions deploy convidar`.
- `supabase/functions/resgatar/` — consumo atômico + vínculo do uid
  (sem rebaixar admin). Deploy manual: `supabase functions deploy resgatar`.
- `supabase/functions/_shared/auth.ts` — JWT, admin-check, CORS, JSON.
- `src/features/auth/convites.js` — lê `#convite=` (ou `?convite=`),
  anonimiza, resgata, limpa a URL. Token só em memória.
- `LoginPage.jsx` — ponto de entrada do aceite (deslogado). Nada mais
  da UI foi tocado: AuthGate, AuthContext, offlinePolicy, RLS atual,
  App, navegação e login normal estão intactos.

## Configuração (Dashboard, manual)

1. SQL Editor → migration acima → Run.
2. Auth → Providers → habilitar **Anonymous sign-ins**.
3. Edge Functions → Manage secrets: `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`
   (`https://andreperez27.github.io/CNC_Operador`).
4. Deploy das 2 funções via CLI.

## Operação (futura área admin ou chamada direta autenticada)

`POST convidar { apelido?, expiracao_beta, validade_convite_dias? }`
→ `{ link, expira_em }` → copiar e enviar. Validade do convite default 7
dias (teto 30); validade do Beta = `expiracao_beta` do convite.

## Segurança (resumo)

Token nunca persistido nem logado; hash + uso único transacional +
expiração; mensagem única de falha; admin verificado server-side;
service-role só no Edge; CORS com allowlist; sem e-mail em lugar nenhum.
Detalhe completo no relatório BETA-LINK FASE 1A.
