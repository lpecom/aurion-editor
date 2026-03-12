// server/lib/translator.js
import * as cheerio from 'cheerio';

/**
 * Extract visible text nodes from HTML, translate them, and reinject.
 * Preserves all HTML structure, attributes, classes, URLs.
 */
export async function translateHtml(html, targetLang, provider) {
  const $ = cheerio.load(html, { decodeEntities: false });

  // Collect all text nodes with their references
  const textNodes = [];
  const textsToTranslate = [];

  function walkNodes(nodes) {
    nodes.each(function () {
      const el = $(this);
      if (this.type === 'text') {
        const text = $(this).text().trim();
        if (text.length > 0) {
          textNodes.push(this);
          textsToTranslate.push(text);
        }
      } else if (this.type === 'tag') {
        // Skip script, style, code, pre tags
        const tagName = this.tagName?.toLowerCase();
        if (['script', 'style', 'code', 'pre', 'svg'].includes(tagName)) {
          return;
        }
        walkNodes(el.contents());
      }
    });
  }

  walkNodes($.root().contents());

  if (textsToTranslate.length === 0) {
    return $.html();
  }

  // Batch translate
  const translated = await batchTranslate(textsToTranslate, targetLang, provider);

  // Reinject translated text back into the same text nodes
  for (let i = 0; i < textNodes.length; i++) {
    const node = textNodes[i];
    // Preserve leading/trailing whitespace from original
    const original = $(node).text();
    const leadingSpace = original.match(/^(\s*)/)[1];
    const trailingSpace = original.match(/(\s*)$/)[1];
    $(node).replaceWith(leadingSpace + translated[i] + trailingSpace);
  }

  return $.html();
}

/**
 * Batch text for translation, respecting API limits.
 * Splits into chunks of ~50 texts at a time.
 */
async function batchTranslate(texts, targetLang, provider) {
  const BATCH_SIZE = 50;
  const results = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    let translated;

    if (provider.provider === 'google') {
      translated = await translateWithGoogle(batch, targetLang, provider.api_key);
    } else if (provider.provider === 'openai') {
      translated = await translateWithOpenAI(batch, targetLang, provider.api_key, provider.model);
    } else {
      throw new Error(`Unsupported provider: ${provider.provider}`);
    }

    results.push(...translated);
  }

  return results;
}

/**
 * Google Cloud Translation API v2
 */
async function translateWithGoogle(texts, targetLang, apiKey) {
  // Extract just the language code (e.g., "en" from "en-US")
  const langCode = targetLang.split('-')[0];

  const response = await fetch(
    `https://translation.googleapis.com/language/translate/v2?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        q: texts,
        target: langCode,
        format: 'text',
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Translate API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.data.translations.map(t => t.translatedText);
}

/**
 * OpenAI Chat Completions API
 */
async function translateWithOpenAI(texts, targetLang, apiKey, model) {
  const numberedTexts = texts.map((t, i) => `[${i}] ${t}`).join('\n');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a professional translator. Translate the following numbered text segments to ${targetLang}.
Return ONLY the translated texts in the same numbered format [0], [1], etc.
Preserve any HTML entities or special characters.
Do not add explanations or notes.`,
        },
        {
          role: 'user',
          content: numberedTexts,
        },
      ],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Parse numbered responses back
  const lines = content.split('\n').filter(l => l.trim());
  const translated = [];

  for (let i = 0; i < texts.length; i++) {
    const pattern = new RegExp(`\\[${i}\\]\\s*(.+)`);
    const match = lines.find(l => pattern.test(l));
    if (match) {
      translated.push(match.match(pattern)[1].trim());
    } else {
      // Fallback: use the line at the same index if available
      translated.push(lines[i]?.replace(/^\[\d+\]\s*/, '').trim() || texts[i]);
    }
  }

  return translated;
}
