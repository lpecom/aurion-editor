import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GitBranch, Plus, Play, Pause, Copy, Trash2, Pencil, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';
import ConfirmDialog from '../components/ui/ConfirmDialog';

interface Funnel {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused';
  node_count: number;
  domain_count: number;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<Funnel['status'], { label: string; variant: 'default' | 'success' | 'warning' }> = {
  draft: { label: 'Rascunho', variant: 'default' },
  active: { label: 'Ativo', variant: 'success' },
  paused: { label: 'Pausado', variant: 'warning' },
};

export default function Funnels() {
  const navigate = useNavigate();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  }>({ open: false, title: '', message: '', confirmLabel: '', onConfirm: () => {} });

  async function fetchFunnels() {
    setLoading(true);
    try {
      const data = await api.get<Funnel[]>('/funnels');
      setFunnels(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchFunnels();
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const funnel = await api.post<Funnel>('/funnels', { name: 'Novo Funil' });
      navigate(`/funis/${funnel.id}`);
    } catch {
      // silently fail
    } finally {
      setCreating(false);
    }
  }

  async function handleDuplicate(id: string) {
    setActionLoading(id);
    try {
      await api.post(`/funnels/${id}/duplicate`);
      await fetchFunnels();
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  }

  function handleActivate(id: string) {
    setConfirmDialog({
      open: true,
      title: 'Ativar funil?',
      message: 'O funil será ativado e começará a processar leads.',
      confirmLabel: 'Ativar',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        setActionLoading(id);
        try {
          await api.post(`/funnels/${id}/activate`);
          await fetchFunnels();
        } catch {
          // silently fail
        } finally {
          setActionLoading(null);
        }
      },
    });
  }

  async function handleDeactivate(id: string) {
    setActionLoading(id);
    try {
      await api.post(`/funnels/${id}/deactivate`);
      await fetchFunnels();
    } catch {
      // silently fail
    } finally {
      setActionLoading(null);
    }
  }

  function handleDelete(id: string) {
    setConfirmDialog({
      open: true,
      title: 'Excluir funil?',
      message: 'Esta ação não pode ser desfeita. O funil e todos os seus dados serão removidos.',
      confirmLabel: 'Excluir',
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, open: false }));
        setActionLoading(id);
        try {
          await api.delete(`/funnels/${id}`);
          await fetchFunnels();
        } catch {
          // silently fail
        } finally {
          setActionLoading(null);
        }
      },
    });
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5 ring-1 ring-primary/20">
            <GitBranch className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Funis de Venda</h1>
            <p className="text-sm text-text-muted">Construa funis visuais para controlar o caminho do lead.</p>
          </div>
        </div>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 bg-primary text-bg font-medium px-4 py-2.5 rounded-xl cursor-pointer hover:bg-primary/90 transition-all duration-200 disabled:opacity-50 shadow-lg shadow-primary/20"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Novo Funil
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-5 animate-pulse">
              <div className="h-5 w-32 bg-surface-2 rounded mb-3" />
              <div className="h-4 w-20 bg-surface-2 rounded-full mb-4" />
              <div className="flex gap-4 mb-4">
                <div className="h-4 w-16 bg-surface-2 rounded" />
                <div className="h-4 w-16 bg-surface-2 rounded" />
              </div>
              <div className="h-4 w-24 bg-surface-2 rounded" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && funnels.length === 0 && (
        <EmptyState
          icon={GitBranch}
          title="Nenhum funil criado"
          description="Crie seu primeiro funil de venda para começar a guiar seus leads."
          action={
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex items-center gap-2 bg-primary text-bg font-medium px-4 py-2 rounded-lg cursor-pointer hover:bg-primary/90 transition-colors duration-200 disabled:opacity-50"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Novo Funil
            </button>
          }
        />
      )}

      {/* Funnels grid */}
      {!loading && funnels.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {funnels.map((funnel) => {
            const status = statusConfig[funnel.status];
            const isLoading = actionLoading === funnel.id;
            return (
              <div
                key={funnel.id}
                className="bg-surface border border-border/50 rounded-2xl p-5 relative card-hover"
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-surface/60 rounded-lg flex items-center justify-center z-10">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                )}

                {/* Name & Status */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-text truncate">{funnel.name}</h3>
                  <Badge variant={status.variant} dot>{status.label}</Badge>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-4 text-xs text-text-muted mb-3">
                  <span>{funnel.node_count} {funnel.node_count === 1 ? 'nó' : 'nós'}</span>
                  <span>{funnel.domain_count} {funnel.domain_count === 1 ? 'domínio' : 'domínios'}</span>
                </div>

                {/* Created date */}
                <p className="text-xs text-text-muted mb-4">Criado em {formatDate(funnel.created_at)}</p>

                {/* Actions */}
                <div className="flex items-center gap-1 border-t border-border/30 pt-3 -mx-5 px-5">
                  <button
                    onClick={() => navigate(`/funis/${funnel.id}`)}
                    title="Editar"
                    className="p-2 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors duration-200"
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDuplicate(funnel.id)}
                    title="Duplicar"
                    className="p-2 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 cursor-pointer transition-colors duration-200"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {funnel.status === 'active' ? (
                    <button
                      onClick={() => handleDeactivate(funnel.id)}
                      title="Pausar"
                      className="p-2 rounded-md text-text-muted hover:text-warning hover:bg-warning/10 cursor-pointer transition-colors duration-200"
                    >
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={() => handleActivate(funnel.id)}
                      title="Ativar"
                      className="p-2 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors duration-200"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(funnel.id)}
                    title="Excluir"
                    className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors duration-200 ml-auto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
      />
    </div>
  );
}
