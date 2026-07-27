import React, { useState } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import { useAuth } from '../../auth/AuthContext';
import Sidebar from '../../components/Sidebar';
import CadastroEmpresas from './CadastroEmpresas';
import AdminUsuarios from './AdminUsuarios';
import PainelExecutivo from './PainelExecutivo';
import AgendaReuniones from './AgendaReuniones';
import GerenciamentoPermissoes from './GerenciamentoPermissoes';
import './DashboardLayout.css';

/** Página inicial do dashboard de acordo com o perfil do usuário logado. */
const PAGINA_INICIAL_POR_PERFIL: Record<string, string> = {
  administrador: '/dashboard/usuarios',
  consultor: '/dashboard/empresas',
  executivo_contas: '/dashboard/executivo',
};

/** Rotas permitidas por perfil. Administrador acessa tudo. */
const ROTAS_PERMITIDAS: Record<string, string[]> = {
  administrador: ['/dashboard/usuarios', '/dashboard/empresas', '/dashboard/executivo', '/dashboard/agenda', '/dashboard/permissoes'],
  consultor: ['/dashboard/empresas'],
  executivo_contas: ['/dashboard/executivo', '/dashboard/agenda'],
};

const PERFIS_CONHECIDOS = Object.keys(PAGINA_INICIAL_POR_PERFIL);

function podeAcessar(perfil: string, caminho: string): boolean {
  if (perfil === 'administrador') return true;
  return (ROTAS_PERMITIDAS[perfil] ?? []).some((r) => caminho.startsWith(r));
}

const DashboardLayout: React.FC = () => {
  const { usuario } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (!usuario) {
    return <Redirect to="/login" />;
  }

  if (!PERFIS_CONHECIDOS.includes(usuario.perfil)) {
    return (
      <IonPage>
        <IonContent className="dashboard-content" fullscreen>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 8, color: '#666' }}>
            <p style={{ fontSize: 16, fontWeight: 600 }}>Acesso não configurado</p>
            <p style={{ fontSize: 13 }}>Seu perfil ({usuario.perfil}) não tem acesso ao painel. Contate o administrador.</p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const paginaInicial = PAGINA_INICIAL_POR_PERFIL[usuario.perfil];

  return (
    <IonPage>
      <IonContent className="dashboard-content" fullscreen>
        <div className="dashboard-layout">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
          <main className="dashboard-main">
            <Switch>
              <Route exact path="/dashboard/empresas">
                {podeAcessar(usuario.perfil, '/dashboard/empresas') ? <CadastroEmpresas /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/usuarios">
                {podeAcessar(usuario.perfil, '/dashboard/usuarios') ? <AdminUsuarios /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/executivo">
                {podeAcessar(usuario.perfil, '/dashboard/executivo') ? <PainelExecutivo /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/agenda">
                {podeAcessar(usuario.perfil, '/dashboard/agenda') ? <AgendaReuniones /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/permissoes">
                {podeAcessar(usuario.perfil, '/dashboard/permissoes') ? <GerenciamentoPermissoes /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard">
                <Redirect to={paginaInicial} />
              </Route>
              <Route>
                <Redirect to={paginaInicial} />
              </Route>
            </Switch>
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default DashboardLayout;
