import { useState, useEffect, useCallback } from 'react';
import { Code, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

interface Pixel {
  id: number;
  name: string;
  type: string;
  pixel_id: string;
  config: string | null;
  created_at: string;
}

interface PixelForm {
  name: string;
  type: string;
  pixel_id: string;
  config: string;
}

const PIXEL_TYPES = ['Facebook Pixel', 'Google Analytics', 'Google Ads', 'TikTok Pixel', 'Custom'];

const PIXEL_TYPE_DESCRIPTIONS: Record<string, string> = {
  'Facebook Pixel': 'Rastreamento de conversoes e eventos do Meta Ads.',
  'Google Analytics': 'Analise de trafego e comportamento de usuarios.',
  'Google Ads': 'Rastreamento de conversoes do Google Ads.',
  'TikTok Pixel': 'Rastreamento de eventos do TikTok Ads.',
  'Custom': 'Pixel personalizado com configuracao JSON.',
};

const emptyForm: PixelForm = { name: '', type: 'Facebook Pixel', pixel_id: '', config: '' };

function typeBadgeVariant(type: string) {
  switch (type) {
    case 'Facebook Pixel': return 'info' as const;
    case 'Google Analytics': return 'warning' as const;
    case 'Google Ads': return 'success' as const;
    case 'TikTok Pixel': return 'danger' as const;
    default: return 'default' as const;
  }
}

export default function Pixels() {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pixel | null>(null);
  const [form, setForm] = useState<PixelForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pixel | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchPixels = useCallback(async () => {
    try {
      const data = await api.get<Pixel[]>('/pixels');
      setPixels(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPixels();
  }, [fetchPixels]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (pixel: Pixel) => {
    setEditing(pixel);
    setForm({
      name: pixel.name,
      type: pixel.type,
      pixel_id: pixel.pixel_id,
      config: pixel.config || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        type: form.type,
        pixel_id: form.pixel_id,
        config: form.config || null,
      };
      if (editing) {
        await api.put(`/pixels/${editing.id}`, body);
      } else {
        await api.post('/pixels', body);
      }
      setModalOpen(false);
      fetchPixels();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/pixels/${deleteTarget.id}`);
      setPixels((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Code className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Pixels</h1>
            <p className="text-sm text-text-muted">Gerencie seus pixels de rastreamento e conversao.</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Novo Pixel
        </button>
      </div>

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/4" />
              <div className="h-5 bg-surface-2 rounded-full w-24" />
              <div className="h-4 bg-surface-2 rounded w-1/5" />
              <div className="h-4 bg-surface-2 rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!loading && pixels.length === 0 && (
        <EmptyState
          icon={Code}
          title="Nenhum pixel configurado"
          description="Adicione seu primeiro pixel de rastreamento."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Novo Pixel
            </button>
          }
        />
      )}

      {!loading && pixels.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Nome</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Tipo</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Pixel ID</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Criado em</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pixels.map((pixel) => (
                <tr key={pixel.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                  <td className="px-6 py-4 text-text font-medium">{pixel.name}</td>
                  <td className="px-6 py-4">
                    <Badge variant={typeBadgeVariant(pixel.type)} dot>{pixel.type}</Badge>
                  </td>
                  <td className="px-6 py-4 text-text-muted font-mono text-sm">{pixel.pixel_id}</td>
                  <td className="px-6 py-4 text-text-muted text-sm">{formatDate(pixel.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(pixel)}
                        aria-label={`Editar ${pixel.name}`}
                        title={`Editar ${pixel.name}`}
                        className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(pixel)}
                        aria-label={`Excluir ${pixel.name}`}
                        title={`Excluir ${pixel.name}`}
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
        title={editing ? 'Editar Pixel' : 'Novo Pixel'}
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
              disabled={saving || !form.name || !form.pixel_id}
              className="bg-primary text-bg font-medium px-4 py-2 rounded-md hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="Meu Pixel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none cursor-pointer transition-colors duration-200"
            >
              {PIXEL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1.5">{PIXEL_TYPE_DESCRIPTIONS[form.type]}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Pixel ID</label>
            <input
              type="text"
              value={form.pixel_id}
              onChange={(e) => setForm({ ...form, pixel_id: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="123456789"
            />
          </div>
          {form.type === 'Custom' && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">Configuracoes (JSON)</label>
              <textarea
                value={form.config}
                onChange={(e) => setForm({ ...form, config: e.target.value })}
                rows={4}
                className="w-full bg-bg border border-border text-text rounded-md px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                placeholder='{"events": ["PageView"]}'
              />
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Deseja excluir o pixel "${deleteTarget?.name}"? Esta acao nao pode ser desfeita.`}
      />
    </div>
  );
}
