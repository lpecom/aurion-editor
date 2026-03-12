import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { AuthGuard } from './auth/AuthGuard';
import { ToastProvider } from './components/ui/Toast';
import ErrorBoundary from './components/ui/ErrorBoundary';
import AdminLayout from './layouts/AdminLayout';
import Login from './pages/Login';

// Route-level code splitting — each page loads on demand
const Dashboard = lazy(() => import('./pages/Dashboard'));
const SalesPages = lazy(() => import('./pages/SalesPages'));
const Advertorials = lazy(() => import('./pages/Advertorials'));
const Auxiliares = lazy(() => import('./pages/Auxiliares'));
const Copier = lazy(() => import('./pages/Copier'));
const Images = lazy(() => import('./pages/resources/Images'));
const Pixels = lazy(() => import('./pages/resources/Pixels'));
const Domains = lazy(() => import('./pages/resources/Domains'));
const Scripts = lazy(() => import('./pages/resources/Scripts'));
const Languages = lazy(() => import('./pages/resources/Languages'));
const TranslationProviders = lazy(() => import('./pages/resources/TranslationProviders'));
const CloudflareAccounts = lazy(() => import('./pages/integrations/CloudflareAccounts'));
const ConversionBoosters = lazy(() => import('./pages/ConversionBoosters'));
const ConversionBoostersHub = lazy(() => import('./pages/ConversionBoostersHub'));
const ScriptMaker = lazy(() => import('./pages/ScriptMaker'));
const Translations = lazy(() => import('./pages/Translations'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const Healthcheck = lazy(() => import('./pages/Healthcheck'));
const Claude = lazy(() => import('./pages/Claude'));
const Funnels = lazy(() => import('./pages/Funnels'));
const FunnelEditor = lazy(() => import('./pages/FunnelEditor'));
const FAQ = lazy(() => import('./pages/FAQ'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
    </div>
  );
}

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageLoader />}>{children}</Suspense>;
}

export default function App() {
  return (
    <BrowserRouter basename="/admin">
      <AuthProvider>
        <ToastProvider>
        <ErrorBoundary>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/editor/:pageId"
            element={
              <AuthGuard>
                <SuspenseWrapper><EditorPage /></SuspenseWrapper>
              </AuthGuard>
            }
          />
          <Route
            path="/funis/:funnelId"
            element={
              <AuthGuard>
                <SuspenseWrapper><FunnelEditor /></SuspenseWrapper>
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
            <Route index element={<SuspenseWrapper><Dashboard /></SuspenseWrapper>} />
            <Route path="paginas-de-venda" element={<SuspenseWrapper><SalesPages /></SuspenseWrapper>} />
            <Route path="advertoriais" element={<SuspenseWrapper><Advertorials /></SuspenseWrapper>} />
            <Route path="auxiliares" element={<SuspenseWrapper><Auxiliares /></SuspenseWrapper>} />
            <Route path="copier" element={<SuspenseWrapper><Copier /></SuspenseWrapper>} />
            <Route path="recursos/imagens" element={<SuspenseWrapper><Images /></SuspenseWrapper>} />
            <Route path="recursos/pixels" element={<SuspenseWrapper><Pixels /></SuspenseWrapper>} />
            <Route path="recursos/dominios" element={<SuspenseWrapper><Domains /></SuspenseWrapper>} />
            <Route path="recursos/scripts" element={<SuspenseWrapper><Scripts /></SuspenseWrapper>} />
            <Route path="recursos/idiomas" element={<SuspenseWrapper><Languages /></SuspenseWrapper>} />
            <Route path="teste-ab" element={<SuspenseWrapper><ConversionBoosters /></SuspenseWrapper>} />
            <Route path="conversion-boosters" element={<SuspenseWrapper><ConversionBoostersHub /></SuspenseWrapper>} />
            <Route path="funis" element={<SuspenseWrapper><Funnels /></SuspenseWrapper>} />
            <Route path="script-maker" element={<SuspenseWrapper><ScriptMaker /></SuspenseWrapper>} />
            <Route path="healthcheck" element={<SuspenseWrapper><Healthcheck /></SuspenseWrapper>} />
            <Route path="claude" element={<SuspenseWrapper><Claude /></SuspenseWrapper>} />
            <Route path="traducoes" element={<SuspenseWrapper><Translations /></SuspenseWrapper>} />
            <Route path="integracoes/provedores" element={<SuspenseWrapper><TranslationProviders /></SuspenseWrapper>} />
            <Route path="integracoes/cloudflare" element={<SuspenseWrapper><CloudflareAccounts /></SuspenseWrapper>} />
            <Route path="faq" element={<SuspenseWrapper><FAQ /></SuspenseWrapper>} />
          </Route>
        </Routes>
        </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
