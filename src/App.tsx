import { useState } from 'react';
import { AuthProvider, useAuth, canAccess } from './contexts/AuthContext';
import { ClientProvider, useClientContext } from './contexts/ClientContext';
import { AccountProvider } from './contexts/AccountContext';
import Layout, { type Page } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreativeIntelligencePage from './pages/CreativeIntelligencePage';
import SettingsPage from './pages/SettingsPage';
import ContentPerformancePage from './pages/ContentPerformancePage';
import ContentIntelligencePage from './pages/ContentIntelligencePage';
import OrganicIntelligencePage from './pages/OrganicIntelligencePage';
import CampanhasPage from './pages/CampanhasPage';
import AdminPage from './pages/AdminPage';
import ReportsPage from './pages/ReportsPage';
import { Loader2 } from 'lucide-react';

function AppWithClient({ effectivePage, onNavigate }: { effectivePage: Page; onNavigate: (p: Page) => void }) {
  const { activeClient } = useClientContext();
  return (
    <AccountProvider clientId={activeClient?.id ?? null}>
      <Layout currentPage={effectivePage} onNavigate={onNavigate}>
        {effectivePage === 'dashboard' && <DashboardPage />}
        {effectivePage === 'creative' && <CreativeIntelligencePage />}
        {effectivePage === 'settings' && <SettingsPage />}
        {effectivePage === 'content' && <ContentPerformancePage />}
        {effectivePage === 'content_intelligence' && <ContentIntelligencePage />}
        {effectivePage === 'organic_intelligence' && <OrganicIntelligencePage />}
        {effectivePage === 'campaigns' && <CampanhasPage />}
        {effectivePage === 'admin' && <AdminPage />}
        {effectivePage === 'reports' && <ReportsPage />}
      </Layout>
    </AccountProvider>
  );
}

function AppInner() {
  const { user, role, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState<Page>('dashboard');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !role) return <LoginPage />;

  const effectivePage: Page = canAccess(role, currentPage)
    ? currentPage
    : role === 'marketing' ? 'content_intelligence' : 'dashboard';

  return (
    <ClientProvider>
      <AppWithClient effectivePage={effectivePage} onNavigate={setCurrentPage} />
    </ClientProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
