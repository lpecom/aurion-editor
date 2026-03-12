# Domain Healthcheck + Claude Integration — Design Spec

## Goal

Two new sidebar sections: (1) Domain Healthcheck for monitoring domain HTTP status, and (2) Claude Integration via embedded MCP server for programmatic control of Aurion from Claude Code instances, with activity logging per nickname.

---

## Feature 1: Domain Healthcheck

### Overview

Page at `/healthcheck` showing all domains with active HTTP health checks. Server-side fetch with timeout, returns online/offline/slow status with response time. Manual check per domain or all at once.

### API

Healthcheck endpoints require session authentication (same `authMiddleware` as other admin routes).

- `POST /api/domains/:id/healthcheck` — checks a single domain
  - Server fetches the domain with 10s timeout. Tries HTTPS first; if SSL fails (e.g., `ssl_status = 'pending'`), falls back to HTTP.
  - Returns `{ status, response_time_ms, http_status, checked_at }`
  - Status rules:
    - `online`: HTTP 2xx in < 3000ms
    - `slow`: HTTP 2xx in >= 3000ms
    - `offline`: error, timeout, or non-2xx status
- `POST /api/domains/healthcheck-all` — checks all domains, returns array of results

### Database

No new tables. Results are transient — displayed in the frontend from the last check in the current session. No persisted history.

### Frontend (`/healthcheck`)

- Table with columns: Domain, Worker Status (shown if column exists from Cloudflare hosting feature), HTTP Status, Response Time, Status Badge, Check Button
- Global "Checar Todos" button in header with loading state
- Status badges: green (online), yellow (slow), red (offline), gray (not checked)
- Each row shows results from last check or "Nao verificado" if not checked yet

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Healthcheck` | `admin/src/pages/Healthcheck.tsx` | Main healthcheck page |

---

## Feature 2: Claude Integration (MCP Server)

### Overview

Aurion embeds an MCP server in the existing Fastify process. Claude Code connects via URL + API key. Each API key has a **nickname** identifying the Claude instance. All actions are logged to an activity timeline.

### Database

**New tables:**

```sql
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  api_key TEXT NOT NULL UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  api_key_id TEXT REFERENCES api_keys(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  resource_name TEXT,
  details TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_log_created_at ON activity_log(created_at);
```

### API Key Management

- `GET /api/api-keys` — list all (api_key masked, last 8 chars visible)
- `POST /api/api-keys` — create `{ nickname }`, generates key as `aur_` + 32 random hex chars (64+4 = 68 chars total). Returns full key (only time it's visible)
- `DELETE /api/api-keys/:id` — revoke key

### MCP Server

Embedded in Fastify at `/mcp`. Authentication via `Authorization: Bearer {api_key}` header.

**Tools exposed:**

| Tool | Params | Description |
|------|--------|-------------|
| `list_pages` | `type?`, `status?`, `lang?` | List pages with optional filters |
| `get_page` | `id` or `slug` | Get page details |
| `create_page` | `title`, `slug`, `type`, `html_content?`, `lang?` | Create a new page |
| `edit_page` | `id`, fields to update | Edit page fields |
| `publish_page` | `id` | Publish a page |
| `unpublish_page` | `id` | Unpublish a page |
| `delete_page` | `id` | Delete a page |
| `clone_page` | `url`, `title`, `slug`, `type` | Clone external page via scraper |
| `list_scripts` | — | List all scripts |
| `create_script` | `name`, `position`, `code` | Create a script |
| `edit_script` | `id`, fields to update | Edit a script |
| `delete_script` | `id` | Delete a script |
| `list_pixels` | — | List all pixels |
| `list_domains` | — | List all domains |
| `list_images` | — | List all images |
| `upload_image` | `base64`, `filename` | Upload an image |

### Activity Logging

Every MCP tool call is automatically logged to `activity_log`:
- `nickname`: from the API key used
- `action`: tool name (e.g., `create_page`, `publish_page`, `clone_page`)
- `resource_type`: inferred from tool (e.g., `page`, `script`, `pixel`)
- `resource_id`: ID of the affected resource
- `resource_name`: human-readable name (page title, script name, etc.)
- `details`: JSON with extra context (e.g., `{ "url": "https://..." }` for clone_page, `{ "slug": "oferta-x" }` for create_page)

### MCP Implementation

The MCP server follows the Model Context Protocol specification:
- Handles `initialize`, `tools/list`, `tools/call` methods
- Streamable HTTP transport: single `POST /mcp` endpoint accepting JSON-RPC requests, returning JSON-RPC responses. Supports optional SSE upgrade via `Accept: text/event-stream` header.
- Each tool call resolves the API key from the Authorization header, executes the operation using existing server logic (same functions as the REST routes), and logs the activity

### Clone Page Tool

`clone_page` reuses the full Copier pipeline from `server/routes/copier.js`:
1. `scrapeUrl(url)` — fetch HTML from URL
2. Create a new page with the scraped HTML (`project_data` = null, populated on first editor save)
3. Log: `"{nickname} clonou página {title} (de {url})"`

Note: MCP-created pages via `create_page` also have `project_data = null`. GrapesJS populates it on first editor save, consistent with the Copier flow.

### Frontend — Claude Page (`/claude`)

**Tab: FAQ**
- Static content with setup instructions and SOPs
- Sections:
  - "Como conectar o Claude Code ao Aurion" — MCP config example
  - "Como criar uma página via Claude" — example prompts
  - "Como clonar uma página" — example prompts
  - "Como publicar uma página" — example prompts
- Each section shows the MCP config JSON and example user prompts

**Tab: Status**
- API Keys table: nickname, masked key (last 8 chars), created date, revoke button
- "Nova API Key" button → modal with nickname input → shows generated key once
- Activity timeline: chronological list of recent actions
  - Format: `{nickname} {action_label} {resource_name}` with relative timestamp
  - Examples:
    - "kaka criou página Oferta Black Friday" — 2 min atrás
    - "kaka publicou página adv-porcelana-kit" — 5 min atrás
    - "kaka clonou página Oferta Especial (de https://exemplo.com)" — 10 min atrás
    - "kaka editou script Anti-Cópia" — 1h atrás
  - Pagination or "Carregar mais" for older entries

### API for Activity Log

- `GET /api/activity-log?limit=50&offset=0` — paginated activity log
- Returns: `{ items: [...], total: number }`

### Token Efficiency

- MCP tools are declared once during handshake — no SOP documents needed in context
- Claude "sees" tools automatically without reading documentation
- API responses are compact JSON
- `resource_name` stored in log avoids extra lookups for display
- Activity log query is paginated to avoid large payloads

### Sidebar

Two new items added to sidebar:
- **Healthcheck** (icon: `Activity` from lucide-react) → `/healthcheck`
- **Claude** (icon: `Bot` from lucide-react) → `/claude`

Position: after Script Maker, before Traduções.

### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `Healthcheck` | `admin/src/pages/Healthcheck.tsx` | Domain healthcheck dashboard |
| `Claude` | `admin/src/pages/Claude.tsx` | Claude integration page (FAQ + Status tabs) |
| `ApiKeyModal` | `admin/src/components/ApiKeyModal.tsx` | Modal for creating new API key |
| `healthcheck.js` | `server/routes/healthcheck.js` | Healthcheck API routes |
| `api-keys.js` | `server/routes/api-keys.js` | API key CRUD routes |
| `activity-log.js` | `server/routes/activity-log.js` | Activity log query route |
| `mcp.js` | `server/routes/mcp.js` | MCP server endpoints |
| `mcp-tools.js` | `server/lib/mcp-tools.js` | MCP tool definitions and handlers |
| `mcp-auth.js` | `server/middleware/mcp-auth.js` | API key authentication middleware for MCP |

### Data Flow

```
Setup:
  User creates API key (nickname: "kaka") in /claude → Status tab
  User adds MCP config to Claude Code: { url, api_key }

Usage:
  User tells Claude: "Cria uma página de venda com título X"
  Claude Code → MCP tool call: create_page({ title, slug, type, html_content })
  Aurion MCP handler:
    → Validates API key → resolves nickname
    → Creates page (same logic as POST /api/pages)
    → Logs to activity_log: { nickname: "kaka", action: "create_page", resource_name: "X" }
    → Returns result to Claude

  User tells Claude: "Clona https://exemplo.com como advertorial"
  Claude Code → MCP tool call: clone_page({ url, title, slug, type })
  Aurion MCP handler:
    → scrapeUrl(url)
    → Creates page with scraped HTML
    → Logs: { nickname: "kaka", action: "clone_page", details: { url } }

Viewing:
  User opens /claude → Status tab
  → Sees API keys table
  → Sees activity timeline: "kaka criou página X", "kaka clonou página Y"
```

### Edge Cases

- **Invalid API key:** Returns 401 on MCP calls
- **Revoked API key:** Existing Claude Code sessions fail on next call. Activity logs preserved (`ON DELETE SET NULL` on `api_key_id`, `nickname` stored directly in log rows).
- **scrapeUrl fails in clone_page:** Returns error to Claude, logged with error details
- **Concurrent Claude instances:** Each has its own API key/nickname, all logged independently
- **Large activity log:** Paginated query, frontend loads 50 at a time

### What This Does NOT Include

- Automatic periodic healthchecks (manual only)
- Healthcheck history/graphs
- MCP streaming responses
- Webhook notifications for activity
- Rate limiting on MCP calls (can add later)
- Human actions in activity log (Claude/MCP only)
