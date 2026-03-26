import { useState, useEffect, useCallback, useRef } from 'react';
import { Code, Plus, Pencil, Trash2, ChevronDown, X, FileText } from 'lucide-react';
import { api } from '../../lib/api';
import Modal from '../../components/ui/Modal';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import Badge from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import ResourceFolderNav from '../../components/ResourceFolderNav';

interface PageItem {
  id: string;
  title: string;
  slug: string;
  type: string;
}

interface Pixel {
  id: string;
  name: string;
  type: string;
  pixel_id: string;
  config: Record<string, unknown> | null;
  events: string[];
  page_ids: string[];
  created_at: string;
}

interface PixelForm {
  name: string;
  type: string;
  pixel_id: string;
  config: string;
  events: string[];
  page_ids: string[];
  custom_event: string;
}

const PIXEL_TYPES = ['Facebook Pixel', 'Google Analytics', 'Google Ads', 'TikTok Pixel', 'Taboola Ads', 'Custom'];

const PIXEL_TYPE_MAP: Record<string, string> = {
  'Facebook Pixel': 'facebook',
  'Google Analytics': 'google',
  'Google Ads': 'google',
  'TikTok Pixel': 'tiktok',
  'Taboola Ads': 'taboola',
  'Custom': 'custom',
};

const PIXEL_TYPE_REVERSE: Record<string, string> = {
  facebook: 'Facebook Pixel',
  google: 'Google Analytics',
  tiktok: 'TikTok Pixel',
  taboola: 'Taboola Ads',
  custom: 'Custom',
};

const PIXEL_TYPE_DESCRIPTIONS: Record<string, string> = {
  'Facebook Pixel': 'Rastreamento de conversoes e eventos do Meta Ads.',
  'Google Analytics': 'Analise de trafego e comportamento de usuarios.',
  'Google Ads': 'Rastreamento de conversoes do Google Ads.',
  'TikTok Pixel': 'Rastreamento de eventos do TikTok Ads.',
  'Taboola Ads': 'Rastreamento de conversoes e eventos do Taboola Ads.',
  'Custom': 'Pixel personalizado com configuracao JSON.',
};

const PIXEL_EVENTS: Record<string, string[]> = {
  'Facebook Pixel': ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'Purchase', 'Lead', 'CompleteRegistration', 'Search'],
  'Google Analytics': ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase', 'generate_lead', 'sign_up', 'search'],
  'Google Ads': ['page_view', 'view_item', 'add_to_cart', 'begin_checkout', 'add_payment_info', 'purchase', 'generate_lead', 'sign_up', 'search'],
  'TikTok Pixel': ['ViewContent', 'AddToCart', 'InitiateCheckout', 'AddPaymentInfo', 'CompletePayment', 'SubmitForm', 'CompleteRegistration', 'Search'],
  'Taboola Ads': ['page_view', 'view_content', 'add_to_cart', 'start_checkout', 'add_payment_info', 'make_purchase', 'lead', 'complete_registration', 'search'],
  'Custom': [],
};

const emptyForm: PixelForm = { name: '', type: 'Facebook Pixel', pixel_id: '', config: '', events: [], page_ids: [], custom_event: '' };

function typeBadgeVariant(type: string) {
  const label = PIXEL_TYPE_REVERSE[type] || type;
  switch (label) {
    case 'Facebook Pixel': return 'info' as const;
    case 'Google Analytics': return 'warning' as const;
    case 'Google Ads': return 'success' as const;
    case 'TikTok Pixel': return 'danger' as const;
    case 'Taboola Ads': return 'default' as const;
    default: return 'default' as const;
  }
}

function typeLabel(type: string) {
  return PIXEL_TYPE_REVERSE[type] || type;
}

function MultiSelectPages({
  pages,
  selectedIds,
  onChange,
}: {
  pages: PageItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (id: string) => {
    onChange(
      selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]
    );
  };

  const removeTag = (id: string) => {
    onChange(selectedIds.filter((i) => i !== id));
  };

  const selectedPages = pages.filter((p) => selectedIds.includes(p.id));
  const allSelected = selectedIds.length === 0;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm text-left flex items-center gap-2 cursor-pointer focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
      >
        <FileText className="w-3.5 h-3.5 text-text-muted shrink-0" />
        <span className="flex-1 truncate">
          {allSelected
            ? 'Todas as paginas'
            : `${selectedPages.length} pagina${selectedPages.length !== 1 ? 's' : ''} selecionada${selectedPages.length !== 1 ? 's' : ''}`}
        </span>
        <ChevronDown className={`w-4 h-4 text-text-muted transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Tags */}
      {selectedPages.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedPages.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center gap-1 bg-primary/10 text-primary text-xs font-medium px-2 py-1 rounded-md"
            >
              {p.title}
              <button
                type="button"
                onClick={() => removeTag(p.id)}
                className="hover:text-primary/70 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-surface border border-border rounded-lg shadow-xl max-h-60 overflow-y-auto">
          {/* Option: All pages */}
          <button
            type="button"
            onClick={() => { onChange([]); setOpen(false); }}
            className={`w-full text-left px-3 py-2.5 text-sm cursor-pointer transition-colors duration-150 ${
              allSelected ? 'bg-primary/10 text-primary font-medium' : 'text-text hover:bg-surface-2'
            }`}
          >
            Todas as paginas
          </button>

          <div className="border-t border-border/50" />

          {pages.map((p) => {
            const checked = selectedIds.includes(p.id);
            return (
              <label
                key={p.id}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer transition-colors duration-150 ${
                  checked ? 'bg-primary/5' : 'hover:bg-surface-2'
                }`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(p.id)}
                  className="accent-primary cursor-pointer w-3.5 h-3.5"
                />
                <span className="text-text flex-1 truncate">{p.title}</span>
                <span className="text-[11px] text-text-muted">{p.type}</span>
              </label>
            );
          })}

          {pages.length === 0 && (
            <p className="px-3 py-2 text-sm text-text-muted">Nenhuma pagina disponivel.</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Pixels() {
  const [pixels, setPixels] = useState<Pixel[]>([]);
  const [pages, setPages] = useState<PageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Pixel | null>(null);
  const [form, setForm] = useState<PixelForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Pixel | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [selectedPageId, setSelectedPageId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [pixelData, pageData] = await Promise.all([
        api.get<Pixel[]>('/pixels'),
        api.get<PageItem[]>('/pages'),
      ]);
      setPixels(pixelData);
      setPages(pageData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (pixel: Pixel) => {
    setEditing(pixel);
    const label = PIXEL_TYPE_REVERSE[pixel.type] || pixel.type;
    setForm({
      name: pixel.name,
      type: label,
      pixel_id: pixel.pixel_id,
      config: pixel.config ? JSON.stringify(pixel.config, null, 2) : '',
      events: pixel.events || [],
      page_ids: pixel.page_ids || [],
      custom_event: '',
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const backendType = PIXEL_TYPE_MAP[form.type] || form.type;
      const body: Record<string, unknown> = {
        name: form.name,
        type: backendType,
        pixel_id: form.pixel_id,
        config: form.config ? JSON.parse(form.config) : null,
        events: form.events,
        page_ids: form.page_ids,
      };
      if (editing) {
        await api.put(`/pixels/${editing.id}`, body);
      } else {
        await api.post('/pixels', body);
      }
      setModalOpen(false);
      fetchData();
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/pixels/${deleteTarget.id}`);
      setPixels((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    } catch {
      // silently fail
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  const toggleEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.includes(event)
        ? prev.events.filter((e) => e !== event)
        : [...prev.events, event],
    }));
  };

  const addCustomEvent = () => {
    const evt = form.custom_event.trim();
    if (!evt || form.events.includes(evt)) return;
    setForm((prev) => ({
      ...prev,
      events: [...prev.events, evt],
      custom_event: '',
    }));
  };

  const removeEvent = (event: string) => {
    setForm((prev) => ({
      ...prev,
      events: prev.events.filter((e) => e !== event),
    }));
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR');

  const availableEvents = PIXEL_EVENTS[form.type] || [];

  return (
    <div className="flex -m-6 h-[calc(100vh-3.5rem)]">
      <ResourceFolderNav selectedPageId={selectedPageId} onSelectPage={setSelectedPageId} />
      <div className="flex-1 overflow-y-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/10 p-2.5">
            <Code className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-text">Pixels</h1>
            <p className="text-sm text-text-muted">Gerencie seus pixels de rastreamento e conversao.</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          <Plus className="w-4 h-4" />
          Novo Pixel
        </button>
      </div>

      {loading && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-6 py-4 border-b border-border last:border-b-0 animate-pulse">
              <div className="h-4 bg-surface-2 rounded w-1/4" />
              <div className="h-5 bg-surface-2 rounded-full w-24" />
              <div className="h-4 bg-surface-2 rounded w-1/5" />
              <div className="h-4 bg-surface-2 rounded w-1/6 ml-auto" />
            </div>
          ))}
        </div>
      )}

      {!loading && pixels.length === 0 && (
        <EmptyState
          icon={Code}
          title="Nenhum pixel configurado"
          description="Adicione seu primeiro pixel de rastreamento."
          action={
            <button
              onClick={openCreate}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              <Plus className="w-4 h-4" />
              Novo Pixel
            </button>
          }
        />
      )}

      {!loading && pixels.length > 0 && (
        <div className="bg-surface border border-border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-2/30">
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Nome</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Tipo</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Pixel ID</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Paginas</th>
                <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Criado em</th>
                <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3.5">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pixels.map((pixel) => (
                <tr key={pixel.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200 border-l-2 border-l-transparent hover:border-l-primary">
                  <td className="px-6 py-4 text-text font-medium">{pixel.name}</td>
                  <td className="px-6 py-4">
                    <Badge variant={typeBadgeVariant(pixel.type)} dot>{typeLabel(pixel.type)}</Badge>
                  </td>
                  <td className="px-6 py-4 text-text-muted font-mono text-sm">{pixel.pixel_id}</td>
                  <td className="px-6 py-4 text-text-muted text-sm">
                    {pixel.page_ids.length === 0
                      ? <span className="text-text-muted/60">Todas</span>
                      : `${pixel.page_ids.length} pagina${pixel.page_ids.length !== 1 ? 's' : ''}`}
                  </td>
                  <td className="px-6 py-4 text-text-muted text-sm">{formatDate(pixel.created_at)}</td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(pixel)}
                        aria-label={`Editar ${pixel.name}`}
                        title={`Editar ${pixel.name}`}
                        className="p-2 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(pixel)}
                        aria-label={`Excluir ${pixel.name}`}
                        title={`Excluir ${pixel.name}`}
                        className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-danger/50 focus:outline-none"
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

      {/* Create/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Pixel' : 'Novo Pixel'}
        footer={
          <>
            <button
              onClick={() => setModalOpen(false)}
              className="bg-surface-2 border border-border text-text px-4 py-2 rounded-md hover:bg-surface-2/80 cursor-pointer transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name || !form.pixel_id}
              className="bg-primary text-bg font-medium px-4 py-2 rounded-md hover:bg-primary/90 cursor-pointer transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Nome</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="Meu Pixel"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value, events: [] })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none cursor-pointer transition-colors duration-200"
            >
              {PIXEL_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <p className="text-xs text-text-muted mt-1.5">{PIXEL_TYPE_DESCRIPTIONS[form.type]}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Pixel ID</label>
            <input
              type="text"
              value={form.pixel_id}
              onChange={(e) => setForm({ ...form, pixel_id: e.target.value })}
              className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
              placeholder="123456789"
            />
          </div>

          {/* Page selector */}
          <div>
            <label className="block text-sm font-medium text-text mb-1">Paginas</label>
            <MultiSelectPages
              pages={pages}
              selectedIds={form.page_ids}
              onChange={(ids) => setForm({ ...form, page_ids: ids })}
            />
            <p className="text-xs text-text-muted mt-1.5">
              Selecione em quais paginas este pixel sera injetado. Vazio = todas.
            </p>
          </div>

          {/* Events selector */}
          {form.type !== 'Custom' && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">Eventos</label>
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {availableEvents.map((evt) => (
                  <label
                    key={evt}
                    className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md border cursor-pointer transition-all duration-150 ${
                      form.events.includes(evt)
                        ? 'border-primary/30 bg-primary/5'
                        : 'border-border/50 bg-surface-2/30 hover:bg-surface-2/60'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={form.events.includes(evt)}
                      onChange={() => toggleEvent(evt)}
                      className="accent-primary cursor-pointer w-3.5 h-3.5"
                    />
                    <span className="text-sm text-text font-mono">{evt}</span>
                  </label>
                ))}
              </div>

              {/* Custom events already added that aren't in the predefined list */}
              {form.events.filter((e) => !availableEvents.includes(e)).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {form.events
                    .filter((e) => !availableEvents.includes(e))
                    .map((evt) => (
                      <span
                        key={evt}
                        className="inline-flex items-center gap-1 bg-accent/10 text-accent text-xs font-mono px-2 py-1 rounded-md"
                      >
                        {evt}
                        <button type="button" onClick={() => removeEvent(evt)} className="hover:text-accent/70 cursor-pointer">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                </div>
              )}

              {/* Add custom event */}
              <div className="flex gap-2 mt-2">
                <input
                  type="text"
                  value={form.custom_event}
                  onChange={(e) => setForm({ ...form, custom_event: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomEvent(); } }}
                  className="flex-1 bg-surface-2 border border-border text-text rounded-md px-3 py-1.5 text-sm font-mono focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                  placeholder="Evento customizado..."
                />
                <button
                  type="button"
                  onClick={addCustomEvent}
                  disabled={!form.custom_event.trim()}
                  className="bg-surface-2 border border-border text-text-muted px-3 py-1.5 rounded-md text-sm hover:text-text hover:bg-surface-2/80 cursor-pointer transition-colors duration-200 disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {form.type === 'Custom' && (
            <div>
              <label className="block text-sm font-medium text-text mb-1">Configuracoes (JSON)</label>
              <textarea
                value={form.config}
                onChange={(e) => setForm({ ...form, config: e.target.value })}
                rows={4}
                className="w-full bg-bg border border-border text-text rounded-md px-3 py-2 font-mono text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                placeholder='{"code": "<script>...</script>"}'
              />
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        loading={deleting}
        message={`Deseja excluir o pixel "${deleteTarget?.name}"? Esta acao nao pode ser desfeita.`}
      />
      </div>
    </div>
  );
}
