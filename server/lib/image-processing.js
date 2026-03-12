// server/lib/image-processing.js
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from '../db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const UPLOAD_DIR = path.join(ROOT, 'assets', 'imgs');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Process an image buffer: optimize with Sharp, save to disk, register in DB.
 * @param {Buffer} buffer - Raw image bytes
 * @param {string} originalName - Original filename (for DB record)
 * @param {string} mimeType - MIME type (image/jpeg, image/png, etc.)
 * @returns {{ id, filename, path, size, mime_type, width, height }}
 */
export async function processAndSaveImage(buffer, originalName, mimeType) {
  const id = randomUUID();
  const ext = path.extname(originalName).toLowerCase() || '.jpg';
  const filename = `${id}${ext}`;
  const filePath = path.join(UPLOAD_DIR, filename);
  const relativePath = `assets/imgs/${filename}`;

  let width = null;
  let height = null;
  let finalBuffer = buffer;

  if (mimeType !== 'image/svg+xml') {
    try {
      const sharp = (await import('sharp')).default;
      const image = sharp(buffer);
      const metadata = await image.metadata();
      width = metadata.width;
      height = metadata.height;

      if (width > 2000 || height > 2000) {
        finalBuffer = await image
          .resize(2000, 2000, { fit: 'inside', withoutEnlargement: true })
          .toBuffer();
        const newMeta = await sharp(finalBuffer).metadata();
        width = newMeta.width;
        height = newMeta.height;
      }

      if (mimeType === 'image/jpeg') {
        finalBuffer = await sharp(finalBuffer).jpeg({ quality: 85, progressive: true }).toBuffer();
      } else if (mimeType === 'image/png') {
        finalBuffer = await sharp(finalBuffer).png({ compressionLevel: 9 }).toBuffer();
      } else if (mimeType === 'image/webp') {
        finalBuffer = await sharp(finalBuffer).webp({ quality: 85 }).toBuffer();
      }
    } catch (err) {
      // Sharp processing failed, save original
      console.warn('Sharp processing failed, saving original:', err.message);
    }
  }

  fs.writeFileSync(filePath, finalBuffer);

  const db = getDb();
  db.prepare(`
    INSERT INTO images (id, filename, original_name, path, size, mime_type, width, height)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, filename, originalName, relativePath, finalBuffer.length, mimeType, width, height);

  return { id, filename, path: relativePath, size: finalBuffer.length, mime_type: mimeType, width, height };
}

export { UPLOAD_DIR, ROOT };
