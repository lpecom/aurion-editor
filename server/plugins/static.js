// server/plugins/static.js
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');

export default async function staticPlugin(fastify) {
  const distDir = path.join(ROOT, 'dist');
  const adminDistDir = path.join(ROOT, 'admin', 'dist');

  // Serve admin SPA — /admin/* routes
  fastify.register(async function adminRoutes(app) {
    // Try to serve admin static files if the admin build exists
    if (fs.existsSync(adminDistDir)) {
      const fastifyStatic = (await import('@fastify/static')).default;
      app.register(fastifyStatic, {
        root: adminDistDir,
        prefix: '/admin/',
        decorateReply: false,
      });

      // SPA fallback: serve index.html for any /admin/* route that doesn't match a file
      app.setNotFoundHandler((request, reply) => {
        const indexPath = path.join(adminDistDir, 'index.html');
        if (fs.existsSync(indexPath)) {
          reply.type('text/html').send(fs.createReadStream(indexPath));
        } else {
          reply.code(404).send({ error: 'Admin app not built yet' });
        }
      });
    } else {
      // Admin not built yet — return helpful message
      app.get('/*', async (request, reply) => {
        reply.code(503).send({
          error: 'Admin app not built yet',
          hint: 'Run the admin build first: cd admin && npm run build',
        });
      });
    }
  }, { prefix: '/admin' });

  // Serve public static site — /* routes (lowest priority)
  if (fs.existsSync(distDir)) {
    const fastifyStatic = (await import('@fastify/static')).default;
    fastify.register(fastifyStatic, {
      root: distDir,
      prefix: '/',
      decorateReply: false,
      wildcard: false,
    });

    // Serve clean URLs: /slug -> /slug/index.html
    fastify.setNotFoundHandler(async (request, reply) => {
      // Skip API routes (should not reach here, but safety)
      if (request.url.startsWith('/api/') || request.url.startsWith('/admin')) {
        return reply.code(404).send({ error: 'Not found' });
      }

      const urlPath = request.url.split('?')[0];
      const possiblePaths = [
        path.join(distDir, urlPath, 'index.html'),
        path.join(distDir, `${urlPath}.html`),
      ];

      for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
          reply.type('text/html').send(fs.createReadStream(p));
          return;
        }
      }

      // Try serving 404 page
      const notFoundPage = path.join(distDir, '404', 'index.html');
      if (fs.existsSync(notFoundPage)) {
        reply.code(404).type('text/html').send(fs.createReadStream(notFoundPage));
        return;
      }

      reply.code(404).send({ error: 'Not found' });
    });
  }
}
