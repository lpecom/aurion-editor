import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, ChevronDown, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import Badge from '../components/ui/Badge';
import EmptyState from '../components/ui/EmptyState';

interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
  variant_group: string | null;
  variant_label: string | null;
}

interface VariantGroup {
  name: string;
  variants: Page[];
}

export default function ConversionBoosters() {
  const navigate = useNavigate();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError('');
      try {
        const data = await api.get<Page[]>('/pages');
        setPages(data);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar páginas');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo<VariantGroup[]>(() => {
    const groupMap = new Map<string, Page[]>();
    for (const page of pages) {
      if (page.variant_group) {
        const existing = groupMap.get(page.variant_group) || [];
        existing.push(page);
        groupMap.set(page.variant_group, existing);
      }
    }
    return Array.from(groupMap.entries())
      .map(([name, variants]) => ({
        name,
        variants: variants.sort((a, b) => (a.variant_label || '').localeCompare(b.variant_label || '')),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [pages]);

  function toggleGroup(name: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-[#8B5CF6]/10 flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-[#8B5CF6]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Testes A/B</h1>
          <p className="text-sm text-text-muted">Gerencie variantes de páginas para testes</p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2 mb-4">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-5">
              <div className="flex items-center gap-3">
                <div className="h-5 w-5 bg-surface-2 rounded animate-pulse" />
                <div className="h-5 w-48 bg-surface-2 rounded animate-pulse" />
                <div className="h-5 w-16 bg-surface-2 rounded-full animate-pulse ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={FlaskConical}
          title="Nenhum teste A/B criado."
          description="Duplique uma página para começar."
        />
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.name);
            return (
              <div key={group.name} className="bg-surface border border-border rounded-lg overflow-hidden">
                <button
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center gap-3 px-5 py-4 text-left cursor-pointer hover:bg-surface-2/50 transition-colors duration-200"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-text-muted shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-text-muted shrink-0" />
                  )}
                  <span className="text-sm font-semibold text-text flex-1">{group.name}</span>
                  <Badge variant="info">{group.variants.length} variantes</Badge>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-surface-2/30">
                          <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-5 py-2.5">Variante</th>
                          <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-2.5">Título</th>
                          <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-2.5">Slug</th>
                          <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-3 py-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {group.variants.map((variant) => (
                          <tr
                            key={variant.id}
                            onClick={() => navigate(`/editor/${variant.id}`)}
                            className="hover:bg-surface-2/50 cursor-pointer transition-colors duration-200"
                          >
                            <td className="px-5 py-3">
                              <Badge variant="info">{variant.variant_label || '—'}</Badge>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-sm font-medium text-text hover:text-primary transition-colors duration-200">
                                {variant.title}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="text-sm text-text-muted font-mono">/{variant.slug}</span>
                            </td>
                            <td className="px-3 py-3">
                              <span
                                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full transition-colors duration-200 ${
                                  variant.status === 'published'
                                    ? 'bg-primary/15 text-primary border border-primary/20'
                                    : 'bg-warning/15 text-warning border border-warning/20'
                                }`}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${variant.status === 'published' ? 'bg-primary' : 'bg-warning'}`} />
                                {variant.status === 'published' ? 'Publicada' : 'Rascunho'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
