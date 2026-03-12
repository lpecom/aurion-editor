-- Paginas (PVs e Advertoriais)
CREATE TABLE IF NOT EXISTS pages (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  lang TEXT DEFAULT 'pt-BR',
  domain TEXT,
  category_id TEXT,
  status TEXT DEFAULT 'draft',
  html_content TEXT,
  frontmatter TEXT,
  category_config TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
);

-- Recursos: Pixels
CREATE TABLE IF NOT EXISTS pixels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  pixel_id TEXT NOT NULL,
  config TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Recursos: Dominios
CREATE TABLE IF NOT EXISTS domains (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  ssl_status TEXT DEFAULT 'pending',
  cloudflare_zone_id TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Recursos: Scripts globais
CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  position TEXT NOT NULL,
  code TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Recursos: Imagens (asset manager)
CREATE TABLE IF NOT EXISTS images (
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

-- Categorias (agrupamento de paginas com configs compartilhadas)
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                 -- 'pv' | 'advertorial'
  config TEXT,                        -- JSON (configs padrao da categoria)
  created_at TEXT DEFAULT (datetime('now'))
);

-- Dominios por pagina (N:N — cada pagina pode ter multiplos dominios)
CREATE TABLE IF NOT EXISTS page_domains (
  page_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,       -- dominio principal da pagina
  PRIMARY KEY (page_id, domain_id),
  FOREIGN KEY (page_id) REFERENCES pages(id) ON DELETE CASCADE,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

-- Dominios por categoria (N:N — todas as paginas da categoria herdam)
CREATE TABLE IF NOT EXISTS category_domains (
  category_id TEXT NOT NULL,
  domain_id TEXT NOT NULL,
  is_primary INTEGER DEFAULT 0,
  PRIMARY KEY (category_id, domain_id),
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  FOREIGN KEY (domain_id) REFERENCES domains(id) ON DELETE CASCADE
);

-- Recursos: Idiomas (para traduções)
CREATE TABLE IF NOT EXISTS languages (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  flag TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Recursos: Provedores de tradução
CREATE TABLE IF NOT EXISTS translation_providers (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Contas Cloudflare (para hosting via Workers + R2)
CREATE TABLE IF NOT EXISTS cloudflare_accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  account_id TEXT NOT NULL,
  api_token TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Sessoes (auth single-user)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

-- Regras de cloaker por página
CREATE TABLE IF NOT EXISTS page_cloaker_rules (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL UNIQUE REFERENCES pages(id) ON DELETE CASCADE,
  enabled INTEGER DEFAULT 1,
  action TEXT DEFAULT 'redirect',
  redirect_url TEXT,
  safe_page_id TEXT REFERENCES pages(id) ON DELETE SET NULL,
  url_whitelist TEXT DEFAULT '[]',
  countries_mode TEXT DEFAULT 'allow',
  countries TEXT DEFAULT '[]',
  devices_mode TEXT DEFAULT 'allow',
  devices TEXT DEFAULT '[]',
  browsers_mode TEXT DEFAULT 'allow',
  browsers TEXT DEFAULT '[]',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
