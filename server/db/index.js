// server/db/index.js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  const dbPath = path.join(__dirname, '..', '..', 'data', 'aurion.db');
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
}

export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}
