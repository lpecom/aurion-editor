import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Settings, Pencil, FileText, Newspaper } from 'lucide-react';
import { api } from '../lib/api';
import CreatePageModal from './CreatePageModal';
import PageSettingsDrawer from './PageSettingsDrawer';

interface Page {
  id: string;
  title: string;
  slug: string;
  type: string;
  lang: string;
  domain: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface PagesListProps {
  type: 'pv' | 'advertorial';
}

const LANG_LABELS: Record<string, string> = {
  'pt-BR': 'BR',
  en: 'EN',
  es: 'ES',
};

export default function PagesList({ type }: PagesListProps) {
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [langFilter, setLangFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [settingsPageId, setSettingsPageId] = useState<string | null>(null);

  const title = type === 'pv' ? 'Páginas de Venda' : 'Advertoriais';
  const createLabel = type === 'pv' ? 'Nova Página' : 'Novo Advertorial';
  const EmptyIcon = type === 'pv' ? FileText : Newspaper;
  const emptyMsg = type === 'pv' ? 'Nenhuma página de venda criada ainda.' : 'Nenhum advertorial criado ainda.';

  async function fetchPages() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<Page[]>(`/pages?type=${type}`);
      setPages(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar páginas');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPages();
  }, [type]);

  const filtered = useMemo(() => {
    return pages.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      if (langFilter && p.lang !== langFilter) return false;
      return true;
    });
  }, [pages, search, statusFilter, langFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-text">{title}</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200"
        >
          <Plus className="w-4 h-4" />
          {createLabel}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="w-full bg-surface-2 border border-border rounded-md pl-9 pr-3 py-2 text-text text-sm placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
        >
          <option value="">Todos os status</option>
          <option value="published">Publicada</option>
          <option value="draft">Rascunho</option>
        </select>

        <select
          value={langFilter}
          onChange={(e) => setLangFilter(e.target.value)}
          className="bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
        >
          <option value="">Todas as línguas</option>
          <option value="pt-BR">Português (BR)</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <div className="divide-y divide-border">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-surface-2 rounded animate-pulse" />
                  <div className="h-3 w-32 bg-surface-2 rounded animate-pulse" />
                </div>
                <div className="h-6 w-10 bg-surface-2 rounded animate-pulse" />
                <div className="h-6 w-16 bg-surface-2 rounded animate-pulse" />
                <div className="h-6 w-20 bg-surface-2 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : pages.length === 0 ? (
        /* Empty state (no pages at all) */
        <div className="bg-surface border border-border rounded-lg p-12 flex flex-col items-center justify-center text-center">
          <EmptyIcon className="w-12 h-12 text-text-muted mb-3" />
          <p className="text-text-muted">{emptyMsg}</p>
        </div>
      ) : filtered.length === 0 ? (
        /* No results for filter */
        <div className="bg-surface border border-border rounded-lg p-12 flex flex-col items-center justify-center text-center">
          <Search className="w-12 h-12 text-text-muted mb-3" />
          <p className="text-text-muted">Nenhum resultado encontrado.</p>
        </div>
      ) : (
        /* Table */
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Título</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3">Língua</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3">Path</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3">Domínio</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3">Status</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((page) => (
                <tr key={page.id} className="hover:bg-surface-2/50 transition-colors duration-200">
                  <td className="px-5 py-3">
                    <button
                      onClick={() => navigate(`/editor/${page.id}`)}
                      className="text-sm font-medium text-text hover:text-primary cursor-pointer transition-colors duration-200 text-left"
                    >
                      {page.title}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-muted">
                      {LANG_LABELS[page.lang] || page.lang}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-sm text-text-muted font-mono">/{page.slug}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-sm text-text-muted">{page.domain || '\u2014'}</span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full ${
                        page.status === 'published'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-warning/10 text-warning'
                      }`}
                    >
                      {page.status === 'published' ? 'Publicada' : 'Rascunho'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSettingsPageId(page.id)}
                        className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200"
                        title="Configurações"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/editor/${page.id}`)}
                        className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200"
                        title="Editar"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreatePageModal open={createOpen} onClose={() => setCreateOpen(false)} type={type} />
      <PageSettingsDrawer
        open={settingsPageId !== null}
        onClose={() => setSettingsPageId(null)}
        pageId={settingsPageId}
        onSaved={fetchPages}
      />
    </div>
  );
}
