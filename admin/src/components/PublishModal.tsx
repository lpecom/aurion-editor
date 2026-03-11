import { useState, useEffect, useCallback } from 'react';
import {
  X,
  ChevronRight,
  ChevronLeft,
  FolderOpen,
  Globe,
  Plus,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  PartyPopper,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../lib/api';

interface Category {
  id: string;
  name: string;
  type: string;
  domains?: { id: string; domain: string; is_primary: number }[];
}

interface Domain {
  id: string;
  domain: string;
  ssl_status: string;
}

interface PublishModalProps {
  open: boolean;
  onClose: () => void;
  pageId: string;
  pageType: string;
  currentCategoryId?: string | null;
  currentSlug?: string;
}

type Step = 'category' | 'domain' | 'published';

export default function PublishModal({
  open,
  onClose,
  pageId,
  pageType,
  currentCategoryId,
  currentSlug,
}: PublishModalProps) {
  const [step, setStep] = useState<Step>('category');
  const [categories, setCategories] = useState<Category[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');

  // Add domain form
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep('category');
    setSelectedCategoryId(currentCategoryId || null);
    setSelectedDomainId(null);
    setPublishedUrl('');
    setCopied(false);
    setError('');
    setShowAddDomain(false);
    setNewDomain('');
    loadCategories();
  }, [open, currentCategoryId]);

  const loadCategories = async () => {
    setLoading(true);
    try {
      const cats = await api.get<Category[]>(`/categories?type=${pageType}`);
      setCategories(cats);
    } catch {
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const loadDomains = useCallback(async (categoryId: string | null) => {
    setLoading(true);
    try {
      const allDomains = await api.get<Domain[]>('/domains');
      setDomains(allDomains);

      // Pre-select primary domain from category if available
      if (categoryId) {
        const cat = categories.find((c) => c.id === categoryId);
        const primary = cat?.domains?.find((d) => d.is_primary);
        if (primary) setSelectedDomainId(primary.id);
      }
    } catch {
      setDomains([]);
    } finally {
      setLoading(false);
    }
  }, [categories]);

  const handleCategoryNext = () => {
    setStep('domain');
    loadDomains(selectedCategoryId);
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    setAddingDomain(true);
    setError('');
    try {
      const created = await api.post<Domain>('/domains', { domain: newDomain.trim() });
      setDomains((prev) => [created, ...prev]);
      setSelectedDomainId(created.id);
      setShowAddDomain(false);
      setNewDomain('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao adicionar domínio');
    } finally {
      setAddingDomain(false);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    setError('');
    try {
      // Update page category if changed
      if (selectedCategoryId) {
        await api.put(`/pages/${pageId}`, { category_id: selectedCategoryId });
      }

      // Update page domain if selected
      if (selectedDomainId) {
        await api.put(`/pages/${pageId}/domains`, {
          domain_ids: [selectedDomainId],
          primary_domain_id: selectedDomainId,
        });
      }

      // Publish
      const result = await api.post<any>(`/pages/${pageId}/publish`);

      // Build URL
      const domain = domains.find((d) => d.id === selectedDomainId);
      const slug = result.slug || currentSlug || pageId;
      const baseUrl = domain ? `https://${domain.domain}` : window.location.origin;
      setPublishedUrl(`${baseUrl}/${slug}`);

      setStep('published');

      // Fire confetti
      setTimeout(() => {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'],
        });
      }, 300);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao publicar');
    } finally {
      setPublishing(false);
    }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(publishedUrl);
    setCopied(true);

    // Extra confetti burst on copy
    confetti({
      particleCount: 50,
      spread: 60,
      origin: { y: 0.7 },
      colors: ['#22C55E', '#3B82F6'],
    });

    setTimeout(() => setCopied(false), 3000);
  };

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              {step === 'published' ? (
                <PartyPopper className="w-5 h-5 text-primary" />
              ) : (
                <Globe className="w-5 h-5 text-primary" />
              )}
              <h3 className="text-lg font-semibold text-text">
                {step === 'category' && 'Escolha a Categoria'}
                {step === 'domain' && 'Escolha o Domínio'}
                {step === 'published' && 'Página Publicada!'}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Steps indicator */}
          {step !== 'published' && (
            <div className="px-6 pt-4 flex items-center gap-2">
              {['category', 'domain'].map((s, i) => (
                <div key={s} className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                      s === step
                        ? 'bg-primary text-bg'
                        : i < ['category', 'domain'].indexOf(step)
                          ? 'bg-primary/20 text-primary'
                          : 'bg-surface-2 text-text-muted'
                    }`}
                  >
                    {i < ['category', 'domain'].indexOf(step) ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      i + 1
                    )}
                  </div>
                  {i < 1 && (
                    <div className={`w-12 h-0.5 rounded ${i < ['category', 'domain'].indexOf(step) ? 'bg-primary' : 'bg-surface-2'}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-5 min-h-[240px]">
            {error && (
              <div className="mb-4 text-sm text-danger bg-danger/10 border border-danger/20 rounded-md px-3 py-2">
                {error}
              </div>
            )}

            {/* Step 1: Category */}
            {step === 'category' && (
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderOpen className="w-10 h-10 text-text-muted mx-auto mb-3" />
                    <p className="text-text-muted text-sm">Nenhuma categoria encontrada.</p>
                    <p className="text-text-muted text-xs mt-1">Você pode prosseguir sem categoria.</p>
                  </div>
                ) : (
                  categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                        selectedCategoryId === cat.id
                          ? 'border-primary bg-primary/5 text-text'
                          : 'border-border bg-surface-2/50 text-text-muted hover:border-primary/30 hover:text-text'
                      }`}
                    >
                      <FolderOpen className="w-4 h-4 shrink-0" />
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.domains && cat.domains.length > 0 && (
                        <span className="ml-auto text-xs text-text-muted">
                          {cat.domains.length} domínio{cat.domains.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {selectedCategoryId === cat.id && (
                        <Check className="w-4 h-4 text-primary ml-auto shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Step 2: Domain */}
            {step === 'domain' && (
              <div className="space-y-3">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
                  </div>
                ) : (
                  <>
                    {domains.length === 0 && !showAddDomain ? (
                      <div className="text-center py-6">
                        <Globe className="w-10 h-10 text-text-muted mx-auto mb-3" />
                        <p className="text-text-muted text-sm">Nenhum domínio cadastrado.</p>
                        <p className="text-text-muted text-xs mt-1">Adicione um domínio ou publique sem domínio personalizado.</p>
                      </div>
                    ) : (
                      domains.map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setSelectedDomainId(d.id === selectedDomainId ? null : d.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all ${
                            selectedDomainId === d.id
                              ? 'border-primary bg-primary/5 text-text'
                              : 'border-border bg-surface-2/50 text-text-muted hover:border-primary/30 hover:text-text'
                          }`}
                        >
                          <Globe className="w-4 h-4 shrink-0" />
                          <span className="text-sm font-medium">{d.domain}</span>
                          <span
                            className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                              d.ssl_status === 'active'
                                ? 'bg-primary/10 text-primary'
                                : 'bg-warning/10 text-warning'
                            }`}
                          >
                            {d.ssl_status === 'active' ? 'SSL Ativo' : 'SSL Pendente'}
                          </span>
                          {selectedDomainId === d.id && (
                            <Check className="w-4 h-4 text-primary shrink-0" />
                          )}
                        </button>
                      ))
                    )}

                    {/* Add domain inline */}
                    {showAddDomain ? (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="text"
                          value={newDomain}
                          onChange={(e) => setNewDomain(e.target.value)}
                          placeholder="ex: meusite.com.br"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                          className="flex-1 bg-surface-2 border border-border rounded-md px-3 py-2 text-text text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none"
                        />
                        <button
                          onClick={handleAddDomain}
                          disabled={addingDomain || !newDomain.trim()}
                          className="px-3 py-2 bg-primary text-bg text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
                        >
                          {addingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddDomain(false);
                            setNewDomain('');
                          }}
                          className="p-2 text-text-muted hover:text-text cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddDomain(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-dashed border-border text-text-muted hover:border-primary/50 hover:text-text cursor-pointer transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span className="text-sm">Adicionar domínio</span>
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Step 3: Published */}
            {step === 'published' && (
              <div className="text-center py-4 space-y-5">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Check className="w-8 h-8 text-primary" />
                </div>

                <div>
                  <h4 className="text-lg font-semibold text-text mb-1">Publicada com sucesso!</h4>
                  <p className="text-sm text-text-muted">Sua página está no ar e pronta para receber visitantes.</p>
                </div>

                {/* URL display */}
                <div className="bg-surface-2 border border-border rounded-lg p-4">
                  <p className="text-xs text-text-muted mb-2">URL da página</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-primary font-mono truncate">{publishedUrl}</code>
                    <button
                      onClick={handleCopyUrl}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium cursor-pointer transition-all ${
                        copied
                          ? 'bg-primary text-bg'
                          : 'bg-surface border border-border text-text hover:border-primary/50'
                      }`}
                    >
                      {copied ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <a
                  href={publishedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  Abrir em nova aba
                </a>
              </div>
            )}
          </div>

          {/* Footer */}
          {step !== 'published' && (
            <div className="px-6 py-4 border-t border-border flex items-center justify-between">
              <button
                onClick={step === 'category' ? onClose : () => setStep('category')}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-text-muted hover:text-text rounded-md cursor-pointer transition-colors"
              >
                {step === 'domain' && <ChevronLeft className="w-4 h-4" />}
                {step === 'category' ? 'Cancelar' : 'Voltar'}
              </button>

              {step === 'category' ? (
                <button
                  onClick={handleCategoryNext}
                  disabled={!selectedCategoryId}
                  className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-primary text-bg rounded-md hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold bg-primary text-bg rounded-md hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-colors"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Publicando...
                    </>
                  ) : (
                    <>
                      <Globe className="w-4 h-4" />
                      Publicar
                    </>
                  )}
                </button>
              )}
            </div>
          )}

          {/* Close button for published step */}
          {step === 'published' && (
            <div className="px-6 py-4 border-t border-border flex justify-center">
              <button
                onClick={onClose}
                className="px-6 py-2 text-sm font-medium bg-surface-2 border border-border text-text rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors"
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
