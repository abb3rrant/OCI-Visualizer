import React, { Suspense, useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SnapshotProvider } from './contexts/SnapshotContext';
import { DetailPanelProvider } from './contexts/DetailPanelContext';
import { ComparisonProvider } from './contexts/ComparisonContext';
import { ImportStatusProvider } from './contexts/ImportStatusContext';
import { createGraphQLClient, setLogoutHandler } from './graphql/client';
import { ToastContainer } from './components/common/ToastProvider';
import ErrorBoundary from './components/common/ErrorBoundary';
import AppShell from './components/layout/AppShell';

// Lazy-loaded page components
const LoginPage = React.lazy(() => import('./pages/LoginPage'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage'));
const TopologyPage = React.lazy(() => import('./pages/TopologyPage'));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage'));
const AuditPage = React.lazy(() => import('./pages/AuditPage'));
const ExplorerPage = React.lazy(() => import('./pages/ExplorerPage'));
const ImportPage = React.lazy(() => import('./pages/ImportPage'));
const ComputePage = React.lazy(() => import('./pages/ComputePage'));
const DiffPage = React.lazy(() => import('./pages/DiffPage'));
const AdminPage = React.lazy(() => import('./pages/AdminPage'));
const TagEditorPage = React.lazy(() => import('./pages/TagEditorPage'));
const NetworkPage = React.lazy(() => import('./pages/NetworkPage'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage'));
const IdentityPage = React.lazy(() => import('./pages/IdentityPage'));

function PageLoader() {
  return (
    <div className="flex items-center justify-center h-full min-h-[200px]">
      <svg className="w-8 h-8 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthenticatedProviders({ children }: { children: React.ReactNode }) {
  return (
    <SnapshotProvider>
      <ImportStatusProvider>
        <DetailPanelProvider>
          <ComparisonProvider>
            {children}
          </ComparisonProvider>
        </DetailPanelProvider>
      </ImportStatusProvider>
    </SnapshotProvider>
  );
}

function AppRoutes() {
  const { token, logout } = useAuth();
  const client = useMemo(() => createGraphQLClient(() => token), [token]);

  // Register the logout handler so the urql error exchange can call it
  useEffect(() => {
    setLogoutHandler(logout);
  }, [logout]);

  return (
    <UrqlProvider value={client}>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
          <Route path="/" element={
            <ProtectedRoute>
              <AuthenticatedProviders>
                <AppShell />
              </AuthenticatedProviders>
            </ProtectedRoute>
          }>
            <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="topology" element={<ErrorBoundary><TopologyPage /></ErrorBoundary>} />
            <Route path="inventory" element={<ErrorBoundary><InventoryPage /></ErrorBoundary>} />
            <Route path="compute" element={<ErrorBoundary><ComputePage /></ErrorBoundary>} />
            <Route path="network" element={<ErrorBoundary><NetworkPage /></ErrorBoundary>} />
            <Route path="explorer" element={<ErrorBoundary><ExplorerPage /></ErrorBoundary>} />
            <Route path="audit" element={<ErrorBoundary><AuditPage /></ErrorBoundary>} />
            <Route path="identity" element={<ErrorBoundary><IdentityPage /></ErrorBoundary>} />
            <Route path="diff" element={<ErrorBoundary><DiffPage /></ErrorBoundary>} />
            <Route path="import" element={<ErrorBoundary><ImportPage /></ErrorBoundary>} />
            <Route path="tags" element={<ErrorBoundary><TagEditorPage /></ErrorBoundary>} />
            <Route path="settings" element={<ErrorBoundary><SettingsPage /></ErrorBoundary>} />
            <Route path="admin" element={<ErrorBoundary><AdminPage /></ErrorBoundary>} />
          </Route>
        </Routes>
      </Suspense>
    </UrqlProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
          <ToastContainer />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
