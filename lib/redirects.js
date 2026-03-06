// lib/redirects.js
import fs from 'node:fs';
import path from 'node:path';

export async function generateRedirects(distDir) {
  const content = `/sitemap.xml  /sitemap.xml  200
/*            /404/index.html  404
`;
  fs.writeFileSync(path.join(distDir, '_redirects'), content, 'utf8');
}
