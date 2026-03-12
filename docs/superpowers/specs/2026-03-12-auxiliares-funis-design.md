# Páginas Auxiliares + Funis de Venda — Design Spec

## Goal

Two new features for branch v1.2.5: (1) Auxiliary pages — a new page type for policies, terms, tracking pages, etc. with parent-child relationships to PVs/advertorials, and (2) Sales Funnels — a visual funnel builder using React Flow that runs on CF Workers with KV-based lead tracking and automatic CTA link rewriting.

---

## Feature 1: Páginas Auxiliares

### Overview

New page type `'auxiliar'` with mandatory primary parent (PV or advertorial) and optional shared links to other pages. Subtypes: Política de Privacidade, Termos de Uso, Rastreio, Contato, Outro (free text). Own sidebar menu cloned from the Advertorial list pattern.

### Database

**New table:**

```sql
CREATE TABLE IF NOT EXISTS page_parents (
  page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  parent_page_id TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  is_primary INTEGER DEFAULT 0,
  PRIMARY KEY (page_id, parent_page_id)
);

CREATE INDEX IF NOT EXISTS idx_page_parents_parent ON page_parents(parent_page_id);
```

- `is_primary = 1` → mandatory primary parent (exactly 1 per auxiliar)
- `is_primary = 0` → shared link (N:N — other PVs/advertorials that use this auxiliar)

**No changes to `pages` table** — auxiliares use existing columns with `type = 'auxiliar'`.

**Frontmatter for auxiliares:**

```json
{
  "auxiliar_type": "politica_privacidade",
  "custom_type": null,
  "description": "SEO description",
  "og_image": "https://..."
}
```

Pre-defined `auxiliar_type` values: `politica_privacidade`, `termos_uso`, `rastreio`, `contato`, `outro`. When `outro`, `custom_type` holds the free-text label.

### API

All endpoints require session authentication (`authMiddleware`).

- `GET /api/pages?type=auxiliar` — list auxiliares. Response includes `parent_pages` array with `{ id, title, slug, is_primary }` for each.
- `POST /api/pages` with `type: 'auxiliar'` — creates auxiliar. Requires `parent_page_id` in body. Creates `page_parents` row with `is_primary = 1`. Validates parent exists and is type `pv` or `advertorial`. **Note:** The type enum in `POST /api/pages` and `PUT /api/pages/:id` Fastify schema validation must be extended from `['pv', 'advertorial']` to `['pv', 'advertorial', 'auxiliar']`.
- `GET /api/pages/:id/auxiliares` — list auxiliares linked to a PV/advertorial (both primary and shared). Returns array of auxiliar pages with `is_primary` flag.
- `PUT /api/pages/:id/parents` — manage shared parents for an auxiliar. Body: `{ add: [page_id, ...], remove: [page_id, ...] }`. Cannot remove the primary parent via this endpoint.
- `PUT /api/pages/:id/primary-parent` — change the primary parent. Body: `{ parent_page_id }`. Validates new parent is PV or advertorial.

### Publish

Auxiliares publish through the same pipeline as other pages.

**Domain resolution chain for auxiliares:** `page_domains` → primary parent's domains → category domains. The `getEffectiveDomains` (in `pages.js`) and `getAssociatedCfDomains` (in `publish.js`) functions must be updated to check `page_parents` when the page type is `auxiliar` and it has no direct `page_domains`. This ensures the auxiliar is always reachable on the same domain as its parent.

### Frontend

**Sidebar:** New item **Auxiliares** (icon: `FileStack` from lucide-react) → `/auxiliares`. Position: after Advertoriais, before Copier.

**Page `/auxiliares`:**
- Cloned from Advertorials pattern — uses `PagesList` with `type="auxiliar"`
- Extra column: "Página Principal" showing primary parent title (clickable link to parent's editor)
- Extra column: "Tipo" showing the auxiliar subtype label
- Filter dropdown for subtype (Todos, Política, Termos, Rastreio, Contato, Outro)

**CreatePageModal adaptations for `type="auxiliar"`:**
- Dropdown: "Tipo de Página Auxiliar" — pre-defined types + "Outro" with text input
- Dropdown: "Página Principal" — searchable select listing all PVs and advertorials
- Title and slug fields (same as existing)
- Language dropdown (same as existing)

**PageSettingsDrawer adaptations:**
- For auxiliar pages: "Página Principal" selector + "Páginas Compartilhadas" multi-select
- For PV/advertorial pages: new collapsible section "Páginas Auxiliares" listing linked auxiliares with "Vincular Auxiliar" button

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Auxiliares` | `admin/src/pages/Auxiliares.tsx` | Auxiliar pages list (cloned from Advertorials) |
| `page-parents.js` | `server/routes/page-parents.js` | Parent relationship API routes |

### MCP Tools

Two new tools added to `mcp-tools.js`:
- `list_auxiliares` — `{ parent_page_id? }` — list auxiliar pages, optionally filtered by parent
- `create_auxiliar` — `{ title, slug, auxiliar_type, parent_page_id, html_content?, custom_type? }` — create auxiliar with parent

---

## Feature 2: Funis de Venda

### Overview

Visual funnel builder using React Flow. Users drag and connect page nodes to define the lead's journey. When activated, the CF Worker serves pages with automatically rewritten CTA links based on the funnel graph. Lead state is tracked via cookies + Cloudflare KV.

### Database

**New tables:**

```sql
CREATE TABLE IF NOT EXISTS funnels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'draft',
  graph_data TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS funnel_domains (
  funnel_id TEXT NOT NULL REFERENCES funnels(id) ON DELETE CASCADE,
  domain_id TEXT NOT NULL REFERENCES domains(id) ON DELETE CASCADE,
  PRIMARY KEY (funnel_id, domain_id)
);
```

- `status`: `draft` (editing), `active` (running on Worker), `paused` (deactivated but preserved)
- `graph_data`: JSON with React Flow's `{ nodes, edges }` structure plus custom node data

### Node Types (v1)

**Entry** (`entry`)
- Exactly 1 per funnel
- Defines the slug/path that activates the funnel
- Props: `entry_slug` (the URL path that triggers this funnel)
- The entry node itself does not serve content — it's a routing trigger. The Worker looks up `_funnels/{entry_slug}.json`, finds the entry node's single outgoing edge, and serves that target page's HTML (with rewrites). Effectively, visiting `entry_slug` renders the first page node in the funnel.
- `entry_slug` must NOT collide with an existing published page slug (validated at activation). The entry slug is a virtual path owned by the funnel.
- Visual: green, Play icon

**Page** (`page`)
- References an Aurion page
- Props: `page_id`, `slug`, `title`, `cta_selector` (optional CSS selector for manual CTA override)
- Visual: blue, FileText icon

**Redirect** (`redirect`)
- Redirects to an external URL
- Props: `url` (the destination), `status_code` (301 or 302, default 302)
- Visual: purple, ExternalLink icon

### Edges

Edges connect nodes directionally (source → target). Each edge represents "after this node, go to target". For page nodes, this means: rewrite CTAs in source page to point to target page's slug.

**v1 constraint:** Page and Entry nodes are limited to exactly 1 outgoing edge (single path). This avoids ambiguity in CTA rewriting — each page has exactly one "next step". Multiple outgoing edges (branching) will be enabled in v2 when decision nodes are added.

Edge props: `label` (optional display label on the canvas).

### Graph Data Schema

```json
{
  "nodes": [
    {
      "id": "node-1",
      "type": "entry",
      "position": { "x": 0, "y": 0 },
      "data": { "entry_slug": "oferta-bf" }
    },
    {
      "id": "node-2",
      "type": "page",
      "position": { "x": 300, "y": 0 },
      "data": { "page_id": "uuid", "slug": "adv-porcelana", "title": "Advertorial Porcelana", "cta_selector": null }
    },
    {
      "id": "node-3",
      "type": "page",
      "position": { "x": 600, "y": 0 },
      "data": { "page_id": "uuid", "slug": "pv-porcelana-kit", "title": "PV Porcelana Kit", "cta_selector": "a.buy-button" }
    },
    {
      "id": "node-4",
      "type": "redirect",
      "position": { "x": 900, "y": 0 },
      "data": { "url": "https://checkout.com/porcelana", "status_code": 302 }
    }
  ],
  "edges": [
    { "id": "e1-2", "source": "node-1", "target": "node-2" },
    { "id": "e2-3", "source": "node-2", "target": "node-3" },
    { "id": "e3-4", "source": "node-3", "target": "node-4" }
  ]
}
```

### CTA Link Rewriting

The core feature. When the Worker serves a page that's part of an active funnel, it rewrites links before responding.

**Two-layer approach:**

1. **Auto-detect (default):** The Worker scans the HTML for `<a href="...">` tags. Any href pointing to a slug that exists as a page node in the funnel gets rewritten to the correct next-step slug. Example: if page A has `<a href="/adv-porcelana">` and the funnel says A → B (slug `pv-porcelana-kit`), that link is rewritten to `/pv-porcelana-kit`.

2. **Manual CSS selector override:** If the node has `cta_selector` set (e.g., `a.cta-button`, `#buy-now`), only elements matching that selector get their href rewritten to the next node's slug/URL. This takes precedence over auto-detect for that node.

**Rewrite rules compiled at activation:**

When a funnel is activated, the system compiles a rewrite map per page:

```json
{
  "adv-porcelana": {
    "auto_rewrites": {
      "/pv-porcelana-kit": "/pv-porcelana-kit"
    },
    "selector_rewrites": [],
    "next_slug": "/pv-porcelana-kit"
  },
  "pv-porcelana-kit": {
    "auto_rewrites": {},
    "selector_rewrites": [
      { "selector": "a.buy-button", "href": "https://checkout.com/porcelana" }
    ],
    "next_slug": "https://checkout.com/porcelana"
  }
}
```

**Worker rewrite implementation:**

For auto-detect: simple string replacement on the HTML response — find all `href="/old-slug"` and replace with `href="/new-slug"`. Fast, no DOM parsing needed.

For CSS selector overrides: the Worker uses Cloudflare's native **HTMLRewriter API** — a streaming HTML parser built into Workers. This is far more reliable than regex for matching selectors. HTMLRewriter supports CSS selector syntax natively (e.g., `a.cta-button`, `a#buy-now`, `a[data-action="checkout"]`), handles attribute quoting and whitespace correctly, and streams the response without buffering the entire HTML.

```js
// Worker example using HTMLRewriter
function applyRewrites(response, pageConfig) {
  let rewriter = new HTMLRewriter();

  // Selector-based rewrites take priority
  for (const rule of pageConfig.rewrites.selectors) {
    rewriter = rewriter.on(rule.pattern, {
      element(el) { el.setAttribute('href', rule.href); }
    });
  }

  // Auto rewrites for internal slug links
  for (const [oldHref, newHref] of Object.entries(pageConfig.rewrites.auto)) {
    rewriter = rewriter.on(`a[href="${oldHref}"], a[href="/${oldHref}"]`, {
      element(el) { el.setAttribute('href', newHref); }
    });
  }

  return rewriter.transform(response);
}
```

### KV-Based Lead Tracking

**Cookie:** Worker sets `_aur_sid` cookie (httpOnly, secure, SameSite=Lax) on first funnel hit. Value: random session ID (UUID v4). The cookie is funnel-agnostic — a single session ID tracks the lead across all funnels. KV keys include the funnel_id for per-funnel state. If a lead enters a second funnel, a new KV entry is created with the same session ID but different funnel_id.

**KV key:** `funnel:{funnel_id}:{session_id}`

**KV value:**
```json
{
  "funnel_id": "funnel-uuid",
  "visited": ["node-2", "node-3"],
  "tags": [],
  "first_seen": "2026-03-12T14:30:00Z",
  "last_seen": "2026-03-12T14:35:00Z"
}
```

**KV TTL:** 30 days (configurable per funnel). After TTL, lead state is purged automatically by KV.

**Usage in v1:** The `visited` array tracks which pages the lead has seen. This is stored for future use (funnel_step conditions in v2). In v1, the Worker writes state but doesn't read it for decision-making — it always follows the graph edges.

### KV Namespace Setup

New field on `cloudflare_accounts` table:

```sql
ALTER TABLE cloudflare_accounts ADD COLUMN kv_namespace_id TEXT;
```

- Added via migration in `server/db/index.js`
- User configures at Integrações > Cloudflare
- If not set, funnels still work for link rewriting but without lead tracking (cookie set but no KV writes)
- Worker template updated: KV binding added when `kv_namespace_id` is present

### Compiled Funnel JSON (R2)

When activated, the funnel compiles to `_funnels/{entry_slug}.json` uploaded to R2:

```json
{
  "funnel_id": "funnel-uuid",
  "status": "active",
  "entry_slug": "oferta-bf",
  "kv_ttl_days": 30,
  "pages": {
    "oferta-bf": {
      "page_slug": "adv-porcelana",
      "serve_slug": "adv-porcelana",
      "rewrites": {
        "auto": { "/pv-porcelana-kit": "/pv-porcelana-kit" },
        "selectors": []
      }
    },
    "adv-porcelana": {
      "page_slug": "adv-porcelana",
      "serve_slug": "adv-porcelana",
      "rewrites": {
        "auto": {},
        "selectors": [{ "pattern": "a.buy-button", "href": "/pv-porcelana-kit" }]
      }
    },
    "pv-porcelana-kit": {
      "page_slug": "pv-porcelana-kit",
      "serve_slug": "pv-porcelana-kit",
      "rewrites": {
        "auto": {},
        "selectors": [{ "pattern": "a.buy-button", "href": "https://checkout.com/porcelana" }]
      }
    }
  },
  "redirects": {
    "node-4": { "url": "https://checkout.com/porcelana", "status_code": 302 }
  }
}
```

### Funnel Activation — R2 Upload

When `POST /api/funnels/:id/activate` is called:
1. Validate graph (exactly 1 entry, all pages exist, no cycles, no orphans, single outgoing edge per page/entry, entry_slug not used by another active funnel, entry_slug does not collide with an existing published page slug)
2. Compile `graph_data` into `_funnels/{entry_slug}.json` via `funnel-compiler.js`
3. Iterate over `funnel_domains`, fetch each domain's Cloudflare account (via `cloudflare_account_id`) and R2 bucket — same pattern as `getAssociatedCfDomains` in `publish.js`
4. Upload compiled JSON to each domain's R2 bucket at `_funnels/{entry_slug}.json`
5. Set funnel status = `active`

On `POST /api/funnels/:id/deactivate`: iterate same domains, delete `_funnels/{entry_slug}.json` from each R2 bucket, set status = `paused`.

On `PUT /api/funnels/:id/domains` while funnel is active: remove from old domains' R2, upload to new domains' R2 (re-deploy).

### Worker Template Changes

The Worker gains funnel logic. The funnel JSON lookup uses R2 with `_funnels/` prefix — this is a fast key lookup, not a scan. Since R2 returns null for non-existent keys (no error), the overhead for non-funnel pages is a single R2 GET that returns null, which is negligible.

Order of checks:

```
Request hits Worker
  1. Check _funnels/{slug}.json from R2 (fast null return for non-funnel pages)
  2. If funnel active:
     a. Read/create _aur_fid cookie
     b. Look up page config in funnel.pages[slug]
     c. If redirect node → Response.redirect(url, status_code)
     d. If page node:
        - Fetch HTML from R2 (normal page)
        - Apply auto rewrites (string replace on href values)
        - Apply selector rewrites (regex-based href replacement)
        - Write lead state to KV (if KV binding available)
        - Set _aur_fid cookie on response
        - Return modified HTML
  3. No funnel → continue to cloaker check → normal page serving
```

**Funnel takes priority over cloaker.** If a page is both in a funnel and has cloaker rules, the funnel handles serving (cloaker rules are skipped for funnel pages — the funnel IS the traffic control).

### API

All endpoints require session authentication.

- `GET /api/funnels` — list all funnels with status, domain count, node count
- `POST /api/funnels` — create funnel `{ name, description? }`
- `GET /api/funnels/:id` — full funnel with graph_data and associated domains
- `PUT /api/funnels/:id` — update name, description, graph_data
- `POST /api/funnels/:id/activate` — validate graph, compile JSON, upload to R2, set status = active
  - Validation: exactly 1 entry node, all page nodes reference existing pages, no orphan nodes, single outgoing edge per page/entry node, no cycles, entry_slug not conflicting with another active funnel, entry_slug not colliding with existing published page slug. If no KV namespace configured on associated CF accounts, show warning but allow activation (link rewriting works, tracking skipped).
- `POST /api/funnels/:id/deactivate` — delete from R2, set status = paused
- `DELETE /api/funnels/:id` — deactivate if active, then delete from DB
- `PUT /api/funnels/:id/domains` — `{ domain_ids: [...] }` — set associated domains
- `POST /api/funnels/:id/duplicate` — clone funnel with name "Copy of {name}", status = draft

### Frontend

**Sidebar:** New item **Funis de Venda** (icon: `GitBranch` from lucide-react) → `/funis`. Position: after Conversion Boosters, before Script Maker.

**Funnel List (`/funis`):**
- Cards grid (similar to Script Maker)
- Each card: funnel name, status badge (draft=gray, active=green, paused=yellow), page count, domain badges, created date
- Actions per card: Edit, Duplicate, Activate/Pause toggle, Delete
- "Novo Funil" button → creates draft, navigates to editor

**Funnel Editor (`/funis/:id`):**
- Full-screen layout (like EditorPage, outside AdminLayout)
- Three panels:

**Left Panel — Node Palette:**
- Draggable node types: Entrada, Página, Redirect
- Each with icon, label, short description
- Drag to canvas to add

**Center — React Flow Canvas:**
- Drag & drop nodes
- Connect nodes by dragging from handle to handle
- Zoom, pan, minimap (bottom-right)
- Snap to grid
- Delete node/edge via backspace or context menu
- Node shapes: Entry (rounded green), Page (rounded blue), Redirect (rounded purple)

**Right Panel — Node Properties (appears when node selected):**
- **Entry node:** Entry slug input
- **Page node:**
  - Page selector (searchable dropdown of all Aurion pages)
  - Shows page title, slug, status, type
  - "Seletor CSS do CTA" input (optional) with placeholder `ex: a.cta-button, #buy-now`
  - Preview of which links will be rewritten (based on connected edges)
- **Redirect node:**
  - URL input
  - Status code select (301/302)

**Top Toolbar:**
- Back button (← Voltar) → `/funis`
- Funnel name (editable inline)
- Domain selector (multi-select dropdown)
- Save button
- Activate/Deactivate button (with confirmation modal for activate)
- Status badge

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Funnels` | `admin/src/pages/Funnels.tsx` | Funnel list page |
| `FunnelEditor` | `admin/src/pages/FunnelEditor.tsx` | Full-screen funnel editor |
| `FunnelCanvas` | `admin/src/components/funnel/FunnelCanvas.tsx` | React Flow canvas setup |
| `NodePalette` | `admin/src/components/funnel/NodePalette.tsx` | Draggable node types panel |
| `NodeProperties` | `admin/src/components/funnel/NodeProperties.tsx` | Right panel property editor |
| `EntryNode` | `admin/src/components/funnel/nodes/EntryNode.tsx` | Custom Entry node component |
| `PageNode` | `admin/src/components/funnel/nodes/PageNode.tsx` | Custom Page node component |
| `RedirectNode` | `admin/src/components/funnel/nodes/RedirectNode.tsx` | Custom Redirect node component |
| `funnels.js` | `server/routes/funnels.js` | Funnel CRUD + activate/deactivate API |
| `funnel-compiler.js` | `server/lib/funnel-compiler.js` | Compiles graph_data → R2 JSON |

### MCP Tools

Two new tools added to `mcp-tools.js`:
- `list_funnels` — `{ status? }` — list funnels with optional status filter
- `get_funnel` — `{ id }` — get funnel details including graph_data
- `create_funnel` — `{ name, description? }` — create a new draft funnel
- `activate_funnel` — `{ id }` — activate a funnel (validate + deploy to R2)
- `deactivate_funnel` — `{ id }` — deactivate a funnel

### Sidebar (Updated)

```
Dashboard
Páginas de Venda
Advertoriais
Auxiliares              ← NEW
Copier
Recursos (dropdown)
Teste A/B
Conversion Boosters
Funis de Venda          ← NEW
Script Maker
Healthcheck
Claude
Traduções
Integrações (dropdown)
```

### Data Flow

```
Auxiliares:
  User creates auxiliar page → selects parent (PV/advertorial) + type
    → Page created with type='auxiliar'
    → page_parents row with is_primary=1
    → Can share with other pages via PUT /pages/:id/parents
    → Publishes same as any page, inherits parent's domains

Funis de Venda:
  User creates funnel → opens editor
    → Drags Entry node, sets entry_slug
    → Drags Page nodes, selects Aurion pages
    → Drags Redirect node for final checkout URL
    → Connects nodes with edges (Entry → Page A → Page B → Redirect)
    → Optionally sets cta_selector on page nodes
    → Saves (graph_data persisted)
    → Associates domains
    → Clicks "Ativar":
      → Server validates graph
      → Compiles _funnels/{entry_slug}.json
      → Uploads to R2 for each associated domain
      → Status = active

  Lead visits entry_slug on domain:
    → Worker reads _funnels/{entry_slug}.json
    → Sets/reads _aur_fid cookie
    → Serves page A HTML with rewritten CTAs → links point to page B
    → Lead clicks CTA → arrives at page B
    → Worker serves page B with rewritten CTAs → links point to checkout
    → Lead clicks CTA → Worker redirects to checkout URL
    → Lead state tracked in KV throughout
```

### Migration Strategy

- `page_parents`, `funnels`, `funnel_domains` tables: add as `CREATE TABLE IF NOT EXISTS` in `server/db/schema.sql`
- `ALTER TABLE cloudflare_accounts ADD COLUMN kv_namespace_id TEXT`: add as conditional migration in `server/db/index.js` `initSchema()` (same pattern as existing `project_data`, `source_page_id` migrations)
- `PUT /api/funnels/:id` must manually set `updated_at = datetime('now')` in the UPDATE statement (SQLite default only applies on INSERT, following existing `pages` route pattern)

### Dependencies

- `@xyflow/react` (React Flow v12) — added to admin/package.json
- Cloudflare KV namespace — optional, configured per account

### Edge Cases

- **Entry slug conflicts:** Two active funnels cannot share the same entry slug. Activation validates this. Additionally, entry_slug must not collide with an existing published page slug (would silently take over that page's URL).
- **Domain changes while active:** Changing funnel domains via `PUT /api/funnels/:id/domains` while active triggers re-deployment: removes `_funnels/` JSON from removed domains' R2, uploads to added domains' R2.
- **Page in multiple funnels:** A page can appear in multiple funnels. Each funnel compiles its own rewrite rules independently. The entry_slug determines which funnel is active for a given request.
- **Page unpublished while funnel active:** Worker tries to fetch HTML from R2, gets 404. Returns 404 to visitor. Funnel remains active (admin should deactivate or fix).
- **Funnel page edited:** HTML changes are picked up on next publish. CTA rewrites still apply based on compiled rules. No need to re-activate funnel.
- **No KV namespace configured:** Funnel link rewriting still works. Lead tracking silently skipped (cookie set but no KV writes). Warning shown in UI when activating.
- **Circular references in graph:** Activation rejects graphs with cycles (entry must have a path to a terminal node — redirect or page with no outgoing edges).
- **Domain without Cloudflare:** Funnels only work on CF domains (Worker required). UI shows warning if funnel has non-CF domains.

### What This Does NOT Include

- Decision nodes (country, device, A/B split) — v2
- Action nodes (delay, pixel fire, tag lead) — v2
- Funnel analytics (conversion rates, drop-off) — v2
- Lead identification (email, phone) — v2
- Auto-creating pages from funnel editor — pages must exist first
- Funnel templates/presets
