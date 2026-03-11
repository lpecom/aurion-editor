import { Plug, ShoppingCart, CreditCard, Webhook } from 'lucide-react';
import Badge from '../components/ui/Badge';

const integrations = [
  {
    name: 'Shopify',
    description: 'Conecte sua loja Shopify para importar produtos',
    icon: ShoppingCart,
  },
  {
    name: 'Hotmart',
    description: 'Integre com a plataforma Hotmart para infoprodutos',
    icon: CreditCard,
  },
  {
    name: 'Kiwify',
    description: 'Conecte com Kiwify para vendas digitais',
    icon: CreditCard,
  },
  {
    name: 'Monetizze',
    description: 'Integre com a plataforma Monetizze',
    icon: CreditCard,
  },
  {
    name: 'Stripe',
    description: 'Processamento de pagamentos via Stripe',
    icon: CreditCard,
  },
  {
    name: 'Webhook',
    description: 'Envie dados para URLs personalizadas',
    icon: Webhook,
  },
];

export default function Integrations() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex flex-col items-center text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Plug className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-2">Integracoes</h1>
        <p className="text-text-muted">Conecte com suas plataformas favoritas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {integrations.map((integration) => (
          <div
            key={integration.name}
            className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-md bg-surface-2 flex items-center justify-center">
                <integration.icon className="w-5 h-5 text-text-muted" />
              </div>
              <Badge>Em breve</Badge>
            </div>
            <div>
              <h3 className="text-text font-medium mb-1">{integration.name}</h3>
              <p className="text-text-muted text-sm">{integration.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
