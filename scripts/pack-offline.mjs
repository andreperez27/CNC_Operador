// Monta a pasta pronta do pen-drive em dist-offline/ (ignorado pelo git).
// Uso: npm run pack:offline [-- <destino>]
// Com destino: copia o resultado para a pasta informada (ex.: E:\CNC_Operador),
// substituindo SOMENTE app\, o .bat e o LEIA-ME.txt; perfil\ e navegador\
// do destino sao preservados.
// Sem destino: so gera em dist-offline/ para conferencia.
import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist-offline');

const BAT = 'Abrir CNC Operador.bat';
const LEIAME = 'LEIA-ME.txt';

// Sincroniza o distribuivel com o destino, sem tocar em perfil/ e
// navegador/ que ja existam la (dados do operador e navegador portatil).
export function syncPackage(outDir, destDir) {
  mkdirSync(destDir, { recursive: true });
  rmSync(join(destDir, 'app'), { recursive: true, force: true });
  cpSync(join(outDir, 'app'), join(destDir, 'app'), { recursive: true });
  for (const f of [BAT, LEIAME]) {
    cpSync(join(outDir, f), join(destDir, f));
  }
}

function main() {
  execSync('npx vite build --config vite.offline.config.js', { cwd: root, stdio: 'inherit' });

  // perfil/ nunca vai no pacote (eh estado de execucao, nao de distribuicao);
  // navegador/ eh conteudo do operador e eh preservado entre geracoes.
  rmSync(join(out, 'perfil'), { recursive: true, force: true });
  mkdirSync(join(out, 'navegador'), { recursive: true });
  for (const f of [BAT, LEIAME]) {
    cpSync(join(root, 'offline', f), join(out, f));
  }
}

const walk = (dir, base = '') => {
  let total = 0;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) total += walk(p, `${base}${e.name}/`);
    else {
      total += statSync(p).size;
      console.log(`  ${base}${e.name}`);
    }
  }
  return total;
};

function run() {
  main();
  const dest = process.argv[2];
  if (dest) {
    syncPackage(out, resolve(dest));
    console.log(`Copiado para ${resolve(dest)}`);
  } else {
    const kb = Math.round(walk(out) / 1024);
    console.log(`Pasta pronta em ${out} (${kb} KB). Passe um destino para copiar, ex.: npm run pack:offline -- E:\\CNC_Operador`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  run();
}
