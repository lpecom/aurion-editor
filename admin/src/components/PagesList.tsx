import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Settings, Pencil, Copy, FileText, Newspaper, Languages, Trash2, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import CreatePageModal from './CreatePageModal';
import DuplicatePageModal from './DuplicatePageModal';
import TranslatePageModal from './TranslatePageModal';
import PageSettingsDrawer from './PageSettingsDrawer';
import EmptyState from './ui/EmptyState';
import Badge from './ui/Badge';
import ConfirmDialog from './ui/ConfirmDialog';

interface PageDomain {
  id: string;
  domain: string;
  is_primary: number;
  source: string;
}

interface Page {
  id: string;
  title: string;
  slug: string;
  type: string;
  lang: string;
  domain: string | null;
  domains?: PageDomain[];
  status: string;
  created_at: string;
  updated_at: string;
  variant_group: string | null;
  variant_label: string | null;
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
  const [duplicatePage, setDuplicatePage] = useState<{ id: string; title: string } | null>(null);
  const [translatePage, setTranslatePage] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/pages/${deleteTarget.id}`);
      setPages((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir página');
    } finally {
      setDeleting(false);
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
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          {createLabel}
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
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
                <div className="h-5 w-10 bg-surface-2 rounded-full animate-pulse" />
                <div className="h-5 w-16 bg-surface-2 rounded-full animate-pulse" />
                <div className="h-5 w-20 bg-surface-2 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : pages.length === 0 ? (
        /* Empty state (no pages at all) */
        <EmptyState
          icon={EmptyIcon}
          title={emptyMsg}
          description={type === 'pv' ? 'Crie sua primeira página de venda para começar.' : 'Crie seu primeiro advertorial para começar.'}
          action={
            <button
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              {createLabel}
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        /* No results for filter */
        <EmptyState
          icon={Search}
          title="Nenhum resultado encontrado"
          description="Tente ajustar os filtros ou o termo de busca."
        />
      ) : (
        /* Table */
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3.5">Título</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3.5">Língua</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3.5">Path</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3.5">Domínio</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3.5">Status</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3.5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((page) => (
                <tr key={page.id} className="hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => navigate(`/editor/${page.id}`)}
                        className="text-sm font-medium text-text hover:text-primary cursor-pointer transition-colors duration-200 text-left"
                      >
                        {page.title}
                      </button>
                      {page.variant_label && (
                        <Badge variant="info">{page.variant_label}</Badge>
                      )}
                    </div>
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
                    <span className="text-sm text-text-muted">
                      {(() => {
                        const primaryDomain = page.domains?.find(d => d.is_primary)?.domain
                          || page.domains?.[0]?.domain
                          || page.domain;
                        return primaryDomain || '\u2014';
                      })()}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full transition-colors duration-200 ${
                        page.status === 'published'
                          ? 'bg-primary/15 text-primary border border-primary/20'
                          : 'bg-warning/15 text-warning border border-warning/20'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${page.status === 'published' ? 'bg-primary' : 'bg-warning'}`} />
                      {page.status === 'published' ? 'Publicada' : 'Rascunho'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {page.status === 'published' && (() => {
                        const domain = page.domains?.find(d => d.is_primary)?.domain || page.domains?.[0]?.domain || page.domain;
                        if (!domain) return null;
                        return (
                          <a
                            href={`https://${domain}/${page.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label={`Ver ${page.title}`}
                            title={`Ver página publicada`}
                            className="p-1.5 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        );
                      })()}
                      <button
                        onClick={() => setSettingsPageId(page.id)}
                        aria-label={`Configurações de ${page.title}`}
                        title={`Configurações de ${page.title}`}
                        className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDuplicatePage({ id: page.id, title: page.title })}
                        aria-label={`Duplicar ${page.title}`}
                        title={`Duplicar ${page.title}`}
                        className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setTranslatePage({ id: page.id, title: page.title })}
                        aria-label={`Traduzir ${page.title}`}
                        title={`Traduzir ${page.title}`}
                        className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Languages className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => navigate(`/editor/${page.id}`)}
                        aria-label={`Editar ${page.title}`}
                        title={`Editar ${page.title}`}
                        className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget({ id: page.id, title: page.title })}
                        aria-label={`Excluir ${page.title}`}
                        title={`Excluir ${page.title}`}
                        className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-danger/50 focus:outline-none"
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

      <CreatePageModal open={createOpen} onClose={() => setCreateOpen(false)} type={type} />
      <PageSettingsDrawer
        open={settingsPageId !== null}
        onClose={() => setSettingsPageId(null)}
        pageId={settingsPageId}
        onSaved={fetchPages}
      />
      <DuplicatePageModal
        open={duplicatePage !== null}
        onClose={() => setDuplicatePage(null)}
        pageId={duplicatePage?.id || ''}
        pageTitle={duplicatePage?.title || ''}
      />
      <TranslatePageModal
        open={translatePage !== null}
        onClose={() => setTranslatePage(null)}
        pageId={translatePage?.id || ''}
        pageTitle={translatePage?.title || ''}
      />
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        title="Excluir página"
        message={`Tem certeza que deseja excluir "${deleteTarget?.title}"? Se estiver publicada, será despublicada automaticamente. Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
