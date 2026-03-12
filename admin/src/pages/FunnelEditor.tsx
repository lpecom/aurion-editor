import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Play, Pause, Loader2, Globe } from 'lucide-react';
import {
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type Connection,
} from '@xyflow/react';
import { api } from '../lib/api';
import FunnelCanvas from '../components/funnel/FunnelCanvas';
import NodePalette from '../components/funnel/NodePalette';
import NodeProperties from '../components/funnel/NodeProperties';

interface Domain {
  id: string;
  domain: string;
}

type FunnelNode = Node;
type FunnelEdge = Edge;

interface Funnel {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused';
  graph_data: string | null;
  domain_ids?: string[];
}

export default function FunnelEditor() {
  const { funnelId } = useParams<{ funnelId: string }>();
  const navigate = useNavigate();

  const [funnel, setFunnel] = useState<Funnel | null>(null);
  const [name, setName] = useState('');
  const [nodes, setNodes] = useState<FunnelNode[]>([]);
  const [edges, setEdges] = useState<FunnelEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [showDomainDropdown, setShowDomainDropdown] = useState(false);
  const domainDropdownRef = useRef<HTMLDivElement>(null);

  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch funnel data
  useEffect(() => {
    if (!funnelId) return;
    (async () => {
      try {
        const data = await api.get<Funnel>(`/funnels/${funnelId}`);
        setFunnel(data);
        setName(data.name);
        setSelectedDomainIds(data.domain_ids || []);
        if (data.graph_data) {
          try {
            const parsed = JSON.parse(data.graph_data);
            setNodes(parsed.nodes || []);
            setEdges(parsed.edges || []);
          } catch {
            setNodes([]);
            setEdges([]);
          }
        }
      } catch {
        setError('Falha ao carregar funil');
      }
    })();
  }, [funnelId]);

  // Fetch domains
  useEffect(() => {
    (async () => {
      try {
        const data = await api.get<Domain[]>('/domains');
        setDomains(data);
      } catch {
        // Domains load failed silently
      }
    })();
  }, []);

  // Close domain dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (domainDropdownRef.current && !domainDropdownRef.current.contains(e.target as globalThis.Node)) {
        setShowDomainDropdown(false);
      }
    }
    if (showDomainDropdown) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showDomainDropdown]);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) || null;

  const handleSave = useCallback(async () => {
    if (!funnelId || saving) return;
    setSaving(true);
    setError(null);
    try {
      const graphData = JSON.stringify({ nodes, edges });
      await api.put(`/funnels/${funnelId}`, { name, graph_data: graphData });
      setFunnel((prev) => (prev ? { ...prev, name, graph_data: graphData } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  }, [funnelId, name, nodes, edges, saving]);

  const handleActivate = useCallback(async () => {
    if (!funnelId || activating) return;
    setActivating(true);
    setError(null);
    try {
      const data = await api.post<Funnel>(`/funnels/${funnelId}/activate`);
      setFunnel((prev) => (prev ? { ...prev, status: data.status || 'active' } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao ativar funil');
    } finally {
      setActivating(false);
    }
  }, [funnelId, activating]);

  const handleDeactivate = useCallback(async () => {
    if (!funnelId || activating) return;
    setActivating(true);
    setError(null);
    try {
      const data = await api.post<Funnel>(`/funnels/${funnelId}/deactivate`);
      setFunnel((prev) => (prev ? { ...prev, status: data.status || 'paused' } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao desativar funil');
    } finally {
      setActivating(false);
    }
  }, [funnelId, activating]);

  const handleToggleDomain = useCallback(
    async (domainId: string) => {
      if (!funnelId) return;
      const next = selectedDomainIds.includes(domainId)
        ? selectedDomainIds.filter((id) => id !== domainId)
        : [...selectedDomainIds, domainId];
      setSelectedDomainIds(next);
      try {
        await api.put(`/funnels/${funnelId}/domains`, { domain_ids: next });
      } catch {
        // Revert on failure
        setSelectedDomainIds(selectedDomainIds);
      }
    },
    [funnelId, selectedDomainIds],
  );

  const handleNodeUpdate = useCallback(
    (nodeId: string, data: Record<string, unknown>) => {
      setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n)));
    },
    [],
  );

  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
      setSelectedNodeId(null);
    },
    [],
  );

  const handleNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, []);

  const handleEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, []);

  const handleConnect = useCallback((connection: Connection) => {
    setEdges((eds) => addEdge(connection, eds));
  }, []);

  const handleNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData('application/reactflow');
      if (!type) return;

      const reactFlowBounds = (event.target as HTMLElement).closest('.react-flow')?.getBoundingClientRect();
      if (!reactFlowBounds) return;

      const position = {
        x: event.clientX - reactFlowBounds.left,
        y: event.clientY - reactFlowBounds.top,
      };

      const newNode: FunnelNode = {
        id: `${type}-${Date.now()}`,
        type,
        position,
        data: {},
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [],
  );

  if (!funnelId) return null;

  const status = funnel?.status || 'draft';
  const isActive = status === 'active';

  const statusLabel: Record<string, string> = {
    draft: 'Rascunho',
    active: 'Ativo',
    paused: 'Pausado',
  };

  const statusColor: Record<string, string> = {
    draft: 'bg-text-muted/20 text-text-muted',
    active: 'bg-green-500/20 text-green-400',
    paused: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div className="flex flex-col h-screen bg-bg">
      {/* Top toolbar */}
      <header className="h-12 bg-surface/95 backdrop-blur-xl border-b border-border/50 flex items-center px-4 gap-3 shrink-0 z-50">
        <button
          onClick={() => navigate('/admin/funis')}
          className="text-text-muted hover:text-text p-1.5 rounded-md cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          title="Voltar"
          aria-label="Voltar para funis"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Editable funnel name */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="text-lg font-semibold text-text bg-transparent border border-transparent focus:border-border rounded-md px-2 py-0.5 outline-none transition-colors duration-200 min-w-0 max-w-xs"
          placeholder="Nome do funil"
        />

        <div className="flex-1" />

        {/* Error display */}
        {error && (
          <span className="text-red-400 text-sm truncate max-w-xs" title={error}>
            {error}
          </span>
        )}

        {/* Domain selector */}
        <div className="relative" ref={domainDropdownRef}>
          <button
            onClick={() => setShowDomainDropdown((v) => !v)}
            className="text-text-muted hover:text-text border border-border hover:bg-surface-2 px-3 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/50"
          >
            <Globe size={14} />
            {selectedDomainIds.length} {selectedDomainIds.length === 1 ? 'dominio' : 'dominios'}
          </button>

          {showDomainDropdown && (
            <div className="absolute right-0 top-full mt-1 w-64 bg-surface border border-border rounded-lg shadow-lg z-50 py-1 max-h-60 overflow-y-auto">
              {domains.length === 0 && (
                <p className="text-text-muted text-sm px-3 py-2">Nenhum dominio encontrado</p>
              )}
              {domains.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 px-3 py-2 hover:bg-surface-2 cursor-pointer text-sm text-text"
                >
                  <input
                    type="checkbox"
                    checked={selectedDomainIds.includes(d.id)}
                    onChange={() => handleToggleDomain(d.id)}
                    className="rounded border-border accent-primary"
                  />
                  {d.domain}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Status badge */}
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor[status] || statusColor.draft}`}>
          {statusLabel[status] || status}
        </span>

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-primary text-bg hover:bg-primary/90 px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-primary/50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Salvar
        </button>

        {/* Activate / Deactivate button */}
        {isActive ? (
          <button
            onClick={handleDeactivate}
            disabled={activating}
            className="bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
          >
            {activating ? <Loader2 size={14} className="animate-spin" /> : <Pause size={14} />}
            Desativar
          </button>
        ) : (
          <button
            onClick={handleActivate}
            disabled={activating}
            className="bg-green-500/20 text-green-400 hover:bg-green-500/30 px-4 py-1.5 rounded-md text-sm font-medium flex items-center gap-1.5 cursor-pointer transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-green-500/50"
          >
            {activating ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Ativar
          </button>
        )}
      </header>

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel — Node Palette */}
        <aside className="w-56 bg-surface/95 backdrop-blur-xl border-r border-border/50 overflow-y-auto shrink-0">
          <NodePalette />
        </aside>

        {/* Center — Canvas */}
        <main className="flex-1 bg-[#09090b] overflow-hidden">
          <FunnelCanvas
            nodes={nodes}
            edges={edges}
            onNodesChange={handleNodesChange}
            onEdgesChange={handleEdgesChange}
            onConnect={handleConnect}
            onNodeClick={handleNodeClick}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onPaneClick={handlePaneClick}
          />
        </main>

        {/* Right panel — Node Properties */}
        <aside className="w-72 bg-surface/95 backdrop-blur-xl border-l border-border/50 overflow-y-auto shrink-0">
          <NodeProperties
            selectedNode={selectedNode}
            onNodeUpdate={handleNodeUpdate}
            onDeleteNode={handleDeleteNode}
            domains={domains}
          />
        </aside>
      </div>
    </div>
  );
}
