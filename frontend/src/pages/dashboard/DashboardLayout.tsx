import React, { useState } from 'react';
import { Redirect, Route, Switch } from 'react-router-dom';
import { IonContent, IonPage } from '@ionic/react';
import { useAuth } from '../../auth/AuthContext';
import { usePermissoes } from '../../auth/PermissoesContext';
import Sidebar from '../../components/Sidebar';
import CadastroEmpresas from './CadastroEmpresas';
import AdminUsuarios from './AdminUsuarios';
import PainelExecutivo from './PainelExecutivo';
import AgendaReuniones from './AgendaReuniones';
import GerenciamentoPermissoes from './GerenciamentoPermissoes';
import Parametro from './Parametro';
import Ra from './Ra';
import TaxasImpostos from './TaxasImpostos';
import Beneficios from './Beneficios';
// import Ocorrencias from './Ocorrencias'; // TODO: ativar quando módulo Ocorrências for priorizado
import './DashboardLayout.css';

/** Página inicial do dashboard de acordo com o perfil do usuário logado. */
const PAGINA_INICIAL_POR_PERFIL: Record<string, string> = {
  administrador: '/dashboard/usuarios',
  consultor: '/dashboard/empresas',
  executivo_contas: '/dashboard/executivo',
  parametro: '/dashboard/parametro',
  ra: '/dashboard/ra',
  beneficios: '/dashboard/beneficios',
  supervisao: '/dashboard/empresas',
};

/** Rotas permitidas por perfil. Administrador acessa tudo. */
const ROTAS_PERMITIDAS: Record<string, string[]> = {
  administrador: ['/dashboard/usuarios', '/dashboard/empresas', '/dashboard/executivo', '/dashboard/agenda', '/dashboard/permissoes', '/dashboard/parametro', '/dashboard/ra', '/dashboard/taxas', '/dashboard/beneficios'],
  consultor: ['/dashboard/empresas'],
  executivo_contas: ['/dashboard/executivo', '/dashboard/agenda'],
  parametro: ['/dashboard/parametro'],
  ra: ['/dashboard/ra'],
  beneficios: ['/dashboard/beneficios'],
  supervisao: ['/dashboard/empresas'],
};

const PERFIS_CONHECIDOS = Object.keys(PAGINA_INICIAL_POR_PERFIL);

function podeAcessar(perfil: string, caminho: string): boolean {
  if (perfil === 'administrador') return true;
  return (ROTAS_PERMITIDAS[perfil] ?? []).some((r) => caminho.startsWith(r));
}

const DashboardLayout: React.FC = () => {
  const { usuario } = useAuth();
  const { permissoes } = usePermissoes();
  const [collapsed, setCollapsed] = useState(false);

  if (!usuario) {
    return <Redirect to="/login" />;
  }

  function podeAcessarRota(caminho: string): boolean {
    if (!usuario) return false;
    if (usuario.perfil === 'administrador') return true;

    // Verificar todos os módulos do sistema com permissões customizáveis
    const modulosCustomizaveis = [
      'usuarios',
      'empresas',
      'executivo',
      'agenda',
      'permissoes',
      'parametro',
      'ra',
      'beneficios',
      'taxas',
    ] as const;
    for (const modulo of modulosCustomizaveis) {
      const pathModulo = `/dashboard/${modulo}`;
      if (caminho.startsWith(pathModulo)) {
        const estaNoPadrao = (ROTAS_PERMITIDAS[usuario.perfil] ?? []).some(r => r.startsWith(pathModulo));
        if (estaNoPadrao) {
          return permissoes[modulo] !== false;
        } else {
          return permissoes[modulo] === true;
        }
      }
    }

    return (ROTAS_PERMITIDAS[usuario.perfil] ?? []).some((r) => caminho.startsWith(r));
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
                {podeAcessarRota('/dashboard/empresas') ? <CadastroEmpresas /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/usuarios">
                {podeAcessarRota('/dashboard/usuarios') ? <AdminUsuarios /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/executivo">
                {podeAcessarRota('/dashboard/executivo') ? <PainelExecutivo /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/agenda">
                {podeAcessarRota('/dashboard/agenda') ? <AgendaReuniones /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/permissoes">
                {podeAcessarRota('/dashboard/permissoes') ? <GerenciamentoPermissoes /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/parametro">
                {podeAcessarRota('/dashboard/parametro') ? <Parametro /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/ra">
                {podeAcessarRota('/dashboard/ra') ? <Ra /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/taxas">
                {podeAcessarRota('/dashboard/taxas') ? <TaxasImpostos /> : <Redirect to={paginaInicial} />}
              </Route>
              <Route exact path="/dashboard/beneficios">
                {podeAcessarRota('/dashboard/beneficios') ? <Beneficios /> : <Redirect to={paginaInicial} />}
              </Route>
              {/* <Route exact path="/dashboard/ocorrencias"> TODO: ativar quando módulo Ocorrências for priorizado
                {podeAcessarRota('/dashboard/ocorrencias') ? <Ocorrencias /> : <Redirect to={paginaInicial} />}
              </Route> */}
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
