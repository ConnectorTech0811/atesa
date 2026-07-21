import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonPage,
  IonButton,
  IonText,
  IonAlert,
  IonModal,
} from '@ionic/react';
import { useAuth } from '../auth/AuthContext';
import { alterarSenha } from '../api/authApi';
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
  const [showTrocarSenha, setShowTrocarSenha] = useState(false);
  const [usuarioIdTrocarSenha, setUsuarioIdTrocarSenha] = useState<number | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

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
    if (resultado.trocarSenha && resultado.usuarioId) {
      setUsuarioIdTrocarSenha(resultado.usuarioId);
      setShowTrocarSenha(true);
      return;
    }
    history.push('/dashboard');
  };

  const handleTrocarSenha = async () => {
    if (!novaSenha || novaSenha.length < 6) {
      setErroSenha('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    if (novaSenha !== confirmarSenha) {
      setErroSenha('As senhas não coincidem.');
      return;
    }
    setSalvandoSenha(true);
    setErroSenha('');
    try {
      await alterarSenha(usuarioIdTrocarSenha!, novaSenha);
      setShowTrocarSenha(false);
      history.push('/dashboard');
    } catch (e) {
      setErroSenha(e instanceof Error ? e.message : 'Erro ao alterar senha.');
    } finally {
      setSalvandoSenha(false);
    }
  };

  return (
    <IonPage>
      <IonContent className="login-content" fullscreen>
        <div className="login-container">
          <div className="login-card">
            <div className="login-logo-area">
              <img src={getLogoPath()} alt={getAppName()} className="login-logo" />
            </div>

            <form className="login-form" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
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
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLogin(); } }}
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
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleLogin(); } }}
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
                <button type="button" className="login-link" onClick={() => setShowForgotAlert(true)}>
                  Esqueci minha senha
                </button>
              </div>

              <IonButton
                className="login-btn"
                expand="block"
                shape="round"
                color="secondary"
                type="submit"
                onClick={handleLogin}
                disabled={entrando}
              >
                {entrando ? 'Entrando...' : 'Entrar'}
              </IonButton>
            </form>
          </div>
        </div>

        <IonModal isOpen={showTrocarSenha} backdropDismiss={false}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', background: 'var(--ion-color-light, #f4f5f8)', padding: 24 }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 400, width: '100%', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}>
              <h2 style={{ marginTop: 0, marginBottom: 8, fontSize: 20, color: '#333' }}>Primeiro acesso</h2>
              <p style={{ color: '#666', marginBottom: 24, fontSize: 14 }}>Por segurança, defina uma nova senha para a sua conta antes de continuar.</p>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#555' }}>Nova senha</label>
                <input
                  className="login-input-native"
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#555' }}>Confirmar nova senha</label>
                <input
                  className="login-input-native"
                  type="password"
                  placeholder="Repita a senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                />
              </div>

              {erroSenha && <p style={{ color: '#cf3c4f', fontSize: 13, marginBottom: 16 }}>{erroSenha}</p>}

              <IonButton
                expand="block"
                shape="round"
                color="secondary"
                onClick={handleTrocarSenha}
                disabled={salvandoSenha}
              >
                {salvandoSenha ? 'Salvando...' : 'Salvar nova senha'}
              </IonButton>
            </div>
          </div>
        </IonModal>

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
