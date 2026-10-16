// Edge Function: resgatar — consome um convite Beta e vincula o uid
// (sessão comum ou anônima) a uma linha beta em app_users.
//
// Deploy (manual, fora desta fase):
//   supabase functions deploy resgatar
// Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (nunca no frontend).

import { serviceClient, getCallerUid, json, handleOptions } from '../_shared/auth.ts';
import { decidirResgate, decidirConsumo } from './decision.ts';

async function sha256hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const opt = handleOptions(req);
  if (opt) return opt;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return json({ error: 'Método inválido.' }, 405, origin);

  let uid: string;
  try {
    uid = await getCallerUid(req);
  } catch (e) {
    return e instanceof Response ? e : json({ error: 'Erro interno.' }, 500, origin);
  }

  let token = '';
  try {
    token = String((await req.json())?.token ?? '');
  } catch {
    token = '';
  }
  if (!token) return json({ error: 'Convite inválido ou expirado.' }, 410, origin);

  const svc = serviceClient();
  const nowIso = new Date().toISOString();

  // Consulta prévia pelo uid: sem ela, o upsert com ignoreDuplicates
  // queimava o convite de um beta JÁ existente sem atualizar nada.
  const { data: existing, error: existingError } = await svc
    .from('app_users')
    .select('tipo,data_expiracao')
    .eq('id', uid)
    .maybeSingle();
  if (existingError) return json({ error: 'Não foi possível ativar o acesso.' }, 500, origin);

  // Admin testando o próprio fluxo: NÃO consome o convite (verificado
  // ANTES do consumo atômico) e nunca é rebaixado. `ok: true` mantém o
  // cliente (convites.js) no caminho de sucesso — sem quebrar o anônimo.
  if (existing && existing.tipo === 'admin') {
    return json({ ok: true, note: 'already-admin' }, 200, origin);
  }

  // Localiza o convite (sem consumir ainda) e decide o uso: primeiro uso
  // marca usado (auditoria da origem); reentrada com link válido só
  // vincula a sessão atual, sem tocar na linha.
  const { data: found, error: readError } = await svc
    .from('beta_convites')
    .select('id,status,expiracao_beta,expira_em,usado_em')
    .eq('token_hash', await sha256hex(token))
    .maybeSingle();
  if (readError) return json({ error: 'Não foi possível ativar o acesso.' }, 500, origin);
  if (decidirConsumo(found ?? null, nowIso).kind === 'reject') {
    // Mensagem única de propósito: não distingue inexistente/expirado/
    // cancelado (anti-enumeração de convites).
    return json({ error: 'Convite inválido ou expirado.' }, 410, origin);
  }

  let invite = found;
  if (decidirConsumo(found, nowIso).kind === 'consume') {
    // Consumo ATÔMICO em uma única instrução: sob concorrência, exatamente
    // um primeiro uso vence. Quem perde a corrida cai para reentrada
    // (link válido, sessão legítima) em vez de 410.
    const { data: consumed, error: consumeError } = await svc
      .from('beta_convites')
      .update({ usado_em: nowIso, usado_por: uid, status: 'usado' })
      .eq('id', found.id)
      .eq('status', 'ativo')
      .select('id,expiracao_beta')
      .maybeSingle();
    if (consumeError) return json({ error: 'Não foi possível ativar o acesso.' }, 500, origin);
    if (consumed) {
      invite = consumed;
    } else {
      const { data: again } = await svc
        .from('beta_convites')
        .select('id,status,expiracao_beta,expira_em,usado_em')
        .eq('id', found.id)
        .maybeSingle();
      if (decidirConsumo(again ?? null, nowIso).kind !== 'reenter') {
        return json({ error: 'Convite inválido ou expirado.' }, 410, origin);
      }
      invite = again;
    }
  }

  // Vincula o uid conforme a decisão pura (decision.ts): beta existente
  // tem a expiração estendida para a mais distante (nunca encurtada);
  // uid novo insere; admin jamais chega aqui (retornou acima).
  const acao = decidirResgate(
    existing ? { tipo: existing.tipo, data_expiracao: existing.data_expiracao ?? null } : null,
    invite.expiracao_beta,
  );
  if (acao.kind === 'update-beta') {
    const { error: updateError } = await svc
      .from('app_users')
      .update({ data_expiracao: acao.data_expiracao, ativo: true })
      .eq('id', uid);
    if (updateError) return json({ error: 'Não foi possível ativar o acesso.' }, 500, origin);
  } else {
    const { error: linkError } = await svc.from('app_users').upsert(
      { id: uid, tipo: 'beta', ativo: true, data_expiracao: acao.data_expiracao },
      { onConflict: 'id', ignoreDuplicates: true },
    );
    if (linkError) return json({ error: 'Não foi possível ativar o acesso.' }, 500, origin);
  }

  return json({ ok: true }, 200, origin);
});
