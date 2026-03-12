import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { LayoutDashboard, FileText, Newspaper, Image, Radio, Globe2, Code2, Zap, Languages, Plug } from 'lucide-react';

const breadcrumbMap: Record<string, { label: string; icon: React.ReactNode }> = {
  '/': { label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
  '/paginas-de-venda': { label: 'Páginas de Venda', icon: <FileText className="w-4 h-4" /> },
  '/advertoriais': { label: 'Advertoriais', icon: <Newspaper className="w-4 h-4" /> },
  '/recursos/imagens': { label: 'Recursos / Imagens', icon: <Image className="w-4 h-4" /> },
  '/recursos/pixels': { label: 'Recursos / Pixels', icon: <Radio className="w-4 h-4" /> },
  '/recursos/dominios': { label: 'Recursos / Domínios', icon: <Globe2 className="w-4 h-4" /> },
  '/recursos/scripts': { label: 'Recursos / Scripts', icon: <Code2 className="w-4 h-4" /> },
  '/conversion-boosters': { label: 'Conversion Boosters', icon: <Zap className="w-4 h-4" /> },
  '/traducoes': { label: 'Traduções', icon: <Languages className="w-4 h-4" /> },
  '/integracoes': { label: 'Integrações', icon: <Plug className="w-4 h-4" /> },
};

export default function AdminLayout() {
  const location = useLocation();
  const crumb = breadcrumbMap[location.pathname] || { label: 'Aurion', icon: null };

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-14 border-b border-border bg-surface flex items-center px-6 shrink-0 shadow-[0_1px_3px_0_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-2.5">
            {crumb.icon && <span className="text-text-muted">{crumb.icon}</span>}
            <h2 className="text-sm font-semibold text-text">{crumb.label}</h2>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
