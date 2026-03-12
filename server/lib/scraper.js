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

    // Detect SPA shells — they have a root div and heavy JS but little content
    const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
    const isSpaShell = (
      bodyText.length < 200 &&
      ($('#app').length > 0 || $('#root').length > 0 || $('#__next').length > 0 || $('[id*="app"]').length > 0)
    );

    if (!isSpaShell && bodyText.length >= 500) {
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
    const puppeteer = await import('puppeteer-core');

    // Find system Chrome/Chromium
    const { existsSync } = await import('node:fs');
    const possiblePaths = [
      process.env.CHROME_PATH,
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/nix/store/chromium/bin/chromium',       // Nixpacks
      '/app/.apt/usr/bin/chromium',             // Railway apt
      '/app/.apt/usr/bin/chromium-browser',
    ].filter(Boolean);
    let executablePath = possiblePaths.find(p => existsSync(p));

    // If not found in known paths, try `which`
    if (!executablePath) {
      try {
        const { execSync } = await import('node:child_process');
        const found = execSync('which chromium || which chromium-browser || which google-chrome 2>/dev/null', { encoding: 'utf8' }).trim();
        if (found) executablePath = found;
      } catch { /* not found */ }
    }

    if (!executablePath) {
      throw new Error('Chromium não encontrado no sistema. Instale o Chrome/Chromium ou defina CHROME_PATH.');
    }

    browser = await puppeteer.default.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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
