import * as cheerio from 'cheerio';

const DATA_ID_SHORTHAND = /^[a-zA-Z0-9_]+$/;
const SEMANTIC_TAGS = ['section', 'header', 'footer', 'main', 'article', 'nav'];

export function parseSectionTree(html) {
  const $ = cheerio.load(html);
  const elements = $('[data-element_type]');

  if (elements.length === 0) {
    return parseFallback($);
  }

  const topLevel = [];

  function buildNode(el, depth) {
    const $el = $(el);
    const text = $el.text().trim();
    const node = {
      data_id: $el.attr('data-id') || null,
      tag: el.tagName,
      element_type: $el.attr('data-element_type'),
      widget_type: stripDefault($el.attr('data-widget_type')),
      preview: text.length > 80 ? text.slice(0, 80) + '...' : text,
      depth,
      children: [],
    };

    $el.children('[data-element_type]').each((_, child) => {
      node.children.push(buildNode(child, depth + 1));
    });

    return node;
  }

  $('body').children('[data-element_type]').each((_, el) => {
    topLevel.push(buildNode(el, 0));
  });

  if (topLevel.length === 0) {
    elements.each((_, el) => {
      const $el = $(el);
      if ($el.parents('[data-element_type]').length === 0) {
        topLevel.push(buildNode(el, 0));
      }
    });
  }

  return { sections: topLevel };
}

function parseFallback($) {
  const body = $('body');
  const root = body.length ? body : $.root();

  let candidates = root.children(SEMANTIC_TAGS.join(', '));
  if (candidates.length === 0) {
    candidates = root.children();
  }

  if (candidates.length === 0) {
    return {
      sections: [],
      note: 'No sections detected — use get_page with include_html=true or edit_page for this page',
    };
  }

  const sections = [];
  candidates.each((i, el) => {
    const $el = $(el);
    const text = $el.text().trim();
    sections.push({
      data_id: $el.attr('data-id') || `body-child-${i}`,
      tag: el.tagName,
      element_type: null,
      widget_type: null,
      preview: text.length > 80 ? text.slice(0, 80) + '...' : text,
      depth: 0,
      children: [],
    });
  });

  return { sections };
}

function stripDefault(val) {
  if (!val) return null;
  return val.replace(/\.default$/, '');
}

export function resolveSelector(rawSelector) {
  if (DATA_ID_SHORTHAND.test(rawSelector)) {
    return `[data-id="${rawSelector}"]`;
  }
  return rawSelector;
}

export function getSectionHtml(html, rawSelector) {
  const $ = cheerio.load(html);
  const isDataId = DATA_ID_SHORTHAND.test(rawSelector);
  const selector = resolveSelector(rawSelector);
  const matches = $(selector);

  if (matches.length === 0) {
    throw new Error(isDataId
      ? `Element with data-id "${rawSelector}" not found`
      : `No elements matching selector "${rawSelector}"`);
  }

  if (isDataId) {
    const el = matches.first();
    return {
      data_id: el.attr('data-id') || null,
      outer_html: $.html(el),
    };
  }

  const results = [];
  matches.each((_, el) => {
    const $el = $(el);
    results.push({
      data_id: $el.attr('data-id') || null,
      outer_html: $.html($el),
    });
  });
  return results;
}

export function editSectionFindReplace(html, rawSelector, oldString, newString, occurrence = 0) {
  const $ = cheerio.load(html);
  const isDataId = DATA_ID_SHORTHAND.test(rawSelector);
  const selector = resolveSelector(rawSelector);
  const el = $(selector).first();

  if (el.length === 0) {
    throw new Error(isDataId
      ? `Element with data-id "${rawSelector}" not found`
      : `No elements matching selector "${rawSelector}"`);
  }

  let sectionHtml = $.html(el);
  const count = sectionHtml.split(oldString).length - 1;

  if (count === 0) {
    throw new Error('old_string not found in section');
  }
  if (count > 1 && occurrence === 0) {
    throw new Error(`old_string found ${count} times in section. Specify occurrence param (1-indexed) to target one.`);
  }
  if (occurrence > count) {
    throw new Error(`occurrence ${occurrence} requested but only ${count} found`);
  }

  let updatedHtml;
  if (occurrence === 0 && count === 1) {
    updatedHtml = sectionHtml.replace(oldString, newString);
  } else {
    let idx = 0;
    updatedHtml = sectionHtml.replace(new RegExp(escapeRegExp(oldString), 'g'), (match) => {
      idx++;
      return idx === occurrence ? newString : match;
    });
  }

  el.replaceWith(updatedHtml);

  return {
    full_html: $.html(),
    section_html: updatedHtml,
  };
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function editSectionFullReplace(html, rawSelector, newInnerHtml) {
  const $ = cheerio.load(html);
  const isDataId = DATA_ID_SHORTHAND.test(rawSelector);
  const selector = resolveSelector(rawSelector);
  const el = $(selector).first();

  if (el.length === 0) {
    throw new Error(isDataId
      ? `Element with data-id "${rawSelector}" not found`
      : `No elements matching selector "${rawSelector}"`);
  }

  el.html(newInnerHtml);

  return {
    full_html: $.html(),
    section_html: $.html(el),
  };
}

export function injectCss(html, css) {
  const styleBlock = `<style id="aurion-overrides">\n${css}\n</style>`;
  const existingPattern = /<style id="aurion-overrides">[^]*?<\/style>/;

  if (existingPattern.test(html)) {
    return html.replace(existingPattern, styleBlock);
  }

  if (html.includes('</head>')) {
    return html.replace('</head>', `${styleBlock}\n</head>`);
  }

  return styleBlock + '\n' + html;
}
