import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

const breadcrumbMap: Record<string, string> = {
  '/': 'Dashboard',
  '/paginas-de-venda': 'Páginas de Venda',
  '/advertoriais': 'Advertoriais',
  '/recursos/imagens': 'Recursos / Imagens',
  '/recursos/pixels': 'Recursos / Pixels',
  '/recursos/dominios': 'Recursos / Domínios',
  '/recursos/scripts': 'Recursos / Scripts',
  '/conversion-boosters': 'Conversion Boosters',
  '/traducoes': 'Traduções',
  '/integracoes': 'Integrações',
};

export default function AdminLayout() {
  const location = useLocation();
  const breadcrumb = breadcrumbMap[location.pathname] || 'Aurion';

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-surface flex items-center px-6 shrink-0">
          <h2 className="text-sm font-medium text-text-muted">{breadcrumb}</h2>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
