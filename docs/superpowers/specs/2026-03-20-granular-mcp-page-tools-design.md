# Granular MCP Page Tools

**Date:** 2026-03-20
**Status:** Approved
**Problem:** `get_page` returns ~235K chars per page (76-82% inlined CSS). Edits require reading and rewriting the full HTML, consuming ~470K+ tokens per round-trip. `edit_page` clears GrapesJS `project_data`, breaking the visual editor on reimport.

## Context

- 10 advertorial pages, all variations of the same Elementor template
- HTML size: 218K-248K chars (avg 235K)
- ~80% is inlined CSS (`<style>` blocks), ~1% JS, ~20% actual content markup
- Sections are identifiable via Elementor `data-id` attributes (consistent across pages)
- Most edits are surgical (change text, image, link, color) — full rewrites are rare
- GrapesJS `project_data` breaks when cleared and reimported from edited HTML

## Design

### Tool 1: `get_page` (reformulated)

Replaces the current `get_page` which returns `SELECT *`.

**Input:**
- `id` (string) or `slug` (string) — same as today
- `include_html` (boolean, optional, default `false`) — if `true`, also returns `html_content` (full HTML). For backwards compatibility and full-restructure workflows.

**Output:** Metadata + section tree. No HTML, no CSS (unless `include_html` is true).

```json
{
  "id": "abc-123",
  "title": "Porcelana Kit",
  "slug": "adv-porcelana-kit",
  "type": "advertorial",
  "status": "draft",
  "lang": "pt-BR",
  "updated_at": "2026-03-20T...",
  "sections": [
    { "data_id": "657fba23", "tag": "div", "widget_type": "container", "preview": "Header — hamburger icon, state title", "depth": 0 },
    { "data_id": "a8106cc", "tag": "div", "widget_type": "container", "preview": "Breadcrumb — Noticia / Oportunidade", "depth": 0 },
    { "data_id": "505d58b5", "tag": "div", "widget_type": "container", "preview": "Article title section", "depth": 0 },
    { "data_id": "48bd8e2e", "tag": "div", "widget_type": "container", "preview": "Main article content — text, images, CTAs", "depth": 0, "children": [
      { "data_id": "1a2b3c4d", "tag": "div", "widget_type": "text-editor", "preview": "Lorem ipsum dolor sit amet, consectetur adipi...", "depth": 1 },
      { "data_id": "5e6f7a8b", "tag": "div", "widget_type": "image", "preview": "<img src=\"/assets/product.webp\">", "depth": 1 }
    ]},
    { "data_id": "53ab8a61", "tag": "div", "widget_type": "container", "preview": "Facebook comments section (social proof)", "depth": 0 },
    { "data_id": "f71739a", "tag": "div", "widget_type": "container", "preview": "Footer — copyright, policy links", "depth": 0 }
  ]
}
```

**Estimated tokens:** ~2-3K (vs ~235K today)

**Implementation:** Parse `html_content` with an HTML parser (e.g., `cheerio`). Walk top-level Elementor containers (`[data-element_type]`), extract `data-id`, tag name, `data-widget_type` (stripped of `.default` suffix) or `data-element_type` for containers, and a text preview (first ~80 chars of text content, stripped of tags). Build a tree based on nesting depth. Return metadata from DB columns + the section tree.

**Non-Elementor pages:** If no `[data-element_type]` elements are found, fall back to listing top-level semantic elements (`<section>`, `<header>`, `<footer>`, `<main>`, `<article>`, `<nav>`, or direct children of `<body>`). If no structure is found, return `sections: []` with `"note": "No sections detected — use get_page with include_html=true or edit_page for this page"`.

### Tool 2: `get_section`

**Input:**
- `page_id` (string, required)
- `selector` (string, required) — Elementor `data-id` value or CSS selector
  - If the value matches `/^[a-zA-Z0-9_]+$/` (alphanumeric + underscore only), it is treated as a `data-id` shorthand and expanded to `[data-id="<value>"]`
  - Otherwise, treated as a CSS selector verbatim

**Output:** The outer HTML of the matched element(s).

- When using `data-id` shorthand: returns a single match object. Throws if not found.
- When using CSS selector: returns an array of matches. Throws if none found.

```json
{
  "data_id": "48bd8e2e",
  "outer_html": "<div data-id=\"48bd8e2e\" ...>...</div>"
}
```

**Estimated tokens:** 500-5K depending on section size.

**Implementation:** Load `html_content`, query with cheerio using the selector, return `$.html()` of the matched element(s).

### Tool 3: `edit_section`

Two modes of operation. Does NOT clear `project_data`.

**Input:**
- `page_id` (string, required)
- `selector` (string, required) — same selector logic as `get_section`
- **Mode A — Find/replace** (surgical):
  - `old_string` (string) — exact text to find within the section's HTML
  - `new_string` (string) — replacement text
  - `occurrence` (integer, optional) — which occurrence to replace (1-indexed). Default: `0` meaning "must be unique, throw if multiple matches". Use `1` for first, `2` for second, etc.
- **Mode B — Full replace:**
  - `html` (string) — replaces the entire inner HTML of the matched section

Exactly one mode must be provided (either `old_string`+`new_string` OR `html`). If both are provided, throw an error.

**Behavior:**
1. Load page `html_content` from DB
2. Find the section via selector
3. Apply the edit (find/replace within section, or replace inner HTML)
4. For find/replace: throw if `old_string` is not found. If multiple matches and `occurrence` is `0` (default), throw with count of matches found. If `occurrence` is set, replace only that occurrence.
5. Save updated `html_content` back to DB — **do NOT touch `project_data`**. Update `updated_at = datetime('now')`.
6. Log activity via `logActivity(db, apiKey, 'edit_section', 'page', page_id, page.title, { selector, mode })`
7. Return confirmation with the updated section's outer HTML:
```json
{
  "success": true,
  "data_id": "48bd8e2e",
  "outer_html": "<div data-id=\"48bd8e2e\" ...>updated content...</div>"
}
```

**Estimated tokens:** ~1-3K input.

### Tool 4: `inject_css`

**Input:**
- `page_id` (string, required)
- `css` (string, required) — CSS rules to inject (without `<style>` tags)

**Behavior:**
1. Load page `html_content`
2. Append `<style id="aurion-overrides"><!-- CSS here --></style>` before `</head>`
3. If `<style id="aurion-overrides">` already exists, replace its contents (don't create duplicates)
4. If `</head>` is not found, insert the `<style>` block at the beginning of the content
5. Save `html_content` — **do NOT touch `project_data`**. Update `updated_at = datetime('now')`.
6. Log activity via `logActivity(db, apiKey, 'inject_css', 'page', page_id, page.title, null)`

Users should use `!important` in their rules to override the inlined Elementor CSS.

**Estimated tokens:** ~200-500 input.

### Tool 5: `edit_page` (kept, unchanged)

Remains available for full-page rewrites and restructuring. Same behavior as today — clears `project_data` when `html_content` is provided without `project_data`.

No changes needed.

## Concurrency

`edit_section` and `inject_css` perform read-modify-write on `html_content`. Concurrent calls on the same page can cause lost updates. Wrap the read-modify-write in a SQLite `BEGIN IMMEDIATE` transaction to serialize writes per page.

## Migration

- `get_page` adds `include_html` flag (default `false`). Existing callers that need full HTML can pass `include_html: true`. Default behavior changes from returning HTML to returning section tree — this is intentional to prevent token waste.
- `edit_page` keeps working as-is for backwards compatibility.
- New tools (`get_section`, `edit_section`, `inject_css`) are additive.
- Selector logic: `data-id` shorthand if value matches `/^[a-zA-Z0-9_]+$/`, otherwise CSS selector verbatim.

## Dependencies

- `cheerio` npm package for HTML parsing (lightweight, no browser needed)
- No database schema changes required

## Typical Workflows

### Surgical edit (most common)
```
get_page(id) → see section tree (~2K tokens)
get_section(page_id, "48bd8e2e") → get article content (~3K tokens)
edit_section(page_id, "48bd8e2e", old_string="R$ 199", new_string="R$ 149") → done (~1K tokens)
```
**Total: ~6K tokens vs ~470K+ today**

### Style change
```
get_page(id) → identify target section
inject_css(page_id, ".titulo { color: red !important; }") → done
```
**Total: ~3K tokens**

### Full restructure (rare)
```
get_page(id) → overview
get_section(page_id, "section1") → read section
get_section(page_id, "section2") → read section
edit_page(id, html_content="...full HTML...") → rewrite
```
Same as today, but with better read ergonomics.
