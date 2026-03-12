import { useState, useEffect, useRef } from 'react';
import {
  X,
  Save,
  Settings,
  Globe,
  FileText,
  Newspaper,
  ChevronDown,
  Info,
  Code,
} from 'lucide-react';
import { api } from '../lib/api';

interface Page {
  id: string;
  title: string;
  slug: string;
  type: 'pv' | 'advertorial';
  lang: string;
  domain: string | null;
  category_id: string | null;
  status: string;
  frontmatter: Record<string, unknown>;
  category_config: Record<string, unknown>;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface Domain {
  id: string;
  domain: string;
}

interface Pixel {
  id: string;
  name: string;
  type: string;
  pixel_id: string;
}

interface PageDomainEntry {
  domain_id: string;
  is_primary: number;
}

interface PageDomainsResponse {
  page_domains: PageDomainEntry[];
  category_domains: PageDomainEntry[];
  effective_domains: PageDomainEntry[];
}

interface PageSettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  pageId: string | null;
  onSaved?: () => void;
}

const ADVERTORIAL_CATEGORIES = [
  'saude', 'beleza', 'financas', 'tecnologia', 'educacao', 'outros'
];

function SectionAccordion({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <section className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface-2/30 hover:bg-surface-2/60 cursor-pointer transition-all duration-200"
      >
        <span className="text-text-muted">{icon}</span>
        <span className="text-sm font-semibold text-text uppercase tracking-wider">{title}</span>
        <ChevronDown
          className={`w-4 h-4 ml-auto text-text-muted transition-transform duration-200 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>
      {isOpen && (
        <div className="px-4 py-4 space-y-4 border-t border-border/50 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </section>
  );
}

export default function PageSettingsDrawer({ open, onClose, pageId, onSaved }: PageSettingsDrawerProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [ogImage, setOgImage] = useState('');
  const [lang, setLang] = useState('pt-BR');
  const [categoryId, setCategoryId] = useState('');

  // Domain state
  const [selectedDomainIds, setSelectedDomainIds] = useState<string[]>([]);
  const [primaryDomainId, setPrimaryDomainId] = useState<string>('');
  const [hasPageDomains, setHasPageDomains] = useState(false);
  const [inheritedDomains, setInheritedDomains] = useState<PageDomainEntry[]>([]);

  // PV fields
  const [produto, setProduto] = useState('');
  const [preco, setPreco] = useState('');
  const [checkoutUrl, setCheckoutUrl] = useState('');
  const [selectedPixelIds, setSelectedPixelIds] = useState<string[]>([]);

  // Advertorial fields
  const [fonte, setFonte] = useState('');
  const [dataArtigo, setDataArtigo] = useState('');
  const [autor, setAutor] = useState('');
  const [ctaUrl, setCtaUrl] = useState('');
  const [advCategoria, setAdvCategoria] = useState('outros');

  useEffect(() => {
    if (open && pageId) {
      loadData();
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open, pageId]);

  async function loadData() {
    if (!pageId) return;
    setLoading(true);
    setError('');
    try {
      const [pageData, domainsData, pageDomains] = await Promise.all([
        api.get<Page>(`/pages/${pageId}`),
        api.get<Domain[]>('/domains'),
        api.get<PageDomainsResponse>(`/pages/${pageId}/domains`),
      ]);

      // Load categories based on page type
      const cats = await api.get<Category[]>(`/categories?type=${pageData.type}`);
      setCategories(cats);

      // Load pixels if needed
      if (pageData.type === 'pv' || pageData.type === 'advertorial') {
        const pxls = await api.get<Pixel[]>('/pixels');
        setPixels(pxls);
      }

      setPage(pageData);
      setDomains(domainsData);

      // Populate form
      setTitle(pageData.title);
      setSlug(pageData.slug);
      setLang(pageData.lang || 'pt-BR');
      setCategoryId(pageData.category_id || '');

      const fm = pageData.frontmatter || {};
      setDescription((fm.description as string) || '');
      setOgImage((fm.og_image as string) || '');

      // Domain state
      const pd = pageDomains.page_domains || [];
      setHasPageDomains(pd.length > 0);
      setSelectedDomainIds(pd.map((d) => d.domain_id));
      const primary = pd.find((d) => d.is_primary);
      setPrimaryDomainId(primary?.domain_id || '');
      setInheritedDomains(pageDomains.category_domains || []);

      // Type-specific fields from frontmatter
      if (pageData.type === 'pv') {
        setProduto((fm.produto as string) || '');
        setPreco(String((fm.preco as number) || ''));
        setCheckoutUrl((fm.checkout_url as string) || '');
        setSelectedPixelIds((fm.pixel_ids as string[]) || []);
      } else if (pageData.type === 'advertorial') {
        setFonte((fm.fonte as string) || '');
        setDataArtigo((fm.data_artigo as string) || '');
        setAutor((fm.autor as string) || '');
        setCtaUrl((fm.cta_url as string) || '');
        setAdvCategoria((fm.adv_categoria as string) || 'outros');
        setSelectedPixelIds((fm.pixel_ids as string[]) || []);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (!pageId || !page) return;
    setSaving(true);
    setError('');
    try {
      const frontmatter: Record<string, unknown> = {
        description,
        og_image: ogImage,
      };

      if (page.type === 'pv') {
        frontmatter.produto = produto;
        frontmatter.preco = preco ? Number(preco) : null;
        frontmatter.checkout_url = checkoutUrl;
        frontmatter.pixel_ids = selectedPixelIds;
      } else if (page.type === 'advertorial') {
        frontmatter.fonte = fonte;
        frontmatter.data_artigo = dataArtigo;
        frontmatter.autor = autor;
        frontmatter.cta_url = ctaUrl;
        frontmatter.adv_categoria = advCategoria;
        frontmatter.pixel_ids = selectedPixelIds;
      }

      await api.put(`/pages/${pageId}`, {
        title,
        slug,
        lang,
        category_id: categoryId || null,
        frontmatter,
      });

      // Save domains
      await api.put(`/pages/${pageId}/domains`, {
        domain_ids: selectedDomainIds,
        primary_domain_id: primaryDomainId || null,
      });

      onSaved?.();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  function toggleDomainSelection(domainId: string) {
    setHasPageDomains(true);
    setSelectedDomainIds((prev) =>
      prev.includes(domainId) ? prev.filter((id) => id !== domainId) : [...prev, domainId]
    );
    if (primaryDomainId === domainId) {
      setPrimaryDomainId('');
    }
  }

  function togglePixelSelection(pixelId: string) {
    setSelectedPixelIds((prev) =>
      prev.includes(pixelId) ? prev.filter((id) => id !== pixelId) : [...prev, pixelId]
    );
  }

  if (!open) return null;

  const inputClass = 'w-full bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all duration-200';
  const selectClass = `${inputClass} cursor-pointer`;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        onClick={(e) => e.target === overlayRef.current && onClose()}
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-300 ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Drawer */}
      <div
        className={`fixed top-0 right-0 z-50 h-screen w-full max-w-md bg-surface border-l border-border flex flex-col shadow-2xl transition-transform duration-300 ease-out ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Configurações da Página"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-surface-2 flex items-center justify-center">
              <Settings className="w-4 h-4 text-text-muted" />
            </div>
            <h3 className="text-lg font-semibold text-text">Configurações</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar configurações"
            className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="h-4 w-24 bg-surface-2 rounded animate-pulse" />
                  <div className="h-10 bg-surface-2 rounded-lg animate-pulse" />
                  <div className="h-10 bg-surface-2 rounded-lg animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {error && (
                <div className="flex items-center gap-2 text-sm text-danger bg-danger/10 border border-danger/20 rounded-lg px-3 py-2.5">
                  <span>{error}</span>
                </div>
              )}

              {/* General Section */}
              <SectionAccordion
                title="Geral"
                icon={<Settings className="w-4 h-4" />}
                defaultOpen={true}
              >
                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">Título</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">Slug</label>
                  <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} className={`${inputClass} font-mono`} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">Descrição (SEO)</label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    className={`${inputClass} resize-none`}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">OG Image</label>
                  <input type="text" value={ogImage} onChange={(e) => setOgImage(e.target.value)} placeholder="https://..." className={inputClass} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">Língua</label>
                  <select value={lang} onChange={(e) => setLang(e.target.value)} className={selectClass}>
                    <option value="pt-BR">Português (BR)</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">Categoria</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={selectClass}>
                    <option value="">Sem categoria</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-text-muted mb-1.5">Status</label>
                  <span
                    className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
                      page?.status === 'published'
                        ? 'bg-primary/10 text-primary'
                        : 'bg-warning/10 text-warning'
                    }`}
                  >
                    {page?.status === 'published' ? 'Publicada' : 'Rascunho'}
                  </span>
                </div>
              </SectionAccordion>

              {/* Domains Section */}
              <SectionAccordion
                title="Domínios"
                icon={<Globe className="w-4 h-4" />}
                defaultOpen={false}
              >
                {domains.length === 0 ? (
                  <p className="text-sm text-text-muted">Nenhum domínio cadastrado.</p>
                ) : (
                  <div className="space-y-2">
                    {domains.map((d) => {
                      const selected = selectedDomainIds.includes(d.id);
                      return (
                        <div
                          key={d.id}
                          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border transition-all duration-200 ${
                            selected
                              ? 'border-primary/30 bg-primary/5'
                              : 'border-border bg-surface-2/30 hover:bg-surface-2/60'
                          }`}
                        >
                          <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={selected}
                              onChange={() => toggleDomainSelection(d.id)}
                              className="accent-primary cursor-pointer w-4 h-4 rounded"
                            />
                            <span className="text-sm text-text">{d.domain}</span>
                          </label>
                          {selected && (
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="radio"
                                name="primaryDomain"
                                checked={primaryDomainId === d.id}
                                onChange={() => setPrimaryDomainId(d.id)}
                                className="accent-primary cursor-pointer"
                              />
                              <span className="text-xs text-text-muted">Principal</span>
                            </label>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {!hasPageDomains && inheritedDomains.length > 0 && (
                  <div className="flex items-start gap-2 text-xs bg-accent/5 border border-accent/20 rounded-lg px-3 py-2.5">
                    <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                    <span className="text-text-muted">
                      Herdando domínios da categoria ({inheritedDomains.length} domínio{inheritedDomains.length !== 1 ? 's' : ''})
                    </span>
                  </div>
                )}
              </SectionAccordion>

              {/* PV-specific */}
              {page?.type === 'pv' && (
                <SectionAccordion
                  title="Página de Venda"
                  icon={<FileText className="w-4 h-4" />}
                  defaultOpen={false}
                >
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Produto</label>
                    <input type="text" value={produto} onChange={(e) => setProduto(e.target.value)} className={inputClass} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Preço</label>
                    <input type="number" value={preco} onChange={(e) => setPreco(e.target.value)} step="0.01" className={inputClass} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Checkout URL</label>
                    <input type="url" value={checkoutUrl} onChange={(e) => setCheckoutUrl(e.target.value)} placeholder="https://..." className={inputClass} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Pixels</label>
                    <div className="space-y-2">
                      {pixels.length === 0 ? (
                        <p className="text-sm text-text-muted">Nenhum pixel cadastrado.</p>
                      ) : (
                        pixels.map((p) => (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                              selectedPixelIds.includes(p.id)
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-border bg-surface-2/30 hover:bg-surface-2/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPixelIds.includes(p.id)}
                              onChange={() => togglePixelSelection(p.id)}
                              className="accent-primary cursor-pointer w-4 h-4"
                            />
                            <Code className="w-3.5 h-3.5 text-text-muted" />
                            <span className="text-sm text-text">{p.name}</span>
                            <span className="text-xs text-text-muted ml-auto">({p.type})</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </SectionAccordion>
              )}

              {/* Advertorial-specific */}
              {page?.type === 'advertorial' && (
                <SectionAccordion
                  title="Advertorial"
                  icon={<Newspaper className="w-4 h-4" />}
                  defaultOpen={false}
                >
                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Fonte / Veículo</label>
                    <input type="text" value={fonte} onChange={(e) => setFonte(e.target.value)} placeholder="Ex: Portal G3" className={inputClass} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Data do artigo</label>
                    <input type="date" value={dataArtigo} onChange={(e) => setDataArtigo(e.target.value)} className={selectClass} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Autor</label>
                    <input type="text" value={autor} onChange={(e) => setAutor(e.target.value)} className={inputClass} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">CTA destino URL</label>
                    <input type="url" value={ctaUrl} onChange={(e) => setCtaUrl(e.target.value)} placeholder="https://..." className={inputClass} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Categoria</label>
                    <select value={advCategoria} onChange={(e) => setAdvCategoria(e.target.value)} className={selectClass}>
                      {ADVERTORIAL_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat.charAt(0).toUpperCase() + cat.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-text-muted mb-1.5">Pixels</label>
                    <div className="space-y-2">
                      {pixels.length === 0 ? (
                        <p className="text-sm text-text-muted">Nenhum pixel cadastrado.</p>
                      ) : (
                        pixels.map((p) => (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-all duration-200 ${
                              selectedPixelIds.includes(p.id)
                                ? 'border-primary/30 bg-primary/5'
                                : 'border-border bg-surface-2/30 hover:bg-surface-2/60'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedPixelIds.includes(p.id)}
                              onChange={() => togglePixelSelection(p.id)}
                              className="accent-primary cursor-pointer w-4 h-4"
                            />
                            <Code className="w-3.5 h-3.5 text-text-muted" />
                            <span className="text-sm text-text">{p.name}</span>
                            <span className="text-xs text-text-muted ml-auto">({p.type})</span>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                </SectionAccordion>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4 flex gap-3 shrink-0">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving || loading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </>
  );
}
