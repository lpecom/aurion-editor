import { useState, useEffect, useCallback } from 'react';
import { Cloud, Plus, Pencil, Trash2, Wifi } from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import EmptyState from '../../components/ui/EmptyState';

interface CloudflareAccount {
  id: string;
  name: string;
  account_id: string;
  api_token: string;
  created_at: string;
}

interface AccountForm {
  name: string;
  account_id: string;
  api_token: string;
}

const emptyForm: AccountForm = { name: '', account_id: '', api_token: '' };

export default function CloudflareAccounts() {
  const [accounts, setAccounts] = useState<CloudflareAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CloudflareAccount | null>(null);
  const [form, setForm] = useState<AccountForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<CloudflareAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchAccounts = useCallback(async () => {
    try {
      const data = await api.get<CloudflareAccount[]>('/cloudflare-accounts');
      setAccounts(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (account: CloudflareAccount) => {
    setEditing(account);
    setForm({
      name: account.name,
      account_id: account.account_id,
      api_token: '',
    });
    setError('');
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        name: form.name,
        account_id: form.account_id,
      };
      if (form.api_token) {
        body.api_token = form.api_token;
      }
      if (editing) {
        await api.put(`/cloudflare-accounts/${editing.id}`, body);
      } else {
        body.api_token = form.api_token;
        await api.post('/cloudflare-accounts', body);
      }
      setModalOpen(false);
      fetchAccounts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar conta');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/cloudflare-accounts/${deleteTarget.id}`);
      setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir conta. Verifique se nao ha dominios vinculados.');
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleTestConnection = async (account: CloudflareAccount) => {
    setTestingId(account.id);
    setTestResult(null);
    try {
      await api.post(`/cloudflare-accounts/${account.id}/test`);
      setTestResult({ id: account.id, success: true, message: 'Conexao bem-sucedida!' });
    } catch (err: unknown) {
      setTestResult({
        id: account.id,
        success: false,
        message: err instanceof Error ? err.message : 'Falha na conexao',
      });
    } finally {
      setTestingId(null);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-accent/10 p-2.5">
            <Cloud className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Contas Cloudflare</h1>
            <p className="text-sm text-text-muted">Gerencie suas contas Cloudflare para hospedagem de paginas.</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Nova Conta
        </button>
      </div>

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/4" />
              <div className="h-4 bg-surface-2 rounded w-1/6" />
              <div className="h-4 bg-surface-2 rounded w-1/6" />
              <div className="h-4 bg-surface-2 rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!loading && accounts.length === 0 && (
        <EmptyState
          icon={Cloud}
          title="Nenhuma conta Cloudflare configurada"
          description="Adicione uma conta Cloudflare para hospedar suas paginas na edge."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Nova Conta
            </button>
          }
        />
      )}

      {!loading && accounts.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Nome</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Account ID</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">API Token</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Criado em</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((account) => (
                <tr key={account.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                  <td className="px-6 py-4">
                    <span className="text-text font-medium">{account.name}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-text-muted font-mono">{account.account_id}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-text-muted font-mono">{account.api_token}</span>
                  </td>
                  <td className="px-6 py-4 text-text-muted text-sm">{formatDate(account.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {testResult && testResult.id === account.id && (
                        <span className={`text-xs mr-2 ${testResult.success ? 'text-primary' : 'text-danger'}`}>
                          {testResult.message}
                        </span>
                      )}
                      <button
                        onClick={() => handleTestConnection(account)}
                        disabled={testingId === account.id}
                        aria-label={`Testar conexao ${account.name}`}
                        title="Testar Conexao"
                        className="p-2 rounded-md text-text-muted hover:text-accent hover:bg-accent/10 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-accent/50 focus:outline-none disabled:opacity-50"
                      >
                        {testingId === account.id ? (
                          <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          <Wifi className="w-4 h-4" />
                        )}
                      </button>
                      <button
                        onClick={() => openEdit(account)}
                        aria-label={`Editar ${account.name}`}
                        title={`Editar ${account.name}`}
                        className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(account)}
                        aria-label={`Excluir ${account.name}`}
                        title={`Excluir ${account.name}`}
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
        title={editing ? 'Editar Conta Cloudflare' : 'Nova Conta Cloudflare'}
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
              disabled={saving || !form.name || !form.account_id || (!editing && !form.api_token)}
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
            <label className="block text-sm font-medium text-text mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="Conta Principal"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Account ID</label>
            <input
              type="text"
              value={form.account_id}
              onChange={(e) => setForm({ ...form, account_id: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="abc123def456..."
            />
            <p className="text-xs text-text-muted mt-1.5">Encontrado em: Cloudflare Dashboard &rarr; Workers & Pages &rarr; Account ID</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">API Token</label>
            <input
              type="password"
              value={form.api_token}
              onChange={(e) => setForm({ ...form, api_token: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder={editing ? 'Deixe vazio para manter o atual' : 'Token com permissoes Workers, R2, DNS'}
            />
            {editing && (
              <p className="text-xs text-text-muted mt-1.5">Deixe vazio para manter o token atual.</p>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Deseja excluir a conta "${deleteTarget?.name}"? Esta acao nao pode ser desfeita. Verifique se nao ha dominios vinculados.`}
      />
    </div>
  );
}
