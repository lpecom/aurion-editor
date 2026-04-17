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
        type: { type: 'string', enum: ['pv', 'advertorial', 'auxiliar'], description: 'Filter by page type' },
        status: { type: 'string', enum: ['draft', 'published'], description: 'Filter by status' },
        lang: { type: 'string', description: 'Filter by language code' },
      },
    },
  },
  {
    name: 'get_page',
    description: 'Get page overview: metadata + section tree (no HTML). Use include_html=true for full HTML.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Page ID' },
        slug: { type: 'string', description: 'Page slug (alternative to id)' },
        include_html: { type: 'boolean', description: 'Include full html_content in response (default: false)' },
      },
    },
  },
  {
    name: 'get_section',
    description: 'Get HTML of a specific section by data-id or CSS selector',
    inputSchema: {
      type: 'object',
      required: ['page_id', 'selector'],
      properties: {
        page_id: { type: 'string', description: 'Page ID' },
        selector: { type: 'string', description: 'Elementor data-id (e.g. "657fba23") or CSS selector (e.g. ".titulo")' },
      },
    },
  },
  {
    name: 'edit_section',
    description: 'Edit a section: find/replace (old_string+new_string) or full replace (html). Preserves GrapesJS project_data.',
    inputSchema: {
      type: 'object',
      required: ['page_id', 'selector'],
      properties: {
        page_id: { type: 'string', description: 'Page ID' },
        selector: { type: 'string', description: 'Elementor data-id or CSS selector' },
        old_string: { type: 'string', description: 'Text to find (Mode A: find/replace)' },
        new_string: { type: 'string', description: 'Replacement text (Mode A: find/replace)' },
        occurrence: { type: 'integer', description: 'Which occurrence to replace (1-indexed). Default 0 = must be unique.' },
        html: { type: 'string', description: 'New inner HTML (Mode B: full replace)' },
      },
    },
  },
  {
    name: 'inject_css',
    description: 'Inject CSS overrides into a page (appends <style> block). Use !important to override Elementor styles.',
    inputSchema: {
      type: 'object',
      required: ['page_id', 'css'],
      properties: {
        page_id: { type: 'string', description: 'Page ID' },
        css: { type: 'string', description: 'CSS rules to inject (without style tags)' },
      },
    },
  },
  {
    name: 'create_page',
    description: 'Create a new page. IMPORTANT: pass domain_ids to associate the page with one or more Cloudflare domains — without it, publish_page will mark the page published in the DB but it will NOT be deployed to R2, so any request to the domain returns 404.',
    inputSchema: {
      type: 'object',
      required: ['title', 'slug', 'type'],
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        type: { type: 'string', enum: ['pv', 'advertorial', 'auxiliar'] },
        html_content: { type: 'string', description: 'HTML content of the page' },
        lang: { type: 'string', description: 'Language code, defaults to pt-BR' },
        parent_page_id: { type: 'string', description: 'Parent page ID (for auxiliar type)' },
        domain_ids: { type: 'array', items: { type: 'string' }, description: 'Cloudflare domain IDs from list_domains. Required for publish to actually serve the page on a domain.' },
        primary_domain_id: { type: 'string', description: 'Which of the domain_ids is primary (used for canonical URL).' },
      },
    },
  },
  {
    name: 'edit_page',
    description: 'Edit an existing page. When html_content is provided, project_data is automatically synced (set to null) so the editor re-imports from HTML on next open. Pass domain_ids to replace domain associations (pass [] to clear).',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        slug: { type: 'string' },
        html_content: { type: 'string' },
        project_data: { type: 'string', description: 'GrapesJS project JSON. If omitted but html_content is provided, project_data is cleared so editor re-imports from HTML.' },
        lang: { type: 'string' },
        frontmatter: { type: 'string' },
        domain_ids: { type: 'array', items: { type: 'string' }, description: 'Replace domain associations (from list_domains). Omit to leave unchanged; pass [] to clear.' },
        primary_domain_id: { type: 'string', description: 'Which of the domain_ids is primary.' },
      },
    },
  },
  {
    name: 'publish_page',
    description: 'Publish a page (sets status=published, uploads HTML+assets to R2 for each associated CF domain, purges cache). Response includes deployed_to list; a warning is returned if no CF domain is associated (page will not be served anywhere).',
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
    name: 'edit_domain',
    description: 'Edit a domain (ssl_status, cloudflare_zone_id, cloudflare_account_id)',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Domain ID' },
        ssl_status: { type: 'string', enum: ['pending', 'active', 'error'] },
        cloudflare_zone_id: { type: 'string' },
        cloudflare_account_id: { type: 'string' },
      },
    },
  },
  {
    name: 'list_images',
    description: 'List all images',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'upload_image',
    description: 'Upload an image from a URL. For local files, use curl: curl -X POST https://HOST/api/images/upload -H "Authorization: Bearer TOKEN" -F "file=@/path/to/image.jpg"',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to fetch the image from' },
        filename: { type: 'string', description: 'Override filename (optional, auto-detected from url)' },
      },
      required: ['url'],
    },
  },
  {
    name: 'list_auxiliares',
    description: 'List auxiliary pages, optionally filtered by parent page',
    inputSchema: {
      type: 'object',
      properties: {
        parent_page_id: { type: 'string', description: 'Filter by parent page ID' },
      },
    },
  },
  {
    name: 'create_auxiliar',
    description: 'Create an auxiliary page (policy, terms, tracking, etc.) linked to a parent page',
    inputSchema: {
      type: 'object',
      required: ['title', 'slug', 'auxiliar_type', 'parent_page_id'],
      properties: {
        title: { type: 'string' },
        slug: { type: 'string' },
        auxiliar_type: { type: 'string', enum: ['politica_privacidade', 'termos_uso', 'rastreio', 'contato', 'outro'] },
        parent_page_id: { type: 'string', description: 'ID of the parent PV or advertorial page' },
        html_content: { type: 'string' },
        custom_type: { type: 'string', description: 'Custom type label when auxiliar_type is outro' },
      },
    },
  },
  {
    name: 'list_funnels',
    description: 'List sales funnels with optional status filter',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['draft', 'active', 'paused'] },
      },
    },
  },
  {
    name: 'get_funnel',
    description: 'Get funnel details including graph data',
    inputSchema: {
      type: 'object',
      required: ['id'],
      properties: {
        id: { type: 'string', description: 'Funnel ID' },
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
      const rows = db.prepare(sql).all(...binds);
      const domStmt = db.prepare(`
        SELECT d.id, d.domain, pd.is_primary
        FROM domains d JOIN page_domains pd ON pd.domain_id = d.id
        WHERE pd.page_id = ?
        ORDER BY pd.is_primary DESC, d.domain ASC
      `);
      return rows.map(r => ({ ...r, domains: domStmt.all(r.id) }));
    }

    case 'get_page': {
      const page = params.id
        ? db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id)
        : db.prepare('SELECT * FROM pages WHERE slug = ?').get(params.slug);
      if (!page) throw new Error('Page not found');
      const { parseSectionTree } = await import('./section-utils.js');
      const { sections, note } = parseSectionTree(page.html_content || '');
      const domains = db.prepare(`
        SELECT d.id, d.domain, pd.is_primary
        FROM domains d JOIN page_domains pd ON pd.domain_id = d.id
        WHERE pd.page_id = ?
        ORDER BY pd.is_primary DESC, d.domain ASC
      `).all(page.id);
      const result = {
        id: page.id,
        title: page.title,
        slug: page.slug,
        type: page.type,
        status: page.status,
        lang: page.lang,
        updated_at: page.updated_at,
        domains,
        sections,
      };
      if (note) result.note = note;
      if (params.include_html) result.html_content = page.html_content;
      return result;
    }

    case 'get_section': {
      const { getSectionHtml } = await import('./section-utils.js');
      const page = db.prepare('SELECT html_content FROM pages WHERE id = ?').get(params.page_id);
      if (!page) throw new Error('Page not found');
      return getSectionHtml(page.html_content || '', params.selector);
    }

    case 'edit_section': {
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.page_id);
      if (!page) throw new Error('Page not found');

      const hasReplace = params.old_string !== undefined && params.new_string !== undefined;
      const hasFull = params.html !== undefined;
      if (hasReplace && hasFull) throw new Error('Provide either old_string+new_string or html, not both');
      if (!hasReplace && !hasFull) throw new Error('Provide old_string+new_string (find/replace) or html (full replace)');

      let result;
      if (hasReplace) {
        const { editSectionFindReplace } = await import('./section-utils.js');
        db.prepare('BEGIN IMMEDIATE').run();
        try {
          const freshPage = db.prepare('SELECT html_content FROM pages WHERE id = ?').get(params.page_id);
          result = editSectionFindReplace(freshPage.html_content, params.selector, params.old_string, params.new_string, params.occurrence || 0);
          db.prepare("UPDATE pages SET html_content = ?, project_data = NULL, updated_at = datetime('now') WHERE id = ?").run(result.full_html, params.page_id);
          db.prepare('COMMIT').run();
        } catch (err) {
          db.prepare('ROLLBACK').run();
          throw err;
        }
      } else {
        const { editSectionFullReplace } = await import('./section-utils.js');
        db.prepare('BEGIN IMMEDIATE').run();
        try {
          const freshPage = db.prepare('SELECT html_content FROM pages WHERE id = ?').get(params.page_id);
          result = editSectionFullReplace(freshPage.html_content, params.selector, params.html);
          db.prepare("UPDATE pages SET html_content = ?, project_data = NULL, updated_at = datetime('now') WHERE id = ?").run(result.full_html, params.page_id);
          db.prepare('COMMIT').run();
        } catch (err) {
          db.prepare('ROLLBACK').run();
          throw err;
        }
      }

      logActivity(db, apiKey, 'edit_section', 'page', params.page_id, page.title, { selector: params.selector, mode: hasReplace ? 'find_replace' : 'full_replace' });
      return { success: true, data_id: params.selector, outer_html: result.section_html };
    }

    case 'inject_css': {
      const { injectCss } = await import('./section-utils.js');
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.page_id);
      if (!page) throw new Error('Page not found');
      db.prepare('BEGIN IMMEDIATE').run();
      try {
        const freshPage = db.prepare('SELECT html_content FROM pages WHERE id = ?').get(params.page_id);
        const updatedHtml = injectCss(freshPage.html_content || '', params.css);
        db.prepare("UPDATE pages SET html_content = ?, project_data = NULL, updated_at = datetime('now') WHERE id = ?").run(updatedHtml, params.page_id);
        db.prepare('COMMIT').run();
      } catch (err) {
        db.prepare('ROLLBACK').run();
        throw err;
      }
      logActivity(db, apiKey, 'inject_css', 'page', params.page_id, page.title, null);
      return { success: true };
    }

    case 'create_page': {
      const id = randomUUID();
      const { title, slug, type, html_content, lang, domain_ids, primary_domain_id } = params;
      const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
      if (existing) throw new Error('Slug already exists');
      db.prepare('INSERT INTO pages (id, title, slug, type, lang, status, html_content) VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        id, title, slug, type, lang || 'pt-BR', 'draft', html_content || null
      );
      if (type === 'auxiliar' && params.parent_page_id) {
        db.prepare('INSERT INTO page_parents (page_id, parent_page_id, is_primary) VALUES (?, ?, 1)').run(id, params.parent_page_id);
      }
      if (Array.isArray(domain_ids) && domain_ids.length > 0) {
        const ins = db.prepare('INSERT INTO page_domains (page_id, domain_id, is_primary) VALUES (?, ?, ?)');
        for (const domainId of domain_ids) {
          ins.run(id, domainId, domainId === primary_domain_id ? 1 : 0);
        }
      }
      logActivity(db, apiKey, 'create_page', 'page', id, title, { slug });
      const created = db.prepare('SELECT id, title, slug, type, status, created_at FROM pages WHERE id = ?').get(id);
      const domains = db.prepare(`
        SELECT d.id, d.domain, pd.is_primary
        FROM domains d JOIN page_domains pd ON pd.domain_id = d.id
        WHERE pd.page_id = ?
        ORDER BY pd.is_primary DESC, d.domain ASC
      `).all(id);
      return { ...created, domains };
    }

    case 'edit_page': {
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id);
      if (!page) throw new Error('Page not found');
      const fields = ['title', 'slug', 'html_content', 'project_data', 'lang', 'frontmatter'];
      const updates = [];
      const values = [];
      for (const f of fields) {
        if (params[f] !== undefined) { updates.push(`${f} = ?`); values.push(params[f]); }
      }
      // When html_content is edited but project_data is not explicitly provided,
      // clear project_data so GrapesJS re-imports from html_content on next editor open
      if (params.html_content && !params.project_data) {
        updates.push('project_data = NULL');
      }
      // Allow explicitly clearing project_data to force re-import from HTML
      if (params.project_data === 'null' || params.project_data === '') {
        const pdIdx = updates.findIndex(u => u.startsWith('project_data = ?'));
        if (pdIdx !== -1) { updates.splice(pdIdx, 1); values.splice(pdIdx, 1); }
        updates.push('project_data = NULL');
      }
      const hasDomainUpdate = Array.isArray(params.domain_ids);
      if (updates.length === 0 && !hasDomainUpdate) throw new Error('No fields to update');
      if (updates.length > 0) {
        updates.push("updated_at = datetime('now')");
        values.push(params.id);
        db.prepare(`UPDATE pages SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
      if (hasDomainUpdate) {
        const tx = db.transaction(() => {
          db.prepare('DELETE FROM page_domains WHERE page_id = ?').run(params.id);
          const ins = db.prepare('INSERT INTO page_domains (page_id, domain_id, is_primary) VALUES (?, ?, ?)');
          for (const domainId of params.domain_ids) {
            ins.run(params.id, domainId, domainId === params.primary_domain_id ? 1 : 0);
          }
        });
        tx();
      }
      logActivity(db, apiKey, 'edit_page', 'page', params.id, params.title || page.title, { slug: params.slug || page.slug });
      const updated = db.prepare('SELECT id, title, slug, type, status, updated_at FROM pages WHERE id = ?').get(params.id);
      const domains = db.prepare(`
        SELECT d.id, d.domain, pd.is_primary
        FROM domains d JOIN page_domains pd ON pd.domain_id = d.id
        WHERE pd.page_id = ?
        ORDER BY pd.is_primary DESC, d.domain ASC
      `).all(params.id);
      return { ...updated, domains };
    }

    case 'publish_page': {
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id);
      if (!page) throw new Error('Page not found');
      db.prepare("UPDATE pages SET status = 'published', updated_at = datetime('now') WHERE id = ?").run(params.id);
      let deployError = null;
      try {
        const { publishPage } = await import('../../lib/publish.js');
        const updatedPage = db.prepare('SELECT * FROM pages WHERE id = ?').get(params.id);
        await publishPage(updatedPage, db);
      } catch (err) {
        deployError = err.message;
      }
      // Determine which CF domains this page actually gets deployed to
      const cfDomains = db.prepare(`
        SELECT DISTINCT d.id, d.domain, d.ssl_status
        FROM domains d
        LEFT JOIN page_domains pd ON pd.domain_id = d.id AND pd.page_id = ?
        LEFT JOIN category_domains cd ON cd.domain_id = d.id
        LEFT JOIN pages p ON p.category_id = cd.category_id AND p.id = ?
        WHERE (pd.page_id IS NOT NULL OR p.id IS NOT NULL)
          AND d.cloudflare_account_id IS NOT NULL
          AND d.r2_bucket IS NOT NULL
      `).all(params.id, params.id);
      logActivity(db, apiKey, 'publish_page', 'page', params.id, page.title, { slug: page.slug });
      const response = {
        ok: true,
        message: `Page "${page.title}" published`,
        deployed_to: cfDomains.map(d => ({ id: d.id, domain: d.domain, url: `https://${d.domain}/${page.slug}`, ssl_status: d.ssl_status })),
      };
      if (deployError) response.warning = `Deploy step failed: ${deployError}`;
      else if (cfDomains.length === 0) response.warning = 'Page marked as published but has no associated Cloudflare domain — it will NOT be served on any URL. Call edit_page with domain_ids (see list_domains) to associate a domain.';
      return response;
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
      const projectData = JSON.stringify({
        pages: [{ name: title, component: result.html }],
      });
      db.prepare('INSERT INTO pages (id, title, slug, type, lang, status, html_content, project_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        id, title, slug, type, 'pt-BR', 'draft', result.html, projectData
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

    case 'edit_domain': {
      const { id, ssl_status, cloudflare_zone_id, cloudflare_account_id } = args;
      const domain = db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
      if (!domain) throw new Error('Domain not found');
      db.prepare(`
        UPDATE domains SET
          ssl_status = COALESCE(?, ssl_status),
          cloudflare_zone_id = COALESCE(?, cloudflare_zone_id),
          cloudflare_account_id = COALESCE(?, cloudflare_account_id)
        WHERE id = ?
      `).run(ssl_status || null, cloudflare_zone_id || null, cloudflare_account_id || null, id);
      logActivity(db, apiKey, 'update', 'domain', id, domain.domain, { ssl_status, cloudflare_zone_id, cloudflare_account_id });
      return db.prepare('SELECT * FROM domains WHERE id = ?').get(id);
    }

    case 'list_images':
      return db.prepare('SELECT id, filename, original_name, path, size, mime_type, width, height, created_at FROM images ORDER BY created_at DESC').all();

    case 'upload_image': {
      const { processAndSaveImage } = await import('./image-processing.js');

      if (!params.url) throw new Error('url is required. For local files, use POST /api/images/upload with multipart form data.');

      const res = await fetch(params.url, { signal: AbortSignal.timeout(30000) });
      if (!res.ok) throw new Error(`Failed to fetch image: HTTP ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());
      const urlPath = new URL(params.url).pathname;
      const filename = params.filename || path.basename(urlPath) || 'image.jpg';

      const ext = path.extname(filename).toLowerCase();
      const mimeType = MIME_BY_EXT[ext] || 'image/jpeg';
      const result = await processAndSaveImage(buffer, filename, mimeType);
      logActivity(db, apiKey, 'upload_image', 'image', result.id, filename, null);
      return result;
    }

    case 'list_auxiliares': {
      let sql = "SELECT * FROM pages WHERE type = 'auxiliar'";
      const binds = [];
      if (params.parent_page_id) {
        sql = "SELECT p.* FROM pages p JOIN page_parents pp ON pp.page_id = p.id WHERE p.type = 'auxiliar' AND pp.parent_page_id = ?";
        binds.push(params.parent_page_id);
      }
      const pages = db.prepare(sql).all(...binds);
      logActivity(db, apiKey, 'list_auxiliares', 'page', null, null, params.parent_page_id ? { parent_page_id: params.parent_page_id } : null);
      return { content: [{ type: 'text', text: JSON.stringify(pages) }] };
    }

    case 'create_auxiliar': {
      const { title, slug, auxiliar_type, parent_page_id, html_content, custom_type } = params;
      // Validate parent
      const parent = db.prepare('SELECT id, type FROM pages WHERE id = ?').get(parent_page_id);
      if (!parent || !['pv', 'advertorial'].includes(parent.type)) {
        return { content: [{ type: 'text', text: JSON.stringify({ error: 'Parent must be PV or advertorial' }) }], isError: true };
      }
      const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
      if (existing) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Slug already exists' }) }], isError: true };

      const id = randomUUID();
      const frontmatter = JSON.stringify({ auxiliar_type, custom_type: custom_type || null });
      db.prepare('INSERT INTO pages (id, title, slug, type, lang, frontmatter, html_content) VALUES (?, ?, ?, ?, ?, ?, ?)').run(id, title, slug, 'auxiliar', 'pt-BR', frontmatter, html_content || null);
      db.prepare('INSERT INTO page_parents (page_id, parent_page_id, is_primary) VALUES (?, ?, 1)').run(id, parent_page_id);

      logActivity(db, apiKey, 'create_auxiliar', 'page', id, title, { auxiliar_type, parent_page_id, slug });
      const page = db.prepare('SELECT * FROM pages WHERE id = ?').get(id);
      return { content: [{ type: 'text', text: JSON.stringify(page) }] };
    }

    case 'list_funnels': {
      let sql = 'SELECT * FROM funnels';
      const binds = [];
      if (params.status) { sql += ' WHERE status = ?'; binds.push(params.status); }
      sql += ' ORDER BY created_at DESC';
      const funnels = db.prepare(sql).all(...binds);
      logActivity(db, apiKey, 'list_funnels', 'funnel', null, null, params.status ? { status: params.status } : null);
      return { content: [{ type: 'text', text: JSON.stringify(funnels) }] };
    }

    case 'get_funnel': {
      const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(params.id);
      if (!funnel) return { content: [{ type: 'text', text: JSON.stringify({ error: 'Funnel not found' }) }], isError: true };
      funnel.graph_data = JSON.parse(funnel.graph_data);
      logActivity(db, apiKey, 'get_funnel', 'funnel', funnel.id, funnel.name, null);
      return { content: [{ type: 'text', text: JSON.stringify(funnel) }] };
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
