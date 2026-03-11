// server/routes/images.js
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'imgs');

export default async function imagesRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // Ensure upload directory exists
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

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

    const id = randomUUID();
    const ext = path.extname(data.filename).toLowerCase() || '.jpg';
    const filename = `${id}${ext}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    const relativePath = `assets/imgs/${filename}`;

    // Collect buffer from stream
    const chunks = [];
    for await (const chunk of data.file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    let width = null;
    let height = null;
    let finalBuffer = buffer;

    // Process with sharp for raster images
    if (data.mimetype !== 'image/svg+xml') {
      try {
        const sharp = (await import('sharp')).default;
        const image = sharp(buffer);
        const metadata = await image.metadata();
        width = metadata.width;
        height = metadata.height;

        // Optimize: resize if too large, compress
        if (width > 2000 || height > 2000) {
          finalBuffer = await image
            .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
            .toBuffer();
          const newMeta = await sharp(finalBuffer).metadata();
          width = newMeta.width;
          height = newMeta.height;
        }

        // Compress based on format
        if (data.mimetype === 'image/jpeg') {
          finalBuffer = await sharp(finalBuffer).jpeg({ quality: 85, progressive: true }).toBuffer();
        } else if (data.mimetype === 'image/png') {
          finalBuffer = await sharp(finalBuffer).png({ compressionLevel: 9 }).toBuffer();
        } else if (data.mimetype === 'image/webp') {
          finalBuffer = await sharp(finalBuffer).webp({ quality: 85 }).toBuffer();
        }
      } catch (err) {
        request.log.warn({ err }, 'Sharp processing failed, saving original');
      }
    }

    fs.writeFileSync(filePath, finalBuffer);

    const db = getDb();
    db.prepare(`
      INSERT INTO images (id, filename, original_name, path, size, mime_type, width, height)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, filename, data.filename, relativePath, finalBuffer.length, data.mimetype, width, height);

    const image = db.prepare('SELECT * FROM images WHERE id = ?').get(id);
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
