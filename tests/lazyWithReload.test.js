import { describe, it, expect, vi } from 'vitest';
import { withChunkRetry } from '../src/app/lazyWithReload';

/**
 * Retry único em falha de chunk: recarrega 1x (online, sem flag) e
 * propaga nos demais casos — nunca loop, nunca máscara de outro erro.
 */

function memStorage() {
  const data = {};
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
  };
}

const chunkError = () => new TypeError('Failed to fetch dynamically imported module: https://x/assets/Y.js');

describe('withChunkRetry', () => {
  it('sucesso passa o modulo adiante sem recarregar', async () => {
    const reload = vi.fn();
    const mod = { default: {} };
    await expect(withChunkRetry(() => Promise.resolve(mod), { reload })).resolves.toBe(mod);
    expect(reload).not.toHaveBeenCalled();
  });

  it('falha de chunk online sem flag: recarrega 1x e marca a flag', async () => {
    const reload = vi.fn();
    const storage = memStorage();
    let settled = false;
    const p = withChunkRetry(() => Promise.reject(chunkError()), { reload, storage });
    p.then(() => { settled = true; }, () => { settled = true; });
    await Promise.resolve();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(storage.getItem('cnc-operador:chunk-retry')).toBe('1');
    expect(settled).toBe(false); // promessa pendente: a página está recarregando
  });

  it('flag ja marcada: propaga o erro sem recarregar de novo', async () => {
    const reload = vi.fn();
    const storage = memStorage();
    storage.setItem('cnc-operador:chunk-retry', '1');
    await expect(withChunkRetry(() => Promise.reject(chunkError()), { reload, storage }))
      .rejects.toThrow(/dynamically imported module/);
    expect(reload).not.toHaveBeenCalled();
  });

  it('offline: propaga sem recarregar', async () => {
    const reload = vi.fn();
    await expect(withChunkRetry(() => Promise.reject(chunkError()), {
      reload, storage: memStorage(), online: () => false,
    })).rejects.toThrow(/dynamically imported module/);
    expect(reload).not.toHaveBeenCalled();
  });

  it('erro de outra natureza: propaga sem recarregar nem marcar flag', async () => {
    const reload = vi.fn();
    const storage = memStorage();
    await expect(withChunkRetry(() => Promise.reject(new Error('bug no modulo')), { reload, storage }))
      .rejects.toThrow('bug no modulo');
    expect(reload).not.toHaveBeenCalled();
    expect(storage.getItem('cnc-operador:chunk-retry')).toBeNull();
  });
});
