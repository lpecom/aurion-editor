import { Languages } from 'lucide-react';
import Badge from '../components/ui/Badge';

const translations = [
  { from: 'PT-BR', to: 'EN', label: 'Portugues para Ingles' },
  { from: 'PT-BR', to: 'ES', label: 'Portugues para Espanhol' },
];

export default function Translations() {
  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex flex-col items-center text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
          <Languages className="w-8 h-8 text-accent" />
        </div>
        <h1 className="text-2xl font-bold text-text mb-2">Traducoes</h1>
        <p className="text-text-muted">Traduza suas paginas automaticamente para multiplos idiomas</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {translations.map((t) => (
          <div
            key={t.to}
            className="bg-surface border border-border rounded-lg p-5 flex items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-surface-2 text-sm font-bold text-text">
                {t.from}
              </span>
              <span className="text-text-muted">→</span>
              <span className="inline-flex items-center justify-center w-10 h-10 rounded-md bg-surface-2 text-sm font-bold text-text">
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
    </div>
  );
}
