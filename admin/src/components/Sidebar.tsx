import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import {
  FileText,
  Newspaper,
  FolderOpen,
  Image,
  Code,
  Globe,
  Terminal,
  Zap,
  Wand2,
  Languages,
  Plug,
  Cloud,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Copy,
  Circle,
  Activity,
  Bot,
  FileStack,
  GitBranch,
} from 'lucide-react';

interface NavItem {
  label: string;
  to?: string;
  icon: React.ReactNode;
  badge?: string;
  children?: { label: string; to: string; icon: React.ReactNode }[];
}

const navItems: (NavItem | { separator: string })[] = [
  { label: 'Dashboard', to: '/', icon: <LayoutDashboard className="w-5 h-5" /> },

  { separator: 'Conteúdo' },
  { label: 'Páginas de Venda', to: '/paginas-de-venda', icon: <FileText className="w-5 h-5" /> },
  { label: 'Advertoriais', to: '/advertoriais', icon: <Newspaper className="w-5 h-5" /> },
  { label: 'Auxiliares', to: '/auxiliares', icon: <FileStack className="w-5 h-5" /> },
  { label: 'Copier', to: '/copier', icon: <Copy className="w-5 h-5" /> },

  { separator: 'Marketing' },
  { label: 'Funis de Venda', to: '/funis', icon: <GitBranch className="w-5 h-5" /> },
  { label: 'Teste A/B', to: '/teste-ab', icon: <Zap className="w-5 h-5" /> },
  { label: 'Conversion Boosters', to: '/conversion-boosters', icon: <Zap className="w-5 h-5" /> },

  { separator: 'Ferramentas' },
  {
    label: 'Recursos',
    icon: <FolderOpen className="w-5 h-5" />,
    children: [
      { label: 'Imagens', to: '/recursos/imagens', icon: <Image className="w-5 h-5" /> },
      { label: 'Pixels', to: '/recursos/pixels', icon: <Code className="w-5 h-5" /> },
      { label: 'Domínios', to: '/recursos/dominios', icon: <Globe className="w-5 h-5" /> },
      { label: 'Scripts', to: '/recursos/scripts', icon: <Terminal className="w-5 h-5" /> },
      { label: 'Idiomas', to: '/recursos/idiomas', icon: <Globe className="w-5 h-5" /> },
    ],
  },
  { label: 'Script Maker', to: '/script-maker', icon: <Wand2 className="w-5 h-5" /> },
  { label: 'Traduções', to: '/traducoes', icon: <Languages className="w-5 h-5" /> },
  { label: 'Healthcheck', to: '/healthcheck', icon: <Activity className="w-5 h-5" /> },
  { label: 'Claude', to: '/claude', icon: <Bot className="w-5 h-5" /> },

  { separator: 'Sistema' },
  {
    label: 'Integrações',
    icon: <Plug className="w-5 h-5" />,
    children: [
      { label: 'Provedores de Tradução', to: '/integracoes/provedores', icon: <Languages className="w-5 h-5" /> },
      { label: 'Cloudflare', to: '/integracoes/cloudflare', icon: <Cloud className="w-5 h-5" /> },
    ],
  },
];

function NavItemLink({
  to,
  icon,
  label,
  badge,
  collapsed,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  badge?: string;
  collapsed: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(34,197,94,0.15)] border-l-2 border-primary -ml-px'
            : 'text-text-muted hover:text-text hover:bg-surface-2/80'
        }`
      }
    >
      <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">{icon}</span>
      {!collapsed && (
        <>
          <span className="text-sm font-medium truncate">{label}</span>
          {badge && (
            <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-surface-2 border border-border text-text-muted">
              {badge}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenus, setOpenMenus] = useState<Set<string>>(new Set());

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside
      className={`bg-surface/95 backdrop-blur-xl border-r border-border/50 flex flex-col h-screen shrink-0 transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-[260px]'
      }`}
      role="navigation"
      aria-label="Menu principal"
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border/30">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Circle className="w-3 h-3 text-primary fill-primary" />
            <span className="text-lg font-bold text-primary tracking-tight">Aurion</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-primary/50 focus:outline-none"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1" aria-label="Navegação principal">
        {navItems.map((item, index) => {
          if ('separator' in item) {
            if (collapsed) return <div key={index} className="mx-3 my-2 border-t border-border/20" />;
            return (
              <div key={index} className="pt-4 pb-1 px-3">
                <span className="text-[10px] font-semibold text-zinc-600 uppercase tracking-[0.15em]">
                  {item.separator}
                </span>
              </div>
            );
          }

          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setOpenMenus(prev => {
                    const next = new Set(prev);
                    if (next.has(item.label)) next.delete(item.label);
                    else next.add(item.label);
                    return next;
                  })}
                  aria-expanded={openMenus.has(item.label)}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                  className={`group flex items-center gap-3 px-3 py-2 rounded-lg w-full cursor-pointer transition-all duration-200 text-text-muted hover:text-text hover:bg-surface-2/80 focus:ring-2 focus:ring-primary/50 focus:outline-none ${
                    collapsed ? 'justify-center' : ''
                  }`}
                >
                  <span className="shrink-0 transition-transform duration-200 group-hover:scale-110">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="text-sm font-medium">{item.label}</span>
                      <ChevronDown
                        className={`w-4 h-4 ml-auto transition-transform duration-200 ${
                          openMenus.has(item.label) ? 'rotate-180' : ''
                        }`}
                      />
                    </>
                  )}
                </button>
                {openMenus.has(item.label) && !collapsed && (
                  <div className="ml-4 mt-1 space-y-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {item.children.map((child) => (
                      <NavItemLink
                        key={child.to}
                        to={child.to}
                        icon={child.icon}
                        label={child.label}
                        collapsed={false}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <NavItemLink
              key={item.to!}
              to={item.to!}
              icon={item.icon}
              label={item.label}
              badge={item.badge}
              collapsed={collapsed}
            />
          );
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 border-t border-border/20" />

      {/* User area */}
      <div className="px-3 py-3">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-text text-sm font-bold shrink-0 ring-2 ring-surface-2"
            title={collapsed ? user?.username : undefined}
          >
            {user?.username?.charAt(0).toUpperCase() ?? '?'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{user?.username}</p>
                <p className="text-xs text-text-muted capitalize">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Sair"
                className="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 cursor-pointer transition-all duration-200 focus:ring-2 focus:ring-danger/50 focus:outline-none"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  );
}
