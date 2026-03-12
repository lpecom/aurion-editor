// server/server.js
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';

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

const fastify = Fastify({
  logger: loggerConfig,
  bodyLimit: 50 * 1024 * 1024,
});

// Health check FIRST — before anything else can crash
fastify.get('/api/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

// Register core plugins
await fastify.register(cors, { origin: true, credentials: true });
await fastify.register(cookie, { secret: process.env.SESSION_SECRET || 'default-secret-change-me' });
await fastify.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });

// Start listening IMMEDIATELY so healthcheck works
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Server listening on port ${PORT}`);
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}

// Now load everything else AFTER server is up
try {
  console.log('Loading database...');
  const { getDb, closeDb } = await import('./db/index.js');
  const db = getDb();
  console.log('Database loaded.');

  console.log('Loading routes...');
  const { default: staticPlugin } = await import('./plugins/static.js');
  const { default: authRoutes } = await import('./routes/auth.js');
  const { default: pagesRoutes } = await import('./routes/pages.js');
  const { default: pixelsRoutes } = await import('./routes/pixels.js');
  const { default: domainsRoutes } = await import('./routes/domains.js');
  const { default: scriptsRoutes } = await import('./routes/scripts.js');
  const { default: imagesRoutes } = await import('./routes/images.js');
  const { default: categoriesRoutes } = await import('./routes/categories.js');
  const { default: copierRoutes } = await import('./routes/copier.js');
  console.log('Routes loaded.');

  // Detect custom domain requests and block admin/API
  const MAIN_HOSTS = new Set([
    'localhost',
    '127.0.0.1',
    'aurion-editor.up.railway.app',
  ]);
  if (process.env.ADMIN_HOST) MAIN_HOSTS.add(process.env.ADMIN_HOST);

  fastify.addHook('onRequest', async (request, reply) => {
    const host = (request.hostname || '').split(':')[0];
    const url = request.url.split('?')[0];
    if (url === '/api/health') { request.isCustomDomain = false; return; }
    if (MAIN_HOSTS.has(host)) { request.isCustomDomain = false; return; }
    request.isCustomDomain = true;
    request.customDomainHost = host;
    if (url.startsWith('/api/') || url.startsWith('/admin')) {
      return reply.code(404).send({ error: 'Not found' });
    }
  });

  // Register API routes
  await fastify.register(authRoutes, { prefix: '/api' });
  await fastify.register(pagesRoutes, { prefix: '/api' });
  await fastify.register(pixelsRoutes, { prefix: '/api' });
  await fastify.register(domainsRoutes, { prefix: '/api' });
  await fastify.register(scriptsRoutes, { prefix: '/api' });
  await fastify.register(imagesRoutes, { prefix: '/api' });
  await fastify.register(categoriesRoutes, { prefix: '/api' });
  await fastify.register(copierRoutes, { prefix: '/api' });
  console.log('API routes registered.');

  // Register static file serving
  await fastify.register(staticPlugin);
  console.log('Static plugin registered.');

  // Re-publish pages in background (non-blocking)
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

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down...');
    closeDb();
    await fastify.close();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  console.log('Server fully initialized.');
  console.log(`Admin: http://localhost:${PORT}/admin`);
  console.log(`API: http://localhost:${PORT}/api`);

} catch (err) {
  console.error('STARTUP ERROR (server still running for healthcheck):', err);
}
