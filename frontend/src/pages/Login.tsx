import React, { useEffect, useState, useMemo } from 'react';
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
import { useToast } from '../components/ToastContext';
import { IconEye, IconEyeOff } from '../components/Icons';
import {
  alterarSenha,
  esqueciSenha,
  validarTokenReset,
  redefinirSenhaComToken,
} from '../api/authApi';
import { getAppName, getLogoPath } from '../theme/applyTheme';
import './Login.css';

interface ForcaSenha {
  score: number; // 0 a 3
  nivel: 'muito_fraca' | 'fraca' | 'media' | 'forte';
  rotulo: string;
  cor: string;
}

function calcularForcaSenha(senha: string): ForcaSenha {
  if (!senha) {
    return { score: 0, nivel: 'muito_fraca', rotulo: 'Digite uma senha', cor: '#e0e0e0' };
  }
  let score = 0;
  if (senha.length >= 6) score += 1;
  if (senha.length >= 8 && /[A-Za-z]/.test(senha) && /[0-9]/.test(senha)) score += 1;
  if (senha.length >= 8 && /[A-Z]/.test(senha) && /[0-9]/.test(senha) && /[^A-Za-z0-9]/.test(senha)) score += 1;

  if (score <= 1) {
    return { score: 1, nivel: 'fraca', rotulo: 'Fraca', cor: '#e53935' };
  }
  if (score === 2) {
    return { score: 2, nivel: 'media', rotulo: 'Média', cor: '#fbc02d' };
  }
  return { score: 3, nivel: 'forte', rotulo: 'Forte', cor: '#2e7d32' };
}

const Login: React.FC = () => {
  const history = useHistory();
  const { login } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [showForgotAlert, setShowForgotAlert] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [erroLogin, setErroLogin] = useState('');
  const [entrando, setEntrando] = useState(false);

  // Primeiro acesso / forçar troca de senha
  const [showTrocarSenha, setShowTrocarSenha] = useState(false);
  const [usuarioIdTrocarSenha, setUsuarioIdTrocarSenha] = useState<number | null>(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erroSenha, setErroSenha] = useState('');
  const [salvandoSenha, setSalvandoSenha] = useState(false);

  // Redefinição de senha por Token (Link do E-mail)
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [validandoToken, setValidandoToken] = useState(false);
  const [usuarioReset, setUsuarioReset] = useState<{ id: number; nome: string; email: string } | null>(null);
  const [erroTokenInvalido, setErroTokenInvalido] = useState<string | null>(null);

  const [resetNovaSenha, setResetNovaSenha] = useState('');
  const [resetConfirmaSenha, setResetConfirmaSenha] = useState('');
  const [mostrarResetNova, setMostrarResetNova] = useState(false);
  const [mostrarResetConfirma, setMostrarResetConfirma] = useState(false);
  const [salvandoReset, setSalvandoReset] = useState(false);
  const [erroResetForm, setErroResetForm] = useState('');

  const forcaSenhaReset = useMemo(() => calcularForcaSenha(resetNovaSenha), [resetNovaSenha]);

  // Detecta token na URL (ex: /login?token=xyz ou /login?resetToken=xyz)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token') || params.get('resetToken');
    if (token) {
      setResetToken(token);
      setShowResetModal(true);
      verificarToken(token);
    }
  }, []);

  const verificarToken = async (token: string) => {
    setValidandoToken(true);
    setErroTokenInvalido(null);
    try {
      const res = await validarTokenReset(token);
      if (res.valido && res.usuario) {
        setUsuarioReset(res.usuario);
      } else {
        setErroTokenInvalido(res.erro || 'Link de recuperação inválido ou expirado.');
      }
    } catch (err: any) {
      setErroTokenInvalido(err?.message || 'Link de recuperação inválido ou expirado.');
    } finally {
      setValidandoToken(false);
    }
  };

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

  const handleRedefinirSenha = async () => {
    if (!resetToken) return;
    if (!resetNovaSenha || resetNovaSenha.length < 6) {
      setErroResetForm('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (resetNovaSenha !== resetConfirmaSenha) {
      setErroResetForm('As senhas digitadas não coincidem.');
      return;
    }
    setSalvandoReset(true);
    setErroResetForm('');
    try {
      const res = await redefinirSenhaComToken(resetToken, resetNovaSenha);
      showToast(res.mensagem || 'Senha redefinida com sucesso! Faça login com a nova senha.', 'success');
      setShowResetModal(false);
      setResetNovaSenha('');
      setResetConfirmaSenha('');
      if (usuarioReset?.email) {
        setEmail(usuarioReset.email);
      }
      history.replace('/login');
    } catch (err: any) {
      setErroResetForm(err?.message || 'Erro ao redefinir senha.');
    } finally {
      setSalvandoReset(false);
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

            <form className="login-form" autoComplete="on" onSubmit={(e) => { e.preventDefault(); handleLogin(); }}>
              <div className="login-input-group">
                <label className="login-label" htmlFor="email">E-mail</label>
                <input
                  id="email"
                  name="username"
                  className="login-input-native"
                  type="email"
                  placeholder="seu@email.com"
                  autoComplete="username"
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
                    name="password"
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
                    {mostrarSenha ? <IconEyeOff size={18} /> : <IconEye size={18} />}
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

        {/* Modal de Primeiro Acesso */}
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

        {/* Modal Interativo de Redefinição de Senha (Token) */}
        <IonModal isOpen={showResetModal} backdropDismiss={false}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', background: 'rgba(0,0,0,0.4)', padding: 20 }}>
            <div style={{ background: '#ffffff', borderRadius: 20, padding: '36px 28px', maxWidth: 440, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.18)', position: 'relative' }}>
              
              {/* Botão Fechar */}
              <button
                type="button"
                onClick={() => { setShowResetModal(false); history.replace('/login'); }}
                style={{ position: 'absolute', top: 16, right: 16, background: '#f5f5f5', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666' }}
              >
                ✕
              </button>

              {validandoToken ? (
                <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
                  <p style={{ color: '#555', fontWeight: 600 }}>Validando seu link de recuperação...</p>
                </div>
              ) : erroTokenInvalido ? (
                <div style={{ textAlign: 'center', padding: '20px 10px' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
                  <h3 style={{ color: '#c62828', margin: '0 0 10px 0', fontSize: 18, fontWeight: 700 }}>Link Expirado ou Inválido</h3>
                  <p style={{ color: '#666', fontSize: 14, lineHeight: 1.5, margin: '0 0 24px 0' }}>{erroTokenInvalido}</p>
                  <IonButton
                    expand="block"
                    shape="round"
                    color="primary"
                    onClick={() => {
                      setShowResetModal(false);
                      history.replace('/login');
                      setShowForgotAlert(true);
                    }}
                  >
                    Solicitar Novo Link
                  </IonButton>
                </div>
              ) : (
                <div>
                  <div style={{ textAlign: 'center', marginBottom: 24 }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 56, height: 56, borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', fontSize: 26, marginBottom: 12 }}>
                      🔒
                    </div>
                    <h2 style={{ margin: '0 0 6px 0', fontSize: 22, fontWeight: 800, color: '#222' }}>
                      Redefinir Senha
                    </h2>
                    <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                      {usuarioReset ? `Olá, ${usuarioReset.nome}! Escolha uma nova senha de acesso:` : 'Defina sua nova senha de acesso:'}
                    </p>
                  </div>

                  {/* Campo Nova Senha */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>
                      Nova Senha *
                    </label>
                    <div className="login-input-wrapper">
                      <input
                        className="login-input-native"
                        type={mostrarResetNova ? 'text' : 'password'}
                        placeholder="Mínimo 6 caracteres"
                        value={resetNovaSenha}
                        onChange={(e) => setResetNovaSenha(e.target.value)}
                        autoFocus
                      />
                      <button
                        className="login-toggle-senha"
                        type="button"
                        onClick={() => setMostrarResetNova(!mostrarResetNova)}
                      >
                        {mostrarResetNova ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>

                    {/* Barrinha de Força da Senha */}
                    {resetNovaSenha.length > 0 && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ display: 'flex', gap: 4, height: 5, marginBottom: 6 }}>
                          <div style={{ flex: 1, borderRadius: 3, background: forcaSenhaReset.score >= 1 ? forcaSenhaReset.cor : '#e0e0e0', transition: 'background 0.3s' }} />
                          <div style={{ flex: 1, borderRadius: 3, background: forcaSenhaReset.score >= 2 ? forcaSenhaReset.cor : '#e0e0e0', transition: 'background 0.3s' }} />
                          <div style={{ flex: 1, borderRadius: 3, background: forcaSenhaReset.score >= 3 ? forcaSenhaReset.cor : '#e0e0e0', transition: 'background 0.3s' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11 }}>
                          <span style={{ color: '#777' }}>Força da Senha:</span>
                          <span style={{ fontWeight: 700, color: forcaSenhaReset.cor }}>
                            {forcaSenhaReset.rotulo}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Campo Confirme a Senha */}
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#444', marginBottom: 6 }}>
                      Confirme a Nova Senha *
                    </label>
                    <div className="login-input-wrapper">
                      <input
                        className="login-input-native"
                        type={mostrarResetConfirma ? 'text' : 'password'}
                        placeholder="Repita a nova senha"
                        value={resetConfirmaSenha}
                        onChange={(e) => setResetConfirmaSenha(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRedefinirSenha(); } }}
                      />
                      <button
                        className="login-toggle-senha"
                        type="button"
                        onClick={() => setMostrarResetConfirma(!mostrarResetConfirma)}
                      >
                        {mostrarResetConfirma ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>

                    {/* Indicador de Coincidência */}
                    {resetConfirmaSenha.length > 0 && (
                      <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                        {resetNovaSenha === resetConfirmaSenha ? (
                          <span style={{ color: '#2e7d32' }}>✓ As senhas conferem</span>
                        ) : (
                          <span style={{ color: '#e53935' }}>✕ As senhas não coincidem</span>
                        )}
                      </div>
                    )}
                  </div>

                  {erroResetForm && (
                    <div style={{ background: '#ffebee', color: '#c62828', padding: '10px 14px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
                      {erroResetForm}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleRedefinirSenha}
                    disabled={
                      salvandoReset ||
                      resetNovaSenha.length < 6 ||
                      resetNovaSenha !== resetConfirmaSenha
                    }
                    style={{
                      width: '100%',
                      height: 48,
                      borderRadius: 24,
                      background: resetNovaSenha.length >= 6 && resetNovaSenha === resetConfirmaSenha ? '#4a9e4f' : '#bdbdbd',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: 15,
                      fontWeight: 700,
                      cursor: resetNovaSenha.length >= 6 && resetNovaSenha === resetConfirmaSenha ? 'pointer' : 'not-allowed',
                      boxShadow: resetNovaSenha.length >= 6 && resetNovaSenha === resetConfirmaSenha ? '0 4px 14px rgba(74,158,79,0.35)' : 'none',
                      transition: 'all 0.2s',
                    }}
                  >
                    {salvandoReset ? 'Salvando Nova Senha...' : 'Salvar Nova Senha'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </IonModal>

        {/* Modal de Esqueci Minha Senha */}
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
              handler: async (data) => {
                const targetEmail = (data?.email || '').trim();
                if (!targetEmail) {
                  showToast('Informe o seu e-mail cadastrado.', 'warning');
                  return false;
                }
                setForgotEmail(targetEmail);
                try {
                  const res = await esqueciSenha(targetEmail);
                  showToast(res.mensagem || 'E-mail enviado! Verifique sua caixa de entrada.', 'success');
                } catch (err: any) {
                  showToast(err?.message || 'Erro ao solicitar recuperação de senha.', 'error');
                }
              },
            },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default Login;
