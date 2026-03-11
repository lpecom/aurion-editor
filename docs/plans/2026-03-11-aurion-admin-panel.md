# Aurion Editor — Admin Panel & Framework Evolution

**Data:** 2026-03-11
**Status:** Draft
**Repo:** github.com/lpecom/aurion-editor

---

## Visão Geral

Painel administrativo SaaS-style para gerenciar páginas de venda e advertoriais, com editor visual HTML embutido (GrapesJS Studio SDK), construído sobre o framework StaticFlow CMS existente. Autenticação single-user na v1.

---

## Design System

| Token | Valor |
|-------|-------|
| **Background** | `#020617` (slate-950) |
| **Surface** | `#0F172A` (slate-900) |
| **Surface-2** | `#1E293B` (slate-800) |
| **Border** | `#334155` (slate-700) |
| **Text** | `#F8FAFC` (slate-50) |
| **Text Muted** | `#94A3B8` (slate-400) |
| **CTA/Primary** | `#22C55E` (green-500) |
| **Accent** | `#3B82F6` (blue-500) |
| **Danger** | `#EF4444` (red-500) |
| **Warning** | `#F59E0B` (amber-500) |
| **Font Heading** | Fira Sans (500, 600, 700) |
| **Font Body** | Fira Sans (300, 400, 500) |
| **Font Mono** | Fira Code (400, 500) |
| **Radius** | 8px (cards), 6px (inputs), 12px (modals) |
| **Sidebar Width** | 260px collapsed-icon: 64px |
| **Icons** | Lucide React |

---

## Arquitetura Geral

```
aurion-editor/
├── admin/                    ← React app (Vite + React + Tailwind)
│   ├── src/
│   │   ├── components/       ← UI components (sidebar, tables, modals)
│   │   ├── pages/            ← Rotas do admin (Dashboard, PVs, Advs, Recursos...)
│   │   ├── editor/           ← Integração GrapesJS Studio SDK
│   │   ├── api/              ← API client (fetch wrapper)
│   │   ├── auth/             ← Auth context + guard
│   │   ├── hooks/            ← Custom hooks
│   │   ├── lib/              ← Utils, constants
│   │   └── App.tsx
│   └── vite.config.ts
│
├── server/                   ← Backend Node.js (Fastify)
│   ├── routes/               ← API routes
│   ├── services/             ← Business logic
│   ├── middleware/            ← Auth, error handling
│   ├── db/                   ← SQLite via better-sqlite3 (arquivo local)
│   └── server.js             ← Entry point
│
├── lib/                      ← Framework StaticFlow (existente, evoluído)
├── build.js                  ← Build pipeline (existente, evoluído)
├── bin/                      ← CLI (existente, evoluído)
├── pages/                    ← Páginas geradas (output do admin)
├── partials/                 ← Partials (gerenciados pelo admin)
├── assets/                   ← Assets (upload via admin)
├── css/                      ← CSS (gerenciados pelo admin)
├── dist/                     ← Build output (gerado)
└── config.json               ← Config do site
```

**Decisão: GrapesJS Studio SDK**
- SDK embutido, sem iframe, sem dependência externa
- Licença gratuita em localhost (dev sem restrição)
- React component nativo (`@grapesjs/studio-sdk/react`)
- Output: HTML puro — integra 100% com o StaticFlow
- Plugins extensíveis para blocos customizados (PV/Advertorial)

**Decisão: SQLite (better-sqlite3)**
- Zero infraestrutura — arquivo local `.db`
- Perfeito para single-user
- Armazena metadados de páginas, configs, recursos
- As páginas HTML em si continuam como arquivos no filesystem

**Decisão: Fastify**
- Performance superior ao Express
- Schema validation nativo
- Plugin ecosystem maduro
- ESM nativo

---

## Mapa de Times de Agentes

```
┌─────────────────────────────────────────────────────────┐
│                    TEAM 1: FOUNDATION                    │
│  Backend Core + DB + Auth + Framework Evolution          │
│  (Sem dependência de outros times)                       │
└──────────────────────┬──────────────────────────────────┘
                       │ API pronta
        ┌──────────────┼──────────────────┐
        ▼              ▼                  ▼
┌───────────────┐ ┌───────────┐ ┌─────────────────┐
│  TEAM 2: UI   │ │ TEAM 3:   │ │  TEAM 4:        │
│  Admin Shell  │ │ EDITOR    │ │  RESOURCES      │
│  + Pages CRUD │ │ GrapesJS  │ │  Imgs/Pixels/   │
│               │ │ Studio    │ │  Domínios/Scripts│
└───────┬───────┘ └─────┬─────┘ └────────┬────────┘
        │               │                │
        ▼               ▼                ▼
┌─────────────────────────────────────────────────────────┐
│                 TEAM 5: INTEGRATION                      │
│  Conectar tudo + Build pipeline + Deploy + Polish        │
└─────────────────────────────────────────────────────────┘
```

---

# TODOs POR TIME

---

## TEAM 1 — FOUNDATION (Backend + Auth + Framework Evolution)

> **Pré-requisito de todos os outros times.** Deve rodar primeiro.

### T1.1 — Setup do Backend (Fastify + SQLite)

- [ ] Criar `server/` com estrutura de pastas
- [ ] Instalar dependências: `fastify`, `@fastify/static`, `@fastify/cors`, `@fastify/cookie`, `better-sqlite3`
- [ ] Criar `server/server.js` — entry point Fastify
- [ ] Criar `server/db/schema.sql` — schema SQLite:
  ```sql
  -- Páginas (PVs e Advertoriais)
  CREATE TABLE pages (
    id TEXT PRIMARY KEY,          -- uuid
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,    -- path da página
    type TEXT NOT NULL,           -- 'pv' | 'advertorial'
    lang TEXT DEFAULT 'pt-BR',
    domain TEXT,                  -- domínio associado
    status TEXT DEFAULT 'draft',  -- 'draft' | 'published'
    html_content TEXT,            -- HTML do editor
    frontmatter TEXT,             -- JSON string (title, description, image)
    category_config TEXT,         -- JSON string (configs específicas por tipo)
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  -- Recursos: Pixels
  CREATE TABLE pixels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL,           -- 'facebook' | 'google' | 'tiktok' | 'custom'
    pixel_id TEXT NOT NULL,
    config TEXT,                  -- JSON (eventos customizados, etc)
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Recursos: Domínios
  CREATE TABLE domains (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    ssl_status TEXT DEFAULT 'pending',
    cloudflare_zone_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Recursos: Scripts globais
  CREATE TABLE scripts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    position TEXT NOT NULL,       -- 'head' | 'body_start' | 'body_end'
    code TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Recursos: Imagens (asset manager)
  CREATE TABLE images (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    path TEXT NOT NULL,
    size INTEGER,
    mime_type TEXT,
    width INTEGER,
    height INTEGER,
    created_at TEXT DEFAULT (datetime('now'))
  );

  -- Sessões (auth single-user)
  CREATE TABLE sessions (
    token TEXT PRIMARY KEY,
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL
  );
  ```
- [ ] Criar `server/db/index.js` — inicialização do DB + migrations
- [ ] Criar `server/db/seed.js` — seed com user padrão (login/senha via env)
- [ ] Adicionar script `"server": "node server/server.js"` no package.json

### T1.2 — Autenticação Single-User

- [ ] Criar `server/middleware/auth.js` — middleware de autenticação
- [ ] Rota `POST /api/auth/login` — valida credenciais de env vars (`ADMIN_USER`, `ADMIN_PASS`)
- [ ] Rota `POST /api/auth/logout` — invalida sessão
- [ ] Rota `GET /api/auth/me` — verifica sessão atual
- [ ] Token via cookie httpOnly + secure
- [ ] Credenciais padrão em `.env` (não commitado)
- [ ] Criar `.env.example` com template

### T1.3 — API CRUD de Páginas

- [ ] Rota `GET /api/pages` — lista todas (com filtros: type, status, lang, domain)
- [ ] Rota `GET /api/pages/:id` — detalhes de uma página
- [ ] Rota `POST /api/pages` — criar página (PV ou Advertorial)
- [ ] Rota `PUT /api/pages/:id` — atualizar metadados
- [ ] Rota `PUT /api/pages/:id/content` — salvar HTML do editor
- [ ] Rota `DELETE /api/pages/:id` — soft delete ou hard delete
- [ ] Rota `POST /api/pages/:id/publish` — publica (gera arquivo em `pages/`, roda build)
- [ ] Rota `POST /api/pages/:id/unpublish` — remove do `pages/` e rebuilda
- [ ] Validação de schema com Fastify schemas

### T1.4 — API de Recursos

- [ ] Rotas CRUD `GET/POST/PUT/DELETE /api/pixels`
- [ ] Rotas CRUD `GET/POST/PUT/DELETE /api/domains`
- [ ] Rotas CRUD `GET/POST/PUT/DELETE /api/scripts`
- [ ] Rota `POST /api/images/upload` — upload com multipart, processa com sharp, salva em `assets/imgs/`
- [ ] Rota `GET /api/images` — lista imagens do asset manager
- [ ] Rota `DELETE /api/images/:id` — remove imagem

### T1.5 — Evolução do Framework StaticFlow

- [ ] Modificar `lib/pages.js` — suportar injeção de pixels por página (ler do DB ou config)
- [ ] Modificar `lib/pages.js` — suportar scripts globais (head/body_start/body_end)
- [ ] Criar `lib/publish.js` — módulo que:
  1. Recebe page data do DB
  2. Gera o arquivo `.html` em `pages/` com frontmatter correto
  3. Injeta pixels configurados
  4. Injeta scripts globais ativos
  5. Dispara rebuild (chama `build()`)
- [ ] Modificar `build.js` — aceitar build seletivo (rebuild de uma página só, sem limpar tudo)
- [ ] Criar partials específicos para PV e Advertorial (ex: `partials/pv-head.html`, `partials/adv-head.html`)
- [ ] Suportar múltiplos domínios no `config.json` e no sitemap

### T1.6 — Roteamento Dual (React Admin + HTML Estático)

- [ ] Configurar Fastify para servir:
  - `/admin/*` → React app (SPA, servir `admin/dist/index.html` para qualquer rota /admin/*)
  - `/api/*` → API routes
  - `/*` → arquivos estáticos de `dist/` (site público)
- [ ] Criar `server/plugins/static.js` — plugin Fastify para roteamento inteligente
- [ ] Dev mode: Vite dev server (admin) em porta separada + proxy no Fastify
- [ ] Prod mode: build do React, servir estático

---

## TEAM 2 — ADMIN UI (React Shell + Páginas CRUD)

> **Depende de:** T1.1 e T1.2 (API e Auth disponíveis)

### T2.1 — Setup do React App

- [ ] Criar `admin/` via Vite (`npm create vite@latest admin -- --template react-ts`)
- [ ] Instalar: `tailwindcss`, `@tailwindcss/vite`, `lucide-react`, `react-router-dom`
- [ ] Configurar Tailwind com design tokens do Aurion (cores, fonts, radius)
- [ ] Configurar proxy do Vite para `/api` apontar para Fastify
- [ ] Criar layout base com CSS custom properties para os tokens

### T2.2 — Auth UI

- [ ] Tela de login (`/admin/login`) — dark, centralizada, minimalista
- [ ] Auth context (`admin/src/auth/AuthContext.tsx`) — gerencia sessão
- [ ] Auth guard (`admin/src/auth/AuthGuard.tsx`) — redireciona se não logado
- [ ] Hook `useAuth()` — login, logout, user state

### T2.3 — Shell do Admin (Layout Principal)

- [ ] **Sidebar** — componente com:
  - Logo "Aurion" no topo
  - Seções de navegação com ícones Lucide:
    - **Páginas de Venda** (icon: FileText)
    - **Advertoriais** (icon: Newspaper)
    - **Recursos** (icon: FolderOpen) → submenu:
      - Imagens (icon: Image)
      - Pixels (icon: Code)
      - Domínios (icon: Globe)
      - Scripts (icon: Terminal)
    - **Conversion Boosters** (icon: Zap) → badge "Roadmap"
    - **Traduções** (icon: Languages) → badge "Roadmap"
    - **Integrações** (icon: Plug) → badge "Roadmap"
  - Divisor visual
  - User info + botão logout no rodapé
  - Colapsável (260px ↔ 64px)
- [ ] **Top bar** — breadcrumb + ações contextuais
- [ ] **Layout wrapper** — sidebar + content area com scroll independente
- [ ] Responsivo: sidebar overlay em mobile

### T2.4 — Listagem de Páginas (PVs e Advertoriais)

- [ ] Componente `PagesList` reutilizável para PV e Advertorial
- [ ] Tabela com colunas:
  - **Título** (texto clicável)
  - **Língua** (badge: BR, EN, ES — padrão BR)
  - **Path** (`/slug-da-pagina`)
  - **Domínio** (texto ou "—" se não configurado)
  - **Status** (badge: Draft / Published)
  - **Ações**: botão Configurações (gear icon) + botão Editar (pencil icon → abre editor)
- [ ] Filtros: status, língua, domínio
- [ ] Busca por título
- [ ] Botão "Nova Página" (abre modal de criação)
- [ ] Paginação
- [ ] Empty state quando não há páginas

### T2.5 — Modal/Drawer de Configurações da Página

- [ ] **Configs gerais** (todas as páginas):
  - Título, Slug, Descrição (SEO), Imagem OG
  - Língua (select: pt-BR, en, es)
  - Domínio (select dos domínios cadastrados)
  - Status (draft/published)
- [ ] **Configs de Página de Venda (PV)**:
  - Produto associado (nome, preço, link checkout)
  - Pixel(s) associado(s) (multi-select dos pixels cadastrados)
  - Scripts específicos da página
  - Checkout URL
  - Timer/urgência config
- [ ] **Configs de Advertorial**:
  - Fonte/veículo simulado (ex: "Portal G3", "Diário Nacional")
  - Data do artigo
  - Autor
  - Pixel(s) associado(s)
  - CTA destino (link para PV)
  - Categoria (saúde, beleza, finanças, etc.)
- [ ] Formulário com validação
- [ ] Salvar via API

### T2.6 — Dashboard (Home do Admin)

- [ ] Cards resumo: total de PVs, total de Advertoriais, total publicadas, total draft
- [ ] Lista de "últimas editadas" (5 mais recentes)
- [ ] Quick actions: "Nova PV", "Novo Advertorial"
- [ ] Gráfico simples de páginas criadas por semana (opcional, stretch goal)

---

## TEAM 3 — EDITOR (GrapesJS Studio SDK)

> **Depende de:** T1.3 (API de páginas para salvar/carregar) e T2.1 (React app existe)

### T3.1 — Setup GrapesJS Studio SDK

- [ ] Instalar `@grapesjs/studio-sdk` no admin
- [ ] Criar componente `EditorPage` (`/admin/editor/:pageId`)
- [ ] Integrar `StudioEditor` do `@grapesjs/studio-sdk/react`
- [ ] Configurar licença (localhost dev = free)
- [ ] Tema dark para o editor (match com design system Aurion)

### T3.2 — Storage Adapter

- [ ] Criar adapter de storage customizado:
  - `load()` → `GET /api/pages/:id` (carrega HTML do DB)
  - `store()` → `PUT /api/pages/:id/content` (salva HTML no DB)
- [ ] Auto-save a cada 30s (debounced)
- [ ] Indicador visual de "salvando..." / "salvo"
- [ ] Botão manual "Salvar" na toolbar

### T3.3 — Asset Manager Integration

- [ ] Conectar asset manager do GrapesJS com `/api/images`
- [ ] Upload de imagens direto do editor → `POST /api/images/upload`
- [ ] Listar imagens existentes ao abrir asset manager
- [ ] Thumbnail preview no seletor

### T3.4 — Blocos Customizados para PV

- [ ] Bloco "Hero de Produto" — imagem + headline + subheadline + CTA
- [ ] Bloco "Benefícios" — grid de ícone + texto
- [ ] Bloco "Depoimentos" — carrossel/grid de testimonials
- [ ] Bloco "Antes/Depois" — comparativo visual
- [ ] Bloco "FAQ" — accordion
- [ ] Bloco "CTA Final" — urgência + botão de compra
- [ ] Bloco "Garantia" — selo + texto
- [ ] Bloco "Video Embed" — YouTube/Vimeo responsivo

### T3.5 — Blocos Customizados para Advertorial

- [ ] Bloco "Header de Jornal" — logo do veículo + data + categoria
- [ ] Bloco "Artigo Body" — texto formatado estilo editorial
- [ ] Bloco "Citação" — blockquote estilizado
- [ ] Bloco "Imagem Editorial" — imagem com caption
- [ ] Bloco "CTA Nativo" — link disfarçado de "saiba mais" / "veja o produto"
- [ ] Bloco "Relacionados" — cards de "outras matérias"
- [ ] Bloco "Comentários Fake" — simulação de seção de comentários

### T3.6 — Preview & Publish Flow

- [ ] Botão "Preview" — abre nova aba com a página renderizada (usa build do StaticFlow)
- [ ] Botão "Publicar" — chama `POST /api/pages/:id/publish`
- [ ] Confirmação antes de publicar
- [ ] Feedback visual de sucesso/erro
- [ ] Botão "Voltar para lista" na toolbar do editor

---

## TEAM 4 — RESOURCES (Imagens, Pixels, Domínios, Scripts)

> **Depende de:** T1.4 (API de recursos) e T2.1 (React app existe)

### T4.1 — Gerenciador de Imagens

- [ ] Página `/admin/recursos/imagens`
- [ ] Grid de thumbnails com nome, tamanho, dimensões
- [ ] Upload drag-and-drop (múltiplos arquivos)
- [ ] Preview ao clicar
- [ ] Copiar URL do asset
- [ ] Deletar com confirmação
- [ ] Filtro por nome
- [ ] Indicador de processamento (sharp otimizando)

### T4.2 — Gerenciador de Pixels

- [ ] Página `/admin/recursos/pixels`
- [ ] Lista de pixels cadastrados (nome, tipo, ID do pixel)
- [ ] Modal para adicionar/editar pixel:
  - Tipo: Facebook Pixel, Google Analytics, Google Ads, TikTok Pixel, Custom
  - Pixel ID
  - Nome identificador
  - Config de eventos (JSON editor simples)
- [ ] Toggle ativo/inativo
- [ ] Deletar com confirmação

### T4.3 — Gerenciador de Domínios

- [ ] Página `/admin/recursos/dominios`
- [ ] Lista de domínios (domínio, status SSL, data de cadastro)
- [ ] Modal para adicionar domínio
- [ ] Instruções de configuração DNS (CNAME para Cloudflare)
- [ ] Status check (pendente/ativo/erro)
- [ ] Deletar com confirmação

### T4.4 — Gerenciador de Scripts

- [ ] Página `/admin/recursos/scripts`
- [ ] Lista de scripts globais (nome, posição, status)
- [ ] Modal para adicionar/editar script:
  - Nome identificador
  - Posição: Head / Body Start / Body End
  - Code editor (textarea com monospace, ou CodeMirror simples)
  - Toggle ativo/inativo
- [ ] Preview do código
- [ ] Deletar com confirmação

### T4.5 — Páginas Roadmap (Placeholder)

- [ ] Página `/admin/conversion-boosters` — UI placeholder:
  - Título "Conversion Boosters"
  - Lista de features planejadas: Countdown Timer, Exit Intent Popup, Social Proof Notification, Sticky CTA Bar, A/B Testing
  - Badge "Em breve" em cada item
  - Ilustração ou ícone grande
- [ ] Página `/admin/traducoes` — UI placeholder:
  - Título "Traduções"
  - Descrição: "Traduza suas páginas automaticamente para múltiplos idiomas"
  - Badge "Em breve"
- [ ] Página `/admin/integracoes` — UI placeholder:
  - Título "Integrações"
  - Cards: Shopify, Hotmart, Kiwify, Monetizze, Stripe, Webhook customizado
  - Badge "Em breve" em cada card

---

## TEAM 5 — INTEGRATION (Conectar tudo + Polish)

> **Depende de:** Teams 1-4 concluídos

### T5.1 — Build Pipeline Integrado

- [ ] Script `npm run dev:full` — roda Fastify + Vite dev server em paralelo
- [ ] Script `npm run build:admin` — build do React app
- [ ] Script `npm run build:site` — build do StaticFlow (páginas publicadas)
- [ ] Script `npm run build:all` — build admin + site
- [ ] Script `npm run start` — produção (Fastify servindo tudo)
- [ ] Atualizar `package.json` com todos os scripts

### T5.2 — Publish Pipeline End-to-End

- [ ] Testar fluxo completo: criar página → editar no GrapesJS → salvar → publicar → verificar em dist/
- [ ] Garantir que pixels são injetados no HTML final
- [ ] Garantir que scripts globais são injetados
- [ ] Garantir que domínios são mapeados corretamente
- [ ] Garantir que asset hashing funciona com imagens do editor

### T5.3 — Error Handling & Loading States

- [ ] Skeleton loaders em todas as listas
- [ ] Toast notifications para sucesso/erro
- [ ] Error boundaries no React
- [ ] Tratamento de 401 (redirect para login)
- [ ] Tratamento de erros de rede
- [ ] Empty states em todas as listagens

### T5.4 — Performance & Polish

- [ ] Lazy loading de rotas do React (code splitting)
- [ ] Otimizar queries SQLite (índices nas colunas de busca/filtro)
- [ ] Debounce na busca de páginas
- [ ] Keyboard shortcuts no editor (Ctrl+S = salvar)
- [ ] Favicon do Aurion
- [ ] Meta tags do admin

### T5.5 — Deploy & Documentação

- [ ] Dockerfile para deploy completo (Node + SQLite + static files)
- [ ] `docker-compose.yml` para dev local
- [ ] Variáveis de ambiente documentadas
- [ ] Atualizar README com instruções do admin panel
- [ ] Documentar API endpoints (formato simples no próprio README ou em docs/)

---

## Ordem de Execução (Dependências)

```
Fase 1 (paralelo limitado):
├── TEAM 1: T1.1 → T1.2 → T1.3 → T1.4 → T1.5 → T1.6
│
Fase 2 (paralelo total, após T1.1-T1.4):
├── TEAM 2: T2.1 → T2.2 → T2.3 → T2.4 → T2.5 → T2.6
├── TEAM 3: T3.1 → T3.2 → T3.3 → T3.4 → T3.5 → T3.6
├── TEAM 4: T4.1 → T4.2 → T4.3 → T4.4 → T4.5
│
Fase 3 (após Fase 2):
└── TEAM 5: T5.1 → T5.2 → T5.3 → T5.4 → T5.5
```

**Nota:** Dentro de cada time, as tasks são sequenciais. Entre os times 2, 3 e 4, as tasks são paralelas (interdependentes apenas via API do Team 1).

---

## Stack Técnica Completa

| Camada | Tecnologia |
|--------|-----------|
| **Frontend Admin** | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| **Editor Visual** | GrapesJS Studio SDK (`@grapesjs/studio-sdk`) |
| **Ícones** | Lucide React |
| **Roteamento Admin** | React Router v7 |
| **Backend** | Fastify (Node.js, ESM) |
| **Database** | SQLite via better-sqlite3 |
| **Auth** | Cookie httpOnly + session token |
| **Upload** | @fastify/multipart + sharp |
| **Build Site** | StaticFlow CMS (existente, evoluído) |
| **Otimização** | sharp, terser, clean-css, html-minifier-terser |
| **Deploy** | Docker + Cloudflare Pages (site estático) |

---

## Métricas de Completude

| Time | Tasks | Estimativa Relativa |
|------|-------|---------------------|
| Team 1 | 6 blocos (26 subtasks) | Maior — fundação de tudo |
| Team 2 | 6 blocos (22 subtasks) | Médio-grande — UI completa |
| Team 3 | 6 blocos (20 subtasks) | Médio — editor é SDK pronto |
| Team 4 | 5 blocos (15 subtasks) | Médio — CRUDs + UIs simples |
| Team 5 | 5 blocos (14 subtasks) | Médio — integração e polish |
| **Total** | **28 blocos (~97 subtasks)** | |
