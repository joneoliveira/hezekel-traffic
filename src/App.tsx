import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth, canAccess } from './contexts/AuthContext';
import { ClientProvider, useClientContext } from './contexts/ClientContext';
import { AccountProvider } from './contexts/AccountContext';
import Layout, { PATH_TO_PAGE } from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CreativeIntelligencePage from './pages/CreativeIntelligencePage';
import SettingsPage from './pages/SettingsPage';
import ContentPerformancePage from './pages/ContentPerformancePage';
import ContentIntelligencePage from './pages/ContentIntelligencePage';
import OrganicIntelligencePage from './pages/OrganicIntelligencePage';
import CampanhasPage from './pages/CampanhasPage';
import CreateCampaignPage from './pages/CreateCampaignPage';
import AdminPage from './pages/AdminPage';
import ReportsPage from './pages/ReportsPage';
import { Loader2 } from 'lucide-react';

function ClientRoutes({ fallback }: { fallback: string }) {
  const { activeClient } = useClientContext();
  return (
    <AccountProvider clientId={activeClient?.id ?? null}>
      <Layout>
        <Routes>
          <Route path="/dashboard"      element={<DashboardPage />} />
          <Route path="/campanhas"      element={<CampanhasPage />} />
          <Route path="/campanhas/criar" element={<CreateCampaignPage />} />
          <Route path="/creative"       element={<CreativeIntelligencePage />} />
          <Route path="/content"        element={<ContentPerformancePage />} />
          <Route path="/content-intel"  element={<ContentIntelligencePage />} />
          <Route path="/organic-intel"  element={<OrganicIntelligencePage />} />
          <Route path="/reports"        element={<ReportsPage />} />
          <Route path="/configuracoes"  element={<SettingsPage />} />
          <Route path="/admin"          element={<AdminPage />} />
          <Route path="/login"          element={<Navigate to={fallback} replace />} />
          <Route path="*"               element={<Navigate to={fallback} replace />} />
        </Routes>
      </Layout>
    </AccountProvider>
  );
}

function AppRoutes() {
  const { user, role, loading, isPasswordRecovery } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isPasswordRecovery) {
    return (
      <Routes>
        <Route path="*" element={<LoginPage />} />
      </Routes>
    );
  }

  if (!user || !role) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="*"      element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  const fallback = role === 'marketing' ? '/content-intel' : '/dashboard';
  const page = PATH_TO_PAGE[location.pathname];

  // Redirect if current page is not accessible for this role
  if (page && !canAccess(role, page)) {
    return <Navigate to={fallback} replace />;
  }

  return (
    <ClientProvider>
      <ClientRoutes fallback={fallback} />
    </ClientProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
