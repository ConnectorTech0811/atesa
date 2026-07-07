import React, { useState } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import { useAuth } from '../../auth/AuthContext';
import Sidebar from '../../components/Sidebar';
import CadastroEmpresas from './CadastroEmpresas';
import AdminUsuarios from './AdminUsuarios';
import PainelExecutivo from './PainelExecutivo';
import AgendaReuniones from './AgendaReuniones';
import './DashboardLayout.css';

/** Página inicial do dashboard de acordo com o perfil do usuário logado. */
const PAGINA_INICIAL_POR_PERFIL: Record<string, string> = {
  administrador: '/dashboard/usuarios',
  consultor: '/dashboard/empresas',
  executivo_contas: '/dashboard/executivo',
};

const DashboardLayout: React.FC = () => {
  const { usuario } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  if (!usuario) {
    return <Redirect to="/login" />;
  }

  const paginaInicial = PAGINA_INICIAL_POR_PERFIL[usuario.perfil] ?? '/dashboard/executivo';

  return (
    <IonPage>
      <IonContent className="dashboard-content" fullscreen>
        <div className="dashboard-layout">
          <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((prev) => !prev)} />
          <main className="dashboard-main">
            <Switch>
              <Route exact path="/dashboard/empresas" component={CadastroEmpresas} />
              <Route exact path="/dashboard/usuarios" component={AdminUsuarios} />
              <Route exact path="/dashboard/executivo" component={PainelExecutivo} />
              <Route exact path="/dashboard/agenda" component={AgendaReuniones} />
              <Route exact path="/dashboard">
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
