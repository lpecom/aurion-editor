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
  cleanupOldEvents();
  setInterval(cleanupOldEvents, 24 * 60 * 60 * 1000);
}

// ── Query helpers (Brazil GMT-3) ──
const TZ = '-3 hours';

function periodToSQL(period) {
  switch (period) {
    case 'today': return `date('now', '${TZ}')`;
    case '30d': return `datetime('now', '${TZ}', '-30 days')`;
    case '7d':
    default: return `datetime('now', '${TZ}', '-7 days')`;
  }
}

function previousPeriodSQL(period) {
  switch (period) {
    case 'today': return { start: `date('now', '${TZ}', '-1 day')`, end: `date('now', '${TZ}')` };
    case '30d': return { start: `datetime('now', '${TZ}', '-60 days')`, end: `datetime('now', '${TZ}', '-30 days')` };
    case '7d':
    default: return { start: `datetime('now', '${TZ}', '-14 days')`, end: `datetime('now', '${TZ}', '-7 days')` };
  }
}

export function getAnalyticsSummary(period, pageId) {
  const db = getDb();
  const since = periodToSQL(period);
  const prev = previousPeriodSQL(period);

  const pageFilterAliased = pageId ? 'AND e.page_id = ?' : '';
  const pageFilter = pageId ? 'AND page_id = ?' : '';
  const params = pageId ? [pageId] : [];

  // IMPORTANT: Use SUM(CASE WHEN ... THEN 1 ELSE 0 END) instead of COUNT(*) FILTER (WHERE ...)
  const pages = db.prepare(`
    SELECT
      e.page_id,
      p.title,
      p.slug,
      SUM(CASE WHEN e.event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews,
      COUNT(DISTINCT CASE WHEN e.event_type = 'pageview' THEN e.visitor_id END) as uniques,
      SUM(CASE WHEN e.event_type = 'cta_click' THEN 1 ELSE 0 END) as cta_clicks,
      COALESCE(
        (SELECT d.domain FROM page_domains pd JOIN domains d ON d.id = pd.domain_id WHERE pd.page_id = e.page_id LIMIT 1),
        (SELECT d.domain FROM category_domains cd JOIN domains d ON d.id = cd.domain_id WHERE cd.category_id = p.category_id LIMIT 1)
      ) as domain
    FROM analytics_events e
    JOIN pages p ON p.id = e.page_id
    WHERE e.created_at >= ${since} ${pageFilterAliased}
    GROUP BY e.page_id
    ORDER BY pageviews DESC
  `).all(...params);

  const prevPages = db.prepare(`
    SELECT
      page_id,
      SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews
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

  const summary = db.prepare(`
    SELECT
      SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews,
      COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN visitor_id END) as uniques,
      SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) as cta_clicks
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since}
  `).get(pageId);

  const prevSummary = db.prepare(`
    SELECT SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${prev.start} AND created_at < ${prev.end}
  `).get(pageId);

  const ctaRate = summary.pageviews > 0 ? Math.round((summary.cta_clicks / summary.pageviews) * 1000) / 10 : 0;
  const prevPV = prevSummary?.pageviews ?? 0;
  const trend = prevPV > 0
    ? Math.round(((summary.pageviews - prevPV) / prevPV) * 1000) / 10
    : 0;

  const daily = db.prepare(`
    SELECT
      date(created_at) as date,
      SUM(CASE WHEN event_type = 'pageview' THEN 1 ELSE 0 END) as pageviews,
      COUNT(DISTINCT CASE WHEN event_type = 'pageview' THEN visitor_id END) as uniques,
      SUM(CASE WHEN event_type = 'cta_click' THEN 1 ELSE 0 END) as cta_clicks
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since}
    GROUP BY date(created_at)
    ORDER BY date ASC
  `).all(pageId);

  const referrers = db.prepare(`
    SELECT referrer, COUNT(*) as count
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since} AND event_type = 'pageview' AND referrer IS NOT NULL AND referrer != ''
    GROUP BY referrer ORDER BY count DESC LIMIT 10
  `).all(pageId);

  const deviceRows = db.prepare(`
    SELECT device, COUNT(*) as count
    FROM analytics_events
    WHERE page_id = ? AND created_at >= ${since} AND event_type = 'pageview' AND device IS NOT NULL
    GROUP BY device
  `).all(pageId);
  const devices = {};
  deviceRows.forEach(r => { devices[r.device] = r.count; });

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
  return `<script data-page-id="${pageId}">(function(){var pid="${pageId}";var vid=document.cookie.match(/(?:^|; )_av=([^;]*)/);if(!vid){vid=crypto.randomUUID();document.cookie="_av="+vid+";path=/;max-age=2592000;SameSite=Lax";}else{vid=vid[1];}var ua=navigator.userAgent;var d=/Mobile|Android|iPhone/i.test(ua)?"mobile":/Tablet|iPad/i.test(ua)?"tablet":"desktop";var u=new URL(location.href);function s(et){var b=JSON.stringify({page_id:pid,event_type:et,visitor_id:vid,referrer:document.referrer||"",utm_source:u.searchParams.get("utm_source")||"",utm_medium:u.searchParams.get("utm_medium")||"",utm_campaign:u.searchParams.get("utm_campaign")||"",device:d});if(navigator.sendBeacon){navigator.sendBeacon("/t",new Blob([b],{type:"application/json"}));}else{fetch("/t",{method:"POST",body:b,keepalive:true,headers:{"Content-Type":"application/json"}});}}s("pageview");document.body.addEventListener("click",function(e){var t=e.target.closest("a[href*=checkout],.botao,[data-aurion-cta]");if(t)s("cta_click");});})();</script>`;
}
