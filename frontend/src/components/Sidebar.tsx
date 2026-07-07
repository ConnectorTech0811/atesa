import React from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth, type Usuario } from '../auth/AuthContext';
import { getAppName, getLogoPath } from '../theme/applyTheme';
import './Sidebar.css';

interface MenuItem {
  label: string;
  path: string;
  icone: React.FC;
}

const IconBuilding = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 21h18" />
    <path d="M5 21V7l8-4v18" />
    <path d="M19 21V11l-6-4" />
    <path d="M9 9v.01" />
    <path d="M9 12v.01" />
    <path d="M9 15v.01" />
    <path d="M9 18v.01" />
  </svg>
);

const IconBriefcase = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const IconCalendar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);

const IconUsers = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

/** Menu por perfil de usuário. Cada novo tipo ganha sua entrada conforme a funcionalidade é construída. */
const MENU_POR_PERFIL: Record<string, MenuItem[]> = {
  administrador: [
    { label: 'Cadastro de Usuários', path: '/dashboard/usuarios', icone: IconUsers },
    { label: 'Cadastro de Empresas', path: '/dashboard/empresas', icone: IconBuilding },
  ],
  consultor: [{ label: 'Cadastro de Empresas', path: '/dashboard/empresas', icone: IconBuilding }],
  executivo_contas: [
    { label: 'Meus Clientes', path: '/dashboard/executivo', icone: IconBriefcase },
    { label: 'Agenda', path: '/dashboard/agenda', icone: IconCalendar },
  ],
};

function obterMenu(usuario: Usuario | null): MenuItem[] {
  if (!usuario) return [];
  return MENU_POR_PERFIL[usuario.perfil] ?? [];
}

const IconChevron = ({ collapsed }: { collapsed: boolean }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const IconLogout = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

interface Props {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<Props> = ({ collapsed, onToggle }) => {
  const history = useHistory();
  const location = useLocation();
  const { usuario, logout } = useAuth();
  const itensMenu = obterMenu(usuario);

  const handleLogout = () => {
    logout();
    history.replace('/login');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-header">
        {!collapsed && <img src={getLogoPath()} alt={getAppName()} className="sidebar-logo" />}
        <button className="sidebar-toggle" onClick={onToggle} aria-label="Recolher menu">
          <IconChevron collapsed={collapsed} />
        </button>
      </div>

      <nav className="sidebar-menu">
        {itensMenu.map((item) => {
          const Icone = item.icone;
          return (
            <button
              key={item.path}
              className={`sidebar-item ${location.pathname.startsWith(item.path) ? 'sidebar-item-active' : ''}`}
              onClick={() => history.push(item.path)}
              title={item.label}
            >
              <span className="sidebar-icon">
                <Icone />
              </span>
              {!collapsed && <span className="sidebar-label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user" title={usuario?.nome}>
          <span className="sidebar-avatar">{usuario?.nome.charAt(0) ?? '?'}</span>
          {!collapsed && (
            <div className="sidebar-user-info">
              <span className="sidebar-user-nome">{usuario?.nome}</span>
              <span className="sidebar-user-perfil">{usuario?.perfil}</span>
            </div>
          )}
        </div>
        <button className="sidebar-item sidebar-logout" onClick={handleLogout} title="Sair">
          <span className="sidebar-icon">
            <IconLogout />
          </span>
          {!collapsed && <span className="sidebar-label">Sair</span>}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
