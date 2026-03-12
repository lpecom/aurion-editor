// server/lib/mcp-tools.js
import { randomUUID } from 'node:crypto';
import path from 'node:path';

function logActivity(db, apiKey, action, resourceType, resourceId, resourceName, details) {
  db.prepare(
    'INSERT INTO activity_log (id, api_key_id, nickname, action, resource_type, resource_id, resource_name, details) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(randomUUID(), apiKey.id, apiKey.nickname, action, resourceType, resourceId, resourceName, details ? JSON.stringify(details) : null);
}

const MIME_BY_EXT = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

export const MCP_TOOLS = [
  {
    name: 'list_pages',
    description: 'List pages with optional filters',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['pv', 'advertorial'], description: 'Filter by page type' },
        status: { type: 'string', enum: ['draft', 'published'], description: 'Filter by status' },
        lang: { type: 'string', description: 'Filter by language code' },
      },
    },
  },
  {
    name: 'get_page',
    description: 'Get page details by ID or slug',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Page ID' },
        slug: { type: 'string', description: 'Page slug (alternative to id)' },
      },
    },
  },
  {
    name: 'create_page',
    description: 'Create a new page',
    inputSchema: {
      type: 'object',
      required: ['title', 'slug', 'type'],
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        type: { type: 'string', enum: ['pv', 'advertorial'] },
        html_content: { type: 'string', description: 'HTML content of the page' },
        lang: { type: 'string', description: 'Language code, defaults to pt-BR' },
      },
    },
  },
  {
    name: 'edit_page',
    description: 'Edit an existing page',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        slug: { type: 'string' },
        html_content: { type: 'string' },
        lang: { type: 'string' },
        frontmatter: { type: 'string' },
      },
    },
  },
  {
    name: 'publish_page',
    description: 'Publish a page (makes it live)',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'unpublish_page',
    description: 'Unpublish a page (takes it offline)',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'delete_page',
    description: 'Delete a page permanently',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'clone_page',
    description: 'Clone an external page by URL (scrapes and saves)',
    inputSchema: {
      type: 'object',
      required: ['url', 'title', 'slug', 'type'],
      properties: {
        url: { type: 'string', description: 'URL to clone' },
        title: { type: 'string' },
        slug: { type: 'string' },
        type: { type: 'string', enum: ['pv', 'advertorial'] },
      },
    },
  },
  {
    name: 'list_scripts',
    description: 'List all scripts',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_script',
    description: 'Create a new script',
    inputSchema: {
      type: 'object',
      required: ['name', 'position', 'code'],
      properties: {
        name: { type: 'string' },
        position: { type: 'string', enum: ['head', 'body_start', 'body_end'] },
        code: { type: 'string' },
      },
    },
  },
  {
    name: 'edit_script',
    description: 'Edit an existing script',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        position: { type: 'string', enum: ['head', 'body_start', 'body_end'] },
        code: { type: 'string' },
        active: { type: 'integer' },
      },
    },
  },
  {
    name: 'delete_script',
    description: 'Delete a script',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: { id: { type: 'string' } },
    },
  },
  {
    name: 'list_pixels',
    description: 'List all pixels',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_domains',
    description: 'List all domains',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_images',
    description: 'List all images',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'upload_image',
    description: 'Upload an image (base64 encoded)',
    inputSchema: {
      type: 'object',
      required: ['base64', 'filename'],
      properties: {
        base64: { type: 'string', description: 'Base64 encoded image data' },
        filename: { type: 'string', description: 'Original filename' },
      },
    },
  },
];

export async function executeTool(toolName, params, db, apiKey) {
  switch (toolName) {
    case 'list_pages': {
      let sql = 'SELECT id, title, slug, type, lang, status, created_at, updated_at FROM pages WHERE 1=1';
      const binds = [];
      if (params.type) { sql += ' AND type = ?'; binds.push(params.type); }
      if (params.status) { sql += ' AND status = ?'; binds.push(params.status); }
      if (params.lang) { sql += ' AND lang = ?'; binds.push(params.lang); }
      sql += ' ORDER BY created_at DESC';
      return db.prepare(sql).all(...binds);
    }

    case 'get_page': {
      const page = params.id
        ? db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id)
        : db.prepare('SELECT * FROM pages WHERE slug = ?').get(params.slug);
      if (!page) throw new Error('Page not found');
      return page;
    }

    case 'create_page': {
      const id = randomUUID();
      const { title, slug, type, html_content, lang } = params;
      const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
      if (existing) throw new Error('Slug already exists');
      db.prepare('INSERT INTO pages (id, title, slug, type, lang, status, html_content) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id, title, slug, type, lang || 'pt-BR', 'draft', html_content || null
      );
      logActivity(db, apiKey, 'create_page', 'page', id, title, { slug });
      return db.prepare('SELECT id, title, slug, type, status, created_at FROM pages WHERE id = ?').get(id);
    }

    case 'edit_page': {
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id);
      if (!page) throw new Error('Page not found');
      const fields = ['title', 'slug', 'html_content', 'lang', 'frontmatter'];
      const updates = [];
      const values = [];
      for (const f of fields) {
        if (params[f] !== undefined) { updates.push(`${f} = ?`); values.push(params[f]); }
      }
      if (updates.length === 0) throw new Error('No fields to update');
      updates.push("updated_at = datetime('now')");
      values.push(params.id);
      db.prepare(`UPDATE pages SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      logActivity(db, apiKey, 'edit_page', 'page', params.id, params.title || page.title, { slug: params.slug || page.slug });
      return db.prepare('SELECT id, title, slug, type, status, updated_at FROM pages WHERE id = ?').get(params.id);
    }

    case 'publish_page': {
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id);
      if (!page) throw new Error('Page not found');
      db.prepare("UPDATE pages SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(params.id);
      try {
        const { publishPage } = await import('../../lib/publish.js');
        const updatedPage = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id);
        await publishPage(updatedPage, db);
      } catch (err) {
        // publish error is non-fatal for the status update
      }
      logActivity(db, apiKey, 'publish_page', 'page', params.id, page.title, { slug: page.slug });
      return { ok: true, message: `Page "${page.title}" published` };
    }

    case 'unpublish_page': {
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id);
      if (!page) throw new Error('Page not found');
      db.prepare("UPDATE pages SET status = 'draft', updated_at = datetime('now') WHERE id = ?").run(params.id);
      try {
        const { unpublishPage } = await import('../../lib/publish.js');
        await unpublishPage(page, db);
      } catch (err) {}
      logActivity(db, apiKey, 'unpublish_page', 'page', params.id, page.title, { slug: page.slug });
      return { ok: true, message: `Page "${page.title}" unpublished` };
    }

    case 'delete_page': {
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id);
      if (!page) throw new Error('Page not found');
      if (page.status === 'published') {
        try {
          const { unpublishPage } = await import('../../lib/publish.js');
          await unpublishPage(page, db);
        } catch (err) {}
      }
      db.prepare('DELETE FROM pages WHERE id = ?').run(params.id);
      logActivity(db, apiKey, 'delete_page', 'page', params.id, page.title, { slug: page.slug });
      return { ok: true, message: `Page "${page.title}" deleted` };
    }

    case 'clone_page': {
      const { scrapeUrl } = await import('./scraper.js');
      const { url, title, slug, type } = params;
      const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
      if (existing) throw new Error('Slug already exists');
      const result = await scrapeUrl(url);
      const id = randomUUID();
      db.prepare('INSERT INTO pages (id, title, slug, type, lang, status, html_content) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id, title, slug, type, 'pt-BR', 'draft', result.html
      );
      logActivity(db, apiKey, 'clone_page', 'page', id, title, { url, slug });
      return db.prepare('SELECT id, title, slug, type, status, created_at FROM pages WHERE id = ?').get(id);
    }

    case 'list_scripts':
      return db.prepare('SELECT * FROM scripts ORDER BY created_at DESC').all();

    case 'create_script': {
      const id = randomUUID();
      const { name, position, code } = params;
      db.prepare('INSERT INTO scripts (id, name, position, code) VALUES (?, ?, ?, ?)').run(id, name, position, code);
      logActivity(db, apiKey, 'create_script', 'script', id, name, null);
      return db.prepare('SELECT * FROM scripts WHERE id = ?').get(id);
    }

    case 'edit_script': {
      const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(params.id);
      if (!script) throw new Error('Script not found');
      const { name, position, code, active } = params;
      db.prepare('UPDATE scripts SET name = COALESCE(?, name), position = COALESCE(?, position), code = COALESCE(?, code), active = COALESCE(?, active) WHERE id = ?').run(
        name || null, position || null, code || null, active !== undefined ? active : null, params.id
      );
      logActivity(db, apiKey, 'edit_script', 'script', params.id, name || script.name, null);
      return db.prepare('SELECT * FROM scripts WHERE id = ?').get(params.id);
    }

    case 'delete_script': {
      const script = db.prepare('SELECT * FROM scripts WHERE id = ?').get(params.id);
      if (!script) throw new Error('Script not found');
      db.prepare('DELETE FROM scripts WHERE id = ?').run(params.id);
      logActivity(db, apiKey, 'delete_script', 'script', params.id, script.name, null);
      return { ok: true };
    }

    case 'list_pixels':
      return db.prepare('SELECT * FROM pixels ORDER BY created_at DESC').all();

    case 'list_domains':
      return db.prepare('SELECT * FROM domains ORDER BY created_at DESC').all();

    case 'list_images':
      return db.prepare('SELECT id, filename, original_name, path, size, mime_type, width, height, created_at FROM images ORDER BY created_at DESC').all();

    case 'upload_image': {
      const { processAndSaveImage } = await import('./image-processing.js');
      const buffer = Buffer.from(params.base64, 'base64');
      const ext = path.extname(params.filename).toLowerCase();
      const mimeType = MIME_BY_EXT[ext] || 'image/jpeg';
      const result = await processAndSaveImage(buffer, params.filename, mimeType);
      logActivity(db, apiKey, 'upload_image', 'image', result.id, params.filename, null);
      return result;
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
