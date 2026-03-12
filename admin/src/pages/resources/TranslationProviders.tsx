import { useState, useEffect, useCallback } from 'react';
import { Plug, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

interface Provider {
  id: string;
  provider: string;
  api_key: string;
  model: string | null;
  active: number;
  created_at: string;
}

interface ProviderForm {
  provider: string;
  api_key: string;
  model: string;
  active: boolean;
}

const emptyForm: ProviderForm = { provider: 'google', api_key: '', model: '', active: true };

export default function TranslationProviders() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<ProviderForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Provider | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const fetchProviders = useCallback(async () => {
    try {
      const data = await api.get<Provider[]>('/translation-providers');
      setProviders(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (provider: Provider) => {
    setEditing(provider);
    setForm({
      provider: provider.provider,
      api_key: '',
      model: provider.model || '',
      active: !!provider.active,
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        provider: form.provider,
        model: form.model || null,
        active: form.active ? 1 : 0,
      };
      if (form.api_key) {
        body.api_key = form.api_key;
      }
      if (editing) {
        await api.put(`/translation-providers/${editing.id}`, body);
      } else {
        body.api_key = form.api_key;
        await api.post('/translation-providers', body);
      }
      setModalOpen(false);
      fetchProviders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar provedor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/translation-providers/${deleteTarget.id}`);
      setProviders((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (provider: Provider) => {
    try {
      await api.put(`/translation-providers/${provider.id}`, {
        provider: provider.provider,
        model: provider.model,
        active: provider.active ? 0 : 1,
      });
      fetchProviders();
    } catch {
      // silently fail
    }
  };

  const providerLabel = (p: string) => p === 'google' ? 'Google Translate' : 'OpenAI';

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-accent/10 p-2.5">
            <Plug className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Provedores de Tradução</h1>
            <p className="text-sm text-text-muted">Configure os provedores de tradução automática.</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Novo Provedor
        </button>
      </div>

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/4" />
              <div className="h-4 bg-surface-2 rounded w-1/6" />
              <div className="h-4 bg-surface-2 rounded w-1/6" />
              <div className="h-5 bg-surface-2 rounded-full w-16 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!loading && providers.length === 0 && (
        <EmptyState
          icon={Plug}
          title="Nenhum provedor configurado"
          description="Adicione um provedor de tradução para começar."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Novo Provedor
            </button>
          }
        />
      )}

      {!loading && providers.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Provedor</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">API Key</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Modelo</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Status</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Criado em</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                  <td className="px-6 py-4">
                    <span className="text-text font-medium">{providerLabel(provider.provider)}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-text-muted font-mono">{provider.api_key}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-text-muted">{provider.model || '\u2014'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => handleToggleActive(provider)}
                      className="cursor-pointer focus:outline-none"
                      title={provider.active ? 'Desativar' : 'Ativar'}
                    >
                      <Badge variant={provider.active ? 'success' : 'default'} dot>
                        {provider.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-6 py-4 text-text-muted text-sm">{formatDate(provider.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(provider)}
                        aria-label={`Editar ${providerLabel(provider.provider)}`}
                        title={`Editar ${providerLabel(provider.provider)}`}
                        className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(provider)}
                        aria-label={`Excluir ${providerLabel(provider.provider)}`}
                        title={`Excluir ${providerLabel(provider.provider)}`}
                        className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-danger/50 focus:outline-none"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Provedor' : 'Novo Provedor'}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="bg-surface-2 border border-border text-text px-4 py-2 rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.provider || (!editing && !form.api_key)}
              className="bg-primary text-bg font-medium px-4 py-2 rounded-md hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          {error && (
            <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-text mb-1">Provedor</label>
            <select
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
            >
              <option value="google">Google Translate</option>
              <option value="openai">OpenAI</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">API Key</label>
            <input
              type="password"
              value={form.api_key}
              onChange={(e) => setForm({ ...form, api_key: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder={editing ? 'Deixe vazio para manter a atual' : 'sk-...'}
            />
            {editing && (
              <p className="text-xs text-text-muted mt-1.5">Deixe vazio para manter a chave atual.</p>
            )}
          </div>
          {form.provider === 'openai' && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">Modelo</label>
              <input
                type="text"
                value={form.model}
                onChange={(e) => setForm({ ...form, model: e.target.value })}
                className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                placeholder="gpt-4o-mini"
              />
              <p className="text-xs text-text-muted mt-1.5">Ex: gpt-4o-mini, claude-sonnet-4-20250514</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm({ ...form, active: !form.active })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none ${
                form.active ? 'bg-primary' : 'bg-surface-2 border border-border'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ${
                  form.active ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            <span className="text-sm text-text">{form.active ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Deseja excluir o provedor "${deleteTarget ? providerLabel(deleteTarget.provider) : ''}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
