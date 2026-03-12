import { FileText } from 'lucide-react';
import PagesList from '../components/PagesList';

export default function SalesPages() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-primary/10 p-2.5">
          <FileText className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-text">Páginas de Venda</h2>
          <p className="text-sm text-text-muted">Gerencie suas páginas de venda e landing pages.</p>
        </div>
      </div>
      <PagesList type="pv" />
    </div>
  );
}
