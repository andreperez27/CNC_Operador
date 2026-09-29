# Convite Beta por link (sem e-mail)

> **Status: CONCLUÍDO e validado ponta a ponta** (gerar → link → anônimo →
> resgatar → `app_users` → AuthGate → app, com deploy verde).

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
- `supabase/functions/listar-convites/` — lista convites p/ o painel
  admin (só metadados, nunca o hash). Deploy manual:
  `supabase functions deploy listar-convites`.
- `supabase/functions/revogar-convite/` — cancela convite ativo
  (condicional e atômico; 409 se já encerrado). Deploy manual:
  `supabase functions deploy revogar-convite`.
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
4. Deploy das funções via CLI (`convidar`, `resgatar`,
   `listar-convites`, `revogar-convite`).

## Painel admin (acompanhamento)

A página Convites (`features/admin/AdminConvitesPage.jsx`) lista os
convites com situação (Ativo/Usado/Expirado/Cancelado — expiração
derivada em `convitesStatus.js`, coberta por
`tests/convitesPanel.test.js`) e botão REVOGAR p/ ativos. Exige deploy
das funções `listar-convites` e `revogar-convite` para funcionar.

## Operação (futura área admin ou chamada direta autenticada)

`POST convidar { apelido?, expiracao_beta, validade_convite_dias? }`
→ `{ link, expira_em }` → copiar e enviar. Validade do convite default 7
dias (teto 30); validade do Beta = `expiracao_beta` do convite.

## Resgate por uid já existente (sem queimar convite)

- **Admin abre um link válido:** o convite NÃO é consumido; resposta
  `{ ok: true, note: 'already-admin' }` (a linha admin segue intacta).
  Convite inválido/expirado continua `410` com mensagem única.
- **Beta existente abre um novo link:** o convite é consumido e
  `data_expiracao` vai para a MAIS DISTANTE entre a atual e a
  `expiracao_beta` do convite (nunca encurta), com `ativo: true`.
- **Uid novo:** insert como antes.
- A escolha vive em `supabase/functions/resgatar/decision.ts` (função
  pura `decidirResgate`, coberta por `tests/betaResgateDecision.test.js`);
  a Edge Function só executa o efeito. Uso único, atomicidade e
  anti-enumeração mantidos.

## Segurança (resumo)

Token nunca persistido nem logado; hash + uso único transacional +
expiração; mensagem única de falha; admin verificado server-side;
service-role só no Edge; CORS com allowlist; sem e-mail em lugar nenhum.
Detalhe completo no relatório BETA-LINK FASE 1A.
