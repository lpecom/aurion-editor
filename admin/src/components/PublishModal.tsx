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

const STEPS: Step[] = ['category', 'domain'];

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
  const [visible, setVisible] = useState(false);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right'>('left');

  // Add domain form
  const [showAddDomain, setShowAddDomain] = useState(false);
  const [newDomain, setNewDomain] = useState('');
  const [addingDomain, setAddingDomain] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    setStep('category');
    setSelectedCategoryId(currentCategoryId || null);
    setSelectedDomainId(null);
    setPublishedUrl('');
    setCopied(false);
    setError('');
    setShowAddDomain(false);
    setNewDomain('');
    loadCategories();
    requestAnimationFrame(() => setVisible(true));
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
    setSlideDirection('left');
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

      // Fire confetti - more dramatic
      setTimeout(() => {
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'],
        });
      }, 200);
      setTimeout(() => {
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.5, x: 0.3 },
          colors: ['#22C55E', '#3B82F6'],
        });
      }, 500);
      setTimeout(() => {
        confetti({
          particleCount: 60,
          spread: 50,
          origin: { y: 0.5, x: 0.7 },
          colors: ['#F59E0B', '#8B5CF6'],
        });
      }, 700);
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

  const currentStepIndex = STEPS.indexOf(step as 'category' | 'domain');

  return (
    <>
      {/* Overlay */}
      <div
        className={`fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      >
        <div
          className={`bg-surface border border-border rounded-xl w-full max-w-lg shadow-2xl overflow-hidden transition-all duration-300 ${
            visible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="publish-modal-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              {step === 'published' ? (
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PartyPopper className="w-4 h-4 text-primary" />
                </div>
              ) : (
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Globe className="w-4 h-4 text-accent" />
                </div>
              )}
              <h3 className="text-lg font-semibold text-text">
                {step === 'category' && 'Escolha a Categoria'}
                {step === 'domain' && 'Escolha o Domínio'}
                {step === 'published' && 'Página Publicada!'}
              </h3>
            </div>
            <button
              onClick={onClose}
              aria-label="Fechar"
              className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Steps indicator - improved with connected line */}
          {step !== 'published' && (
            <div className="px-6 pt-5 pb-1">
              <div className="flex items-center justify-center gap-0">
                {STEPS.map((s, i) => (
                  <div key={s} className="flex items-center">
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                          s === step
                            ? 'bg-primary text-bg shadow-[0_0_12px_rgba(34,197,94,0.3)]'
                            : i < currentStepIndex
                              ? 'bg-primary text-bg'
                              : 'bg-surface-2 text-text-muted'
                        }`}
                      >
                        {i < currentStepIndex ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className={`text-xs font-medium transition-colors duration-200 ${
                        s === step ? 'text-primary' : 'text-text-muted'
                      }`}>
                        {s === 'category' ? 'Categoria' : 'Domínio'}
                      </span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`w-16 h-0.5 rounded-full mx-3 mb-5 transition-colors duration-300 ${
                        i < currentStepIndex ? 'bg-primary' : 'bg-surface-2'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Content */}
          <div className="px-6 py-5 min-h-[240px]">
            {error && (
              <div className="mb-4 flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Category */}
            {step === 'category' && (
              <div className="space-y-3 animate-fade-in">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 text-text-muted animate-spin" />
                  </div>
                ) : categories.length === 0 ? (
                  <div className="text-center py-8">
                    <FolderOpen className="w-10 h-10 text-text-muted mx-auto mb-3" />
                    <p className="text-text-muted text-sm">Nenhuma categoria encontrada.</p>
                    <p className="text-text-muted text-xs mt-1">Clique em "Próximo" para prosseguir sem categoria.</p>
                  </div>
                ) : (
                  categories.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategoryId(cat.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                        selectedCategoryId === cat.id
                          ? 'border-primary bg-primary/5 text-text shadow-[0_0_12px_rgba(34,197,94,0.1)]'
                          : 'border-border bg-surface-2/50 text-text-muted hover:border-primary/30 hover:text-text hover:bg-surface-2'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                        selectedCategoryId === cat.id ? 'bg-primary/10' : 'bg-surface-2'
                      }`}>
                        <FolderOpen className="w-4 h-4 shrink-0" />
                      </div>
                      <span className="text-sm font-medium">{cat.name}</span>
                      {cat.domains && cat.domains.length > 0 && (
                        <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-surface-2 text-text-muted">
                          {cat.domains.length} domínio{cat.domains.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {selectedCategoryId === cat.id && (
                        <Check className="w-4 h-4 text-primary shrink-0" />
                      )}
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Step 2: Domain */}
            {step === 'domain' && (
              <div className={`space-y-3 animate-fade-in ${
                slideDirection === 'left' ? 'slide-in-from-right-2' : 'slide-in-from-left-2'
              } duration-200`}>
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
                          className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                            selectedDomainId === d.id
                              ? 'border-primary bg-primary/5 text-text shadow-[0_0_12px_rgba(34,197,94,0.1)]'
                              : 'border-border bg-surface-2/50 text-text-muted hover:border-primary/30 hover:text-text hover:bg-surface-2'
                          }`}
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors duration-200 ${
                            selectedDomainId === d.id ? 'bg-primary/10' : 'bg-surface-2'
                          }`}>
                            <Globe className="w-4 h-4 shrink-0" />
                          </div>
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
                          className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all duration-200"
                        />
                        <button
                          onClick={handleAddDomain}
                          disabled={addingDomain || !newDomain.trim()}
                          className="px-3 py-2.5 bg-primary text-bg text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                        >
                          {addingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Adicionar'}
                        </button>
                        <button
                          onClick={() => {
                            setShowAddDomain(false);
                            setNewDomain('');
                          }}
                          aria-label="Cancelar"
                          className="p-2.5 text-text-muted hover:text-text cursor-pointer transition-colors duration-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddDomain(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border border-dashed border-border text-text-muted hover:border-primary/50 hover:text-text cursor-pointer transition-all duration-200"
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
              <div className="text-center py-4 space-y-5 animate-fade-in">
                <div className="w-20 h-20 bg-gradient-to-br from-primary/20 to-accent/10 rounded-full flex items-center justify-center mx-auto shadow-[0_0_30px_rgba(34,197,94,0.15)]">
                  <Check className="w-10 h-10 text-primary" />
                </div>

                <div>
                  <h4 className="text-xl font-bold text-text mb-1">Publicada com sucesso!</h4>
                  <p className="text-sm text-text-muted">Sua página está no ar e pronta para receber visitantes.</p>
                </div>

                {/* URL display */}
                <div className="bg-surface-2/80 backdrop-blur-sm border border-border rounded-xl p-4">
                  <p className="text-xs text-text-muted mb-2 uppercase tracking-wider font-medium">URL da página</p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm text-primary font-mono truncate">{publishedUrl}</code>
                    <button
                      onClick={handleCopyUrl}
                      aria-label={copied ? 'URL copiada' : 'Copiar URL'}
                      className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none ${
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
                  className="inline-flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors duration-200"
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
                onClick={() => {
                  if (step === 'category') {
                    onClose();
                  } else {
                    setSlideDirection('right');
                    setStep('category');
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-text-muted hover:text-text rounded-lg cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
              >
                {step === 'domain' && <ChevronLeft className="w-4 h-4" />}
                {step === 'category' ? 'Cancelar' : 'Voltar'}
              </button>

              {step === 'category' ? (
                <button
                  onClick={handleCategoryNext}
                  disabled={loading}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm font-medium bg-primary text-bg rounded-lg hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                >
                  Próximo
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={handlePublish}
                  disabled={publishing}
                  className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold bg-primary text-bg rounded-lg hover:bg-primary/90 disabled:opacity-50 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
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
                className="px-8 py-2.5 text-sm font-medium bg-surface-2 border border-border text-text rounded-lg hover:bg-surface-2/80 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
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
