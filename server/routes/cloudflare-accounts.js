// server/routes/cloudflare-accounts.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { testConnection } from '../lib/cloudflare.js';

function maskToken(token) {
  if (!token || token.length <= 4) return '****';
  return '****' + token.slice(-4);
}

export default async function cloudflareAccountsRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/cloudflare-accounts
  fastify.get('/cloudflare-accounts', async () => {
    const db = getDb();
    const accounts = db.prepare('SELECT * FROM cloudflare_accounts ORDER BY created_at DESC').all();
    return accounts.map(a => ({
      ...a,
      api_token: maskToken(a.api_token),
    }));
  });

  // POST /api/cloudflare-accounts
  fastify.post('/cloudflare-accounts', {
    schema: {
      body: {
        type: 'object',
        required: ['name', 'account_id', 'api_token'],
        properties: {
          name: { type: 'string' },
          account_id: { type: 'string' },
          api_token: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { name, account_id, api_token } = request.body;

    db.prepare(
      'INSERT INTO cloudflare_accounts (id, name, account_id, api_token) VALUES (?, ?, ?, ?)'
    ).run(id, name, account_id, api_token);

    const created = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(id);
    reply.code(201).send({
      ...created,
      api_token: maskToken(created.api_token),
    });
  });

  // PUT /api/cloudflare-accounts/:id
  fastify.put('/cloudflare-accounts/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          account_id: { type: 'string' },
          api_token: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Cloudflare account not found' });

    const { name, account_id, api_token } = request.body;

    db.prepare(`
      UPDATE cloudflare_accounts SET
        name = COALESCE(?, name),
        account_id = COALESCE(?, account_id),
        api_token = COALESCE(?, api_token)
      WHERE id = ?
    `).run(name || null, account_id || null, api_token || null, id);

    const updated = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(id);
    return {
      ...updated,
      api_token: maskToken(updated.api_token),
    };
  });

  // DELETE /api/cloudflare-accounts/:id
  fastify.delete('/cloudflare-accounts/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT id FROM cloudflare_accounts WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Cloudflare account not found' });

    // Check if any domains reference this account
    const domainCount = db.prepare('SELECT COUNT(*) as count FROM domains WHERE cloudflare_account_id = ?').get(id);
    if (domainCount.count > 0) {
      return reply.code(409).send({
        error: `Cannot delete: ${domainCount.count} domain(s) still reference this account`,
      });
    }

    db.prepare('DELETE FROM cloudflare_accounts WHERE id = ?').run(id);
    return { ok: true };
  });

  // POST /api/cloudflare-accounts/:id/test
  fastify.post('/cloudflare-accounts/:id/test', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const account = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(id);
    if (!account) return reply.code(404).send({ error: 'Cloudflare account not found' });

    try {
      await testConnection(account);
      return { success: true, message: 'Connection successful' };
    } catch (err) {
      return reply.code(400).send({ success: false, error: err.message });
    }
  });
}
