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
- `LoginPage.jsx` — ponto de entrada do aceite (deslogado).
- `AuthGate.jsx` + `auth/conviteFlow.js` — aceite também quando JÁ EXISTE
  sessão (ver abaixo). Login e-mail/senha, `AuthContext`,
  `offlinePolicy`, RLS atual, App e navegação intactos.

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

## Convite aberto COM sessão já ativa (correção 2026-09-29)

**Sintoma:** o testeador abria o link, o app abria normalmente e o convite
continuava **Ativo** no painel — sem erro em tela nenhuma.

**Causa:** o aceite vivia só no `LoginPage`, que **não monta** quando há
sessão válida. Admin testando o próprio fluxo e beta em dia recebiam o app
liberado, mas o token ficava preso na URL e `resgatar` **nunca era
chamado** — o resgate não existia. Confirmado no banco: linha com
`status = 'ativo'`, `usado_em` e `usado_por` nulos.

**Correção:** `AuthGate` roda o aceite também nos estados que não montam o
LoginPage, com a decisão pura em `auth/conviteFlow.js`
(`deveProcessarConviteComSessao`, coberta por
`tests/conviteAuthFlow.test.js`):

- **granted (admin ou beta em dia):** o servidor decide — admin recebe
  `note: 'already-admin'` e a tela avisa que o convite **não** foi
  consumido; beta existente estende a validade.
- **denied por inativo/expirado:** o link novo é uma renovação legítima;
  o resgate roda e `refresh()` reavalia o acesso.
- `loading`, `signed-out` e `denied`/`no-profile` seguem no `LoginPage`
  (evita POST em duplicado; estado desconhecido não dispara resgate).
- Falha mostra a mensagem correspondente em vez de abrir o app em silêncio.

**Requisito de deploy:** a mensagem de "já admin" depende do `resgatar`
com `decision.ts`. A v3 publicada não tem isso: ela **consome** o convite do
admin sem mudar o acesso (a linha vira "Usado" e nada acontece). Publicar
`supabase functions deploy resgatar` para o comportamento correto.

## Segurança (resumo)

Token nunca persistido nem logado; hash + uso único transacional +
expiração; mensagem única de falha; admin verificado server-side;
service-role só no Edge; CORS com allowlist; sem e-mail em lugar nenhum.
Detalhe completo no relatório BETA-LINK FASE 1A.
