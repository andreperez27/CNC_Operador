import { lazy } from 'react';

// Recarga única em falha de chunk lazy após deploy.
//
// PORQUÊ: o HTML antigo referencia chunks com hash que o deploy novo já
// trocou no servidor (404 em `import()`). Uma recarga resolve (HTML novo,
// URLs novas). Só UMA vez por sessão + só online: offline real ou erro de
// outra natureza propaga para não entrar em loop nem mascarar bug.
const RETRY_KEY = 'cnc-operador:chunk-retry';

function isChunkLoadError(err) {
  const msg = String(err?.message || err || '');
  return /Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk [\w-]+ failed|ChunkLoadError/i.test(msg);
}

function flagSet(storage) {
  try {
    return !!storage?.getItem(RETRY_KEY);
  } catch {
    return false; // armazenamento indisponível: sem retry, sem crash
  }
}

function flagMark(storage) {
  try {
    storage?.setItem(RETRY_KEY, '1');
  } catch {
    /* indisponível — a recarga segue mesmo assim */
  }
}

export function withChunkRetry(importer, hooks = {}) {
  const {
    storage = typeof sessionStorage !== 'undefined' ? sessionStorage : null,
    reload = () => window.location.reload(),
    // Só pula o retry com offline POSITIVO (navigator.onLine === false);
    // ausência do sinal (ex.: Node sem onLine) conta como online.
    online = () => (typeof navigator === 'undefined' || typeof navigator.onLine !== 'boolean' ? true : navigator.onLine),
  } = hooks;
  return importer().catch((err) => {
    if (isChunkLoadError(err) && online() && storage && !flagSet(storage)) {
      flagMark(storage);
      reload();
      return new Promise(() => {});
    }
    throw err;
  });
}

export function lazyWithReload(importer, hooks) {
  return lazy(() => withChunkRetry(importer, hooks));
}
