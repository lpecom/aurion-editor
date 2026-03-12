import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileStack, Plus, Search, Pencil, Settings, Loader2, X } from 'lucide-react';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

interface ParentPage {
  page_id: string;
  title: string;
  is_primary: number;
}

interface AuxPage {
  id: string;
  title: string;
  slug: string;
  type: string;
  lang: string;
  status: string;
  created_at: string;
  updated_at: string;
  frontmatter: Record<string, unknown>;
  parent_pages?: ParentPage[];
}

interface ParentOption {
  id: string;
  title: string;
  type: string;
}

const AUXILIAR_TYPE_LABELS: Record<string, string> = {
  politica_privacidade: 'Política de Privacidade',
  termos_uso: 'Termos de Uso',
  rastreio: 'Rastreio',
  contato: 'Contato',
  outro: 'Outro',
};

const AUXILIAR_TYPE_OPTIONS = [
  { value: 'politica_privacidade', label: 'Política de Privacidade' },
  { value: 'termos_uso', label: 'Termos de Uso' },
  { value: 'rastreio', label: 'Rastreio' },
  { value: 'contato', label: 'Contato' },
  { value: 'outro', label: 'Outro' },
];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getAuxType(page: AuxPage): string {
  const fm = page.frontmatter || {};
  const auxType = (fm.auxiliar_type as string) || 'outro';
  if (auxType === 'outro') {
    return (fm.custom_type as string) || 'Outro';
  }
  return AUXILIAR_TYPE_LABELS[auxType] || auxType;
}

function getPrimaryParent(page: AuxPage): ParentPage | null {
  if (!page.parent_pages || page.parent_pages.length === 0) return null;
  return page.parent_pages.find((p) => p.is_primary === 1) || page.parent_pages[0];
}

export default function Auxiliares() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<AuxPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // Create modal state
  const [createTitle, setCreateTitle] = useState('');
  const [createSlug, setCreateSlug] = useState('');
  const [createAuxType, setCreateAuxType] = useState('politica_privacidade');
  const [createCustomType, setCreateCustomType] = useState('');
  const [createParentId, setCreateParentId] = useState('');
  const [createLang, setCreateLang] = useState('pt-BR');
  const [parentOptions, setParentOptions] = useState<ParentOption[]>([]);
  const [parentSearch, setParentSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  async function fetchPages() {
    setLoading(true);
    setError('');
    try {
      const data = await api.get<AuxPage[]>('/pages?type=auxiliar');
      setPages(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar páginas');
    } finally {
      setLoading(false);
    }
  }

  async function fetchParentOptions() {
    try {
      const [pvPages, advPages] = await Promise.all([
        api.get<ParentOption[]>('/pages?type=pv'),
        api.get<ParentOption[]>('/pages?type=advertorial'),
      ]);
      setParentOptions([...pvPages, ...advPages]);
    } catch {
      // silently fail — parent selection is optional
    }
  }

  useEffect(() => {
    fetchPages();
  }, []);

  useEffect(() => {
    if (createOpen) {
      fetchParentOptions();
    }
  }, [createOpen]);

  const filtered = useMemo(() => {
    return pages.filter((p) => {
      if (search && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
      if (typeFilter) {
        const fm = p.frontmatter || {};
        const auxType = (fm.auxiliar_type as string) || 'outro';
        if (auxType !== typeFilter) return false;
      }
      return true;
    });
  }, [pages, search, typeFilter]);

  const filteredParentOptions = useMemo(() => {
    if (!parentSearch) return parentOptions;
    return parentOptions.filter((p) =>
      p.title.toLowerCase().includes(parentSearch.toLowerCase())
    );
  }, [parentOptions, parentSearch]);

  function resetCreateModal() {
    setCreateTitle('');
    setCreateSlug('');
    setCreateAuxType('politica_privacidade');
    setCreateCustomType('');
    setCreateParentId('');
    setCreateLang('pt-BR');
    setParentSearch('');
    setCreating(false);
    setCreateError('');
  }

  function handleCreateOpen() {
    resetCreateModal();
    setCreateOpen(true);
  }

  function handleCreateClose() {
    setCreateOpen(false);
    resetCreateModal();
  }

  function handleTitleChange(value: string) {
    setCreateTitle(value);
    setCreateSlug(slugify(value));
  }

  async function handleCreate() {
    if (!createTitle.trim() || !createSlug.trim()) {
      setCreateError('Título e slug são obrigatórios.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const frontmatter: Record<string, string> = {
        auxiliar_type: createAuxType,
      };
      if (createAuxType === 'outro' && createCustomType.trim()) {
        frontmatter.custom_type = createCustomType.trim();
      }
      const body: Record<string, unknown> = {
        title: createTitle.trim(),
        slug: createSlug.trim(),
        type: 'auxiliar',
        lang: createLang,
        frontmatter,
      };
      if (createParentId) {
        body.parent_page_id = createParentId;
      }
      const result = await api.post<{ id: string }>('/pages', body);
      handleCreateClose();
      navigate(`/editor/${result.id}`);
    } catch (err: unknown) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar página');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-teal-400/10 p-2.5">
            <FileStack className="w-6 h-6 text-teal-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text">Auxiliares</h2>
            <p className="text-sm text-text-muted">Políticas, termos, rastreio e páginas de apoio.</p>
          </div>
        </div>
        <button
          onClick={handleCreateOpen}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Nova Página
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
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
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
        >
          <option value="">Todos</option>
          {AUXILIAR_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
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
                <div className="h-5 w-24 bg-surface-2 rounded-full animate-pulse" />
                <div className="h-5 w-28 bg-surface-2 rounded-full animate-pulse" />
                <div className="h-5 w-16 bg-surface-2 rounded-full animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : pages.length === 0 ? (
        <EmptyState
          icon={FileStack}
          title="Nenhuma página auxiliar criada ainda."
          description="Crie sua primeira página auxiliar para começar."
          action={
            <button
              onClick={handleCreateOpen}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Nova Página
            </button>
          }
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="Nenhum resultado encontrado"
          description="Tente ajustar os filtros ou o termo de busca."
        />
      ) : (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3.5">Título</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3.5">Tipo</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3.5">Página Principal</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-3.5">Status</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-3.5">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((page) => {
                const parent = getPrimaryParent(page);
                return (
                  <tr key={page.id} className="hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => navigate(`/editor/${page.id}`)}
                        className="text-sm font-medium text-text hover:text-primary cursor-pointer transition-colors duration-200 text-left"
                      >
                        {page.title}
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant="info">{getAuxType(page)}</Badge>
                    </td>
                    <td className="px-3 py-3">
                      {parent ? (
                        <button
                          onClick={() => navigate(`/editor/${parent.page_id}`)}
                          className="text-sm text-text-muted hover:text-primary cursor-pointer transition-colors duration-200"
                        >
                          {parent.title}
                        </button>
                      ) : (
                        <span className="text-sm text-text-muted">&mdash;</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <Badge variant={page.status === 'published' ? 'success' : 'warning'} dot>
                        {page.status === 'published' ? 'Publicada' : 'Rascunho'}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/editor/${page.id}`)}
                          aria-label={`Editar ${page.title}`}
                          title={`Editar ${page.title}`}
                          className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                        >
                          <Pencil className="w-4 h-4" />
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

      {/* Create Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleCreateClose} />
          <div className="relative bg-surface border border-border rounded-xl shadow-2xl w-full max-w-lg mx-4 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text">Nova Página Auxiliar</h3>
              <button
                onClick={handleCreateClose}
                className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {createError && (
              <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
                {createError}
              </div>
            )}

            {/* Title */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text">Título</label>
              <input
                type="text"
                value={createTitle}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="Ex: Política de Privacidade"
                className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              />
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text">Slug</label>
              <input
                type="text"
                value={createSlug}
                onChange={(e) => setCreateSlug(e.target.value)}
                placeholder="politica-de-privacidade"
                className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm font-mono placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              />
            </div>

            {/* Auxiliar Type */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text">Tipo</label>
              <select
                value={createAuxType}
                onChange={(e) => setCreateAuxType(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              >
                {AUXILIAR_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Custom Type (only when "outro" selected) */}
            {createAuxType === 'outro' && (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-text">Tipo Personalizado</label>
                <input
                  type="text"
                  value={createCustomType}
                  onChange={(e) => setCreateCustomType(e.target.value)}
                  placeholder="Ex: FAQ, Sobre Nós..."
                  className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                />
              </div>
            )}

            {/* Parent Page */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text">Página Principal (opcional)</label>
              <input
                type="text"
                value={parentSearch}
                onChange={(e) => setParentSearch(e.target.value)}
                placeholder="Buscar página principal..."
                className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              />
              {createParentId && (
                <div className="flex items-center gap-2 text-sm text-text-muted">
                  <span>Selecionada: <span className="text-text font-medium">{parentOptions.find((p) => p.id === createParentId)?.title}</span></span>
                  <button
                    onClick={() => setCreateParentId('')}
                    className="text-danger hover:text-danger/80 cursor-pointer transition-colors duration-200"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              {parentSearch && filteredParentOptions.length > 0 && (
                <div className="bg-surface-2 border border-border rounded-md max-h-40 overflow-y-auto">
                  {filteredParentOptions.slice(0, 10).map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setCreateParentId(opt.id);
                        setParentSearch('');
                      }}
                      className="w-full text-left px-3 py-2 text-sm text-text hover:bg-surface/50 cursor-pointer transition-colors duration-200 flex items-center justify-between"
                    >
                      <span>{opt.title}</span>
                      <Badge variant="default">{opt.type === 'pv' ? 'PV' : 'Adv'}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Language */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-text">Idioma</label>
              <select
                value={createLang}
                onChange={(e) => setCreateLang(e.target.value)}
                className="w-full bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              >
                <option value="pt-BR">Português (BR)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={handleCreateClose}
                className="px-4 py-2 text-sm font-medium text-text-muted hover:text-text rounded-md cursor-pointer transition-colors duration-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !createTitle.trim()}
                className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                Criar Página
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
