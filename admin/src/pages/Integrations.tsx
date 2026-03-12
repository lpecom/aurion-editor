import { useState } from 'react';
import { Plug, ShoppingCart, CreditCard, Webhook, Bell } from 'lucide-react';
import Badge from '../components/ui/Badge';

const integrations = [
  {
    name: 'Shopify',
    description: 'Conecte sua loja Shopify para importar produtos automaticamente',
    icon: ShoppingCart,
    color: 'text-primary',
    bg: 'from-primary/20 to-primary/5',
  },
  {
    name: 'Hotmart',
    description: 'Integre com a plataforma Hotmart para infoprodutos digitais',
    icon: CreditCard,
    color: 'text-warning',
    bg: 'from-warning/20 to-warning/5',
  },
  {
    name: 'Kiwify',
    description: 'Conecte com Kiwify para gestão de vendas digitais',
    icon: CreditCard,
    color: 'text-accent',
    bg: 'from-accent/20 to-accent/5',
  },
  {
    name: 'Monetizze',
    description: 'Integre com a plataforma Monetizze para afiliados',
    icon: CreditCard,
    color: 'text-[#8B5CF6]',
    bg: 'from-[#8B5CF6]/20 to-[#8B5CF6]/5',
  },
  {
    name: 'Stripe',
    description: 'Processamento de pagamentos internacional via Stripe',
    icon: CreditCard,
    color: 'text-accent',
    bg: 'from-accent/20 to-accent/5',
  },
  {
    name: 'Webhook',
    description: 'Envie dados para URLs personalizadas com payloads customizados',
    icon: Webhook,
    color: 'text-danger',
    bg: 'from-danger/20 to-danger/5',
  },
];

export default function Integrations() {
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notified, setNotified] = useState(false);

  function handleNotify(e: React.FormEvent) {
    e.preventDefault();
    if (notifyEmail.trim()) {
      setNotified(true);
      setTimeout(() => setNotified(false), 3000);
      setNotifyEmail('');
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero */}
      <div className="flex flex-col items-center text-center mb-12">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(34,197,94,0.1)]">
          <Plug className="w-10 h-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold text-text mb-3">Integrações</h1>
        <p className="text-text-muted text-lg max-w-md leading-relaxed">
          Conecte com suas plataformas favoritas de vendas e pagamentos
        </p>
      </div>

      {/* Integration cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="group bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
          >
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${integration.bg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
                <integration.icon className={`w-6 h-6 ${integration.color}`} />
              </div>
              <Badge>Em breve</Badge>
            </div>
            <div>
              <h3 className="text-text font-semibold mb-1.5">{integration.name}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{integration.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Notify section */}
      <div className="bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-primary" />
          <h3 className="text-text font-semibold">Quer ser notificado?</h3>
        </div>
        <p className="text-text-muted text-sm mb-4">Receba um aviso quando as Integrações estiverem disponíveis.</p>
        <form onSubmit={handleNotify} className="flex items-center gap-2 max-w-sm mx-auto">
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            placeholder="seu@email.com"
            className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-text text-sm placeholder:text-text-muted/50 focus:ring-2 focus:ring-primary/50 focus:outline-none transition-all duration-200"
          />
          <button
            type="submit"
            disabled={notified}
            className="px-4 py-2.5 text-sm font-medium rounded-lg bg-primary text-bg hover:bg-primary/90 cursor-pointer transition-all duration-200 disabled:opacity-60 focus:ring-2 focus:ring-primary/50 focus:outline-none"
          >
            {notified ? 'Inscrito!' : 'Notifique-me'}
          </button>
        </form>
      </div>
    </div>
  );
}
