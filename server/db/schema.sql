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

-- Sessoes (auth single-user)
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);
