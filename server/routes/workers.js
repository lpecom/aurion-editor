// server/routes/workers.js
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  deployWorker,
  WORKER_SCRIPT,
} from '../lib/cloudflare.js';

export default async function workersRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/workers — list all deployed workers (from domains with active workers)
  fastify.get('/workers', async () => {
    const db = getDb();
    return db.prepare(`
      SELECT
        d.id,
        d.domain,
        d.worker_name,
        d.r2_bucket,
        d.worker_status,
        d.worker_error,
        d.cloudflare_account_id,
        d.cloudflare_zone_id,
        ca.name AS account_name
      FROM domains d
      LEFT JOIN cloudflare_accounts ca ON ca.id = d.cloudflare_account_id
      WHERE d.worker_name IS NOT NULL
      ORDER BY d.domain ASC
    `).all();
  });

  // POST /api/workers/:id/redeploy — redeploy worker with latest script
  fastify.post('/workers/:id/redeploy', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    if (!domain) return reply.code(404).send({ error: 'Domain not found' });

    if (!domain.worker_name || !domain.r2_bucket) {
      return reply.code(400).send({ error: 'Worker não provisionado para este domínio' });
    }

    if (!domain.cloudflare_account_id) {
      return reply.code(400).send({ error: 'Conta Cloudflare não vinculada' });
    }

    const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(domain.cloudflare_account_id);
    if (!cfAccount) {
      return reply.code(400).send({ error: 'Conta Cloudflare não encontrada' });
    }

    db.prepare("UPDATE domains SET worker_status = 'provisioning', worker_error = NULL WHERE id = ?").run(id);

    try {
      await deployWorker(cfAccount, domain.worker_name, WORKER_SCRIPT, domain.r2_bucket);

      db.prepare("UPDATE domains SET worker_status = 'active', worker_error = NULL WHERE id = ?").run(id);

      return db.prepare(`
        SELECT
          d.id, d.domain, d.worker_name, d.r2_bucket,
          d.worker_status, d.worker_error, d.cloudflare_account_id,
          ca.name AS account_name
        FROM domains d
        LEFT JOIN cloudflare_accounts ca ON ca.id = d.cloudflare_account_id
        WHERE d.id = ?
      `).get(id);
    } catch (err) {
      db.prepare("UPDATE domains SET worker_status = 'error', worker_error = ? WHERE id = ?")
        .run(err.message, id);
      return reply.code(500).send({
        error: 'Redeploy falhou',
        details: err.message,
      });
    }
  });

  // POST /api/workers/redeploy-all — redeploy all active workers
  fastify.post('/workers/redeploy-all', async (request, reply) => {
    const db = getDb();

    const workers = db.prepare(`
      SELECT d.*, ca.api_token, ca.account_id AS cf_account_id
      FROM domains d
      JOIN cloudflare_accounts ca ON ca.id = d.cloudflare_account_id
      WHERE d.worker_name IS NOT NULL AND d.r2_bucket IS NOT NULL
    `).all();

    if (workers.length === 0) {
      return { results: [], message: 'Nenhum worker encontrado' };
    }

    const results = [];

    for (const w of workers) {
      try {
        const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(w.cloudflare_account_id);
        await deployWorker(cfAccount, w.worker_name, WORKER_SCRIPT, w.r2_bucket);
        db.prepare("UPDATE domains SET worker_status = 'active', worker_error = NULL WHERE id = ?").run(w.id);
        results.push({ id: w.id, domain: w.domain, success: true });
      } catch (err) {
        db.prepare("UPDATE domains SET worker_status = 'error', worker_error = ? WHERE id = ?")
          .run(err.message, w.id);
        results.push({ id: w.id, domain: w.domain, success: false, error: err.message });
      }
    }

    return { results };
  });
}
