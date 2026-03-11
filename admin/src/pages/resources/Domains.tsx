import { useState, useEffect, useCallback } from 'react';
import { Globe, Plus, Pencil, Trash2, Info } from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

interface Domain {
  id: number;
  domain: string;
  ssl_status: string;
  cloudflare_zone_id: string | null;
  created_at: string;
}

interface DomainForm {
  domain: string;
  ssl_status: string;
  cloudflare_zone_id: string;
}

const emptyForm: DomainForm = { domain: '', ssl_status: 'pending', cloudflare_zone_id: '' };

function sslBadge(status: string) {
  switch (status) {
    case 'active':
      return { variant: 'success' as const, label: 'Ativo' };
    case 'pending':
      return { variant: 'warning' as const, label: 'Pendente' };
    case 'error':
      return { variant: 'danger' as const, label: 'Erro' };
    default:
      return { variant: 'default' as const, label: status };
  }
}

export default function Domains() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Domain | null>(null);
  const [form, setForm] = useState<DomainForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Domain | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchDomains = useCallback(async () => {
    try {
      const data = await api.get<Domain[]>('/domains');
      setDomains(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDomains();
  }, [fetchDomains]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (domain: Domain) => {
    setEditing(domain);
    setForm({
      domain: domain.domain,
      ssl_status: domain.ssl_status,
      cloudflare_zone_id: domain.cloudflare_zone_id || '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editing) {
        await api.put(`/domains/${editing.id}`, {
          domain: form.domain,
          ssl_status: form.ssl_status,
          cloudflare_zone_id: form.cloudflare_zone_id || null,
        });
      } else {
        await api.post('/domains', {
          domain: form.domain,
          cloudflare_zone_id: form.cloudflare_zone_id || undefined,
        });
      }
      setModalOpen(false);
      fetchDomains();
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
      await api.delete(`/domains/${deleteTarget.id}`);
      setDomains((prev) => prev.filter((d) => d.id !== deleteTarget.id));
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
        <h1 className="text-2xl font-bold text-text">Dominios</h1>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          Novo Dominio
        </button>
      </div>

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0">
              <div className="h-4 bg-surface-2 rounded w-1/3" />
              <div className="h-4 bg-surface-2 rounded w-1/6" />
              <div className="h-4 bg-surface-2 rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!loading && domains.length === 0 && (
        <EmptyState
          icon={Globe}
          title="Nenhum dominio configurado"
          description="Adicione seu primeiro dominio personalizado."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200"
            >
              <Plus className="w-4 h-4" />
              Novo Dominio
            </button>
          }
        />
      )}

      {!loading && domains.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">Dominio</th>
                <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">Status SSL</th>
                <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">Data cadastro</th>
                <th className="text-right text-xs font-medium text-text-muted uppercase tracking-wider px-6 py-3">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => {
                const ssl = sslBadge(domain.ssl_status);
                return (
                  <tr key={domain.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200">
                    <td className="px-6 py-4 text-text font-medium">{domain.domain}</td>
                    <td className="px-6 py-4">
                      <Badge variant={ssl.variant}>{ssl.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-text-muted text-sm">{formatDate(domain.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(domain)}
                          className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(domain)}
                          className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Dominio' : 'Novo Dominio'}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="bg-surface-2 border border-border text-text px-4 py-2 rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors duration-200"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.domain}
              className="bg-primary text-bg font-medium px-4 py-2 rounded-md hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Dominio</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => setForm({ ...form, domain: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 focus:ring-2 focus:ring-primary/50 focus:outline-none"
              placeholder="meusite.com.br"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Cloudflare Zone ID (opcional)</label>
            <input
              type="text"
              value={form.cloudflare_zone_id}
              onChange={(e) => setForm({ ...form, cloudflare_zone_id: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 focus:ring-2 focus:ring-primary/50 focus:outline-none"
              placeholder="abc123..."
            />
          </div>
          <div className="flex items-start gap-3 p-3 bg-accent/5 border border-accent/20 rounded-md">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <p className="text-sm text-text-muted">
              Configure um registro CNAME apontando para <span className="font-mono text-accent">[seu-projeto].pages.dev</span>
            </p>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Deseja excluir o dominio "${deleteTarget?.domain}"? Esta acao nao pode ser desfeita.`}
      />
    </div>
  );
}
