// scripts/inline-css.js — Inline external CSS into page html_content
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const ROOT = path.resolve(import.meta.dirname, '..');
const DIST = path.join(ROOT, 'dist');
const db = new Database(path.join(ROOT, 'data', 'aurion.db'));

const pages = db.prepare('SELECT id, slug, html_content FROM pages').all();
const update = db.prepare('UPDATE pages SET html_content = ? WHERE id = ?');

for (const page of pages) {
  if (!page.html_content) continue;

  const pageDir = path.join(DIST, page.slug);
  let html = page.html_content;
  let inlined = 0;

  // Find all <link rel="stylesheet" href="..."> and replace with inline <style>
  html = html.replace(/<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["'][^>]*\/?>/gi, (match, href) => {
    return tryInline(match, href, pageDir, page.slug) || match;
  });
  // Also match href before rel
  html = html.replace(/<link[^>]*href=["']([^"']+\.css[^"']*)["'][^>]*rel=["']stylesheet["'][^>]*\/?>/gi, (match, href) => {
    return tryInline(match, href, pageDir, page.slug) || match;
  });
  // Match link with just href to .css (no explicit rel)
  html = html.replace(/<link[^>]*href=["']([^"']+\.css)["'][^>]*\/?>/gi, (match, href) => {
    if (match.includes('rel=') && !match.includes('stylesheet')) return match; // skip non-stylesheet
    return tryInline(match, href, pageDir, page.slug) || match;
  });

  function tryInline(match, href, pageDir, slug) {
    // Skip external URLs (except tracking)
    if (href.startsWith('http://') || href.startsWith('https://')) return null;

    // Resolve file path
    let filePath;
    if (href.startsWith('./')) {
      filePath = path.join(pageDir, href.slice(2));
    } else if (href.startsWith('/assets/')) {
      // portal-g3 style: /assets/file.css → pageDir/assets/file.css
      filePath = path.join(pageDir, href);
    } else if (href.startsWith('/')) {
      filePath = path.join(DIST, href);
    } else {
      filePath = path.join(pageDir, href);
    }

    if (fs.existsSync(filePath)) {
      const css = fs.readFileSync(filePath, 'utf-8');
      inlined++;
      return `<style>/* ${path.basename(filePath)} */\n${css}</style>`;
    }

    // Try alternative locations
    const basename = path.basename(href);
    const alternatives = [
      path.join(pageDir, 'assets', basename),
      path.join(pageDir, 'assets', 'css', basename),
      path.join(pageDir, 'projeto_files', basename),
    ];
    for (const alt of alternatives) {
      if (fs.existsSync(alt)) {
        const css = fs.readFileSync(alt, 'utf-8');
        inlined++;
        return `<style>/* ${basename} */\n${css}</style>`;
      }
    }

    console.log(`  MISSING: ${href} (${slug})`);
    return null;
  }

  if (inlined > 0) {
    update.run(html, page.id);
    console.log(`${page.slug}: inlined ${inlined} CSS files`);
  } else {
    console.log(`${page.slug}: no external CSS to inline`);
  }
}

// Also fix image paths: make them absolute to the page's dist directory
const pages2 = db.prepare('SELECT id, slug, html_content FROM pages').all();
const update2 = db.prepare('UPDATE pages SET html_content = ? WHERE id = ?');

for (const page of pages2) {
  if (!page.html_content) continue;
  let html = page.html_content;
  let fixed = false;

  // Fix relative image paths: ./assets/ or ./projeto_files/ → /slug/assets/ or /slug/projeto_files/
  html = html.replace(/(?:src|srcset)=["']\.\/([^"']+)["']/gi, (match, relPath) => {
    fixed = true;
    return match.replace(`./${relPath}`, `/${page.slug}/${relPath}`);
  });

  // Fix /assets/ paths for g3 pages → /slug/assets/
  if (page.slug.startsWith('g3-')) {
    html = html.replace(/(src|srcset)=["']\/assets\//gi, (match, attr) => {
      fixed = true;
      return `${attr}="/${page.slug}/assets/`;
    });
  }

  if (fixed) {
    update2.run(html, page.id);
    console.log(`${page.slug}: fixed image paths`);
  }
}

db.close();
console.log('\nDone!');
