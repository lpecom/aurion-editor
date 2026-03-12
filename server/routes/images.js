// server/routes/images.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { processAndSaveImage } from '../lib/image-processing.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..'); // KEEP — used by DELETE route

export default async function imagesRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/images
  fastify.get('/images', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM images ORDER BY created_at DESC').all();
  });

  // POST /api/images/upload
  fastify.post('/images/upload', async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.code(400).send({ error: 'No file uploaded' });
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
    if (!allowedMimes.includes(data.mimetype)) {
      return reply.code(400).send({ error: 'Invalid file type. Allowed: jpg, png, webp, gif, svg' });
    }

    // Collect buffer from stream
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    const image = await processAndSaveImage(buffer, data.filename, data.mimetype);
    reply.code(201).send(image);
  });

  // DELETE /api/images/:id
  fastify.delete('/images/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
    if (!image) return reply.code(404).send({ error: 'Image not found' });

    // Delete file from filesystem
    const filePath = path.join(ROOT, image.path);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    db.prepare('DELETE FROM images WHERE id = ?').run(id);
    return { ok: true };
  });
}
