import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, Circle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import Sidebar from '../components/Sidebar';

export default function AdminLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="flex md:hidden items-center justify-between px-4 h-14 bg-surface/95 backdrop-blur-xl border-b border-border/50 shrink-0">
          <button
            onClick={() => setMobileMenuOpen(true)}
            aria-label="Abrir menu"
            className="p-2 rounded-lg text-text-muted hover:text-text hover:bg-surface-2 cursor-pointer transition-all duration-200"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <Circle className="w-3 h-3 text-primary fill-primary" />
            <span className="text-lg font-bold text-primary tracking-tight">Aurion</span>
          </div>
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/40 to-accent/40 flex items-center justify-center text-text text-sm font-bold shrink-0 ring-2 ring-surface-2"
          >
            {user?.username?.charAt(0).toUpperCase() ?? '?'}
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6" key={location.pathname}>
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
