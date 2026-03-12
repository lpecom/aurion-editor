// server/lib/cleaner.js
import * as cheerio from 'cheerio';
import { randomUUID } from 'node:crypto';

// Patterns for detecting elements to remove
const TRACKING_PATTERNS = [
  'fbq(', 'fbevents.js',
  'gtag(', 'googletagmanager.com', 'google-analytics.com', 'ga(',
  'ttq.', 'analytics.tiktok.com',
  '_hmt', 'hm.baidu.com',
  'hotjar', 'static.hotjar.com',
  'clarity', 'clarity.ms',
  'segment.com', 'cdn.segment.com',
];

const CHAT_PATTERNS = [
  'intercom', 'widget.intercom.io',
  'drift', 'js.driftt.com',
  'crisp', 'client.crisp.chat',
  'tawk.to', 'embed.tawk.to',
  'livechat', 'cdn.livechatinc.com',
  'zendesk', 'static.zdassets.com',
];

const PUSH_PATTERNS = [
  'onesignal', 'cdn.onesignal.com',
  'pushengage', 'clientcdn.pushengage.com',
  'pushwoosh',
  'web-push',
];

const CHECKOUT_DOMAINS = [
  'hotmart.com', 'kiwify.com', 'monetizze.com',
  'stripe.com/pay', 'pay.hotmart.com',
  'checkout.', 'eduzz.com', 'braip.com',
];

const VERIFICATION_META_NAMES = [
  'google-site-verification',
  'facebook-domain-verification',
  'msvalidate.01',
  'p:domain_verify',
];

function matchesAny(text, patterns) {
  const lower = text.toLowerCase();
  return patterns.some(p => lower.includes(p.toLowerCase()));
}

function categorizeScript($el) {
  const src = $el.attr('src') || '';
  const content = $el.html() || '';
  const combined = src + ' ' + content;

  if (matchesAny(combined, TRACKING_PATTERNS)) return { category: 'tracking', description: detectDescription(combined, TRACKING_PATTERNS) };
  if (matchesAny(combined, CHAT_PATTERNS)) return { category: 'chat', description: detectDescription(combined, CHAT_PATTERNS) };
  if (matchesAny(combined, PUSH_PATTERNS)) return { category: 'push', description: detectDescription(combined, PUSH_PATTERNS) };
  if (combined.includes('navigator.serviceWorker')) return { category: 'service_worker', description: 'Service Worker registration' };

  return null;
}

function detectDescription(text, patterns) {
  const lower = text.toLowerCase();
  if (lower.includes('fbq(') || lower.includes('fbevents')) return 'Facebook Pixel';
  if (lower.includes('gtag(') || lower.includes('googletagmanager')) return 'Google Tag Manager / Analytics';
  if (lower.includes('google-analytics')) return 'Google Analytics';
  if (lower.includes('ttq.') || lower.includes('tiktok')) return 'TikTok Pixel';
  if (lower.includes('hotjar')) return 'Hotjar';
  if (lower.includes('clarity')) return 'Microsoft Clarity';
  if (lower.includes('segment')) return 'Segment';
  if (lower.includes('_hmt') || lower.includes('baidu')) return 'Baidu Analytics';
  if (lower.includes('intercom')) return 'Intercom';
  if (lower.includes('drift')) return 'Drift';
  if (lower.includes('crisp')) return 'Crisp';
  if (lower.includes('tawk')) return 'Tawk.to';
  if (lower.includes('livechat')) return 'LiveChat';
  if (lower.includes('zendesk')) return 'Zendesk';
  if (lower.includes('onesignal')) return 'OneSignal';
  if (lower.includes('pushengage')) return 'PushEngage';
  if (lower.includes('pushwoosh')) return 'Pushwoosh';
  // Return the first matching pattern as fallback
  for (const p of patterns) {
    if (lower.includes(p.toLowerCase())) return p;
  }
  return 'Script desconhecido';
}

/**
 * Clean HTML: remove tracking, pixels, chat widgets, checkout links, etc.
 * @param {string} html - Raw HTML string
 * @returns {{ html: string, removedItems: Array<{ id, category, description, html_original }> }}
 */
export function cleanHtml(html) {
  const $ = cheerio.load(html);
  const removedItems = [];

  function removeAndTrack(el, category, description) {
    const id = randomUUID();
    const htmlOriginal = $.html(el);
    removedItems.push({ id, category, description, html_original: htmlOriginal });
    $(el).remove();
  }

  // 1. Remove tracking/chat/push scripts
  $('script').each((_, el) => {
    const result = categorizeScript($(el));
    if (result) {
      removeAndTrack(el, result.category, result.description);
    }
  });

  // 2. Remove noscript tags related to tracking (e.g., Facebook noscript pixel)
  $('noscript').each((_, el) => {
    const content = $(el).html() || '';
    if (matchesAny(content, TRACKING_PATTERNS)) {
      removeAndTrack(el, 'tracking', 'Tracking noscript fallback');
    }
  });

  // 3. Remove third-party iframes (except YouTube, Vimeo)
  $('iframe').each((_, el) => {
    const src = $(el).attr('src') || '';
    if (src && !src.includes('youtube.com') && !src.includes('vimeo.com') && !src.includes('youtube-nocookie.com')) {
      const domain = (() => { try { return new URL(src).hostname; } catch { return src; } })();
      removeAndTrack(el, 'iframe', `iframe de terceiro (${domain})`);
    }
  });

  // 4. Remove verification meta tags
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || '';
    if (VERIFICATION_META_NAMES.some(v => name.toLowerCase() === v.toLowerCase())) {
      removeAndTrack(el, 'verification', `Meta verificação: ${name}`);
    }
  });

  // 5. Remove HTML comments
  $('*').contents().filter(function () {
    return this.type === 'comment';
  }).each((_, el) => {
    const comment = el.data?.trim() || '';
    if (comment.length > 0) {
      removedItems.push({
        id: randomUUID(),
        category: 'comment',
        description: `Comentário HTML: ${comment.substring(0, 80)}${comment.length > 80 ? '...' : ''}`,
        html_original: `<!--${el.data}-->`,
      });
      $(el).remove();
    }
  });

  // 6. Remove manifest links (service worker scripts already caught in step 1 via categorizeScript)
  $('link[rel="manifest"]').each((_, el) => {
    removeAndTrack(el, 'service_worker', 'Web App Manifest');
  });

  // 7. Replace checkout links with # and mark them with a copier-id for targeted replacement
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    if (href && CHECKOUT_DOMAINS.some(d => href.toLowerCase().includes(d.toLowerCase()))) {
      const originalHref = href;
      const id = randomUUID();
      removedItems.push({
        id,
        category: 'checkout',
        description: `Link de compra: ${originalHref.substring(0, 100)}`,
        html_original: $.html(el),
      });
      $(el).attr('href', '#');
      $(el).attr('data-removed', 'checkout');
      $(el).attr('data-original-href', originalHref);
      $(el).attr('data-copier-id', id);
    }
  });

  return {
    html: $.html(),
    removedItems,
  };
}
