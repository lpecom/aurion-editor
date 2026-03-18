// server/lib/scraper.js
import * as cheerio from 'cheerio';
import puppeteer from 'puppeteer';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/**
 * Check if HTML looks like an unrendered SPA (React, Vue, etc.)
 * by checking for minimal body content with script/module tags.
 */
function looksLikeSpa(html) {
  const $ = cheerio.load(html);
  const body = $('body');
  // Remove scripts from consideration
  const bodyClone = body.clone();
  bodyClone.find('script, link, style, noscript').remove();
  const textContent = bodyClone.text().trim();
  const meaningfulElements = bodyClone.find('h1, h2, h3, p, img, section, article, main, header, footer, div > *').length;

  // SPA indicators: root div only, minimal text, module scripts
  const hasModuleScripts = html.includes('type="module"') || html.includes("type='module'");
  const hasRootDiv = body.find('#root, #app, #__next, #__nuxt').length > 0;

  if (hasModuleScripts && hasRootDiv && meaningfulElements < 5 && textContent.length < 200) {
    return true;
  }
  if (hasModuleScripts && meaningfulElements < 3 && textContent.length < 100) {
    return true;
  }
  return false;
}

/**
 * Scrape a URL using Puppeteer (headless browser) to render JS.
 */
async function scrapeWithBrowser(url) {
  let browser;
  try {
    const launchOpts = {
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--single-process',
      ],
    };
    // Use system Chromium if available (Railway/Nixpacks)
    const chromePaths = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/usr/bin/chromium-browser',
      '/usr/bin/chromium',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/google-chrome',
    ].filter(Boolean);
    const { existsSync } = await import('node:fs');
    const foundPath = chromePaths.find(p => existsSync(p));
    if (foundPath) {
      launchOpts.executablePath = foundPath;
    }
    browser = await puppeteer.launch(launchOpts);
    const page = await browser.newPage();
    await page.setUserAgent(USER_AGENT);
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(url, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait a bit more for late-rendering frameworks
    await page.evaluate(() => new Promise(r => setTimeout(r, 2000)));

    const html = await page.content();
    return { html, method: 'puppeteer' };
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}

/**
 * Scrape a URL and return its HTML content.
 * Tries fetch first, falls back to Puppeteer if the page looks like an SPA.
 * @param {string} url
 * @returns {{ html: string, method: string, warning?: string }}
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

  // Try simple fetch first
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(300000),
    redirect: 'follow',
  });

  if (!res.ok) {
    throw Object.assign(
      new Error(`Página retornou HTTP ${res.status}`),
      { statusCode: 422 }
    );
  }

  const html = await res.text();

  // If it looks like an SPA, re-scrape with headless browser
  if (looksLikeSpa(html)) {
    console.log(`[scraper] SPA detected for ${url}, falling back to Puppeteer...`);
    try {
      const result = await scrapeWithBrowser(url);
      return { ...result, warning: 'Página SPA detectada — renderizada via navegador headless' };
    } catch (err) {
      console.error(`[scraper] Puppeteer fallback failed: ${err.message}`);
      // Return the original fetch result with a warning
      return {
        html,
        method: 'fetch',
        warning: `Página SPA detectada mas o navegador headless falhou: ${err.message}. HTML pode estar incompleto.`,
      };
    }
  }

  return { html, method: 'fetch' };
}
