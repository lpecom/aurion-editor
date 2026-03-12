import { useState, useEffect, useCallback } from 'react';
import { Globe, Plus, Pencil, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';

interface Language {
  id: string;
  code: string;
  name: string;
  flag: string | null;
  created_at: string;
}

interface LanguageForm {
  code: string;
  name: string;
  flag: string;
}

const emptyForm: LanguageForm = { code: '', name: '', flag: '' };

export default function Languages() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Language | null>(null);
  const [form, setForm] = useState<LanguageForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Language | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const fetchLanguages = useCallback(async () => {
    try {
      const data = await api.get<Language[]>('/languages');
      setLanguages(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLanguages();
  }, [fetchLanguages]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (lang: Language) => {
    setEditing(lang);
    setForm({
      code: lang.code,
      name: lang.name,
      flag: lang.flag || '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      if (editing) {
        await api.put(`/languages/${editing.id}`, {
          code: form.code,
          name: form.name,
          flag: form.flag || null,
        });
      } else {
        await api.post('/languages', {
          code: form.code,
          name: form.name,
          flag: form.flag || null,
        });
      }
      setModalOpen(false);
      fetchLanguages();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar idioma');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/languages/${deleteTarget.id}`);
      setLanguages((prev) => prev.filter((l) => l.id !== deleteTarget.id));
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
          <div className="rounded-xl bg-accent/10 p-2.5">
            <Globe className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Idiomas</h1>
            <p className="text-sm text-text-muted">Gerencie os idiomas disponíveis para tradução.</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Novo Idioma
        </button>
      </div>

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-6 w-6 bg-surface-2 rounded" />
              <div className="h-4 bg-surface-2 rounded w-1/4" />
              <div className="h-4 bg-surface-2 rounded w-1/6" />
              <div className="h-4 bg-surface-2 rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!loading && languages.length === 0 && (
        <EmptyState
          icon={Globe}
          title="Nenhum idioma configurado"
          description="Adicione seu primeiro idioma para começar a traduzir."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Novo Idioma
            </button>
          }
        />
      )}

      {!loading && languages.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Bandeira</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Nome</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Código</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Criado em</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {languages.map((lang) => (
                <tr key={lang.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                  <td className="px-6 py-4">
                    <span className="text-xl">{lang.flag || '\u2014'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-text font-medium">{lang.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-text-muted font-mono">{lang.code}</span>
                  </td>
                  <td className="px-6 py-4 text-text-muted text-sm">{formatDate(lang.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(lang)}
                        aria-label={`Editar ${lang.name}`}
                        title={`Editar ${lang.name}`}
                        className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(lang)}
                        aria-label={`Excluir ${lang.name}`}
                        title={`Excluir ${lang.name}`}
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
        title={editing ? 'Editar Idioma' : 'Novo Idioma'}
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
              disabled={saving || !form.code || !form.name}
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
            <label className="block text-sm font-medium text-text mb-1">Código</label>
            <input
              type="text"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="en-US"
            />
            <p className="text-xs text-text-muted mt-1.5">Ex: en-US, es-ES, fr-FR</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="English (US)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Bandeira (emoji)</label>
            <input
              type="text"
              value={form.flag}
              onChange={(e) => setForm({ ...form, flag: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="\u{1F1FA}\u{1F1F8}"
            />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Deseja excluir o idioma "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
