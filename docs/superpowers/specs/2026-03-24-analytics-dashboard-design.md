# Analytics Dashboard — Design Spec

## Overview

Built-in analytics for Aurion Editor: a lightweight tracking script auto-injected into published pages, collecting pageview and CTA click events into SQLite, displayed via a ranked table dashboard in the admin panel.

## Goals

- Track visitor metrics (pageviews, uniques, device, referrer, UTMs) across all published pages
- Track CTA click-through rate (clicks to checkout)
- Dashboard as a ranked table of pages/funnels sortable by any metric
- Zero external dependencies — all self-contained
- 30-day data retention with automatic cleanup

## Non-Goals

- Checkout completion tracking (external checkout, out of scope)
- Heatmaps or scroll depth
- Real-time live counter
- User-level session replay

---

## 1. Tracking Script (~1KB)

Injected automatically by `publishPage()` at `body_end`. No manual setup per page.

### Events

**`pageview`** — fires on DOMContentLoaded:
- `page_id` — from a data attribute injected in the HTML
- `visitor_id` — UUID stored in first-party cookie (30-day expiry)
- `referrer` — `document.referrer`
- `utm_source`, `utm_medium`, `utm_campaign` — parsed from URL search params
- `device` — derived from `navigator.userAgent` (mobile/desktop/tablet)
- **Deduplication:** if the same `visitor_id` + `page_id` already sent a `pageview` within the last 30 minutes, the server ignores the duplicate. This prevents refresh-inflated pageview counts while keeping `uniques` accurate.

**`cta_click`** — fires on click of checkout links:
- Same fields as pageview plus `event_type: 'cta_click'`
- Targets: `<a>` tags with `checkout` in href, OR elements with `.bg-danger` class, OR elements with `data-aurion-cta` attribute
- Uses event delegation on `document.body` for reliability
- **Note:** Pages must use one of these conventions for CTA click tracking to work. The `data-aurion-cta` attribute is the most explicit and recommended for new pages. Pages with no matching elements simply have zero CTA clicks (no error).

### Transport

- `navigator.sendBeacon()` to `POST /t` on the **same origin** (non-blocking)
- Fallback to `fetch()` with `keepalive: true` for older browsers
- Payload: JSON with all event fields
- The `/t` short path avoids ad-blockers and keeps the URL minimal

### Script Injection

- `publishPage()` in `server/lib/publish.js` appends the tracking `<script>` before `</body>`
- The script includes a `data-page-id` attribute with the page UUID
- Script is minified inline (no external file to fetch)

---

## 2. Collection Endpoint

### `POST /t` (alias: `POST /api/analytics/collect`)

Public endpoint (no auth required). Accepts event payloads.

Both `/t` and `/api/analytics/collect` route to the same handler. The short `/t` path is what the tracking script uses; the longer path is for documentation clarity.

**Custom domain support:** Both paths must be exempted from the custom domain guard in `server.js` (the `onRequest` hook that blocks `/api/*` on non-main hosts). Add bypass before the domain check block, similar to how `/api/health` is handled.

**Request body:**
```json
{
  "page_id": "uuid",
  "event_type": "pageview|cta_click",
  "visitor_id": "uuid",
  "referrer": "https://...",
  "utm_source": "facebook",
  "utm_medium": "cpc",
  "utm_campaign": "kit-ferramentas",
  "device": "mobile"
}
```

**Validation:**
- `page_id` must exist in `pages` table (cache page IDs in-memory Set, refreshed every 5 minutes)
- `event_type` must be `pageview` or `cta_click`
- `visitor_id` must be a valid UUID format
- Rate limit: 60 requests/minute per IP (in-memory counter). Note: resets on server restart — acceptable for spam prevention, not a security guarantee.

**Pageview deduplication:** For `pageview` events, check if the same `visitor_id` + `page_id` combination exists within the last 30 minutes. If so, discard silently. Uses index `idx_analytics_page_visitor` for fast lookup.

**Response:** `204 No Content` (always, to avoid leaking info)

---

## 3. Database Schema

### Table: `analytics_events`

Added inline in `server/db/index.js` `initSchema()` using `CREATE TABLE IF NOT EXISTS`, following the existing codebase pattern (no separate migration files).

```sql
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  page_id TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK(event_type IN ('pageview', 'cta_click')),
  visitor_id TEXT NOT NULL,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device TEXT CHECK(device IN ('mobile', 'desktop', 'tablet')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (page_id) REFERENCES pages(id)
);

CREATE INDEX IF NOT EXISTS idx_analytics_page_date ON analytics_events(page_id, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_event_date ON analytics_events(event_type, created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at);
CREATE INDEX IF NOT EXISTS idx_analytics_page_visitor ON analytics_events(page_id, visitor_id, created_at);
```

### Cleanup Job

- Runs daily via `setInterval` on server startup (every 24h)
- Also runs once on startup
- Deletes rows where `created_at < datetime('now', '-30 days')`
- Logs deleted count to console

---

## 4. Analytics API

### `GET /api/analytics`

Auth required (admin session or Bearer token).

**Query params:**
- `period` — `today`, `7d`, `30d` (default: `7d`)
- `page_id` — optional, filter to single page

No `funnel_id` filter server-side. Funnel grouping is resolved client-side: the frontend fetches funnel graph_data to map page IDs to funnel names, then groups/filters in the UI. This avoids the complexity of joining against JSON blobs in SQLite.

**Response:**
```json
{
  "period": "7d",
  "summary": {
    "total_pageviews": 8420,
    "total_uniques": 5631,
    "total_cta_clicks": 1247,
    "avg_cta_rate": 14.8
  },
  "pages": [
    {
      "page_id": "uuid",
      "title": "Kit Ferramentas Oferta 0",
      "slug": "kit-ferramentas-oferta-0",
      "pageviews": 1247,
      "uniques": 892,
      "cta_clicks": 156,
      "cta_rate": 17.5,
      "trend": 12.3
    }
  ]
}
```

- `trend` = percentage change vs previous equivalent period (requires two date-range queries — see Constraints)
- `pages` sorted by `pageviews` descending by default
- **Sorting is client-side.** With ~15 pages, the full dataset fits in one response. The frontend handles column sorting locally.

### `GET /api/analytics/:page_id`

Detail for a single page.

**Query params:**
- `period` — same as above

**Response:**
```json
{
  "page_id": "uuid",
  "title": "Kit Ferramentas Oferta 0",
  "period": "7d",
  "summary": {
    "pageviews": 1247,
    "uniques": 892,
    "cta_clicks": 156,
    "cta_rate": 17.5,
    "trend": 12.3
  },
  "daily": [
    { "date": "2026-03-24", "pageviews": 189, "uniques": 134, "cta_clicks": 28 }
  ],
  "referrers": [
    { "referrer": "facebook.com", "count": 423 }
  ],
  "devices": {
    "mobile": 721,
    "desktop": 456,
    "tablet": 70
  },
  "utms": [
    { "source": "facebook", "medium": "cpc", "campaign": "kit-ferramentas", "count": 312 }
  ]
}
```

**Timezone:** All dates are stored and returned in UTC. The `daily` breakdown groups by UTC date. For Brazil (UTC-3), this means the "day" boundary is at 21:00 local time — acceptable given the 30-day retention and aggregate nature of the data.

---

## 5. Dashboard UI

### Route: `/analytics`

New page in admin panel, added to the sidebar under a new "Analytics" section.

### Layout

**Top bar:**
- Period selector: `Hoje | 7 dias | 30 dias` (toggle buttons)
- Summary cards: Total Visitas | Unicos | Cliques CTA | Taxa CTA media

**Main content — Ranked table:**

| # | Pagina / Funil | Visitas | Unicos | Cliques CTA | Taxa CTA | Tendencia |
|---|---|---|---|---|---|---|
| 1 | Kit Ferramentas Oferta 0 | 1.247 | 892 | 156 | 17,5% | ▲ +12% |
| 2 | Porcelana Kit | 834 | 612 | 89 | 14,5% | ▼ -3% |

- All columns sortable client-side (click header to toggle asc/desc)
- Rows clickable — navigates to detail view
- Trend column: green ▲ for positive, red ▼ for negative, gray — for neutral
- Funnel name shown as subtitle (resolved client-side from funnels API)
- Optional client-side filter by funnel
- Number formatting: pt-BR locale (1.247 not 1,247)

### Detail View: `/analytics/:pageId`

**Top:** Page title + back button + period selector

**Chart section:**
- Simple line chart (daily pageviews + CTA clicks as two lines)
- Built with a lightweight chart lib or pure SVG/Canvas (no heavy dependency)

**Breakdown tables (side by side on desktop, stacked on mobile):**
- Top Referrers (top 10)
- Devices (mobile/desktop/tablet with percentage bar)
- UTMs (source + medium + campaign, top 10)

### Components

- `AnalyticsPage.tsx` — main ranked table view
- `AnalyticsDetail.tsx` — single page detail view
- `AnalyticsChart.tsx` — line chart component
- `useFetchAnalytics.ts` — hook for API calls with period state

---

## 6. File Changes Summary

### New Files
- `server/routes/analytics.js` — collect + query endpoints
- `server/lib/analytics.js` — tracking script generator, cleanup job, query helpers, pageview dedup logic

### Modified Files
- `server/lib/publish.js` — inject tracking script on publish
- `server/server.js` — register analytics routes, start cleanup job, add `/t` and `/api/analytics/collect` to custom domain bypass
- `server/db/index.js` — add `analytics_events` table + indexes in `initSchema()`
- `admin/src/pages/AnalyticsPage.tsx` — new dashboard table page
- `admin/src/pages/AnalyticsDetail.tsx` — new page detail view
- `admin/src/components/AnalyticsChart.tsx` — new line chart component
- `admin/src/hooks/useFetchAnalytics.ts` — new data fetching hook
- `admin/src/App.tsx` — add analytics routes
- `admin/src/layouts/AdminLayout.tsx` — add analytics to sidebar nav

---

## 7. Constraints

- **SQLite performance:** With 30-day retention and ~15 active pages, worst case is ~500k rows/month. SQLite handles this fine with proper indexes. Aggregate queries use `GROUP BY` with indexed columns. The `trend` computation requires two date-range aggregates per query (current vs previous period), doubling query cost — still fast with indexes on this data volume.
- **No external dependencies for charts:** Use a minimal chart approach (pure SVG or a tiny lib like uPlot ~35KB) to avoid bloating the admin bundle.
- **Script size:** Tracking script must stay under 1.5KB minified. No dependencies.
- **Privacy:** No PII collected. `visitor_id` is a random UUID, not tied to any user data. Cookie is first-party only.
- **Rate limiter:** In-memory, resets on server restart. Sufficient for spam prevention but not a hard security boundary. Acceptable for a single-user system with moderate traffic.
- **Timezone:** All storage and aggregation in UTC. No server-side timezone conversion.
