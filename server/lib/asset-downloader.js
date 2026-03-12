// server/lib/asset-downloader.js
import * as cheerio from 'cheerio';
import path from 'node:path';
import { processAndSaveImage } from './image-processing.js';

const FONT_CDN_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'use.typekit.net',
  'fonts.cdnfonts.com',
  'cdn.jsdelivr.net/npm/@fontsource',
];

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ASSET_TIMEOUT = 10000; // 10s

function isAbsoluteUrl(url) {
  return url.startsWith('http://') || url.startsWith('https://');
}

function resolveUrl(base, relative) {
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

function isFontUrl(url) {
  return FONT_CDN_PATTERNS.some(p => url.toLowerCase().includes(p));
}

function guessImageMime(url, contentType) {
  if (contentType && ALLOWED_IMAGE_TYPES.includes(contentType)) return contentType;
  const ext = path.extname(new URL(url).pathname).toLowerCase();
  const map = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
  return map[ext] || 'image/jpeg';
}

function guessImageName(url) {
  try {
    const pathname = new URL(url).pathname;
    const name = path.basename(pathname);
    return name || 'image.jpg';
  } catch {
    return 'image.jpg';
  }
}

/**
 * Download and localize assets (images + CSS) from HTML.
 * @param {string} html - Cleaned HTML string
 * @param {string} pageUrl - Original page URL (for resolving relative paths)
 * @param {string} serverOrigin - Server origin for absolute paths in preview (e.g. http://localhost:3001)
 * @returns {{ html: string, assetsDownloaded: Array<{ original_url, local_path }>, warnings: string[] }}
 */
export async function downloadAssets(html, pageUrl, serverOrigin) {
  const $ = cheerio.load(html);
  const assetsDownloaded = [];
  const warnings = [];
  const downloadedUrls = new Map(); // url -> local path (dedup)

  // Helper: download an image URL and return the local path
  async function downloadImage(originalUrl) {
    if (downloadedUrls.has(originalUrl)) return downloadedUrls.get(originalUrl);

    try {
      const res = await fetch(originalUrl, { signal: AbortSignal.timeout(ASSET_TIMEOUT), redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const contentType = res.headers.get('content-type')?.split(';')[0]?.trim();
      const contentLength = parseInt(res.headers.get('content-length') || '0', 10);
      if (contentLength > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large: ${(contentLength / 1024 / 1024).toFixed(1)}MB`);
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      if (buffer.length > MAX_IMAGE_SIZE) {
        throw new Error(`Image too large: ${(buffer.length / 1024 / 1024).toFixed(1)}MB`);
      }

      const mime = guessImageMime(originalUrl, contentType);
      if (!ALLOWED_IMAGE_TYPES.includes(mime)) {
        throw new Error(`Unsupported image type: ${mime}`);
      }

      const name = guessImageName(originalUrl);
      const result = await processAndSaveImage(buffer, name, mime);
      const localPath = `/${result.path}`; // e.g. /assets/imgs/uuid.jpg
      const absolutePath = `${serverOrigin}${localPath}`;

      downloadedUrls.set(originalUrl, absolutePath);
      assetsDownloaded.push({ original_url: originalUrl, local_path: result.path });
      return absolutePath;
    } catch (err) {
      warnings.push(`Failed to download ${originalUrl}: ${err.message}`);
      downloadedUrls.set(originalUrl, originalUrl); // Keep original on failure
      return originalUrl;
    }
  }

  // 1. Download images from <img src> and <source srcset>
  const imgElements = $('img[src]').toArray();
  for (const el of imgElements) {
    const src = $(el).attr('src');
    if (!src) continue;
    const absoluteSrc = isAbsoluteUrl(src) ? src : resolveUrl(pageUrl, src);
    if (!absoluteSrc) continue;
    const localPath = await downloadImage(absoluteSrc);
    $(el).attr('src', localPath);
  }

  const sourceElements = $('source[srcset]').toArray();
  for (const el of sourceElements) {
    const srcset = $(el).attr('srcset');
    if (!srcset) continue;
    // srcset can have multiple entries: "url1 1x, url2 2x"
    const parts = srcset.split(',').map(s => s.trim());
    const newParts = [];
    for (const part of parts) {
      const [url, descriptor] = part.split(/\s+/);
      if (!url) continue;
      const absoluteUrl = isAbsoluteUrl(url) ? url : resolveUrl(pageUrl, url);
      if (!absoluteUrl) { newParts.push(part); continue; }
      const localPath = await downloadImage(absoluteUrl);
      newParts.push(descriptor ? `${localPath} ${descriptor}` : localPath);
    }
    $(el).attr('srcset', newParts.join(', '));
  }

  // 2. Download external CSS and inline it
  const linkElements = $('link[rel="stylesheet"]').toArray();
  for (const el of linkElements) {
    const href = $(el).attr('href');
    if (!href) continue;
    const absoluteHref = isAbsoluteUrl(href) ? href : resolveUrl(pageUrl, href);
    if (!absoluteHref) continue;

    // Skip font CDNs — keep as remote links
    if (isFontUrl(absoluteHref)) continue;

    try {
      const res = await fetch(absoluteHref, { signal: AbortSignal.timeout(ASSET_TIMEOUT), redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      let cssContent = await res.text();

      // Download images referenced in CSS (background-image, etc.)
      const cssImageRegex = /url\(['"]?(https?:\/\/[^'")]+)['"]?\)/gi;
      let match;
      while ((match = cssImageRegex.exec(cssContent)) !== null) {
        const imgUrl = match[1];
        if (isFontUrl(imgUrl)) continue; // Skip font files
        // Only download image-like URLs
        const ext = path.extname(new URL(imgUrl).pathname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
          const localPath = await downloadImage(imgUrl);
          cssContent = cssContent.replaceAll(imgUrl, localPath);
        }
      }

      // Replace <link> with inline <style>
      $(el).replaceWith(`<style>${cssContent}</style>`);
    } catch (err) {
      warnings.push(`Failed to download CSS ${absoluteHref}: ${err.message}`);
    }
  }

  // 3. Download images from inline style background-image
  const styledElements = $('[style]').toArray();
  for (const el of styledElements) {
    const style = $(el).attr('style') || '';
    const bgRegex = /url\(['"]?(https?:\/\/[^'")]+)['"]?\)/gi;
    let match;
    let newStyle = style;
    while ((match = bgRegex.exec(style)) !== null) {
      const imgUrl = match[1];
      if (isFontUrl(imgUrl)) continue;
      const ext = path.extname(new URL(imgUrl).pathname).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.webp', '.gif', '.svg'].includes(ext)) {
        const localPath = await downloadImage(imgUrl);
        newStyle = newStyle.replaceAll(imgUrl, localPath);
      }
    }
    if (newStyle !== style) {
      $(el).attr('style', newStyle);
    }
  }

  return {
    html: $.html(),
    assetsDownloaded,
    warnings,
  };
}
