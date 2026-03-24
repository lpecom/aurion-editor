# Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add built-in analytics (pageviews + CTA clicks) with a ranked dashboard in the Aurion admin panel.

**Architecture:** Lightweight tracking script auto-injected on publish → public `/t` endpoint collects events into SQLite `analytics_events` table → authenticated API aggregates metrics → React dashboard with sortable table + detail view with chart.

**Tech Stack:** Fastify routes, better-sqlite3, inline tracking script (~1KB), React + Tailwind dashboard, pure SVG line chart.

**Spec:** `docs/superpowers/specs/2026-03-24-analytics-dashboard-design.md`

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `server/lib/analytics.js` | Tracking script generator, cleanup job, query helpers, rate limiter, dedup logic |
| `server/routes/analytics.js` | `POST /t` collect endpoint + `GET /api/analytics` + `GET /api/analytics/:page_id` |
| `admin/src/pages/AnalyticsPage.tsx` | Main dashboard: period selector, summary cards, ranked table |
| `admin/src/pages/AnalyticsDetail.tsx` | Single page detail: daily chart, referrers, devices, UTMs |
| `admin/src/components/AnalyticsChart.tsx` | Pure SVG line chart component |
| `admin/src/hooks/useFetchAnalytics.ts` | Hook for analytics API calls with period state |

### Modified Files
| File | Change |
|------|--------|
| `server/db/schema.sql` | Add `analytics_events` table + indexes |
| `server/server.js` | Register analytics routes, add `/t` bypass in domain guard, start cleanup job |
| `lib/publish.js` | Inject tracking script before `</body>` |
| `admin/src/App.tsx` | Add lazy imports + routes for analytics pages |
| `admin/src/components/Sidebar.tsx` | Add Analytics nav item |

---

## Task 1: Database Schema

**Files:**
- Modify: `server/db/schema.sql`

- [ ] **Step 1: Add analytics_events table to schema.sql**

Append at the end of `server/db/schema.sql`:

```sql
-- Analytics events (pageviews + CTA clicks)
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

- [ ] **Step 2: Verify schema loads**

Run:
```bash
node --input-type=module <<'EOF'
import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
const db = new Database(':memory:');
db.exec(readFileSync('server/db/schema.sql','utf8'));
console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='analytics_events'").get());
EOF
```

Expected: `{ name: 'analytics_events' }`

- [ ] **Step 3: Commit**

```bash
git add server/db/schema.sql
git commit -m "feat(analytics): add analytics_events table schema"
```

---

## Task 2: Analytics Library (`server/lib/analytics.js`)

**Files:**
- Create: `server/lib/analytics.js`

- [ ] **Step 1: Create analytics.js with all server-side logic**

```javascript
// server/lib/analytics.js
import { getDb } from '../db/index.js';

// ── Rate limiter (in-memory, resets on restart) ──
const ipCounts = new Map();
let lastReset = Date.now();

export function checkRateLimit(ip) {
  const now = Date.now();
  if (now - lastReset > 60_000) {
    ipCounts.clear();
    lastReset = now;
  }
  const count = (ipCounts.get(ip) || 0) + 1;
  ipCounts.set(ip, count);
  return count <= 60;
}

// ── Page ID cache (refreshed every 5 min) ──
let pageIdSet = new Set();
let lastRefresh = 0;

function refreshPageIds() {
  const db = getDb();
  const rows = db.prepare('SELECT id FROM pages').all();
  pageIdSet = new Set(rows.map(r => r.id));
  lastRefresh = Date.now();
}

export function isValidPageId(pageId) {
  if (Date.now() - lastRefresh > 300_000) refreshPageIds();
  return pageIdSet.has(pageId);
}

// ── UUID validation ──
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isValidUUID(str) {
  return typeof str === 'string' && UUID_RE.test(str);
}

// ── Pageview deduplication ──
export function isDuplicatePageview(pageId, visitorId) {
  const db = getDb();
  const row = db.prepare(
    `SELECT 1 FROM analytics_events
     WHERE page_id = ? AND visitor_id = ? AND event_type = 'pageview'
       AND created_at > datetime('now', '-30 minutes')
     LIMIT 1`
  ).get(pageId, visitorId);
  return !!row;
}

// ── Insert event ──
const VALID_EVENTS = new Set(['pageview', 'cta_click']);
const VALID_DEVICES = new Set(['mobile', 'desktop', 'tablet']);

export function insertEvent(data) {
  if (!VALID_EVENTS.has(data.event_type)) return false;
  if (!isValidUUID(data.visitor_id)) return false;
  if (!isValidPageId(data.page_id)) return false;
  if (data.device && !VALID_DEVICES.has(data.device)) data.device = null;

  if (data.event_type === 'pageview' && isDuplicatePageview(data.page_id, data.visitor_id)) {
    return true; // silently discard
  }

  const db = getDb();
  db.prepare(
    `INSERT INTO analytics_events (page_id, event_type, visitor_id, referrer, utm_source, utm_medium, utm_campaign, device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    data.page_id, data.event_type, data.visitor_id,
    data.referrer || null, data.utm_source || null,
    data.utm_medium || null, data.utm_campaign || null,
    data.device || null
  );
  return true;
}

// ── Cleanup job (30-day retention) ──
export function cleanupOldEvents() {
  const db = getDb();
  const result = db.prepare("DELETE FROM analytics_events WHERE created_at < datetime('now', '-30 days')").run();
  if (result.changes > 0) {
    console.log(`[analytics] Cleaned up ${result.changes} old events`);
  }
}

export function startCleanupJob() {
  cleanupOldEvents(); // run once on startup
  setInterval(cleanupOldEvents, 24 * 60 * 60 * 1000); // every 24h
}

// ── Query helpers ──
function periodToSQL(period) {
  switch (period) {
    case 'today': return "date('now')";
    case '30d': return "datetime('now', '-30 days')";
    case '7d':
    default: return "datetime('now', '-7 days')";
  }
}

function previousPeriodSQL(period) {
  switch (period) {
    case 'today': return { start: "date('now', '-1 day')", end: "date('now')" };
    case '30d': return { start: "datetime('now', '-60 days')", end: "datetime('now', '-30 days')" };
    case '7d':
    default: return { start: "datetime('now', '-14 days')", end: "datetime('now', '-7 days')" };
  }
}

export function getAnalyticsSummary(period, pageId) {
  const db = getDb();
  const since = periodToSQL(period);
  const prev = previousPeriodSQL(period);

  const pageFilterAliased = pageId ? 'AND e.page_id = ?' : '';
  const pageFilter = pageId ? 'AND page_id = ?' : '';
  const params = pageId ? [pageId] : [];

  // Current period per page
  const pages = db.prepare(`
    SELECT
      e.page_id,
      p.title,
      p.slug,
      COUNT(*) FILTER (WHERE e.event_type = 'pageview') as pageviews,
      COUNT(DISTINCT CASE WHEN e.event_type = 'pageview' THEN e.visitor_id END) as uniques,
      COUNT(*) FILTER (WHERE e.event_type = 'cta_click') as cta_clicks
    FROM analytics_events e
    JOIN pages p ON p.id = e.page_id
    WHERE e.created_at >= ${since} ${pageFilterAliased}
    GROUP BY e.page_id
    ORDER BY pageviews DESC
  `).all(...params);

  // Previous period per page (for trend)
  const prevPages = db.prepare(`
    SELECT
      page_id,
      COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews
    FROM analytics_events
    WHERE created_at >= ${prev.start} AND created_at < ${prev.end} ${pageFilter}
    GROUP BY page_id
  `).all(...params);

  const prevMap = new Map(prevPages.map(p => [p.page_id, p.pageviews]));

  const enriched = pages.map(page => {
    const ctaRate = page.pageviews > 0 ? Math.round((page.cta_clicks / page.pageviews) * 1000) / 10 : 0;
    const prevPV = prevMap.get(page.page_id) || 0;
    const trend = prevPV > 0 ? Math.round(((page.pageviews - prevPV) / prevPV) * 1000) / 10 : 0;
    return { ...page, cta_rate: ctaRate, trend };
  });

  const totalPV = enriched.reduce((s, p) => s + p.pageviews, 0);
  const totalUniques = enriched.reduce((s, p) => s + p.uniques, 0);
  const totalClicks = enriched.reduce((s, p) => s + p.cta_clicks, 0);
  const avgRate = totalPV > 0 ? Math.round((totalClicks / totalPV) * 1000) / 10 : 0;

  return {
    period,
    summary: {
      total_pageviews: totalPV,
      total_uniques: totalUniques,
      total_cta_clicks: totalClicks,
      avg_cta_rate: avgRate,
    },
    pages: enriched,
  };
}

export function getPageDetail(pageId, period) {
  const db = getDb();
  const since = periodToSQL(period);
  const prev = previousPeriodSQL(period);

  // Summary
  const summary = db.prepare(`
    SELECT
      COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews,
      COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN visitor_id END) as uniques,
      COUNT(*) FILTER (WHERE event_type = 'cta_click') as cta_clicks
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since}
  `).get(pageId);

  const prevSummary = db.prepare(`
    SELECT COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${prev.start} AND created_at < ${prev.end}
  `).get(pageId);

  const ctaRate = summary.pageviews > 0 ? Math.round((summary.cta_clicks / summary.pageviews) * 1000) / 10 : 0;
  const prevPV = prevSummary?.pageviews ?? 0;
  const trend = prevPV > 0
    ? Math.round(((summary.pageviews - prevPV) / prevPV) * 1000) / 10
    : 0;

  // Daily breakdown
  const daily = db.prepare(`
    SELECT
      date(created_at) as date,
      COUNT(*) FILTER (WHERE event_type = 'pageview') as pageviews,
      COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN visitor_id END) as uniques,
      COUNT(*) FILTER (WHERE event_type = 'cta_click') as cta_clicks
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since}
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(pageId);

  // Referrers (top 10)
  const referrers = db.prepare(`
    SELECT referrer, COUNT(*) as count
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since} AND event_type = 'pageview' AND referrer IS NOT NULL AND referrer != ''
    GROUP BY referrer ORDER BY count DESC LIMIT 10
  `).all(pageId);

  // Devices
  const deviceRows = db.prepare(`
    SELECT device, COUNT(*) as count
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since} AND event_type = 'pageview' AND device IS NOT NULL
    GROUP BY device
  `).all(pageId);
  const devices = {};
  deviceRows.forEach(r => { devices[r.device] = r.count; });

  // UTMs (top 10)
  const utms = db.prepare(`
    SELECT utm_source as source, utm_medium as medium, utm_campaign as campaign, COUNT(*) as count
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since} AND event_type = 'pageview' AND utm_source IS NOT NULL
    GROUP BY utm_source, utm_medium, utm_campaign
    ORDER BY count DESC LIMIT 10
  `).all(pageId);

  const page = db.prepare('SELECT title, slug FROM pages WHERE id = ?').get(pageId);

  return {
    page_id: pageId,
    title: page?.title || 'Unknown',
    period,
    summary: { ...summary, cta_rate: ctaRate, trend },
    daily,
    referrers,
    devices,
    utms,
  };
}

// ── Tracking script generator ──
export function generateTrackingScript(pageId) {
  return `<script data-page-id="${pageId}">(function(){var pid="${pageId}";var vid=document.cookie.match(/(?:^|; )_av=([^;]*)/);if(!vid){vid=crypto.randomUUID();document.cookie="_av="+vid+";path=/;max-age=2592000;SameSite=Lax";}else{vid=vid[1];}var ua=navigator.userAgent;var d=/Mobile|Android|iPhone/i.test(ua)?"mobile":/Tablet|iPad/i.test(ua)?"tablet":"desktop";var u=new URL(location.href);function s(et){var b=JSON.stringify({page_id:pid,event_type:et,visitor_id:vid,referrer:document.referrer||"",utm_source:u.searchParams.get("utm_source")||"",utm_medium:u.searchParams.get("utm_medium")||"",utm_campaign:u.searchParams.get("utm_campaign")||"",device:d});if(navigator.sendBeacon){navigator.sendBeacon("/t",new Blob([b],{type:"application/json"}));}else{fetch("/t",{method:"POST",body:b,keepalive:true,headers:{"Content-Type":"application/json"}});}}s("pageview");document.body.addEventListener("click",function(e){var t=e.target.closest("a[href*=checkout],.bg-danger,[data-aurion-cta]");if(t)s("cta_click");});})();</script>`;
}
```

- [ ] **Step 2: Verify module imports work**

Run: `node -e "import('./server/lib/analytics.js').then(m => console.log(Object.keys(m))).catch(e => console.error(e.message))"`

Expected: list of exported function names

- [ ] **Step 3: Commit**

```bash
git add server/lib/analytics.js
git commit -m "feat(analytics): add analytics library (collect, query, tracking script)"
```

---

## Task 3: Analytics Routes (`server/routes/analytics.js`)

**Files:**
- Create: `server/routes/analytics.js`

- [ ] **Step 1: Create analytics routes**

```javascript
// server/routes/analytics.js
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import {
  checkRateLimit, insertEvent,
  getAnalyticsSummary, getPageDetail,
} from '../lib/analytics.js';

export default async function analyticsRoutes(fastify) {

  // ── Public: event collection ──
  fastify.post('/analytics/collect', async (request, reply) => {
    const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
    if (!checkRateLimit(ip)) return reply.code(204).send();
    const body = request.body || {};
    insertEvent(body);
    return reply.code(204).send();
  });

  // ── Auth-protected: dashboard API ──
  fastify.get('/analytics', { preHandler: authMiddleware }, async (request) => {
    const period = request.query.period || '7d';
    const pageId = request.query.page_id || null;
    return getAnalyticsSummary(period, pageId);
  });

  fastify.get('/analytics/:page_id', { preHandler: authMiddleware }, async (request) => {
    const { page_id } = request.params;
    const period = request.query.period || '7d';
    const db = getDb();
    const page = db.prepare('SELECT id FROM pages WHERE id = ?').get(page_id);
    if (!page) return { error: 'Page not found' };
    return getPageDetail(page_id, period);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add server/routes/analytics.js
git commit -m "feat(analytics): add analytics routes (collect + query endpoints)"
```

---

## Task 4: Wire Up Server (`server/server.js`)

**Files:**
- Modify: `server/server.js`

- [ ] **Step 1: Add import at top of server.js**

Add after the other route imports:

```javascript
import analyticsRoutes from './routes/analytics.js';
import { startCleanupJob, checkRateLimit, insertEvent } from './lib/analytics.js';
```

- [ ] **Step 2: Add `/t` and `/api/analytics/collect` to custom domain bypass**

In the `onRequest` hook, add these lines right after the `/api/mcp` bypass (around line 65):

```javascript
if (url === '/t' || url === '/api/analytics/collect') { request.isCustomDomain = false; return; }
```

- [ ] **Step 3: Add `/t` route alias before the route registrations**

After the `onRequest` hook, add (uses the static imports from Step 1):

```javascript
// Analytics collect alias (short path for tracking script)
fastify.post('/t', async (request, reply) => {
  const ip = request.ip || request.headers['x-forwarded-for'] || 'unknown';
  if (!checkRateLimit(ip)) return reply.code(204).send();
  insertEvent(request.body || {});
  return reply.code(204).send();
});
```

Note: `checkRateLimit` and `insertEvent` are already imported statically at the top (Step 1).

- [ ] **Step 4: Register analytics routes with other API routes**

Add after the other `fastify.register` calls (around line 97):

```javascript
await fastify.register(analyticsRoutes, { prefix: '/api' });
```

- [ ] **Step 5: Start cleanup job after listen**

Add inside the listen callback, after the existing background tasks:

```javascript
startCleanupJob();
```

- [ ] **Step 6: Test server starts**

Run: `cd /home/lpzada/projects/aurion-editor && timeout 5 node server/server.js 2>&1 || true`

Expected: `Server running on port 3001` (may error due to port in use — that's OK)

- [ ] **Step 7: Commit**

```bash
git add server/server.js
git commit -m "feat(analytics): register analytics routes, domain bypass, cleanup job"
```

---

## Task 5: Tracking Script Injection in Publish

**Files:**
- Modify: `lib/publish.js` (note: at project root, NOT in `server/`)

- [ ] **Step 1: Add import at top of lib/publish.js**

```javascript
import { generateTrackingScript } from './server/lib/analytics.js';
```

(Path is relative from `lib/` to `server/lib/`)

- [ ] **Step 2: Inject tracking script before `</body>`**

Find the section where `bodyEndScripts` is injected (around line 291-296). Add the analytics script injection right after it:

```javascript
// Inject analytics tracking script
const trackingScript = generateTrackingScript(page.id);
if (htmlContent.includes('</body>')) {
  htmlContent = htmlContent.replace('</body>', `${trackingScript}\n</body>`);
}
```

- [ ] **Step 3: Commit**

```bash
git add lib/publish.js
git commit -m "feat(analytics): inject tracking script on page publish"
```

---

## Task 6: Frontend Hook (`useFetchAnalytics.ts`)

**Files:**
- Create: `admin/src/hooks/useFetchAnalytics.ts`

- [ ] **Step 1: Create the hook**

```typescript
// admin/src/hooks/useFetchAnalytics.ts
import { useState, useEffect, useCallback } from 'react';
import { api } from '../lib/api';

type Period = 'today' | '7d' | '30d';

interface PageMetrics {
  page_id: string;
  title: string;
  slug: string;
  pageviews: number;
  uniques: number;
  cta_clicks: number;
  cta_rate: number;
  trend: number;
}

interface AnalyticsSummary {
  total_pageviews: number;
  total_uniques: number;
  total_cta_clicks: number;
  avg_cta_rate: number;
}

interface AnalyticsData {
  period: string;
  summary: AnalyticsSummary;
  pages: PageMetrics[];
}

interface DailyEntry {
  date: string;
  pageviews: number;
  uniques: number;
  cta_clicks: number;
}

interface PageDetail {
  page_id: string;
  title: string;
  period: string;
  summary: PageMetrics;
  daily: DailyEntry[];
  referrers: { referrer: string; count: number }[];
  devices: Record<string, number>;
  utms: { source: string; medium: string; campaign: string; count: number }[];
}

export function useAnalytics(initialPeriod: Period = '7d') {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<AnalyticsData>(`/analytics?period=${period}`);
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, period, setPeriod, refetch: fetch };
}

export function usePageAnalytics(pageId: string, initialPeriod: Period = '7d') {
  const [period, setPeriod] = useState<Period>(initialPeriod);
  const [data, setData] = useState<PageDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.get<PageDetail>(`/analytics/${pageId}?period=${period}`);
      setData(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [pageId, period]);

  useEffect(() => { fetch(); }, [fetch]);

  return { data, loading, period, setPeriod };
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/hooks/useFetchAnalytics.ts
git commit -m "feat(analytics): add useFetchAnalytics hooks"
```

---

## Task 7: SVG Line Chart Component

**Files:**
- Create: `admin/src/components/AnalyticsChart.tsx`

- [ ] **Step 1: Create pure SVG line chart**

```tsx
// admin/src/components/AnalyticsChart.tsx
interface DataPoint {
  label: string;
  values: number[];
}

interface ChartProps {
  data: DataPoint[];
  series: { name: string; color: string }[];
  height?: number;
}

export default function AnalyticsChart({ data, series, height = 200 }: ChartProps) {
  if (!data.length) return <div className="text-gray-400 text-sm text-center py-8">Sem dados para o período</div>;

  const W = 600;
  const H = height;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const allValues = data.flatMap(d => d.values);
  const maxVal = Math.max(...allValues, 1);

  const xStep = data.length > 1 ? chartW / (data.length - 1) : chartW;

  function toPath(seriesIdx: number) {
    return data.map((d, i) => {
      const x = PAD.left + (data.length > 1 ? i * xStep : chartW / 2);
      const y = PAD.top + chartH - (d.values[seriesIdx] / maxVal) * chartH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }

  // Y-axis labels (5 ticks)
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round(maxVal * (1 - i / 4)));

  // X-axis labels (show max 7)
  const step = Math.max(1, Math.floor(data.length / 7));
  const xLabels = data.filter((_, i) => i % step === 0 || i === data.length - 1);

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 400 }}>
        {/* Grid lines */}
        {yTicks.map((v, i) => {
          const y = PAD.top + (i / 4) * chartH;
          return (
            <g key={i}>
              <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e5e7eb" strokeWidth={1} />
              <text x={PAD.left - 8} y={y + 4} textAnchor="end" fill="#9ca3af" fontSize={11}>{v}</text>
            </g>
          );
        })}

        {/* Lines */}
        {series.map((s, si) => (
          <path key={si} d={toPath(si)} fill="none" stroke={s.color} strokeWidth={2} />
        ))}

        {/* Dots */}
        {series.map((s, si) =>
          data.map((d, i) => {
            const x = PAD.left + (data.length > 1 ? i * xStep : chartW / 2);
            const y = PAD.top + chartH - (d.values[si] / maxVal) * chartH;
            return <circle key={`${si}-${i}`} cx={x} cy={y} r={3} fill={s.color} />;
          })
        )}

        {/* X labels */}
        {xLabels.map((d, i) => {
          const origIdx = data.indexOf(d);
          const x = PAD.left + (data.length > 1 ? origIdx * xStep : chartW / 2);
          return (
            <text key={i} x={x} y={H - 5} textAnchor="middle" fill="#9ca3af" fontSize={10}>
              {d.label}
            </text>
          );
        })}
      </svg>

      {/* Legend */}
      <div className="flex gap-4 justify-center mt-2">
        {series.map((s, i) => (
          <div key={i} className="flex items-center gap-1 text-xs text-gray-500">
            <span className="w-3 h-0.5 rounded" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/components/AnalyticsChart.tsx
git commit -m "feat(analytics): add pure SVG line chart component"
```

---

## Task 8: Analytics Dashboard Page

**Files:**
- Create: `admin/src/pages/AnalyticsPage.tsx`

- [ ] **Step 1: Create the main dashboard page**

```tsx
// admin/src/pages/AnalyticsPage.tsx
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, TrendingUp, TrendingDown, Minus, Eye, Users, MousePointerClick, Percent } from 'lucide-react';
import { useAnalytics } from '../hooks/useFetchAnalytics';

type SortKey = 'pageviews' | 'uniques' | 'cta_clicks' | 'cta_rate' | 'trend';
type SortDir = 'asc' | 'desc';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtPct = (n: number) => n.toFixed(1).replace('.', ',') + '%';

export default function AnalyticsPage() {
  const { data, loading, period, setPeriod } = useAnalytics();
  const [sortKey, setSortKey] = useState<SortKey>('pageviews');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const navigate = useNavigate();

  const sorted = useMemo(() => {
    if (!data?.pages) return [];
    return [...data.pages].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      return sortDir === 'desc' ? bv - av : av - bv;
    });
  }, [data, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDir('desc'); }
  }

  const periods = [
    { value: 'today' as const, label: 'Hoje' },
    { value: '7d' as const, label: '7 dias' },
    { value: '30d' as const, label: '30 dias' },
  ];

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-800">Analytics</h1>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.value ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      {s && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Visitas', value: fmt(s.total_pageviews), icon: Eye },
            { label: 'Únicos', value: fmt(s.total_uniques), icon: Users },
            { label: 'Cliques CTA', value: fmt(s.total_cta_clicks), icon: MousePointerClick },
            { label: 'Taxa CTA', value: fmtPct(s.avg_cta_rate), icon: Percent },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <card.icon className="w-4 h-4" />
                {card.label}
              </div>
              <div className="text-2xl font-bold text-gray-800">{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-400">Carregando...</div>
        ) : !sorted.length ? (
          <div className="p-8 text-center text-gray-400">Nenhum dado para o período</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">#</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase px-4 py-3">Página</th>
                {([
                  ['pageviews', 'Visitas'],
                  ['uniques', 'Únicos'],
                  ['cta_clicks', 'Cliques CTA'],
                  ['cta_rate', 'Taxa CTA'],
                  ['trend', 'Tendência'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th
                    key={key}
                    onClick={() => toggleSort(key)}
                    className="text-right text-xs font-medium text-gray-500 uppercase px-4 py-3 cursor-pointer hover:text-gray-700 select-none"
                  >
                    {label} {sortKey === key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((page, i) => (
                <tr
                  key={page.page_id}
                  onClick={() => navigate(`/analytics/${page.page_id}`)}
                  className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-gray-400">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-800">{page.title}</div>
                    <div className="text-xs text-gray-400">{page.slug}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-gray-800">{fmt(page.pageviews)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(page.uniques)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(page.cta_clicks)}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{fmtPct(page.cta_rate)}</td>
                  <td className="px-4 py-3 text-right text-sm font-medium">
                    <span className={page.trend > 0 ? 'text-green-600' : page.trend < 0 ? 'text-red-500' : 'text-gray-400'}>
                      {page.trend > 0 ? <TrendingUp className="w-4 h-4 inline mr-1" /> : page.trend < 0 ? <TrendingDown className="w-4 h-4 inline mr-1" /> : <Minus className="w-4 h-4 inline mr-1" />}
                      {page.trend > 0 ? '+' : ''}{fmtPct(page.trend)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/AnalyticsPage.tsx
git commit -m "feat(analytics): add main analytics dashboard page"
```

---

## Task 9: Analytics Detail Page

**Files:**
- Create: `admin/src/pages/AnalyticsDetail.tsx`

- [ ] **Step 1: Create the detail page**

```tsx
// admin/src/pages/AnalyticsDetail.tsx
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Monitor, Smartphone, Tablet } from 'lucide-react';
import { usePageAnalytics } from '../hooks/useFetchAnalytics';
import AnalyticsChart from '../components/AnalyticsChart';

const fmt = (n: number) => n.toLocaleString('pt-BR');
const fmtPct = (n: number) => n.toFixed(1).replace('.', ',') + '%';

export default function AnalyticsDetail() {
  const { pageId } = useParams<{ pageId: string }>();
  const navigate = useNavigate();
  const { data, loading, period, setPeriod } = usePageAnalytics(pageId!, '7d');

  const periods = [
    { value: 'today' as const, label: 'Hoje' },
    { value: '7d' as const, label: '7 dias' },
    { value: '30d' as const, label: '30 dias' },
  ];

  if (loading) return <div className="p-8 text-center text-gray-400">Carregando...</div>;
  if (!data) return <div className="p-8 text-center text-gray-400">Página não encontrada</div>;

  const chartData = data.daily.map(d => ({
    label: d.date.slice(5), // MM-DD
    values: [d.pageviews, d.cta_clicks],
  }));

  const totalDevices = Object.values(data.devices).reduce((s, v) => s + v, 0) || 1;
  const deviceIcon = { mobile: Smartphone, desktop: Monitor, tablet: Tablet };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/analytics')} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-500" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">{data.title}</h1>
          </div>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {periods.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                period === p.value ? 'bg-white shadow text-gray-800' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Visitas', value: fmt(data.summary.pageviews) },
          { label: 'Únicos', value: fmt(data.summary.uniques) },
          { label: 'Cliques CTA', value: fmt(data.summary.cta_clicks) },
          { label: 'Taxa CTA', value: fmtPct(data.summary.cta_rate) },
        ].map(c => (
          <div key={c.label} className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="text-sm text-gray-500 mb-1">{c.label}</div>
            <div className="text-2xl font-bold text-gray-800">{c.value}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Visitas por dia</h2>
        <AnalyticsChart
          data={chartData}
          series={[
            { name: 'Visitas', color: '#3b82f6' },
            { name: 'Cliques CTA', color: '#ef4444' },
          ]}
        />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Referrers */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Top Referrers</h2>
          {data.referrers.length ? (
            <div className="space-y-2">
              {data.referrers.map((r, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-600 truncate mr-2">{r.referrer}</span>
                  <span className="text-gray-800 font-medium flex-shrink-0">{fmt(r.count)}</span>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-gray-400">Sem dados</div>}
        </div>

        {/* Devices */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Dispositivos</h2>
          <div className="space-y-3">
            {(['mobile', 'desktop', 'tablet'] as const).map(d => {
              const count = data.devices[d] || 0;
              const pct = (count / totalDevices) * 100;
              const Icon = deviceIcon[d];
              return (
                <div key={d} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="flex items-center gap-1.5 text-gray-600">
                      <Icon className="w-4 h-4" />
                      {d === 'mobile' ? 'Mobile' : d === 'desktop' ? 'Desktop' : 'Tablet'}
                    </span>
                    <span className="text-gray-800 font-medium">{fmt(count)} ({fmtPct(pct)})</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="bg-blue-500 rounded-full h-1.5 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* UTMs */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-3">UTMs</h2>
          {data.utms.length ? (
            <div className="space-y-2">
              {data.utms.map((u, i) => (
                <div key={i} className="text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 truncate mr-2">{[u.source, u.medium, u.campaign].filter(Boolean).join(' / ')}</span>
                    <span className="text-gray-800 font-medium flex-shrink-0">{fmt(u.count)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : <div className="text-sm text-gray-400">Sem UTMs</div>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add admin/src/pages/AnalyticsDetail.tsx
git commit -m "feat(analytics): add analytics detail page with chart and breakdowns"
```

---

## Task 10: Wire Up Frontend (Routes + Sidebar)

**Files:**
- Modify: `admin/src/App.tsx`
- Modify: `admin/src/components/Sidebar.tsx`

- [ ] **Step 1: Add lazy imports and routes in App.tsx**

Add lazy imports with the others at the top:

```typescript
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AnalyticsDetail = lazy(() => import('./pages/AnalyticsDetail'));
```

Add routes inside the `<Route element={<AdminLayout />}>` block, after the Dashboard index route:

```tsx
<Route path="analytics" element={<SuspenseWrapper><AnalyticsPage /></SuspenseWrapper>} />
<Route path="analytics/:pageId" element={<SuspenseWrapper><AnalyticsDetail /></SuspenseWrapper>} />
```

- [ ] **Step 2: Add Analytics to Sidebar.tsx**

Import the icon at the top:

```typescript
import { BarChart3 } from 'lucide-react';
```

(If BarChart3 is already imported, skip this.)

Add to the `navItems` array, right after the Dashboard item:

```typescript
{ label: 'Analytics', to: '/analytics', icon: <BarChart3 className="w-5 h-5" /> },
```

- [ ] **Step 3: Commit**

```bash
git add admin/src/App.tsx admin/src/components/Sidebar.tsx
git commit -m "feat(analytics): add analytics routes and sidebar nav item"
```

---

## Task 11: Build & Smoke Test

- [ ] **Step 1: Build admin frontend**

Run: `cd /home/lpzada/projects/aurion-editor/admin && npm run build`

Expected: Build succeeds with no TypeScript errors

- [ ] **Step 2: Fix any build errors**

If there are type errors, fix them and re-build.

- [ ] **Step 3: Start server and verify endpoints**

Run server locally and test:

```bash
# Test collect endpoint accepts data
curl -s -X POST http://localhost:3001/t -H 'Content-Type: application/json' -d '{"page_id":"test","event_type":"pageview","visitor_id":"00000000-0000-0000-0000-000000000000","device":"mobile"}' -w '%{http_code}'

# Test analytics API (needs auth)
curl -s http://localhost:3001/api/analytics -w '%{http_code}'
```

Expected: `/t` returns `204`, `/api/analytics` returns `401` (auth required)

- [ ] **Step 4: Verify admin loads analytics page**

Navigate to `http://localhost:3001/admin/analytics` in browser. Should show the dashboard (empty data is fine).

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(analytics): build fixes and smoke test"
```

---

## Task 12: Re-publish Pages to Inject Tracking

- [ ] **Step 1: Re-publish all published pages**

The tracking script needs to be in the published HTML. Either:
- Use the Aurion MCP to re-publish each page, or
- The server auto-republishes on startup (check if this exists)

Verify by checking a published page source for the tracking `<script data-page-id=` tag.

- [ ] **Step 2: Final commit**

```bash
git add -A
git commit -m "feat(analytics): analytics dashboard complete"
```
