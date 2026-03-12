import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AuthGuard } from './auth/AuthGuard';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SalesPages from './pages/SalesPages';
import Advertorials from './pages/Advertorials';
import Images from './pages/resources/Images';
import Pixels from './pages/resources/Pixels';
import Domains from './pages/resources/Domains';
import Scripts from './pages/resources/Scripts';
import Languages from './pages/resources/Languages';
import TranslationProviders from './pages/resources/TranslationProviders';
import CloudflareAccounts from './pages/integrations/CloudflareAccounts';
import ConversionBoosters from './pages/ConversionBoosters';
import Translations from './pages/Translations';
import EditorPage from './pages/EditorPage';
import Copier from './pages/Copier';

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Editor route - full screen, no AdminLayout */}
          <Route
            path="/editor/:pageId"
            element={
              <AuthGuard>
                <EditorPage />
              </AuthGuard>
            }
          />
          <Route
            path="/"
            element={
              <AuthGuard>
                <AdminLayout />
              </AuthGuard>
            }
          >
            <Route index element={<Dashboard />} />
            <Route path="paginas-de-venda" element={<SalesPages />} />
            <Route path="advertoriais" element={<Advertorials />} />
            <Route path="copier" element={<Copier />} />
            <Route path="recursos/imagens" element={<Images />} />
            <Route path="recursos/pixels" element={<Pixels />} />
            <Route path="recursos/dominios" element={<Domains />} />
            <Route path="recursos/scripts" element={<Scripts />} />
            <Route path="recursos/idiomas" element={<Languages />} />
            <Route path="conversion-boosters" element={<ConversionBoosters />} />
            <Route path="traducoes" element={<Translations />} />
            <Route path="integracoes/provedores" element={<TranslationProviders />} />
            <Route path="integracoes/cloudflare" element={<CloudflareAccounts />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
