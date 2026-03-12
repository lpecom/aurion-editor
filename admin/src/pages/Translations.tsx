import { useState } from 'react';
import { Languages, ArrowRight, Bell, Sparkles, FileText, Globe } from 'lucide-react';
import Badge from '../components/ui/Badge';

const translations = [
  { from: 'PT-BR', to: 'EN', label: 'Português para Inglês', icon: Globe },
  { from: 'PT-BR', to: 'ES', label: 'Português para Espanhol', icon: Globe },
];

const features = [
  {
    icon: Sparkles,
    title: 'Tradução com IA',
    description: 'Traduções naturais e contextuais usando inteligência artificial avançada',
    color: 'text-[#8B5CF6]',
    bg: 'from-[#8B5CF6]/20 to-[#8B5CF6]/5',
  },
  {
    icon: FileText,
    title: 'Preserva Layout',
    description: 'Mantém toda a estrutura e design da sua página original intactos',
    color: 'text-accent',
    bg: 'from-accent/20 to-accent/5',
  },
  {
    icon: Globe,
    title: 'Multi-idioma',
    description: 'Publique em múltiplos idiomas com URLs independentes e SEO otimizado',
    color: 'text-primary',
    bg: 'from-primary/20 to-primary/5',
  },
];

export default function Translations() {
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
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center mb-5 shadow-[0_0_30px_rgba(59,130,246,0.1)]">
          <Languages className="w-10 h-10 text-accent" />
        </div>
        <h1 className="text-3xl font-bold text-text mb-3">Traduções</h1>
        <p className="text-text-muted text-lg max-w-md leading-relaxed">
          Traduza suas páginas automaticamente para múltiplos idiomas
        </p>
      </div>

      {/* Language pairs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {translations.map((t) => (
          <div
            key={t.to}
            className="group bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-5 flex items-center gap-4 hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-accent/20 to-accent/5 text-sm font-bold text-text">
                {t.from}
              </span>
              <ArrowRight className="w-4 h-4 text-text-muted transition-transform duration-200 group-hover:translate-x-0.5" />
              <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-bold text-text">
                {t.to}
              </span>
            </div>
            <div className="flex-1">
              <p className="text-text text-sm font-medium">{t.label}</p>
            </div>
            <Badge>Em breve</Badge>
          </div>
        ))}
      </div>

      {/* Feature cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="group bg-surface/80 backdrop-blur-sm border border-border rounded-xl p-5 flex flex-col gap-4 hover:border-border/80 transition-all duration-300 hover:shadow-lg hover:shadow-black/10"
          >
            <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.bg} flex items-center justify-center transition-transform duration-200 group-hover:scale-110`}>
              <feature.icon className={`w-6 h-6 ${feature.color}`} />
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
          <Bell className="w-5 h-5 text-accent" />
          <h3 className="text-text font-semibold">Quer ser notificado?</h3>
        </div>
        <p className="text-text-muted text-sm mb-4">Receba um aviso quando as Traduções estiverem disponíveis.</p>
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
