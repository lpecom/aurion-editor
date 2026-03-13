// server/lib/cloudflare.js
// Cloudflare Workers + R2 API wrapper

import { getDb } from '../db/index.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

const R2_IMAGES_BUCKET = 'aurion-assets';

/**
 * Worker template script — reads HTML from R2 and serves it.
 * The BUCKET binding is configured when deploying the worker.
 */
const WORKER_SCRIPT = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let slug = url.pathname.replace(/^\\/+/, '').replace(/\\/+$/, '') || 'index';

    // Check funnel rules
    const funnelObj = await env.BUCKET.get('_funnels/' + slug + '.json');
    if (funnelObj) {
      const funnel = await funnelObj.json();
      if (funnel.status === 'active') {
        const pageConfig = funnel.pages[slug];
        if (pageConfig) {
          // Get or create session cookie
          const cookies = parseCookies(request.headers.get('Cookie') || '');
          let sessionId = cookies['_aur_sid'];
          const isNew = !sessionId;
          if (!sessionId) sessionId = crypto.randomUUID();

          // Determine what to serve
          const serveSlug = pageConfig.serve_slug || slug;
          const pageObj = await env.BUCKET.get(serveSlug);
          if (!pageObj) return new Response('Page not found', { status: 404 });

          // Apply link rewrites using HTMLRewriter
          let response = new Response(pageObj.body, {
            headers: { 'content-type': 'text/html; charset=utf-8' }
          });

          let rewriter = new HTMLRewriter();

          // Selector-based rewrites (take priority)
          if (pageConfig.rewrites && pageConfig.rewrites.selectors) {
            for (const rule of pageConfig.rewrites.selectors) {
              rewriter = rewriter.on(rule.pattern, {
                element(el) { el.setAttribute('href', rule.href); }
              });
            }
          }

          // Auto rewrites for internal slug links
          if (pageConfig.rewrites && pageConfig.rewrites.auto) {
            for (const [oldHref, newHref] of Object.entries(pageConfig.rewrites.auto)) {
              rewriter = rewriter.on('a[href="' + oldHref + '"]', {
                element(el) { el.setAttribute('href', newHref); }
              });
              // Also match without leading slash
              const noSlash = oldHref.replace(/^\\//, '');
              if (noSlash !== oldHref) {
                rewriter = rewriter.on('a[href="' + noSlash + '"]', {
                  element(el) { el.setAttribute('href', newHref); }
                });
              }
            }
          }

          // If there's a next_href and no selector rewrites, rewrite all CTA-like links
          if (pageConfig.next_href && (!pageConfig.rewrites.selectors || pageConfig.rewrites.selectors.length === 0)) {
            // Rewrite common CTA patterns
            for (const sel of ['a.cta', 'a.btn', 'a.button', 'a[data-cta]']) {
              rewriter = rewriter.on(sel, {
                element(el) { el.setAttribute('href', pageConfig.next_href); }
              });
            }
          }

          response = rewriter.transform(response);

          // Write lead state to KV if available
          if (env.FUNNEL_KV) {
            const kvKey = 'funnel:' + funnel.funnel_id + ':' + sessionId;
            try {
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
            } catch (e) { /* KV write failure is non-fatal */ }
          }

          // Set session cookie
          const cookieHeader = '_aur_sid=' + sessionId + '; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=2592000';
          const headers = new Headers(response.headers);
          headers.set('Set-Cookie', cookieHeader);
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
                headers: { 'content-type': 'text/html; charset=utf-8' }
              });
            }
            return new Response('', { status: 403 });
          }
        }
      }
    } catch (e) {
      // Cloaker error should not break page serving
    }

    // Try exact match, then with /index
    let object = await env.BUCKET.get(slug);
    if (!object) object = await env.BUCKET.get(slug + '/index');
    if (!object) {
      const notFound = await env.BUCKET.get('404');
      if (notFound) return new Response(notFound.body, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
      return new Response('Página não encontrada', { status: 404 });
    }

    const contentType = slug.endsWith('.css') ? 'text/css'
      : slug.endsWith('.js') ? 'application/javascript'
      : slug.endsWith('.json') ? 'application/json'
      : 'text/html; charset=utf-8';

    return new Response(object.body, {
      headers: {
        'content-type': contentType,
        'cache-control': 'public, max-age=3600',
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

  // Country check
  if (rules.countries && rules.countries.length > 0) {
    const country = headers.get('CF-IPCountry') || '';
    const inList = rules.countries.includes(country);
    if (rules.countries_mode === 'allow' && !inList) return true;
    if (rules.countries_mode === 'block' && inList) return true;
  }

  // Referrer check
  if (rules.url_whitelist && rules.url_whitelist.length > 0) {
    let refHost = '';
    try {
      const referer = headers.get('Referer') || '';
      if (referer) refHost = new URL(referer).hostname;
    } catch (e) {}
    const allowed = rules.url_whitelist.some(d => refHost.includes(d));
    if (!allowed) return true;
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
  const url = `${CF_API_BASE}/accounts/${account.account_id}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;
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
  const url = `${CF_API_BASE}/accounts/${account.account_id}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${account.api_token}`,
    },
  });
  if (!res.ok) {
    if (res.status === 404) return null;
    return null;
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
  const url = `${CF_API_BASE}/accounts/${account.account_id}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;
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

export { WORKER_SCRIPT, R2_IMAGES_BUCKET };
