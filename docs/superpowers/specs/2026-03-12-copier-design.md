# Copier — Page Cloner Feature

## Overview

New sidebar feature in Aurion-editor that allows users to clone any external web page by URL. The system scrapes the page, downloads assets, removes tracking/unnecessary scripts, and presents a preview with an editable checklist before saving as a new Aurion page editable in GrapesJS.

## User Flow

1. User navigates to **Copier** in the sidebar
2. Inputs a URL and clicks "Clonar página"
3. Backend scrapes the page (Fetch+Cheerio, fallback Puppeteer)
4. Backend cleans HTML, downloads assets, returns result
5. Frontend shows **preview** (iframe) + **checklist** of removed items
6. User reviews checklist (toggle items to restore), fills title/slug/type
7. User saves → new draft page created in database
8. User is redirected to edit the page in GrapesJS

## Architecture

```
[Frontend - /copier]
    │
    │ POST /api/copier/scrape  { url }
    ▼
[Backend - copier route]
    │
    ├─► Scraper module (Fetch+Cheerio → fallback Puppeteer)
    ├─► Cleaner module (removes tracking, pixels, chat, etc.)
    ├─► Asset downloader (images, CSS)
    │
    └─► Response: { html, assets[], removed_items[] }

[Frontend - Preview + Checklist]
    │
    │ POST /api/copier/save { html, title, slug, type }
    ▼
[Backend - creates page in DB (direct INSERT with html_content)]
    └─► Page available in GrapesJS editor
```

## Backend

### API Endpoints

#### `POST /api/copier/scrape`

**Request:**
```json
{ "url": "https://example.com/landing-page" }
```

**Response:**
```json
{
  "html": "<cleaned HTML string>",
  "original_title": "Page Title",
  "assets_downloaded": [
    { "original_url": "https://...", "local_path": "/assets/imgs/uuid.jpg" }
  ],
  "removed_items": [
    {
      "id": "uuid",
      "category": "tracking",
      "description": "Facebook Pixel (fbq)",
      "html_original": "<script>...<\/script>"
    }
  ]
}
```

**Errors:**
- 400 — Invalid URL
- 422 — Page could not be scraped (both methods failed)
- 504 — Timeout

#### `POST /api/copier/save`

**Request:**
```json
{
  "html": "<final HTML with user's checklist choices already applied>",
  "title": "My Cloned Page",
  "slug": "my-cloned-page",
  "type": "pv"
}
```

**Response:**
```json
{
  "page": { "id": "...", "title": "...", "slug": "...", "type": "..." }
}
```

The frontend is responsible for rebuilding the final HTML based on the user's checklist choices (restoring toggled-off items by re-injecting their `html_original` from the `/scrape` response). The backend receives the ready-to-save HTML and performs a direct `INSERT` into the `pages` table with `html_content` populated — this bypasses the existing `POST /api/pages` route which doesn't accept `html_content`, and instead uses a dedicated insert in the copier route.

**Slug uniqueness:** The frontend validates slug uniqueness via `GET /api/pages?slug=...` before enabling the save button. If a conflict is found, the user is prompted to change it.

### Scraper Module (`server/lib/scraper.js`)

**Layer 1 — Fetch + Cheerio (default):**
- HTTP fetch with realistic User-Agent header
- Cheerio parses the returned HTML
- Fallback trigger: `<body>` contains less than ~500 visible text characters (indicates JS-rendered page)

**Layer 2 — Puppeteer (fallback):**
- Headless browser, navigates to URL
- Waits for `networkidle0`
- Extracts rendered DOM via `page.content()`
- 30s timeout
- Browser closed after extraction

### Cleaner Module (`server/lib/cleaner.js`)

Processes HTML and returns cleaned version + array of removed items.

**Removal categories:**

| Category | Detection patterns |
|---|---|
| Tracking pixels | `fbq(`, `gtag(`, `ga(`, `ttq.`, `_hmt`, `hotjar`, `clarity` in script src or inline |
| Tag managers | `googletagmanager.com`, `segment.com` |
| Chat widgets | `intercom`, `drift`, `crisp`, `tawk.to`, `livechat`, `zendesk` |
| Push/notifications | `onesignal`, `pushengage`, `pushwoosh`, `web-push` |
| Third-party iframes | `<iframe>` with external `src` (except YouTube, Vimeo) |
| HTML comments | `<!-- ... -->` |
| Verification meta tags | `google-site-verification`, `facebook-domain-verification`, `msvalidate` |
| Service workers | `navigator.serviceWorker`, `manifest.json` link tags |
| Checkout links | URLs containing `hotmart.com`, `kiwify.com`, `monetizze.com`, `stripe.com/pay`, `pay.`, `checkout.`, `eduzz.com`, `braip.com` — href replaced with `#`, marked with `data-removed="checkout"` |

Each removed item stored as `{ id, category, description, html_original }` for potential restoration.

### Asset Downloader Module (`server/lib/asset-downloader.js`)

**Images:**
- Extracts URLs from `<img src>`, `<source srcset>`, `background-image: url()` in inline styles and stylesheets
- Downloads each image via fetch
- Saves to `/assets/imgs/` with UUID filename
- Registers in `images` table using Sharp processing (the logic currently in `server/routes/images.js` lines 58-87 will be extracted into a shared utility `server/lib/image-processing.js` for reuse by both the upload route and the asset downloader)
- Rewrites paths in HTML to local paths

**CSS:**
- External `<link rel="stylesheet">` → downloads content, injects as `<style>` in `<head>`
- Inline CSS (`style=""`) → kept as-is
- URLs inside CSS: images downloaded, fonts kept remote

**Fonts:**
- Google Fonts, Adobe Fonts, CDN fonts → kept as remote links
- Detection: `fonts.googleapis.com`, `fonts.gstatic.com`, `use.typekit.net`, known CDNs

**Limits:**
- 5MB max per individual image
- 10s timeout per asset download
- Failed downloads → keep original URL, include warning in response

## Frontend

### Sidebar Addition

New item in `navItems` array in `Sidebar.tsx`:
- Label: `Copier`
- Icon: `Copy` from Lucide (must be added to the import list in `Sidebar.tsx`)
- Route: `/copier`
- Position: after "Advertoriais" (NavItemLink), before "Recursos" (dropdown group with children)
- Renders as a `NavItemLink` (no children)

### Route Registration

New route in `App.tsx`: `/copier` → `CopierPage`

### Components

#### `CopierPage.tsx` — Main page, manages 3 states:

**State 1: Input**
- URL input field + "Clonar página" button
- Loading state with progress text ("Baixando página...", "Processando assets...", "Limpando HTML...")

**State 2: Preview + Checklist**
- Left side: page preview via sandboxed iframe (`srcdoc`)
- Right side: checklist of removed items grouped by category
  - Each item has a toggle (on = removed, off = restore)
  - Checkout links highlighted with optional replacement URL field
- Top bar: title field, slug (auto-generated from title), type selector (PV / Advertorial)
- "Salvar página" button

**State 3: Success**
- Confirmation message with link to open page in GrapesJS editor

#### `CopierPreview.tsx`
- Sandboxed iframe rendering the cleaned HTML via `srcdoc`
- `sandbox="allow-same-origin"` (no scripts)
- All asset URLs in the HTML must be absolute paths (e.g., `http://localhost:3001/assets/imgs/uuid.jpg`) so they resolve correctly within the `srcdoc` iframe's opaque origin. Before saving, paths are converted back to relative.

#### `CopierChecklist.tsx`
- Groups removed items by category
- Toggle per item to restore
- Checkout links show input field for replacement URL
- Counter showing "X items removidos"

## Database

**No schema changes.** Reuses existing `pages` table:
- `title` — user-defined
- `slug` — auto-generated from title
- `type` — "pv" or "advertorial" (user choice)
- `html_content` — final cleaned HTML
- `status` — "draft"
- `lang` — "pt-BR" (default, matching existing convention)
- `project_data` — null (GrapesJS generates on first editor save; column must exist in `pages` table — verify via migration or schema)

Images registered in existing `images` table via existing Sharp processing pipeline.

## Dependencies

**New packages:**
- `cheerio` — HTML parsing and manipulation
- `puppeteer` — headless browser for JS-rendered pages

## Error Handling

| Scenario | Behavior |
|---|---|
| Invalid URL | 400 error, frontend shows validation message |
| Page unreachable (timeout, 403, 404) | Clear error message with HTTP status |
| Cheerio returns insufficient content | Automatic Puppeteer fallback |
| Puppeteer also fails | 422 error: "Page could not be cloned" |
| Individual asset download fails | Keep original URL, warn in response |
| Slug already exists | Frontend validates uniqueness before save; user prompted to change |
