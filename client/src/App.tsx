import React, { useMemo } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Provider as UrqlProvider } from 'urql';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SnapshotProvider } from './contexts/SnapshotContext';
import { createGraphQLClient } from './graphql/client';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import TopologyPage from './pages/TopologyPage';
import InventoryPage from './pages/InventoryPage';
import AuditPage from './pages/AuditPage';
import ExplorerPage from './pages/ExplorerPage';
import ImportPage from './pages/ImportPage';
import AppShell from './components/layout/AppShell';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { token } = useAuth();
  const client = useMemo(() => createGraphQLClient(() => token), [token]);

  return (
    <UrqlProvider value={client}>
      <SnapshotProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="topology" element={<TopologyPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="explorer" element={<ExplorerPage />} />
            <Route path="audit" element={<AuditPage />} />
            <Route path="import" element={<ImportPage />} />
          </Route>
        </Routes>
      </SnapshotProvider>
    </UrqlProvider>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
