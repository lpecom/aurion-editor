// lib/publish.js
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, selectiveBuild } from '../build.js';
import { uploadToR2, deleteFromR2 } from '../server/lib/cloudflare.js';
import { getDb as getDbImport } from '../server/db/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/**
 * Generate pixel injection code based on pixel type
 */
function generatePixelCode(pixel) {
  const config = pixel.config ? (typeof pixel.config === 'string' ? JSON.parse(pixel.config) : pixel.config) : {};

  switch (pixel.type) {
    case 'facebook':
      return `<!-- Facebook Pixel -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${pixel.pixel_id}');
fbq('track', 'PageView');
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=${pixel.pixel_id}&ev=PageView&noscript=1"
/></noscript>
<!-- End Facebook Pixel -->`;

    case 'google':
      return `<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${pixel.pixel_id}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${pixel.pixel_id}');
</script>
<!-- End Google Analytics -->`;

    case 'tiktok':
      return `<!-- TikTok Pixel -->
<script>
!function (w, d, t) {
w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${pixel.pixel_id}');
ttq.page();
}(window, document, 'ttq');
</script>
<!-- End TikTok Pixel -->`;

    case 'custom':
      return config.code || '';

    default:
      return '';
  }
}

/**
 * Generate global script injection code
 */
function getGlobalScripts(db, position) {
  const scripts = db.prepare('SELECT * FROM scripts WHERE active = 1 AND position = ? ORDER BY created_at ASC').all(position);
  return scripts.map(s => s.code).join('\n');
}

/**
 * Get pixels associated with a page (via category_config pixel_ids)
 */
function getPagePixels(page, db) {
  const categoryConfig = page.category_config
    ? (typeof page.category_config === 'string' ? JSON.parse(page.category_config) : page.category_config)
    : {};

  const pixelIds = categoryConfig.pixel_ids || [];

  if (pixelIds.length === 0) {
    // If no specific pixels, return all pixels
    return db.prepare('SELECT * FROM pixels').all();
  }

  const placeholders = pixelIds.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM pixels WHERE id IN (${placeholders})`).all(...pixelIds);
}

/**
 * Build frontmatter comment block from page data
 */
function buildFrontmatter(page) {
  const fm = page.frontmatter
    ? (typeof page.frontmatter === 'string' ? JSON.parse(page.frontmatter) : page.frontmatter)
    : {};

  const lines = [];
  lines.push(`title: ${fm.title || page.title}`);
  if (fm.description) lines.push(`description: ${fm.description}`);
  if (fm.image) lines.push(`image: ${fm.image}`);

  return `<!--\n${lines.join('\n')}\n-->`;
}

/**
 * Generate client-side cloaker fallback script
 */
function generateCloakerFallback(rules) {
  return `<script>
(function(){
  document.documentElement.style.display='none';
  var rules=${JSON.stringify(rules)};
  function block(){
    if(rules.action==='redirect'&&rules.redirect_url){
      window.location.replace(rules.redirect_url);
    } else {
      document.body.innerHTML='';
    }
  }
  function checkDevice(){
    if(!rules.devices||!rules.devices.length) return true;
    var ua=navigator.userAgent;
    var d=/Tablet|iPad/i.test(ua)?'tablet':/Mobi|Android/i.test(ua)?'mobile':'desktop';
    var inList=rules.devices.indexOf(d)!==-1;
    return rules.devices_mode==='allow'?inList:!inList;
  }
  function checkBrowser(){
    if(!rules.browsers||!rules.browsers.length) return true;
    var ua=navigator.userAgent;
    var b=/Edg/i.test(ua)?'edge':/OPR|Opera/i.test(ua)?'opera':/Firefox/i.test(ua)?'firefox':/Safari/i.test(ua)&&!/Chrome/i.test(ua)?'safari':/Chrome/i.test(ua)?'chrome':'other';
    var inList=rules.browsers.indexOf(b)!==-1;
    return rules.browsers_mode==='allow'?inList:!inList;
  }
  function checkReferrer(){
    if(!rules.url_whitelist||!rules.url_whitelist.length) return true;
    var ref=document.referrer||'';
    if(!ref) return false;
    try{var h=new URL(ref).hostname;return rules.url_whitelist.some(function(d){return h.indexOf(d)!==-1});}catch(e){return false;}
  }
  if(!checkDevice()||!checkBrowser()||!checkReferrer()){block();return;}
  if(rules.countries&&rules.countries.length){
    fetch('https://ipapi.co/json/').then(function(r){return r.json();}).then(function(d){
      var c=d.country_code||'';
      var inList=rules.countries.indexOf(c)!==-1;
      var pass=rules.countries_mode==='allow'?inList:!inList;
      if(!pass){block();}else{document.documentElement.style.display='';}
    }).catch(function(){document.documentElement.style.display='';});
  } else {
    document.documentElement.style.display='';
  }
})();
</script>`;
}

/**
 * Publish a page: generates HTML file in pages/ and triggers build
 */
export async function publishPage(page, db) {
  const pagesDir = path.join(ROOT, 'pages');

  if (!fs.existsSync(pagesDir)) {
    fs.mkdirSync(pagesDir, { recursive: true });
  }

  // Get pixels for this page
  const pixels = getPagePixels(page, db);
  const pixelCode = pixels.map(generatePixelCode).filter(Boolean).join('\n');

  // Get global scripts
  const headScripts = getGlobalScripts(db, 'head');
  const bodyStartScripts = getGlobalScripts(db, 'body_start');
  const bodyEndScripts = getGlobalScripts(db, 'body_end');

  // Build frontmatter
  const frontmatter = buildFrontmatter(page);

  // Build the final HTML content
  let htmlContent = page.html_content;

  // Inject pixels and head scripts into <head> if present
  if (pixelCode || headScripts) {
    const headInjection = [headScripts, pixelCode].filter(Boolean).join('\n');
    if (htmlContent.includes('</head>')) {
      htmlContent = htmlContent.replace('</head>', `${headInjection}\n</head>`);
    } else {
      // Prepend if no <head> tag
      htmlContent = `${headInjection}\n${htmlContent}`;
    }
  }

  // Inject body_start scripts after <body>
  if (bodyStartScripts) {
    if (htmlContent.includes('<body>')) {
      htmlContent = htmlContent.replace('<body>', `<body>\n${bodyStartScripts}`);
    } else if (htmlContent.match(/<body[^>]*>/)) {
      htmlContent = htmlContent.replace(/<body[^>]*>/, `$&\n${bodyStartScripts}`);
    }
  }

  // Inject body_end scripts before </body>
  if (bodyEndScripts) {
    if (htmlContent.includes('</body>')) {
      htmlContent = htmlContent.replace('</body>', `${bodyEndScripts}\n</body>`);
    }
  }

  // Inject cloaker fallback JS for non-CF domains
  try {
    const cloakerRules = db.prepare('SELECT * FROM page_cloaker_rules WHERE page_id = ? AND enabled = 1').get(page.id);
    if (cloakerRules) {
      const rules = {
        action: cloakerRules.action,
        redirect_url: cloakerRules.redirect_url,
        url_whitelist: JSON.parse(cloakerRules.url_whitelist || '[]'),
        countries_mode: cloakerRules.countries_mode,
        countries: JSON.parse(cloakerRules.countries || '[]'),
        devices_mode: cloakerRules.devices_mode,
        devices: JSON.parse(cloakerRules.devices || '[]'),
        browsers_mode: cloakerRules.browsers_mode,
        browsers: JSON.parse(cloakerRules.browsers || '[]'),
      };
      const fallbackScript = generateCloakerFallback(rules);
      if (htmlContent.includes('</head>')) {
        htmlContent = htmlContent.replace('</head>', `${fallbackScript}\n</head>`);
      } else {
        htmlContent = `${fallbackScript}\n${htmlContent}`;
      }
    }
  } catch (err) {
    console.error(`  Cloaker fallback error: ${err.message}`);
  }

  // Write the file with frontmatter
  const finalHtml = `${frontmatter}\n${htmlContent}`;

  // Determine file path from slug
  const slug = page.slug.startsWith('/') ? page.slug.substring(1) : page.slug;
  const filePath = path.join(pagesDir, `${slug}.html`);

  // Ensure parent directory exists
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, finalHtml, 'utf8');

  // Trigger selective build if possible, otherwise full build
  try {
    await selectiveBuild(slug);
  } catch {
    await build();
  }

  // Upload to Cloudflare R2 for each associated domain with CF config
  const cfDomains = getAssociatedCfDomains(page, db);
  for (const cfDomain of cfDomains) {
    try {
      const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(cfDomain.cloudflare_account_id);
      if (cfAccount && cfDomain.r2_bucket) {
        await uploadToR2(cfAccount, cfDomain.r2_bucket, slug, finalHtml);
        console.log(`  R2 upload OK: ${slug} → ${cfDomain.domain} (${cfDomain.r2_bucket})`);
      }
    } catch (err) {
      console.error(`  R2 upload FAIL: ${slug} → ${cfDomain.domain}: ${err.message}`);
    }
  }

  // Upload cloaker rules to R2 if configured
  try {
    const cloakerRules = db.prepare('SELECT * FROM page_cloaker_rules WHERE page_id = ? AND enabled = 1').get(page.id);
    if (cloakerRules && cfDomains.length > 0) {
      // Resolve safe_page_slug if using safe_page action
      let safe_page_slug = null;
      if (cloakerRules.action === 'safe_page' && cloakerRules.safe_page_id) {
        const safePage = db.prepare('SELECT slug FROM pages WHERE id = ?').get(cloakerRules.safe_page_id);
        if (safePage) safe_page_slug = safePage.slug.startsWith('/') ? safePage.slug.substring(1) : safePage.slug;
      }

      const cloakerJson = JSON.stringify({
        enabled: true,
        action: cloakerRules.action,
        redirect_url: cloakerRules.redirect_url,
        safe_page_slug,
        url_whitelist: JSON.parse(cloakerRules.url_whitelist || '[]'),
        countries_mode: cloakerRules.countries_mode,
        countries: JSON.parse(cloakerRules.countries || '[]'),
        devices_mode: cloakerRules.devices_mode,
        devices: JSON.parse(cloakerRules.devices || '[]'),
        browsers_mode: cloakerRules.browsers_mode,
        browsers: JSON.parse(cloakerRules.browsers || '[]'),
      });

      for (const cfDomain of cfDomains) {
        try {
          const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(cfDomain.cloudflare_account_id);
          if (cfAccount && cfDomain.r2_bucket) {
            await uploadToR2(cfAccount, cfDomain.r2_bucket, `_cloaker/${slug}.json`, cloakerJson);
            console.log(`  Cloaker upload OK: ${slug} → ${cfDomain.domain}`);
          }
        } catch (err) {
          console.error(`  Cloaker upload FAIL: ${slug} → ${cfDomain.domain}: ${err.message}`);
        }
      }
    } else if (cfDomains.length > 0) {
      // No cloaker rules or disabled — delete any existing cloaker JSON
      for (const cfDomain of cfDomains) {
        try {
          const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(cfDomain.cloudflare_account_id);
          if (cfAccount && cfDomain.r2_bucket) {
            await deleteFromR2(cfAccount, cfDomain.r2_bucket, `_cloaker/${slug}.json`);
          }
        } catch (err) {
          // Ignore delete errors for cloaker cleanup
        }
      }
    }
  } catch (err) {
    console.error(`  Cloaker rules error: ${err.message}`);
  }
}

/**
 * Get domains associated with a page that have Cloudflare config.
 * Checks page_domains (direct) and category_domains (inherited).
 */
function getAssociatedCfDomains(page, db) {
  const domains = [];

  // Direct page_domains
  const pageDomains = db.prepare(`
    SELECT d.* FROM domains d
    JOIN page_domains pd ON pd.domain_id = d.id
    WHERE pd.page_id = ? AND d.cloudflare_account_id IS NOT NULL AND d.r2_bucket IS NOT NULL
  `).all(page.id);
  domains.push(...pageDomains);

  // Category domains (inherited)
  if (page.category_id) {
    const catDomains = db.prepare(`
      SELECT d.* FROM domains d
      JOIN category_domains cd ON cd.domain_id = d.id
      WHERE cd.category_id = ? AND d.cloudflare_account_id IS NOT NULL AND d.r2_bucket IS NOT NULL
    `).all(page.category_id);
    // Avoid duplicates
    for (const cd of catDomains) {
      if (!domains.find(d => d.id === cd.id)) {
        domains.push(cd);
      }
    }
  }

  return domains;
}

/**
 * Unpublish a page: removes HTML file from pages/ and rebuilds
 */
export async function unpublishPage(page, db) {
  const pagesDir = path.join(ROOT, 'pages');
  const slug = page.slug.startsWith('/') ? page.slug.substring(1) : page.slug;
  const filePath = path.join(pagesDir, `${slug}.html`);

  // Remove the page file
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // Also remove from dist
  const distDir = path.join(ROOT, 'dist');
  const distPath = path.join(distDir, slug, 'index.html');
  if (fs.existsSync(distPath)) {
    fs.unlinkSync(distPath);
    // Clean up empty parent directories
    let dir = path.dirname(distPath);
    while (dir !== distDir) {
      const entries = fs.readdirSync(dir);
      if (entries.length === 0) {
        fs.rmdirSync(dir);
        dir = path.dirname(dir);
      } else {
        break;
      }
    }
  }

  // Delete from Cloudflare R2 for each associated domain with CF config
  if (db) {
    try {
      const cfDomains = getAssociatedCfDomains(page, db);
      for (const cfDomain of cfDomains) {
        try {
          const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(cfDomain.cloudflare_account_id);
          if (cfAccount && cfDomain.r2_bucket) {
            await deleteFromR2(cfAccount, cfDomain.r2_bucket, slug);
            console.log(`  R2 delete OK: ${slug} → ${cfDomain.domain}`);
            // Also delete cloaker rules from R2
            try {
              await deleteFromR2(cfAccount, cfDomain.r2_bucket, `_cloaker/${slug}.json`);
            } catch (e) {
              // Ignore - may not exist
            }
          }
        } catch (err) {
          console.error(`  R2 delete FAIL: ${slug} → ${cfDomain.domain}: ${err.message}`);
        }
      }
    } catch (err) {
      console.error(`  R2 lookup error: ${err.message}`);
    }
  }
}
