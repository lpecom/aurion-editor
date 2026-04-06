// server/lib/cloudflare.js
// Cloudflare Workers + R2 API wrapper

import { getDb } from '../db/index.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const R2_IMAGES_BUCKET = 'aurion-assets';

/**
 * Worker template script — reads HTML from R2 and serves it.
 * The BUCKET binding is configured when deploying the worker.
 */
const WORKER_SCRIPT = `
const CONTENT_TYPES = {
  css: 'text/css', js: 'application/javascript', json: 'application/json',
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp',
  gif: 'image/gif', svg: 'image/svg+xml', ico: 'image/x-icon',
};
const ASSET_EXTS = new Set(['png','jpg','jpeg','webp','gif','svg','ico','css','js']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Analytics proxy — forward /t to the API origin
    if (url.pathname === '/t' && request.method === 'POST') {
      const body = await request.text();
      if (env.API_ORIGIN) {
        ctx.waitUntil(fetch(env.API_ORIGIN + '/t', {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
        }).catch(() => {}));
      }
      return new Response(null, { status: 204 });
    }

    let slug = url.pathname.replace(/^\\/+/, '').replace(/\\/+$/, '') || 'index';

    // Fast path: assets don't need funnel/cloaker checks
    const ext = slug.includes('.') ? slug.split('.').pop().toLowerCase() : '';
    if (ASSET_EXTS.has(ext)) {
      const object = await env.BUCKET.get(slug);
      if (!object) return new Response('Not found', { status: 404 });
      return new Response(object.body, {
        headers: {
          'content-type': CONTENT_TYPES[ext] || 'application/octet-stream',
          'cache-control': 'no-store, no-cache, must-revalidate',
        }
      });
    }

    // Check funnel rules
    const funnelObj = await env.BUCKET.get('_funnels/' + slug + '.json');
    if (funnelObj) {
      const funnel = await funnelObj.json();
      if (funnel.status === 'active') {
        const pageConfig = funnel.pages[slug];
        if (pageConfig) {
          const cookies = parseCookies(request.headers.get('Cookie') || '');
          let sessionId = cookies['_aur_sid'];
          if (!sessionId) sessionId = crypto.randomUUID();

          const serveSlug = pageConfig.serve_slug || slug;
          const pageObj = await env.BUCKET.get(serveSlug);
          if (!pageObj) return new Response('Page not found', { status: 404 });

          let response = new Response(pageObj.body, {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });

          // Apply rewrites only if needed
          const hasSelectors = pageConfig.rewrites?.selectors?.length > 0;
          const hasAuto = pageConfig.rewrites?.auto && Object.keys(pageConfig.rewrites.auto).length > 0;
          const hasCta = pageConfig.next_href && !hasSelectors;

          if (hasSelectors || hasAuto || hasCta) {
            let rewriter = new HTMLRewriter();

            if (hasSelectors) {
              for (const rule of pageConfig.rewrites.selectors) {
                rewriter = rewriter.on(rule.pattern, {
                  element(el) { el.setAttribute('href', rule.href); }
                });
              }
            }

            if (hasAuto) {
              for (const [oldHref, newHref] of Object.entries(pageConfig.rewrites.auto)) {
                rewriter = rewriter.on('a[href="' + oldHref + '"]', {
                  element(el) { el.setAttribute('href', newHref); }
                });
                const noSlash = oldHref.replace(/^\\//, '');
                if (noSlash !== oldHref) {
                  rewriter = rewriter.on('a[href="' + noSlash + '"]', {
                    element(el) { el.setAttribute('href', newHref); }
                  });
                }
              }
            }

            if (hasCta) {
              for (const sel of ['a.cta', 'a.btn', 'a.button', 'a[data-cta]']) {
                rewriter = rewriter.on(sel, {
                  element(el) { el.setAttribute('href', pageConfig.next_href); }
                });
              }
            }

            response = rewriter.transform(response);
          }

          // KV tracking — fire-and-forget via waitUntil (doesn't block response)
          if (env.FUNNEL_KV) {
            ctx.waitUntil((async () => {
              try {
                const kvKey = 'funnel:' + funnel.funnel_id + ':' + sessionId;
                const existing = await env.FUNNEL_KV.get(kvKey, 'json');
                const state = existing || {
                  funnel_id: funnel.funnel_id,
                  visited: [],
                  tags: [],
                  first_seen: new Date().toISOString(),
                  last_seen: new Date().toISOString()
                };
                if (!state.visited.includes(slug)) state.visited.push(slug);
                state.last_seen = new Date().toISOString();
                await env.FUNNEL_KV.put(kvKey, JSON.stringify(state), { expirationTtl: (funnel.kv_ttl_days || 30) * 86400 });
              } catch (e) { /* non-fatal */ }
            })());
          }

          const cookieHeader = '_aur_sid=' + sessionId + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000';
          const headers = new Headers(response.headers);
          headers.set('Set-Cookie', cookieHeader);
          headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
          return new Response(response.body, { status: 200, headers });
        }
      }
    }

    // Check cloaker rules
    try {
      const rulesObj = await env.BUCKET.get('_cloaker/' + slug + '.json');
      if (rulesObj) {
        const rules = await rulesObj.json();
        if (rules.enabled) {
          const blocked = checkCloakerRules(request, rules);
          if (blocked) {
            if (rules.action === 'redirect' && rules.redirect_url) {
              return Response.redirect(rules.redirect_url, 302);
            }
            if (rules.action === 'safe_page' && rules.safe_page_slug) {
              const safePage = await env.BUCKET.get(rules.safe_page_slug);
              if (safePage) return new Response(safePage.body, {
                headers: {
                  'content-type': 'text/html; charset=utf-8',
                  'cache-control': 'no-store, no-cache, must-revalidate',
                }
              });
            }
            return new Response('', { status: 403 });
          }
        }
      }
    } catch (e) {
      // Cloaker error should not break page serving
    }

    // Serve page from R2
    let object = await env.BUCKET.get(slug);
    if (!object) object = await env.BUCKET.get(slug + '/index');
    if (!object) {
      const notFound = await env.BUCKET.get('404');
      if (notFound) return new Response(notFound.body, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store, no-cache, must-revalidate' }
      });
      return new Response('Página não encontrada', { status: 404 });
    }

    return new Response(object.body, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store, no-cache, must-revalidate',
      }
    });
  }
};

function parseCookies(cookieStr) {
  const cookies = {};
  if (!cookieStr) return cookies;
  cookieStr.split(';').forEach(pair => {
    const [key, ...vals] = pair.trim().split('=');
    if (key) cookies[key.trim()] = vals.join('=').trim();
  });
  return cookies;
}

function checkCloakerRules(request, rules) {
  const headers = request.headers;

  // Country check — skip if CF-IPCountry header is missing
  if (rules.countries && rules.countries.length > 0) {
    const country = headers.get('CF-IPCountry') || '';
    if (country) {
      const inList = rules.countries.includes(country);
      if (rules.countries_mode === 'allow' && !inList) return true;
      if (rules.countries_mode === 'block' && inList) return true;
    }
  }

  // Referrer check — allow direct traffic (no referrer) through
  if (rules.url_whitelist && rules.url_whitelist.length > 0) {
    let refHost = '';
    try {
      const referer = headers.get('Referer') || '';
      if (referer) refHost = new URL(referer).hostname;
    } catch (e) {}
    if (refHost) {
      const allowed = rules.url_whitelist.some(d => refHost.includes(d));
      if (!allowed) return true;
    }
  }

  // Device check
  if (rules.devices && rules.devices.length > 0) {
    const ua = headers.get('User-Agent') || '';
    const device = /Tablet|iPad/i.test(ua) ? 'tablet'
      : /Mobi|Android/i.test(ua) ? 'mobile' : 'desktop';
    const inList = rules.devices.includes(device);
    if (rules.devices_mode === 'allow' && !inList) return true;
    if (rules.devices_mode === 'block' && inList) return true;
  }

  // Browser check
  if (rules.browsers && rules.browsers.length > 0) {
    const ua = headers.get('User-Agent') || '';
    const browser = /Edg/i.test(ua) ? 'edge'
      : /OPR|Opera/i.test(ua) ? 'opera'
      : /Firefox/i.test(ua) ? 'firefox'
      : /Safari/i.test(ua) && !/Chrome/i.test(ua) ? 'safari'
      : /Chrome/i.test(ua) ? 'chrome' : 'other';
    const inList = rules.browsers.includes(browser);
    if (rules.browsers_mode === 'allow' && !inList) return true;
    if (rules.browsers_mode === 'block' && inList) return true;
  }

  return false;
}`;

/**
 * Encode an R2 object key for use in the REST API URL.
 * Encodes each path segment individually to preserve '/' separators.
 */
function encodeR2Key(key) {
  return key.split('/').map(encodeURIComponent).join('/');
}

function headers(apiToken) {
  return {
    'Authorization': `Bearer ${apiToken}`,
    'Content-Type': 'application/json',
  };
}

async function cfFetch(apiToken, endpoint, options = {}) {
  const url = `${CF_API_BASE}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      ...headers(apiToken),
      ...(options.headers || {}),
    },
  });
  const data = await res.json();
  if (!data.success) {
    const errors = (data.errors || []).map(e => e.message).join(', ');
    throw new Error(`Cloudflare API error: ${errors || res.statusText}`);
  }
  return data;
}

/**
 * Test connection — verify credentials with a simple API call
 */
export async function testConnection(account) {
  const data = await cfFetch(account.api_token, '/user/tokens/verify');
  return data;
}

/**
 * Create an R2 bucket
 */
export async function createR2Bucket(account, bucketName) {
  return cfFetch(account.api_token, `/accounts/${account.account_id}/r2/buckets`, {
    method: 'POST',
    body: JSON.stringify({ name: bucketName }),
  });
}

/**
 * Upload an object to R2
 * @param {object} account - Cloudflare account with account_id and api_token
 * @param {string} bucket - R2 bucket name
 * @param {string} key - Object key
 * @param {Buffer|string} content - File content
 * @param {string} [contentType='text/html; charset=utf-8'] - MIME type for the object
 */
export async function uploadToR2(account, bucket, key, content, contentType = 'text/html; charset=utf-8') {
  const url = `${CF_API_BASE}/accounts/${account.account_id}/r2/buckets/${bucket}/objects/${encodeR2Key(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${account.api_token}`,
      'Content-Type': contentType,
    },
    body: content,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed: ${res.status} ${text}`);
  }
  return true;
}

/**
 * Download an object from R2
 * @param {object} account - Cloudflare account with account_id and api_token
 * @param {string} bucket - R2 bucket name
 * @param {string} key - Object key
 * @returns {{ body: ReadableStream, contentType: string } | null}
 */
export async function getFromR2(account, bucket, key) {
  const url = `${CF_API_BASE}/accounts/${account.account_id}/r2/buckets/${bucket}/objects/${encodeR2Key(key)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${account.api_token}`,
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`R2 fetch failed: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get('content-type') || 'application/octet-stream';
  return { buffer, contentType };
}

/**
 * Get the first/default cloudflare account from the database.
 * Returns null if no account is configured.
 */
export function getDefaultCloudflareAccount() {
  const db = getDb();
  const account = db.prepare('SELECT * FROM cloudflare_accounts ORDER BY created_at ASC LIMIT 1').get();
  return account || null;
}

/**
 * Ensure the aurion-assets R2 bucket exists. Silently ignores "already exists" errors.
 */
export async function ensureImagesBucket(account) {
  try {
    await createR2Bucket(account, R2_IMAGES_BUCKET);
  } catch (err) {
    // Bucket may already exist — that's fine
    if (!err.message.includes('already exists') && !err.message.includes('duplicate')) {
      console.warn('Could not create R2 images bucket (may already exist):', err.message);
    }
  }
}

/**
 * Delete an object from R2
 */
export async function deleteFromR2(account, bucket, key) {
  const url = `${CF_API_BASE}/accounts/${account.account_id}/r2/buckets/${bucket}/objects/${encodeR2Key(key)}`;
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${account.api_token}`,
    },
  });
  if (!res.ok && res.status !== 404) {
    const text = await res.text();
    throw new Error(`R2 delete failed: ${res.status} ${text}`);
  }
  return true;
}

/**
 * Deploy a Worker script with R2 binding
 */
export async function deployWorker(account, workerName, scriptContent, r2BucketBinding) {
  const bindings = [
    {
      type: 'r2_bucket',
      name: 'BUCKET',
      bucket_name: r2BucketBinding,
    },
  ];

  // Add FUNNEL_KV binding if account has a KV namespace configured
  if (account.kv_namespace_id) {
    bindings.push({
      type: 'kv_namespace',
      name: 'FUNNEL_KV',
      namespace_id: account.kv_namespace_id,
    });
  }

  // Add API_ORIGIN for analytics proxy
  const apiOrigin = process.env.ADMIN_HOST
    ? `https://${process.env.ADMIN_HOST}`
    : process.env.RAILWAY_PUBLIC_DOMAIN
      ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
      : '';
  if (apiOrigin) {
    bindings.push({
      type: 'plain_text',
      name: 'API_ORIGIN',
      text: apiOrigin,
    });
  }

  const metadata = {
    main_module: 'worker.js',
    bindings,
  };

  // Workers API requires multipart form data for script upload with bindings
  const formData = new FormData();
  formData.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  formData.append('worker.js', new Blob([scriptContent], { type: 'application/javascript+module' }), 'worker.js');

  const url = `${CF_API_BASE}/accounts/${account.account_id}/workers/scripts/${workerName}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${account.api_token}`,
    },
    body: formData,
  });
  const data = await res.json();
  if (!data.success) {
    const errors = (data.errors || []).map(e => e.message).join(', ');
    throw new Error(`Worker deploy failed: ${errors || res.statusText}`);
  }
  return data;
}

/**
 * Delete a Worker
 */
export async function deleteWorker(account, workerName) {
  return cfFetch(account.api_token, `/accounts/${account.account_id}/workers/scripts/${workerName}`, {
    method: 'DELETE',
  });
}

/**
 * Configure a custom domain on a Worker
 */
export async function setWorkerCustomDomain(account, workerName, domain, zoneId) {
  return cfFetch(account.api_token, `/accounts/${account.account_id}/workers/domains`, {
    method: 'PUT',
    body: JSON.stringify({
      hostname: domain,
      service: workerName,
      environment: 'production',
      zone_id: zoneId,
    }),
  });
}

/**
 * Purge specific URLs from Cloudflare's edge cache
 * @param {object} account - Cloudflare account with api_token
 * @param {string} zoneId - Cloudflare zone ID for the domain
 * @param {string[]} urls - Array of full URLs to purge
 */
export async function purgeZoneCache(account, zoneId, urls) {
  if (!urls.length) return;
  // CF allows max 30 URLs per purge request
  const chunks = [];
  for (let i = 0; i < urls.length; i += 30) {
    chunks.push(urls.slice(i, i + 30));
  }
  for (const chunk of chunks) {
    await cfFetch(account.api_token, `/zones/${zoneId}/purge_cache`, {
      method: 'POST',
      body: JSON.stringify({ files: chunk }),
    });
  }
}

/**
 * Purge everything from a zone's edge cache
 */
export async function purgeZoneCacheAll(account, zoneId) {
  return cfFetch(account.api_token, `/zones/${zoneId}/purge_cache`, {
    method: 'POST',
    body: JSON.stringify({ purge_everything: true }),
  });
}

export { WORKER_SCRIPT, R2_IMAGES_BUCKET };
