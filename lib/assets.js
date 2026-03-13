// lib/assets.js
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { glob } from 'glob';

export function hashContent(buffer) {
  return crypto.createHash('md5').update(buffer).digest('hex').substring(0, 8);
}

function addHash(filePath, hash) {
  const ext = path.extname(filePath);
  const base = path.basename(filePath, ext);
  const dir = path.dirname(filePath);
  return path.join(dir, `${base}.${hash}${ext}`);
}

async function optimizeFile(filePath, content, config) {
  const ext = path.extname(filePath).toLowerCase();

  if ((ext === '.jpg' || ext === '.jpeg') && config.optimizeImages !== false) {
    const sharp = (await import('sharp')).default;
    return sharp(content).jpeg({ quality: 85, progressive: true }).toBuffer();
  }

  if (ext === '.png' && config.optimizeImages !== false) {
    const sharp = (await import('sharp')).default;
    return sharp(content).png({ compressionLevel: 9 }).toBuffer();
  }

  if (ext === '.js' && config.minifyJS) {
    const { minify } = await import('terser');
    const result = await minify(content.toString('utf8'), { mangle: true });
    return Buffer.from(result.code || content.toString('utf8'));
  }

  if (ext === '.css' && config.minifyCSS) {
    const CleanCSS = (await import('clean-css')).default;
    const result = new CleanCSS().minify(content.toString('utf8'));
    return Buffer.from(result.styles || content.toString('utf8'));
  }

  return content;
}

export async function processAssets(srcDir, distDir, config = {}) {
  const manifest = {};

  const patterns = ['assets/**/*', 'css/**/*'];
  const allFiles = [];

  for (const pattern of patterns) {
    const files = await glob(pattern, { cwd: srcDir, nodir: true });
    allFiles.push(...files);
  }

  for (const relPath of allFiles.filter(f => !path.basename(f).startsWith('.')
    && !f.startsWith('assets/imgs/') // Skip uploaded images — they have UUID names and are served directly
  )) {
    const srcFile = path.join(srcDir, relPath);
    const content = fs.readFileSync(srcFile);
    const optimized = await optimizeFile(relPath, content, config);

    let destRelPath = relPath;
    if (config.hashAssets !== false) {
      const hash = hashContent(optimized);
      destRelPath = addHash(relPath, hash);
    }

    const destFile = path.join(distDir, destRelPath);
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.writeFileSync(destFile, optimized);

    manifest[relPath] = destRelPath;
  }

  return manifest;
}
