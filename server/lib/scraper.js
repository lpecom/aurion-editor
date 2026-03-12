// server/lib/scraper.js
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Scrape a URL and return its HTML content.
 * Layer 1: Fetch + Cheerio. If body text < 500 chars, falls back to Puppeteer.
 * @param {string} url
 * @returns {{ html: string, method: 'fetch' | 'puppeteer' }}
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

  // Layer 1: Fetch + Cheerio
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30000),
      redirect: 'follow',
    });

    if (!res.ok) {
      if ([403, 429, 503].includes(res.status)) {
        // These statuses often mean the page blocks plain fetch — try Puppeteer
        throw new Error(`Fetch returned ${res.status}, trying Puppeteer`);
      }
      throw Object.assign(new Error(`Página retornou HTTP ${res.status}`), { statusCode: 422 });
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Check if there's enough visible content
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    if (bodyText.length >= 500) {
      return { html, method: 'fetch' };
    }

    // Not enough content — fall through to Puppeteer
    console.log(`Fetch returned only ${bodyText.length} chars of text, falling back to Puppeteer`);
  } catch (err) {
    if (err.statusCode) throw err;
    console.log(`Fetch failed (${err.message}), falling back to Puppeteer`);
  }

  // Layer 2: Puppeteer
  return scrapeWithPuppeteer(url);
}

async function scrapeWithPuppeteer(url) {
  let browser;
  try {
    const puppeteer = await import('puppeteer');
    browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 });

    const html = await page.content();
    return { html, method: 'puppeteer' };
  } catch (err) {
    throw Object.assign(
      new Error(`Não foi possível clonar a página: ${err.message}`),
      { statusCode: 422 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
