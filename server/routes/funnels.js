// server/routes/funnels.js
import { randomUUID } from 'node:crypto';
import { getDb } from '../db/index.js';
import { authMiddleware } from '../middleware/auth.js';
import { uploadToR2, deleteFromR2 } from '../lib/cloudflare.js';

/**
 * Compile funnel graph_data into a deployment JSON structure.
 */
function compileFunnel(graphData, db) {
  const { nodes, edges } = graphData;
  const entryNode = nodes.find(n => n.type === 'entry');
  const entrySlug = entryNode.data.entry_slug;

  const compiled = {
    funnel_id: null, // set by caller
    status: 'active',
    entry_slug: entrySlug,
    kv_ttl_days: 30,
    pages: {},
    redirects: {},
  };

  // Build edge map: source -> target
  const edgeMap = {};
  for (const edge of edges) {
    edgeMap[edge.source] = edge.target;
  }

  // Process nodes
  for (const node of nodes) {
    if (node.type === 'entry') {
      const targetNodeId = edgeMap[node.id];
      const targetNode = nodes.find(n => n.id === targetNodeId);
      if (targetNode && targetNode.type === 'page') {
        compiled.pages[entrySlug] = {
          page_slug: targetNode.data.slug,
          serve_slug: targetNode.data.slug,
          rewrites: { auto: {}, selectors: [] },
        };
      }
    } else if (node.type === 'page') {
      const targetNodeId = edgeMap[node.id];
      const targetNode = targetNodeId ? nodes.find(n => n.id === targetNodeId) : null;

      let nextHref = null;
      if (targetNode?.type === 'page') nextHref = '/' + targetNode.data.slug;
      else if (targetNode?.type === 'redirect') nextHref = targetNode.data.url;

      const rewrites = { auto: {}, selectors: [] };
      if (nextHref && node.data.cta_selector) {
        rewrites.selectors.push({ pattern: node.data.cta_selector, href: nextHref });
      }
      // Auto-rewrites: map any internal slug that matches a funnel page to its correct next step
      if (nextHref) {
        for (const otherNode of nodes) {
          if (otherNode.type === 'page' && otherNode.id !== node.id) {
            rewrites.auto['/' + otherNode.data.slug] = '/' + otherNode.data.slug;
          }
        }
      }

      compiled.pages[node.data.slug] = {
        page_slug: node.data.slug,
        serve_slug: node.data.slug,
        rewrites,
        next_href: nextHref,
      };
    } else if (node.type === 'redirect') {
      compiled.redirects[node.id] = {
        url: node.data.url,
        status_code: node.data.status_code || 302,
      };
    }
  }

  return compiled;
}

/**
 * Get domains associated with a funnel via funnel_domains.
 */
function getFunnelDomains(db, funnelId) {
  return db.prepare(`
    SELECT d.* FROM domains d
    JOIN funnel_domains fd ON fd.domain_id = d.id
    WHERE fd.funnel_id = ?
    ORDER BY d.domain ASC
  `).all(funnelId);
}

/**
 * Upload compiled funnel JSON to R2 for all associated domains.
 */
async function deployFunnelToDomains(db, funnel, compiledJson, entrySlug, domains) {
  for (const domain of domains) {
    if (!domain.cloudflare_account_id || !domain.r2_bucket) continue;
    const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(domain.cloudflare_account_id);
    if (!cfAccount) continue;
    await uploadToR2(cfAccount, domain.r2_bucket, `_funnels/${entrySlug}.json`, JSON.stringify(compiledJson));
  }
}

/**
 * Remove funnel JSON from R2 for all associated domains.
 */
async function removeFunnelFromDomains(db, entrySlug, domains) {
  for (const domain of domains) {
    if (!domain.cloudflare_account_id || !domain.r2_bucket) continue;
    const cfAccount = db.prepare('SELECT * FROM cloudflare_accounts WHERE id = ?').get(domain.cloudflare_account_id);
    if (!cfAccount) continue;
    try {
      await deleteFromR2(cfAccount, domain.r2_bucket, `_funnels/${entrySlug}.json`);
    } catch (err) {
      // Ignore delete errors (file may not exist)
    }
  }
}

/**
 * Validate funnel graph_data before activation.
 * Returns { valid: true } or { valid: false, error: string }.
 */
function validateFunnel(graphData, db, funnelId) {
  const { nodes, edges } = graphData;

  // 1. Exactly 1 entry node
  const entryNodes = nodes.filter(n => n.type === 'entry');
  if (entryNodes.length !== 1) {
    return { valid: false, error: `Expected exactly 1 entry node, found ${entryNodes.length}` };
  }
  const entryNode = entryNodes[0];
  const entrySlug = entryNode.data?.entry_slug;
  if (!entrySlug) {
    return { valid: false, error: 'Entry node is missing entry_slug' };
  }

  // 2. All page nodes reference existing pages
  const pageNodes = nodes.filter(n => n.type === 'page');
  for (const pn of pageNodes) {
    if (!pn.data?.slug) {
      return { valid: false, error: `Page node ${pn.id} is missing slug` };
    }
    const page = db.prepare('SELECT id FROM pages WHERE slug = ?').get(pn.data.slug);
    if (!page) {
      return { valid: false, error: `Page node references non-existent page slug: ${pn.data.slug}` };
    }
  }

  // 3. No orphan nodes (all nodes connected via edges)
  const connectedNodeIds = new Set();
  for (const edge of edges) {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  }
  for (const node of nodes) {
    if (!connectedNodeIds.has(node.id)) {
      // Allow leaf redirect nodes that are targets but not sources
      return { valid: false, error: `Orphan node detected: ${node.id} (${node.type})` };
    }
  }

  // 4. Page/entry nodes have max 1 outgoing edge
  const outgoingCount = {};
  for (const edge of edges) {
    outgoingCount[edge.source] = (outgoingCount[edge.source] || 0) + 1;
  }
  for (const node of nodes) {
    if ((node.type === 'entry' || node.type === 'page') && (outgoingCount[node.id] || 0) > 1) {
      return { valid: false, error: `Node ${node.id} (${node.type}) has more than 1 outgoing edge` };
    }
  }

  // 5. No cycles (DFS)
  const adjList = {};
  for (const edge of edges) {
    if (!adjList[edge.source]) adjList[edge.source] = [];
    adjList[edge.source].push(edge.target);
  }
  const visited = new Set();
  const inStack = new Set();
  function hasCycle(nodeId) {
    if (inStack.has(nodeId)) return true;
    if (visited.has(nodeId)) return false;
    visited.add(nodeId);
    inStack.add(nodeId);
    for (const neighbor of (adjList[nodeId] || [])) {
      if (hasCycle(neighbor)) return true;
    }
    inStack.delete(nodeId);
    return false;
  }
  for (const node of nodes) {
    if (hasCycle(node.id)) {
      return { valid: false, error: 'Cycle detected in funnel graph' };
    }
  }

  // 6. entry_slug not used by another active funnel
  const conflictingFunnel = db.prepare(`
    SELECT id, name FROM funnels WHERE status = 'active' AND id != ?
  `).all(funnelId);
  for (const other of conflictingFunnel) {
    try {
      const otherGraph = JSON.parse(other.graph_data || '{"nodes":[],"edges":[]}');
      const otherEntry = otherGraph.nodes?.find(n => n.type === 'entry');
      if (otherEntry?.data?.entry_slug === entrySlug) {
        return { valid: false, error: `entry_slug "${entrySlug}" is already used by active funnel "${other.name}"` };
      }
    } catch {
      // skip malformed graph_data
    }
  }

  // 7. entry_slug not matching an existing published page slug
  const existingPage = db.prepare("SELECT id FROM pages WHERE slug = ? AND status = 'published'").get(entrySlug);
  if (existingPage) {
    return { valid: false, error: `entry_slug "${entrySlug}" conflicts with an existing published page slug` };
  }

  return { valid: true };
}

export default async function funnelsRoutes(fastify) {
  fastify.addHook('preHandler', authMiddleware);

  // GET /api/funnels — list all funnels
  fastify.get('/funnels', async () => {
    const db = getDb();
    const funnels = db.prepare('SELECT * FROM funnels ORDER BY created_at DESC').all();

    return funnels.map(f => {
      const domainCount = db.prepare('SELECT COUNT(*) as cnt FROM funnel_domains WHERE funnel_id = ?').get(f.id).cnt;
      let nodeCount = 0;
      try {
        const graphData = JSON.parse(f.graph_data || '{"nodes":[],"edges":[]}');
        nodeCount = graphData.nodes?.length || 0;
      } catch {
        // ignore parse errors
      }
      return {
        id: f.id,
        name: f.name,
        description: f.description,
        status: f.status,
        node_count: nodeCount,
        domain_count: domainCount,
        created_at: f.created_at,
        updated_at: f.updated_at,
      };
    });
  });

  // POST /api/funnels — create funnel
  fastify.post('/funnels', {
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const id = randomUUID();
    const { name, description } = request.body;

    db.prepare(`
      INSERT INTO funnels (id, name, description, status, graph_data)
      VALUES (?, ?, ?, 'draft', '{"nodes":[],"edges":[]}')
    `).run(id, name, description || null);

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    reply.code(201).send(funnel);
  });

  // GET /api/funnels/:id — get funnel with graph_data and domains
  fastify.get('/funnels/:id', async (request, reply) => {
    const db = getDb();
    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(request.params.id);
    if (!funnel) return reply.code(404).send({ error: 'Funnel not found' });

    let graphData = { nodes: [], edges: [] };
    try {
      graphData = JSON.parse(funnel.graph_data || '{"nodes":[],"edges":[]}');
    } catch {
      // ignore
    }

    const domains = getFunnelDomains(db, funnel.id);

    return {
      ...funnel,
      graph_data: graphData,
      domains,
    };
  });

  // PUT /api/funnels/:id — update funnel
  fastify.put('/funnels/:id', {
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: 'string' },
          graph_data: { type: 'object' },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const existing = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    if (!existing) return reply.code(404).send({ error: 'Funnel not found' });

    const { name, description, graph_data } = request.body;

    db.prepare(`
      UPDATE funnels SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        graph_data = COALESCE(?, graph_data),
        updated_at = datetime('now')
      WHERE id = ?
    `).run(
      name || null,
      description !== undefined ? description : null,
      graph_data ? JSON.stringify(graph_data) : null,
      id
    );

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    let parsedGraph = { nodes: [], edges: [] };
    try {
      parsedGraph = JSON.parse(funnel.graph_data || '{"nodes":[],"edges":[]}');
    } catch {
      // ignore
    }

    return {
      ...funnel,
      graph_data: parsedGraph,
    };
  });

  // POST /api/funnels/:id/activate — validate, compile, upload to R2
  fastify.post('/funnels/:id/activate', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    if (!funnel) return reply.code(404).send({ error: 'Funnel not found' });

    let graphData;
    try {
      graphData = JSON.parse(funnel.graph_data || '{"nodes":[],"edges":[]}');
    } catch {
      return reply.code(400).send({ error: 'Invalid graph_data JSON' });
    }

    // Validate
    const validation = validateFunnel(graphData, db, id);
    if (!validation.valid) {
      return reply.code(400).send({ error: validation.error });
    }

    // Compile
    const compiled = compileFunnel(graphData, db);
    compiled.funnel_id = id;

    const entrySlug = compiled.entry_slug;

    // Upload to R2 for each associated domain
    const domains = getFunnelDomains(db, id);
    try {
      await deployFunnelToDomains(db, funnel, compiled, entrySlug, domains);
    } catch (err) {
      return reply.code(500).send({ error: `R2 upload failed: ${err.message}` });
    }

    // Set status to active
    db.prepare("UPDATE funnels SET status = 'active', updated_at = datetime('now') WHERE id = ?").run(id);

    const updated = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    return {
      ...updated,
      graph_data: graphData,
      domains,
    };
  });

  // POST /api/funnels/:id/deactivate — remove from R2, set paused
  fastify.post('/funnels/:id/deactivate', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    if (!funnel) return reply.code(404).send({ error: 'Funnel not found' });

    let graphData;
    try {
      graphData = JSON.parse(funnel.graph_data || '{"nodes":[],"edges":[]}');
    } catch {
      return reply.code(400).send({ error: 'Invalid graph_data JSON' });
    }

    const entryNode = graphData.nodes?.find(n => n.type === 'entry');
    const entrySlug = entryNode?.data?.entry_slug;

    if (entrySlug) {
      const domains = getFunnelDomains(db, id);
      await removeFunnelFromDomains(db, entrySlug, domains);
    }

    db.prepare("UPDATE funnels SET status = 'paused', updated_at = datetime('now') WHERE id = ?").run(id);

    const updated = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    return {
      ...updated,
      graph_data: graphData,
    };
  });

  // DELETE /api/funnels/:id — deactivate if active, then delete
  fastify.delete('/funnels/:id', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    if (!funnel) return reply.code(404).send({ error: 'Funnel not found' });

    // If active, deactivate first (remove from R2)
    if (funnel.status === 'active') {
      let graphData;
      try {
        graphData = JSON.parse(funnel.graph_data || '{"nodes":[],"edges":[]}');
      } catch {
        graphData = { nodes: [], edges: [] };
      }
      const entryNode = graphData.nodes?.find(n => n.type === 'entry');
      const entrySlug = entryNode?.data?.entry_slug;
      if (entrySlug) {
        const domains = getFunnelDomains(db, id);
        await removeFunnelFromDomains(db, entrySlug, domains);
      }
    }

    db.prepare('DELETE FROM funnels WHERE id = ?').run(id);
    return { ok: true };
  });

  // PUT /api/funnels/:id/domains — set domain associations
  fastify.put('/funnels/:id/domains', {
    schema: {
      body: {
        type: 'object',
        required: ['domain_ids'],
        properties: {
          domain_ids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, async (request, reply) => {
    const db = getDb();
    const { id } = request.params;
    const { domain_ids } = request.body;

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    if (!funnel) return reply.code(404).send({ error: 'Funnel not found' });

    const oldDomains = getFunnelDomains(db, id);

    // Replace associations
    const tx = db.transaction(() => {
      db.prepare('DELETE FROM funnel_domains WHERE funnel_id = ?').run(id);
      const insert = db.prepare('INSERT INTO funnel_domains (funnel_id, domain_id) VALUES (?, ?)');
      for (const domainId of domain_ids) {
        insert.run(id, domainId);
      }
    });
    tx();

    const newDomains = getFunnelDomains(db, id);

    // If funnel is active, re-deploy: remove from old domains, upload to new ones
    if (funnel.status === 'active') {
      let graphData;
      try {
        graphData = JSON.parse(funnel.graph_data || '{"nodes":[],"edges":[]}');
      } catch {
        graphData = { nodes: [], edges: [] };
      }
      const entryNode = graphData.nodes?.find(n => n.type === 'entry');
      const entrySlug = entryNode?.data?.entry_slug;

      if (entrySlug) {
        // Remove from old domains
        await removeFunnelFromDomains(db, entrySlug, oldDomains);

        // Deploy to new domains
        const compiled = compileFunnel(graphData, db);
        compiled.funnel_id = id;
        await deployFunnelToDomains(db, funnel, compiled, entrySlug, newDomains);
      }
    }

    return { ok: true, domains: newDomains };
  });

  // POST /api/funnels/:id/duplicate — clone funnel
  fastify.post('/funnels/:id/duplicate', async (request, reply) => {
    const db = getDb();
    const { id } = request.params;

    const funnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(id);
    if (!funnel) return reply.code(404).send({ error: 'Funnel not found' });

    const newId = randomUUID();
    const newName = `Cópia de ${funnel.name}`;

    db.prepare(`
      INSERT INTO funnels (id, name, description, status, graph_data)
      VALUES (?, ?, ?, 'draft', ?)
    `).run(newId, newName, funnel.description, funnel.graph_data);

    // Copy funnel_domains
    const domains = db.prepare('SELECT domain_id FROM funnel_domains WHERE funnel_id = ?').all(id);
    const insert = db.prepare('INSERT INTO funnel_domains (funnel_id, domain_id) VALUES (?, ?)');
    for (const d of domains) {
      insert.run(newId, d.domain_id);
    }

    const newFunnel = db.prepare('SELECT * FROM funnels WHERE id = ?').get(newId);
    reply.code(201).send(newFunnel);
  });
}
