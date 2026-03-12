# Translations — Design Spec

## Goal

Allow users to translate pages via AI (Google Translate or OpenAI/Claude) as a starting point, then refine in GrapesJS. Translated pages live in a dedicated Translations section, organized by language or by source page (toggle view).

## Architecture

### Database Changes

**New tables:**

```sql
CREATE TABLE IF NOT EXISTS languages (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,        -- "en-US", "es-ES", "fr-FR"
  name TEXT NOT NULL,               -- "English (US)", "Español"
  flag TEXT,                        -- "🇺🇸", "🇪🇸"
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS translation_providers (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,           -- 'google' | 'openai'
  api_key TEXT NOT NULL,
  model TEXT,                       -- for openai: 'gpt-4o-mini', 'claude-sonnet-4-20250514', etc.
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**New column on `pages`:**

```sql
ALTER TABLE pages ADD COLUMN source_page_id TEXT REFERENCES pages(id) ON DELETE SET NULL;
```

- `source_page_id`: NULL for original pages, references the original page ID for translations.
- `lang`: Already exists on pages. Used to identify the target language of the translation.

### Translation Engine

**Server-side translation flow:**

1. Load source page HTML
2. Parse with Cheerio — extract all visible text nodes
3. Batch text for translation API call
4. Translate via selected provider (Google Translate or OpenAI/Claude)
5. Reinsert translated text into the HTML, preserving all tags, classes, attributes, structure
6. Return translated HTML as a new draft page

**Google Translate provider:**
- Uses Google Cloud Translation API v2
- Simple text-in/text-out
- Requires API key

**OpenAI/Claude provider:**
- Sends HTML segments with instruction to translate while preserving HTML structure
- Can handle context better (idiomatic translations)
- Requires API key + model selection

### API

#### Languages CRUD

- `GET /api/languages` — list all languages
- `POST /api/languages` — create `{ code, name, flag }`
- `PUT /api/languages/:id` — update
- `DELETE /api/languages/:id` — delete (fails if translations exist for this language)

#### Translation Providers CRUD

- `GET /api/translation-providers` — list providers (API key masked in response)
- `POST /api/translation-providers` — create `{ provider, api_key, model? }`
- `PUT /api/translation-providers/:id` — update
- `DELETE /api/translation-providers/:id` — delete

#### Translate Page

`POST /api/pages/:id/translate`

**Request:**
```json
{
  "target_lang": "en-US",
  "provider_id": "uuid-of-provider"
}
```

**Logic:**
1. Fetch source page
2. Check if translation already exists for this source + target_lang (return 409 if so)
3. Fetch provider config
4. Extract text from HTML, translate via provider
5. Create new page:
   - `source_page_id` = source page ID
   - `lang` = target_lang
   - `title` = translated title (or original + language suffix)
   - `slug` = `{source_slug}-{lang_code}` (e.g., `adv-porcelana-kit-en`)
   - `html_content` = translated HTML
   - `type`, `category_id`, `category_config`, `frontmatter` cloned from source
   - `status` = 'draft'
6. Return 201 with new page

#### List Translations

`GET /api/translations` — returns all pages where `source_page_id IS NOT NULL`, with source page info joined.

Query params:
- `group_by=lang` — group results by language
- `group_by=source` — group results by source page
- `lang=en-US` — filter by language

### Frontend

#### TranslatePageModal

- Props: `open`, `onClose`, `pageId`, `pageTitle`
- Dropdown to select target language (from `/api/languages`)
- Dropdown to select provider (from `/api/translation-providers`)
- Submit button with loading state (translation can take a few seconds)
- On success: navigate to `/editor/${newPage.id}`
- Error handling: 409 (translation exists), provider errors

#### Translations Page (`/traducoes`)

- Toggle button: "Por Idioma" | "Por Página Original"
- **By Language view:** Expandable cards per language (flag + name + count), inside each card a list of translated pages with title, slug, status, link to editor
- **By Source view:** Expandable cards per source page (title + translation count), inside each card a list of translations with language flag, title, status, link to editor
- Empty state: "Nenhuma tradução criada. Traduza uma página para começar."

#### Buttons

- PagesList: "Traduzir" button (Languages icon) in actions column
- EditorPage: "Traduzir" button in toolbar

#### Resources Pages

- `/recursos/idiomas` — Languages CRUD (code, name, flag)
- `/recursos/provedores` — Translation Providers CRUD (provider type, API key masked, model)

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `TranslatePageModal` | `admin/src/components/TranslatePageModal.tsx` | Modal to select language + provider |
| `Translations` | `admin/src/pages/Translations.tsx` | Main translations listing page |
| `Languages` | `admin/src/pages/resources/Languages.tsx` | Language CRUD |
| `TranslationProviders` | `admin/src/pages/resources/TranslationProviders.tsx` | Provider CRUD |

### Data Flow

```
User clicks "Traduzir" → TranslatePageModal → selects lang + provider
  → POST /api/pages/:id/translate
  → Server extracts text, calls translation API, rebuilds HTML
  → Creates new draft page with source_page_id set
  → Frontend navigates to /editor/:newId
  → User refines translation in GrapesJS
```

### Edge Cases

- **Re-translating:** If translation already exists for source + lang, return 409. User should edit existing translation.
- **Source page deleted:** `source_page_id` becomes NULL (ON DELETE SET NULL). Translation page still exists as standalone.
- **Provider API failure:** Return 422 with provider error message.
- **Large pages:** Batch text in chunks to stay within API limits.
- **HTML structure preservation:** Only translate text nodes, never touch attributes, class names, URLs.

### What This Does NOT Include

- Auto-sync when source page changes (manual re-translation only)
- Translation memory / glossary
- Inline diff between source and translation
