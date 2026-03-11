// server/server.js
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';

import { getDb, closeDb } from './db/index.js';
import staticPlugin from './plugins/static.js';
import authRoutes from './routes/auth.js';
import pagesRoutes from './routes/pages.js';
import pixelsRoutes from './routes/pixels.js';
import domainsRoutes from './routes/domains.js';
import scriptsRoutes from './routes/scripts.js';
import imagesRoutes from './routes/images.js';
import categoriesRoutes from './routes/categories.js';
import { publishPage } from '../lib/publish.js';

const PORT = parseInt(process.env.PORT || '3001', 10);

const isProd = process.env.NODE_ENV === 'production';

const loggerConfig = isProd
  ? { level: 'info' }
  : {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    };

const fastify = Fastify({ logger: loggerConfig });

// Initialize database on startup
const db = getDb();

// Re-publish all published pages on startup (dist/ is ephemeral on Railway)
async function republishOnStartup() {
  const published = db.prepare("SELECT * FROM pages WHERE status = 'published' AND html_content IS NOT NULL").all();
  if (published.length === 0) return;
  console.log(`Re-publishing ${published.length} pages on startup...`);
  for (const page of published) {
    try {
      await publishPage(page, db);
      console.log(`  ✓ ${page.slug}`);
    } catch (err) {
      console.error(`  ✗ ${page.slug}: ${err.message}`);
    }
  }
  console.log('Startup re-publish complete.');
}
await republishOnStartup();

// Register plugins
await fastify.register(cors, {
  origin: true,
  credentials: true,
});

await fastify.register(cookie, {
  secret: process.env.SESSION_SECRET || 'default-secret-change-me',
});

await fastify.register(multipart, {
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

// Detect custom domain requests and block admin/API
const MAIN_HOSTS = new Set([
  'localhost',
  '127.0.0.1',
  'aurion-editor.up.railway.app',
]);
// Also accept any host set via env (e.g. ADMIN_HOST=myapp.railway.app)
if (process.env.ADMIN_HOST) MAIN_HOSTS.add(process.env.ADMIN_HOST);

fastify.addHook('onRequest', async (request, reply) => {
  const host = (request.hostname || '').split(':')[0]; // strip port
  if (MAIN_HOSTS.has(host)) {
    // Main domain — allow everything
    request.isCustomDomain = false;
    return;
  }

  // Custom domain — only allow health check and published pages
  request.isCustomDomain = true;
  request.customDomainHost = host;

  const url = request.url.split('?')[0];
  if (url.startsWith('/api/') || url.startsWith('/admin')) {
    return reply.code(404).send({ error: 'Not found' });
  }
});

// Health check (no auth required)
fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Register API routes under /api prefix
await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(pagesRoutes, { prefix: '/api' });
await fastify.register(pixelsRoutes, { prefix: '/api' });
await fastify.register(domainsRoutes, { prefix: '/api' });
await fastify.register(scriptsRoutes, { prefix: '/api' });
await fastify.register(imagesRoutes, { prefix: '/api' });
await fastify.register(categoriesRoutes, { prefix: '/api' });

// Register static file serving (admin SPA + public site)
await fastify.register(staticPlugin);

// Graceful shutdown
const shutdown = async () => {
  fastify.log.info('Shutting down...');
  closeDb();
  await fastify.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  fastify.log.info(`Aurion Editor server running on http://localhost:${PORT}`);
  fastify.log.info(`Admin panel: http://localhost:${PORT}/admin`);
  fastify.log.info(`API: http://localhost:${PORT}/api`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
