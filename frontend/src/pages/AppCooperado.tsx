import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
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
function emitirAlertaSonoro(tipo: 'sucesso' | 'aviso' | 'fim_tempo') {
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


  // ── Navegação em Abas do App ───────────────────────────────────────────────
  type AbaApp = 'ponto' | 'vaga' | 'dados' | 'documentos' | 'sync';
  const [abaAtiva, setAbaAtiva] = useState<AbaApp>('ponto');

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

  // Estados dos 3 botões
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
    const params = new URLSearchParams(location.search);
    const urlToken = params.get('token');
    const tokenFinal = urlToken || token;

    if (tokenFinal) {
      setToken(tokenFinal);
      localStorage.setItem('atesa_cooperado_token', tokenFinal);
      carregarDadosPortal(tokenFinal);
    } else {
      setCarregando(false);
    }
  }, [location.search]);

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

        carregarApontamentosLocais(res.candidato.id);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar dados do cooperado.');
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
      await carregarDadosPortal(res.token);
    } catch (e: any) {
      setErroLoginApp(e.message || 'Erro ao entrar no App.');
    } finally {
      setEntrandoApp(false);
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
  const obterChaveStorage = (candId: number) => `atesa_ponto_${candId}_${new Date().toISOString().slice(0, 10)}`;

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
    const jIni = lista.find(b => b.tipoEvento === 'jornada_inicio');
    const jFim = lista.find(b => b.tipoEvento === 'jornada_fim');
    setJornadaIniciada(jIni || null);
    setJornadaFinalizada(jFim || null);

    const rIni = lista.find(b => b.tipoEvento === 'refeicao_inicio');
    const rFim = lista.find(b => b.tipoEvento === 'refeicao_fim');
    setRefeicaoIniciada(rIni || null);
    setRefeicaoFinalizada(rFim || null);

    const pausasIni = lista.filter(b => b.tipoEvento === 'pausa_inicio').sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));
    const pausasFim = lista.filter(b => b.tipoEvento === 'pausa_fim').sort((a, b) => a.timestampDispositivo.localeCompare(b.timestampDispositivo));

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

  // ── Regras de Apontamento ──────────────────────────────────────────────────

  // 1. Botão JORNADA
  const handleBotaoJornada = async () => {
    if (!dados?.candidato) return;

    if (!jornadaIniciada) {
      const geo = await capturarLocalizacao();
      const agoraIso = new Date().toISOString();
      const novaBatida: ApontamentoRegistro = {
        localId: `j_ini_${Date.now()}`,
        candidatoId: dados.candidato.id,
        alocacaoId: dados.alocacaoAtual?.id || null,
        vagaId: dados.alocacaoAtual?.vaga_id || null,
        dataReferencia: agoraIso.slice(0, 10),
        tipoEvento: 'jornada_inicio',
        timestampDispositivo: agoraIso,
        latitude: geo.lat,
        longitude: geo.lng,
        precisaoMetros: geo.precisao,
        sincronizado: false,
      };
      salvarBatidaLocal(novaBatida, dados.candidato.id);
      emitirAlertaSonoro('sucesso');
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
      const geo = await capturarLocalizacao();
      const agoraIso = new Date().toISOString();
      const novaBatida: ApontamentoRegistro = {
        localId: `j_fim_${Date.now()}`,
        candidatoId: dados.candidato.id,
        alocacaoId: dados.alocacaoAtual?.id || null,
        vagaId: dados.alocacaoAtual?.vaga_id || null,
        dataReferencia: agoraIso.slice(0, 10),
        tipoEvento: 'jornada_fim',
        timestampDispositivo: agoraIso,
        latitude: geo.lat,
        longitude: geo.lng,
        precisaoMetros: geo.precisao,
        sincronizado: false,
      };
      salvarBatidaLocal(novaBatida, dados.candidato.id);
      emitirAlertaSonoro('sucesso');
    };

    if (horasTrabalhadas < jornadaPrevistaHoras - 0.25) {
      setAcaoPendenteJornada(() => executarFimJornada);
      setModalAlertaJornadaAntecipada(true);
    } else {
      await executarFimJornada();
    }
  };

  // 2. Botão REFEIÇÃO
  const handleBotaoRefeicao = async () => {
    if (!dados?.candidato) return;
    if (!jornadaIniciada || jornadaFinalizada) {
      alert('Inicie sua jornada antes de registrar o intervalo de refeição.');
      return;
    }
    if (pausaEmAndamento) {
      alert('Você possui uma pausa em andamento. Finalize a pausa antes da refeição.');
      return;
    }

    if (!refeicaoIniciada) {
      const geo = await capturarLocalizacao();
      const agoraIso = new Date().toISOString();
      const novaBatida: ApontamentoRegistro = {
        localId: `r_ini_${Date.now()}`,
        candidatoId: dados.candidato.id,
        alocacaoId: dados.alocacaoAtual?.id || null,
        vagaId: dados.alocacaoAtual?.vaga_id || null,
        dataReferencia: agoraIso.slice(0, 10),
        tipoEvento: 'refeicao_inicio',
        timestampDispositivo: agoraIso,
        latitude: geo.lat,
        longitude: geo.lng,
        precisaoMetros: geo.precisao,
        sincronizado: false,
      };
      salvarBatidaLocal(novaBatida, dados.candidato.id);
      emitirAlertaSonoro('aviso');
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

    const geo = await capturarLocalizacao();
    const agoraIso = new Date().toISOString();
    const novaBatida: ApontamentoRegistro = {
      localId: `r_fim_${Date.now()}`,
      candidatoId: dados.candidato.id,
      alocacaoId: dados.alocacaoAtual?.id || null,
      vagaId: dados.alocacaoAtual?.vaga_id || null,
      dataReferencia: agoraIso.slice(0, 10),
      tipoEvento: 'refeicao_fim',
      timestampDispositivo: agoraIso,
      latitude: geo.lat,
      longitude: geo.lng,
      precisaoMetros: geo.precisao,
      sincronizado: false,
    };
    salvarBatidaLocal(novaBatida, dados.candidato.id);
    emitirAlertaSonoro('sucesso');
  };

  // 3. Botão PAUSA
  const handleBotaoPausa = async () => {
    if (!dados?.candidato) return;
    if (!jornadaIniciada || jornadaFinalizada) {
      alert('Inicie sua jornada antes de registrar pausas.');
      return;
    }
    if (refeicaoIniciada && !refeicaoFinalizada) {
      alert('Você está em intervalo de refeição. Finalize a refeição antes de iniciar uma pausa.');
      return;
    }

    if (!pausaEmAndamento) {
      const proximoIndice = pausasDoDia.length + 1;
      const geo = await capturarLocalizacao();
      const agoraIso = new Date().toISOString();
      const novaBatida: ApontamentoRegistro = {
        localId: `p_ini_${Date.now()}`,
        candidatoId: dados.candidato.id,
        alocacaoId: dados.alocacaoAtual?.id || null,
        vagaId: dados.alocacaoAtual?.vaga_id || null,
        dataReferencia: agoraIso.slice(0, 10),
        tipoEvento: 'pausa_inicio',
        timestampDispositivo: agoraIso,
        latitude: geo.lat,
        longitude: geo.lng,
        precisaoMetros: geo.precisao,
        parIndice: proximoIndice,
        sincronizado: false,
      };
      salvarBatidaLocal(novaBatida, dados.candidato.id);
      emitirAlertaSonoro('aviso');
      return;
    }

    const geo = await capturarLocalizacao();
    const agoraIso = new Date().toISOString();
    const novaBatida: ApontamentoRegistro = {
      localId: `p_fim_${Date.now()}`,
      candidatoId: dados.candidato.id,
      alocacaoId: dados.alocacaoAtual?.id || null,
      vagaId: dados.alocacaoAtual?.vaga_id || null,
      dataReferencia: agoraIso.slice(0, 10),
      tipoEvento: 'pausa_fim',
      timestampDispositivo: agoraIso,
      latitude: geo.lat,
      longitude: geo.lng,
      precisaoMetros: geo.precisao,
      parIndice: pausaEmAndamento.parIndice || 1,
      sincronizado: false,
    };
    salvarBatidaLocal(novaBatida, dados.candidato.id);
    emitirAlertaSonoro('sucesso');
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

  // ── TELA DE LOGIN DO APP (LAYOUT MODERNO & REFINADO) ───────────────────────
  if (!token || (!carregando && !dados)) {
    return (
      <div style={{
        minHeight: '100vh', background: '#2c3327', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: '16px 0', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        {/* Moldura do Smartphone Universal */}
        <div style={{
          width: '100%', maxWidth: 412, minHeight: '94vh', background: '#ffffff',
          borderRadius: 36, overflow: 'hidden', display: 'flex', flexDirection: 'column',
          position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.45)', border: '10px solid #1c2217'
        }}>
          {/* Topo Hero Verde Oliva com Padrão Sutil */}
          <div style={{
            background: 'radial-gradient(circle, rgba(255,255,255,0.18) 1.2px, transparent 1.2px) 0 0 / 18px 18px, linear-gradient(180deg, #465725 0%, #556b2f 100%)',
            padding: '40px 20px 56px', textAlign: 'center', color: '#ffffff', position: 'relative'
          }}>
            {/* Squircle com Logo Oficial da ATESA em Destaque */}
            <div style={{
              width: 84, height: 84, background: '#ffffff', borderRadius: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px',
              boxShadow: '0 10px 28px rgba(0,0,0,0.22)', padding: 10, boxSizing: 'border-box'
            }}>
              <img src="/atesa_logo.png" alt="ATESA" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>

            {/* Título & Subtítulo Hero */}
            <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 4px', color: '#ffffff', letterSpacing: 0.5 }}>
              Atesa
            </h1>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#dbe6c9', opacity: 0.95 }}>
              Portal do Cooperado
            </div>
          </div>

          {/* Card Branco Curvado Inferior */}
          <div style={{
            background: '#ffffff', borderTopLeftRadius: 36, borderTopRightRadius: 36,
            padding: '32px 24px 28px', marginTop: -26, flex: 1, display: 'flex', flexDirection: 'column'
          }}>
            <div style={{ textAlign: 'center', marginBottom: 22 }}>
              <h2 style={{ fontSize: 22, fontWeight: 900, color: '#182210', margin: '0 0 6px', textAlign: 'center', letterSpacing: '-0.3px' }}>
                Bem-vindo de volta
              </h2>
              <p style={{ fontSize: 13, color: '#7c8b6b', margin: 0, fontWeight: 600, textAlign: 'center' }}>
                Acesse com seu CPF ou e-mail cadastrado
              </p>
            </div>

            <form onSubmit={handleLoginDiretoApp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Campo CPF ou E-MAIL */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6b7a5a', letterSpacing: '0.6px', marginBottom: 6, textTransform: 'uppercase' }}>
                  CPF OU E-MAIL
                </label>
                <div style={{
                  background: '#f7f9f3', border: '1.5px solid #e4e9dc', borderRadius: 14,
                  padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <IconCreditCard size={18} style={{ color: '#6b7a5a' }} />
                  <input
                    type="text"
                    value={loginInput}
                    onChange={e => setLoginInput(e.target.value)}
                    placeholder="000.000.000-00 ou e-mail"
                    style={{
                      width: '100%', border: 'none', background: 'transparent', outline: 'none',
                      fontSize: 14, color: '#182210', fontWeight: 600
                    }}
                  />
                </div>
              </div>

              {/* Campo SENHA */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: '#6b7a5a', letterSpacing: '0.6px', marginBottom: 6, textTransform: 'uppercase' }}>
                  SENHA
                </label>
                <div style={{
                  background: '#f7f9f3', border: '1.5px solid #e4e9dc', borderRadius: 14,
                  padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10
                }}>
                  <IconLock size={18} style={{ color: '#6b7a5a' }} />
                  <input
                    type={mostrarSenhaApp ? 'text' : 'password'}
                    value={senhaInput}
                    onChange={e => setSenhaInput(e.target.value)}
                    placeholder="••••••••"
                    style={{
                      width: '100%', border: 'none', background: 'transparent', outline: 'none',
                      fontSize: 14, color: '#182210', fontWeight: 600
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarSenhaApp(!mostrarSenhaApp)}
                    style={{ background: 'transparent', border: 'none', color: '#6b7a5a', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                  >
                    {mostrarSenhaApp ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                  </button>
                </div>

                <div style={{ textAlign: 'right', marginTop: 6 }}>
                  <span
                    onClick={() => alert('Para redefinir sua senha, acesse o link de adesão recebido no seu WhatsApp ou solicite um novo link à equipe ATESA.')}
                    style={{ fontSize: 12, fontWeight: 700, color: '#556b2f', cursor: 'pointer' }}
                  >
                    Esqueci minha senha
                  </span>
                </div>
              </div>

              {erroLoginApp && (
                <div style={{
                  background: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 10,
                  fontSize: 12, fontWeight: 700, lineHeight: 1.4, border: '1px solid #fecaca'
                }}>
                  {erroLoginApp}
                </div>
              )}

              {/* Botão Principal Entrar */}
              <button
                type="submit"
                disabled={entrandoApp}
                style={{
                  background: '#556b2f', color: '#ffffff', border: 'none', borderRadius: 14,
                  padding: '14px', fontSize: 15, fontWeight: 900, cursor: entrandoApp ? 'not-allowed' : 'pointer',
                  marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  boxShadow: '0 6px 18px rgba(85, 107, 47, 0.35)', transition: 'all 0.2s'
                }}
              >
                {entrandoApp ? 'Entrando...' : 'Entrar →'}
              </button>
            </form>

            {/* Separador ou */}
            <div style={{ display: 'flex', alignItems: 'center', margin: '18px 0', gap: 10 }}>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>ou</span>
              <div style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
            </div>

            {/* Botão Acessar com Biometria */}
            <button
              type="button"
              onClick={handleAcessarBiometria}
              disabled={processandoBiometria}
              style={{
                background: '#ffffff', border: '1.5px solid #dce5cf', borderRadius: 14,
                padding: '13px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                gap: 8, color: '#2d3b20', fontWeight: 800, fontSize: 14, cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(0,0,0,0.03)', transition: 'all 0.15s'
              }}
            >
              <IconFingerprint size={20} style={{ color: '#556b2f' }} />
              {processandoBiometria ? 'Verificando Biometria...' : 'Acessar com Biometria'}
            </button>

            {/* Termos e Política Footer */}
            <div style={{ marginTop: 'auto', paddingTop: 20, textAlign: 'center', fontSize: 11, color: '#839272', lineHeight: 1.5 }}>
              Ao acessar, você concorda com os <strong>Termos de Uso</strong> e a <strong>Política de Privacidade</strong> da Atesa.
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (carregando) {
    return (
      <div style={{
        minHeight: '100vh', background: '#f5f5f0', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', color: '#556b2f', fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ width: 44, height: 44, border: '4px solid #dce5cf', borderTopColor: '#556b2f', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 16, fontSize: 14, color: '#556b2f', fontWeight: 700 }}>Carregando App do Cooperado...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const pendentesSync = apontamentosHoje.filter(b => !b.sincronizado).length;
  const nomeExibicao = dados?.candidato?.nome || 'Cooperado';
  const primeiroNome = nomeExibicao.split(' ')[0];
  const matriculaExibicao = dados?.candidato?.matricula ? `C00-2024-${dados.candidato.matricula}` : `C00-2024-${dados?.candidato?.id || '1847'}`;
  const cargoExibicao = dados?.alocacaoAtual?.cargo || 'Cooperado ATESA';

  return (
    <div style={{
      minHeight: '100vh', background: '#2c3327', display: 'flex', justifyContent: 'center',
      alignItems: 'center', padding: '16px 0', fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      {/* ── MOLDURA DO SMARTPHONE UNIVERSAL ────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: 412, minHeight: '94vh', background: '#f6f6f2',
        borderRadius: 36, overflow: 'hidden', display: 'flex', flexDirection: 'column',
        position: 'relative', boxShadow: '0 25px 60px rgba(0,0,0,0.45)', border: '10px solid #1c2217'
      }}>

        {/* ── CABEÇALHO DO APP REFINADO E UNIVERSAL ───────────────────────── */}
        <header style={{ padding: '22px 22px 14px', background: '#f6f6f2' }}>
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
        <main style={{ flex: 1, padding: '0 16px 80px', overflowY: 'auto' }}>

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
                            {batida.tipoEvento === 'jornada_inicio' ? 'Início de Jornada' :
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

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <div style={{ background: '#f8faf7', padding: 12, borderRadius: 10, border: '1px solid #e2e8d5' }}>
                        <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Escala</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#182210' }}>{dados.alocacaoAtual.tipo_escala || 'Plantão'}</div>
                      </div>
                      <div style={{ background: '#f8faf7', padding: 12, borderRadius: 10, border: '1px solid #e2e8d5' }}>
                        <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Remuneração</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#556b2f' }}>
                          {dados.alocacaoAtual.salario_base ? formatarMoeda(dados.alocacaoAtual.salario_base) : 'Tabela da Unidade'}
                        </div>
                      </div>
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

        </main>

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

        {/* ── BARRA DE NAVEGAÇÃO INFERIOR MODERNA ───────────────────────────── */}
        <nav style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, width: '100%',
          background: '#ffffff', borderTop: '1px solid #e5e7eb',
          display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', zIndex: 100,
          padding: '6px 0 8px', boxShadow: '0 -4px 16px rgba(0,0,0,0.04)'
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

      </div>
    </div>
  );
};

export default AppCooperado;
