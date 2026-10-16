import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { VitePWA } from 'vite-plugin-pwa';
import { readFileSync } from 'node:fs';

// Build SEPARADO da edição offline (pen-drive). Não é usado pelo deploy:
// a produção continua com vite.config.js + GitHub Pages, sem esta flag.
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));
const buildDate = new Date().toISOString().slice(0, 10);

export default defineConfig({
  // Sem .env: nada de segredo embutido (o offline nunca chama o Supabase).
  envDir: false,
  base: './',
  build: {
    // es2018: sintaxe rebaixada para ES2018 (Chrome 64+) e APIs de runtime
    // auditadas ate o Chrome 109 (nada de withResolvers, groupBy,
    // toSorted, .at(), hasOwn, structuredClone etc. no codigo nem nas
    // dependencias empacotadas). Nao subir o target sem reauditagem.
    target: 'es2018',
    outDir: 'dist-offline/app',
    emptyOutDir: true,
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 2000,
  },
  define: {
    'import.meta.env.VITE_OFFLINE_MODE': JSON.stringify('1'),
    'import.meta.env.VITE_APP_VERSION': JSON.stringify(pkg.version ?? '0.0.0'),
    'import.meta.env.VITE_BUILD_DATE': JSON.stringify(buildDate),
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(''),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(''),
  },
  plugins: [
    react(),
    viteSingleFile(),
    // Desativado: sem registro nem arquivo de service worker no pen-drive.
    VitePWA({ disable: true }),
  ],
});
