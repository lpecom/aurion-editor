// server/routes/activity-log.js
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

export default async function activityLogRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/activity-log?limit=50&offset=0
  fastify.get('/activity-log', async (request) => {
    const db = getDb();
    const limit = Math.min(parseInt(request.query.limit || '50', 10), 200);
    const offset = parseInt(request.query.offset || '0', 10);

    const items = db.prepare(
      'SELECT * FROM activity_log ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).all(limit, offset);

    const total = db.prepare('SELECT COUNT(*) as count FROM activity_log').get().count;

    return { items, total };
  });
}
