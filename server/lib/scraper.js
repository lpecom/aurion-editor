// server/lib/scraper.js
import * as cheerio from 'cheerio';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Scrape a URL and return its HTML content.
 * Layer 1: Fetch + Cheerio. If body text is thin or SPA-like, falls back to Puppeteer.
 * If Puppeteer is unavailable, returns the fetch HTML anyway (best-effort).
 * @param {string} url
 * @returns {{ html: string, method: 'fetch' | 'puppeteer', warning?: string }}
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
  let fetchHtml = null;
  let needsPuppeteer = false;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30000),
      redirect: 'follow',
    });

    if (!res.ok) {
      if ([403, 429, 503].includes(res.status)) {
        needsPuppeteer = true;
      } else {
        throw Object.assign(new Error(`Página retornou HTTP ${res.status}`), { statusCode: 422 });
      }
    }

    if (!needsPuppeteer) {
      fetchHtml = await res.text();
      const $ = cheerio.load(fetchHtml);

      const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
      const isSpaShell = (
        bodyText.length < 200 &&
        ($('#app').length > 0 || $('#root').length > 0 || $('#__next').length > 0 || $('[id*="app"]').length > 0)
      );

      if (!isSpaShell && bodyText.length >= 500) {
        return { html: fetchHtml, method: 'fetch' };
      }

      // Not enough content — try Puppeteer
      needsPuppeteer = true;
      console.log(`Fetch returned only ${bodyText.length} chars of text, trying Puppeteer`);
    }
  } catch (err) {
    if (err.statusCode) throw err;
    needsPuppeteer = true;
    console.log(`Fetch failed (${err.message}), trying Puppeteer`);
  }

  // Layer 2: Puppeteer
  if (needsPuppeteer) {
    try {
      return await scrapeWithPuppeteer(url);
    } catch (puppeteerErr) {
      // If we have fetch HTML, return it as best-effort instead of failing
      if (fetchHtml) {
        console.log(`Puppeteer failed (${puppeteerErr.message}), returning fetch HTML as fallback`);
        return {
          html: fetchHtml,
          method: 'fetch',
          warning: 'Página pode estar incompleta — renderização JS não disponível no servidor.',
        };
      }
      // No fetch HTML either — throw
      throw puppeteerErr;
    }
  }

  // Should not reach here, but just in case
  throw Object.assign(new Error('Não foi possível obter o conteúdo da página'), { statusCode: 422 });
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
      throw new Error('Chromium não encontrado no sistema.');
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
      new Error(`Puppeteer falhou: ${err.message}`),
      { statusCode: 422 }
    );
  } finally {
    if (browser) await browser.close();
  }
}
