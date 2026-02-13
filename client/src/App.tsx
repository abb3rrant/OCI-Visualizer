import React, { useMemo, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { SnapshotProvider } from './contexts/SnapshotContext';
import { createGraphQLClient, setLogoutHandler } from './graphql/client';
import { ToastContainer } from './components/common/ToastProvider';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TopologyPage from './pages/TopologyPage';
import InventoryPage from './pages/InventoryPage';
import AuditPage from './pages/AuditPage';
import ExplorerPage from './pages/ExplorerPage';
import ImportPage from './pages/ImportPage';
import ComputePage from './pages/ComputePage';
import DiffPage from './pages/DiffPage';
import AppShell from './components/layout/AppShell';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
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
      <SnapshotProvider>
        <Routes>
          <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<ErrorBoundary><DashboardPage /></ErrorBoundary>} />
            <Route path="topology" element={<ErrorBoundary><TopologyPage /></ErrorBoundary>} />
            <Route path="inventory" element={<ErrorBoundary><InventoryPage /></ErrorBoundary>} />
            <Route path="compute" element={<ErrorBoundary><ComputePage /></ErrorBoundary>} />
            <Route path="explorer" element={<ErrorBoundary><ExplorerPage /></ErrorBoundary>} />
            <Route path="audit" element={<ErrorBoundary><AuditPage /></ErrorBoundary>} />
            <Route path="diff" element={<ErrorBoundary><DiffPage /></ErrorBoundary>} />
            <Route path="import" element={<ErrorBoundary><ImportPage /></ErrorBoundary>} />
          </Route>
        </Routes>
      </SnapshotProvider>
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
