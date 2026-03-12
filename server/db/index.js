// server/db/index.js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  // Use DATABASE_PATH env var (for Railway volume mount) or default to local data/
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'aurion.db');
  const dataDir = path.dirname(dbPath);

  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Run schema if tables don't exist
  initSchema(db);

  return db;
}

function initSchema(db) {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // Migrations: add columns if missing
  const cols = db.prepare("PRAGMA table_info(pages)").all().map(c => c.name);
  if (!cols.includes('project_data')) {
    db.exec("ALTER TABLE pages ADD COLUMN project_data TEXT");
  }
  if (!cols.includes('category_id')) {
    db.exec("ALTER TABLE pages ADD COLUMN category_id TEXT REFERENCES categories(id) ON DELETE SET NULL");
  }
  if (!cols.includes('category_config')) {
    db.exec("ALTER TABLE pages ADD COLUMN category_config TEXT");
  }
  if (!cols.includes('frontmatter')) {
    db.exec("ALTER TABLE pages ADD COLUMN frontmatter TEXT");
  }
  if (!cols.includes('variant_group')) {
    db.exec("ALTER TABLE pages ADD COLUMN variant_group TEXT");
  }
  if (!cols.includes('variant_label')) {
    db.exec("ALTER TABLE pages ADD COLUMN variant_label TEXT");
  }
  if (!cols.includes('source_page_id')) {
    db.exec("ALTER TABLE pages ADD COLUMN source_page_id TEXT REFERENCES pages(id) ON DELETE SET NULL");
  }

  // Migrations: add Cloudflare hosting columns to domains
  const domainCols = db.prepare("PRAGMA table_info(domains)").all().map(c => c.name);
  if (!domainCols.includes('cloudflare_account_id')) {
    db.exec("ALTER TABLE domains ADD COLUMN cloudflare_account_id TEXT REFERENCES cloudflare_accounts(id) ON DELETE SET NULL");
  }
  if (!domainCols.includes('worker_name')) {
    db.exec("ALTER TABLE domains ADD COLUMN worker_name TEXT");
  }
  if (!domainCols.includes('r2_bucket')) {
    db.exec("ALTER TABLE domains ADD COLUMN r2_bucket TEXT");
  }
  if (!domainCols.includes('worker_status')) {
    db.exec("ALTER TABLE domains ADD COLUMN worker_status TEXT DEFAULT 'pending'");
  }
  if (!domainCols.includes('worker_error')) {
    db.exec("ALTER TABLE domains ADD COLUMN worker_error TEXT");
  }
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
