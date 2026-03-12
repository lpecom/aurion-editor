// server/lib/cloudflare.js
// Cloudflare Workers + R2 API wrapper

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Worker template script — reads HTML from R2 and serves it.
 * The BUCKET binding is configured when deploying the worker.
 */
const WORKER_SCRIPT = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let slug = url.pathname.replace(/^\\/+/, '').replace(/\\/+$/, '') || 'index';

    // Try exact match, then with /index
    let object = await env.BUCKET.get(slug);
    if (!object) object = await env.BUCKET.get(slug + '/index');
    if (!object) {
      // Try 404 page
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
};`;

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
    method: 'PUT',
    body: JSON.stringify({ name: bucketName }),
  });
}

/**
 * Upload an object to R2
 */
export async function uploadToR2(account, bucket, key, htmlContent) {
  const url = `${CF_API_BASE}/accounts/${account.account_id}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${account.api_token}`,
      'Content-Type': 'text/html; charset=utf-8',
    },
    body: htmlContent,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`R2 upload failed: ${res.status} ${text}`);
  }
  return true;
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
  const metadata = {
    main_module: 'worker.js',
    bindings: [
      {
        type: 'r2_bucket',
        name: 'BUCKET',
        bucket_name: r2BucketBinding,
      },
    ],
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
export async function setWorkerCustomDomain(account, workerName, domain) {
  return cfFetch(account.api_token, `/accounts/${account.account_id}/workers/domains`, {
    method: 'PUT',
    body: JSON.stringify({
      hostname: domain,
      service: workerName,
      environment: 'production',
    }),
  });
}

export { WORKER_SCRIPT };
