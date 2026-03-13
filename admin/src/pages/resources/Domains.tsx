import { useState, useEffect, useCallback } from 'react';
import { Globe, Plus, Pencil, Trash2, Info, Shield, Clock, Cloud, Loader2, AlertCircle, Rocket, Power } from 'lucide-react';
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
  cloudflare_account_id: string | null;
  worker_name: string | null;
  worker_status: string | null;
  worker_error: string | null;
  created_at: string;
}

interface CloudflareAccount {
  id: string;
  name: string;
  account_id: string;
}

interface DomainForm {
  domain: string;
  ssl_status: string;
  cloudflare_zone_id: string;
  cloudflare_account_id: string;
}

const emptyForm: DomainForm = { domain: '', ssl_status: 'pending', cloudflare_zone_id: '', cloudflare_account_id: '' };

function sslBadge(status: string) {
  switch (status) {
    case 'active':
      return { variant: 'success' as const, label: 'Ativo', icon: Shield };
    case 'pending':
      return { variant: 'warning' as const, label: 'Pendente', icon: Clock };
    case 'error':
      return { variant: 'danger' as const, label: 'Erro', icon: Shield };
    default:
      return { variant: 'default' as const, label: status, icon: Shield };
  }
}

function workerStatusBadge(status: string | null) {
  switch (status) {
    case 'active':
      return { variant: 'success' as const, label: 'Ativo' };
    case 'provisioning':
      return { variant: 'warning' as const, label: 'Provisionando' };
    case 'error':
      return { variant: 'danger' as const, label: 'Erro' };
    case 'pending':
    default:
      return { variant: 'default' as const, label: 'Pendente' };
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
  const [cfAccounts, setCfAccounts] = useState<CloudflareAccount[]>([]);
  const [provisioningId, setProvisioningId] = useState<number | null>(null);
  const [deprovisionTarget, setDeprovisionTarget] = useState<Domain | null>(null);
  const [deprovisioning, setDeprovisioning] = useState(false);
  const [dnsInfo, setDnsInfo] = useState<{ domain: string; workerName: string } | null>(null);
  const [actionError, setActionError] = useState<{ id: number; message: string } | null>(null);

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

  const fetchCfAccounts = useCallback(async () => {
    try {
      const data = await api.get<CloudflareAccount[]>('/cloudflare-accounts');
      setCfAccounts(data);
    } catch {
      // silently fail
    }
  }, []);

  useEffect(() => {
    fetchDomains();
    fetchCfAccounts();
  }, [fetchDomains, fetchCfAccounts]);

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
      cloudflare_account_id: domain.cloudflare_account_id || '',
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
          cloudflare_account_id: form.cloudflare_account_id || null,
        });
      } else {
        await api.post('/domains', {
          domain: form.domain,
          cloudflare_zone_id: form.cloudflare_zone_id || undefined,
          cloudflare_account_id: form.cloudflare_account_id || undefined,
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

  const handleProvision = async (domain: Domain) => {
    setProvisioningId(domain.id);
    setActionError(null);
    setDnsInfo(null);
    try {
      const result = await api.post<{ worker_name: string }>(`/domains/${domain.id}/provision`);
      setDnsInfo({ domain: domain.domain, workerName: result.worker_name });
      fetchDomains();
    } catch (err: unknown) {
      setActionError({
        id: domain.id,
        message: err instanceof Error ? err.message : 'Erro ao provisionar',
      });
      fetchDomains();
    } finally {
      setProvisioningId(null);
    }
  };

  const handleDeprovision = async () => {
    if (!deprovisionTarget) return;
    setDeprovisioning(true);
    setActionError(null);
    try {
      await api.post(`/domains/${deprovisionTarget.id}/deprovision`);
      fetchDomains();
    } catch (err: unknown) {
      setActionError({
        id: deprovisionTarget.id,
        message: err instanceof Error ? err.message : 'Erro ao desprovisionar',
      });
    } finally {
      setDeprovisioning(false);
      setDeprovisionTarget(null);
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
            <h1 className="text-2xl font-bold text-text">Dominios</h1>
            <p className="text-sm text-text-muted">Gerencie seus dominios personalizados e certificados SSL.</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Novo Dominio
        </button>
      </div>

      {/* DNS Instructions Banner */}
      {dnsInfo && (
        <div className="mb-4 flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg animate-fade-in">
          <div className="shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Info className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-text mb-1">Configuracao DNS necessaria</p>
            <p className="text-sm text-text-muted leading-relaxed">
              Aponte o CNAME de <code className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">{dnsInfo.domain}</code> para <code className="font-mono text-primary bg-primary/10 px-1.5 py-0.5 rounded text-xs">{dnsInfo.workerName}.workers.dev</code>
            </p>
          </div>
          <button
            onClick={() => setDnsInfo(null)}
            className="shrink-0 p-1 rounded-md text-text-muted hover:text-text cursor-pointer transition-colors duration-200"
            aria-label="Fechar"
          >
            &times;
          </button>
        </div>
      )}

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/3" />
              <div className="h-5 bg-surface-2 rounded-full w-20" />
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
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
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
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Dominio</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Status SSL</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Worker</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Data cadastro</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((domain) => {
                const ssl = sslBadge(domain.ssl_status);
                const SslIcon = ssl.icon;
                const worker = workerStatusBadge(domain.worker_status);
                const isProvisioning = provisioningId === domain.id;
                const canProvision = domain.cloudflare_account_id && domain.worker_status !== 'active' && !isProvisioning;
                const canDeprovision = domain.worker_status === 'active';
                const domainError = actionError && actionError.id === domain.id ? actionError.message : null;

                return (
                  <tr key={domain.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                    <td className="px-6 py-4">
                      <div>
                        <span className="text-text font-medium">{domain.domain}</span>
                        {domain.cloudflare_account_id && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-text-muted">
                            <Cloud className="w-3 h-3" />
                            CF
                          </span>
                        )}
                      </div>
                      {domainError && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-danger">
                          <AlertCircle className="w-3 h-3" />
                          {domainError}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1.5">
                        <SslIcon className={`w-3.5 h-3.5 ${ssl.variant === 'success' ? 'text-primary' : ssl.variant === 'warning' ? 'text-warning' : 'text-danger'}`} />
                        <Badge variant={ssl.variant} dot>{ssl.label}</Badge>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {domain.cloudflare_account_id ? (
                        <div className="flex items-center gap-2">
                          {domain.worker_status === 'provisioning' || isProvisioning ? (
                            <span className="inline-flex items-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 text-warning animate-spin" />
                              <Badge variant="warning">Provisionando</Badge>
                            </span>
                          ) : domain.worker_status === 'error' ? (
                            <span className="inline-flex items-center gap-1.5" title={domain.worker_error || 'Erro desconhecido'}>
                              <AlertCircle className="w-3.5 h-3.5 text-danger" />
                              <Badge variant="danger" dot>Erro</Badge>
                            </span>
                          ) : (
                            <Badge variant={worker.variant} dot>{worker.label}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-text-muted">&mdash;</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-text-muted text-sm">{formatDate(domain.created_at)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {canProvision && (
                          <button
                            onClick={() => handleProvision(domain)}
                            aria-label={`Provisionar ${domain.domain}`}
                            title="Provisionar"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-accent hover:bg-accent/10 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-accent/50 focus:outline-none"
                          >
                            <Rocket className="w-3.5 h-3.5" />
                            Provisionar
                          </button>
                        )}
                        {isProvisioning && (
                          <span className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-warning">
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            Provisionando...
                          </span>
                        )}
                        {canDeprovision && !isProvisioning && (
                          <button
                            onClick={() => setDeprovisionTarget(domain)}
                            aria-label={`Desprovisionar ${domain.domain}`}
                            title="Desprovisionar"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-warning hover:bg-warning/10 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-warning/50 focus:outline-none"
                          >
                            <Power className="w-3.5 h-3.5" />
                            Desprovisionar
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(domain)}
                          aria-label={`Editar ${domain.domain}`}
                          title={`Editar ${domain.domain}`}
                          className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(domain)}
                          aria-label={`Excluir ${domain.domain}`}
                          title={`Excluir ${domain.domain}`}
                          className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-danger/50 focus:outline-none"
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
              className="bg-surface-2 border border-border text-text px-4 py-2 rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.domain}
              className="bg-primary text-bg font-medium px-4 py-2 rounded-md hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
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
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="meusite.com.br"
            />
            <p className="text-xs text-text-muted mt-1.5">Formato: dominio.com ou sub.dominio.com (sem http:// ou /)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Conta Cloudflare (opcional)</label>
            <select
              value={form.cloudflare_account_id}
              onChange={(e) => setForm({ ...form, cloudflare_account_id: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
            >
              <option value="">Nenhuma (hospedagem local)</option>
              {cfAccounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} ({acc.account_id})
                </option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1.5">Selecione uma conta para hospedar na edge via Cloudflare Workers.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Cloudflare Zone ID (opcional)</label>
            <input
              type="text"
              value={form.cloudflare_zone_id}
              onChange={(e) => setForm({ ...form, cloudflare_zone_id: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="abc123..."
            />
          </div>
          <div className="flex items-start gap-3 p-4 bg-accent/5 border border-accent/20 rounded-lg">
            <div className="shrink-0 w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
              <Info className="w-4 h-4 text-accent" />
            </div>
            <div>
              <p className="text-sm font-medium text-text mb-1">Configuracao DNS</p>
              <p className="text-sm text-text-muted leading-relaxed">
                Configure um registro CNAME apontando para <code className="font-mono text-accent bg-accent/10 px-1.5 py-0.5 rounded text-xs">[seu-projeto].pages.dev</code>
              </p>
            </div>
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

      <ConfirmDialog
        open={!!deprovisionTarget}
        onClose={() => setDeprovisionTarget(null)}
        onConfirm={handleDeprovision}
        loading={deprovisioning}
        title="Desprovisionar Worker"
        message={`Deseja desprovisionar o worker do dominio "${deprovisionTarget?.domain}"? O Worker e o bucket R2 serao removidos.`}
        confirmLabel="Desprovisionar"
      />
    </div>
  );
}
