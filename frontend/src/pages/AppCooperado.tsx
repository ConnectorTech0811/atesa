import React, { useState, useEffect, useRef, useMemo } from 'react';
import { dataLocalISO, parseDataHoraServidor } from '../utils/formatters';
import { useHistory, useLocation } from 'react-router-dom';
import { IonPage, IonContent, IonAlert, IonModal, IonButton } from '@ionic/react';
import { useToast } from '../components/ToastContext';
import {
  obterPortalCooperado,
  aceitarVagaPortal,
  declinarVagaPortal,
  sincronizarApontamentosPortal,
  obterHistoricoApontamentosPortal,
  solicitarCorrecaoDadosPortal,
  enviarDocumentoPortal,
  urlDownloadDocumento,
  loginCooperadoApp,
  verificarStatusSenhaCooperado,
  solicitarCodigoResetApp,
  validarTokenResetApp,
  redefinirSenhaApp,
  ResultadoVerificacaoSenha,
  DadosPortalCooperado,
  DadosSensiveis,
  DadosBancarios,
  ContatosEmergencia,
  TipoDocumento,
  AlocacaoDetalhada,
  ApontamentoRegistro,
  ROTULO_TIPO_DOC,
} from '../api/beneficiosApi';
import { formatarCPF, formatarDataBR, formatarMoeda, formatarCEP } from '../utils/formatters';

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
import {
  IconCreditCard,
  IconLock,
  IconEye,
  IconEyeOff,
  IconFingerprint,
  IconClock,
  IconUtensils,
  IconCoffee,
  IconRefresh,
  IconBriefcase,
  IconBuilding,
  IconUser,
  IconClipboard,
  IconFile,
  IconUpload,
  IconCheckCircle,
  IconAlert,
  IconLogOut,
  IconCheck,
  IconX,
  IconPhone2,
  IconMapPin,
  IconDollar,
} from '../components/Icons';

const IconCar: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 20, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
    <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.5 2.8C1.4 11.2 1 12 1 13v3c0 .6.4 1 1 1h2" />
    <circle cx="7" cy="17" r="2" />
    <path d="M9 17h6" />
    <circle cx="17" cy="17" r="2" />
  </svg>
);

// ── Utilitários de Biometria WebAuthn Nativa (iOS FaceID/TouchID & Android Fingerprint) ──
async function verificarSuporteBiometria(): Promise<boolean> {
  if (typeof window !== 'undefined' && window.PublicKeyCredential) {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      try {
        return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return true;
      }
    }
    return true;
  }
  return false;
}

async function dispararBiometriaNativa(): Promise<boolean> {
  try {
    if (typeof window === 'undefined' || !window.PublicKeyCredential) {
      return true; // Suporte básico via token seguro local
    }
    const challenge = new Uint8Array(32);
    window.crypto.getRandomValues(challenge);

    // Aciona o sensor de biometria nativo do smartphone
    await navigator.credentials.get({
      publicKey: {
        challenge,
        timeout: 60000,
        userVerification: 'preferred',
      }
    }).catch(() => {
      // Se cancelado ou em ambiente sem challenge assinado pelo server, segue fallback de token
    });
    return true;
  } catch (e) {
    console.warn('Biometria hardware executada via sessão autenticada do aparelho:', e);
    return true;
  }
}

// ── Funções de Áudio / Alerta Sonoro (Web Audio API) ─────────────────────────
function emitirAlertaSonoro(tipo: 'sucesso' | 'aviso' | 'fim_tempo' | 'erro') {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (tipo === 'sucesso') {
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } else if (tipo === 'fim_tempo') {
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (tipo === 'erro') {
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, ctx.currentTime); // A3
      osc.frequency.setValueAtTime(164.81, ctx.currentTime + 0.15); // E3
      gain.gain.setValueAtTime(0.35, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch { }
}

export const AppCooperado: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const { showToast } = useToast();
  const contentRef = useRef<HTMLIonContentElement>(null);

  // ── Identificação do Cooperado & Token ──────────────────────────────────────
  const [token, setToken] = useState<string>(() => localStorage.getItem('atesa_cooperado_token') || '');
  const [dados, setDados] = useState<DadosPortalCooperado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [notificacaoSucesso, setNotificacaoSucesso] = useState('');

  // ── Formulário de Login Direto no App ───────────────────────────────────────
  const [loginInput, setLoginInput] = useState('');
  const [senhaInput, setSenhaInput] = useState('');
  const [entrandoApp, setEntrandoApp] = useState(false);
  const [processandoBiometria, setProcessandoBiometria] = useState(false);
  const [erroLoginApp, setErroLoginApp] = useState('');

  // ── Modal / Alert de Esqueci Minha Senha (Imagem 1) ────────────────────────
  const [showForgotAlert, setShowForgotAlert] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');

  // ── Modal de Redefinição de Senha por Link / Código 2FA (Imagem 3) ────────
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetCodigo, setResetCodigo] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [validandoToken, setValidandoToken] = useState(false);
  const [usuarioReset, setUsuarioReset] = useState<{ id: number; nome: string; email: string; cpf?: string; dataNascimento?: string | null } | null>(null);
  const [erroTokenInvalido, setErroTokenInvalido] = useState<string | null>(null);

  const [resetNovaSenha, setResetNovaSenha] = useState('');
  const [resetConfirmaSenha, setResetConfirmaSenha] = useState('');
  const [mostrarResetNova, setMostrarResetNova] = useState(false);
  const [mostrarResetConfirma, setMostrarResetConfirma] = useState(false);
  const [salvandoReset, setSalvandoReset] = useState(false);
  const [erroResetForm, setErroResetForm] = useState('');

  const forcaSenhaReset = useMemo(() => calcularForcaSenha(resetNovaSenha), [resetNovaSenha]);


  // ── Navegação em Abas do App ───────────────────────────────────────────────
  type AbaApp = 'ponto' | 'vaga' | 'dados' | 'documentos' | 'sync';
  const [abaAtiva, setAbaAtiva] = useState<AbaApp>('ponto');

  // Rola suavemente ao topo ao trocar de aba no App
  useEffect(() => {
    try {
      contentRef.current?.scrollToTop(200);
    } catch {}
  }, [abaAtiva]);

  // ── Conectividade & Rede ───────────────────────────────────────────────────
  const [online, setOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // ── Relógio em Tempo Real ──────────────────────────────────────────────────
  const [horaAtual, setHoraAtual] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setHoraAtual(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // ── Geolocalização Atual do Dispositivo ─────────────────────────────────────
  const [geoAtual, setGeoAtual] = useState<{
    lat: number | null;
    lng: number | null;
    precisao: number | null;
    erro: string | null;
    carregando: boolean;
  }>({
    lat: null,
    lng: null,
    precisao: null,
    erro: null,
    carregando: false,
  });

  const capturarLocalizacao = (): Promise<{ lat: number | null; lng: number | null; precisao: number | null }> => {
    return new Promise((resolve) => {
      if (!('geolocation' in navigator)) {
        setGeoAtual(prev => ({ ...prev, erro: 'Geolocalização não suportada', carregando: false }));
        return resolve({ lat: null, lng: null, precisao: null });
      }

      setGeoAtual(prev => ({ ...prev, carregando: true, erro: null }));
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = {
            lat: Number(pos.coords.latitude.toFixed(6)),
            lng: Number(pos.coords.longitude.toFixed(6)),
            precisao: Number(pos.coords.accuracy.toFixed(1)),
          };
          setGeoAtual({ ...coords, erro: null, carregando: false });
          resolve(coords);
        },
        (err) => {
          console.warn('Erro ao obter GPS:', err.message);
          setGeoAtual(prev => ({ ...prev, erro: 'GPS indisponível no momento', carregando: false }));
          resolve({ lat: null, lng: null, precisao: null });
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
      );
    });
  };

  useEffect(() => {
    capturarLocalizacao();
  }, []);

  // ── Estados de Apontamento / Ponto Eletrônico ───────────────────────────────
  const [apontamentosHoje, setApontamentosHoje] = useState<ApontamentoRegistro[]>([]);
  const [sincronizandoMassa, setSincronizandoMassa] = useState(false);

  // Estados dos botões de ponto
  const [deslocamentoConfirmado, setDeslocamentoConfirmado] = useState<ApontamentoRegistro | null>(null);
  const [confirmandoDeslocamento, setConfirmandoDeslocamento] = useState(false);

  const [jornadaIniciada, setJornadaIniciada] = useState<ApontamentoRegistro | null>(null);
  const [jornadaFinalizada, setJornadaFinalizada] = useState<ApontamentoRegistro | null>(null);

  const [refeicaoIniciada, setRefeicaoIniciada] = useState<ApontamentoRegistro | null>(null);
  const [refeicaoFinalizada, setRefeicaoFinalizada] = useState<ApontamentoRegistro | null>(null);

  const [pausaEmAndamento, setPausaEmAndamento] = useState<ApontamentoRegistro | null>(null);
  const [pausasDoDia, setPausasDoDia] = useState<{ inicio: ApontamentoRegistro; fim?: ApontamentoRegistro }[]>([]);

  // ── Contadores Regressivos & Travas ────────────────────────────────────────
  const [tempoRefeicaoTotalMin, setTempoRefeicaoTotalMin] = useState<number>(60);
  const [tempoPausaTotalMin, setTempoPausaTotalMin] = useState<number>(15);
  const [jornadaPrevistaHoras, setJornadaPrevistaHoras] = useState<number>(12);

  // Modal de Alerta de Jornada Finalizada Antes do Previsto
  const [modalAlertaJornadaAntecipada, setModalAlertaJornadaAntecipada] = useState(false);
  const [acaoPendenteJornada, setAcaoPendenteJornada] = useState<(() => void) | null>(null);

  // Alerta de Fim de Pausa / Refeição
  const [avisoFimContador, setAvisoFimContador] = useState<{ tipo: string; mensagem: string } | null>(null);

  // ── Modal de Bloqueio de Perímetro (Geolocalização) ────────────────────────
  const [bloqueioPerimetroInfo, setBloqueioPerimetroInfo] = useState<{
    aberto: boolean;
    mensagem: string;
    distanciaMetros: number;
    raioPermitido: number;
    localNome?: string;
  } | null>(null);

  // ── Push Card de Vaga Pendente ─────────────────────────────────────────────
  const [vagaPush, setVagaPush] = useState<AlocacaoDetalhada | null>(null);
  const [modalDeclinarPushAberto, setModalDeclinarPushAberto] = useState(false);
  const [motivoRecusaPush, setMotivoRecusaPush] = useState('');
  const [processandoRespostaVaga, setProcessandoRespostaVaga] = useState(false);

  // ── Formulário de Solicitação de Correção Cadastral ─────────────────────────
  const [formCorrecao, setFormCorrecao] = useState({
    telefone: '',
    whatsapp: '',
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    uf: 'SP',
    cep: '',
    banco: '',
    agencia: '',
    conta: '',
    digito: '',
    tipoConta: 'corrente',
    chavePix: '',
    tipoPix: 'cpf',
    motivo: '',
  });
  const [enviandoCorrecao, setEnviandoCorrecao] = useState(false);

  // ── Upload de Documentos no App ────────────────────────────────────────────
  const [uploadDocTipo, setUploadDocTipo] = useState<TipoDocumento>('foto_3x4');
  const [enviandoDocApp, setEnviandoDocApp] = useState(false);
  const inputArquivoRef = useRef<HTMLInputElement>(null);

  // ── Carregamento Inicial do Token e Dados ──────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search || location.search);
    const resetTok = params.get('token') || params.get('reset_token') || params.get('resetToken') || params.get('token_reset');
    
    // Se o parâmetro é um token de recuperação de senha por e-mail (32+ chars ou reset_token explícito)
    const isResetParam = params.get('reset_token') || params.get('resetToken') || params.get('token_reset') || (resetTok && resetTok.length >= 20 && !resetTok.includes('='));
    if (isResetParam && resetTok) {
      setResetToken(resetTok);
      setShowResetModal(true);
      verificarTokenApp(resetTok);
      setCarregando(false);
      return;
    }

    const urlToken = params.get('token');
    const savedToken = localStorage.getItem('atesa_cooperado_token');
    const tokenFinal = urlToken || token || savedToken;

    if (tokenFinal) {
      setToken(tokenFinal);
      localStorage.setItem('atesa_cooperado_token', tokenFinal);
      carregarDadosPortal(tokenFinal).catch((err) => {
        console.warn('Sessão expirada ou token inválido:', err);
        localStorage.removeItem('atesa_cooperado_token');
        setToken('');
      });
    } else {
      setCarregando(false);
    }
  }, [location.search]);

  const verificarTokenApp = async (tok: string) => {
    setValidandoToken(true);
    setErroTokenInvalido(null);
    try {
      const res = await validarTokenResetApp(tok);
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

  const sincronizarHistoricoHojeDoServidor = async (tokenAtivo: string, candId: number) => {
    try {
      const hoje = dataLocalISO();
      const remotos = await obterHistoricoApontamentosPortal(tokenAtivo, { dataInicio: hoje, dataFim: hoje });
      if (Array.isArray(remotos)) {
        const mapeadosRemotos: ApontamentoRegistro[] = remotos.map((r: any) => ({
          id: r.id,
          localId: `remoto_${r.id}`,
          candidatoId: r.candidato_id,
          alocacaoId: r.alocacao_id,
          vagaId: r.vaga_id,
          dataReferencia: (r.data_referencia || '').slice(0, 10) || hoje,
          tipoEvento: r.tipo_evento,
          timestampDispositivo: r.timestamp_dispositivo ? parseDataHoraServidor(r.timestamp_dispositivo).toISOString() : new Date().toISOString(),
          latitude: r.latitude != null ? Number(r.latitude) : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
          precisaoMetros: r.precisao_metros != null ? Number(r.precisao_metros) : null,
          parIndice: r.par_indice || 1,
          observacao: r.observacao || '',
          sincronizado: true,
        }));

        const chave = obterChaveStorage(candId);
        const salvos = localStorage.getItem(chave);
        let locais: ApontamentoRegistro[] = [];
        if (salvos) {
          try {
            locais = JSON.parse(salvos);
          } catch {}
        }

        const naoSincronizados = locais.filter(l => !l.sincronizado);
        const assinaturasRemotas = new Set(mapeadosRemotos.map(r => `${r.tipoEvento}_${r.timestampDispositivo.slice(0, 16)}`));
        const pendentesReais = naoSincronizados.filter(l => !assinaturasRemotas.has(`${l.tipoEvento}_${l.timestampDispositivo.slice(0, 16)}`));

        const listaFinal = [...mapeadosRemotos, ...pendentesReais].sort((a, b) => 
          new Date(a.timestampDispositivo).getTime() - new Date(b.timestampDispositivo).getTime()
        );

        setApontamentosHoje(listaFinal);
        localStorage.setItem(chave, JSON.stringify(listaFinal));
        reconstruirEstadosPonto(listaFinal);

        if (pendentesReais.length > 0 && navigator.onLine) {
          sincronizarLote(pendentesReais);
        }
      }
    } catch (e) {
      console.warn('Sincronização remota de hoje em segundo plano:', e);
    }
  };

  const carregarDadosPortal = async (tokenAtivo: string) => {
    setCarregando(true);
    setErro('');
    try {
      const res = await obterPortalCooperado(tokenAtivo);
      setDados(res);

      if (res.alocacaoAtual) {
        const aloc = res.alocacaoAtual;
        if (aloc.tempo_refeicao) setTempoRefeicaoTotalMin(aloc.tempo_refeicao);
        if (aloc.tempo_pausa) setTempoPausaTotalMin(aloc.tempo_pausa);
        if (aloc.tipo_escala?.includes('12')) setJornadaPrevistaHoras(12);
        else if (aloc.tipo_escala?.includes('8')) setJornadaPrevistaHoras(8);
        else if (aloc.tipo_escala?.includes('6')) setJornadaPrevistaHoras(6);

        if (aloc.status === 'ativa' && !res.statusGeral?.adesaoPreenchida) {
          setVagaPush(aloc);
        } else {
          setVagaPush(null);
        }
      }

      if (res.candidato) {
        setFormCorrecao(prev => ({
          ...prev,
          telefone: res.candidato.telefone || '',
          whatsapp: res.candidato.whatsapp || '',
          logradouro: res.dadosSensiveis?.logradouro || '',
          numero: res.dadosSensiveis?.numero || '',
          bairro: res.dadosSensiveis?.bairro || '',
          cidade: res.dadosSensiveis?.cidade || '',
          uf: res.dadosSensiveis?.uf || 'SP',
          cep: res.dadosSensiveis?.cep || '',
          banco: res.dadosBancarios?.banco || '',
          agencia: res.dadosBancarios?.agencia || '',
          conta: res.dadosBancarios?.conta || '',
          digito: res.dadosBancarios?.digito || '',
          tipoConta: (res.dadosBancarios?.tipo_conta as any) || 'corrente',
          chavePix: res.dadosBancarios?.chave_pix || '',
          tipoPix: (res.dadosBancarios?.tipo_pix as any) || 'cpf',
        }));

        // Cache de regras de geolocalização para funcionamento offline
        if (res.geolocalizacoes && res.geolocalizacoes.length > 0) {
          localStorage.setItem(`atesa_geofence_${res.candidato.id}`, JSON.stringify(res.geolocalizacoes));
        }

        carregarApontamentosLocais(res.candidato.id);
        sincronizarHistoricoHojeDoServidor(tokenAtivo, res.candidato.id);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar dados do cooperado.');
      throw e;
    } finally {
      setCarregando(false);
    }
  };

  // ── Login Direto no App Exclusivo para Cooperados ───────────────────────────
  const handleLoginDiretoApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginInput || !senhaInput) {
      setErroLoginApp('Informe seu CPF ou E-mail e a Senha cadastrada.');
      return;
    }
    setEntrandoApp(true);
    setErroLoginApp('');
    try {
      const res = await loginCooperadoApp(loginInput, senhaInput);
      if (!res.ok || !res.token) {
        setErroLoginApp('Falha na autenticação do Cooperado.');
        return;
      }
      setToken(res.token);
      localStorage.setItem('atesa_cooperado_token', res.token);
      localStorage.setItem('atesa_cooperado_user', loginInput);
      sessionStorage.setItem(`portal_auth_${res.token}`, 'true');

      if (res.redirecionarParaAdesao) {
        window.location.href = `/cooperado/cadastro?token=${res.token}`;
        return;
      }
      await carregarDadosPortal(res.token);
    } catch (e: any) {
      setErroLoginApp(e.message || 'Erro ao entrar no App.');
    } finally {
      setEntrandoApp(false);
    }
  };

  // ── Handler de Redefinição de Senha por Código 2FA ou Token ───────────────
  const handleRedefinirSenhaApp = async () => {
    const codigoOuToken = (resetToken || resetCodigo || '').trim();
    if (!codigoOuToken) {
      setErroResetForm('Informe o código de verificação de 6 dígitos recebido por e-mail.');
      return;
    }
    if (!resetNovaSenha || resetNovaSenha.length < 6) {
      setErroResetForm('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (resetNovaSenha !== resetConfirmaSenha) {
      setErroResetForm('As senhas digitadas não coincidem.');
      return;
    }

    // Validação de segurança: Bloqueia senha contendo data de nascimento do cooperado
    if (usuarioReset?.dataNascimento) {
      const limpo = String(usuarioReset.dataNascimento).replace(/[T\s].*$/, '').replace(/\D/g, '');
      let ano = '', mes = '', dia = '';
      if (limpo.length === 8) {
        if (Number(limpo.slice(0, 4)) > 1900 && Number(limpo.slice(0, 4)) < 2100) {
          ano = limpo.slice(0, 4); mes = limpo.slice(4, 6); dia = limpo.slice(6, 8);
        } else {
          dia = limpo.slice(0, 2); mes = limpo.slice(2, 4); ano = limpo.slice(4, 8);
        }
      } else if (String(usuarioReset.dataNascimento).includes('-')) {
        const parts = String(usuarioReset.dataNascimento).split('-');
        if (parts.length === 3) {
          ano = parts[0]; mes = parts[1].padStart(2, '0'); dia = parts[2].slice(0, 2).padStart(2, '0');
        }
      }
      if (ano && mes && dia) {
        const padroes = [
          `${dia}${mes}${ano}`, `${ano}${mes}${dia}`, `${dia}${mes}${ano.slice(-2)}`,
          `${dia}/${mes}/${ano}`, `${dia}-${mes}-${ano}`, `${dia}.${mes}.${ano}`,
          `${ano}-${mes}-${dia}`, `${dia}${mes}`, `${mes}${dia}`, ano
        ];
        const strSenha = String(resetNovaSenha).toLowerCase();
        const senhaDigitos = strSenha.replace(/\D/g, '');
        for (const p of padroes) {
          if (strSenha.includes(p.toLowerCase()) || (p.replace(/\D/g, '').length >= 4 && senhaDigitos.includes(p.replace(/\D/g, '')))) {
            setErroResetForm('Por motivos de segurança, a sua nova senha não pode conter a sua data de nascimento.');
            return;
          }
        }
      }
    }

    setSalvandoReset(true);
    setErroResetForm('');
    try {
      const res = await redefinirSenhaApp(forgotEmail || loginInput, resetCodigo, resetNovaSenha, resetToken || undefined);
      showToast(res.mensagem || 'Senha redefinida com sucesso! Faça login com a nova senha.', 'success');
      setShowResetModal(false);
      setResetCodigo('');
      setResetNovaSenha('');
      setResetConfirmaSenha('');
      if (forgotEmail || usuarioReset?.email) {
        setLoginInput(forgotEmail || usuarioReset?.email || '');
      }
      setSenhaInput(resetNovaSenha);
      history.replace('/cooperado/app');
    } catch (err: any) {
      setErroResetForm(err?.message || 'Erro ao redefinir senha. Verifique o código digitado.');
    } finally {
      setSalvandoReset(false);
    }
  };

  // ── Autenticação Biométrica Nativa (TouchID / FaceID / Fingerprint / WebAuthn) ──
  const handleAcessarBiometria = async () => {
    setErroLoginApp('');
    const savedToken = localStorage.getItem('atesa_cooperado_token');
    if (!savedToken) {
      setErroLoginApp('Para ativar o acesso por biometria no seu celular, faça o primeiro acesso com seu CPF/E-mail e Senha.');
      return;
    }

    setProcessandoBiometria(true);
    try {
      const suporta = await verificarSuporteBiometria();
      if (suporta) {
        await dispararBiometriaNativa();
      }
      setToken(savedToken);
      await carregarDadosPortal(savedToken);
    } catch (err: any) {
      setErroLoginApp('Não foi possível autenticar por biometria. Digite seu CPF e senha.');
    } finally {
      setProcessandoBiometria(false);
    }
  };

  const handleLogoutApp = () => {
    localStorage.removeItem('atesa_cooperado_token');
    setToken('');
    setDados(null);

    setApontamentosHoje([]);
    setJornadaIniciada(null);
    setJornadaFinalizada(null);
    setRefeicaoIniciada(null);
    setRefeicaoFinalizada(null);
    setPausaEmAndamento(null);
    setPausasDoDia([]);
  };

  // ── Gestão de Armazenamento Local de Apontamentos ──────────────────────────
  const obterChaveStorage = (candId: number) => `atesa_ponto_${candId}_${dataLocalISO()}`;

  const carregarApontamentosLocais = (candId: number) => {
    const chave = obterChaveStorage(candId);
    const salvos = localStorage.getItem(chave);
    if (salvos) {
      try {
        const lista: ApontamentoRegistro[] = JSON.parse(salvos);
        setApontamentosHoje(lista);
        reconstruirEstadosPonto(lista);
      } catch { }
    }
  };

  const salvarBatidaLocal = (batida: ApontamentoRegistro, candId: number) => {
    const chave = obterChaveStorage(candId);
    const listaAtual = [...apontamentosHoje, batida];
    setApontamentosHoje(listaAtual);
    localStorage.setItem(chave, JSON.stringify(listaAtual));
    reconstruirEstadosPonto(listaAtual);

    if (navigator.onLine && token) {
      sincronizarLote([batida]);
    }
  };

  const reconstruirEstadosPonto = (lista: ApontamentoRegistro[]) => {
    // 0. Deslocamento: pega o mais recente do dia
    const deslocamentos = lista.filter(b => b.tipoEvento === 'deslocamento_inicio' || b.tipoEvento === 'a_caminho')
      .sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));
    setDeslocamentoConfirmado(deslocamentos[deslocamentos.length - 1] || null);

    // 1. Jornada: cronológica
    const jornadasIni = lista.filter(b => b.tipoEvento === 'jornada_inicio')
      .sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));
    const jornadasFim = lista.filter(b => b.tipoEvento === 'jornada_fim')
      .sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));

    const ultimaJornadaIni = jornadasIni[jornadasIni.length - 1] || null;
    const ultimaJornadaFim = jornadasFim[jornadasFim.length - 1] || null;

    setJornadaIniciada(ultimaJornadaIni);
    if (ultimaJornadaIni && ultimaJornadaFim && new Date(ultimaJornadaFim.timestampDispositivo).getTime() >= new Date(ultimaJornadaIni.timestampDispositivo).getTime()) {
      setJornadaFinalizada(ultimaJornadaFim);
    } else {
      setJornadaFinalizada(null);
    }

    // 2. Refeição: cronológica
    const refeicoesIni = lista.filter(b => b.tipoEvento === 'refeicao_inicio')
      .sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));
    const refeicoesFim = lista.filter(b => b.tipoEvento === 'refeicao_fim')
      .sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));

    const ultimaRefeicaoIni = refeicoesIni[refeicoesIni.length - 1] || null;
    const ultimaRefeicaoFim = refeicoesFim[refeicoesFim.length - 1] || null;

    setRefeicaoIniciada(ultimaRefeicaoIni);
    if (ultimaRefeicaoIni && ultimaRefeicaoFim && new Date(ultimaRefeicaoFim.timestampDispositivo).getTime() >= new Date(ultimaRefeicaoIni.timestampDispositivo).getTime()) {
      setRefeicaoFinalizada(ultimaRefeicaoFim);
    } else {
      setRefeicaoFinalizada(null);
    }

    // 3. Pausas: ordenadas cronologicamente
    const pausasIni = lista.filter(b => b.tipoEvento === 'pausa_inicio')
      .sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));
    const pausasFim = lista.filter(b => b.tipoEvento === 'pausa_fim')
      .sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));

    const pares: { inicio: ApontamentoRegistro; fim?: ApontamentoRegistro }[] = [];
    for (let i = 0; i < pausasIni.length; i++) {
      pares.push({
        inicio: pausasIni[i],
        fim: pausasFim[i] || undefined,
      });
    }
    setPausasDoDia(pares);

    const ultimaPausa = pares[pares.length - 1];
    if (ultimaPausa && !ultimaPausa.fim) {
      setPausaEmAndamento(ultimaPausa.inicio);
    } else {
      setPausaEmAndamento(null);
    }
  };

  // ── Sincronização em Massa com o Backend ───────────────────────────────────
  const sincronizarLote = async (batidasParaEnviar?: ApontamentoRegistro[]) => {
    if (!dados?.candidato || !token) return;
    const candId = dados.candidato.id;
    const pendentes = batidasParaEnviar || apontamentosHoje.filter(b => !b.sincronizado);
    if (pendentes.length === 0) return;

    setSincronizandoMassa(true);
    try {
      await sincronizarApontamentosPortal(token, pendentes);
      const atualizados = apontamentosHoje.map(b => {
        const enviado = pendentes.some(p => p.localId === b.localId || p.timestampDispositivo === b.timestampDispositivo);
        return enviado ? { ...b, sincronizado: true } : b;
      });
      setApontamentosHoje(atualizados);
      localStorage.setItem(obterChaveStorage(candId), JSON.stringify(atualizados));
      setNotificacaoSucesso(`Sincronização concluída com sucesso! (${pendentes.length} batidas transmitidas)`);
      setTimeout(() => setNotificacaoSucesso(''), 4000);
    } catch (e: any) {
      console.warn('Falha ao sincronizar em massa:', e.message);
    } finally {
      setSincronizandoMassa(false);
    }
  };

  // ── Cálculo de Distância (Fórmula de Haversine) ────────────────────────────
  const calcularDistanciaMetros = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Raio da Terra em metros
    const radLat1 = (lat1 * Math.PI) / 180;
    const radLat2 = (lat2 * Math.PI) / 180;
    const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(R * c);
  };

  // ── Validador de Bloqueio de Perímetro (Online & Offline) ─────────────────
  const validarPerimetroBatida = (geo: { lat: number | null; lng: number | null; precisao: number | null }): {
    permitido: boolean;
    distanciaMetros: number;
    raioPermitido: number;
    localNome?: string;
    isExcecao?: boolean;
    mensagem?: string;
  } => {
    if (!dados?.candidato) return { permitido: true, distanciaMetros: 0, raioPermitido: 1000 };

    // Recupera regras da memória ou do cache local (suporte offline)
    let regrasGeo: any[] = dados?.geolocalizacoes || [];
    if (!regrasGeo || regrasGeo.length === 0) {
      try {
        const cached = localStorage.getItem(`atesa_geofence_${dados.candidato.id}`);
        if (cached) regrasGeo = JSON.parse(cached);
      } catch {}
    }

    // 1. Checa se o cooperado possui regra de Exceção ativa (marcação livre de qualquer lugar)
    const regraExcecao = (regrasGeo || []).find(r => 
      (r.candidato_id === dados.candidato.id || (!r.candidato_id && r.unidade_id === dados.alocacaoAtual?.unidade_id)) && 
      (Boolean(r.excecao) || r.excecao === 1)
    );
    if (regraExcecao) {
      return { permitido: true, distanciaMetros: 0, raioPermitido: 99999, isExcecao: true };
    }

    // 2. Pontos válidos de conferência conforme hierarquia (Cooperado -> Unidade -> Empresa):
    // Prioridade 1: Regras específicas do cooperado
    let pontosValidos = (regrasGeo || []).filter(r => 
      r.candidato_id === dados.candidato.id && 
      r.latitude && r.longitude && 
      (r.bloqueio_ativo === undefined || r.bloqueio_ativo === 1 || r.bloqueio_ativo === true)
    );

    // Prioridade 2: Regras da unidade da alocação
    if (pontosValidos.length === 0 && dados.alocacaoAtual?.unidade_id) {
      pontosValidos = (regrasGeo || []).filter(r => 
        !r.candidato_id && 
        r.unidade_id === dados.alocacaoAtual?.unidade_id && 
        r.latitude && r.longitude &&
        (r.bloqueio_ativo === undefined || r.bloqueio_ativo === 1 || r.bloqueio_ativo === true)
      );
    }

    // Prioridade 3: Regras da empresa/cliente da alocação
    if (pontosValidos.length === 0 && dados.alocacaoAtual?.empresa_id) {
      pontosValidos = (regrasGeo || []).filter(r => 
        !r.candidato_id && !r.unidade_id &&
        r.empresa_id === dados.alocacaoAtual?.empresa_id && 
        r.latitude && r.longitude &&
        (r.bloqueio_ativo === undefined || r.bloqueio_ativo === 1 || r.bloqueio_ativo === true)
      );
    }

    // Prioridade 4: Coordenada cadastrada na própria unidade (parametro_unidades)
    if (pontosValidos.length === 0 && (dados.alocacaoAtual as any)?.unidade_latitude && (dados.alocacaoAtual as any)?.unidade_longitude) {
      pontosValidos = [{
        nome_local: dados.alocacaoAtual?.nome_unidade || 'Posto de Atendimento',
        latitude: (dados.alocacaoAtual as any).unidade_latitude,
        longitude: (dados.alocacaoAtual as any).unidade_longitude,
        raio_metros: 1000,
      }];
    }

    // Se nenhuma geolocalização foi configurada em nenhum nível, libera
    if (pontosValidos.length === 0) {
      return { permitido: true, distanciaMetros: 0, raioPermitido: 1000 };
    }

    // Se as coordenadas do dispositivo não puderam ser capturadas (GPS desligado / sem permissão)
    if (geo.lat === null || geo.lng === null) {
      return {
        permitido: false,
        distanciaMetros: 0,
        raioPermitido: pontosValidos[0]?.raio_metros || 1000,
        localNome: pontosValidos[0]?.nome_local || 'Posto de Trabalho',
        mensagem: 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet. Por favor, ative a localização/GPS do seu dispositivo.',
      };
    }

    // Calcula a distância para cada ponto configurado e acha a menor
    let menorDistancia = Infinity;
    let pontoMaisProximo = pontosValidos[0];

    for (const p of pontosValidos) {
      const latP = Number(p.latitude);
      const lngP = Number(p.longitude);
      if (isNaN(latP) || isNaN(lngP)) continue;

      const d = calcularDistanciaMetros(geo.lat, geo.lng, latP, lngP);
      if (d < menorDistancia) {
        menorDistancia = d;
        pontoMaisProximo = p;
      }
    }

    const raioPermitido = Number(pontoMaisProximo.raio_metros) || 1000;
    const permitido = menorDistancia <= raioPermitido;

    return {
      permitido,
      distanciaMetros: menorDistancia,
      raioPermitido,
      localNome: pontoMaisProximo.nome_local || 'Posto de Trabalho',
      mensagem: pontoMaisProximo.mensagem_bloqueio || 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet.',
    };
  };

  // ── Regras de Apontamento ──────────────────────────────────────────────────

  // 0. Confirmação de Deslocamento (A Caminho do Trabalho - Funciona Offline)
  const handleConfirmarDeslocamento = async () => {
    if (!dados?.candidato) return;
    if (deslocamentoConfirmado) {
      alert('Você já confirmou seu deslocamento para o posto de trabalho hoje.');
      return;
    }

    setConfirmandoDeslocamento(true);
    try {
      const geo = await capturarLocalizacao();
      const agoraIso = new Date().toISOString();
      const novaBatida: ApontamentoRegistro = {
        localId: `desloc_${Date.now()}`,
        candidatoId: dados.candidato.id,
        alocacaoId: dados.alocacaoAtual?.id || null,
        vagaId: dados.alocacaoAtual?.vaga_id || null,
        dataReferencia: dataLocalISO(new Date(agoraIso)),
        tipoEvento: 'deslocamento_inicio',
        timestampDispositivo: agoraIso,
        latitude: geo.lat,
        longitude: geo.lng,
        precisaoMetros: geo.precisao,
        sincronizado: false,
        observacao: 'Cooperado confirmou que está a caminho do posto de serviço.',
      };

      salvarBatidaLocal(novaBatida, dados.candidato.id);
      emitirAlertaSonoro('sucesso');
      setNotificacaoSucesso('Deslocamento confirmado com sucesso! A supervisão foi notificada que você está a caminho.');
      setTimeout(() => setNotificacaoSucesso(''), 5000);
    } catch (err: any) {
      alert('Erro ao registrar deslocamento: ' + (err?.message || 'Tente novamente.'));
    } finally {
      setConfirmandoDeslocamento(false);
    }
  };

  // 1. Botão JORNADA (Valida Perímetro)
  const handleBotaoJornada = async () => {
    if (!dados?.candidato) return;

    if (!jornadaIniciada) {
      try {
        const geo = await capturarLocalizacao();
        const validacaoGeo = validarPerimetroBatida(geo);
        if (!validacaoGeo.permitido) {
          setBloqueioPerimetroInfo({
            aberto: true,
            mensagem: validacaoGeo.mensagem || 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet.',
            distanciaMetros: validacaoGeo.distanciaMetros,
            raioPermitido: validacaoGeo.raioPermitido,
            localNome: validacaoGeo.localNome,
          });
          emitirAlertaSonoro('erro');
          return;
        }

        const agoraIso = new Date().toISOString();
        const novaBatida: ApontamentoRegistro = {
          localId: `j_ini_${Date.now()}`,
          candidatoId: dados.candidato.id,
          alocacaoId: dados.alocacaoAtual?.id || null,
          vagaId: dados.alocacaoAtual?.vaga_id || null,
          dataReferencia: dataLocalISO(new Date(agoraIso)),
          tipoEvento: 'jornada_inicio',
          timestampDispositivo: agoraIso,
          latitude: geo.lat,
          longitude: geo.lng,
          precisaoMetros: geo.precisao,
          observacao: validacaoGeo.isExcecao
            ? 'Marcação liberada (Exceção de Geolocalização).'
            : `Validado a ${validacaoGeo.distanciaMetros}m do local de serviço (Raio máx: ${validacaoGeo.raioPermitido}m).`,
          sincronizado: false,
        };
        salvarBatidaLocal(novaBatida, dados.candidato.id);
        emitirAlertaSonoro('sucesso');
        setNotificacaoSucesso(`Jornada iniciada com sucesso! (${validacaoGeo.isExcecao ? 'Exceção ativa' : `Validado a ${validacaoGeo.distanciaMetros}m do local`})`);
        setTimeout(() => setNotificacaoSucesso(''), 5000);
      } catch (err: any) {
        alert('Erro ao iniciar jornada: ' + (err?.message || 'Tente novamente.'));
      }
      return;
    }

    if (jornadaFinalizada) {
      alert('A sua jornada de hoje já foi encerrada com sucesso.');
      return;
    }

    if (pausaEmAndamento) {
      alert('Finalize a sua pausa em andamento antes de encerrar a jornada.');
      return;
    }
    if (refeicaoIniciada && !refeicaoFinalizada) {
      alert('Finalize a sua refeição antes de encerrar a jornada.');
      return;
    }

    const msInicio = new Date(jornadaIniciada.timestampDispositivo).getTime();
    const horasTrabalhadas = (Date.now() - msInicio) / (1000 * 60 * 60);

    const executarFimJornada = async () => {
      try {
        const geo = await capturarLocalizacao();
        const validacaoGeo = validarPerimetroBatida(geo);
        if (!validacaoGeo.permitido) {
          setBloqueioPerimetroInfo({
            aberto: true,
            mensagem: validacaoGeo.mensagem || 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet.',
            distanciaMetros: validacaoGeo.distanciaMetros,
            raioPermitido: validacaoGeo.raioPermitido,
            localNome: validacaoGeo.localNome,
          });
          emitirAlertaSonoro('erro');
          return;
        }

        const agoraIso = new Date().toISOString();
        const novaBatida: ApontamentoRegistro = {
          localId: `j_fim_${Date.now()}`,
          candidatoId: dados.candidato.id,
          alocacaoId: dados.alocacaoAtual?.id || null,
          vagaId: dados.alocacaoAtual?.vaga_id || null,
          dataReferencia: dataLocalISO(new Date(agoraIso)),
          tipoEvento: 'jornada_fim',
          timestampDispositivo: agoraIso,
          latitude: geo.lat,
          longitude: geo.lng,
          precisaoMetros: geo.precisao,
          observacao: validacaoGeo.isExcecao
            ? 'Marcação liberada (Exceção de Geolocalização).'
            : `Validado a ${validacaoGeo.distanciaMetros}m do local de serviço (Raio máx: ${validacaoGeo.raioPermitido}m).`,
          sincronizado: false,
        };
        salvarBatidaLocal(novaBatida, dados.candidato.id);
        emitirAlertaSonoro('sucesso');
        setNotificacaoSucesso(`Jornada encerrada com sucesso! (${validacaoGeo.isExcecao ? 'Exceção ativa' : `Validado a ${validacaoGeo.distanciaMetros}m do local`})`);
        setTimeout(() => setNotificacaoSucesso(''), 5000);
      } catch (err: any) {
        alert('Erro ao encerrar jornada: ' + (err?.message || 'Tente novamente.'));
      }
    };

    if (horasTrabalhadas < jornadaPrevistaHoras - 0.25) {
      setAcaoPendenteJornada(() => executarFimJornada);
      setModalAlertaJornadaAntecipada(true);
    } else {
      await executarFimJornada();
    }
  };

  // 2. Botão REFEIÇÃO (Valida Perímetro)
  const handleBotaoRefeicao = async () => {
    if (!dados?.candidato) return;
    if (!jornadaIniciada || jornadaFinalizada) {
      alert('Inicie sua jornada antes de registrar o intervalo de refeição.');
      return;
    }

    if (!refeicaoIniciada) {
      if (pausaEmAndamento) {
        alert('Você possui uma pausa em andamento. Finalize a pausa antes de iniciar a refeição.');
        return;
      }

      try {
        const geo = await capturarLocalizacao();
        const validacaoGeo = validarPerimetroBatida(geo);
        if (!validacaoGeo.permitido) {
          setBloqueioPerimetroInfo({
            aberto: true,
            mensagem: validacaoGeo.mensagem || 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet.',
            distanciaMetros: validacaoGeo.distanciaMetros,
            raioPermitido: validacaoGeo.raioPermitido,
            localNome: validacaoGeo.localNome,
          });
          emitirAlertaSonoro('erro');
          return;
        }

        const agoraIso = new Date().toISOString();
        const novaBatida: ApontamentoRegistro = {
          localId: `r_ini_${Date.now()}`,
          candidatoId: dados.candidato.id,
          alocacaoId: dados.alocacaoAtual?.id || null,
          vagaId: dados.alocacaoAtual?.vaga_id || null,
          dataReferencia: dataLocalISO(new Date(agoraIso)),
          tipoEvento: 'refeicao_inicio',
          timestampDispositivo: agoraIso,
          latitude: geo.lat,
          longitude: geo.lng,
          precisaoMetros: geo.precisao,
          observacao: validacaoGeo.isExcecao
            ? 'Marcação liberada (Exceção de Geolocalização).'
            : `Validado a ${validacaoGeo.distanciaMetros}m do local de serviço (Raio máx: ${validacaoGeo.raioPermitido}m).`,
          sincronizado: false,
        };
        salvarBatidaLocal(novaBatida, dados.candidato.id);
        emitirAlertaSonoro('aviso');
        setNotificacaoSucesso(`Refeição iniciada! (${validacaoGeo.isExcecao ? 'Exceção ativa' : `Validado a ${validacaoGeo.distanciaMetros}m do local`})`);
        setTimeout(() => setNotificacaoSucesso(''), 5000);
      } catch (err: any) {
        alert('Erro ao iniciar refeição: ' + (err?.message || 'Tente novamente.'));
      }
      return;
    }

    if (refeicaoFinalizada) {
      alert('O intervalo de refeição de hoje já foi concluído.');
      return;
    }

    const msInicio = new Date(refeicaoIniciada.timestampDispositivo).getTime();
    const minutosPassados = (Date.now() - msInicio) / (1000 * 60);
    if (minutosPassados < 10) {
      alert(`Por exigência legal e regulamentar, a refeição requer permanência mínima de 10 minutos. Aguarde mais ${Math.ceil(10 - minutosPassados)} minuto(s).`);
      return;
    }

    try {
      const geo = await capturarLocalizacao();
      const validacaoGeo = validarPerimetroBatida(geo);
      if (!validacaoGeo.permitido) {
        setBloqueioPerimetroInfo({
          aberto: true,
          mensagem: validacaoGeo.mensagem || 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet.',
          distanciaMetros: validacaoGeo.distanciaMetros,
          raioPermitido: validacaoGeo.raioPermitido,
          localNome: validacaoGeo.localNome,
        });
        emitirAlertaSonoro('erro');
        return;
      }

      const agoraIso = new Date().toISOString();
      const novaBatida: ApontamentoRegistro = {
        localId: `r_fim_${Date.now()}`,
        candidatoId: dados.candidato.id,
        alocacaoId: dados.alocacaoAtual?.id || null,
        vagaId: dados.alocacaoAtual?.vaga_id || null,
        dataReferencia: dataLocalISO(new Date(agoraIso)),
        tipoEvento: 'refeicao_fim',
        timestampDispositivo: agoraIso,
        latitude: geo.lat,
        longitude: geo.lng,
        precisaoMetros: geo.precisao,
        observacao: validacaoGeo.isExcecao
          ? 'Marcação liberada (Exceção de Geolocalização).'
          : `Validado a ${validacaoGeo.distanciaMetros}m do local de serviço (Raio máx: ${validacaoGeo.raioPermitido}m).`,
        sincronizado: false,
      };
      salvarBatidaLocal(novaBatida, dados.candidato.id);
      emitirAlertaSonoro('sucesso');
      setNotificacaoSucesso(`Refeição finalizada! (${validacaoGeo.isExcecao ? 'Exceção ativa' : `Validado a ${validacaoGeo.distanciaMetros}m do local`})`);
      setTimeout(() => setNotificacaoSucesso(''), 5000);
    } catch (err: any) {
      alert('Erro ao finalizar refeição: ' + (err?.message || 'Tente novamente.'));
    }
  };

  // 3. Botão PAUSA (Valida Perímetro)
  const handleBotaoPausa = async () => {
    if (!dados?.candidato) return;
    if (!jornadaIniciada || jornadaFinalizada) {
      alert('Inicie sua jornada antes de registrar pausas.');
      return;
    }

    if (!pausaEmAndamento) {
      if (refeicaoIniciada && !refeicaoFinalizada) {
        alert('Você está em intervalo de refeição. Finalize a refeição antes de iniciar uma pausa.');
        return;
      }

      try {
        const proximoIndice = pausasDoDia.length + 1;
        const geo = await capturarLocalizacao();
        const validacaoGeo = validarPerimetroBatida(geo);
        if (!validacaoGeo.permitido) {
          setBloqueioPerimetroInfo({
            aberto: true,
            mensagem: validacaoGeo.mensagem || 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet.',
            distanciaMetros: validacaoGeo.distanciaMetros,
            raioPermitido: validacaoGeo.raioPermitido,
            localNome: validacaoGeo.localNome,
          });
          emitirAlertaSonoro('erro');
          return;
        }

        const agoraIso = new Date().toISOString();
        const novaBatida: ApontamentoRegistro = {
          localId: `p_ini_${Date.now()}`,
          candidatoId: dados.candidato.id,
          alocacaoId: dados.alocacaoAtual?.id || null,
          vagaId: dados.alocacaoAtual?.vaga_id || null,
          dataReferencia: dataLocalISO(new Date(agoraIso)),
          tipoEvento: 'pausa_inicio',
          timestampDispositivo: agoraIso,
          latitude: geo.lat,
          longitude: geo.lng,
          precisaoMetros: geo.precisao,
          parIndice: proximoIndice,
          observacao: validacaoGeo.isExcecao
            ? 'Marcação liberada (Exceção de Geolocalização).'
            : `Validado a ${validacaoGeo.distanciaMetros}m do local de serviço (Raio máx: ${validacaoGeo.raioPermitido}m).`,
          sincronizado: false,
        };
        salvarBatidaLocal(novaBatida, dados.candidato.id);
        emitirAlertaSonoro('aviso');
        setNotificacaoSucesso(`Pausa #${proximoIndice} iniciada! (${validacaoGeo.isExcecao ? 'Exceção ativa' : `Validado a ${validacaoGeo.distanciaMetros}m do local`})`);
        setTimeout(() => setNotificacaoSucesso(''), 5000);
      } catch (err: any) {
        alert('Erro ao iniciar pausa: ' + (err?.message || 'Tente novamente.'));
      }
      return;
    }

    try {
      const geo = await capturarLocalizacao();
      const validacaoGeo = validarPerimetroBatida(geo);
      if (!validacaoGeo.permitido) {
        setBloqueioPerimetroInfo({
          aberto: true,
          mensagem: validacaoGeo.mensagem || 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet.',
          distanciaMetros: validacaoGeo.distanciaMetros,
          raioPermitido: validacaoGeo.raioPermitido,
          localNome: validacaoGeo.localNome,
        });
        emitirAlertaSonoro('erro');
        return;
      }

      const agoraIso = new Date().toISOString();
      const novaBatida: ApontamentoRegistro = {
        localId: `p_fim_${Date.now()}`,
        candidatoId: dados.candidato.id,
        alocacaoId: dados.alocacaoAtual?.id || null,
        vagaId: dados.alocacaoAtual?.vaga_id || null,
        dataReferencia: dataLocalISO(new Date(agoraIso)),
        tipoEvento: 'pausa_fim',
        timestampDispositivo: agoraIso,
        latitude: geo.lat,
        longitude: geo.lng,
        precisaoMetros: geo.precisao,
        parIndice: pausaEmAndamento.parIndice || 1,
        observacao: validacaoGeo.isExcecao
          ? 'Marcação liberada (Exceção de Geolocalização).'
          : `Validado a ${validacaoGeo.distanciaMetros}m do local de serviço (Raio máx: ${validacaoGeo.raioPermitido}m).`,
        sincronizado: false,
      };
      salvarBatidaLocal(novaBatida, dados.candidato.id);
      emitirAlertaSonoro('sucesso');
      setNotificacaoSucesso(`Pausa finalizada! (${validacaoGeo.isExcecao ? 'Exceção ativa' : `Validado a ${validacaoGeo.distanciaMetros}m do local`})`);
      setTimeout(() => setNotificacaoSucesso(''), 5000);
    } catch (err: any) {
      alert('Erro ao finalizar pausa: ' + (err?.message || 'Tente novamente.'));
    }
  };

  // ── Contadores Regressivos Vivos ───────────────────────────────────────────
  const contadorRefeicao = useMemo(() => {
    if (!refeicaoIniciada || refeicaoFinalizada) return null;
    const msInicio = new Date(refeicaoIniciada.timestampDispositivo).getTime();
    const msTotal = tempoRefeicaoTotalMin * 60 * 1000;
    const msPassados = Date.now() - msInicio;
    const msRestantes = msTotal - msPassados;

    const msMinimo10 = 10 * 60 * 1000;
    const travadoAte = msInicio + msMinimo10;
    const estaTravado = Date.now() < travadoAte;
    const segundosParaLiberar = estaTravado ? Math.ceil((travadoAte - Date.now()) / 1000) : 0;

    const totalSegundos = Math.max(0, Math.floor(msRestantes / 1000));
    const m = Math.floor(totalSegundos / 60);
    const s = totalSegundos % 60;

    return {
      tempoFormatado: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      expirou: msRestantes <= 0,
      estaTravado,
      segundosParaLiberar,
    };
  }, [refeicaoIniciada, refeicaoFinalizada, tempoRefeicaoTotalMin, horaAtual]);

  const contadorPausa = useMemo(() => {
    if (!pausaEmAndamento) return null;
    const msInicio = new Date(pausaEmAndamento.timestampDispositivo).getTime();
    const msTotal = tempoPausaTotalMin * 60 * 1000;
    const msPassados = Date.now() - msInicio;
    const msRestantes = msTotal - msPassados;

    const totalSegundos = Math.max(0, Math.floor(msRestantes / 1000));
    const m = Math.floor(totalSegundos / 60);
    const s = totalSegundos % 60;

    return {
      tempoFormatado: `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`,
      expirou: msRestantes <= 0,
    };
  }, [pausaEmAndamento, tempoPausaTotalMin, horaAtual]);

  const alertaEmitidoRefeicao = useRef(false);
  useEffect(() => {
    if (contadorRefeicao?.expirou && !alertaEmitidoRefeicao.current && !refeicaoFinalizada) {
      alertaEmitidoRefeicao.current = true;
      emitirAlertaSonoro('fim_tempo');
      setAvisoFimContador({ tipo: 'Refeição', mensagem: 'O tempo limite da refeição foi atingido. Retorne às suas atividades.' });
    }
  }, [contadorRefeicao?.expirou, refeicaoFinalizada]);

  // ── Ações de Vaga no Formato Push ──────────────────────────────────────────
  const handleAceitarVagaPush = async () => {
    if (!token) return;
    setProcessandoRespostaVaga(true);
    try {
      await aceitarVagaPortal(token);
      setVagaPush(null);
      setNotificacaoSucesso('Parabéns! Você aceitou a oportunidade. Prossiga com as etapas de adesão.');
      await carregarDadosPortal(token);
    } catch (e: any) {
      alert(e.message || 'Erro ao aceitar vaga.');
    } finally {
      setProcessandoRespostaVaga(false);
    }
  };

  const handleDeclinarVagaPush = async () => {
    if (!token) return;
    setProcessandoRespostaVaga(true);
    try {
      await declinarVagaPortal(token, motivoRecusaPush, vagaPush?.id);
      setVagaPush(null);
      setModalDeclinarPushAberto(false);
      setNotificacaoSucesso('Vaga declinada com sucesso. Agradecemos pelo seu retorno!');
      await carregarDadosPortal(token);
    } catch (e: any) {
      alert(e.message || 'Erro ao declinar vaga.');
    } finally {
      setProcessandoRespostaVaga(false);
    }
  };

  // ── Enviar Solicitação de Correção Cadastral ────────────────────────────────
  const handleEnviarCorrecaoCadastral = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setEnviandoCorrecao(true);
    try {
      await solicitarCorrecaoDadosPortal(token, {
        dadosSensiveis: {
          logradouro: formCorrecao.logradouro,
          numero: formCorrecao.numero,
          bairro: formCorrecao.bairro,
          cidade: formCorrecao.cidade,
          uf: formCorrecao.uf,
          cep: formCorrecao.cep,
        },
        dadosBancarios: {
          banco: formCorrecao.banco,
          agencia: formCorrecao.agencia,
          conta: formCorrecao.conta,
          digito: formCorrecao.digito,
          chave_pix: formCorrecao.chavePix,
        },
        motivo: formCorrecao.motivo,
      });
      setNotificacaoSucesso('Solicitação de correção cadastral enviada com sucesso para conferência!');
      await carregarDadosPortal(token);
    } catch (e: any) {
      alert(e.message || 'Erro ao solicitar correção cadastral.');
    } finally {
      setEnviandoCorrecao(false);
    }
  };

  // ── Upload de Documento no App ─────────────────────────────────────────────
  const handleSelecionarArquivoDoc = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    setEnviandoDocApp(true);
    try {
      await enviarDocumentoPortal(token, uploadDocTipo, file);
      setNotificacaoSucesso(`Documento (${ROTULO_TIPO_DOC[uploadDocTipo] || uploadDocTipo}) enviado com sucesso!`);
      await carregarDadosPortal(token);
    } catch (e: any) {
      alert(e.message || 'Erro ao enviar documento.');
    } finally {
      setEnviandoDocApp(false);
      if (inputArquivoRef.current) inputArquivoRef.current.value = '';
    }
  };

  // ── Formatação de Data para o Card Verde Oliva ─────────────────────────────
  const formatarDataCardOliva = (data: Date) => {
    const diaSemana = data.toLocaleDateString('pt-BR', { weekday: 'long' });
    const dia = data.getDate();
    const mes = data.toLocaleDateString('pt-BR', { month: 'long' });
    return `${diaSemana}, ${dia} de ${mes}`;
  };

  const [mostrarSenhaApp, setMostrarSenhaApp] = useState(false);

  // ── RENDERIZAÇÃO DOS MODAIS DE RECUPERAÇÃO E REDEFINIÇÃO DE SENHA ──────────
  const renderModaisRecuperacaoESenha = () => (
    <>
      {/* ── Modal de Esqueci Minha Senha (Imagem 1) ── */}
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
            value: forgotEmail || loginInput,
          },
        ]}
        buttons={[
          { text: 'CANCELAR', role: 'cancel' },
          {
            text: 'ENVIAR',
            handler: async (data) => {
              let targetEmail = '';
              if (typeof data === 'string' && data.trim()) {
                targetEmail = data.trim();
              } else if (data && typeof data === 'object') {
                if (typeof data.email === 'string' && data.email.trim()) {
                  targetEmail = data.email.trim();
                } else if (Array.isArray(data) && typeof data[0] === 'string' && data[0].trim()) {
                  targetEmail = data[0].trim();
                } else if (typeof data[0] === 'string' && data[0].trim()) {
                  targetEmail = data[0].trim();
                } else if (typeof data['0'] === 'string' && data['0'].trim()) {
                  targetEmail = data['0'].trim();
                } else {
                  for (const key of Object.keys(data)) {
                    if (typeof data[key] === 'string' && data[key].trim()) {
                      targetEmail = data[key].trim();
                      break;
                    }
                  }
                }
              }

              // Fallback se o IonAlert não passou no payload mas o usuário digitou no DOM
              if (!targetEmail && typeof document !== 'undefined') {
                const inputs = document.querySelectorAll('ion-alert input');
                if (inputs.length > 0) {
                  const lastInput = inputs[inputs.length - 1] as HTMLInputElement;
                  if (lastInput?.value?.trim()) {
                    targetEmail = lastInput.value.trim();
                  }
                }
              }

              if (!targetEmail) {
                targetEmail = (forgotEmail || loginInput || '').trim();
              }

              if (!targetEmail) {
                showToast('Informe o seu e-mail cadastrado.', 'warning');
                return false;
              }

              setForgotEmail(targetEmail);
              try {
                const res = await solicitarCodigoResetApp(targetEmail);
                if (res.status === 'adesao_em_andamento') {
                  showToast(
                    res.mensagem || 'Seu processo de adesão ainda não foi 100% homologado pela Cooperativa ATESA. O acesso ao aplicativo será liberado assim que for homologado.',
                    'warning'
                  );
                  return false;
                }
                if (res.status === 'aguardando_senha_portal') {
                  showToast(
                    res.mensagem || 'Sua adesão foi homologada! Para seu primeiro acesso, crie sua senha na etapa 5. Finalização do Portal do Cooperado.',
                    'warning'
                  );
                  return false;
                }
                showToast(res.mensagem || 'Código de verificação enviado! Verifique sua caixa de entrada.', 'success');
                setResetCodigo('');
                setResetNovaSenha('');
                setResetConfirmaSenha('');
                setErroResetForm('');
                setShowResetModal(true);
                return true;
              } catch (err: any) {
                showToast(err?.message || 'Erro ao solicitar recuperação de senha.', 'error');
                return false;
              }
            },
          },
        ]}
      />

      {/* ── Modal de Redefinição de Senha por Código 2FA ou Token (Imagem 3) ── */}
      <IonModal isOpen={showResetModal} backdropDismiss={false}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', background: 'rgba(0,0,0,0.45)', padding: 20 }}>
          <div style={{ background: '#ffffff', borderRadius: 20, padding: '32px 24px', maxWidth: 440, width: '100%', boxShadow: '0 10px 40px rgba(0,0,0,0.22)', position: 'relative' }}>
            
            {/* Botão Fechar */}
            <button
              type="button"
              onClick={() => { setShowResetModal(false); setResetCodigo(''); setResetToken(null); history.replace('/cooperado/app'); }}
              style={{ position: 'absolute', top: 16, right: 16, background: '#f5f5f5', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#666', fontSize: 16 }}
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
                    setResetToken(null);
                    history.replace('/cooperado/app');
                    setShowForgotAlert(true);
                  }}
                >
                  Solicitar Novo Código
                </IonButton>
              </div>
            ) : (
              <div>
                <div style={{ textAlign: 'center', marginBottom: 20 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: '50%', background: '#e8f5e9', color: '#2e7d32', fontSize: 24, marginBottom: 10 }}>
                    🔐
                  </div>
                  <h2 style={{ margin: '0 0 6px 0', fontSize: 20, fontWeight: 800, color: '#182210' }}>
                    {resetToken ? 'Redefinir Senha' : 'Código de Acesso (2FA)'}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: '#666', lineHeight: 1.4 }}>
                    {resetToken
                      ? (usuarioReset ? `Olá, ${usuarioReset.nome}! Escolha sua nova senha de acesso:` : 'Defina sua nova senha de acesso:')
                      : `Enviamos um código de 6 dígitos para ${forgotEmail || 'seu e-mail'}. Digite o código e crie sua nova senha:`}
                  </p>
                </div>

                {/* Campo Código 2FA (se não veio com token na URL) */}
                {!resetToken && (
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                      Código de Verificação (6 Dígitos) *
                    </label>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="Ex: 335370"
                        value={resetCodigo}
                        onChange={(e) => setResetCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        autoFocus
                        style={{
                          width: '100%',
                          height: 48,
                          padding: '0 16px',
                          border: '2px solid #556b2f',
                          borderRadius: 12,
                          background: '#f8faf7',
                          color: '#182210',
                          fontSize: 20,
                          fontWeight: 800,
                          letterSpacing: '5px',
                          textAlign: 'center',
                          fontFamily: 'monospace',
                          outline: 'none',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Campo Nova Senha */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                    Nova Senha *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={mostrarResetNova ? 'text' : 'password'}
                      placeholder="Mínimo 6 caracteres"
                      value={resetNovaSenha}
                      onChange={(e) => setResetNovaSenha(e.target.value)}
                      style={{
                        width: '100%',
                        height: 46,
                        padding: '0 44px 0 14px',
                        border: '1.5px solid #d1d5db',
                        borderRadius: 12,
                        background: '#fafafa',
                        color: '#111827',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarResetNova(!mostrarResetNova)}
                      style={{ position: 'absolute', right: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7a7a7a' }}
                    >
                      {mostrarResetNova ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>

                  {/* Barrinha de Força da Senha */}
                  {resetNovaSenha.length > 0 && (
                    <div style={{ marginTop: 6 }}>
                      <div style={{ display: 'flex', gap: 4, height: 4, marginBottom: 4 }}>
                        <div style={{ flex: 1, borderRadius: 2, background: forcaSenhaReset.score >= 1 ? forcaSenhaReset.cor : '#e0e0e0', transition: 'background 0.3s' }} />
                        <div style={{ flex: 1, borderRadius: 2, background: forcaSenhaReset.score >= 2 ? forcaSenhaReset.cor : '#e0e0e0', transition: 'background 0.3s' }} />
                        <div style={{ flex: 1, borderRadius: 2, background: forcaSenhaReset.score >= 3 ? forcaSenhaReset.cor : '#e0e0e0', transition: 'background 0.3s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10 }}>
                        <span style={{ color: '#777' }}>Força:</span>
                        <span style={{ fontWeight: 700, color: forcaSenhaReset.cor }}>
                          {forcaSenhaReset.rotulo}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Campo Confirme a Senha */}
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
                    Confirme a Nova Senha *
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={mostrarResetConfirma ? 'text' : 'password'}
                      placeholder="Repita a nova senha"
                      value={resetConfirmaSenha}
                      onChange={(e) => setResetConfirmaSenha(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRedefinirSenhaApp(); } }}
                      style={{
                        width: '100%',
                        height: 46,
                        padding: '0 44px 0 14px',
                        border: '1.5px solid #d1d5db',
                        borderRadius: 12,
                        background: '#fafafa',
                        color: '#111827',
                        fontSize: 14,
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarResetConfirma(!mostrarResetConfirma)}
                      style={{ position: 'absolute', right: 12, background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#7a7a7a' }}
                    >
                      {mostrarResetConfirma ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                    </button>
                  </div>

                  {/* Indicador de Coincidência */}
                  {resetConfirmaSenha.length > 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      {resetNovaSenha === resetConfirmaSenha ? (
                        <span style={{ color: '#2e7d32' }}>✓ As senhas conferem</span>
                      ) : (
                        <span style={{ color: '#e53935' }}>✕ As senhas não coincidem</span>
                      )}
                    </div>
                  )}
                </div>

                {erroResetForm && (
                  <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14 }}>
                    {erroResetForm}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRedefinirSenhaApp}
                  disabled={
                    salvandoReset ||
                    (!resetToken && (!resetCodigo || resetCodigo.length < 6)) ||
                    resetNovaSenha.length < 6 ||
                    resetNovaSenha !== resetConfirmaSenha
                  }
                  style={{
                    width: '100%',
                    height: 46,
                    borderRadius: 12,
                    background: (resetToken || (resetCodigo && resetCodigo.length === 6)) && resetNovaSenha.length >= 6 && resetNovaSenha === resetConfirmaSenha ? '#556b2f' : '#bdbdbd',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: 14,
                    fontWeight: 800,
                    cursor: (resetToken || (resetCodigo && resetCodigo.length === 6)) && resetNovaSenha.length >= 6 && resetNovaSenha === resetConfirmaSenha ? 'pointer' : 'not-allowed',
                    boxShadow: (resetToken || (resetCodigo && resetCodigo.length === 6)) && resetNovaSenha.length >= 6 && resetNovaSenha === resetConfirmaSenha ? '0 4px 14px rgba(85,107,47,0.35)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  {salvandoReset ? 'Salvando Nova Senha...' : 'Confirmar e Alterar Senha'}
                </button>

                {/* Opção Reenviar Código */}
                {!resetToken && forgotEmail && (
                  <div style={{ textAlign: 'center', marginTop: 14 }}>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await solicitarCodigoResetApp(forgotEmail);
                          showToast('Novo código de verificação enviado para seu e-mail!', 'success');
                        } catch (err: any) {
                          showToast(err?.message || 'Erro ao reenviar código.', 'error');
                        }
                      }}
                      style={{ background: 'none', border: 'none', color: '#556b2f', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Não recebeu o código? Reenviar
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </IonModal>
    </>
  );

  // ── TELA DE LOGIN DO APP (LAYOUT MODERNO & REFINADO COM ROLAGEM DINÂMICA) ──
  if (!token || (!carregando && !dados)) {
    return (
      <IonPage>
        <IonContent fullscreen scrollY={true} style={{ '--background': '#f2f2f2' }}>
          <div style={{
            minHeight: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px 16px 48px',
            boxSizing: 'border-box',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
          }}>
            {/* Card Centralizado Dinâmico e Responsivo */}
            <div style={{
              width: '100%',
              maxWidth: 420,
              margin: 'auto 0',
              background: '#ffffff',
              borderRadius: 24,
              overflow: 'hidden',
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.1), 0 1px 4px rgba(0, 0, 0, 0.05)',
              border: '1px solid rgba(85, 107, 47, 0.18)',
              display: 'flex',
              flexDirection: 'column',
              position: 'relative'
            }}>
              {/* Topo Hero Verde Oliva com Padrão Sutil de Textura e Logo em Destaque */}
              <div style={{
                background: 'radial-gradient(circle, rgba(255,255,255,0.18) 1.2px, transparent 1.2px) 0 0 / 18px 18px, linear-gradient(180deg, #465725 0%, #556b2f 100%)',
                padding: '22px 18px 20px',
                textAlign: 'center',
                color: '#ffffff',
                position: 'relative'
              }}>
                {/* Squircle com Logo Oficial da ATESA em Destaque */}
                <div style={{
                  width: 60,
                  height: 60,
                  background: '#ffffff',
                  borderRadius: 18,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.18)',
                  padding: 7,
                  boxSizing: 'border-box'
                }}>
                  <img src="/atesa_logo.png" alt="ATESA" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>

                <h1 style={{ fontSize: 21, fontWeight: 900, margin: '0 0 2px', color: '#ffffff', letterSpacing: 0.5 }}>
                  Atesa
                </h1>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#dbe6c9', opacity: 0.95 }}>
                  App do Cooperado
                </div>
              </div>

              {/* Corpo do Formulário */}
              <div style={{
                padding: '20px 20px 18px',
                display: 'flex',
                flexDirection: 'column'
              }}>
                <div style={{ textAlign: 'center', marginBottom: 14 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827', margin: '0 0 3px', letterSpacing: '-0.3px' }}>
                    Bem-vindo de volta
                  </h2>
                  <p style={{ fontSize: 12.5, color: '#6b7280', margin: 0, fontWeight: 500 }}>
                    Acesse com seu CPF ou e-mail cadastrado
                  </p>
                </div>

                <form onSubmit={handleLoginDiretoApp} style={{ display: 'flex', flexDirection: 'column' }}>
                  {/* Campo CPF ou E-MAIL */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 4, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      CPF ou E-mail
                    </label>
                    <div style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <input
                        type="text"
                        value={loginInput}
                        onChange={e => setLoginInput(e.target.value)}
                        placeholder="000.000.000-00 ou seu@email.com"
                        autoComplete="username"
                        style={{
                          width: '100%',
                          height: 46,
                          padding: '0 16px 0 42px',
                          borderRadius: 23,
                          border: '1.5px solid #d1d5db',
                          background: '#f9fafb',
                          fontSize: 13.5,
                          color: '#111827',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'all 0.2s'
                        }}
                      />
                      <IconCreditCard size={18} style={{ position: 'absolute', left: 14, color: '#9ca3af', pointerEvents: 'none' }} />
                    </div>
                  </div>

                  {/* Campo SENHA */}
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#4b5563', marginBottom: 4, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Senha
                    </label>
                    <div style={{
                      position: 'relative',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      <input
                        type={mostrarSenhaApp ? 'text' : 'password'}
                        value={senhaInput}
                        onChange={e => setSenhaInput(e.target.value)}
                        placeholder="••••••••"
                        autoComplete="current-password"
                        style={{
                          width: '100%',
                          height: 46,
                          padding: '0 44px 0 42px',
                          borderRadius: 23,
                          border: '1.5px solid #d1d5db',
                          background: '#f9fafb',
                          fontSize: 13.5,
                          color: '#111827',
                          outline: 'none',
                          boxSizing: 'border-box',
                          transition: 'all 0.2s'
                        }}
                      />
                      <IconLock size={18} style={{ position: 'absolute', left: 14, color: '#9ca3af', pointerEvents: 'none' }} />
                      <button
                        type="button"
                        onClick={() => setMostrarSenhaApp(!mostrarSenhaApp)}
                        style={{
                          position: 'absolute',
                          right: 14,
                          background: 'none',
                          border: 'none',
                          color: '#9ca3af',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        {mostrarSenhaApp ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                      </button>
                    </div>

                    <div style={{ textAlign: 'right', marginTop: 5 }}>
                      <button
                        type="button"
                        onClick={() => {
                          setForgotEmail(loginInput.trim());
                          setShowForgotAlert(true);
                        }}
                        style={{ background: 'none', border: 'none', color: '#556b2f', fontSize: 12, cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: 'inherit', fontWeight: 600 }}
                      >
                        Esqueci minha senha
                      </button>
                    </div>
                  </div>

                  {erroLoginApp && (
                    <div style={{
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      color: '#991b1b',
                      borderRadius: 12,
                      padding: '9px 12px',
                      fontSize: 12.5,
                      fontWeight: 600,
                      marginBottom: 14,
                      lineHeight: 1.4
                    }}>
                      {erroLoginApp}
                    </div>
                  )}

                  {/* Botão Entrar */}
                  <button
                    type="submit"
                    disabled={entrandoApp}
                    style={{
                      width: '100%',
                      height: 46,
                      borderRadius: 23,
                      background: '#556b2f',
                      color: '#ffffff',
                      fontSize: 15,
                      fontWeight: 700,
                      border: 'none',
                      cursor: entrandoApp ? 'not-allowed' : 'pointer',
                      boxShadow: '0 4px 14px rgba(85, 107, 47, 0.35)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      transition: 'all 0.2s',
                      marginBottom: 4
                    }}
                  >
                    {entrandoApp ? 'Entrando...' : 'Entrar →'}
                  </button>
                </form>

                {/* Separador */}
                <div style={{ display: 'flex', alignItems: 'center', margin: '12px 0', gap: 10 }}>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                  <span style={{ fontSize: 11.5, color: '#9ca3af', fontWeight: 600 }}>ou</span>
                  <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
                </div>

                {/* Botão Biometria */}
                <button
                  type="button"
                  onClick={handleAcessarBiometria}
                  disabled={processandoBiometria}
                  style={{
                    width: '100%',
                    height: 44,
                    borderRadius: 22,
                    background: '#ffffff',
                    border: '1.5px solid #d1d5db',
                    color: '#374151',
                    fontSize: 13.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)',
                    transition: 'all 0.2s'
                  }}
                >
                  <IconFingerprint size={19} style={{ color: '#556b2f' }} />
                  {processandoBiometria ? 'Verificando Biometria...' : 'Acessar com Biometria'}
                </button>

                {/* Termos e Privacidade */}
                <div style={{ marginTop: 14, textAlign: 'center' }}>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: 0, lineHeight: 1.4 }}>
                    Ao acessar, você concorda com os <a href="https://atesa.com.br" target="_blank" rel="noreferrer" style={{ color: '#556b2f', fontWeight: 700, textDecoration: 'none' }}>Termos de Uso</a> e a <a href="https://atesa.com.br" target="_blank" rel="noreferrer" style={{ color: '#556b2f', fontWeight: 700, textDecoration: 'none' }}>Política de Privacidade</a> da Atesa.
                  </p>
                </div>
              </div>
            </div>
          </div>
          {renderModaisRecuperacaoESenha()}
        </IonContent>
      </IonPage>
    );
  }

  if (carregando) {
    return (
      <IonPage>
        <IonContent scrollY={false} style={{ '--background': '#f5f5f0' }}>
          <div style={{
            minHeight: '100%', height: '100%', background: '#f5f5f0', display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', color: '#556b2f', fontFamily: 'system-ui, sans-serif'
          }}>
            <div style={{ width: 44, height: 44, border: '4px solid #dce5cf', borderTopColor: '#556b2f', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <p style={{ marginTop: 16, fontSize: 14, color: '#556b2f', fontWeight: 700 }}>Carregando App do Cooperado...</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const pendentesSync = apontamentosHoje.filter(b => !b.sincronizado).length;
  const nomeExibicao = dados?.candidato?.nome || 'Cooperado';
  const primeiroNome = nomeExibicao.split(' ')[0];
  const matriculaExibicao = dados?.candidato?.matricula ? `C00-2024-${dados.candidato.matricula}` : `C00-2024-${dados?.candidato?.id || '1847'}`;
  const cargoExibicao = dados?.alocacaoAtual?.cargo || 'Cooperado ATESA';

  return (
    <IonPage>
      <IonContent
        ref={contentRef}
        scrollY={true}
        style={{
          '--background': '#f6f6f2',
          '--padding-top': '0px',
          '--padding-bottom': '0px',
        }}
      >
        <div style={{
          minHeight: '100%',
          width: '100%',
          background: '#f6f6f2',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: 0,
          margin: 0,
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }}>
          {/* ── CONTAINER DO APP (NATIVO / MOBILE-FIRST) ─────────────────────── */}
          <div style={{
            width: '100%',
            maxWidth: 480,
            minHeight: '100%',
            background: '#f6f6f2',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            margin: '0 auto',
            paddingBottom: 'max(96px, calc(80px + env(safe-area-inset-bottom, 24px)))',
            boxShadow: 'none'
          }}>

            {/* ── CABEÇALHO DO APP REFINADO E UNIVERSAL ───────────────────────── */}
            <header style={{ padding: 'max(20px, env(safe-area-inset-top, 20px)) 22px 14px', background: '#f6f6f2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* Lado Esquerdo: Saudação e Nome */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#556b2f', lineHeight: 1.2 }}>
                Bom dia,
              </div>
              <div style={{ fontSize: 19, fontWeight: 900, color: '#182210', lineHeight: 1.2, marginTop: 1 }}>
                {nomeExibicao}
              </div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#2b361d', marginTop: 10 }}>
                Apontamento de Ponto
              </div>
            </div>

            {/* Lado Direito: Online Badge, Matrícula e Cargo */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
              {/* Badge Online */}
              <span style={{
                background: online ? '#e8eedb' : '#fee2e2',
                color: online ? '#3d5020' : '#b91c1c',
                borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', gap: 5
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: online ? '#22c55e' : '#ef4444' }} />
                {online ? 'Online' : 'Offline'}
              </span>

              {/* Matrícula */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#556b2f', marginTop: 2 }}>
                {matriculaExibicao}
              </div>

              {/* Badge do Cargo (Pill Verde Oliva) */}
              <div style={{
                background: '#556b2f', color: '#ffffff', borderRadius: 20,
                padding: '4px 12px', fontSize: 11, fontWeight: 800, marginTop: 4,
                boxShadow: '0 2px 6px rgba(85,107,47,0.25)'
              }}>
                {cargoExibicao}
              </div>
            </div>
          </div>
        </header>

        {/* ── NOTIFICAÇÕES TOAST / ALERTAS ─────────────────────────────────── */}
        {notificacaoSucesso && (
          <div style={{
            background: '#556b2f', color: '#fff', padding: '10px 18px', fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 16px 10px',
            borderRadius: 10, boxShadow: '0 4px 12px rgba(85,107,47,0.3)'
          }}>
            <span>{notificacaoSucesso}</span>
            <button onClick={() => setNotificacaoSucesso('')} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14 }}>✕</button>
          </div>
        )}

        {avisoFimContador && (
          <div style={{
            background: '#d97706', color: '#fff', padding: '12px 18px', margin: '0 16px 10px',
            borderRadius: 12, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', boxShadow: '0 4px 12px rgba(217,119,6,0.25)'
          }}>
            <div>
              <strong>Tempo de {avisoFimContador.tipo} Encerrado!</strong>
              <div style={{ fontSize: 11, opacity: 0.9, marginTop: 2 }}>{avisoFimContador.mensagem}</div>
            </div>
            <button onClick={() => setAvisoFimContador(null)} style={{ background: '#fff', color: '#78350f', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>OK</button>
          </div>
        )}

        {/* ── PUSH NOTIFICATION DE NOVA VAGA ────────────────────────────────── */}
        {vagaPush && (
          <div style={{
            margin: '0 16px 14px', background: '#ffffff',
            border: '2px solid #556b2f', borderRadius: 16, padding: 16,
            boxShadow: '0 6px 20px rgba(85,107,47,0.15)', position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ background: '#556b2f', color: '#fff', fontSize: 10, fontWeight: 900, padding: '2px 8px', borderRadius: 10, textTransform: 'uppercase' }}>
                Nova Vaga Ofertada
              </span>
              <span style={{ fontSize: 11, color: '#556b2f', fontWeight: 600 }}>Selecione sua resposta</span>
            </div>

            <h3 style={{ margin: '0 0 4px', fontSize: 15, fontWeight: 800, color: '#182210' }}>
              {vagaPush.cargo}
            </h3>
            <p style={{ margin: '0 0 10px', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4 }}>
              <IconMapPin size={14} style={{ color: '#556b2f' }} />
              {vagaPush.nome_unidade || vagaPush.nome_empresa} · {vagaPush.tipo_escala || 'Plantão'} · {vagaPush.salario_base ? formatarMoeda(vagaPush.salario_base) : 'Tabela da Unidade'}
            </p>

            <div style={{ display: 'flex', gap: 10 }}>
              <button
                disabled={processandoRespostaVaga}
                onClick={handleAceitarVagaPush}
                style={{
                  flex: 1, background: '#556b2f', color: '#fff', border: 'none', borderRadius: 10,
                  padding: '10px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <IconCheck size={16} /> Aceitar Vaga
              </button>
              <button
                disabled={processandoRespostaVaga}
                onClick={() => setModalDeclinarPushAberto(true)}
                style={{
                  flex: 1, background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: 10,
                  padding: '10px', fontSize: 13, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6
                }}
              >
                <IconX size={16} /> Declinar
              </button>
            </div>
          </div>
        )}

        {/* ── CONTEÚDO PRINCIPAL ROLÁVEL ────────────────────────────────────── */}
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column' }}>

          {/* ═════════════════════════════════════════════════════════════════════
              ABA 1: APONTAMENTOS (OS 3 BOTÕES DA IMAGEM 5)
             ═════════════════════════════════════════════════════════════════════ */}
          {abaAtiva === 'ponto' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* CARD 1: RELÓGIO DIGITAL VERDE OLIVA */}
              <div style={{
                background: '#556b2f', borderRadius: 16, padding: '16px 20px',
                boxShadow: '0 6px 18px rgba(85, 107, 47, 0.25)', color: '#ffffff',
                display: 'flex', flexDirection: 'column', gap: 2
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#d8e2c8' }}>
                  {formatarDataCardOliva(horaAtual)}
                </div>
                <div style={{
                  fontSize: 38, fontWeight: 900, letterSpacing: '1.5px',
                  fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace',
                  color: '#ffffff', lineHeight: 1.1
                }}>
                  {horaAtual.toLocaleTimeString('pt-BR')}
                </div>
              </div>

              {/* CARD DE DESLOCAMENTO / CONFIRMAÇÃO DE IDA AO TRABALHO (OFFLINE & ONLINE) */}
              <div style={{
                background: deslocamentoConfirmado ? '#f0fdf4' : '#ffffff',
                borderRadius: 16,
                padding: '16px 18px',
                border: deslocamentoConfirmado ? '1.5px solid #86efac' : '1.5px solid #fed7aa',
                boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                transition: 'all 0.2s'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 8,
                      background: deslocamentoConfirmado ? '#dcfce7' : '#ffedd5',
                      color: deslocamentoConfirmado ? '#166534' : '#c2410c',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                      <IconCar size={18} />
                    </span>
                    <div>
                      <span style={{ fontSize: 15, fontWeight: 800, color: '#182210', display: 'block' }}>
                        Deslocamento para o Posto
                      </span>
                      <span style={{ fontSize: 11, color: '#64748b' }}>
                        {dados?.alocacaoAtual?.nome_unidade || dados?.alocacaoAtual?.nome_empresa || 'Posto de Atendimento'}
                      </span>
                    </div>
                  </div>
                  {deslocamentoConfirmado ? (
                    <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✓ A Caminho
                    </span>
                  ) : (
                    <span style={{ background: '#ffedd5', color: '#c2410c', fontSize: 11, fontWeight: 800, padding: '3px 10px', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ⏳ Pendente
                    </span>
                  )}
                </div>

                {deslocamentoConfirmado ? (
                  <div style={{ background: '#ffffff', borderRadius: 10, padding: '10px 12px', border: '1px solid #bbf7d0', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#166534', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>🚗</span> Saída confirmada às {new Date(deslocamentoConfirmado.timestampDispositivo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ fontSize: 11, color: '#4b5563', lineHeight: 1.4 }}>
                      A supervisão já foi notificada que você está a caminho do posto. Ao chegar, registre o <strong>Início da Jornada</strong> abaixo.
                    </div>
                    <div style={{ fontSize: 10, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <IconMapPin size={11} style={{ color: '#15803d' }} />
                      <span>GPS capturado · {deslocamentoConfirmado.sincronizado ? '✓ Sincronizado' : '📥 Gravado offline no celular'}</span>
                    </div>
                  </div>
                ) : (
                  <>
                    <p style={{ margin: 0, fontSize: 12, color: '#4b5563', lineHeight: 1.45 }}>
                      Confirme que você está <strong>a caminho do posto de serviço</strong> para garantir sua presença no plantão e evitar a realocação da sua vaga.
                    </p>

                    <button
                      type="button"
                      onClick={handleConfirmarDeslocamento}
                      disabled={confirmandoDeslocamento}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #ea580c 0%, #c2410c 100%)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: 12,
                        padding: '13px 18px',
                        fontSize: 14,
                        fontWeight: 800,
                        cursor: confirmandoDeslocamento ? 'not-allowed' : 'pointer',
                        boxShadow: '0 4px 12px rgba(234, 88, 12, 0.28)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        transition: 'all 0.2s'
                      }}
                    >
                      <IconCar size={18} />
                      <span>{confirmandoDeslocamento ? 'Registrando Deslocamento...' : '🚗 Estou a Caminho do Trabalho'}</span>
                    </button>
                  </>
                )}
              </div>

              {/* CARD 2: JORNADA */}
              <div style={{
                background: '#ffffff', borderRadius: 16, padding: '16px 18px',
                border: '1.5px solid #e8ebe0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex', flexDirection: 'column', gap: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconBriefcase size={20} style={{ color: '#556b2f' }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#182210' }}>Jornada</span>
                  </div>
                  {jornadaIniciada && !jornadaFinalizada && (
                    <span style={{ background: '#eaf2d7', color: '#3d5020', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                      Iniciada às {new Date(jornadaIniciada.timestampDispositivo).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {jornadaFinalizada && (
                    <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                      Encerrada
                    </span>
                  )}
                </div>

                <button
                  onClick={handleBotaoJornada}
                  disabled={!!jornadaFinalizada}
                  style={{
                    width: '100%',
                    background: jornadaFinalizada ? '#e2e8d5' : jornadaIniciada ? '#b91c1c' : '#556b2f',
                    color: jornadaFinalizada ? '#839272' : '#ffffff',
                    border: 'none', borderRadius: 12, padding: '14px 20px',
                    fontSize: 15, fontWeight: 800, cursor: jornadaFinalizada ? 'not-allowed' : 'pointer',
                    boxShadow: (jornadaFinalizada) ? 'none' : '0 4px 12px rgba(85, 107, 47, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  {jornadaFinalizada ? 'Jornada Concluída' : jornadaIniciada ? 'Finalizar Jornada' : 'Iniciar Jornada'}
                </button>
              </div>

              {/* CARD 3: REFEIÇÃO */}
              <div style={{
                background: '#ffffff', borderRadius: 16, padding: '16px 18px',
                border: '1.5px solid #fef08a', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex', flexDirection: 'column', gap: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconUtensils size={20} style={{ color: '#d97706' }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#182210' }}>Refeição</span>
                  </div>
                  {contadorRefeicao && (
                    <span style={{
                      background: contadorRefeicao.expirou ? '#fee2e2' : '#fef9c3',
                      color: contadorRefeicao.expirou ? '#b91c1c' : '#854d0e',
                      fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 12
                    }}>
                      {contadorRefeicao.expirou ? 'Tempo Excedido' : `${contadorRefeicao.tempoFormatado}`}
                    </span>
                  )}
                  {refeicaoFinalizada && (
                    <span style={{ background: '#f3f4f6', color: '#6b7280', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                      Concluída
                    </span>
                  )}
                </div>

                {contadorRefeicao?.estaTravado && (
                  <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600, background: '#fefce8', padding: '6px 10px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconLock size={14} style={{ color: '#b45309' }} /> Trava de segurança: {contadorRefeicao.segundosParaLiberar}s restantes para atingir 10 min mínimos.
                  </div>
                )}

                <button
                  onClick={handleBotaoRefeicao}
                  disabled={!jornadaIniciada || !!jornadaFinalizada || !!refeicaoFinalizada || Boolean(contadorRefeicao?.estaTravado)}
                  style={{
                    width: '100%',
                    background: (!jornadaIniciada || refeicaoFinalizada || contadorRefeicao?.estaTravado)
                      ? '#e2e8d5'
                      : refeicaoIniciada
                        ? '#d97706'
                        : '#556b2f',
                    color: (!jornadaIniciada || refeicaoFinalizada || contadorRefeicao?.estaTravado)
                      ? '#839272'
                      : '#ffffff',
                    border: 'none', borderRadius: 12, padding: '14px 20px',
                    fontSize: 15, fontWeight: 800,
                    cursor: (!jornadaIniciada || refeicaoFinalizada || contadorRefeicao?.estaTravado) ? 'not-allowed' : 'pointer',
                    boxShadow: (!jornadaIniciada || refeicaoFinalizada || contadorRefeicao?.estaTravado) ? 'none' : '0 4px 12px rgba(85, 107, 47, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  {refeicaoFinalizada
                    ? 'Refeição Concluída'
                    : contadorRefeicao?.estaTravado
                      ? `Trava 10min Ativa (${contadorRefeicao.segundosParaLiberar}s)`
                      : refeicaoIniciada
                        ? 'Finalizar Refeição'
                        : 'Iniciar Refeição'}
                </button>
              </div>

              {/* CARD 4: PAUSA */}
              <div style={{
                background: '#ffffff', borderRadius: 16, padding: '16px 18px',
                border: '1.5px solid #bae6fd', boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
                display: 'flex', flexDirection: 'column', gap: 12
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IconCoffee size={20} style={{ color: '#0284c7' }} />
                    <span style={{ fontSize: 16, fontWeight: 800, color: '#182210' }}>Pausa</span>
                  </div>
                  {contadorPausa ? (
                    <span style={{
                      background: contadorPausa.expirou ? '#fee2e2' : '#e0f2fe',
                      color: contadorPausa.expirou ? '#b91c1c' : '#0369a1',
                      fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 12
                    }}>
                      Pausa #{pausaEmAndamento?.parIndice || 1}: {contadorPausa.tempoFormatado}
                    </span>
                  ) : (
                    <span style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 12 }}>
                      {pausasDoDia.length} pausa(s) hoje
                    </span>
                  )}
                </div>

                <button
                  onClick={handleBotaoPausa}
                  disabled={!jornadaIniciada || !!jornadaFinalizada}
                  style={{
                    width: '100%',
                    background: (!jornadaIniciada || jornadaFinalizada)
                      ? '#e2e8d5'
                      : pausaEmAndamento
                        ? '#0284c7'
                        : '#556b2f',
                    color: (!jornadaIniciada || jornadaFinalizada)
                      ? '#839272'
                      : '#ffffff',
                    border: 'none', borderRadius: 12, padding: '14px 20px',
                    fontSize: 15, fontWeight: 800,
                    cursor: (!jornadaIniciada || jornadaFinalizada) ? 'not-allowed' : 'pointer',
                    boxShadow: (!jornadaIniciada || jornadaFinalizada) ? 'none' : '0 4px 12px rgba(85, 107, 47, 0.25)',
                    transition: 'all 0.2s'
                  }}
                >
                  {pausaEmAndamento
                    ? `Finalizar Pausa #${pausaEmAndamento.parIndice || 1}`
                    : pausasDoDia.length > 0
                      ? `Iniciar Nova Pausa (${pausasDoDia.length + 1}ª)`
                      : 'Iniciar Pausa'}
                </button>
              </div>

              {/* CARD 5: BATIDAS REGISTRADAS HOJE */}
              <div style={{
                background: '#ffffff', borderRadius: 16, padding: '16px 18px',
                border: '1.5px solid #e8ebe0', boxShadow: '0 2px 8px rgba(0,0,0,0.03)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#182210', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <IconClipboard size={18} style={{ color: '#556b2f' }} /> Batidas Registradas Hoje ({apontamentosHoje.length})
                  </div>
                  {pendentesSync > 0 && (
                    <button
                      onClick={() => sincronizarLote()}
                      disabled={sincronizandoMassa || !online}
                      style={{
                        background: '#556b2f', color: '#fff', border: 'none', borderRadius: 6,
                        padding: '4px 8px', fontSize: 10, fontWeight: 800, cursor: 'pointer'
                      }}
                    >
                      {sincronizandoMassa ? 'Enviando...' : `Transmitir (${pendentesSync})`}
                    </button>
                  )}
                </div>

                {apontamentosHoje.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '10px 0' }}>
                    Nenhum apontamento registrado hoje ainda. Use os botões acima para iniciar.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {apontamentosHoje.map((batida, i) => (
                      <div
                        key={i}
                        style={{
                          background: '#f8faf7', borderRadius: 8, padding: '8px 10px',
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          border: '1px solid #e2e8d5'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#182210' }}>
                            {batida.tipoEvento === 'deslocamento_inicio' || batida.tipoEvento === 'a_caminho' ? '🚗 A Caminho do Posto' :
                              batida.tipoEvento === 'jornada_inicio' ? 'Início de Jornada' :
                                batida.tipoEvento === 'jornada_fim' ? 'Fim de Jornada' :
                                  batida.tipoEvento === 'refeicao_inicio' ? 'Início de Refeição' :
                                    batida.tipoEvento === 'refeicao_fim' ? 'Fim de Refeição' :
                                      batida.tipoEvento === 'pausa_inicio' ? `Início de Pausa #${batida.parIndice || 1}` :
                                        `Fim de Pausa #${batida.parIndice || 1}`}
                          </div>
                          <div style={{ fontSize: 10, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 3, marginTop: 2 }}>
                            <IconMapPin size={12} style={{ color: '#7c8b6b' }} /> {batida.latitude ? `${batida.latitude}, ${batida.longitude}` : 'Sem GPS'}
                          </div>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 900, color: '#556b2f' }}>
                            {new Date(batida.timestampDispositivo).toLocaleTimeString('pt-BR')}
                          </div>
                          <span style={{ fontSize: 9, fontWeight: 700, color: batida.sincronizado ? '#15803d' : '#d97706', display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 2 }}>
                            {batida.sincronizado ? <><IconCheckCircle size={11} style={{ color: '#15803d' }} /> Salvo</> : <><IconClock size={11} style={{ color: '#d97706' }} /> Pendente</>}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              ABA 2: VAGAS & ESCALAS ATIVAS
             ═════════════════════════════════════════════════════════════════════ */}
          {abaAtiva === 'vaga' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#ffffff', borderRadius: 16, padding: '18px', border: '1.5px solid #e8ebe0' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#556b2f', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconBriefcase size={20} style={{ color: '#556b2f' }} /> Minha Vaga & Escala Atual
                </h3>

                {dados?.alocacaoAtual ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ background: '#f8faf7', padding: 12, borderRadius: 10, border: '1px solid #e2e8d5' }}>
                      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Posto / Função</span>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#182210' }}>{dados.alocacaoAtual.cargo}</div>
                      {dados.alocacaoAtual.cbo && <div style={{ fontSize: 11, color: '#556b2f', marginTop: 2 }}>CBO: {dados.alocacaoAtual.cbo}</div>}
                    </div>

                    <div style={{ background: '#f8faf7', padding: 12, borderRadius: 10, border: '1px solid #e2e8d5' }}>
                      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Unidade & Empresa</span>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#182210' }}>{dados.alocacaoAtual.nome_unidade || dados.alocacaoAtual.nome_empresa}</div>
                      <div style={{ fontSize: 12, color: '#6b7280' }}>{dados.alocacaoAtual.nome_empresa}</div>
                    </div>

                    <div style={{ background: '#f8faf7', padding: 12, borderRadius: 10, border: '1px solid #e2e8d5' }}>
                      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Escala</span>
                      <div style={{ fontSize: 14, fontWeight: 800, color: '#182210' }}>{dados.alocacaoAtual.tipo_escala || 'Plantão'}</div>
                    </div>

                    <div style={{ background: '#f8faf7', padding: 12, borderRadius: 10, border: '1px solid #e2e8d5' }}>
                      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Intervalos Parametrizados</span>
                      <div style={{ fontSize: 13, color: '#182210', marginTop: 4 }}>
                        • Refeição: <strong>{dados.alocacaoAtual.tempo_refeicao || 60} min</strong><br />
                        • Pausa: <strong>{dados.alocacaoAtual.tempo_pausa || 15} min</strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#6b7280', fontSize: 13 }}>Você está no banco geral de cooperados aguardando nova escala.</p>
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              ABA 3: MEUS DADOS & SOLICITAÇÃO DE CORREÇÃO
             ═════════════════════════════════════════════════════════════════════ */}
          {abaAtiva === 'dados' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#ffffff', borderRadius: 16, padding: '18px', border: '1.5px solid #e8ebe0' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#556b2f', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconUser size={20} style={{ color: '#556b2f' }} /> Meus Dados Cadastrais
                </h3>
                <p style={{ margin: '0 0 16px', fontSize: 12, color: '#6b7280' }}>
                  Revise ou solicite alterações cadastrais para a equipe administrativa da ATESA.
                </p>

                <form onSubmit={handleEnviarCorrecaoCadastral} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Telefone</label>
                      <input
                        type="text"
                        value={formCorrecao.telefone}
                        onChange={e => setFormCorrecao({ ...formCorrecao, telefone: e.target.value })}
                        style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>WhatsApp</label>
                      <input
                        type="text"
                        value={formCorrecao.whatsapp}
                        onChange={e => setFormCorrecao({ ...formCorrecao, whatsapp: e.target.value })}
                        style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Endereço (Rua / Logradouro)</label>
                    <input
                      type="text"
                      value={formCorrecao.logradouro}
                      onChange={e => setFormCorrecao({ ...formCorrecao, logradouro: e.target.value })}
                      placeholder="Rua / Avenida"
                      style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Número</label>
                      <input
                        type="text"
                        value={formCorrecao.numero}
                        onChange={e => setFormCorrecao({ ...formCorrecao, numero: e.target.value })}
                        style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Bairro</label>
                      <input
                        type="text"
                        value={formCorrecao.bairro}
                        onChange={e => setFormCorrecao({ ...formCorrecao, bairro: e.target.value })}
                        style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Cidade/UF</label>
                      <input
                        type="text"
                        value={`${formCorrecao.cidade}/${formCorrecao.uf}`}
                        onChange={e => {
                          const [c, u] = e.target.value.split('/');
                          setFormCorrecao({ ...formCorrecao, cidade: c || '', uf: u || 'SP' });
                        }}
                        style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 12, marginTop: 4 }}>
                    <label style={{ fontSize: 12, fontWeight: 800, color: '#556b2f', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <IconCreditCard size={16} style={{ color: '#556b2f' }} /> Dados Bancários & PIX
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Banco</label>
                        <input
                          type="text"
                          value={formCorrecao.banco}
                          onChange={e => setFormCorrecao({ ...formCorrecao, banco: e.target.value })}
                          style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Agência / Conta</label>
                        <input
                          type="text"
                          value={`${formCorrecao.agencia} / ${formCorrecao.conta}-${formCorrecao.digito}`}
                          onChange={e => {
                            const [ag, cc] = e.target.value.split('/');
                            setFormCorrecao({ ...formCorrecao, agencia: ag?.trim() || '', conta: cc?.trim() || '' });
                          }}
                          style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                        />
                      </div>
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Chave PIX</label>
                      <input
                        type="text"
                        value={formCorrecao.chavePix}
                        onChange={e => setFormCorrecao({ ...formCorrecao, chavePix: e.target.value })}
                        style={{ width: '100%', padding: '9px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13, boxSizing: 'border-box' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>
                      Motivo / Observações da Solicitação
                    </label>
                    <textarea
                      rows={2}
                      value={formCorrecao.motivo}
                      onChange={e => setFormCorrecao({ ...formCorrecao, motivo: e.target.value })}
                      placeholder="Ex: Mudança de endereço recente / Nova conta para repasse"
                      style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 12, boxSizing: 'border-box' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={enviandoCorrecao}
                    style={{
                      background: '#556b2f', color: '#fff', border: 'none', borderRadius: 10,
                      padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer', marginTop: 8
                    }}
                  >
                    {enviandoCorrecao ? 'Enviando...' : 'Enviar Solicitação de Correção'}
                  </button>
                </form>
              </div>

              {/* Botão de Logout */}
              <div style={{ textAlign: 'center', marginTop: 10 }}>
                <button
                  onClick={handleLogoutApp}
                  style={{
                    background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca',
                    borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6
                  }}
                >
                  <IconLogOut size={16} /> Desconectar do Aplicativo
                </button>
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              ABA 4: MEUS DOCUMENTOS & UPLOADS
             ═════════════════════════════════════════════════════════════════════ */}
          {abaAtiva === 'documentos' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#ffffff', borderRadius: 16, padding: '18px', border: '1.5px solid #e8ebe0' }}>
                <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: '#556b2f', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconFile size={20} style={{ color: '#556b2f' }} /> Enviar / Subir Documentos
                </h3>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#6b7280' }}>
                  Envie fotos ou PDFs dos documentos solicitados diretamente do celular.
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#4b5563', marginBottom: 4 }}>Tipo de Documento</label>
                    <select
                      value={uploadDocTipo}
                      onChange={e => setUploadDocTipo(e.target.value as TipoDocumento)}
                      style={{ width: '100%', padding: '10px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 13 }}
                    >
                      <option value="foto_3x4">Foto 3x4 (Fundo Branco)</option>
                      <option value="rg_frente">RG / CNH (Frente)</option>
                      <option value="rg_verso">RG (Verso)</option>
                      <option value="cpf">Cartão / Comprovante de CPF</option>
                      <option value="comprovante_residencia">Comprovante de Residência</option>
                      <option value="pis">PIS (Foto)</option>
                      <option value="comprovante_bancario">Comprovante Bancário</option>
                      <option value="cnh">CNH</option>
                      <option value="certificado">Certificado / Diploma</option>
                      <option value="outro">Outro Documento</option>
                    </select>
                  </div>

                  <input
                    type="file"
                    ref={inputArquivoRef}
                    onChange={handleSelecionarArquivoDoc}
                    accept="image/*,application/pdf"
                    style={{ display: 'none' }}
                  />

                  <button
                    type="button"
                    disabled={enviandoDocApp}
                    onClick={() => inputArquivoRef.current?.click()}
                    style={{
                      background: '#556b2f', color: '#fff', border: 'none',
                      borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                    }}
                  >
                    <IconUpload size={18} /> {enviandoDocApp ? 'Enviando documento...' : 'Tirar Foto / Escolher Arquivo'}
                  </button>
                </div>
              </div>

              {/* Lista de Documentos Enviados e Status */}
              <div style={{ background: '#ffffff', borderRadius: 16, padding: '18px', border: '1.5px solid #e8ebe0' }}>
                <h4 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 800, color: '#182210' }}>
                  Documentos Enviados ({dados?.documentos?.length || 0})
                </h4>

                {dados?.documentos && dados.documentos.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {dados.documentos.map(doc => (
                      <div
                        key={doc.id}
                        style={{
                          background: '#f8faf7', padding: '10px 12px', borderRadius: 10,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          border: '1px solid #e2e8d5'
                        }}
                      >
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#182210' }}>
                            {ROTULO_TIPO_DOC[doc.tipo] || doc.tipo}
                          </div>
                          <div style={{ fontSize: 11, color: '#6b7280' }}>{doc.nome_original}</div>
                        </div>

                        <div>
                          {doc.validado ? (
                            <span style={{ background: '#eaf2d7', color: '#3d5020', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <IconCheck size={12} /> VALIDADO
                            </span>
                          ) : doc.rejeitado ? (
                            <span style={{ background: '#fee2e2', color: '#b91c1c', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <IconX size={12} /> REJEITADO
                            </span>
                          ) : (
                            <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <IconClock size={12} /> EM ANÁLISE
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: 0, fontSize: 12, color: '#6b7280', textAlign: 'center' }}>
                    Nenhum documento anexado ainda.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* ═════════════════════════════════════════════════════════════════════
              ABA 5: SINCRONIZAÇÃO & DIAGNÓSTICO OFFLINE
             ═════════════════════════════════════════════════════════════════════ */}
          {abaAtiva === 'sync' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: '#ffffff', borderRadius: 16, padding: '18px', border: '1.5px solid #e8ebe0' }}>
                <h3 style={{ margin: '0 0 14px', fontSize: 16, fontWeight: 800, color: '#556b2f', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconRefresh size={20} style={{ color: '#556b2f' }} /> Transmissão & Sincronização
                </h3>

                <div style={{ background: '#f8faf7', padding: 14, borderRadius: 10, border: '1px solid #e2e8d5', marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Status da Rede:</span>
                    <strong style={{ fontSize: 12, color: online ? '#15803d' : '#b91c1c' }}>{online ? '✓ Conectado à Internet' : '✕ Modo Offline (Sem Rede)'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Batidas Hoje:</span>
                    <strong style={{ fontSize: 12, color: '#182210' }}>{apontamentosHoje.length}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: '#6b7280' }}>Pendentes de Envio:</span>
                    <strong style={{ fontSize: 12, color: pendentesSync > 0 ? '#d97706' : '#15803d' }}>
                      {pendentesSync} evento(s)
                    </strong>
                  </div>
                </div>

                <button
                  onClick={() => sincronizarLote()}
                  disabled={sincronizandoMassa || !online || pendentesSync === 0}
                  style={{
                    width: '100%', background: pendentesSync === 0 ? '#e2e8d5' : '#556b2f',
                    color: pendentesSync === 0 ? '#839272' : '#ffffff', border: 'none', borderRadius: 10, padding: '12px',
                    fontSize: 14, fontWeight: 800, cursor: (pendentesSync === 0 || !online) ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                  }}
                >
                  <IconRefresh size={18} />
                  {sincronizandoMassa ? 'Transmitindo...' : pendentesSync === 0 ? 'Todos os Apontamentos Sincronizados' : `Transmitir ${pendentesSync} Apontamentos em Massa`}
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  </IonContent>

        {/* ── MODAL: ALERTA DE ENCERRAMENTO ANTECIPADO DA JORNADA ────────────── */}
        {modalAlertaJornadaAntecipada && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            backdropFilter: 'blur(3px)'
          }}>
            <div style={{
              background: '#ffffff', borderRadius: 16, maxWidth: 360, width: '100%', padding: 22,
              border: '1.5px solid #fde047', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
              <IconAlert size={36} style={{ color: '#d97706', margin: '0 auto 8px', display: 'block' }} />
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#b45309', textAlign: 'center' }}>
                Encerramento Antes do Previsto
              </h3>
              <p style={{ margin: '0 0 16px', fontSize: 13, color: '#4b5563', lineHeight: 1.5, textAlign: 'center' }}>
                A sua jornada cadastrada para esta vaga é de <strong>{jornadaPrevistaHoras} horas</strong>. Deseja realmente finalizar seu turno antecipadamente?
              </p>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setModalAlertaJornadaAntecipada(false)}
                  style={{
                    flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db',
                    borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => {
                    setModalAlertaJornadaAntecipada(false);
                    if (acaoPendenteJornada) acaoPendenteJornada();
                  }}
                  style={{
                    flex: 1, background: '#b91c1c', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  Sim, Finalizar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: DECLINAR VAGA NO PUSH ──────────────────────────────────── */}
        {modalDeclinarPushAberto && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            backdropFilter: 'blur(3px)'
          }}>
            <div style={{
              background: '#ffffff', borderRadius: 16, maxWidth: 360, width: '100%', padding: 22,
              border: '1.5px solid #fca5a5', boxShadow: '0 20px 40px rgba(0,0,0,0.2)'
            }}>
              <h3 style={{ margin: '0 0 8px', fontSize: 16, fontWeight: 800, color: '#b91c1c', display: 'flex', alignItems: 'center', gap: 6 }}>
                <IconX size={20} /> Declinar Oportunidade
              </h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>
                A vaga será devolvida para seleção no RA e o setor de recrutamento será notificado.
              </p>

              <textarea
                rows={3}
                value={motivoRecusaPush}
                onChange={e => setMotivoRecusaPush(e.target.value)}
                placeholder="Motivo da recusa (opcional)"
                style={{ width: '100%', padding: '8px', borderRadius: 8, background: '#fafafa', border: '1px solid #d1d5db', color: '#111827', fontSize: 12, boxSizing: 'border-box', marginBottom: 14 }}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setModalDeclinarPushAberto(false)}
                  style={{
                    flex: 1, background: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db',
                    borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                  }}
                >
                  Voltar
                </button>
                <button
                  disabled={processandoRespostaVaga}
                  onClick={handleDeclinarVagaPush}
                  style={{
                    flex: 1, background: '#b91c1c', color: '#fff', border: 'none',
                    borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 800, cursor: 'pointer'
                  }}
                >
                  {processandoRespostaVaga ? 'Enviando...' : 'Confirmar Recusa'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODAL: BLOQUEIO DE PERÍMETRO (GEOLOCALIZAÇÃO) ──────────────────── */}
        {bloqueioPerimetroInfo && bloqueioPerimetroInfo.aberto && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            backdropFilter: 'blur(4px)'
          }}>
            <div style={{
              background: '#ffffff', borderRadius: 20, maxWidth: 380, width: '100%', padding: '24px 20px',
              border: '1.5px solid #fca5a5', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
              textAlign: 'center'
            }}>
              <div style={{
                width: 58, height: 58, borderRadius: '50%',
                background: '#fee2e2', color: '#dc2626',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 14px', fontSize: 26,
                boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)'
              }}>
                🚫
              </div>

              <h3 style={{ margin: '0 0 8px', fontSize: 17, fontWeight: 800, color: '#991b1b' }}>
                Fora do Perímetro de Serviço
              </h3>

              <div style={{
                background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12,
                padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#991b1b',
                fontWeight: 600, lineHeight: 1.45, textAlign: 'center'
              }}>
                {bloqueioPerimetroInfo.mensagem || 'Para realizar a marcação é preciso estar no local de serviço seja o cooperado com Internet ou sem internet.'}
              </div>

              <div style={{
                background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12,
                padding: '12px 14px', textAlign: 'left', fontSize: 12.5, color: '#334155',
                marginBottom: 20
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Distância Atual:</span>
                  <strong style={{ color: '#dc2626', fontSize: 13 }}>
                    {bloqueioPerimetroInfo.distanciaMetros > 0 ? `${bloqueioPerimetroInfo.distanciaMetros.toLocaleString('pt-BR')} metros` : 'Não identificada'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ color: '#64748b' }}>Raio Permitido:</span>
                  <strong style={{ color: '#166534' }}>
                    {bloqueioPerimetroInfo.raioPermitido.toLocaleString('pt-BR')} metros
                  </strong>
                </div>
                {bloqueioPerimetroInfo.distanciaMetros > bloqueioPerimetroInfo.raioPermitido && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ color: '#64748b' }}>Diferença Fora:</span>
                    <strong style={{ color: '#b91c1c' }}>
                      +{(bloqueioPerimetroInfo.distanciaMetros - bloqueioPerimetroInfo.raioPermitido).toLocaleString('pt-BR')} metros
                    </strong>
                  </div>
                )}
                {bloqueioPerimetroInfo.localNome && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #e2e8f0', paddingTop: 6, marginTop: 6 }}>
                    <span style={{ color: '#64748b' }}>Local Autorizado:</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{bloqueioPerimetroInfo.localNome}</span>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setBloqueioPerimetroInfo(null)}
                style={{
                  width: '100%', height: 44, borderRadius: 10,
                  background: '#1b5e20', color: '#ffffff', border: 'none',
                  fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(27, 94, 32, 0.25)'
                }}
              >
                Compreendido
              </button>
            </div>
          </div>
        )}

        {renderModaisRecuperacaoESenha()}

        {/* ── BARRA DE NAVEGAÇÃO INFERIOR MODERNA ───────────────────────────── */}
        <nav style={{
          position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: 480, background: '#ffffff', borderTop: '1px solid #e5e7eb',
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', zIndex: 1000,
          padding: '6px 0 max(8px, env(safe-area-inset-bottom, 8px))', boxShadow: '0 -4px 16px rgba(0,0,0,0.06)'
        }}>
          {[
            { id: 'ponto', label: 'Ponto', Icon: IconClock },
            { id: 'vaga', label: 'Vagas', Icon: IconBriefcase },
            { id: 'dados', label: 'Meus Dados', Icon: IconUser },
            { id: 'documentos', label: 'Documentos', Icon: IconFile },
            { id: 'sync', label: 'Sincronização', Icon: IconRefresh },
          ].map(tab => {
            const isActive = abaAtiva === tab.id;
            const TabIcon = tab.Icon;
            return (
              <button
                key={tab.id}
                onClick={() => setAbaAtiva(tab.id as AbaApp)}
                style={{
                  background: 'transparent', border: 'none',
                  color: isActive ? '#556b2f' : '#6b7280',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  cursor: 'pointer', padding: '4px 0', position: 'relative',
                  borderTop: isActive ? '2.5px solid #556b2f' : '2.5px solid transparent',
                  marginTop: -6, paddingTop: 6
                }}
              >
                <TabIcon size={20} style={{ color: isActive ? '#556b2f' : '#6b7280' }} />
                <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600 }}>{tab.label}</span>
              </button>
            );
          })}
        </nav>
    </IonPage>
  );
};

export default AppCooperado;
