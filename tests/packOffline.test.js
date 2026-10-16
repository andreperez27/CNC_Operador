import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { syncPackage } from '../scripts/pack-offline.mjs';

/**
 * pack:offline em destino existente: substitui SOMENTE app/, o .bat e o
 * LEIA-ME; perfil/ e navegador/ do destino sao preservados.
 */
describe('syncPackage — destino existente preservado', () => {
  let base;
  let out;
  let dest;

  beforeEach(() => {
    base = mkdtempSync(join(tmpdir(), 'pack-'));
    out = join(base, 'out');
    dest = join(base, 'E_CNC_Operador');
    mkdirSync(join(out, 'app'), { recursive: true });
    writeFileSync(join(out, 'app', 'index.html'), 'NOVO');
    writeFileSync(join(out, 'Abrir CNC Operador.bat'), 'BAT-NOVO');
    writeFileSync(join(out, 'LEIA-ME.txt'), 'LEIA-NOVO');
    mkdirSync(join(dest, 'app'), { recursive: true });
    writeFileSync(join(dest, 'app', 'index.html'), 'ANTIGO');
    writeFileSync(join(dest, 'app', 'velho.js'), 'LEGADO-REMOVER');
    writeFileSync(join(dest, 'Abrir CNC Operador.bat'), 'BAT-ANTIGO');
    mkdirSync(join(dest, 'perfil'), { recursive: true });
    writeFileSync(join(dest, 'perfil', 'prefs.json'), '{"tema":"escuro"}');
    mkdirSync(join(dest, 'navegador'), { recursive: true });
    writeFileSync(join(dest, 'navegador', 'chrome.exe'), 'BINARIO');
    mkdirSync(join(dest, 'FirefoxPortableLegacy115', 'App', 'Firefox64'), { recursive: true });
    writeFileSync(join(dest, 'FirefoxPortableLegacy115', 'FirefoxPortable.exe'), 'LANCADOR');
    writeFileSync(join(dest, 'FirefoxPortableLegacy115', 'App', 'Firefox64', 'firefox.exe'), 'BINARIO64');
  });

  afterEach(() => {
    rmSync(base, { recursive: true, force: true });
  });

  it('substitui app, bat e LEIA-ME; mantem perfil, navegador e FirefoxPortable intactos', () => {
    syncPackage(out, dest);
    expect(readFileSync(join(dest, 'app', 'index.html'), 'utf8')).toBe('NOVO');
    expect(existsSync(join(dest, 'app', 'velho.js'))).toBe(false);
    expect(readFileSync(join(dest, 'Abrir CNC Operador.bat'), 'utf8')).toBe('BAT-NOVO');
    expect(readFileSync(join(dest, 'LEIA-ME.txt'), 'utf8')).toBe('LEIA-NOVO');
    expect(readFileSync(join(dest, 'perfil', 'prefs.json'), 'utf8')).toBe('{"tema":"escuro"}');
    expect(readFileSync(join(dest, 'navegador', 'chrome.exe'), 'utf8')).toBe('BINARIO');
    expect(readFileSync(join(dest, 'FirefoxPortableLegacy115', 'FirefoxPortable.exe'), 'utf8')).toBe('LANCADOR');
    expect(readFileSync(join(dest, 'FirefoxPortableLegacy115', 'App', 'Firefox64', 'firefox.exe'), 'utf8')).toBe('BINARIO64');
  });

  it('cria o destino quando nao existe', () => {
    const fresh = join(base, 'novo-destino');
    syncPackage(out, fresh);
    expect(readFileSync(join(fresh, 'app', 'index.html'), 'utf8')).toBe('NOVO');
  });
});
