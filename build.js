// build.js
import path from 'node:path';
import fs from 'node:fs';
import { clean } from './lib/clean.js';
import { processAssets } from './lib/assets.js';
import { processPages } from './lib/pages.js';
import { generateRedirects } from './lib/redirects.js';

let ROOT = process.cwd();

// Suporte a --root flag para apontar para um diretorio de projeto diferente
if (process.argv.includes('--root')) {
  ROOT = path.resolve(process.argv[process.argv.indexOf('--root') + 1]);
}

function loadConfig() {
  const configPath = path.join(ROOT, 'config.json');
  if (!fs.existsSync(configPath)) {
    throw new Error('config.json nao encontrado. Execute no diretorio do projeto.');
  }
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

export async function build() {
  const startTime = Date.now();
  const config = loadConfig();
  const distDir = path.join(ROOT, 'dist');
  const srcDir = ROOT;

  console.log('Limpando dist/...');
  await clean(distDir);

  console.log('Processando assets...');
  const manifest = await processAssets(srcDir, distDir, config.build ?? {});

  // Salvar manifesto para debug/referencia
  fs.writeFileSync(
    path.join(distDir, 'asset-manifest.json'),
    JSON.stringify(manifest, null, 2),
    'utf8'
  );

  console.log('Processando paginas...');
  const routes = await processPages(srcDir, distDir, manifest, config);

  console.log('Gerando _redirects...');
  await generateRedirects(distDir);

  const elapsed = Date.now() - startTime;
  console.log(`Build completo em ${elapsed}ms — ${routes.length} paginas, ${Object.keys(manifest).length} assets`);
}
