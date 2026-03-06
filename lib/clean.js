// lib/clean.js
import fs from 'node:fs';

export async function clean(distPath) {
  fs.rmSync(distPath, { recursive: true, force: true });
  fs.mkdirSync(distPath, { recursive: true });
}
