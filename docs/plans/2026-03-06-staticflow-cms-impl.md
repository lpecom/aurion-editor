# StaticFlow CMS — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable static site framework with automatic routing, partial injection, asset hashing, image optimization, and Cloudflare Pages deployment support.

**Architecture:** Single-file orchestrator (`build.js`) calling focused modules in `lib/`. No runtime dependencies — all tooling is devDependencies only. A `template/` directory serves as the starter kit users copy to create new sites.

**Tech Stack:** Node.js 18+, html-minifier-terser, terser, clean-css, sharp, glob, chokidar, node:test (built-in)

---

## Task 1: Project Setup

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.nvmrc`

**Step 1: Create `.nvmrc`**

```
20
```

**Step 2: Create `.gitignore`**

```
node_modules/
dist/
*.log
.DS_Store
```

**Step 3: Create `package.json`**

```json
{
  "name": "staticflow-cms",
  "version": "0.1.0",
  "description": "Minimalista static site framework with clean routes, asset hashing and zero runtime",
  "type": "module",
  "scripts": {
    "build": "node build.js build",
    "dev": "node build.js dev",
    "clean": "node build.js clean",
    "test": "node --test tests/**/*.test.js"
  },
  "devDependencies": {
    "html-minifier-terser": "^7.2.0",
    "terser": "^5.36.0",
    "clean-css": "^5.3.3",
    "sharp": "^0.33.5",
    "glob": "^10.4.5",
    "chokidar": "^3.6.0"
  }
}
```

**Step 4: Install dependencies**

```bash
cd /home/lpzada/projects/advfactory && npm install
```

Expected: `node_modules/` criado, `package-lock.json` gerado.

**Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore .nvmrc
git commit -m "chore: project setup with dependencies"
```

---

## Task 2: lib/clean.js

**Files:**
- Create: `lib/clean.js`
- Create: `tests/clean.test.js`

**Step 1: Write the failing test**

```js
// tests/clean.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { clean } from '../lib/clean.js';

test('clean removes dist/ and recreates it empty', async () => {
  const distPath = path.resolve('dist');

  // Setup: create dist with a file inside
  fs.mkdirSync(distPath, { recursive: true });
  fs.writeFileSync(path.join(distPath, 'test.html'), '<h1>test</h1>');

  await clean(distPath);

  assert.ok(fs.existsSync(distPath), 'dist/ deve existir apos clean');
  assert.deepEqual(fs.readdirSync(distPath), [], 'dist/ deve estar vazio');
});
```

**Step 2: Run to verify it fails**

```bash
node --test tests/clean.test.js
```

Expected: FAIL — `Cannot find module '../lib/clean.js'`

**Step 3: Write implementation**

```js
// lib/clean.js
import fs from 'node:fs';

export async function clean(distPath) {
  fs.rmSync(distPath, { recursive: true, force: true });
  fs.mkdirSync(distPath, { recursive: true });
}
```

**Step 4: Run to verify it passes**

```bash
node --test tests/clean.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/clean.js tests/clean.test.js
git commit -m "feat: add clean module"
```

---

## Task 3: lib/assets.js — Hash e Copia

**Files:**
- Create: `lib/assets.js`
- Create: `tests/assets.test.js`
- Create: `tests/fixtures/assets/imgs/logo.png` (qualquer PNG pequeno para o teste)

**Step 1: Criar fixture de teste**

```bash
mkdir -p tests/fixtures/assets/imgs tests/fixtures/assets/js tests/fixtures/css
# PNG 1x1 pixel valido em base64:
node -e "
import fs from 'node:fs';
const png1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
fs.writeFileSync('tests/fixtures/assets/imgs/logo.png', png1x1);
fs.writeFileSync('tests/fixtures/assets/js/app.js', 'console.log(\"hello\")');
fs.writeFileSync('tests/fixtures/css/global.css', 'body { margin: 0; }');
" --input-type=module
```

**Step 2: Write the failing test**

```js
// tests/assets.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { processAssets } from '../lib/assets.js';

test('processAssets copies files with hash and returns manifest', async () => {
  const srcDir = path.resolve('tests/fixtures');
  const distDir = path.resolve('tests/dist-assets-test');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const manifest = await processAssets(srcDir, distDir, {
    hashAssets: true,
    minifyJS: false,
    minifyCSS: false,
  });

  // Verifica que o manifesto tem entradas
  assert.ok(Object.keys(manifest).length > 0, 'manifesto deve ter entradas');

  // Verifica que todos os arquivos do manifesto existem em dist
  for (const [, hashedPath] of Object.entries(manifest)) {
    const fullPath = path.join(distDir, hashedPath);
    assert.ok(fs.existsSync(fullPath), `arquivo hashed deve existir: ${hashedPath}`);
  }

  // Cleanup
  fs.rmSync(distDir, { recursive: true, force: true });
});

test('hash e deterministico para o mesmo conteudo', async () => {
  const { hashContent } = await import('../lib/assets.js');
  const h1 = hashContent(Buffer.from('hello world'));
  const h2 = hashContent(Buffer.from('hello world'));
  assert.equal(h1, h2);
  assert.equal(h1.length, 8);
});
```

**Step 3: Run to verify it fails**

```bash
node --test tests/assets.test.js
```

Expected: FAIL — `Cannot find module '../lib/assets.js'`

**Step 4: Write implementation**

```js
// lib/assets.js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { glob } from 'glob';

export function hashContent(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
}

function addHash(filePath, hash) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  return path.join(dir, `${base}.${hash}${ext}`);
}

async function optimizeFile(filePath, content, config) {
  const ext = path.extname(filePath).toLowerCase();

  if ((ext === '.jpg' || ext === '.jpeg') && config.optimizeImages !== false) {
    const sharp = (await import('sharp')).default;
    return sharp(content).jpeg({ quality: 85, progressive: true }).toBuffer();
  }

  if (ext === '.png' && config.optimizeImages !== false) {
    const sharp = (await import('sharp')).default;
    return sharp(content).png({ compressionLevel: 9 }).toBuffer();
  }

  if (ext === '.js' && config.minifyJS) {
    const { minify } = await import('terser');
    const result = await minify(content.toString('utf8'), { mangle: true });
    return Buffer.from(result.code || content.toString('utf8'));
  }

  if (ext === '.css' && config.minifyCSS) {
    const CleanCSS = (await import('clean-css')).default;
    const result = new CleanCSS().minify(content.toString('utf8'));
    return Buffer.from(result.styles || content.toString('utf8'));
  }

  return content;
}

export async function processAssets(srcDir, distDir, config = {}) {
  const manifest = {};

  const patterns = ['assets/**/*', 'css/**/*'];
  const allFiles = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: srcDir, nodir: true });
    allFiles.push(...files);
  }

  for (const relPath of allFiles) {
    const srcFile = path.join(srcDir, relPath);
    const content = fs.readFileSync(srcFile);
    const optimized = await optimizeFile(relPath, content, config);

    let destRelPath = relPath;
    if (config.hashAssets !== false) {
      const hash = hashContent(optimized);
      destRelPath = addHash(relPath, hash);
    }

    const destFile = path.join(distDir, destRelPath);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.writeFileSync(destFile, optimized);

    manifest[relPath] = destRelPath;
  }

  return manifest;
}
```

**Step 5: Run to verify it passes**

```bash
node --test tests/assets.test.js
```

Expected: PASS

**Step 6: Commit**

```bash
git add lib/assets.js tests/assets.test.js tests/fixtures/
git commit -m "feat: add assets module with hash and optimization"
```

---

## Task 4: lib/pages.js — Roteamento, Partials e Minificacao

**Files:**
- Create: `lib/pages.js`
- Create: `tests/pages.test.js`
- Create fixtures em `tests/fixtures/pages/`, `tests/fixtures/partials/`

**Step 1: Criar fixtures**

```bash
mkdir -p tests/fixtures/pages/blog tests/fixtures/partials
```

```html
<!-- tests/fixtures/partials/head.html -->
<head>
  <meta charset="UTF-8">
  <title>{{title}}</title>
  <meta name="description" content="{{description}}">
</head>
```

```html
<!-- tests/fixtures/partials/header.html -->
<header><nav>Site</nav></header>
```

```html
<!-- tests/fixtures/partials/footer.html -->
<footer>2026</footer>
```

```html
<!-- tests/fixtures/pages/index.html -->
<!--
  title: Home
  description: Pagina inicial
-->
<!-- @partial:head -->
<!-- @partial:header -->
<main><h1>Hello</h1></main>
<!-- @partial:footer -->
```

```html
<!-- tests/fixtures/pages/sobre.html -->
<!--
  title: Sobre
  description: Sobre nos
-->
<!-- @partial:head -->
<!-- @partial:header -->
<main><h1>Sobre</h1></main>
<!-- @partial:footer -->
```

```html
<!-- tests/fixtures/pages/blog/post-1.html -->
<!--
  title: Post 1
  description: Primeiro post
-->
<!-- @partial:head -->
<main><h1>Post 1</h1></main>
<!-- @partial:footer -->
```

**Step 2: Write the failing test**

```js
// tests/pages.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { processPages } from '../lib/pages.js';

const fixturesDir = path.resolve('tests/fixtures');
const distDir = path.resolve('tests/dist-pages-test');
const config = {
  site: { name: 'Test', url: 'https://test.com', lang: 'pt-BR', description: 'Test' },
  partials: {
    head: 'partials/head.html',
    header: 'partials/header.html',
    footer: 'partials/footer.html',
  },
  build: { minifyHTML: false },
};

test('index.html vira dist/index.html', async (t) => {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const routes = await processPages(fixturesDir, distDir, {}, config);

  assert.ok(fs.existsSync(path.join(distDir, 'index.html')));
  assert.ok(routes.some(r => r === '/'));
  fs.rmSync(distDir, { recursive: true, force: true });
});

test('sobre.html vira dist/sobre/index.html', async () => {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const routes = await processPages(fixturesDir, distDir, {}, config);

  assert.ok(fs.existsSync(path.join(distDir, 'sobre', 'index.html')));
  assert.ok(routes.some(r => r === '/sobre'));
  fs.rmSync(distDir, { recursive: true, force: true });
});

test('blog/post-1.html vira dist/blog/post-1/index.html', async () => {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  await processPages(fixturesDir, distDir, {}, config);

  assert.ok(fs.existsSync(path.join(distDir, 'blog', 'post-1', 'index.html')));
  fs.rmSync(distDir, { recursive: true, force: true });
});

test('partials sao injetados corretamente', async () => {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  await processPages(fixturesDir, distDir, {}, config);

  const html = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');
  assert.ok(html.includes('<header>'), 'header partial deve estar presente');
  assert.ok(html.includes('<footer>'), 'footer partial deve estar presente');
  assert.ok(!html.includes('<!-- @partial:'), 'ancoras de partial nao devem restar');
  fs.rmSync(distDir, { recursive: true, force: true });
});

test('frontmatter injeta title e description no head', async () => {
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  await processPages(fixturesDir, distDir, {}, config);

  const html = fs.readFileSync(path.join(distDir, 'sobre', 'index.html'), 'utf8');
  assert.ok(html.includes('<title>Sobre</title>'), 'title deve ser injetado');
  assert.ok(html.includes('Sobre nos'), 'description deve ser injetada');
  fs.rmSync(distDir, { recursive: true, force: true });
});
```

**Step 3: Run to verify it fails**

```bash
node --test tests/pages.test.js
```

Expected: FAIL — `Cannot find module '../lib/pages.js'`

**Step 4: Write implementation**

```js
// lib/pages.js
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'glob';
import { minify } from 'html-minifier-terser';

function parseFrontmatter(html) {
  const meta = {};
  const match = html.match(/^<!--\s*([\s\S]*?)-->/);
  if (!match) return { meta, body: html };

  const raw = match[1];
  // Verifica se e frontmatter (tem chave: valor) ou comentario normal
  if (!raw.includes(':')) return { meta, body: html };

  for (const line of raw.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx === -1) continue;
    const key = line.substring(0, colonIdx).trim();
    const value = line.substring(colonIdx + 1).trim();
    if (key) meta[key] = value;
  }

  const body = html.substring(match[0].length).trimStart();
  return { meta, body };
}

function injectPartials(html, partialsDir, frontmatter, config, partialCache) {
  return html.replace(/<!-- @partial:(\w+) -->/g, (_, name) => {
    if (!partialCache[name]) {
      const partialFile = path.join(partialsDir, `${name}.html`);
      if (!fs.existsSync(partialFile)) return '';
      partialCache[name] = fs.readFileSync(partialFile, 'utf8');
    }

    let content = partialCache[name];

    // Substituir variaveis de frontmatter (apenas no head)
    if (name === 'head') {
      const vars = {
        title: frontmatter.title || config.site?.name || '',
        description: frontmatter.description || config.site?.description || '',
        image: frontmatter.image || config.meta?.defaultImage || '',
      };
      content = content.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
    }

    return content;
  });
}

function replaceAssetRefs(html, manifest) {
  for (const [original, hashed] of Object.entries(manifest)) {
    html = html.replaceAll(original, hashed);
  }
  return html;
}

function routeFromFile(relPath) {
  const parts = relPath.replace(/\\/g, '/').split('/');
  const filename = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);

  if (filename === 'index.html') {
    return dirs.length === 0 ? '/' : '/' + dirs.join('/');
  }
  const name = filename.replace(/\.html$/, '');
  return '/' + [...dirs, name].join('/');
}

function distPathFromRoute(route) {
  if (route === '/') return 'index.html';
  return path.join(route.substring(1), 'index.html');
}

export async function processPages(srcDir, distDir, manifest, config) {
  const pagesDir = path.join(srcDir, 'pages');
  const partialsDir = path.join(srcDir, 'partials');
  const partialCache = {};
  const routes = [];

  const files = await glob('**/*.html', { cwd: pagesDir, nodir: true });

  for (const relPath of files) {
    const srcFile = path.join(pagesDir, relPath);
    let html = fs.readFileSync(srcFile, 'utf8');

    const { meta: frontmatter, body } = parseFrontmatter(html);
    html = body;

    html = injectPartials(html, partialsDir, frontmatter, config, partialCache);
    html = replaceAssetRefs(html, manifest);

    if (config.build?.minifyHTML) {
      html = await minify(html, {
        collapseWhitespace: true,
        removeComments: true,
        minifyCSS: true,
        minifyJS: true,
      });
    }

    const route = routeFromFile(relPath);
    const destRelPath = distPathFromRoute(route);
    const destFile = path.join(distDir, destRelPath);

    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.writeFileSync(destFile, html, 'utf8');

    routes.push(route);
  }

  return routes;
}
```

**Step 5: Run to verify it passes**

```bash
node --test tests/pages.test.js
```

Expected: 5 PASS

**Step 6: Commit**

```bash
git add lib/pages.js tests/pages.test.js tests/fixtures/pages/ tests/fixtures/partials/
git commit -m "feat: add pages module with routing, partial injection and frontmatter"
```

---

## Task 5: lib/sitemap.js

**Files:**
- Create: `lib/sitemap.js`
- Create: `tests/sitemap.test.js`

**Step 1: Write the failing test**

```js
// tests/sitemap.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateSitemap } from '../lib/sitemap.js';

test('gera sitemap.xml com todas as rotas', async () => {
  const distDir = path.resolve('tests/dist-sitemap-test');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  const routes = ['/', '/sobre', '/blog/post-1'];
  const baseUrl = 'https://meusite.com.br';

  await generateSitemap(distDir, routes, baseUrl);

  const sitemapPath = path.join(distDir, 'sitemap.xml');
  assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml deve existir');

  const xml = fs.readFileSync(sitemapPath, 'utf8');
  assert.ok(xml.includes('<?xml'), 'deve ser XML valido');
  assert.ok(xml.includes('https://meusite.com.br/'), 'deve incluir rota raiz');
  assert.ok(xml.includes('https://meusite.com.br/sobre'), 'deve incluir /sobre');
  assert.ok(xml.includes('https://meusite.com.br/blog/post-1'), 'deve incluir /blog/post-1');

  fs.rmSync(distDir, { recursive: true, force: true });
});
```

**Step 2: Run to verify it fails**

```bash
node --test tests/sitemap.test.js
```

Expected: FAIL

**Step 3: Write implementation**

```js
// lib/sitemap.js
import fs from 'node:fs';
import path from 'node:path';

export async function generateSitemap(distDir, routes, baseUrl) {
  const base = baseUrl.replace(/\/$/, '');
  const today = new Date().toISOString().split('T')[0];

  const urls = routes.map(route => {
    const loc = route === '/' ? `${base}/` : `${base}${route}`;
    return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`;

  fs.writeFileSync(path.join(distDir, 'sitemap.xml'), xml, 'utf8');
}
```

**Step 4: Run to verify it passes**

```bash
node --test tests/sitemap.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/sitemap.js tests/sitemap.test.js
git commit -m "feat: add sitemap generator"
```

---

## Task 6: lib/redirects.js

**Files:**
- Create: `lib/redirects.js`
- Create: `tests/redirects.test.js`

**Step 1: Write the failing test**

```js
// tests/redirects.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { generateRedirects } from '../lib/redirects.js';

test('gera _redirects para Cloudflare Pages', async () => {
  const distDir = path.resolve('tests/dist-redirects-test');
  fs.rmSync(distDir, { recursive: true, force: true });
  fs.mkdirSync(distDir, { recursive: true });

  await generateRedirects(distDir);

  const filePath = path.join(distDir, '_redirects');
  assert.ok(fs.existsSync(filePath), '_redirects deve existir');

  const content = fs.readFileSync(filePath, 'utf8');
  assert.ok(content.includes('/sitemap.xml'), 'deve ter regra para sitemap');
  assert.ok(content.includes('404'), 'deve ter regra 404');

  fs.rmSync(distDir, { recursive: true, force: true });
});
```

**Step 2: Run to verify it fails**

```bash
node --test tests/redirects.test.js
```

Expected: FAIL

**Step 3: Write implementation**

```js
// lib/redirects.js
import fs from 'node:fs';
import path from 'node:path';

export async function generateRedirects(distDir) {
  const content = `/sitemap.xml  /sitemap.xml  200
/*            /404/index.html  404
`;
  fs.writeFileSync(path.join(distDir, '_redirects'), content, 'utf8');
}
```

**Step 4: Run to verify it passes**

```bash
node --test tests/redirects.test.js
```

Expected: PASS

**Step 5: Commit**

```bash
git add lib/redirects.js tests/redirects.test.js
git commit -m "feat: add Cloudflare Pages _redirects generator"
```

---

## Task 7: build.js — Orquestrador

**Files:**
- Create: `build.js`

**Step 1: Write implementation**

```js
// build.js
import path from 'node:path';
import fs from 'node:fs';
import { clean } from './lib/clean.js';
import { processAssets } from './lib/assets.js';
import { processPages } from './lib/pages.js';
import { generateSitemap } from './lib/sitemap.js';
import { generateRedirects } from './lib/redirects.js';

const ROOT = process.cwd();

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

  if (config.build?.generateSitemap !== false) {
    console.log('Gerando sitemap.xml...');
    await generateSitemap(distDir, routes, config.site.url);
  }

  console.log('Gerando _redirects...');
  await generateRedirects(distDir);

  const elapsed = Date.now() - startTime;
  console.log(`Build completo em ${elapsed}ms — ${routes.length} paginas, ${Object.keys(manifest).length} assets`);
}
```

**Step 2: Verificar que o build.js e importavel**

```bash
node -e "import('./build.js').then(() => console.log('OK'))" --input-type=module
```

Expected: `OK` (sem erro de syntax)

**Step 3: Commit**

```bash
git add build.js
git commit -m "feat: add build orchestrator"
```

---

## Task 8: bin/staticflow.js — CLI

**Files:**
- Create: `bin/staticflow.js`

**Step 1: Write implementation**

```js
#!/usr/bin/env node
// bin/staticflow.js
import path from 'node:path';
import fs from 'node:fs';
import { build } from '../build.js';
import { clean } from '../lib/clean.js';

const command = process.argv[2];
const ROOT = process.cwd();

async function runClean() {
  const distDir = path.join(ROOT, 'dist');
  await clean(distDir);
  console.log('dist/ removido.');
}

async function runDev() {
  const { default: chokidar } = await import('chokidar');

  console.log('Iniciando build inicial...');
  await build();

  // Servidor estatico simples
  const { createServer } = await import('node:http');
  const distDir = path.join(ROOT, 'dist');

  const server = createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    if (urlPath === '/') urlPath = '/index.html';
    else if (!path.extname(urlPath)) urlPath = `${urlPath}/index.html`;

    const filePath = path.join(distDir, urlPath);

    if (fs.existsSync(filePath)) {
      const ext = path.extname(filePath);
      const mimeTypes = {
        '.html': 'text/html',
        '.css': 'text/css',
        '.js': 'application/javascript',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.svg': 'image/svg+xml',
        '.woff2': 'font/woff2',
        '.xml': 'application/xml',
      };
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  });

  server.listen(3000, () => {
    console.log('Servidor rodando em http://localhost:3000');
  });

  // Watch
  const watchDirs = ['pages', 'partials', 'assets', 'css']
    .map(d => path.join(ROOT, d))
    .filter(d => fs.existsSync(d));

  chokidar.watch(watchDirs, { ignoreInitial: true }).on('all', async (event, filePath) => {
    const start = Date.now();
    console.log(`[${new Date().toLocaleTimeString()}] Mudanca detectada: ${path.relative(ROOT, filePath)}`);
    try {
      await build();
      console.log(`[${new Date().toLocaleTimeString()}] Rebuilt em ${Date.now() - start}ms`);
    } catch (err) {
      console.error('Erro no rebuild:', err.message);
    }
  });
}

const commands = { build, clean: runClean, dev: runDev };

if (!command || !commands[command]) {
  console.error(`Uso: node bin/staticflow.js [build|dev|clean]`);
  process.exit(1);
}

commands[command]().catch(err => {
  console.error(err.message);
  process.exit(1);
});
```

**Step 2: Verificar syntax**

```bash
node --check bin/staticflow.js
```

Expected: sem output (sem erros)

**Step 3: Commit**

```bash
git add bin/staticflow.js
git commit -m "feat: add CLI entry point with build, dev, clean commands"
```

---

## Task 9: template/ — Kit inicial do usuario

**Files:**
- Create: `template/config.json`
- Create: `template/pages/index.html`
- Create: `template/pages/sobre.html`
- Create: `template/pages/404.html`
- Create: `template/partials/head.html`
- Create: `template/partials/header.html`
- Create: `template/partials/footer.html`
- Create: `template/css/global.css`
- Create: `template/assets/imgs/.gitkeep`
- Create: `template/assets/fonts/.gitkeep`
- Create: `template/assets/icons/.gitkeep`
- Create: `template/assets/js/.gitkeep`

**Step 1: Criar config.json**

```json
{
  "site": {
    "name": "Meu Site",
    "url": "https://meusite.com.br",
    "lang": "pt-BR",
    "description": "Descricao padrao do site"
  },
  "build": {
    "minifyHTML": true,
    "minifyCSS": true,
    "minifyJS": true,
    "hashAssets": true,
    "generateSitemap": true
  },
  "partials": {
    "head": "partials/head.html",
    "header": "partials/header.html",
    "footer": "partials/footer.html"
  },
  "meta": {
    "defaultImage": "assets/imgs/og-default.jpg",
    "twitterHandle": "@handle"
  }
}
```

**Step 2: Criar partials/head.html**

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="{{description}}">
<meta property="og:title" content="{{title}}">
<meta property="og:description" content="{{description}}">
<meta property="og:image" content="{{image}}">
<meta name="twitter:card" content="summary_large_image">
<title>{{title}}</title>
<link rel="stylesheet" href="/css/global.css">
```

**Step 3: Criar partials/header.html**

```html
<header>
  <nav>
    <a href="/">Home</a>
    <a href="/sobre">Sobre</a>
  </nav>
</header>
```

**Step 4: Criar partials/footer.html**

```html
<footer>
  <p>&copy; 2026 Meu Site</p>
</footer>
```

**Step 5: Criar pages/index.html**

```html
<!--
  title: Home
  description: Bem-vindo ao meu site
-->
<!DOCTYPE html>
<html lang="pt-BR">
<!-- @partial:head -->
<body>
<!-- @partial:header -->
<main>
  <h1>Bem-vindo</h1>
  <p>Este e um site estatico gerado com StaticFlow CMS.</p>
</main>
<!-- @partial:footer -->
</body>
</html>
```

**Step 6: Criar pages/sobre.html**

```html
<!--
  title: Sobre
  description: Conheca mais sobre nos
-->
<!DOCTYPE html>
<html lang="pt-BR">
<!-- @partial:head -->
<body>
<!-- @partial:header -->
<main>
  <h1>Sobre</h1>
  <p>Pagina sobre a empresa ou pessoa.</p>
</main>
<!-- @partial:footer -->
</body>
</html>
```

**Step 7: Criar pages/404.html**

```html
<!--
  title: Pagina nao encontrada
  description: Esta pagina nao existe
-->
<!DOCTYPE html>
<html lang="pt-BR">
<!-- @partial:head -->
<body>
<!-- @partial:header -->
<main>
  <h1>404 — Pagina nao encontrada</h1>
  <p><a href="/">Voltar para o inicio</a></p>
</main>
<!-- @partial:footer -->
</body>
</html>
```

**Step 8: Criar css/global.css**

```css
*, *::before, *::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.6;
  color: #1a1a1a;
}

a {
  color: inherit;
}

main {
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1rem;
}

header {
  padding: 1rem;
  border-bottom: 1px solid #e5e5e5;
}

header nav a {
  margin-right: 1rem;
  text-decoration: none;
}

footer {
  padding: 2rem 1rem;
  border-top: 1px solid #e5e5e5;
  text-align: center;
  font-size: 0.875rem;
  color: #666;
}
```

**Step 9: Criar .gitkeep nos diretorios vazios**

```bash
mkdir -p template/assets/imgs template/assets/fonts template/assets/icons template/assets/js
touch template/assets/imgs/.gitkeep template/assets/fonts/.gitkeep template/assets/icons/.gitkeep template/assets/js/.gitkeep
```

**Step 10: Commit**

```bash
git add template/
git commit -m "feat: add starter template with pages, partials and base CSS"
```

---

## Task 10: README.md

**Files:**
- Create: `README.md`

**Step 1: Criar README**

```markdown
# StaticFlow CMS

Framework estatico minimalista: HTML + rotas limpas + assets otimizados + zero runtime.

## Quickstart

```bash
# Copiar o template para seu projeto
cp -r template/ meu-site/
cd meu-site/

# Instalar dependencias do framework (do diretorio raiz do advfactory)
# Ou adicionar como dependencia local

# Editar config.json com seus dados
# Editar pages/*.html com seu conteudo

# Build para producao
node /caminho/para/advfactory/build.js build

# Dev mode (watch + servidor local)
node /caminho/para/advfactory/build.js dev
```

## Estrutura do template

```
meu-site/
├── pages/          ← Suas paginas HTML
├── partials/       ← head.html, header.html, footer.html
├── assets/         ← Imagens, fontes, icons, JS
├── css/            ← Estilos globais e componentes
├── dist/           ← Output do build (nao editar)
└── config.json     ← Configuracoes do site
```

## Roteamento

| Arquivo             | URL        |
|---------------------|------------|
| pages/index.html    | /          |
| pages/sobre.html    | /sobre     |
| pages/blog/post.html| /blog/post |

## Partials

```html
<!--
  title: Titulo da Pagina
  description: Descricao para SEO
-->
<!-- @partial:head -->
<!-- @partial:header -->
<main>
  <!-- conteudo -->
</main>
<!-- @partial:footer -->
```

## Comandos

```bash
node build.js build   # Build completo para producao
node build.js dev     # Watch mode + servidor em localhost:3000
node build.js clean   # Limpa dist/
```

## Deploy (Cloudflare Pages)

1. Push do projeto para GitHub
2. Criar projeto no Cloudflare Pages
3. Build command: `node build.js build`
4. Build output: `dist/`
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with quickstart and usage guide"
```

---

## Task 11: Smoke Test — Build Completo

**Objetivo:** Verificar que o pipeline completo funciona rodando o build no template.

**Step 1: Copiar config.json do template para raiz (para o build funcionar no template)**

O `build.js` usa `process.cwd()` para encontrar `config.json`. Para testar o template, precisa rodar de dentro dele ou adaptar o caminho.

Ajustar `build.js` para aceitar `--root` opcional:

```js
// No inicio de build.js, antes de loadConfig():
const ROOT = process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : process.cwd();
```

**Step 2: Rodar build no template**

```bash
node build.js build --root ./template
```

Expected:
```
Limpando dist/...
Processando assets...
Processando paginas...
Gerando sitemap.xml...
Gerando _redirects...
Build completo em Xms — 3 paginas, N assets
```

**Step 3: Verificar output**

```bash
ls template/dist/
# Deve conter: index.html, sobre/, 404/, sitemap.xml, _redirects, asset-manifest.json, css/
ls template/dist/sobre/
# Deve conter: index.html
```

**Step 4: Rodar todos os testes**

```bash
node --test tests/**/*.test.js
```

Expected: todos PASS

**Step 5: Commit final**

```bash
git add build.js
git commit -m "feat: add --root flag to build.js for multi-project support"
```

---

## Resumo das Tasks

| # | Task | Modulo |
|---|------|--------|
| 1 | Project setup | package.json, .gitignore |
| 2 | clean.js | Remove e recria dist/ |
| 3 | assets.js | Hash MD5 + otimizacao de assets |
| 4 | pages.js | Roteamento + partials + frontmatter + minificacao |
| 5 | sitemap.js | Gera sitemap.xml |
| 6 | redirects.js | Gera _redirects para Cloudflare |
| 7 | build.js | Orquestrador do pipeline |
| 8 | bin/staticflow.js | CLI (build/dev/clean) |
| 9 | template/ | Kit inicial para novos projetos |
| 10 | README.md | Documentacao de uso |
| 11 | Smoke test | Verificacao do pipeline completo |
