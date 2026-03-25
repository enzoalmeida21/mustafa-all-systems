import React, { useState, useEffect } from 'react';
import type { ComponentType } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const RouterOutlet = Outlet as ComponentType;

// Ícones SVG com cores da marca
const DashboardIcon = ({ active }: { active: boolean }) => (
  <svg
    className={`w-5 h-5 ${active ? 'text-primary-400' : 'text-text-tertiary'}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
    />
  </svg>
);

const ReportsIcon = ({ active }: { active: boolean }) => (
  <svg
    className={`w-5 h-5 ${active ? 'text-violet-600' : 'text-gray-500'}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const SettingsIcon = ({ active }: { active: boolean }) => (
  <svg
    className={`w-5 h-5 ${active ? 'text-violet-600' : 'text-gray-500'}`}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const LogoutIcon = () => (
  <svg
    className="w-5 h-5 text-text-tertiary"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const MenuIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 6h16M4 12h16M4 18h16"
    />
  </svg>
);

export default function Layout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(true);

  // Auto-expand sidebar on desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setIsSidebarExpanded(true);
        setIsMobileMenuOpen(false);
      } else {
        setIsMobileMenuOpen(false);
      }
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const RouteIcon = ({ active }: { active: boolean }) => (
    <svg
      className={`w-5 h-5 ${active ? 'text-violet-600' : 'text-gray-500'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
      />
    </svg>
  );

  const StoresIcon = ({ active }: { active: boolean }) => (
    <svg
      className={`w-5 h-5 ${active ? 'text-violet-600' : 'text-gray-500'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );

  const PromoterOpsIcon = ({ active }: { active: boolean }) => (
    <svg
      className={`w-5 h-5 ${active ? 'text-primary-400' : 'text-text-tertiary'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );

  const AdminIcon = ({ active }: { active: boolean }) => (
    <svg
      className={`w-5 h-5 ${active ? 'text-primary-400' : 'text-text-tertiary'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 15C15.866 15 19 11.866 19 8C19 4.13401 15.866 1 12 1C8.13401 1 5 4.13401 5 8C5 11.866 8.13401 15 12 15Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8.21 13.89L7 23L12 20L17 23L15.79 13.88"
      />
    </svg>
  );

  const AdminIndustriesIcon = ({ active }: { active: boolean }) => (
    <svg
      className={`w-5 h-5 ${active ? 'text-primary-400' : 'text-text-tertiary'}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
      />
    </svg>
  );

  const isAdmin = user?.role === 'ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isIndustryOwner = user?.role === 'INDUSTRY_OWNER';
  const isSupervisorOrAdmin = isSupervisor || isAdmin;

  const navigation = [
    ...(isSupervisorOrAdmin ? [{ name: 'Dashboard', path: '/', icon: DashboardIcon }] : []),
    ...(isIndustryOwner ? [{ name: 'Minha Industria', path: '/industry-dashboard', icon: DashboardIcon }] : []),
    ...(isSupervisorOrAdmin
      ? [{ name: 'Relatórios', path: '/reports', icon: ReportsIcon }]
      : []),
    ...(isSupervisorOrAdmin
      ? [
          { name: 'Gerenciar Lojas', path: '/stores', icon: StoresIcon },
          { name: 'Configurar Rotas', path: '/routes/config', icon: RouteIcon },
        ]
      : []),
    ...(isAdmin
      ? [{ name: 'Indústrias/Loja', path: '/stores/industries', icon: AdminIndustriesIcon }]
      : []),
    { name: 'Configurações', path: '/settings', icon: SettingsIcon },
    ...(isAdmin
      ? [
          { name: 'Indústrias', path: '/industries', icon: AdminIndustriesIcon },
          { name: 'Cobertura', path: '/industries/coverage', icon: ReportsIcon },
          { name: 'Hoje (Promotores)', path: '/admin/promoters/today', icon: ReportsIcon },
          { name: 'Correções promotor', path: '/admin/promoter-correcoes', icon: PromoterOpsIcon },
          { name: 'Administração', path: '/admin', icon: AdminIcon },
        ]
      : []),
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    if (path === '/admin') {
      return location.pathname === '/admin' || location.pathname === '/admin/';
    }
    return location.pathname.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-dark-background flex">
      {/* Sidebar */}
      <aside
        className={`${
          isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } ${
          isSidebarExpanded ? 'w-64' : 'w-20'
        } bg-dark-backgroundSecondary border-r border-dark-border fixed lg:static h-screen transition-all duration-300 ease-in-out z-30`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-dark-border">
            {isSidebarExpanded && (
              <div className="flex items-center gap-3">
                <img src="/logo.png" alt="Promo Gestão" className="h-8 w-8" />
                <h1 className="text-xl font-bold text-text-primary">
                  Promo Gestão
                </h1>
              </div>
            )}
            {!isSidebarExpanded && (
              <img src="/logo.png" alt="Promo Gestão" className="h-8 w-8 mx-auto" />
            )}
            <button
              onClick={() => {
                if (window.innerWidth >= 1024) {
                  setIsSidebarExpanded(!isSidebarExpanded);
                } else {
                  setIsMobileMenuOpen(false);
                }
              }}
              className="p-2 rounded-lg hover:bg-dark-card transition-colors text-text-secondary hover:text-text-primary"
            >
              <MenuIcon />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const active = isActive(item.path);
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    active
                      ? 'bg-primary-600/20 text-primary-400 font-medium shadow-primary border-l-4 border-primary-600 glow-primary'
                      : 'text-text-secondary hover:bg-primary-600/10 hover:text-primary-400'
                  }`}
                  title={!isSidebarExpanded ? item.name : ''}
                >
                  <Icon active={active} />
                  {isSidebarExpanded && <span className="text-sm">{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* User Info & Logout */}
          <div className="border-t border-dark-border p-4">
            {isSidebarExpanded && (
              <div className="mb-3 px-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-600 to-accent-500 flex items-center justify-center text-text-primary font-semibold shadow-primary">
                    {user?.name?.charAt(0).toUpperCase() || 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {user?.name || 'Usuário'}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">
                      {user?.email || ''}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <button
              onClick={handleLogout}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-text-secondary hover:bg-error-500/20 hover:text-error-500 transition-all duration-200 ${
                !isSidebarExpanded ? 'justify-center' : ''
              }`}
              title={!isSidebarExpanded ? 'Sair' : ''}
            >
              <LogoutIcon />
              {isSidebarExpanded && <span className="text-sm">Sair</span>}
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:ml-0 transition-all duration-300">
        {/* Header */}
        <header className="bg-dark-backgroundSecondary border-b border-dark-border sticky top-0 z-20 shadow-card">
          <div className="px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                  className="lg:hidden p-2 rounded-lg hover:bg-dark-card transition-colors text-text-secondary hover:text-text-primary"
                >
                  <MenuIcon />
                </button>
                <div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-text-primary">
                    {navigation.find((item) => isActive(item.path))?.name || 'Dashboard'}
                  </h2>
                  <p className="text-sm text-text-tertiary mt-1 hidden sm:block">
                    {new Date().toLocaleDateString('pt-BR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6 bg-dark-background min-h-screen">
          <RouterOutlet />
        </main>
      </div>

      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-70 z-20 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
}
