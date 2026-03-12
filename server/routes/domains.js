// server/routes/domains.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  createR2Bucket,
  deployWorker,
  deleteWorker,
  setWorkerCustomDomain,
  WORKER_SCRIPT,
} from '../lib/cloudflare.js';

export default async function domainsRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/domains
  fastify.get('/domains', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM domains ORDER BY created_at DESC').all();
  });

  // GET /api/domains/:id
  fastify.get('/domains/:id', async (request, reply) => {
    const db = getDb();
    const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(request.params.id);
    if (!domain) return reply.code(404).send({ error: 'Domain not found' });
    return domain;
  });

  // POST /api/domains
  fastify.post('/domains', {
    schema: {
      body: {
        type: 'object',
        required: ['domain'],
        properties: {
          domain: { type: 'string' },
          cloudflare_zone_id: { type: 'string' },
          cloudflare_account_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { domain, cloudflare_zone_id, cloudflare_account_id } = request.body;

    const existing = db.prepare('SELECT id FROM domains WHERE domain = ?').get(domain);
    if (existing) return reply.code(409).send({ error: 'Domain already exists' });

    db.prepare('INSERT INTO domains (id, domain, cloudflare_zone_id, cloudflare_account_id) VALUES (?, ?, ?, ?)').run(
      id, domain, cloudflare_zone_id || null, cloudflare_account_id || null
    );

    const created = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    reply.code(201).send(created);
  });

  // PUT /api/domains/:id
  fastify.put('/domains/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          domain: { type: 'string' },
          ssl_status: { type: 'string', enum: ['pending', 'active', 'error'] },
          cloudflare_zone_id: { type: 'string' },
          cloudflare_account_id: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Domain not found' });

    const { domain, ssl_status, cloudflare_zone_id, cloudflare_account_id } = request.body;

    if (domain && domain !== existing.domain) {
      const taken = db.prepare('SELECT id FROM domains WHERE domain = ? AND id != ?').get(domain, id);
      if (taken) return reply.code(409).send({ error: 'Domain already exists' });
    }

    db.prepare(`
      UPDATE domains SET
        domain = COALESCE(?, domain),
        ssl_status = COALESCE(?, ssl_status),
        cloudflare_zone_id = COALESCE(?, cloudflare_zone_id),
        cloudflare_account_id = COALESCE(?, cloudflare_account_id)
      WHERE id = ?
    `).run(domain || null, ssl_status || null, cloudflare_zone_id || null, cloudflare_account_id || null, id);

    return db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
  });

  // DELETE /api/domains/:id
  fastify.delete('/domains/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT id FROM domains WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Domain not found' });

    db.prepare('DELETE FROM domains WHERE id = ?').run(id);
    return { ok: true };
  });

  // POST /api/domains/:id/provision — full provisioning flow
  fastify.post('/domains/:id/provision', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    if (!domain) return reply.code(404).send({ error: 'Domain not found' });

    if (!domain.cloudflare_account_id) {
      return reply.code(400).send({ error: 'No Cloudflare account associated with this domain' });
    }

    const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(domain.cloudflare_account_id);
    if (!cfAccount) {
      return reply.code(400).send({ error: 'Cloudflare account not found' });
    }

    // Generate worker_name and r2_bucket from domain name
    const sanitized = domain.domain.replace(/[^a-zA-Z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').toLowerCase();
    const workerName = `${sanitized}-worker`;
    const r2Bucket = `${sanitized}-pages`;

    // Set status to provisioning
    db.prepare("UPDATE domains SET worker_status = 'provisioning', worker_error = NULL, worker_name = ?, r2_bucket = ? WHERE id = ?")
      .run(workerName, r2Bucket, id);

    try {
      // Step 1: Create R2 bucket
      await createR2Bucket(cfAccount, r2Bucket);

      // Step 2: Deploy Worker with R2 binding
      await deployWorker(cfAccount, workerName, WORKER_SCRIPT, r2Bucket);

      // Step 3: Configure custom domain
      await setWorkerCustomDomain(cfAccount, workerName, domain.domain);

      // Step 4: Update domain record
      db.prepare("UPDATE domains SET worker_status = 'active', worker_error = NULL WHERE id = ?").run(id);

      return db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    } catch (err) {
      db.prepare("UPDATE domains SET worker_status = 'error', worker_error = ? WHERE id = ?")
        .run(err.message, id);
      return reply.code(500).send({
        error: 'Provisioning failed',
        details: err.message,
        domain: db.prepare('SELECT * FROM domains WHERE id = ?').get(id),
      });
    }
  });

  // POST /api/domains/:id/deprovision — tear down worker + bucket
  fastify.post('/domains/:id/deprovision', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    if (!domain) return reply.code(404).send({ error: 'Domain not found' });

    if (!domain.cloudflare_account_id) {
      return reply.code(400).send({ error: 'No Cloudflare account associated with this domain' });
    }

    const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(domain.cloudflare_account_id);
    if (!cfAccount) {
      return reply.code(400).send({ error: 'Cloudflare account not found' });
    }

    try {
      // Delete worker (if exists)
      if (domain.worker_name) {
        try {
          await deleteWorker(cfAccount, domain.worker_name);
        } catch (err) {
          // Ignore if worker doesn't exist
          console.warn(`Failed to delete worker ${domain.worker_name}: ${err.message}`);
        }
      }

      // Note: R2 bucket deletion requires emptying first; left for manual cleanup or future enhancement
      // Reset domain status
      db.prepare(`
        UPDATE domains SET
          worker_name = NULL,
          r2_bucket = NULL,
          worker_status = 'pending',
          worker_error = NULL
        WHERE id = ?
      `).run(id);

      return db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    } catch (err) {
      return reply.code(500).send({ error: 'Deprovision failed', details: err.message });
    }
  });
}
