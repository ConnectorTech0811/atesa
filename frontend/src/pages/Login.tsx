import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonPage,
  IonButton,
  IonText,
  IonAlert,
} from '@ionic/react';
import { useAuth } from '../auth/AuthContext';
import { getAppName, getLogoPath } from '../theme/applyTheme';
import './Login.css';

const Login: React.FC = () => {
  const history = useHistory();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [showForgotAlert, setShowForgotAlert] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [entrando, setEntrando] = useState(false);

  const handleLogin = async () => {
    if (!email || !senha) {
      setErroLogin('Preencha o e-mail e a senha.');
      return;
    }
    setEntrando(true);
    const resultado = await login(email, senha);
    setEntrando(false);
    if (!resultado.sucesso) {
      setErroLogin(resultado.erro ?? 'E-mail ou senha incorretos.');
      return;
    }
    setErroLogin('');
    history.push('/dashboard');
  };

  return (
    <IonPage>
      <IonContent className="login-content" fullscreen>
        <div className="login-container">
          <div className="login-card">
            <div className="login-logo-area">
              <img src={getLogoPath()} alt={getAppName()} className="login-logo" />
            </div>

            <div className="login-form">
              <div className="login-input-group">
                <label className="login-label" htmlFor="email">E-mail</label>
                <input
                  id="email"
                  className="login-input-native"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="login-input-group">
                <label className="login-label" htmlFor="senha">Senha</label>
                <div className="login-input-wrapper">
                  <input
                    id="senha"
                    className="login-input-native"
                    type={mostrarSenha ? 'text' : 'password'}
                    placeholder="••••••••"
                    autoComplete="current-password"
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                  />
                  <button
                    className="login-toggle-senha"
                    type="button"
                    onClick={() => setMostrarSenha(!mostrarSenha)}
                    aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                  >
                    {mostrarSenha ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                        <line x1="1" y1="1" x2="23" y2="23"/>
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {erroLogin && (
                <IonText color="danger" className="login-erro">
                  <p>{erroLogin}</p>
                </IonText>
              )}

              <div className="login-esqueci">
                <button className="login-link" onClick={() => setShowForgotAlert(true)}>
                  Esqueci minha senha
                </button>
              </div>

              <IonButton
                className="login-btn"
                expand="block"
                shape="round"
                color="secondary"
                onClick={handleLogin}
                disabled={entrando}
              >
                {entrando ? 'Entrando...' : 'Entrar'}
              </IonButton>
            </div>
          </div>
        </div>

        <IonAlert
          isOpen={showForgotAlert}
          onDidDismiss={() => setShowForgotAlert(false)}
          header="Recuperar Senha"
          message="Digite seu e-mail para receber as instruções de recuperação de senha."
          inputs={[
            {
              name: 'email',
              type: 'email',
              placeholder: 'seu@email.com',
              value: forgotEmail,
            },
          ]}
          buttons={[
            { text: 'Cancelar', role: 'cancel' },
            {
              text: 'Enviar',
              handler: (data) => {
                setForgotEmail(data.email);
                console.log('Recuperar senha para:', data.email);
              },
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;
