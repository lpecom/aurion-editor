import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';

export default function AdminLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen bg-bg overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 overflow-y-auto p-6" key={location.pathname}>
          <div className="animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
