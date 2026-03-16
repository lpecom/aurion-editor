// build.js
import path from 'node:path';
import fs from 'node:fs';
import { glob } from 'glob';
import { clean } from './lib/clean.js';
import { processAssets } from './lib/assets.js';
import { processPages, processSinglePage } from './lib/pages.js';
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

/**
 * Selective build: only process a single page without cleaning dist.
 * Re-uses existing asset manifest if available.
 */
export async function selectiveBuild(slug) {
  const startTime = Date.now();
  const config = loadConfig();
  const distDir = path.join(ROOT, 'dist');
  const srcDir = ROOT;

  // Load existing manifest or rebuild assets
  const manifestPath = path.join(distDir, 'asset-manifest.json');
  let manifest;
  if (fs.existsSync(manifestPath)) {
    // Check if any asset is newer than the manifest
    const manifestMtime = fs.statSync(manifestPath).mtimeMs;
    const assetDirs = [path.join(srcDir, 'assets'), path.join(srcDir, 'css')].filter(d => fs.existsSync(d));
    let stale = false;
    for (const dir of assetDirs) {
      const files = await glob('**/*', { cwd: dir, nodir: true });
      for (const f of files) {
        if (f.startsWith('imgs/')) continue; // skip uploaded images
        if (fs.statSync(path.join(dir, f)).mtimeMs > manifestMtime) {
          stale = true;
          break;
        }
      }
      if (stale) break;
    }
    if (stale) {
      console.log('Assets changed, rebuilding manifest...');
      manifest = await processAssets(srcDir, distDir, config.build ?? {});
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    } else {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    }
  } else {
    console.log('Processando assets...');
    if (!fs.existsSync(distDir)) {
      fs.mkdirSync(distDir, { recursive: true });
    }
    manifest = await processAssets(srcDir, distDir, config.build ?? {});
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  }

  console.log(`Processando pagina: ${slug}...`);
  await processSinglePage(srcDir, distDir, manifest, config, slug);

  const elapsed = Date.now() - startTime;
  console.log(`Build seletivo completo em ${elapsed}ms — pagina: ${slug}`);
}
