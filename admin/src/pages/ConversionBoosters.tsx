import { Zap, Timer, MousePointerClick, Users, ArrowUpFromLine, FlaskConical } from 'lucide-react';
import Badge from '../components/ui/Badge';

const features = [
  {
    icon: Timer,
    title: 'Countdown Timer',
    description: 'Timer de urgencia com contagem regressiva',
  },
  {
    icon: MousePointerClick,
    title: 'Exit Intent Popup',
    description: 'Popup ao detectar intencao de saida',
  },
  {
    icon: Users,
    title: 'Social Proof',
    description: 'Notificacoes de compras recentes',
  },
  {
    icon: ArrowUpFromLine,
    title: 'Sticky CTA Bar',
    description: 'Barra fixa de call-to-action',
  },
  {
    icon: FlaskConical,
    title: 'A/B Testing',
    description: 'Teste variacoes de paginas',
  },
];

export default function ConversionBoosters() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col items-center text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center mb-4">
          <Zap className="w-8 h-8 text-warning" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-2">Conversion Boosters</h1>
        <p className="text-text-muted">Ferramentas para aumentar conversoes nas suas paginas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="bg-surface border border-border rounded-lg p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <div className="w-10 h-10 rounded-md bg-surface-2 flex items-center justify-center">
                <feature.icon className="w-5 h-5 text-text-muted" />
              </div>
              <Badge>Em breve</Badge>
            </div>
            <div>
              <h3 className="text-text font-medium mb-1">{feature.title}</h3>
              <p className="text-text-muted text-sm">{feature.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
