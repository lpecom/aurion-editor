// server/routes/analytics.js
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  checkRateLimit, insertEvent,
  getAnalyticsSummary, getPageDetail,
} from '../lib/analytics.js';

export default async function analyticsRoutes(fastify) {

  // ── Public: event collection ──
  fastify.post('/analytics/collect', async (request, reply) => {
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    if (!checkRateLimit(ip)) return reply.code(204).send();
    const body = request.body || {};
    insertEvent(body);
    return reply.code(204).send();
  });

  // ── Auth-protected: dashboard API ──
  fastify.get('/analytics', { preHandler: authMiddleware }, async (request) => {
    const period = request.query.period || '7d';
    const pageId = request.query.page_id || null;
    return getAnalyticsSummary(period, pageId);
  });

  fastify.get('/analytics/:page_id', { preHandler: authMiddleware }, async (request) => {
    const { page_id } = request.params;
    const period = request.query.period || '7d';
    const db = getDb();
    const page = db.prepare('SELECT id FROM pages WHERE id = ?').get(page_id);
    if (!page) return { error: 'Page not found' };
    return getPageDetail(page_id, period);
  });
}
