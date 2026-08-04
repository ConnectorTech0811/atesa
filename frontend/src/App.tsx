import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { AuthProvider } from './auth/AuthContext';
import { PermissoesProvider } from './auth/PermissoesContext';
import Login from './pages/Login';
import DashboardLayout from './pages/dashboard/DashboardLayout';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';

import './theme/variables.css';
import './theme/forms.css';

setupIonicReact();

const App: React.FC = () => (
  <IonApp>
    <AuthProvider>
      <PermissoesProvider>
      <IonReactRouter>
        <IonRouterOutlet animated={false}>
          <Route exact path="/login">
            <Login />
          </Route>
          <Route exact path="/dashboard">
            <DashboardLayout />
          </Route>
          <Route exact path="/dashboard/usuarios">
            <DashboardLayout />
          </Route>
          <Route exact path="/dashboard/empresas">
            <DashboardLayout />
          </Route>
          <Route exact path="/dashboard/executivo">
            <DashboardLayout />
          </Route>
          <Route exact path="/dashboard/agenda">
            <DashboardLayout />
          </Route>
          <Route exact path="/dashboard/permissoes">
            <DashboardLayout />
          </Route>
          <Route exact path="/dashboard/parametro">
            <DashboardLayout />
          </Route>
          <Route exact path="/">
            <Redirect to="/login" />
          </Route>
        </IonRouterOutlet>
      </IonReactRouter>
      </PermissoesProvider>
    </AuthProvider>
  </IonApp>
);

export default App;
