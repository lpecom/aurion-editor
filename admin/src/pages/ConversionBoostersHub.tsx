import { Zap } from 'lucide-react';
import EmptyState from '../components/ui/EmptyState';

export default function ConversionBoostersHub() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <Zap className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold text-text">Conversion Boosters</h1>
        </div>
        <p className="text-text-muted text-sm ml-9">
          Ferramentas de conversão para suas páginas.
        </p>
      </div>

      <EmptyState
        icon={Zap}
        title="Em breve"
        description="Em breve: Redirect Timer, Countdown Timer e mais."
      />
    </div>
  );
}
