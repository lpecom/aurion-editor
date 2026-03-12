import { Newspaper } from 'lucide-react';
import PagesList from '../components/PagesList';

export default function Advertorials() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-accent/10 p-2.5">
          <Newspaper className="w-6 h-6 text-accent" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text">Advertoriais</h2>
          <p className="text-sm text-text-muted">Gerencie seus advertoriais e páginas de conteúdo patrocinado.</p>
        </div>
      </div>
      <PagesList type="advertorial" />
    </div>
  );
}
