import type { ComponentType } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

// Type assertion for React 18 + react-router-dom JSX compatibility
const RouterRoutes = Routes as ComponentType<{ children?: React.ReactNode }>;
const RouterRoute = Route as ComponentType<Record<string, unknown>>;
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import PromoterDetails from './pages/PromoterDetails';
import RouteMap from './pages/RouteMap';
import RouteConfig from './pages/RouteConfig';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import StoresManagement from './pages/StoresManagement';
import IndustriesManagement from './pages/IndustriesManagement';
import IndustryCoverage from './pages/IndustryCoverage';
import StoreIndustriesConfig from './pages/StoreIndustriesConfig';
import IndustryOwnerDashboard from './pages/IndustryOwnerDashboard';
import Admin from './pages/Admin';
import Layout from './components/Layout';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Carregando...</div>; // TODO: Add proper loading component
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function SupervisorOrAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'SUPERVISOR' && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function IndustryOwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div>Carregando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'INDUSTRY_OWNER' && user.role !== 'ADMIN') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <RouterRoutes>
      <RouterRoute path="/login" element={<Login />} />
      <RouterRoute
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        {/* Dashboard e telas de supervisão: apenas SUPERVISOR e ADMIN */}
        <RouterRoute
          index
          element={
            <SupervisorOrAdminRoute>
              <Dashboard />
            </SupervisorOrAdminRoute>
          }
        />
        <RouterRoute
          path="promoters/:id"
          element={
            <SupervisorOrAdminRoute>
              <PromoterDetails />
            </SupervisorOrAdminRoute>
          }
        />
        <RouterRoute
          path="promoters/:id/route"
          element={
            <SupervisorOrAdminRoute>
              <RouteMap />
            </SupervisorOrAdminRoute>
          }
        />

        {/* Configuração de rotas: supervisor (escopo) ou admin */}
        <RouterRoute
          path="routes/config"
          element={
            <SupervisorOrAdminRoute>
              <RouteConfig />
            </SupervisorOrAdminRoute>
          }
        />
        <RouterRoute
          path="stores"
          element={
            <SupervisorOrAdminRoute>
              <StoresManagement />
            </SupervisorOrAdminRoute>
          }
        />

        {/* Telas exclusivas de admin */}
        <RouterRoute
          path="industries"
          element={
            <AdminRoute>
              <IndustriesManagement />
            </AdminRoute>
          }
        />
        <RouterRoute
          path="industries/coverage"
          element={
            <AdminRoute>
              <IndustryCoverage />
            </AdminRoute>
          }
        />
        <RouterRoute
          path="stores/industries"
          element={
            <AdminRoute>
              <StoreIndustriesConfig />
            </AdminRoute>
          }
        />
        <RouterRoute
          path="admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />

        {/* Relatórios: SUPERVISOR e ADMIN */}
        <RouterRoute
          path="reports"
          element={
            <SupervisorOrAdminRoute>
              <Reports />
            </SupervisorOrAdminRoute>
          }
        />

        {/* Dashboard do Dono de Indústria */}
        <RouterRoute
          path="industry-dashboard"
          element={
            <IndustryOwnerRoute>
              <IndustryOwnerDashboard />
            </IndustryOwnerRoute>
          }
        />

        {/* Configurações gerais - qualquer usuário autenticado */}
        <RouterRoute path="settings" element={<Settings />} />
      </RouterRoute>
    </RouterRoutes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

