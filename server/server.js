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
import copierRoutes from './routes/copier.js';
import languagesRoutes from './routes/languages.js';
import translationProvidersRoutes from './routes/translation-providers.js';
import cloudflareAccountsRoutes from './routes/cloudflare-accounts.js';
import cloakerRulesRoutes from './routes/cloaker-rules.js';
import healthcheckRoutes from './routes/healthcheck.js';
import apiKeysRoutes from './routes/api-keys.js';
import activityLogRoutes from './routes/activity-log.js';
import mcpRoutes from './routes/mcp.js';
import pageParentsRoutes from './routes/page-parents.js';
import funnelsRoutes from './routes/funnels.js';
import workersRoutes from './routes/workers.js';
import analyticsRoutes from './routes/analytics.js';
import { startCleanupJob, checkRateLimit, insertEvent } from './lib/analytics.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const isProd = process.env.NODE_ENV === 'production';

const loggerConfig = isProd
  ? { level: 'info' }
  : {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: { translateTime: 'HH:MM:ss Z', ignore: 'pid,hostname' },
      },
    };

const fastify = Fastify({
  logger: loggerConfig,
  bodyLimit: 50 * 1024 * 1024,
  requestTimeout: 1800000,   // 30 min
  keepAliveTimeout: 300000,
});

// Initialize database
const db = getDb();

// Register plugins
await fastify.register(cors, { origin: true, credentials: true });
await fastify.register(cookie, { secret: process.env.SESSION_SECRET || 'default-secret-change-me' });
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

// Custom domain detection
const MAIN_HOSTS = new Set(['localhost', '127.0.0.1', 'aurion-editor.up.railway.app']);
if (process.env.ADMIN_HOST) MAIN_HOSTS.add(process.env.ADMIN_HOST);

fastify.addHook('onRequest', async (request, reply) => {
  const host = (request.hostname || '').split(':')[0];
  const url = request.url.split('?')[0];
  if (url === '/api/health') { request.isCustomDomain = false; return; }
  if (url === '/api/mcp' || url.startsWith('/api/mcp')) { request.isCustomDomain = false; return; }
  if (url === '/t' || url === '/api/analytics/collect') { request.isCustomDomain = false; return; }
  if (MAIN_HOSTS.has(host)) { request.isCustomDomain = false; return; }
  request.isCustomDomain = true;
  request.customDomainHost = host;
  if (url.startsWith('/api/') || url.startsWith('/admin')) {
    return reply.code(404).send({ error: 'Not found' });
  }
});

// Health check
fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Analytics collect alias (short path for tracking script)
fastify.post('/t', async (request, reply) => {
  const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip)) return reply.code(204).send();
  insertEvent(request.body || {});
  return reply.code(204).send();
});


// API routes
await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(pagesRoutes, { prefix: '/api' });
await fastify.register(pixelsRoutes, { prefix: '/api' });
await fastify.register(domainsRoutes, { prefix: '/api' });
await fastify.register(scriptsRoutes, { prefix: '/api' });
await fastify.register(imagesRoutes, { prefix: '/api' });
await fastify.register(categoriesRoutes, { prefix: '/api' });
await fastify.register(copierRoutes, { prefix: '/api' });
await fastify.register(languagesRoutes, { prefix: '/api' });
await fastify.register(translationProvidersRoutes, { prefix: '/api' });
await fastify.register(cloudflareAccountsRoutes, { prefix: '/api' });
await fastify.register(cloakerRulesRoutes, { prefix: '/api' });
await fastify.register(healthcheckRoutes, { prefix: '/api' });
await fastify.register(apiKeysRoutes, { prefix: '/api' });
await fastify.register(activityLogRoutes, { prefix: '/api' });
await fastify.register(mcpRoutes, { prefix: '/api' });
await fastify.register(pageParentsRoutes, { prefix: '/api' });
await fastify.register(funnelsRoutes, { prefix: '/api' });
await fastify.register(workersRoutes, { prefix: '/api' });
await fastify.register(analyticsRoutes, { prefix: '/api' });

// Static file serving
await fastify.register(staticPlugin);

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down...');
  closeDb();
  await fastify.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// Start server
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin: http://localhost:${PORT}/admin`);
  console.log(`Database: ${process.env.DATABASE_PATH || 'data/aurion.db (ephemeral!)'}`);
  console.log(`Uploads: ${process.env.UPLOAD_DIR || 'assets/imgs (ephemeral!)'}`);
  startCleanupJob();

} catch (err) {
  console.error('Failed to start:', err);
  process.exit(1);
}

// Re-publish pages in background (after listen)
try {
  const { publishPage } = await import('../lib/publish.js');
  const published = db.prepare("SELECT * FROM pages WHERE status = 'published' AND html_content IS NOT NULL").all();
  if (published.length > 0) {
    console.log(`Re-publishing ${published.length} pages...`);
    for (const page of published) {
      try {
        await publishPage(page, db);
        console.log(`  ✓ ${page.slug}`);
      } catch (err) {
        console.error(`  ✗ ${page.slug}: ${err.message}`);
      }
    }
    console.log('Republish complete.');
  }
} catch (err) {
  console.error('Republish failed (non-fatal):', err.message);
}
