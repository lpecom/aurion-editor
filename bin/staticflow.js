#!/usr/bin/env node
// bin/staticflow.js
import path from 'node:path';
import fs from 'node:fs';
import { build } from '../build.js';
import { clean } from '../lib/clean.js';

const command = process.argv[2];
const ROOT = process.argv.includes('--root')
  ? path.resolve(process.argv[process.argv.indexOf('--root') + 1])
  : process.cwd();

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
