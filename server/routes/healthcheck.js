// server/routes/healthcheck.js
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function healthcheckRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // POST /api/domains/:id/healthcheck
  fastify.post('/domains/:id/healthcheck', async (request, reply) => {
    const db = getDb();
    const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(request.params.id);
    if (!domain) return reply.code(404).send({ error: 'Domain not found' });

    const result = await checkDomain(domain.domain);
    return result;
  });

  // POST /api/domains/healthcheck-all
  fastify.post('/domains/healthcheck-all', async () => {
    const db = getDb();
    const domains = db.prepare('SELECT * FROM domains ORDER BY created_at DESC').all();
    const results = await Promise.all(
      domains.map(async (d) => {
        const result = await checkDomain(d.domain);
        return { domain_id: d.id, domain: d.domain, ...result };
      })
    );
    return results;
  });
}

async function checkDomain(domain) {
  const checked_at = new Date().toISOString();
  const start = Date.now();

  // Try HTTPS first, fallback to HTTP
  for (const protocol of ['https', 'http']) {
    try {
      const res = await fetch(`${protocol}://${domain}/`, {
        signal: AbortSignal.timeout(10000),
        redirect: 'follow',
        headers: { 'User-Agent': 'Aurion-Healthcheck/1.0' },
      });
      const response_time_ms = Date.now() - start;
      const http_status = res.status;

      let status;
      if (http_status >= 200 && http_status < 300) {
        status = response_time_ms < 3000 ? 'online' : 'slow';
      } else {
        status = 'offline';
      }

      return { status, response_time_ms, http_status, checked_at, protocol };
    } catch (err) {
      // If HTTPS failed, try HTTP
      if (protocol === 'https') continue;
      // HTTP also failed
      return {
        status: 'offline',
        response_time_ms: Date.now() - start,
        http_status: null,
        checked_at,
        error: err.message,
        protocol: null,
      };
    }
  }
}
