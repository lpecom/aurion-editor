import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseSectionTree,
  resolveSelector,
  getSectionHtml,
  editSectionFindReplace,
  editSectionFullReplace,
  injectCss,
} from '../server/lib/section-utils.js';

// ---------- Test HTML fixtures ----------

const ELEMENTOR_HTML = `<html><head></head><body>
<section data-id="abc123" data-element_type="section">
  <div data-id="col1" data-element_type="column">
    <div data-id="w1" data-element_type="widget" data-widget_type="heading.default">
      <h2>Hello World</h2>
    </div>
    <div data-id="w2" data-element_type="widget" data-widget_type="text-editor.default">
      <p>Some paragraph text here</p>
    </div>
  </div>
</section>
<section data-id="def456" data-element_type="section">
  <div data-id="col2" data-element_type="column">
    <div data-id="w3" data-element_type="widget" data-widget_type="button.default">
      <a href="#">Buy Now</a>
    </div>
  </div>
</section>
</body></html>`;

const SEMANTIC_HTML = `<html><head></head><body>
<header><h1>Page Title</h1></header>
<section><p>Content here</p></section>
<footer><p>Footer text</p></footer>
</body></html>`;

const PLAIN_HTML = `<html><head></head><body>
<div class="titulo"><h1>Title</h1></div>
<div class="conteudo"><p>Body content</p></div>
</body></html>`;

const EMPTY_HTML = `<html><head></head><body></body></html>`;

// ---------- parseSectionTree ----------

describe('parseSectionTree', () => {
  it('parses Elementor data-id tree correctly', () => {
    const { sections, note } = parseSectionTree(ELEMENTOR_HTML);
    assert.equal(note, undefined);
    assert.equal(sections.length, 2);

    const first = sections[0];
    assert.equal(first.data_id, 'abc123');
    assert.equal(first.element_type, 'section');
    assert.equal(first.depth, 0);
    assert.equal(first.children.length, 1); // column

    const col = first.children[0];
    assert.equal(col.data_id, 'col1');
    assert.equal(col.children.length, 2); // 2 widgets

    assert.equal(col.children[0].widget_type, 'heading');
    assert.equal(col.children[1].widget_type, 'text-editor');
  });

  it('strips .default suffix from widget_type', () => {
    const { sections } = parseSectionTree(ELEMENTOR_HTML);
    const widget = sections[1].children[0].children[0];
    assert.equal(widget.widget_type, 'button');
  });

  it('falls back to semantic tags when no data-element_type', () => {
    const { sections } = parseSectionTree(SEMANTIC_HTML);
    assert.equal(sections.length, 3);
    assert.equal(sections[0].tag, 'header');
    assert.equal(sections[1].tag, 'section');
    assert.equal(sections[2].tag, 'footer');
  });

  it('falls back to any children when no semantic tags', () => {
    const { sections } = parseSectionTree(PLAIN_HTML);
    assert.equal(sections.length, 2);
    assert.equal(sections[0].tag, 'div');
  });

  it('returns empty sections with note for empty body', () => {
    const { sections, note } = parseSectionTree(EMPTY_HTML);
    assert.equal(sections.length, 0);
    assert.ok(note);
    assert.ok(note.includes('No sections detected'));
  });

  it('truncates preview text at 80 chars', () => {
    const longText = 'A'.repeat(100);
    const html = `<html><body><section data-id="s1" data-element_type="section">${longText}</section></body></html>`;
    const { sections } = parseSectionTree(html);
    assert.ok(sections[0].preview.length <= 83); // 80 + '...'
    assert.ok(sections[0].preview.endsWith('...'));
  });
});

// ---------- resolveSelector ----------

describe('resolveSelector', () => {
  it('converts alphanumeric shorthand to data-id selector', () => {
    assert.equal(resolveSelector('abc123'), '[data-id="abc123"]');
  });

  it('passes through CSS selectors unchanged', () => {
    assert.equal(resolveSelector('.titulo'), '.titulo');
    assert.equal(resolveSelector('#main-header'), '#main-header');
    assert.equal(resolveSelector('[data-id="custom"]'), '[data-id="custom"]');
  });

  it('treats underscored IDs as data-id shorthand', () => {
    assert.equal(resolveSelector('my_section_1'), '[data-id="my_section_1"]');
  });
});

// ---------- getSectionHtml ----------

describe('getSectionHtml', () => {
  it('gets section by data-id shorthand', () => {
    const result = getSectionHtml(ELEMENTOR_HTML, 'abc123');
    assert.equal(result.data_id, 'abc123');
    assert.ok(result.outer_html.includes('Hello World'));
  });

  it('gets section by CSS selector', () => {
    const result = getSectionHtml(PLAIN_HTML, '.titulo');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 1);
    assert.ok(result[0].outer_html.includes('Title'));
  });

  it('returns multiple matches for CSS selector', () => {
    const html = `<html><body><div class="item">A</div><div class="item">B</div></body></html>`;
    const result = getSectionHtml(html, '.item');
    assert.ok(Array.isArray(result));
    assert.equal(result.length, 2);
  });

  it('throws for non-existent data-id', () => {
    assert.throws(
      () => getSectionHtml(ELEMENTOR_HTML, 'nonexistent'),
      /data-id "nonexistent" not found/
    );
  });

  it('throws for non-matching CSS selector', () => {
    assert.throws(
      () => getSectionHtml(ELEMENTOR_HTML, '.nonexistent'),
      /No elements matching/
    );
  });
});

// ---------- editSectionFindReplace ----------

describe('editSectionFindReplace', () => {
  it('replaces unique string in section', () => {
    const result = editSectionFindReplace(
      ELEMENTOR_HTML, 'w1', 'Hello World', 'Goodbye World'
    );
    assert.ok(result.section_html.includes('Goodbye World'));
    assert.ok(!result.section_html.includes('Hello World'));
    assert.ok(result.full_html.includes('Goodbye World'));
  });

  it('throws when old_string not found', () => {
    assert.throws(
      () => editSectionFindReplace(ELEMENTOR_HTML, 'w1', 'nonexistent text', 'new'),
      /old_string not found/
    );
  });

  it('throws for ambiguous match without occurrence param', () => {
    const html = `<html><body><div data-id="s1" data-element_type="section"><p>foo</p><p>foo</p></div></body></html>`;
    assert.throws(
      () => editSectionFindReplace(html, 's1', 'foo', 'bar', 0),
      /found 2 times/
    );
  });

  it('replaces specific occurrence when specified', () => {
    const html = `<html><body><div data-id="s1" data-element_type="section"><p>foo</p><p>foo</p></div></body></html>`;
    const result = editSectionFindReplace(html, 's1', 'foo', 'bar', 2);
    // First foo should remain, second should be replaced
    assert.ok(result.section_html.includes('foo'));
    assert.ok(result.section_html.includes('bar'));
  });

  it('throws when occurrence exceeds count', () => {
    const html = `<html><body><div data-id="s1" data-element_type="section"><p>foo</p></div></body></html>`;
    assert.throws(
      () => editSectionFindReplace(html, 's1', 'foo', 'bar', 5),
      /occurrence 5 requested but only 1 found/
    );
  });

  it('works with CSS selector', () => {
    const result = editSectionFindReplace(
      PLAIN_HTML, '.titulo', 'Title', 'New Title'
    );
    assert.ok(result.section_html.includes('New Title'));
    assert.ok(result.full_html.includes('New Title'));
  });

  it('throws for non-existent element', () => {
    assert.throws(
      () => editSectionFindReplace(ELEMENTOR_HTML, 'zzz999', 'a', 'b'),
      /data-id "zzz999" not found/
    );
  });
});

// ---------- editSectionFullReplace ----------

describe('editSectionFullReplace', () => {
  it('replaces inner HTML of section', () => {
    const result = editSectionFullReplace(
      ELEMENTOR_HTML, 'w1', '<h2>Completely New Content</h2>'
    );
    assert.ok(result.section_html.includes('Completely New Content'));
    assert.ok(!result.section_html.includes('Hello World'));
    assert.ok(result.full_html.includes('Completely New Content'));
    // Other sections should be untouched
    assert.ok(result.full_html.includes('Buy Now'));
  });

  it('works with CSS selector', () => {
    const result = editSectionFullReplace(
      PLAIN_HTML, '.titulo', '<h1>Replaced Title</h1>'
    );
    assert.ok(result.section_html.includes('Replaced Title'));
  });

  it('throws for non-existent element', () => {
    assert.throws(
      () => editSectionFullReplace(ELEMENTOR_HTML, 'zzz999', '<p>new</p>'),
      /data-id "zzz999" not found/
    );
  });

  it('preserves outer element attributes', () => {
    const result = editSectionFullReplace(
      ELEMENTOR_HTML, 'w1', '<h2>New</h2>'
    );
    assert.ok(result.section_html.includes('data-id="w1"'));
    assert.ok(result.section_html.includes('data-element_type="widget"'));
  });
});

// ---------- injectCss ----------

describe('injectCss', () => {
  it('injects style block before </head>', () => {
    const html = '<html><head><title>Test</title></head><body></body></html>';
    const result = injectCss(html, '.titulo { color: red; }');
    assert.ok(result.includes('<style id="aurion-overrides">'));
    assert.ok(result.includes('.titulo { color: red; }'));
    assert.ok(result.indexOf('aurion-overrides') < result.indexOf('</head>'));
  });

  it('replaces existing aurion-overrides block', () => {
    const html = '<html><head><style id="aurion-overrides">\n.old { color: blue; }\n</style></head><body></body></html>';
    const result = injectCss(html, '.new { color: green; }');
    assert.ok(result.includes('.new { color: green; }'));
    assert.ok(!result.includes('.old { color: blue; }'));
    // Should have exactly one aurion-overrides block
    const matches = result.match(/aurion-overrides/g);
    assert.equal(matches.length, 1);
  });

  it('prepends style block when no </head> tag exists', () => {
    const html = '<div>content</div>';
    const result = injectCss(html, 'body { margin: 0; }');
    assert.ok(result.startsWith('<style id="aurion-overrides">'));
    assert.ok(result.includes('<div>content</div>'));
  });

  it('handles empty CSS', () => {
    const html = '<html><head></head><body></body></html>';
    const result = injectCss(html, '');
    assert.ok(result.includes('<style id="aurion-overrides">'));
  });
});
