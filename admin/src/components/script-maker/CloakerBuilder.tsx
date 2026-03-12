import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Check, Trash2, AlertCircle, Info } from 'lucide-react';
import { api } from '../../lib/api';

interface Page {
  id: string;
  title: string;
  slug: string;
  status: string;
}

interface CloakerRules {
  enabled: number;
  action: string;
  redirect_url: string;
  safe_page_id: string | null;
  url_whitelist: string[];
  countries_mode: string;
  countries: string[];
  devices_mode: string;
  devices: string[];
  browsers_mode: string;
  browsers: string[];
}

const defaultRules: CloakerRules = {
  enabled: 1,
  action: 'redirect',
  redirect_url: '',
  safe_page_id: null,
  url_whitelist: [],
  countries_mode: 'allow',
  countries: [],
  devices_mode: 'allow',
  devices: [],
  browsers_mode: 'allow',
  browsers: [],
};

const COUNTRIES = [
  { code: 'BR', name: 'Brasil' }, { code: 'US', name: 'Estados Unidos' }, { code: 'PT', name: 'Portugal' },
  { code: 'ES', name: 'Espanha' }, { code: 'AR', name: 'Argentina' }, { code: 'MX', name: 'México' },
  { code: 'CO', name: 'Colômbia' }, { code: 'CL', name: 'Chile' }, { code: 'PE', name: 'Peru' },
  { code: 'DE', name: 'Alemanha' }, { code: 'FR', name: 'França' }, { code: 'IT', name: 'Itália' },
  { code: 'GB', name: 'Reino Unido' }, { code: 'CA', name: 'Canadá' }, { code: 'AU', name: 'Austrália' },
  { code: 'JP', name: 'Japão' }, { code: 'IN', name: 'Índia' }, { code: 'CN', name: 'China' },
  { code: 'RU', name: 'Rússia' }, { code: 'KR', name: 'Coreia do Sul' }, { code: 'AO', name: 'Angola' },
  { code: 'MZ', name: 'Moçambique' }, { code: 'CV', name: 'Cabo Verde' }, { code: 'GW', name: 'Guiné-Bissau' },
  { code: 'TL', name: 'Timor-Leste' }, { code: 'UY', name: 'Uruguai' }, { code: 'PY', name: 'Paraguai' },
  { code: 'BO', name: 'Bolívia' }, { code: 'EC', name: 'Equador' }, { code: 'VE', name: 'Venezuela' },
].sort((a, b) => a.name.localeCompare(b.name));

const DEVICES = [
  { id: 'desktop', label: 'Desktop' },
  { id: 'mobile', label: 'Mobile' },
  { id: 'tablet', label: 'Tablet' },
];

const BROWSERS = [
  { id: 'chrome', label: 'Chrome' },
  { id: 'firefox', label: 'Firefox' },
  { id: 'safari', label: 'Safari' },
  { id: 'edge', label: 'Edge' },
  { id: 'opera', label: 'Opera' },
  { id: 'other', label: 'Outros' },
];

export default function CloakerBuilder() {
  const [pages, setPages] = useState<Page[]>([]);
  const [selectedPageId, setSelectedPageId] = useState('');
  const [rules, setRules] = useState<CloakerRules>(defaultRules);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [hasExisting, setHasExisting] = useState(false);
  const [whitelistInput, setWhitelistInput] = useState('');
  const [countrySearch, setCountrySearch] = useState('');

  // Load pages
  useEffect(() => {
    api.get<Page[]>('/pages').then(setPages).catch(() => {});
  }, []);

  // Load cloaker rules when page is selected
  const loadRules = useCallback(async (pageId: string) => {
    if (!pageId) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.get<CloakerRules>(`/pages/${pageId}/cloaker`);
      setRules(data);
      setHasExisting(true);
    } catch {
      setRules(defaultRules);
      setHasExisting(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedPageId) loadRules(selectedPageId);
  }, [selectedPageId, loadRules]);

  const handleSave = async () => {
    if (!selectedPageId) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/pages/${selectedPageId}/cloaker`, rules);
      setSaved(true);
      setHasExisting(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPageId) return;
    setDeleting(true);
    try {
      await api.delete(`/pages/${selectedPageId}/cloaker`);
      setRules(defaultRules);
      setHasExisting(false);
    } catch (err: any) {
      setError(err.message || 'Erro ao remover');
    } finally {
      setDeleting(false);
    }
  };

  const addWhitelistItem = () => {
    const value = whitelistInput.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (value && !rules.url_whitelist.includes(value)) {
      setRules(prev => ({ ...prev, url_whitelist: [...prev.url_whitelist, value] }));
    }
    setWhitelistInput('');
  };

  const removeWhitelistItem = (item: string) => {
    setRules(prev => ({ ...prev, url_whitelist: prev.url_whitelist.filter(i => i !== item) }));
  };

  const toggleArrayItem = (field: 'countries' | 'devices' | 'browsers', item: string) => {
    setRules(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item],
    }));
  };

  const filteredCountries = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
    c.code.toLowerCase().includes(countrySearch.toLowerCase())
  );

  const selectedPage = pages.find(p => p.id === selectedPageId);

  return (
    <div className="space-y-5">
      {/* Page selector */}
      <div>
        <label className="block text-sm font-medium text-text mb-1">Página</label>
        <select
          value={selectedPageId}
          onChange={(e) => setSelectedPageId(e.target.value)}
          className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none cursor-pointer transition-colors duration-200"
        >
          <option value="">Selecione uma página...</option>
          {pages.map(p => (
            <option key={p.id} value={p.id}>{p.title} ({p.slug})</option>
          ))}
        </select>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
        </div>
      )}

      {selectedPageId && !loading && (
        <>
          {/* Info banner */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
            <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-text-muted">
              {selectedPage?.status === 'published'
                ? 'As regras serão aplicadas imediatamente ao salvar (republica automaticamente).'
                : 'As regras serão aplicadas quando a página for publicada.'}
            </p>
          </div>

          {/* Enable toggle */}
          <label className="flex items-center gap-3 p-3 rounded-lg bg-surface-2/50 border border-border cursor-pointer">
            <button
              type="button"
              role="switch"
              aria-checked={!!rules.enabled}
              onClick={() => setRules(prev => ({ ...prev, enabled: prev.enabled ? 0 : 1 }))}
              className={`relative inline-flex h-6 w-11 items-center rounded-full shrink-0 cursor-pointer transition-colors duration-200 ${
                rules.enabled ? 'bg-primary' : 'bg-surface-2 border border-border'
              }`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                rules.enabled ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
            <span className="text-sm font-medium text-text">Cloaker ativo</span>
          </label>

          {rules.enabled ? (
            <>
              {/* URL Whitelist */}
              <div>
                <label className="block text-sm font-medium text-text mb-1">URL Whitelist (referrers permitidos)</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addWhitelistItem(); }}}
                    className="flex-1 bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                    placeholder="facebook.com"
                  />
                  <button
                    type="button"
                    onClick={addWhitelistItem}
                    className="px-3 py-2 rounded-md bg-surface-2 border border-border text-text-muted hover:text-text text-sm cursor-pointer transition-colors duration-200"
                  >
                    Adicionar
                  </button>
                </div>
                {rules.url_whitelist.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {rules.url_whitelist.map(item => (
                      <span key={item} className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-surface-2 border border-border text-sm text-text">
                        {item}
                        <button onClick={() => removeWhitelistItem(item)} className="text-text-muted hover:text-danger cursor-pointer">×</button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-text-muted mt-1">Visitantes vindos de URLs fora da whitelist serão bloqueados. Vazio = sem filtro de referrer.</p>
              </div>

              {/* Countries */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm font-medium text-text">Países</label>
                  <div className="flex gap-1">
                    {['allow', 'block'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRules(prev => ({ ...prev, countries_mode: mode }))}
                        className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-colors duration-200 ${
                          rules.countries_mode === mode
                            ? 'bg-primary text-bg font-medium'
                            : 'bg-surface-2 border border-border text-text-muted'
                        }`}
                      >
                        {mode === 'allow' ? 'Permitir' : 'Bloquear'}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="text"
                  value={countrySearch}
                  onChange={(e) => setCountrySearch(e.target.value)}
                  className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm mb-2 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                  placeholder="Buscar país..."
                />
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-[200px] overflow-y-auto p-1">
                  {filteredCountries.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => toggleArrayItem('countries', c.code)}
                      className={`text-left px-2.5 py-1.5 rounded text-xs cursor-pointer transition-colors duration-200 ${
                        rules.countries.includes(c.code)
                          ? 'bg-primary/15 text-primary border border-primary/30 font-medium'
                          : 'bg-surface-2/50 border border-border text-text-muted hover:text-text'
                      }`}
                    >
                      {c.code} — {c.name}
                    </button>
                  ))}
                </div>
                {rules.countries.length > 0 && (
                  <p className="text-xs text-text-muted mt-1">
                    {rules.countries_mode === 'allow' ? 'Apenas' : 'Bloqueando'}: {rules.countries.join(', ')}
                  </p>
                )}
              </div>

              {/* Devices */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text">Dispositivos</label>
                  <div className="flex gap-1">
                    {['allow', 'block'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRules(prev => ({ ...prev, devices_mode: mode }))}
                        className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-colors duration-200 ${
                          rules.devices_mode === mode
                            ? 'bg-primary text-bg font-medium'
                            : 'bg-surface-2 border border-border text-text-muted'
                        }`}
                      >
                        {mode === 'allow' ? 'Permitir' : 'Bloquear'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {DEVICES.map(d => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => toggleArrayItem('devices', d.id)}
                      className={`flex-1 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors duration-200 ${
                        rules.devices.includes(d.id)
                          ? 'bg-primary/15 text-primary border border-primary/30 font-medium'
                          : 'bg-surface-2 border border-border text-text-muted hover:text-text'
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Browsers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-text">Navegadores</label>
                  <div className="flex gap-1">
                    {['allow', 'block'].map(mode => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setRules(prev => ({ ...prev, browsers_mode: mode }))}
                        className={`px-2.5 py-1 rounded text-xs cursor-pointer transition-colors duration-200 ${
                          rules.browsers_mode === mode
                            ? 'bg-primary text-bg font-medium'
                            : 'bg-surface-2 border border-border text-text-muted'
                        }`}
                      >
                        {mode === 'allow' ? 'Permitir' : 'Bloquear'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {BROWSERS.map(b => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleArrayItem('browsers', b.id)}
                      className={`px-3 py-2 rounded-md text-sm cursor-pointer transition-colors duration-200 ${
                        rules.browsers.includes(b.id)
                          ? 'bg-primary/15 text-primary border border-primary/30 font-medium'
                          : 'bg-surface-2 border border-border text-text-muted hover:text-text'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Block Action */}
              <div>
                <label className="block text-sm font-medium text-text mb-2">Ação ao bloquear</label>
                <div className="flex gap-2 mb-3">
                  <button
                    type="button"
                    onClick={() => setRules(prev => ({ ...prev, action: 'redirect' }))}
                    className={`flex-1 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors duration-200 ${
                      rules.action === 'redirect'
                        ? 'bg-primary text-bg font-medium'
                        : 'bg-surface-2 border border-border text-text-muted hover:text-text'
                    }`}
                  >
                    Redirecionar para URL
                  </button>
                  <button
                    type="button"
                    onClick={() => setRules(prev => ({ ...prev, action: 'safe_page' }))}
                    className={`flex-1 px-3 py-2 rounded-md text-sm cursor-pointer transition-colors duration-200 ${
                      rules.action === 'safe_page'
                        ? 'bg-primary text-bg font-medium'
                        : 'bg-surface-2 border border-border text-text-muted hover:text-text'
                    }`}
                  >
                    Mostrar Safe Page
                  </button>
                </div>

                {rules.action === 'redirect' && (
                  <input
                    type="text"
                    value={rules.redirect_url}
                    onChange={(e) => setRules(prev => ({ ...prev, redirect_url: e.target.value }))}
                    className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none transition-colors duration-200"
                    placeholder="https://google.com"
                  />
                )}

                {rules.action === 'safe_page' && (
                  <select
                    value={rules.safe_page_id || ''}
                    onChange={(e) => setRules(prev => ({ ...prev, safe_page_id: e.target.value || null }))}
                    className="w-full bg-surface-2 border border-border text-text rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 focus:outline-none cursor-pointer transition-colors duration-200"
                  >
                    <option value="">Selecione uma safe page...</option>
                    {pages.filter(p => p.id !== selectedPageId).map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </select>
                )}
              </div>
            </>
          ) : null}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-danger/10 border border-danger/30">
              <AlertCircle className="w-4 h-4 text-danger shrink-0" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-4 py-2 cursor-pointer hover:bg-primary/90 transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-primary/50 focus:outline-none"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar regras'}
            </button>
            {hasExisting && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 text-danger bg-danger/10 border border-danger/30 rounded-md px-4 py-2 cursor-pointer hover:bg-danger/20 transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-danger/50 focus:outline-none"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                {deleting ? 'Removendo...' : 'Remover cloaker'}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
