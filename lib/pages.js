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
