# Cloudflare Workers + R2 Hosting — Design Spec

## Goal

Move page hosting from Railway to Cloudflare edge. Each custom domain gets a dedicated Worker that reads HTML from R2 and serves it. The admin (Railway) orchestrates everything: creates Workers, configures domains, uploads to R2 on publish. Supports multiple Cloudflare accounts.

## Architecture

### Database Changes

**New table:**

```sql
CREATE TABLE IF NOT EXISTS cloudflare_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,                -- "Conta Principal", "Conta Backup"
  account_id TEXT NOT NULL,          -- Cloudflare Account ID
  api_token TEXT NOT NULL,           -- Cloudflare API Token (permissions: Workers, R2, DNS)
  created_at TEXT DEFAULT (datetime('now'))
);
```

**New columns on `domains` table:**

```sql
ALTER TABLE domains ADD COLUMN cloudflare_account_id TEXT REFERENCES cloudflare_accounts(id) ON DELETE SET NULL;
ALTER TABLE domains ADD COLUMN worker_name TEXT;
ALTER TABLE domains ADD COLUMN r2_bucket TEXT;
ALTER TABLE domains ADD COLUMN worker_status TEXT DEFAULT 'pending';  -- 'pending' | 'provisioning' | 'active' | 'error'
ALTER TABLE domains ADD COLUMN worker_error TEXT;
```

### Cloudflare API Integration

**Library:** `server/lib/cloudflare.js`

Wraps the Cloudflare REST API v4 (`https://api.cloudflare.com/client/v4`). Functions:

#### R2 Operations

- `createR2Bucket(account, bucketName)` — `PUT /accounts/{account_id}/r2/buckets`
- `uploadToR2(account, bucket, key, htmlContent)` — `PUT /accounts/{account_id}/r2/buckets/{bucket}/objects/{key}`
- `deleteFromR2(account, bucket, key)` — `DELETE /accounts/{account_id}/r2/buckets/{bucket}/objects/{key}`

#### Worker Operations

- `deployWorker(account, workerName, scriptContent, r2BucketBinding)` — `PUT /accounts/{account_id}/workers/scripts/{worker_name}`
- `deleteWorker(account, workerName)` — `DELETE /accounts/{account_id}/workers/scripts/{worker_name}`
- `setWorkerCustomDomain(account, workerName, domain)` — Configure custom domain via Workers routes or Custom Domains API

#### Worker Template

The worker script is a simple R2 reader, deployed as part of `deployWorker`:

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let slug = url.pathname.replace(/^\/+/, '').replace(/\/+$/, '') || 'index';

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
};
```

### Publish Flow (Modified)

Current flow: `publishPage()` → writes to `pages/{slug}.html` → builds to `dist/`.

New flow:

1. `publishPage()` generates final HTML (pixels, scripts, frontmatter — unchanged)
2. **NEW:** Determine which domains are associated with this page (via `page_domains` or `category_domains`)
3. For each domain that has a Cloudflare Worker configured:
   - Get the domain's `cloudflare_account_id`, `r2_bucket`
   - Fetch the Cloudflare account credentials
   - Upload HTML to R2: `PUT /{bucket}/objects/{slug}`
4. Still writes to local `dist/` for Railway-hosted preview (optional, can be removed later)

### Unpublish Flow

1. For each associated domain with CF config:
   - Delete from R2: `DELETE /{bucket}/objects/{slug}`
2. Remove from local `dist/`

### Domain Provisioning Flow

When user creates a domain and clicks "Provisionar":

1. Validate Cloudflare account credentials (test API call)
2. Generate names:
   - `worker_name`: sanitized domain name (e.g., `exemplo-com-worker`)
   - `r2_bucket`: sanitized domain name (e.g., `exemplo-com-pages`)
3. Create R2 bucket
4. Deploy Worker with R2 binding (`BUCKET` → r2_bucket)
5. Configure custom domain on the Worker
6. Update domain record: `worker_name`, `r2_bucket`, `worker_status = 'active'`
7. If any step fails: `worker_status = 'error'`, `worker_error = message`

User then points DNS CNAME to `{worker_name}.{account_subdomain}.workers.dev`.

### API

#### Cloudflare Accounts CRUD

- `GET /api/cloudflare-accounts` — list all (api_token masked)
- `POST /api/cloudflare-accounts` — create `{ name, account_id, api_token }`
- `PUT /api/cloudflare-accounts/:id` — update
- `DELETE /api/cloudflare-accounts/:id` — check if domains use it first
- `POST /api/cloudflare-accounts/:id/test` — verify credentials against CF API

#### Domain Provisioning

- `POST /api/domains/:id/provision` — triggers the full provisioning flow (create bucket, deploy worker, configure domain)
- `POST /api/domains/:id/deprovision` — tears down worker + bucket
- `GET /api/domains/:id/status` — returns current worker_status and any errors

#### Modified Domain CRUD

Existing domain endpoints gain `cloudflare_account_id` in create/update body.

### Frontend

#### Integrações → Contas Cloudflare

New page at `/integracoes/cloudflare`:
- CRUD for Cloudflare accounts (name, account_id, api_token)
- "Testar Conexão" button per account
- API token shown masked (last 4 chars)

#### Updated Domains Page

- Dropdown to select Cloudflare account when creating/editing domain
- "Provisionar" button that triggers worker creation
- Status indicator: pending (gray), provisioning (yellow spinner), active (green), error (red with message)
- DNS instructions shown after provisioning (CNAME record to configure)

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `CloudflareAccounts` | `admin/src/pages/integrations/CloudflareAccounts.tsx` | CF account CRUD |
| Updated `Domains` | `admin/src/pages/resources/Domains.tsx` | + CF account select, provision button, status |
| `cloudflare.js` | `server/lib/cloudflare.js` | Cloudflare API wrapper |
| `cloudflare-accounts.js` | `server/routes/cloudflare-accounts.js` | Account CRUD routes |

### Data Flow

```
Create Domain → Select CF Account → Click "Provisionar"
  → Server creates R2 bucket → Deploys Worker → Configures custom domain
  → Status: active
  → User points DNS CNAME

Publish Page → Server generates HTML
  → For each domain with CF:
    → Upload HTML to R2 bucket
  → Page live on edge globally
```

### Edge Cases

- **Domain without CF account:** Page only exists locally on Railway (backward compatible)
- **CF API rate limits:** Queue publish operations, retry with backoff
- **Multiple domains per page:** Upload to each domain's R2 bucket
- **Provisioning failure:** Set error status, allow retry
- **Account deletion:** Block if domains still reference it

### What This Does NOT Include

- Automatic DNS configuration (user must point CNAME manually)
- CDN purge on unpublish (R2 delete + Worker cache is sufficient)
- Asset hosting on R2 (images stay on Railway for now — future improvement)
- SSL certificate management (Cloudflare handles this automatically for custom domains)
