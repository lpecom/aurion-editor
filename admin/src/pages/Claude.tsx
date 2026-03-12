import { useState, useEffect, useCallback } from 'react';
import { Bot, Key, Trash2, Plus, BookOpen, Activity, Loader2, Clock } from 'lucide-react';
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
    <div className="space-y-6 animate-in fade-in duration-300">
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
        <div className="space-y-4">
          {[
            {
              title: 'Como conectar o Claude Code ao Aurion',
              content: `1. Vá na aba **Status** e clique em **Nova API Key**\n2. Escolha um nickname (ex: "kaka")\n3. Copie a configuração MCP gerada\n4. Adicione ao seu arquivo \`.claude/settings.json\` ou \`claude_desktop_config.json\`\n5. Reinicie o Claude Code`,
            },
            {
              title: 'Como criar uma página via Claude',
              content: `Diga ao Claude:\n\n> "Cria uma página de venda com título Oferta Black Friday, slug oferta-bf, tipo pv"\n\nO Claude vai usar a tool \`create_page\` automaticamente.`,
            },
            {
              title: 'Como clonar uma página',
              content: `Diga ao Claude:\n\n> "Clona a página https://exemplo.com como advertorial com slug meu-adv"\n\nO Claude vai usar a tool \`clone_page\` que scrapa o HTML e salva como rascunho.`,
            },
            {
              title: 'Como publicar uma página',
              content: `Diga ao Claude:\n\n> "Publica a página oferta-bf"\n\nO Claude vai usar \`get_page\` pra encontrar pelo slug e depois \`publish_page\` pra publicar.`,
            },
            {
              title: 'Tools disponíveis',
              content: `O Claude tem acesso a:\n\n- **Páginas:** list, get, create, edit, publish, unpublish, delete, clone\n- **Scripts:** list, create, edit, delete\n- **Pixels:** list\n- **Domínios:** list\n- **Imagens:** list, upload`,
            },
          ].map((faq, i) => (
            <details key={i} className="bg-surface border border-border rounded-lg group">
              <summary className="flex items-center gap-3 px-5 py-4 cursor-pointer text-text font-medium hover:bg-surface-2/50 transition-colors duration-200 rounded-lg">
                <BookOpen className="w-4 h-4 text-primary shrink-0" />
                {faq.title}
              </summary>
              <div className="px-5 pb-4 text-sm text-text-muted leading-relaxed whitespace-pre-line border-t border-border pt-3 mx-5 mb-1">
                {faq.content}
              </div>
            </details>
          ))}
        </div>
      )}

      <ApiKeyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => fetchKeys()}
      />
    </div>
  );
}
