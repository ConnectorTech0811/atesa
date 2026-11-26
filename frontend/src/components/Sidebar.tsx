import React, { useState, useEffect } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { useAuth, type Usuario } from '../auth/AuthContext';
import { usePermissoes } from '../auth/PermissoesContext';
import { calcularAcessoFaturamento } from '../auth/acessoFaturamento';
import { podeVerFinanceiro } from '../auth/acessoFinanceiro';
import { relatoriosPermitidos } from '../auth/acessoRelatorios';
import { calcularAcessoEscalas } from '../auth/acessoEscalas';
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

const IconShield = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const IconUserCheck = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <polyline points="16 11 18 13 22 9" />
  </svg>
);

const IconClipboard = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    <line x1="9" y1="12" x2="15" y2="12" />
    <line x1="9" y1="16" x2="13" y2="16" />
  </svg>
);

const IconPercent = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="5" x2="5" y2="19" />
    <circle cx="6.5" cy="6.5" r="2.5" />
    <circle cx="17.5" cy="17.5" r="2.5" />
  </svg>
);

const IconHeart = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
  </svg>
);

const IconFinanceiro = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <line x1="2" y1="10" x2="22" y2="10" />
    <line x1="6" y1="15" x2="10" y2="15" />
  </svg>
);

const IconFaturamento = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="8" y1="13" x2="16" y2="13" />
    <line x1="8" y1="17" x2="16" y2="17" />
  </svg>
);

const IconMonitoramento = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
    <line x1="8" y1="21" x2="16" y2="21" />
    <line x1="12" y1="17" x2="12" y2="21" />
  </svg>
);

// Monitoramento: enfermeira (touca com cruz) — diferente do ícone da Supervisão
const IconEnfermeira = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 8.5V4L12 1.8 18 4v4.5z" />
    <line x1="12" y1="3.6" x2="12" y2="7" />
    <line x1="10.3" y1="5.3" x2="13.7" y2="5.3" />
    <path d="M7.5 8.5a4.5 4.5 0 0 0 9 0" />
    <path d="M4 22v-1.5A5.5 5.5 0 0 1 9.5 15h5a5.5 5.5 0 0 1 5.5 5.5V22" />
  </svg>
);

interface SubItem {
  path: string;
  label: string;
  titulo?: string;
  icone: React.ReactNode;
  /** Outros endereços que também marcam o subitem como ativo. */
  aliases?: string[];
}

const svgSub = { width: 15, height: 15, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const IconPin = () => (<svg {...svgSub}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></svg>);
const IconCalendarSm = () => (<svg {...svgSub}><rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>);
const IconShieldSm = () => (<svg {...svgSub}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>);
const IconUsersSm = () => (<svg {...svgSub}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>);
const IconFileSm = () => (<svg {...svgSub}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>);

/** Menu por perfil de usuário. Cada novo tipo ganha sua entrada conforme a funcionalidade é construída. */
const MENU_POR_PERFIL: Record<string, MenuItem[]> = {
  administrador: [
    { label: 'Cadastro de Usuários', path: '/dashboard/usuarios', icone: IconUsers },
    { label: 'Cadastro de Empresas', path: '/dashboard/empresas', icone: IconBuilding },
    { label: 'Painel Executivo', path: '/dashboard/executivo', icone: IconBriefcase },
    { label: 'Agenda', path: '/dashboard/agenda', icone: IconCalendar },
    { label: 'Permissões e Grupos', path: '/dashboard/permissoes', icone: IconShield },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
    { label: 'RA', path: '/dashboard/ra', icone: IconUserCheck },
    { label: 'Benefícios', path: '/dashboard/beneficios', icone: IconHeart },
    { label: 'Monitoramento', path: '/dashboard/monitoramento', icone: IconEnfermeira },
    { label: 'Supervisão', path: '/dashboard/supervisao', icone: IconMonitoramento },
    { label: 'Taxas e Impostos', path: '/dashboard/taxas', icone: IconPercent },
    { label: 'Fechamento eSocial', path: '/dashboard/esocial-fechamento', icone: IconClipboard },
    { label: 'eSocial — Folha e Lotes', path: '/dashboard/esocial-folha', icone: IconClipboard },
    // { label: 'Ocorrências', path: '/dashboard/ocorrencias', icone: IconClipboard }, // TODO: ativar quando módulo Ocorrências for priorizado
  ],
  consultor: [
    { label: 'Cadastro de Empresas', path: '/dashboard/empresas', icone: IconBuilding },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
  ],
  executivo_contas: [
    { label: 'Meus Clientes', path: '/dashboard/executivo', icone: IconBriefcase },
    { label: 'Agenda', path: '/dashboard/agenda', icone: IconCalendar },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
  ],
  parametro: [
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
  ],
  ra: [
    { label: 'RA', path: '/dashboard/ra', icone: IconUserCheck },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
  ],
  beneficios: [
    { label: 'Benefícios', path: '/dashboard/beneficios', icone: IconHeart },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
  ],
  supervisao: [
    { label: 'Monitoramento', path: '/dashboard/monitoramento', icone: IconEnfermeira },
    { label: 'Supervisão', path: '/dashboard/supervisao', icone: IconMonitoramento },
    { label: 'Agenda', path: '/dashboard/agenda', icone: IconCalendar },
    { label: 'Cadastro de Empresas', path: '/dashboard/empresas', icone: IconBuilding },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
  ],
  faturamento: [
    { label: 'Cadastro de Empresas', path: '/dashboard/empresas', icone: IconBuilding },
    { label: 'Taxas e Impostos', path: '/dashboard/taxas', icone: IconPercent },
    { label: 'Fechamento eSocial', path: '/dashboard/esocial-fechamento', icone: IconClipboard },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
  ],
  financeiro: [
    { label: 'Taxas e Impostos', path: '/dashboard/taxas', icone: IconPercent },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
  ],
  suporte: [
    { label: 'Cadastro de Usuários', path: '/dashboard/usuarios', icone: IconUsers },
    { label: 'Cadastro de Empresas', path: '/dashboard/empresas', icone: IconBuilding },
    { label: 'Painel Executivo', path: '/dashboard/executivo', icone: IconBriefcase },
    { label: 'Agenda', path: '/dashboard/agenda', icone: IconCalendar },
    { label: 'Permissões e Grupos', path: '/dashboard/permissoes', icone: IconShield },
    { label: 'Parâmetro', path: '/dashboard/parametro', icone: IconClipboard },
    { label: 'RA', path: '/dashboard/ra', icone: IconUserCheck },
    { label: 'Benefícios', path: '/dashboard/beneficios', icone: IconHeart },
    { label: 'Monitoramento', path: '/dashboard/monitoramento', icone: IconEnfermeira },
    { label: 'Supervisão', path: '/dashboard/supervisao', icone: IconMonitoramento },
    { label: 'Taxas e Impostos', path: '/dashboard/taxas', icone: IconPercent },
    { label: 'Fechamento eSocial', path: '/dashboard/esocial-fechamento', icone: IconClipboard },
    { label: 'eSocial — Folha e Lotes', path: '/dashboard/esocial-folha', icone: IconClipboard },
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
  const { permissoes, temPermissao } = usePermissoes();

  // Faturamento: item principal do menu (padrão para o perfil Faturamento; ver auth/acessoFaturamento.ts)
  const incluirFaturamento = (menu: MenuItem[]): MenuItem[] => {
    if (!calcularAcessoFaturamento(usuario?.perfil, permissoes)) return incluirFinanceiro(menu);
    const faturamento = { label: 'Faturamento', path: '/dashboard/faturamento', icone: IconFaturamento };
    const idx = Math.max(menu.findIndex((i) => i.path === '/dashboard/monitoramento'), menu.findIndex((i) => i.path === '/dashboard/supervisao'));
    const comFaturamento = idx === -1 ? [...menu, faturamento] : [...menu.slice(0, idx + 1), faturamento, ...menu.slice(idx + 1)];
    return incluirFinanceiro(comFaturamento);
  };

  // Financeiro: item principal (padrão para o perfil Financeiro; ver auth/acessoFinanceiro.ts)
  const incluirFinanceiro = (menu: MenuItem[]): MenuItem[] => {
    if (!podeVerFinanceiro(usuario?.perfil, permissoes)) return incluirRelatorios(menu);
    const financeiro = { label: 'Financeiro', path: '/dashboard/financeiro', icone: IconFinanceiro };
    const idx = menu.findIndex((i) => i.path === '/dashboard/faturamento');
    return incluirRelatorios(idx === -1 ? [...menu, financeiro] : [...menu.slice(0, idx + 1), financeiro, ...menu.slice(idx + 1)]);
  };

  // Relatórios Financeiros: visível para quem tem acesso a pelo menos um relatório (ver auth/acessoRelatorios.ts)
  const incluirRelatorios = (menu: MenuItem[]): MenuItem[] => {
    if (!relatoriosPermitidos(usuario?.perfil, permissoes).length) return menu;
    const relatorios = { label: 'Relatórios Financeiros', path: '/dashboard/relatorios-financeiros', icone: IconFaturamento };
    const idx = Math.max(menu.findIndex((i) => i.path === '/dashboard/financeiro'), menu.findIndex((i) => i.path === '/dashboard/faturamento'));
    return idx === -1 ? [...menu, relatorios] : [...menu.slice(0, idx + 1), relatorios, ...menu.slice(idx + 1)];
  };

  const obterItensMenu = () => {
    if (!usuario) return [];

    // Escalista: somente Escalas de plantão
    if (usuario.perfil === 'escalista') {
      return calcularAcessoEscalas(usuario.perfil, permissoes)
        ? [{ label: 'Escalas', path: '/dashboard/monitoramento/escalas', icone: IconMonitoramento }]
        : [];
    }

    if (usuario.perfil === 'administrador' || usuario.perfil === 'suporte') {
      return incluirFaturamento(MENU_POR_PERFIL[usuario.perfil] ?? MENU_POR_PERFIL.administrador);
    }

    const menu: MenuItem[] = [];
    const todosModulosMenu: { id: string; path: string; label: string; icone: React.FC; labelAlt?: string }[] = [
      { id: 'usuarios', path: '/dashboard/usuarios', label: 'Cadastro de Usuários', icone: IconUsers },
      { id: 'empresas', path: '/dashboard/empresas', label: 'Cadastro de Empresas', icone: IconBuilding },
      { id: 'executivo', path: '/dashboard/executivo', label: 'Painel Executivo', icone: IconBriefcase, labelAlt: usuario.perfil === 'executivo_contas' ? 'Meus Clientes' : undefined },
      { id: 'agenda', path: '/dashboard/agenda', label: 'Agenda', icone: IconCalendar },
      { id: 'permissoes', path: '/dashboard/permissoes', label: 'Permissões e Grupos', icone: IconShield },
      { id: 'parametro', path: '/dashboard/parametro', label: 'Parâmetro', icone: IconClipboard },
      { id: 'ra', path: '/dashboard/ra', label: 'RA', icone: IconUserCheck },
      { id: 'beneficios', path: '/dashboard/beneficios', label: 'Benefícios', icone: IconHeart },
      { id: 'monitoramento', path: '/dashboard/monitoramento', label: 'Monitoramento', icone: IconEnfermeira },
      // Supervisão usa a mesma permissão do módulo Monitoramento
      { id: 'monitoramento', path: '/dashboard/supervisao', label: 'Supervisão', icone: IconMonitoramento },
      { id: 'taxas', path: '/dashboard/taxas', label: 'Taxas e Impostos', icone: IconPercent },
      { id: 'esocial_fechamento', path: '/dashboard/esocial-fechamento', label: 'Fechamento eSocial', icone: IconClipboard },
      // Área reservada: só aparece para quem tiver "esocial_folha" liberado (fora do menu padrão de todos os perfis)
      { id: 'esocial_folha', path: '/dashboard/esocial-folha', label: 'eSocial — Folha e Lotes', icone: IconClipboard },
    ];

    const menuPadraoDoPerfil = (MENU_POR_PERFIL[usuario.perfil] ?? []).map((i) => i.path);

    for (const item of todosModulosMenu) {
      const estaNoPadrao = menuPadraoDoPerfil.includes(item.path);
      const temAcesso = estaNoPadrao
        ? permissoes[item.id] !== false
        : permissoes[item.id] === true;

      if (temAcesso) {
        menu.push({
          label: item.labelAlt || item.label,
          path: item.path,
          icone: item.icone,
        });
      }
    }

    // Ordenar os itens de menu para manter a consistência visual
    const ordemReferencia = [
      '/dashboard/usuarios',
      '/dashboard/empresas',
      '/dashboard/executivo',
      '/dashboard/agenda',
      '/dashboard/permissoes',
      '/dashboard/parametro',
      '/dashboard/ra',
      '/dashboard/beneficios',
      '/dashboard/monitoramento',
      '/dashboard/supervisao',
      '/dashboard/faturamento',
      '/dashboard/financeiro',
      '/dashboard/relatorios-financeiros',
      '/dashboard/taxas',
      '/dashboard/esocial-fechamento',
      '/dashboard/esocial-folha',
    ];

    return incluirFaturamento(menu).sort((a, b) => {
      const idxA = ordemReferencia.indexOf(a.path);
      const idxB = ordemReferencia.indexOf(b.path);
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });
  };

  // Submenus: cada item principal pode ter subitens (abre/fecha pela seta; abre sozinho ao navegar para um subitem)
  const [submenusAbertos, setSubmenusAbertos] = useState<Record<string, boolean>>({});

  const ehSuporteOuAdmin = usuario?.perfil === 'administrador' || usuario?.perfil === 'suporte';
  const itensPrincipais = obterItensMenu();
  // Permissões e Grupos fica como submenu de Cadastro de Usuários (só sobe ao menu principal se o usuário não vê Usuários)
  const permissoesNoSubmenu = itensPrincipais.some((i) => i.path === '/dashboard/usuarios') && itensPrincipais.some((i) => i.path === '/dashboard/permissoes');
  const itensMenu = permissoesNoSubmenu ? itensPrincipais.filter((i) => i.path !== '/dashboard/permissoes') : itensPrincipais;

  const subitensDe = (path: string): SubItem[] => {
    switch (path) {
      case '/dashboard/usuarios':
        return [
          ...(ehSuporteOuAdmin ? [
            { path: '/dashboard/usuarios/geolocalizacao', label: 'Cad. de Geolocalização', titulo: 'Cadastro de Geolocalização', icone: <IconPin /> },
            { path: '/dashboard/usuarios/escalistas', label: 'Escalistas e Clientes', titulo: 'Escalistas e os clientes que cada uma atende', icone: <IconCalendarSm /> },
          ] : []),
          ...(permissoesNoSubmenu ? [{ path: '/dashboard/permissoes', label: 'Permissões e Grupos', titulo: 'Permissões e Grupos', icone: <IconShieldSm /> }] : []),
        ];
      case '/dashboard/monitoramento':
        // Escalas (lançamento, pacientes/locais e histórico de substituições) ficam no Monitoramento
        return temPermissao('monitoramento.escalas')
          ? [{ path: '/dashboard/monitoramento/escalas', label: 'Escalas', titulo: 'Escalas de plantão', icone: <IconCalendarSm /> }]
          : [];
      case '/dashboard/supervisao':
        return [{ path: '/dashboard/supervisao/carteira', label: 'Carteira de Supervisores', titulo: 'Clientes que cada supervisor atende', icone: <IconUsersSm /> }];
      case '/dashboard/beneficios':
        return [{ path: '/dashboard/beneficios/acompanhamento', label: 'Acomp. de Adesão', titulo: 'Acompanhamento de Adesão', icone: <IconFileSm />, aliases: ['/dashboard/usuarios/suporte'] }];
      default:
        return [];
    }
  };

  const subitemAtivo = (s: SubItem) => [s.path, ...(s.aliases ?? [])].some((p) => location.pathname.startsWith(p));

  useEffect(() => {
    for (const item of itensMenu) {
      if (subitensDe(item.path).some(subitemAtivo)) {
        setSubmenusAbertos((prev) => (prev[item.path] ? prev : { ...prev, [item.path]: true }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

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
          const subitens = subitensDe(item.path);
          const algumSubAtivo = subitens.some(subitemAtivo);

          if (subitens.length > 0) {
            const aberto = !!submenusAbertos[item.path];
            const principalAtivo = location.pathname.startsWith(item.path) && !algumSubAtivo;
            return (
              <div key={item.path} className="sidebar-item-group">
                <div
                  className={`sidebar-card ${principalAtivo ? 'sidebar-card-active' : ''} ${algumSubAtivo ? 'sidebar-card-parent-active' : ''}`}
                  onClick={() => history.push(item.path)}
                  title={item.label}
                >
                  <div className="sidebar-card-left">
                    <span className="sidebar-icon">
                      <Icone />
                    </span>
                    {!collapsed && <span className="sidebar-label">{item.label}</span>}
                  </div>
                  {!collapsed && (
                    <button
                      type="button"
                      className={`sidebar-card-arrow ${aberto ? 'sidebar-card-arrow-open' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSubmenusAbertos((prev) => ({ ...prev, [item.path]: !prev[item.path] }));
                      }}
                      title={aberto ? 'Recolher submenu' : `Abrir ${subitens.map((s) => s.label).join(', ')}`}
                      aria-label={aberto ? 'Recolher submenu' : `Abrir submenu de ${item.label}`}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </button>
                  )}
                </div>

                {!collapsed && aberto && (
                  <div className="sidebar-submenu-wrapper">
                    <div className="sidebar-submenu-line" />
                    {subitens.map((s) => (
                      <button
                        key={s.path}
                        type="button"
                        className={`sidebar-submenu-pill ${subitemAtivo(s) ? 'sidebar-submenu-pill-active' : ''}`}
                        onClick={() => history.push(s.path)}
                        title={s.titulo ?? s.label}
                      >
                        <span className="sidebar-submenu-icon">{s.icone}</span>
                        <span className="sidebar-submenu-label">{s.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }

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
