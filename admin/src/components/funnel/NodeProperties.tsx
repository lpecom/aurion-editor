import { useState, useEffect, useRef, useCallback } from 'react';
import { Play, FileText, ExternalLink, Search, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { Node } from '@xyflow/react';

interface NodePropertiesProps {
  selectedNode: Node | null;
  onNodeUpdate: (nodeId: string, data: Record<string, any>) => void;
  onDeleteNode?: (nodeId: string) => void;
  domains?: { id: string; domain: string }[];
}

interface PageResult {
  id: string;
  title: string;
  slug: string;
  type: string;
  status: string;
}

const TYPE_BADGES: Record<string, { label: string; className: string }> = {
  pv: { label: 'PV', className: 'bg-blue-400/20 text-blue-400' },
  advertorial: { label: 'Advertorial', className: 'bg-amber-400/20 text-amber-400' },
  auxiliary: { label: 'Auxiliar', className: 'bg-purple-400/20 text-purple-400' },
};

const NODE_ICONS: Record<string, typeof Play> = {
  entry: Play,
  page: FileText,
  redirect: ExternalLink,
};

const NODE_LABELS: Record<string, string> = {
  entry: 'Entrada',
  page: 'Página',
  redirect: 'Redirect',
};

export default function NodeProperties({ selectedNode, onNodeUpdate, onDeleteNode, domains }: NodePropertiesProps) {
  const [pages, setPages] = useState<PageResult[]>([]);
  const [pageSearch, setPageSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Local state for text fields (update on blur)
  const [entrySlug, setEntrySlug] = useState('');
  const [ctaSelector, setCtaSelector] = useState('');
  const [redirectUrl, setRedirectUrl] = useState('');

  // Fetch pages once on mount
  useEffect(() => {
    api.get<PageResult[]>('/pages').then(setPages).catch(() => {});
  }, []);

  // Sync local state when selected node changes
  useEffect(() => {
    if (!selectedNode) return;
    const d = selectedNode.data as Record<string, any>;
    setEntrySlug((d.entry_slug as string) ?? '');
    setCtaSelector((d.cta_selector as string) ?? '');
    setRedirectUrl((d.url as string) ?? '');
    setPageSearch('');
    setShowDropdown(false);
  }, [selectedNode?.id]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as HTMLElement)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const update = useCallback(
    (data: Record<string, any>) => {
      if (selectedNode) onNodeUpdate(selectedNode.id, data);
    },
    [selectedNode, onNodeUpdate],
  );

  if (!selectedNode) {
    return (
      <div className="p-4 flex items-center justify-center h-full">
        <p className="text-xs text-zinc-500 text-center leading-relaxed">
          Selecione um elemento no canvas para editar suas propriedades.
        </p>
      </div>
    );
  }

  const nodeType = selectedNode.type ?? 'entry';
  const data = selectedNode.data as Record<string, any>;
  const Icon = NODE_ICONS[nodeType] ?? FileText;

  const filteredPages = pages.filter(
    (p) =>
      p.title.toLowerCase().includes(pageSearch.toLowerCase()) ||
      p.slug.toLowerCase().includes(pageSearch.toLowerCase()),
  );

  const selectedPage = data.page_id ? pages.find((p) => p.id === data.page_id) : null;

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-text-muted" />
          <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-widest">
            {NODE_LABELS[nodeType] ?? 'Nó'}
          </h3>
        </div>
        {onDeleteNode && (
          <button
            onClick={() => onDeleteNode(selectedNode.id)}
            className="p-1.5 rounded-lg text-zinc-500 hover:text-red-400 hover:bg-red-400/10 cursor-pointer transition-all duration-200"
            title="Excluir nó"
            aria-label="Excluir nó selecionado"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Entry node */}
      {nodeType === 'entry' && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-text mb-1">Slug de Entrada</label>
          <input
            type="text"
            value={entrySlug}
            onChange={(e) => setEntrySlug(e.target.value)}
            onBlur={() => update({ entry_slug: entrySlug })}
            placeholder="oferta-bf"
            className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-400/50 focus:border-green-400/50"
          />
          <p className="text-xs text-text-muted mt-1">URL que ativa o funil (ex: oferta-bf)</p>
          {/* Domain selector for entry */}
          {domains && domains.length > 0 && (
            <div className="space-y-2 mt-4">
              <label className="block text-sm font-medium text-text mb-1">Domínio de Entrada</label>
              <select
                value={(data.domain_id as string) ?? ''}
                onChange={(e) => update({ domain_id: e.target.value || null })}
                className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-emerald-400/50 focus:border-emerald-400/50"
              >
                <option value="">Todos os domínios</option>
                {domains.map((d) => (
                  <option key={d.id} value={d.id}>{d.domain}</option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-1">Domínio onde o funil será ativado</p>
            </div>
          )}
        </div>
      )}

      {/* Page node */}
      {nodeType === 'page' && (
        <div className="space-y-4">
          {/* Page selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text mb-1">Página</label>

            {selectedPage ? (
              <div className="bg-surface-2 border border-border rounded-md p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-text">{selectedPage.title}</span>
                  <button
                    onClick={() => update({ page_id: null, slug: null, title: null })}
                    className="text-xs text-text-muted hover:text-red-400 transition-colors"
                  >
                    Limpar
                  </button>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-text-muted">/{selectedPage.slug}</span>
                  {TYPE_BADGES[selectedPage.type] && (
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${TYPE_BADGES[selectedPage.type].className}`}
                    >
                      {TYPE_BADGES[selectedPage.type].label}
                    </span>
                  )}
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                      selectedPage.status === 'published'
                        ? 'bg-green-400/20 text-green-400'
                        : 'bg-yellow-400/20 text-yellow-400'
                    }`}
                  >
                    {selectedPage.status}
                  </span>
                </div>
              </div>
            ) : (
              <div className="relative" ref={dropdownRef}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
                  <input
                    type="text"
                    value={pageSearch}
                    onChange={(e) => {
                      setPageSearch(e.target.value);
                      setShowDropdown(true);
                    }}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Buscar página por título ou slug..."
                    className="w-full bg-surface-2 border border-border text-text rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-400/50"
                  />
                </div>

                {showDropdown && (
                  <div className="absolute z-50 mt-1 w-full bg-surface-2 border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                    {filteredPages.length === 0 ? (
                      <div className="px-3 py-2 text-xs text-text-muted">Nenhuma página encontrada</div>
                    ) : (
                      filteredPages.map((page) => (
                        <button
                          key={page.id}
                          onClick={() => {
                            update({ page_id: page.id, slug: page.slug, title: page.title });
                            setPageSearch('');
                            setShowDropdown(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-surface-1 transition-colors flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm text-text truncate">{page.title}</div>
                            <div className="text-xs text-text-muted truncate">/{page.slug}</div>
                          </div>
                          {TYPE_BADGES[page.type] && (
                            <span
                              className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${TYPE_BADGES[page.type].className}`}
                            >
                              {TYPE_BADGES[page.type].label}
                            </span>
                          )}
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CTA Selector */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text mb-1">
              Seletor CSS do CTA (opcional)
            </label>
            <input
              type="text"
              value={ctaSelector}
              onChange={(e) => setCtaSelector(e.target.value)}
              onBlur={() => update({ cta_selector: ctaSelector })}
              placeholder="ex: a.cta-button, #buy-now"
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400/50 focus:border-blue-400/50"
            />
            <p className="text-xs text-text-muted mt-1">
              Se vazio, links internos são reescritos automaticamente
            </p>
          </div>
        </div>
      )}

      {/* Redirect node */}
      {nodeType === 'redirect' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-text mb-1">URL de destino</label>
            <input
              type="text"
              value={redirectUrl}
              onChange={(e) => setRedirectUrl(e.target.value)}
              onBlur={() => update({ url: redirectUrl })}
              placeholder="https://exemplo.com/checkout"
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400/50 focus:border-purple-400/50"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-text mb-1">Código de Status</label>
            <select
              value={(data.status_code as number) ?? 302}
              onChange={(e) => update({ status_code: Number(e.target.value) })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-purple-400/50 focus:border-purple-400/50"
            >
              <option value={301}>301 — Permanente</option>
              <option value={302}>302 — Temporário</option>
            </select>
          </div>
        </div>
      )}
    </div>
  );
}
