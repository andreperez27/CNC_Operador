// Edição offline (pen-drive): definida SÓ no build separado
// (vite.offline.config.js). O build de produção nunca define essa flag.
export function isOfflineMode(env) {
  const source = env ?? import.meta.env;
  return !!source && source.VITE_OFFLINE_MODE === '1';
}
