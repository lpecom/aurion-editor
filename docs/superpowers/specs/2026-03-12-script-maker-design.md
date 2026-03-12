# Script Maker — Design Spec

## Goal

Page at `/script-maker` that lets users build ready-made JavaScript scripts through a visual configurator. Four script types at launch: Cloaker, Anti-Copy, Back Button Block, Disable Dev Tools. Generated scripts can be previewed, copied, or saved directly to the Scripts table for injection into pages.

## Script Types

| Type | Runtime | Purpose |
|------|---------|---------|
| **Cloaker** | CF Worker (primary) / JS fallback | Filter traffic by country, device, browser, referrer URL. Blocked visitors get redirected or see a safe page. |
| **Anti-Copy** | Client-side JS | Disable right-click, text selection, image drag. Granular toggles. |
| **Back Button Block** | Client-side JS | Prevent `history.back()` via `pushState` loop. |
| **Disable Dev Tools** | Client-side JS | Detect F12, Ctrl+Shift+I, debugger. Redirect or close. |

## Architecture

### Client-Side Scripts (Anti-Copy, Back Button, Dev Tools)

Pure frontend generators. User toggles options → JS code generated in real time → preview + "Copiar Codigo" + "Salvar como Script" (saves to existing `scripts` table).

No new backend tables needed — these use the existing Scripts CRUD.

#### Anti-Copy Options

- Disable right-click context menu (`contextmenu` event)
- Disable text selection (`user-select: none` + `selectstart` event)
- Disable image dragging (`dragstart` event)
- Disable Ctrl+C / Ctrl+A (`keydown` event)
- Custom message on right-click attempt (optional)

#### Back Button Block Options

- Enable/disable (single toggle)
- Redirect URL when user tries to go back (optional — default: stays on same page)

#### Disable Dev Tools Options

- Detect F12 key
- Detect Ctrl+Shift+I / Ctrl+Shift+J / Ctrl+Shift+C
- Detect `debugger` statement (via timing check)
- Detect window resize (devtools docked)
- Action: redirect to URL / close tab / do nothing (just block keys)

### Cloaker — Server-Side (CF Worker)

Configured **per page**. Rules stored in database, pushed to R2 as `_cloaker/{slug}.json` on publish. The Worker checks rules before serving HTML.

**Fallback:** For pages on domains without Cloudflare, a client-side JS fallback is auto-generated and injected on publish.

#### Cloaker Rules

- **URL Whitelist** — allowed referrer domains (e.g., `facebook.com`, `google.com`). Visitors from unlisted referrers get blocked. Empty = no referrer filtering.
- **Countries** — allow or block list of ISO country codes. CF Worker uses `CF-IPCountry` header. JS fallback uses `ipapi.co` (HTTPS).
- **Devices** — allow/block: desktop, mobile, tablet. Detected via User-Agent.
- **Browsers** — allow/block: Chrome, Firefox, Safari, Edge, Opera, other. Detected via User-Agent.
- **Block Action** — redirect to external URL OR serve a safe page (another Aurion page).

#### Cloaker Flow (CF Worker)

```
Request hits Worker
  → Worker reads _cloaker/{slug}.json from R2
  → If rules exist and enabled:
    → Check CF-IPCountry header against countries list
    → Check User-Agent against device/browser lists
    → Check Referer header against URL whitelist
    → All pass? → Serve HTML normally
    → Blocked? → Redirect to URL or serve safe page from R2
  → No rules? → Serve HTML normally
```

#### Cloaker Flow (JS Fallback)

```
Page loads → Inline script runs immediately
  → document.documentElement.style.display='none' (hide page until check passes)
  → Fetch country from ipapi.co/country_code (HTTPS)
  → Check navigator.userAgent for device/browser
  → Check document.referrer for URL whitelist
  → All pass? → document.documentElement.style.display='' (show page)
  → Blocked? → window.location.replace(redirect_url)
```

> **Note:** The JS fallback uses `ipapi.co` (HTTPS) instead of `ip-api.com` (HTTP-only) to avoid mixed-content issues on HTTPS pages.

#### Cloaker JSON Schema (R2)

The `_cloaker/{slug}.json` file uploaded to R2 has the following shape:

```json
{
  "enabled": true,
  "action": "redirect",
  "redirect_url": "https://example.com/safe",
  "safe_page_slug": null,
  "url_whitelist": ["facebook.com", "google.com"],
  "countries_mode": "allow",
  "countries": ["BR", "US"],
  "devices_mode": "allow",
  "devices": ["desktop", "mobile"],
  "browsers_mode": "allow",
  "browsers": ["chrome", "firefox"]
}
```

#### Auto-Republish on Save

When cloaker rules are saved/updated for a page that is already published on a CF domain, the system automatically republishes that page to update the `_cloaker/{slug}.json` in R2. No manual republish needed.

## Database Changes

**New table:**

```sql
CREATE TABLE IF NOT EXISTS page_cloaker_rules (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  enabled INTEGER DEFAULT 1,
  action TEXT DEFAULT 'redirect',        -- 'redirect' | 'safe_page'
  redirect_url TEXT,                      -- external URL for redirect action
  safe_page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  url_whitelist TEXT DEFAULT '[]',        -- JSON array of allowed referrer domains
  countries_mode TEXT DEFAULT 'allow',    -- 'allow' | 'block'
  countries TEXT DEFAULT '[]',            -- JSON array of ISO country codes
  devices_mode TEXT DEFAULT 'allow',      -- 'allow' | 'block'
  devices TEXT DEFAULT '[]',             -- JSON array: ['desktop','mobile','tablet']
  browsers_mode TEXT DEFAULT 'allow',     -- 'allow' | 'block'
  browsers TEXT DEFAULT '[]',            -- JSON array: ['chrome','firefox','safari','edge','opera']
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```

No new tables for Anti-Copy, Back Button Block, Disable Dev Tools — they save to existing `scripts` table.

## API

### Cloaker Rules

- `GET /api/pages/:id/cloaker` — get rules for a page (404 if none)
- `PUT /api/pages/:id/cloaker` — create or update rules. Auto-republishes if page is published on CF domain.
- `DELETE /api/pages/:id/cloaker` — remove rules. Auto-republishes to remove `_cloaker/{slug}.json` from R2.

### Modified Publish Flow

`publishPage()` changes:

1. After uploading HTML to R2, check if page has cloaker rules
2. If yes and enabled: upload `_cloaker/{slug}.json` to R2
3. If yes but not enabled (or no rules): delete `_cloaker/{slug}.json` from R2 if it exists
4. For non-CF domains with cloaker rules: generate JS fallback and inject into HTML before writing to dist

`unpublishPage()` changes:

1. Delete `_cloaker/{slug}.json` from R2 (if it exists) alongside the page HTML deletion

### Modified Worker Template

The Worker template gains cloaker logic:

```js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let slug = url.pathname.replace(/^\/+|\/+$/g, '') || 'index';

    // Check cloaker rules
    const rulesObj = await env.BUCKET.get(`_cloaker/${slug}.json`);
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

    // Serve normal page (existing logic)
    let object = await env.BUCKET.get(slug);
    if (!object) object = await env.BUCKET.get(slug + '/index');
    if (!object) {
      const notFound = await env.BUCKET.get('404');
      if (notFound) return new Response(notFound.body, {
        status: 404,
        headers: { 'content-type': 'text/html; charset=utf-8' }
      });
      return new Response('Page not found', { status: 404 });
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
    const referer = headers.get('Referer') || '';
    const refHost = referer ? new URL(referer).hostname : '';
    const allowed = rules.url_whitelist.some(d => refHost.includes(d));
    if (!allowed) return true;
  }

  // Device check
  if (rules.devices && rules.devices.length > 0) {
    const ua = headers.get('User-Agent') || '';
    const device = /Mobi|Android/i.test(ua) ? 'mobile'
      : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop';
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

  return false; // not blocked
}
```

## Frontend

### Script Maker Page (`/script-maker`)

Grid of 4 cards, one per script type. Each card has icon, title, short description, "Configurar" button.

Clicking a card opens a full configurator view (could be a modal or inline expansion).

### Client-Side Script Configurators

Each has:
- Toggle options (checkboxes/switches)
- Live code preview panel (syntax highlighted)
- "Copiar Codigo" button
- "Salvar como Script" button → saves to scripts table with auto-generated name. Default position: `head` for Disable Dev Tools, `body_end` for all others.

### Cloaker Configurator

- Page selector dropdown (list of published pages)
- URL Whitelist — tag input (type domain, press Enter)
- Countries — multi-select with search (ISO codes + country names)
- Devices — checkbox group (Desktop, Mobile, Tablet)
- Browsers — checkbox group (Chrome, Firefox, Safari, Edge, Opera, Outros)
- Mode toggle per filter — "Permitir apenas" / "Bloquear"
- Block Action — radio: "Redirecionar para URL" (text input) / "Mostrar Safe Page" (page selector)
- Enable/disable toggle
- Save button → `PUT /api/pages/:id/cloaker` → auto-republishes

> **UI note:** When the selected page is only published on non-CF domains, show an info banner explaining that the JS fallback will be used instead of the CF Worker. This helps the user understand the reduced reliability (fail-open on API error, visible flash before hide).

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `ScriptMaker` | `admin/src/pages/ScriptMaker.tsx` | Main page with 4 cards |
| `AntiCopyBuilder` | `admin/src/components/script-maker/AntiCopyBuilder.tsx` | Anti-copy configurator |
| `BackBlockBuilder` | `admin/src/components/script-maker/BackBlockBuilder.tsx` | Back button configurator |
| `DevToolsBlockBuilder` | `admin/src/components/script-maker/DevToolsBlockBuilder.tsx` | Dev tools configurator |
| `CloakerBuilder` | `admin/src/components/script-maker/CloakerBuilder.tsx` | Cloaker configurator |
| `ScriptPreview` | `admin/src/components/script-maker/ScriptPreview.tsx` | Code preview + copy + save buttons |
| `cloaker-rules.js` | `server/routes/cloaker-rules.js` | Cloaker rules API routes |

### Data Flow

```
Client-Side Scripts:
  User opens Script Maker → picks type → toggles options
    → Code generated in real time (frontend only)
    → "Copiar" or "Salvar como Script" → POST /api/scripts

Cloaker:
  User opens Script Maker → picks Cloaker → selects page
    → Configures rules (countries, devices, browsers, whitelist, action)
    → Save → PUT /api/pages/:id/cloaker
    → If page published on CF domain → auto-republish
      → _cloaker/{slug}.json uploaded to R2
      → Worker reads rules on next request
    → If page on non-CF domain → JS fallback injected on next publish
```

## Edge Cases

- **Page not published yet:** Cloaker rules saved but no republish triggered. Applied on first publish.
- **Safe page deleted:** `safe_page_id` becomes NULL (ON DELETE SET NULL). Worker falls back to 403.
- **ipapi.co down (fallback):** JS fallback fails gracefully — page becomes visible (fail-open).
- **Empty whitelist:** No referrer filtering applied (not "block all").
- **Empty countries/devices/browsers:** No filtering on that dimension.
- **Multiple domains per page:** Cloaker JSON uploaded to all CF domains' R2 buckets.

## What This Does NOT Include

- Analytics/logging of blocked visits (future improvement)
- A/B cloaker testing (different rules per variant)
- Bot detection (sophisticated fingerprinting)
- Rate limiting
