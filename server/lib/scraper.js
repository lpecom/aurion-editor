// server/lib/scraper.js
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Scrape a URL and return its HTML content using Fetch + Cheerio.
 * @param {string} url
 * @returns {{ html: string, method: 'fetch' }}
 */
export async function scrapeUrl(url) {
  // Validate URL
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw Object.assign(new Error('URL inválida'), { statusCode: 400 });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw Object.assign(new Error('URL deve começar com http:// ou https://'), { statusCode: 400 });
  }

  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(30000),
    redirect: 'follow',
  });

  if (!res.ok) {
    throw Object.assign(
      new Error(`Página retornou HTTP ${res.status}`),
      { statusCode: 422 }
    );
  }

  const html = await res.text();
  return { html, method: 'fetch' };
}
