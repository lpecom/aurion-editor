import { useState } from 'react';
import { Zap, Timer, MousePointerClick, Users, ArrowUpFromLine, FlaskConical, Bell } from 'lucide-react';
import Badge from '../components/ui/Badge';

const features = [
  {
    icon: Timer,
    title: 'Countdown Timer',
    description: 'Timer de urgência com contagem regressiva para aumentar conversões',
    color: 'text-warning',
    bg: 'from-warning/20 to-warning/5',
  },
  {
    icon: MousePointerClick,
    title: 'Exit Intent Popup',
    description: 'Popup inteligente ao detectar intenção de saída do visitante',
    color: 'text-danger',
    bg: 'from-danger/20 to-danger/5',
  },
  {
    icon: Users,
    title: 'Social Proof',
    description: 'Notificações em tempo real de compras recentes para gerar confiança',
    color: 'text-accent',
    bg: 'from-accent/20 to-accent/5',
  },
  {
    icon: ArrowUpFromLine,
    title: 'Sticky CTA Bar',
    description: 'Barra fixa de call-to-action que acompanha o scroll do visitante',
    color: 'text-primary',
    bg: 'from-primary/20 to-primary/5',
  },
  {
    icon: FlaskConical,
    title: 'A/B Testing',
    description: 'Teste variações de páginas e descubra qual converte mais',
    color: 'text-[#8B5CF6]',
    bg: 'from-[#8B5CF6]/20 to-[#8B5CF6]/5',
  },
];

export default function ConversionBoosters() {
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
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-warning/20 to-warning/5 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
          <Zap className="w-10 h-10 text-warning" />
        </div>
        <h1 className="text-3xl font-bold text-text mb-3">Conversion Boosters</h1>
        <p className="text-text-muted text-lg max-w-md leading-relaxed">
          Ferramentas para aumentar conversões nas suas páginas de venda
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
          >
            <div className="flex items-center justify-between">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.bg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
                <feature.icon className={`w-6 h-6 ${feature.color}`} />
              </div>
              <Badge>Em breve</Badge>
            </div>
            <div>
              <h3 className="text-text font-semibold mb-1.5">{feature.title}</h3>
              <p className="text-text-muted text-sm leading-relaxed">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Notify section */}
      <div className="bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-3">
          <Bell className="w-5 h-5 text-warning" />
          <h3 className="text-text font-semibold">Quer ser notificado?</h3>
        </div>
        <p className="text-text-muted text-sm mb-4">Receba um aviso quando os Conversion Boosters estiverem disponíveis.</p>
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
