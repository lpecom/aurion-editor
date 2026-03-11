// scripts/import-pages.js — Import advertorial pages from portal-g3 and advmachina repos
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import Database from 'better-sqlite3';

const ROOT = path.resolve(import.meta.dirname, '..');
const DB_PATH = path.join(ROOT, 'data', 'aurion.db');
const DIST_DIR = path.join(ROOT, 'dist');

// Ensure data dir exists
fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(path.join(ROOT, 'server', 'db', 'schema.sql'), 'utf-8');
db.exec(schema);

const insertPage = db.prepare(`
  INSERT OR IGNORE INTO pages (id, title, slug, type, lang, status, html_content, created_at, updated_at)
  VALUES (?, ?, ?, 'advertorial', 'pt-BR', 'draft', ?, datetime('now'), datetime('now'))
`);

function extractTitle(html) {
  const match = html.match(/<title[^>]*>(.*?)<\/title>/is);
  if (!match) return 'Sem título';
  return match[1].replace(/\s*[-–—|].*$/, '').trim() || 'Sem título';
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const imported = [];

// ─── Portal G3 ───
const G3_DIR = '/tmp/portal-g3-import';
const g3Pages = [
  { file: 'pages/materia-porcelana-kit.html', slug: 'g3-materia-porcelana-kit', assetsDir: 'assets/materia-porcelana-kit' },
  { file: 'pages/materia-porcelana-viraliza-fabrica.html', slug: 'g3-materia-porcelana-viraliza-fabrica', assetsDir: 'assets/materia-porcelana-viraliza-fabrica' },
  { file: 'pages/materia-solda-laser.html', slug: 'g3-materia-solda-laser', assetsDir: 'assets/materia-solda-laser' },
];

for (const page of g3Pages) {
  const htmlPath = path.join(G3_DIR, page.file);
  if (!fs.existsSync(htmlPath)) {
    console.log(`SKIP (not found): ${page.file}`);
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const title = extractTitle(html);
  const id = randomUUID();

  // Copy assets
  const assetsSrc = path.join(G3_DIR, page.assetsDir);
  const assetsDest = path.join(DIST_DIR, page.slug, 'assets');
  if (fs.existsSync(assetsSrc)) {
    copyDirRecursive(assetsSrc, assetsDest);
    console.log(`  Assets: ${page.assetsDir} → dist/${page.slug}/assets/`);
  }

  // Rewrite asset paths in HTML: assets/materia-xxx/ → assets/
  const rewrittenHtml = html.replace(
    new RegExp(`assets/${path.basename(page.assetsDir)}/`, 'g'),
    'assets/'
  );

  insertPage.run(id, title, page.slug, rewrittenHtml);
  imported.push({ source: 'portal-g3', slug: page.slug, title });
  console.log(`OK [portal-g3] "${title}" → /${page.slug}`);
}

// ─── Advmachina ───
const ADV_DIR = '/tmp/advmachina-import';

// Pages in subdirectories (index.html inside dir)
const advDirPages = [
  { dir: 'materia-correios-galpao-eletronicos', slug: 'adv-correios-galpao-eletronicos' },
  { dir: 'materia-porcelana-kit', slug: 'adv-porcelana-kit' },
  { dir: 'materia-porcelana-viraliza', slug: 'adv-porcelana-viraliza' },
  { dir: 'materia-porcelana-viraliza-fabrica', slug: 'adv-porcelana-viraliza-fabrica' },
];

for (const page of advDirPages) {
  const htmlPath = path.join(ADV_DIR, page.dir, 'index.html');
  if (!fs.existsSync(htmlPath)) {
    console.log(`SKIP (not found): ${page.dir}/index.html`);
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const title = extractTitle(html);
  const id = randomUUID();

  // Copy the entire page directory (assets inside)
  const pageSrc = path.join(ADV_DIR, page.dir);
  const pageDest = path.join(DIST_DIR, page.slug);
  // Copy assets subdirectory
  const assetsSrc = path.join(pageSrc, 'assets');
  if (fs.existsSync(assetsSrc)) {
    copyDirRecursive(assetsSrc, path.join(pageDest, 'assets'));
    console.log(`  Assets: ${page.dir}/assets/ → dist/${page.slug}/assets/`);
  }
  // Copy projeto_files if exists
  const projetoSrc = path.join(pageSrc, 'projeto_files');
  if (fs.existsSync(projetoSrc)) {
    copyDirRecursive(projetoSrc, path.join(pageDest, 'projeto_files'));
    console.log(`  Assets: ${page.dir}/projeto_files/ → dist/${page.slug}/projeto_files/`);
  }

  insertPage.run(id, title, page.slug, html);
  imported.push({ source: 'advmachina', slug: page.slug, title });
  console.log(`OK [advmachina] "${title}" → /${page.slug}`);
}

// Root-level advmachina pages (with shared /assets/ dir)
const advRootPages = [
  { file: 'index.html', slug: 'adv-porcelana-principal' },
  { file: 'index-tania-bulhoes.html', slug: 'adv-porcelana-tania-bulhoes' },
  { file: 'index-importador.html', slug: 'adv-porcelana-importador' },
];

// Copy shared root assets once
const advRootAssets = path.join(ADV_DIR, 'assets');
if (fs.existsSync(advRootAssets)) {
  for (const rootPage of advRootPages) {
    copyDirRecursive(advRootAssets, path.join(DIST_DIR, rootPage.slug, 'assets'));
  }
  console.log(`  Shared assets copied to all root advmachina pages`);
}

for (const page of advRootPages) {
  const htmlPath = path.join(ADV_DIR, page.file);
  if (!fs.existsSync(htmlPath)) {
    console.log(`SKIP (not found): ${page.file}`);
    continue;
  }
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const title = extractTitle(html);
  const id = randomUUID();

  insertPage.run(id, title, page.slug, html);
  imported.push({ source: 'advmachina', slug: page.slug, title });
  console.log(`OK [advmachina] "${title}" → /${page.slug}`);
}

db.close();

console.log(`\n=== Import complete ===`);
console.log(`Total: ${imported.length} pages imported`);
console.table(imported);
