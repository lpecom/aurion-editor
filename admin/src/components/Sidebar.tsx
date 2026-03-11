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
  Languages,
  Plug,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LogOut,
  LayoutDashboard,
} from 'lucide-react';

interface NavItem {
  label: string;
  to?: string;
  icon: React.ReactNode;
  badge?: string;
  children?: { label: string; to: string; icon: React.ReactNode }[];
}

const navItems: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Páginas de Venda', to: '/paginas-de-venda', icon: <FileText className="w-5 h-5" /> },
  { label: 'Advertoriais', to: '/advertoriais', icon: <Newspaper className="w-5 h-5" /> },
  {
    label: 'Recursos',
    icon: <FolderOpen className="w-5 h-5" />,
    children: [
      { label: 'Imagens', to: '/recursos/imagens', icon: <Image className="w-5 h-5" /> },
      { label: 'Pixels', to: '/recursos/pixels', icon: <Code className="w-5 h-5" /> },
      { label: 'Domínios', to: '/recursos/dominios', icon: <Globe className="w-5 h-5" /> },
      { label: 'Scripts', to: '/recursos/scripts', icon: <Terminal className="w-5 h-5" /> },
    ],
  },
  { label: 'Conversion Boosters', to: '/conversion-boosters', icon: <Zap className="w-5 h-5" />, badge: 'Em breve' },
  { label: 'Traduções', to: '/traducoes', icon: <Languages className="w-5 h-5" />, badge: 'Em breve' },
  { label: 'Integrações', to: '/integracoes', icon: <Plug className="w-5 h-5" />, badge: 'Em breve' },
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
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors duration-200 ${
          collapsed ? 'justify-center' : ''
        } ${
          isActive
            ? 'bg-primary/10 text-primary border-l-2 border-primary -ml-px'
            : 'text-text-muted hover:text-text hover:bg-surface-2'
        }`
      }
    >
      <span className="shrink-0">{icon}</span>
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
  const [resourcesOpen, setResourcesOpen] = useState(false);

  async function handleLogout() {
    await logout();
    navigate('/login');
  }

  return (
    <aside
      className={`bg-surface border-r border-border flex flex-col h-screen shrink-0 transition-all duration-200 ${
        collapsed ? 'w-16' : 'w-[260px]'
      }`}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 h-14 border-b border-border">
        {!collapsed && (
          <span className="text-xl font-bold text-primary tracking-tight">Aurion</span>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded-md text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-colors duration-200"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-1">
        {navItems.map((item) => {
          if (item.children) {
            return (
              <div key={item.label}>
                <button
                  onClick={() => setResourcesOpen(!resourcesOpen)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md w-full cursor-pointer transition-colors duration-200 text-text-muted hover:text-text hover:bg-surface-2 ${
                    collapsed ? 'justify-center' : ''
                  }`}
                >
                  <span className="shrink-0">{item.icon}</span>
                  {!collapsed && (
                    <>
                      <span className="text-sm font-medium">{item.label}</span>
                      <ChevronDown
                        className={`w-4 h-4 ml-auto transition-transform duration-200 ${
                          resourcesOpen ? 'rotate-180' : ''
                        }`}
                      />
                    </>
                  )}
                </button>
                {resourcesOpen && !collapsed && (
                  <div className="ml-4 mt-1 space-y-1">
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

      {/* User area */}
      <div className="border-t border-border px-3 py-3">
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold shrink-0">
            {user?.username?.charAt(0).toUpperCase() ?? '?'}
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{user?.username}</p>
                <p className="text-xs text-text-muted">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-surface-2 cursor-pointer transition-colors duration-200"
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
