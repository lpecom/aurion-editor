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
