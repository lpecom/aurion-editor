import { useState, useEffect, useCallback } from 'react';
import { Terminal, Plus, Pencil, Trash2, Eye } from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import ResourceFolderNav from '../../components/ResourceFolderNav';

interface Script {
  id: number;
  name: string;
  position: string;
  code: string;
  active: number;
  created_at: string;
}

interface ScriptForm {
  name: string;
  position: string;
  code: string;
  active: number;
}

const emptyForm: ScriptForm = { name: '', position: 'head', code: '', active: 1 };

const POSITION_LABELS: Record<string, string> = {
  head: 'Head',
  body_start: 'Inicio do Body',
  body_end: 'Final do Body',
};

function positionBadgeVariant(pos: string) {
  switch (pos) {
    case 'head': return 'info' as const;
    case 'body_start': return 'warning' as const;
    case 'body_end': return 'success' as const;
    default: return 'default' as const;
  }
}

export default function Scripts() {
  const [scripts, setScripts] = useState<Script[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Script | null>(null);
  const [form, setForm] = useState<ScriptForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Script | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [previewScript, setPreviewScript] = useState<Script | null>(null);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const fetchScripts = useCallback(async () => {
    try {
      const data = await api.get<Script[]>('/scripts');
      setScripts(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (script: Script) => {
    setEditing(script);
    setForm({
      name: script.name,
      position: script.position,
      code: script.code,
      active: script.active,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body = {
        name: form.name,
        position: form.position,
        code: form.code,
        active: form.active,
      };
      if (editing) {
        await api.put(`/scripts/${editing.id}`, body);
      } else {
        await api.post('/scripts', { name: form.name, position: form.position, code: form.code });
      }
      setModalOpen(false);
      fetchScripts();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (script: Script) => {
    const newActive = script.active ? 0 : 1;
    try {
      await api.put(`/scripts/${script.id}`, {
        name: script.name,
        position: script.position,
        code: script.code,
        active: newActive,
      });
      setScripts((prev) =>
        prev.map((s) => (s.id === script.id ? { ...s, active: newActive } : s))
      );
    } catch {
      // silently fail
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/scripts/${deleteTarget.id}`);
      setScripts((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const addLineNumbers = (code: string) => {
    return code.split('\n').map((line, i) => (
      <div key={i} className="flex">
        <span className="select-none text-text-muted/40 w-8 shrink-0 text-right pr-3">{i + 1}</span>
        <span className="flex-1">{line || ' '}</span>
      </div>
    ));
  };

  return (
    <div className="flex -m-6 h-[calc(100vh-3.5rem)]">
      <ResourceFolderNav selectedPageId={selectedPageId} onSelectPage={setSelectedPageId} />
      <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Terminal className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Scripts</h1>
            <p className="text-sm text-text-muted">Gerencie scripts personalizados injetados nas suas páginas.</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Novo Script
        </button>
      </div>

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/4" />
              <div className="h-5 bg-surface-2 rounded-full w-20" />
              <div className="h-7 bg-surface-2 rounded-full w-12" />
              <div className="h-4 bg-surface-2 rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!loading && scripts.length === 0 && (
        <EmptyState
          icon={Terminal}
          title="Nenhum script configurado"
          description="Adicione seu primeiro script personalizado."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Novo Script
            </button>
          }
        />
      )}

      {!loading && scripts.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Nome</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Posicao</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Status</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {scripts.map((script) => (
                <tr key={script.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                  <td className="px-6 py-4 text-text font-medium">{script.name}</td>
                  <td className="px-6 py-4">
                    <Badge variant={positionBadgeVariant(script.position)} dot>
                      {POSITION_LABELS[script.position] || script.position}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      onClick={() => toggleActive(script)}
                      aria-label={script.active ? 'Desativar script' : 'Ativar script'}
                      className={`relative inline-flex h-7 w-12 items-center rounded-full cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none ${
                        script.active ? 'bg-primary' : 'bg-surface-2 border border-border'
                      }`}
                    >
                      <span
                        className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                          script.active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setPreviewScript(script)}
                        aria-label={`Visualizar codigo de ${script.name}`}
                        title={`Visualizar codigo de ${script.name}`}
                        className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => openEdit(script)}
                        aria-label={`Editar ${script.name}`}
                        title={`Editar ${script.name}`}
                        className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(script)}
                        aria-label={`Excluir ${script.name}`}
                        title={`Excluir ${script.name}`}
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
        title={editing ? 'Editar Script' : 'Novo Script'}
        maxWidth="max-w-2xl"
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
              disabled={saving || !form.name || !form.code}
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
              placeholder="Google Tag Manager"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Posicao</label>
            <select
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none cursor-pointer transition-colors duration-200"
            >
              <option value="head">Head</option>
              <option value="body_start">Inicio do Body</option>
              <option value="body_end">Final do Body</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Codigo</label>
            <textarea
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
              rows={10}
              className="w-full bg-bg border border-border text-primary/90 rounded-lg px-4 py-3 font-mono text-sm min-h-[200px] leading-relaxed focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="<script>...</script>"
            />
          </div>
          {editing && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-text">Ativo</label>
              <button
                type="button"
                onClick={() => setForm({ ...form, active: form.active ? 0 : 1 })}
                aria-label={form.active ? 'Desativar script' : 'Ativar script'}
                className={`relative inline-flex h-7 w-12 items-center rounded-full cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none ${
                  form.active ? 'bg-primary' : 'bg-surface-2 border border-border'
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    form.active ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          )}
        </div>
      </Modal>

      {/* Code Preview Modal */}
      <Modal
        open={!!previewScript}
        onClose={() => setPreviewScript(null)}
        title={previewScript ? `Codigo: ${previewScript.name}` : ''}
        maxWidth="max-w-2xl"
      >
        {previewScript && (
          <div className="bg-bg border border-border rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-surface-2/30">
              <span className="text-xs text-text-muted font-mono">
                {POSITION_LABELS[previewScript.position] || previewScript.position}
              </span>
              <Badge variant={previewScript.active ? 'success' : 'default'} dot>
                {previewScript.active ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
            <pre className="p-4 text-sm font-mono text-text overflow-x-auto leading-relaxed">
              {addLineNumbers(previewScript.code)}
            </pre>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Deseja excluir o script "${deleteTarget?.name}"? Esta acao nao pode ser desfeita.`}
      />
      </div>
    </div>
  );
}
