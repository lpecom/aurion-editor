import { useState, useEffect, useCallback } from 'react';
import { Activity, RefreshCw, Loader2, CheckCircle2, AlertCircle, Clock, Minus } from 'lucide-react';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';

interface Domain {
  id: string;
  domain: string;
  worker_status?: string | null;
}

interface HealthResult {
  domain_id: string;
  domain: string;
  status: 'online' | 'slow' | 'offline';
  response_time_ms: number;
  http_status: number | null;
  checked_at: string;
  protocol?: string | null;
  error?: string;
}

function statusBadge(status: string) {
  switch (status) {
    case 'online': return { variant: 'success' as const, label: 'Online' };
    case 'slow': return { variant: 'warning' as const, label: 'Lento' };
    case 'offline': return { variant: 'danger' as const, label: 'Offline' };
    default: return { variant: 'default' as const, label: 'Não verificado' };
  }
}

function StatusIcon({ status }: { status: string | null }) {
  switch (status) {
    case 'online': return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'slow': return <Clock className="w-4 h-4 text-amber-400" />;
    case 'offline': return <AlertCircle className="w-4 h-4 text-red-400" />;
    default: return <Minus className="w-4 h-4 text-text-muted" />;
  }
}

export default function Healthcheck() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [results, setResults] = useState<Record<string, HealthResult>>({});
  const [loading, setLoading] = useState(true);
  const [checkingAll, setCheckingAll] = useState(false);
  const [checkingId, setCheckingId] = useState<string | null>(null);

  const fetchDomains = useCallback(async () => {
    try {
      const data = await api.get<Domain[]>('/domains');
      setDomains(data);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchDomains(); }, [fetchDomains]);

  const checkOne = async (id: string) => {
    setCheckingId(id);
    try {
      const result = await api.post<HealthResult>(`/domains/${id}/healthcheck`);
      setResults(prev => ({ ...prev, [id]: { ...result, domain_id: id, domain: domains.find(d => d.id === id)?.domain || '' } }));
    } catch {
    } finally {
      setCheckingId(null);
    }
  };

  const checkAll = async () => {
    setCheckingAll(true);
    try {
      const data = await api.post<HealthResult[]>('/domains/healthcheck-all');
      const map: Record<string, HealthResult> = {};
      for (const r of data) map[r.domain_id] = r;
      setResults(map);
    } catch {
    } finally {
      setCheckingAll(false);
    }
  };

  const totalChecked = Object.keys(results).length;
  const online = Object.values(results).filter(r => r.status === 'online').length;
  const slow = Object.values(results).filter(r => r.status === 'slow').length;
  const offline = Object.values(results).filter(r => r.status === 'offline').length;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Healthcheck</h1>
            <p className="text-sm text-text-muted">Monitore o status dos seus domínios.</p>
          </div>
        </div>
        <button
          onClick={checkAll}
          disabled={checkingAll || loading}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          {checkingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Checar Todos
        </button>
      </div>

      {/* Summary cards */}
      {totalChecked > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400" />
            <div>
              <p className="text-2xl font-bold text-text">{online}</p>
              <p className="text-xs text-text-muted">Online</p>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
            <Clock className="w-5 h-5 text-amber-400" />
            <div>
              <p className="text-2xl font-bold text-text">{slow}</p>
              <p className="text-xs text-text-muted">Lento</p>
            </div>
          </div>
          <div className="bg-surface border border-border rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <div>
              <p className="text-2xl font-bold text-text">{offline}</p>
              <p className="text-xs text-text-muted">Offline</p>
            </div>
          </div>
        </div>
      )}

      {/* Domain table */}
      {loading ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/3" />
              <div className="h-5 bg-surface-2 rounded-full w-20" />
              <div className="h-4 bg-surface-2 rounded w-16 ml-auto" />
            </div>
          ))}
        </div>
      ) : domains.length === 0 ? (
        <div className="bg-surface border border-border rounded-lg p-12 text-center">
          <Activity className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <p className="text-text-muted">Nenhum domínio configurado.</p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Domínio</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Status</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">HTTP</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Tempo</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Protocolo</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Ação</th>
              </tr>
            </thead>
            <tbody>
              {domains.map(domain => {
                const r = results[domain.id];
                const badge = statusBadge(r?.status || '');
                const isChecking = checkingId === domain.id || checkingAll;

                return (
                  <tr key={domain.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <StatusIcon status={r?.status || null} />
                        <span className="text-text font-medium">{domain.domain}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={badge.variant} dot>{badge.label}</Badge>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {r?.http_status || '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted">
                      {r ? `${r.response_time_ms}ms` : '—'}
                    </td>
                    <td className="px-6 py-4 text-sm text-text-muted uppercase">
                      {r?.protocol || '—'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => checkOne(domain.id)}
                        disabled={isChecking}
                        className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                        title="Checar"
                      >
                        {isChecking ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
