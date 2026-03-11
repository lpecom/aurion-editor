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
getDb();

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
