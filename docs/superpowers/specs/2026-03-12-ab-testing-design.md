# A/B Testing (Page Duplication with Variants) — Design Spec

## Goal

Allow users to duplicate pages into variants for manual A/B testing. Each variant is an independent page with its own URL. No automatic traffic splitting — the user controls traffic via ads/links.

## Architecture

### Database Changes

Add two nullable columns to `pages` table:

```sql
ALTER TABLE pages ADD COLUMN variant_group TEXT;
ALTER TABLE pages ADD COLUMN variant_label TEXT;
```

- `variant_group`: Shared identifier linking variants of the same test (e.g., `"porcelana-kit"`). NULL for pages not part of any test.
- `variant_label`: Short label for the variant (e.g., "A", "B", "C"). NULL for non-variant pages.

No new tables needed.

### API

#### `POST /api/pages/:id/duplicate`

**Request body:**
```json
{
  "title": "Porcelana Kit — Variante B",
  "slug": "adv-porcelana-kit-b"
}
```

**Logic:**
1. Fetch source page by `:id`
2. Validate slug uniqueness
3. Determine `variant_group`:
   - If source already has a `variant_group`, reuse it
   - Otherwise, generate one from the source slug (e.g., source slug `adv-porcelana-kit` → group `adv-porcelana-kit`)
4. Update source page to set `variant_group` and `variant_label = "A"` if not already set
5. Determine next `variant_label`: count existing variants in the group, assign next letter (B, C, D...)
6. INSERT new page cloning: `html_content`, `project_data`, `type`, `lang`, `category_id`, `category_config`, `frontmatter` from source
7. New page gets status `draft`, new UUID, the provided title/slug, same `variant_group`, next label

**Response:** `201` with the new page object (including `id` for navigation to editor)

#### Listing filter

Existing `GET /api/pages` gains optional query param `variant_group` to filter pages by group.

### Frontend

#### PagesList — Duplicate button

- Add a `Copy` icon button in the actions column of each page row
- On click: open `DuplicatePageModal` with fields for title and slug
- Slug auto-generated from title (same logic as CreatePageModal)
- On submit: `POST /api/pages/:id/duplicate`, then navigate to `/editor/:newPageId`

#### EditorPage — Duplicate button

- Add "Duplicar" button in the editor toolbar (top bar)
- Same `DuplicatePageModal` component, same flow
- After creation, opens the new page in the editor (navigate or new tab)

#### Variant badges in PagesList

- Pages with `variant_label` show a small colored badge next to the title (e.g., pill with "A", "B")
- Pages with the same `variant_group` are visually linked by matching badge color (derived from group hash)

#### Conversion Boosters page

- Route: `/conversion-boosters` (already exists in App.tsx)
- Shows a list of variant groups (distinct `variant_group` values from pages)
- Each group expandable to show its variants with: title, slug, status, label
- Click on a variant navigates to the editor
- Empty state: "Nenhum teste A/B criado. Duplique uma página para começar."

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `DuplicatePageModal` | `admin/src/components/DuplicatePageModal.tsx` | Modal with title/slug fields for duplication |
| `ConversionBoosters` | `admin/src/pages/ConversionBoosters.tsx` | Page listing variant groups |
| Badge in `PagesList` | Inline in existing component | Shows variant label |
| Button in `EditorPage` | Inline in existing component | Triggers duplication from editor |

### Data Flow

```
User clicks "Duplicar" → DuplicatePageModal → POST /api/pages/:id/duplicate
  → Server clones page, assigns variant_group + label
  → Returns new page
  → Frontend navigates to /editor/:newId
```

### Edge Cases

- **Duplicating a variant**: Works fine — new variant joins the same group with next label
- **Deleting a variant**: Normal page delete. If only one variant remains, it keeps its group/label (no auto-cleanup needed)
- **Duplicate slug**: Server returns 409, modal shows error

### What This Does NOT Include

- Automatic traffic splitting (user manages via ads/links)
- Analytics/metrics comparison (future feature)
- Auto-generated variant slugs (user chooses)
