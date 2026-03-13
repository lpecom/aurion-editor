import { useState, useEffect, useCallback } from 'react';
import { Bot, Key, Trash2, Plus, BookOpen, Activity, Loader2, Clock, Copy, Check, Terminal, Zap, ChevronRight, ExternalLink, Shield } from 'lucide-react';
import { api } from '../lib/api';
import ApiKeyModal from '../components/ApiKeyModal';

interface ApiKey {
  id: string;
  nickname: string;
  api_key: string;
  created_at: string;
}

interface ActivityItem {
  id: string;
  nickname: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_name: string | null;
  details: string | null;
  created_at: string;
}

const ACTION_LABELS: Record<string, string> = {
  create_page: 'criou página',
  edit_page: 'editou página',
  publish_page: 'publicou página',
  unpublish_page: 'despublicou página',
  delete_page: 'deletou página',
  clone_page: 'clonou página',
  create_script: 'criou script',
  edit_script: 'editou script',
  delete_script: 'deletou script',
  upload_image: 'fez upload de imagem',
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr + 'Z').getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)} min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return `${Math.floor(diff / 86400)}d atrás`;
}

function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      {label && (
        <div className="flex items-center gap-2 bg-surface-2/80 border border-border border-b-0 rounded-t-lg px-4 py-2">
          <Terminal className="w-3.5 h-3.5 text-text-muted" />
          <span className="text-xs font-medium text-text-muted uppercase tracking-wider">{label}</span>
        </div>
      )}
      <div className={`relative bg-bg border border-border ${label ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <pre className="p-4 text-sm font-mono text-text-muted overflow-x-auto leading-relaxed whitespace-pre">{code}</pre>
        <button
          onClick={handleCopy}
          className="absolute top-3 right-3 p-1.5 rounded-md bg-surface-2/80 border border-border text-text-muted hover:text-text opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-200"
          title="Copiar"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary text-sm font-bold shrink-0">
      {n}
    </div>
  );
}

function ToolCard({ name, desc, params }: { name: string; desc: string; params?: string }) {
  return (
    <div className="bg-surface-2/30 border border-border rounded-lg p-3 hover:border-primary/30 transition-colors duration-200">
      <div className="flex items-center gap-2 mb-1">
        <code className="text-sm font-mono font-medium text-primary">{name}</code>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{desc}</p>
      {params && <p className="text-xs text-text-muted/60 mt-1 font-mono">{params}</p>}
    </div>
  );
}

function FaqTab() {
  const baseUrl = window.location.origin;

  const mcpConfig = JSON.stringify({
    mcpServers: {
      aurion: {
        url: `${baseUrl}/api/mcp`,
        headers: {
          Authorization: 'Bearer SUA_API_KEY_AQUI',
        },
      },
    },
  }, null, 2);

  return (
    <div className="space-y-8">
      {/* Hero */}
      <div className="relative bg-gradient-to-br from-primary/10 via-surface to-surface border border-primary/20 rounded-2xl p-8 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold uppercase tracking-wider">
              <Zap className="w-3 h-3" />
              MCP Integration
            </div>
          </div>
          <h2 className="text-2xl font-bold text-text mb-2">Conecte o Claude Code ao Aurion</h2>
          <p className="text-text-muted max-w-2xl leading-relaxed">
            Com a integração MCP, o Claude Code controla o Aurion diretamente: cria páginas, clona sites,
            publica conteúdo e gerencia scripts — tudo via conversa natural no terminal.
          </p>
        </div>
      </div>

      {/* Setup Guide */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-text">Setup em 3 passos</h3>
        </div>

        {/* Step 1 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <StepNumber n={1} />
            <div className="w-px flex-1 bg-border mt-2" />
          </div>
          <div className="pb-8 flex-1">
            <h4 className="text-text font-semibold mb-2">Crie uma API Key</h4>
            <p className="text-sm text-text-muted mb-3">
              Vá na aba <span className="text-primary font-medium">Status</span> e clique em{' '}
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 text-primary text-xs font-medium">
                <Plus className="w-3 h-3" /> Nova API Key
              </span>
            </p>
            <p className="text-sm text-text-muted">
              Escolha um nickname para identificar quem está usando (ex: <code className="px-1.5 py-0.5 rounded bg-surface-2 text-text text-xs font-mono">kaka</code>,{' '}
              <code className="px-1.5 py-0.5 rounded bg-surface-2 text-text text-xs font-mono">deploy-bot</code>).
              Esse nome aparece no log de atividades.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <StepNumber n={2} />
            <div className="w-px flex-1 bg-border mt-2" />
          </div>
          <div className="pb-8 flex-1">
            <h4 className="text-text font-semibold mb-2">Configure o MCP no Claude Code</h4>
            <p className="text-sm text-text-muted mb-4">
              Copie o JSON abaixo e cole no arquivo de configuração do Claude Code.
              Substitua <code className="px-1.5 py-0.5 rounded bg-surface-2 text-text text-xs font-mono">SUA_API_KEY_AQUI</code> pela chave gerada.
            </p>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-muted mb-2 flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" />
                  <span className="font-medium">Claude Code (CLI)</span> — cole em <code className="px-1.5 py-0.5 rounded bg-surface-2 text-xs font-mono">~/.claude/settings.json</code>
                </p>
                <CodeBlock code={mcpConfig} label="settings.json" />
              </div>

              <div>
                <p className="text-xs text-text-muted mb-2 flex items-center gap-2">
                  <ChevronRight className="w-3 h-3" />
                  <span className="font-medium">Claude Desktop</span> — cole em <code className="px-1.5 py-0.5 rounded bg-surface-2 text-xs font-mono">claude_desktop_config.json</code>
                </p>
                <CodeBlock code={mcpConfig} label="claude_desktop_config.json" />
              </div>
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex gap-4">
          <div className="flex flex-col items-center">
            <StepNumber n={3} />
          </div>
          <div className="flex-1">
            <h4 className="text-text font-semibold mb-2">Comece a usar</h4>
            <p className="text-sm text-text-muted mb-1">
              Reinicie o Claude Code e comece a dar comandos. As tools do Aurion ficam disponíveis automaticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Example Prompts */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Terminal className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-text">Exemplos de uso</h3>
        </div>

        <div className="grid gap-3">
          {[
            {
              prompt: 'Cria uma página de venda com título "Oferta Black Friday", slug oferta-bf, tipo pv',
              tools: 'create_page',
              desc: 'Cria uma página de venda como rascunho',
            },
            {
              prompt: 'Clona a página https://exemplo.com como advertorial com slug meu-adv e título "Meu Advertorial"',
              tools: 'clone_page',
              desc: 'Scrapa o HTML da URL e salva como nova página',
            },
            {
              prompt: 'Publica a página oferta-bf',
              tools: 'get_page → publish_page',
              desc: 'Busca pelo slug e publica em todos os domínios',
            },
            {
              prompt: 'Lista todas as páginas publicadas',
              tools: 'list_pages',
              desc: 'Filtra por status published',
            },
            {
              prompt: 'Cria um script anti-cópia chamado "Proteção V2" na posição body_end',
              tools: 'create_script',
              desc: 'Cria script com o código fornecido',
            },
            {
              prompt: 'Faz upload dessa imagem como banner.webp',
              tools: 'upload_image',
              desc: 'Envia imagem em base64 para o asset manager',
            },
          ].map((example, i) => (
            <div key={i} className="bg-surface border border-border rounded-lg p-4 hover:border-primary/20 transition-colors duration-200">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                  <ChevronRight className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text font-medium leading-relaxed">"{example.prompt}"</p>
                  <div className="flex items-center gap-3 mt-2">
                    <code className="text-xs font-mono text-primary/80 bg-primary/10 px-2 py-0.5 rounded">{example.tools}</code>
                    <span className="text-xs text-text-muted">{example.desc}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tools Reference */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Zap className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-text">Tools disponíveis</h3>
          <span className="text-xs text-text-muted bg-surface-2 px-2 py-0.5 rounded-full">16 tools</span>
        </div>

        {/* Pages */}
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Páginas</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <ToolCard name="list_pages" desc="Lista páginas com filtros opcionais" params="type?, status?, lang?" />
            <ToolCard name="get_page" desc="Busca uma página por ID ou slug" params="id | slug" />
            <ToolCard name="create_page" desc="Cria uma nova página como rascunho" params="title, slug, type, html_content?, lang?" />
            <ToolCard name="edit_page" desc="Edita campos de uma página" params="id, campos..." />
            <ToolCard name="publish_page" desc="Publica a página nos domínios" params="id" />
            <ToolCard name="unpublish_page" desc="Despublica a página" params="id" />
            <ToolCard name="delete_page" desc="Deleta a página permanentemente" params="id" />
            <ToolCard name="clone_page" desc="Clona uma página externa via scraper" params="url, title, slug, type" />
          </div>
        </div>

        {/* Scripts */}
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Scripts</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <ToolCard name="list_scripts" desc="Lista todos os scripts" />
            <ToolCard name="create_script" desc="Cria um novo script" params="name, position, code" />
            <ToolCard name="edit_script" desc="Edita um script existente" params="id, campos..." />
            <ToolCard name="delete_script" desc="Deleta um script" params="id" />
          </div>
        </div>

        {/* Other Resources */}
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Outros Recursos</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            <ToolCard name="list_pixels" desc="Lista todos os pixels configurados" />
            <ToolCard name="list_domains" desc="Lista todos os domínios" />
            <ToolCard name="list_images" desc="Lista todas as imagens do asset manager" />
            <ToolCard name="upload_image" desc="Faz upload de uma imagem (base64)" params="base64, filename" />
          </div>
        </div>
      </div>

      {/* Tips */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <ExternalLink className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold text-text">Dicas</h3>
        </div>
        <ul className="space-y-3">
          {[
            'Cada instância do Claude Code deve ter sua própria API Key com nickname único — assim você sabe quem fez cada ação.',
            'Todas as ações ficam registradas na aba Status. Se algo deu errado, confira o log.',
            'Páginas criadas via MCP começam como rascunho. Use publish_page para publicar.',
            'O clone_page scrapa o HTML da URL e salva como rascunho. O editor GrapesJS popula os dados visuais no primeiro save.',
            'API Keys revogadas invalidam a sessão imediatamente, mas o histórico de ações é preservado.',
          ].map((tip, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-text-muted">
              <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
              <span className="leading-relaxed">{tip}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Claude() {
  const [tab, setTab] = useState<'faq' | 'status'>('status');
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [activityTotal, setActivityTotal] = useState(0);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchKeys = useCallback(async () => {
    try {
      const data = await api.get<ApiKey[]>('/api-keys');
      setApiKeys(data);
    } catch {} finally { setLoadingKeys(false); }
  }, []);

  const fetchActivity = useCallback(async (offset = 0) => {
    try {
      const data = await api.get<{ items: ActivityItem[]; total: number }>(`/activity-log?limit=50&offset=${offset}`);
      if (offset === 0) {
        setActivities(data.items);
      } else {
        setActivities(prev => [...prev, ...data.items]);
      }
      setActivityTotal(data.total);
    } catch {} finally { setLoadingActivity(false); }
  }, []);

  useEffect(() => { fetchKeys(); fetchActivity(); }, [fetchKeys, fetchActivity]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await api.delete(`/api-keys/${id}`);
      setApiKeys(prev => prev.filter(k => k.id !== id));
    } catch {} finally { setDeletingId(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <Bot className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-text">Claude</h1>
          <p className="text-sm text-text-muted">Integração com Claude Code via MCP.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-2/50 border border-border rounded-lg p-1 w-fit">
        {[
          { id: 'status' as const, label: 'Status', icon: Activity },
          { id: 'faq' as const, label: 'FAQ', icon: BookOpen },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium cursor-pointer transition-colors duration-200 ${
              tab === t.id ? 'bg-primary text-bg' : 'text-text-muted hover:text-text'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'status' && (
        <div className="space-y-6">
          {/* API Keys */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-text flex items-center gap-2">
                <Key className="w-5 h-5" />
                API Keys
              </h2>
              <button
                onClick={() => setModalOpen(true)}
                className="flex items-center gap-2 bg-primary text-bg font-medium rounded-md px-3 py-1.5 text-sm cursor-pointer hover:bg-primary/90 transition-colors duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
              >
                <Plus className="w-3.5 h-3.5" />
                Nova API Key
              </button>
            </div>

            {loadingKeys ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-text-muted" /></div>
            ) : apiKeys.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg p-8 text-center">
                <Key className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">Nenhuma API key criada.</p>
              </div>
            ) : (
              <div className="bg-surface border border-border rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-surface-2/30">
                      <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3">Nickname</th>
                      <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3">API Key</th>
                      <th className="text-left text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3">Criada em</th>
                      <th className="text-right text-xs font-semibold text-text-muted uppercase tracking-wider px-6 py-3">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {apiKeys.map(k => (
                      <tr key={k.id} className="border-b border-border last:border-b-0 hover:bg-surface-2/50 transition-colors duration-200">
                        <td className="px-6 py-3 text-text font-medium">{k.nickname}</td>
                        <td className="px-6 py-3 font-mono text-sm text-text-muted">{k.api_key}</td>
                        <td className="px-6 py-3 text-sm text-text-muted">{new Date(k.created_at).toLocaleDateString('pt-BR')}</td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => handleDelete(k.id)}
                            disabled={deletingId === k.id}
                            className="p-2 rounded-md text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-colors duration-200 disabled:opacity-50 focus:ring-2 focus:ring-danger/50 focus:outline-none"
                            title="Revogar"
                          >
                            {deletingId === k.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div>
            <h2 className="text-lg font-semibold text-text flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5" />
              Atividade Recente
            </h2>

            {loadingActivity ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-text-muted" /></div>
            ) : activities.length === 0 ? (
              <div className="bg-surface border border-border rounded-lg p-8 text-center">
                <Activity className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm text-text-muted">Nenhuma atividade registrada.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activities.map(a => {
                  const details = a.details ? JSON.parse(a.details) : null;
                  const actionLabel = ACTION_LABELS[a.action] || a.action;
                  const extra = a.action === 'clone_page' && details?.url ? ` (de ${details.url})` : '';

                  return (
                    <div key={a.id} className="flex items-start gap-3 p-3 bg-surface border border-border rounded-lg">
                      <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                        {a.nickname.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-text">
                          <span className="font-medium text-primary">{a.nickname}</span>
                          {' '}{actionLabel}{' '}
                          <span className="font-medium">{a.resource_name || a.resource_id || ''}</span>
                          {extra}
                        </p>
                        <p className="text-xs text-text-muted mt-0.5">{timeAgo(a.created_at)}</p>
                      </div>
                    </div>
                  );
                })}

                {activities.length < activityTotal && (
                  <button
                    onClick={() => fetchActivity(activities.length)}
                    className="w-full py-2 text-sm text-text-muted hover:text-text text-center cursor-pointer transition-colors duration-200"
                  >
                    Carregar mais...
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'faq' && (
        <FaqTab />
      )}

      <ApiKeyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => fetchKeys()}
      />
    </div>
  );
}
