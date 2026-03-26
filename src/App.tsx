import { useState } from 'react';
import { AuthProvider, useAuth, canAccess } from './contexts/AuthContext';
import { AccountProvider } from './contexts/AccountContext';
import Layout, { type Page } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreativeIntelligencePage from './pages/CreativeIntelligencePage';
import SettingsPage from './pages/SettingsPage';
import ContentPerformancePage from './pages/ContentPerformancePage';
import ContentIntelligencePage from './pages/ContentIntelligencePage';
import OrganicIntelligencePage from './pages/OrganicIntelligencePage';
import { Loader2 } from 'lucide-react';

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

  // Redirect to first accessible page if current is not allowed
  const effectivePage: Page = canAccess(role, currentPage)
    ? currentPage
    : role === 'marketing' ? 'content_intelligence' : 'dashboard';

  return (
    <AccountProvider>
      <Layout currentPage={effectivePage} onNavigate={setCurrentPage}>
        {effectivePage === 'dashboard' && <DashboardPage />}
        {effectivePage === 'creative' && <CreativeIntelligencePage />}
        {effectivePage === 'settings' && <SettingsPage />}
        {effectivePage === 'content' && <ContentPerformancePage />}
        {effectivePage === 'content_intelligence' && <ContentIntelligencePage />}
        {effectivePage === 'organic_intelligence' && <OrganicIntelligencePage />}
      </Layout>
    </AccountProvider>
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
