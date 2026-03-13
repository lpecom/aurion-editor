import { useState, useEffect, useCallback } from 'react';
import { Server, RefreshCw, AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';

interface Worker {
  id: string;
  domain: string;
  worker_name: string;
  r2_bucket: string;
  worker_status: string;
  worker_error: string | null;
  cloudflare_account_id: string;
  account_name: string | null;
}

const statusConfig: Record<string, { variant: 'success' | 'warning' | 'danger' | 'default'; label: string; icon: React.ReactNode }> = {
  active: { variant: 'success', label: 'Ativo', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  provisioning: { variant: 'warning', label: 'Provisionando', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  error: { variant: 'danger', label: 'Erro', icon: <AlertCircle className="w-3.5 h-3.5" /> },
  pending: { variant: 'default', label: 'Pendente', icon: <Clock className="w-3.5 h-3.5" /> },
};

export default function Workers() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [redeployingId, setRedeployingId] = useState<string | null>(null);
  const [redeployingAll, setRedeployingAll] = useState(false);
  const [actionResult, setActionResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const fetchWorkers = useCallback(async () => {
    try {
      const data = await api.get<Worker[]>('/workers');
      setWorkers(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWorkers();
  }, [fetchWorkers]);

  const handleRedeploy = async (worker: Worker) => {
    setRedeployingId(worker.id);
    setActionResult(null);
    try {
      const updated = await api.post<Worker>(`/workers/${worker.id}/redeploy`);
      setWorkers(prev => prev.map(w => w.id === worker.id ? updated : w));
      setActionResult({ id: worker.id, success: true, message: 'Redeploy concluído!' });
    } catch (err: unknown) {
      setActionResult({
        id: worker.id,
        success: false,
        message: err instanceof Error ? err.message : 'Falha no redeploy',
      });
      fetchWorkers();
    } finally {
      setRedeployingId(null);
    }
  };

  const handleRedeployAll = async () => {
    setRedeployingAll(true);
    setActionResult(null);
    try {
      const data = await api.post<{ results: { id: string; domain: string; success: boolean; error?: string }[] }>('/workers/redeploy-all');
      const failed = data.results.filter(r => !r.success);
      if (failed.length === 0) {
        setActionResult({ id: '__all', success: true, message: `${data.results.length} worker(s) atualizados com sucesso!` });
      } else {
        setActionResult({ id: '__all', success: false, message: `${failed.length} de ${data.results.length} falharam` });
      }
      fetchWorkers();
    } catch (err: unknown) {
      setActionResult({
        id: '__all',
        success: false,
        message: err instanceof Error ? err.message : 'Falha no redeploy',
      });
    } finally {
      setRedeployingAll(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-accent/10 p-2.5">
            <Server className="w-6 h-6 text-accent" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Workers</h1>
            <p className="text-sm text-text-muted">Gerencie e atualize os Cloudflare Workers dos seus domínios.</p>
          </div>
        </div>
        {workers.length > 0 && (
          <button
            onClick={handleRedeployAll}
            disabled={redeployingAll || redeployingId !== null}
            className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none disabled:opacity-50"
          >
            {redeployingAll ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            Redeploy Todos
          </button>
        )}
      </div>

      {/* Global action result */}
      {actionResult && actionResult.id === '__all' && (
        <div className={`mb-4 flex items-center gap-2 text-sm px-4 py-3 rounded-lg border ${
          actionResult.success
            ? 'bg-primary/5 border-primary/20 text-primary'
            : 'bg-danger/5 border-danger/20 text-danger'
        }`}>
          {actionResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          {actionResult.message}
        </div>
      )}

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/4" />
              <div className="h-4 bg-surface-2 rounded w-1/5" />
              <div className="h-4 bg-surface-2 rounded w-1/6" />
              <div className="h-4 bg-surface-2 rounded w-16 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!loading && workers.length === 0 && (
        <EmptyState
          icon={Server}
          title="Nenhum worker encontrado"
          description="Workers são criados automaticamente ao provisionar um domínio com Cloudflare. Vá em Recursos → Domínios para configurar."
        />
      )}

      {!loading && workers.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Domínio</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Worker</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Bucket R2</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Conta</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Status</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Ações</th>
              </tr>
            </thead>
            <tbody>
              {workers.map((worker) => {
                const status = statusConfig[worker.worker_status] || statusConfig.pending;
                return (
                  <tr key={worker.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                    <td className="px-6 py-4">
                      <span className="text-text font-medium">{worker.domain}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-muted font-mono">{worker.worker_name}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-muted font-mono">{worker.r2_bucket}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm text-text-muted">{worker.account_name || '—'}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <Badge variant={status.variant} dot>
                          {status.label}
                        </Badge>
                        {worker.worker_error && (
                          <span className="text-xs text-danger max-w-[200px] truncate" title={worker.worker_error}>
                            {worker.worker_error}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {actionResult && actionResult.id === worker.id && (
                          <span className={`text-xs mr-1 ${actionResult.success ? 'text-primary' : 'text-danger'}`}>
                            {actionResult.message}
                          </span>
                        )}
                        <button
                          onClick={() => handleRedeploy(worker)}
                          disabled={redeployingId === worker.id || redeployingAll}
                          title="Redeploy Worker"
                          className="flex items-center gap-1.5 bg-surface-2 border border-border text-text text-sm px-3 py-1.5 rounded-md hover:bg-surface-2/80 hover:border-border-hover cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none disabled:opacity-50"
                        >
                          {redeployingId === worker.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="w-3.5 h-3.5" />
                          )}
                          Redeploy
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

      {/* Info card */}
      {!loading && workers.length > 0 && (
        <div className="mt-6 bg-surface-2/30 border border-border/50 rounded-lg px-5 py-4">
          <h3 className="text-sm font-semibold text-text mb-2">Quando usar Redeploy?</h3>
          <ul className="text-sm text-text-muted space-y-1.5">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Após atualizações no script do Worker (novas funcionalidades, correções)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Para aplicar novas configurações de R2 ou bindings
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              Se imagens ou assets não estão carregando nas páginas publicadas
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
