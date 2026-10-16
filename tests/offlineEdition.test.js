import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isOfflineMode } from '../src/app/offlineMode';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

/**
 * Edição offline (pen-drive): a flag nunca pode vazar para o build
 * de produção, que usa vite.config.js + GitHub Pages.
 */
describe('isOfflineMode — flag só existe na edição offline', () => {
  it('desligado por padrão (sem flag no ambiente)', () => {
    expect(isOfflineMode()).toBe(false);
    expect(isOfflineMode({})).toBe(false);
    expect(isOfflineMode({ VITE_OFFLINE_MODE: '0' })).toBe(false);
  });

  it('ligado só com VITE_OFFLINE_MODE=1', () => {
    expect(isOfflineMode({ VITE_OFFLINE_MODE: '1' })).toBe(true);
  });
});

describe('produção intacta — nenhum rastro de offline', () => {
  it('vite.config.js não menciona a flag offline', () => {
    const cfg = read('vite.config.js');
    expect(cfg.includes('VITE_OFFLINE_MODE')).toBe(false);
    expect(cfg.includes('offline')).toBe(false);
    expect(cfg.includes('singlefile')).toBe(false);
  });

  it('workflow do Pages não define a flag e o build é o normal', () => {
    const wf = read('.github/workflows/deploy-pages.yml');
    expect(wf.includes('OFFLINE')).toBe(false);
    expect(wf.includes('vite.offline')).toBe(false);
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.build).toBe('vite build');
    expect(pkg.scripts['pack:offline']).toContain('scripts/pack-offline.mjs');
    expect(read('scripts/pack-offline.mjs')).toContain('vite.offline.config');
  });

  it('edição offline tem base relativa, singlefile, sem PWA e sem segredos', () => {
    const cfg = read('vite.offline.config.js');
    expect(cfg).toContain("base: './'");
    expect(cfg).toContain('viteSingleFile');
    expect(cfg).toContain('disable: true');
    expect(cfg).toContain('envDir: false');
    expect(cfg).toContain('VITE_OFFLINE_MODE');
    expect(cfg).toContain("VITE_SUPABASE_URL': JSON.stringify('')");
    expect(cfg).toContain("VITE_SUPABASE_ANON_KEY': JSON.stringify('')");
  });
});
