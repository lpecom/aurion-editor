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

/**
 * Inject pixel tracking codes into HTML.
 * Pixels are injected before </head> if present, or at the top of the document.
 * @param {string} html - HTML content
 * @param {Array} pixels - Array of pixel objects { type, pixel_id, config }
 * @returns {string} HTML with pixels injected
 */
export function injectPixels(html, pixels) {
  if (!pixels || pixels.length === 0) return html;

  const pixelCodes = pixels.map(pixel => {
    const config = pixel.config ? (typeof pixel.config === 'string' ? JSON.parse(pixel.config) : pixel.config) : {};
    const events = pixel.events ? (typeof pixel.events === 'string' ? JSON.parse(pixel.events) : pixel.events) : [];

    const fbExtra = events.filter(e => e !== 'PageView').map(e => `fbq('track','${e}');`).join('');
    const gaExtra = events.filter(e => e !== 'page_view').map(e => `gtag('event','${e}');`).join('');
    const ttExtra = events.filter(e => e !== 'ViewContent').map(e => `ttq.track('${e}');`).join('');
    const tbExtra = events.filter(e => e !== 'page_view').map(e => `_tfa.push({notify:'event',name:'${e}',id:${pixel.pixel_id}});`).join('');

    switch (pixel.type) {
      case 'facebook':
        return `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${pixel.pixel_id}');fbq('track','PageView');${fbExtra}</script>`;
      case 'google':
        return `<script async src="https://www.googletagmanager.com/gtag/js?id=${pixel.pixel_id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${pixel.pixel_id}');${gaExtra}</script>`;
      case 'tiktok':
        return `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${pixel.pixel_id}');ttq.page();${ttExtra}}(window,document,'ttq');</script>`;
      case 'taboola':
        return `<script>window._tfa=window._tfa||[];_tfa.push({notify:'event',name:'page_view',id:${pixel.pixel_id}});${tbExtra}!function(t,f,a,x){if(!document.getElementById(x)){t.async=1;t.src=a;t.id=x;f.parentNode.insertBefore(t,f);}}(document.createElement('script'),document.getElementsByTagName('script')[0],'//cdn.taboola.com/libtrc/unip/${pixel.pixel_id}/tfa.js','tb_tfa_script');</script>`;
      case 'custom':
        return config.code || '';
      default:
        return '';
    }
  }).filter(Boolean);

  if (pixelCodes.length === 0) return html;

  const injection = pixelCodes.join('\n');

  if (html.includes('</head>')) {
    return html.replace('</head>', `${injection}\n</head>`);
  }
  return `${injection}\n${html}`;
}

/**
 * Inject global scripts into HTML at specified positions.
 * @param {string} html - HTML content
 * @param {Object} scripts - { head: string[], body_start: string[], body_end: string[] }
 * @returns {string} HTML with scripts injected
 */
export function injectGlobalScripts(html, scripts) {
  if (!scripts) return html;

  // Head scripts
  if (scripts.head && scripts.head.length > 0) {
    const code = scripts.head.join('\n');
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${code}\n</head>`);
    }
  }

  // Body start scripts
  if (scripts.body_start && scripts.body_start.length > 0) {
    const code = scripts.body_start.join('\n');
    const bodyMatch = html.match(/<body[^>]*>/);
    if (bodyMatch) {
      html = html.replace(bodyMatch[0], `${bodyMatch[0]}\n${code}`);
    }
  }

  // Body end scripts
  if (scripts.body_end && scripts.body_end.length > 0) {
    const code = scripts.body_end.join('\n');
    if (html.includes('</body>')) {
      html = html.replace('</body>', `${code}\n</body>`);
    }
  }

  return html;
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

/**
 * Process a single HTML page file through the pipeline.
 * Shared logic for both full build and selective build.
 */
async function processPageFile(srcFile, relPath, partialsDir, partialCache, manifest, config, distDir, options = {}) {
  let html = fs.readFileSync(srcFile, 'utf8');

  const { meta: frontmatter, body } = parseFrontmatter(html);
  html = body;

  html = injectPartials(html, partialsDir, frontmatter, config, partialCache);

  // Inject pixels if provided
  if (options.pixels) {
    html = injectPixels(html, options.pixels);
  }

  // Inject global scripts if provided
  if (options.globalScripts) {
    html = injectGlobalScripts(html, options.globalScripts);
  }

  html = replaceAssetRefs(html, manifest);

  if (config.build?.minifyHTML) {
    html = await minify(html, {
      collapseWhitespace: true,
      removeComments: true,
      minifyCSS: true,
      minifyJS: false,
    });
  }

  const route = routeFromFile(relPath);
  const destRelPath = distPathFromRoute(route);
  const destFile = path.join(distDir, destRelPath);

  fs.mkdirSync(path.dirname(destFile), { recursive: true });
  fs.writeFileSync(destFile, html, 'utf8');

  return route;
}

export async function processPages(srcDir, distDir, manifest, config, options = {}) {
  const pagesDir = path.join(srcDir, 'pages');
  const partialsDir = path.join(srcDir, 'partials');
  const partialCache = {};
  const routes = [];

  const files = await glob('**/*.html', { cwd: pagesDir, nodir: true });

  for (const relPath of files) {
    const srcFile = path.join(pagesDir, relPath);
    const route = await processPageFile(srcFile, relPath, partialsDir, partialCache, manifest, config, distDir, options);
    routes.push(route);
  }

  return routes;
}

/**
 * Process a single page by slug (for selective rebuild).
 * Does not clean dist — only processes the specified page.
 */
export async function processSinglePage(srcDir, distDir, manifest, config, slug) {
  const pagesDir = path.join(srcDir, 'pages');
  const partialsDir = path.join(srcDir, 'partials');
  const partialCache = {};

  const relPath = `${slug}.html`;
  const srcFile = path.join(pagesDir, relPath);

  if (!fs.existsSync(srcFile)) {
    throw new Error(`Page file not found: ${relPath}`);
  }

  const route = await processPageFile(srcFile, relPath, partialsDir, partialCache, manifest, config, distDir);
  return route;
}
