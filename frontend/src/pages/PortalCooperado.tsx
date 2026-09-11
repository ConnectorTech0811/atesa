import React, { useEffect, useState, useRef } from 'react';
import { IonPage, IonContent, IonButton } from '@ionic/react';
import {
  obterPortalCooperado,
  aceitarVagaPortal,
  declinarVagaPortal,
  definirSenhaPortal,
  registrarVideoConcluidoPortal,
  salvarAdesaoCompletaPortal,
  enviarDocumentoPortal,
  urlDownloadDocumento,
  DadosPortalCooperado,
  DadosSensiveis,
  DadosBancarios,
  ContatosEmergencia,
  TipoDocumento,
  AlocacaoDetalhada,
  ROTULO_TIPO_DOC,
} from '../api/beneficiosApi';
import { buscarEnderecoPorCep, formatarCEP, formatarCPF, formatarDataBR, formatarMoeda } from '../utils/formatters';
import {
  IconCheckCircle, IconX, IconUpload, IconEye,
  IconCheck, IconChevronDown, IconChevronUp,
} from '../components/Icons';

// ── Lista de Documentos da Aba 4 ──────────────────────────────────────────────
const CARDS_DOCUMENTOS: {
  tipo: TipoDocumento;
  titulo: string;
  desc: string;
  obrigatorio: boolean;
  icon: string;
}[] = [
  { tipo: 'foto_3x4', titulo: 'Foto 3x4 (Fundo Branco)', desc: 'Foto nítida e recente de rosto com fundo claro', obrigatorio: true, icon: '📸' },
  { tipo: 'rg_frente', titulo: 'RG / CNH (Frente)', desc: 'Documento oficial de identificação (frente aberta)', obrigatorio: true, icon: '🪪' },
  { tipo: 'rg_verso', titulo: 'RG (Verso)', desc: 'Verso do documento contendo filiação e CPF', obrigatorio: true, icon: '🪪' },
  { tipo: 'cpf', titulo: 'CPF', desc: 'Comprovante cadastral ou cartão de CPF', obrigatorio: true, icon: '📄' },
  { tipo: 'comprovante_residencia', titulo: 'Comprovante de Residência', desc: 'Conta de água, luz ou gás recente (máx. 90 dias)', obrigatorio: true, icon: '🏠' },
  { tipo: 'comprovante_bancario', titulo: 'Comprovante Bancário', desc: 'Extrato, cartão ou print do app com conta e agência', obrigatorio: true, icon: '🏦' },
  { tipo: 'cnh', titulo: 'CNH (se aplicável)', desc: 'Carteira Nacional de Habilitação para condutores', obrigatorio: false, icon: '🚗' },
  { tipo: 'certificado', titulo: 'Certificado / Diploma', desc: 'Comprovante de graduação ou curso técnico', obrigatorio: false, icon: '🎓' },
];

// ── Metadados das 13 Seções da Aba de Adesão Completa ─────────────────────────
interface MetadadosSecao {
  id: number;
  num: string;
  titulo: string;
  paginas: string;
  icon: string;
}

const SECOES_ADESAO: MetadadosSecao[] = [
  { id: 1, num: '01', titulo: 'Identificação & Dados Cadastrais', paginas: 'Págs. 2 e 3', icon: '👤' },
  { id: 2, num: '02', titulo: 'Contatos de Emergência & Histórico', paginas: 'Pág. 3', icon: '🚨' },
  { id: 3, num: '03', titulo: 'Cota-Parte & Dados Bancários', paginas: 'Pág. 4', icon: '🏦' },
  { id: 4, num: '04', titulo: 'Ata de Palestra Cooperativista', paginas: 'Pág. 5', icon: '🎓' },
  { id: 5, num: '05', titulo: 'Declaração Estatutária (10 Itens)', paginas: 'Pág. 6', icon: '📜' },
  { id: 6, num: '06', titulo: 'Questionário aos Associados (12 Q)', paginas: 'Pág. 7', icon: '❓' },
  { id: 7, num: '07', titulo: 'Autorização de Descontos & Convênios', paginas: 'Pág. 8', icon: '💳' },
  { id: 8, num: '08', titulo: 'Termo de Adesão a Contrato', paginas: 'Pág. 9', icon: '🤝' },
  { id: 9, num: '09', titulo: 'Termo de Confidencialidade e Sigilo', paginas: 'Pág. 10', icon: '🔒' },
  { id: 10, num: '10', titulo: 'Consentimento de Dados LGPD', paginas: 'Págs. 11 a 13', icon: '🛡️' },
  { id: 11, num: '11', titulo: 'Geolocalização & Apontamento no App', paginas: 'Pág. 14', icon: '📍' },
  { id: 12, num: '12', titulo: 'Beneficiários do Seguro MetLife', paginas: 'Pág. 15', icon: '👥' },
  { id: 13, num: '13', titulo: 'Resumo Geral & Conferência da Ficha', paginas: 'Resumo Consolidado', icon: '📋' },
];

export const PortalCooperado: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [dados, setDados] = useState<DadosPortalCooperado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // ── Abas Principais ────────────────────────────────────────────────────────
  type AbaPortal = 'vaga' | 'video' | 'adesao' | 'documentos' | 'app';
  const [aba, setAba] = useState<AbaPortal>('vaga');

  // ── Seção Ativa da Sidebar na Aba 3 ────────────────────────────────────────
  const [secaoAtiva, setSecaoAtiva] = useState<number>(1);
  const [menuSecoesMobileAberto, setMenuSecoesMobileAberto] = useState(false);

  // ── Estados do Formulário de Adesão Completa ───────────────────────────────
  const [ds, setDs] = useState<DadosSensiveis>({});
  const [db, setDb] = useState<DadosBancarios>({});
  const [emergencia, setEmergencia] = useState<ContatosEmergencia>({});
  const [dadosAdesaoJson, setDadosAdesaoJson] = useState<any>({
    palestraAta: {
      formato: '', // 'presencial' | 'online'
      concorda: false,
    },
    estatutario: {
      item1: '',
      item2: '',
      item3: '',
      item4: '',
      item5: '',
      item6: '',
      item7: '',
      item8: '',
      item9: '',
      item10: '',
      concorda_declaracao: false,
    },
    questionario: {
      q1: '',
      q2: '',
      q3: '',
      q4: '',
      q5: '',
      q6: '',
      q7: '',
      q8: '',
      q9: '',
      q10: '',
      q11: '',
      q12: '',
    },
    autorizacoes: {
      desconto_quota: false,
      desconto_rateio: false,
      desconto_inss: false,
      convenios_opcionais: [] as string[],
      concorda_descontos: false,
    },
    termoAdesaoContrato: {
      concorda: false,
    },
    termoConfidencialidade: {
      concorda: false,
    },
    termoLgpd: {
      concorda: false,
    },
    termoGeolocalizacao: {
      concorda: false,
    },
    beneficiariosSeguro: [
      { nome: '', parentesco: '', cpf: '', data_nascimento: '', percentual: '100' },
    ],
  });

  // ── Estados de Vídeo ───────────────────────────────────────────────────────
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoAssistido, setVideoAssistido] = useState(false);
  const [videoProgressoPercentual, setVideoProgressoPercentual] = useState(0);
  const [videoTempoAtual, setVideoTempoAtual] = useState(0);
  const [videoDuracao, setVideoDuracao] = useState(348); // ~5:48 min
  const maxWatchedTimeRef = useRef<number>(0);
  const [registrandoVideo, setRegistrandoVideo] = useState(false);
  const [modalDeclaracaoAberto, setModalDeclaracaoAberto] = useState(false);

  // ── Impressão da Folha Oficial Limpa (A4) ──────────────────────────────────
  const imprimirFolhaOficial = () => {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.id = 'print-iframe-declaracao';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      window.open('/documentos/declaracao_pagina_1.png', '_blank');
      return;
    }

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Declaração de Livre Adesão - ATESA</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 4mm;
            }
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            html, body {
              width: 100%;
              height: 100%;
              background: #fff;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            img {
              max-width: 100%;
              max-height: 100%;
              width: auto;
              height: auto;
              object-fit: contain;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="/documentos/declaracao_pagina_1.png" onload="setTimeout(function() { window.focus(); window.print(); }, 250);" />
        </body>
      </html>
    `);
    doc.close();

    setTimeout(() => {
      try {
        const el = document.getElementById('print-iframe-declaracao');
        if (el) document.body.removeChild(el);
      } catch {}
    }, 60000);
  };

  // ── Ações e Uploads ────────────────────────────────────────────────────────
  const [salvandoAdesao, setSalvandoAdesao] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [aceitandoVaga, setAceitandoVaga] = useState(false);
  const [vagaAceita, setVagaAceita] = useState(false);
  const [uploadingTipo, setUploadingTipo] = useState<TipoDocumento | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tipoSelecionadoUpload, setTipoSelecionadoUpload] = useState<TipoDocumento>('foto_3x4');

  // Estados de Declínio de Vaga
  const [modalDeclinarAberto, setModalDeclinarAberto] = useState(false);
  const [motivoRecusa, setMotivoRecusa] = useState('');
  const [declinandoVaga, setDeclinandoVaga] = useState(false);
  const [vagaDeclinada, setVagaDeclinada] = useState(false);

  // Estados de Senha do App
  const [senhaApp, setSenhaApp] = useState('');
  const [confirmarSenhaApp, setConfirmarSenhaApp] = useState('');
  const [salvandoSenhaApp, setSalvandoSenhaApp] = useState(false);
  const [senhaSalvaSucesso, setSenhaSalvaSucesso] = useState(false);
  const [erroSenhaApp, setErroSenhaApp] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setErro('Token de acesso não informado. Utilize o link enviado por WhatsApp ou E-mail.');
      setCarregando(false);
      return;
    }
    setToken(t);
    carregarDados(t);
  }, []);

  const carregarDados = async (tokenAcesso: string) => {
    setCarregando(true);
    setErro('');
    try {
      const res = await obterPortalCooperado(tokenAcesso);
      setDados(res);
      setDs(res.dadosSensiveis ?? {});
      setDb(res.dadosBancarios ?? {});
      if (res.contatosEmergencia) {
        setEmergencia(res.contatosEmergencia);
      }
      if (res.propostaAdesao?.dados_json_parsed) {
        setDadosAdesaoJson((prev: any) => ({
          ...prev,
          ...res.propostaAdesao?.dados_json_parsed,
        }));
      }

      const vDeclinada = Boolean(
        res.statusGeral?.vagaDeclinada ||
        res.propostaAdesao?.status_adesao === 'declinada' ||
        (res.alocacaoAtual && (res.alocacaoAtual.status === 'encerrada' || res.alocacaoAtual.status === 'recusada' || res.alocacaoAtual.status === 'declinada') && String(res.alocacaoAtual.observacoes || '').includes('Vaga Recusada')) ||
        res.candidato.status === 2
      );
      const vAceita = Boolean(
        !vDeclinada && (
          res.statusGeral?.vagaAceita ||
          res.propostaAdesao?.vaga_aceita_em ||
          res.propostaAdesao?.video_assistido_em ||
          (res.propostaAdesao?.status_adesao && !['pendente', 'declinada'].includes(res.propostaAdesao.status_adesao))
        )
      );
      const vAssistido = Boolean(!vDeclinada && vAceita && (res.propostaAdesao?.video_assistido_em || res.statusGeral?.videoAssistido));
      const decEnviada = Boolean(!vDeclinada && vAssistido && (res.propostaAdesao?.declaracao_enviada_em || res.statusGeral?.declaracaoEnviada || res.documentos?.some((d) => d.tipo === 'declaracao_adesao')));
      const adPreenchida = Boolean(!vDeclinada && vAssistido && decEnviada && (res.statusGeral?.adesaoPreenchida || res.propostaAdesao?.dados_json || res.propostaAdesao?.status_adesao === 'adesao_preenchida' || res.propostaAdesao?.status_adesao === 'homologado_100'));

      setVagaDeclinada(vDeclinada);
      setVagaAceita(vAceita);
      setVideoAssistido(vAssistido);
      if (vAssistido) {
        setVideoProgressoPercentual(100);
      }

      // Auto-navegação para a aba correta se a atual estiver bloqueada
      setAba((abaAtual) => {
        if (!vAceita || vDeclinada) return 'vaga';
        if (!vAssistido || !decEnviada) return 'video';
        if (!adPreenchida) return 'adesao';
        const docsObr = ['foto_3x4', 'rg_frente', 'rg_verso', 'cpf', 'comprovante_residencia', 'comprovante_bancario'];
        const todosDocs = docsObr.every((k) => res.documentos?.some((d) => d.tipo === k));
        if (!todosDocs) return 'documentos';
        return abaAtual || 'app';
      });
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar dados do cooperado.');
    } finally {
      setCarregando(false);
    }
  };

  // ── Controles de Vídeo ─────────────────────────────────────────────────────
  const handleVideoTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;
    const duration = videoRef.current.duration || 348;
    setVideoDuracao(duration);
    setVideoTempoAtual(current);

    // Impede o usuário de avançar o vídeo para além do tempo já assistido
    if (current > maxWatchedTimeRef.current + 1.5) {
      videoRef.current.currentTime = maxWatchedTimeRef.current;
    } else {
      maxWatchedTimeRef.current = Math.max(maxWatchedTimeRef.current, current);
    }

    const pct = Math.min(100, Math.floor((maxWatchedTimeRef.current / duration) * 100));
    setVideoProgressoPercentual(pct);

    // Se assistiu mais de 98% do vídeo ou terminou
    if (current >= duration - 2 && !videoAssistido && !registrandoVideo) {
      finalizarVideo();
    }
  };

  const handleVideoSeeking = () => {
    if (!videoRef.current) return;
    if (videoRef.current.currentTime > maxWatchedTimeRef.current) {
      videoRef.current.currentTime = maxWatchedTimeRef.current;
    }
  };

  const finalizarVideo = async () => {
    setRegistrandoVideo(true);
    try {
      await registrarVideoConcluidoPortal(token);
      setVideoAssistido(true);
      setVideoProgressoPercentual(100);
      setMensagemSucesso('🎉 Vídeo da Palestra ATESA concluído! Agora preencha e envie a Declaração de Livre Adesão.');
      await carregarDados(token);
    } catch (e: any) {
      console.error(e);
    } finally {
      setRegistrandoVideo(false);
    }
  };

  const formatarTempo = (segundos: number) => {
    const mins = Math.floor(segundos / 60);
    const secs = Math.floor(segundos % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ── CEP ────────────────────────────────────────────────────────────────────
  const handleCep = async (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 8);
    const cepFormatado = formatarCEP(limpo);
    setDs(p => ({ ...p, cep: cepFormatado }));
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCep(limpo);
      if (end) {
        setDs(p => ({
          ...p,
          logradouro: end.rua || p.logradouro,
          bairro: end.bairro || p.bairro,
          cidade: end.cidade ?? p.cidade,
          uf: end.uf ?? p.uf,
        }));
      }
    } catch {}
    finally { setBuscandoCep(false); }
  };

  // ── Aceitar Vaga ───────────────────────────────────────────────────────────
  const handleAceitarVaga = async () => {
    setAceitandoVaga(true);
    setMensagemSucesso('');
    setErro('');
    try {
      await aceitarVagaPortal(token);
      setVagaAceita(true);
      setMensagemSucesso('🎉 Vaga aceita com sucesso! Assista ao vídeo institucional abaixo para prosseguir com a adesão.');
      await carregarDados(token);
      setAba('video');
    } catch (e: any) {
      setErro(e.message || 'Erro ao aceitar a vaga.');
    } finally {
      setAceitandoVaga(false);
    }
  };

  // ── Declinar Vaga ──────────────────────────────────────────────────────────
  const handleDeclinarVaga = async () => {
    setDeclinandoVaga(true);
    setErro('');
    try {
      await declinarVagaPortal(token, motivoRecusa, alocacaoAtual?.id);
      setVagaDeclinada(true);
      setModalDeclinarAberto(false);
      setMensagemSucesso('Vaga declinada com sucesso. Agradecemos pelo seu retorno!');
      await carregarDados(token);
    } catch (e: any) {
      setErro(e.message || 'Erro ao declinar vaga.');
    } finally {
      setDeclinandoVaga(false);
    }
  };

  // ── Salvar Senha do App ───────────────────────────────────────────────────
  const handleSalvarSenhaApp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!senhaApp || senhaApp.length < 6) {
      setErroSenhaApp('A senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (senhaApp !== confirmarSenhaApp) {
      setErroSenhaApp('As senhas digitadas não coincidem.');
      return;
    }
    setSalvandoSenhaApp(true);
    setErroSenhaApp('');
    try {
      await definirSenhaPortal(token, senhaApp);
      setSenhaSalvaSucesso(true);
      setMensagemSucesso('Senha do App cadastrada com sucesso! Você já pode realizar o login no App do Cooperado.');
    } catch (e: any) {
      setErroSenhaApp(e.message || 'Erro ao cadastrar senha.');
    } finally {
      setSalvandoSenhaApp(false);
    }
  };

  // ── Salvar Adesão Completa (Aba 3) ─────────────────────────────────────────
  const handleSalvarAdesaoCompleta = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSalvandoAdesao(true);
    setMensagemSucesso('');
    setErro('');

    // Validações essenciais
    if (!ds.rg || !ds.data_nascimento || !ds.nome_mae) {
      setErro('Por favor, preencha os dados pessoais obrigatórios na Seção 1 (RG, Data de Nascimento, Nome da Mãe).');
      setSecaoAtiva(1);
      setSalvandoAdesao(false);
      return;
    }
    if (!emergencia.nome_1 || !emergencia.telefone_1) {
      setErro('Por favor, preencha o contato de emergência principal na Seção 2 (Nome e Telefone).');
      setSecaoAtiva(2);
      setSalvandoAdesao(false);
      return;
    }
    if (!db.banco || !db.conta || !db.agencia) {
      setErro('Por favor, informe os dados bancários completos na Seção 3 para recebimento dos repasses.');
      setSecaoAtiva(3);
      setSalvandoAdesao(false);
      return;
    }

    try {
      await salvarAdesaoCompletaPortal(token, {
        dadosSensiveis: ds,
        dadosBancarios: db,
        contatosEmergencia: emergencia,
        dadosJson: dadosAdesaoJson,
      });
      setMensagemSucesso('✓ Proposta de Adesão Completa salva com sucesso! Agora avance para o envio de documentos.');
      await carregarDados(token);
      setAba('documentos');
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar proposta de adesão.');
    } finally {
      setSalvandoAdesao(false);
    }
  };

  // ── Upload de Documentos ───────────────────────────────────────────────────
  const triggerUpload = (tipo: TipoDocumento) => {
    setTipoSelecionadoUpload(tipo);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTipo(tipoSelecionadoUpload);
    setMensagemSucesso('');
    setErro('');
    try {
      await enviarDocumentoPortal(token, tipoSelecionadoUpload, file);
      setMensagemSucesso(`Documento "${ROTULO_TIPO_DOC[tipoSelecionadoUpload]}" enviado com sucesso!`);
      await carregarDados(token);
      if (tipoSelecionadoUpload === 'declaracao_adesao') {
        setModalDeclaracaoAberto(false);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao enviar documento.');
    } finally {
      setUploadingTipo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Verificadores de Conclusão de cada Seção ────────────────────────────────
  const isSecaoConcluida = (id: number): boolean => {
    switch (id) {
      case 1:
        return Boolean(ds.rg && ds.data_nascimento && ds.nome_mae);
      case 2:
        return Boolean(emergencia.nome_1 && emergencia.telefone_1);
      case 3:
        return Boolean(db.banco && db.agencia && db.conta);
      case 4:
        return Boolean(dadosAdesaoJson.palestraAta?.concorda);
      case 5: {
        const est = dadosAdesaoJson.estatutario || {};
        return Boolean(
          est.item1 && est.item2 && est.item3 && est.item4 && est.item5 &&
          est.item6 && est.item7 && est.item8 && est.item9 && est.item10
        );
      }
      case 6: {
        const q = dadosAdesaoJson.questionario || {};
        return Boolean(
          q.q1 && q.q2 && q.q3 && q.q4 && q.q5 && q.q6 &&
          q.q7 && q.q8 && q.q9 && q.q10 && q.q11 && q.q12
        );
      }
      case 7:
        return Boolean(
          dadosAdesaoJson.autorizacoes?.concorda_descontos ||
          (dadosAdesaoJson.autorizacoes?.desconto_quota && dadosAdesaoJson.autorizacoes?.desconto_rateio && dadosAdesaoJson.autorizacoes?.desconto_inss)
        );
      case 8:
        return Boolean(dadosAdesaoJson.termoAdesaoContrato?.concorda);
      case 9:
        return Boolean(dadosAdesaoJson.termoConfidencialidade?.concorda);
      case 10:
        return Boolean(dadosAdesaoJson.termoLgpd?.concorda);
      case 11:
        return Boolean(dadosAdesaoJson.termoGeolocalizacao?.concorda);
      case 12:
        return Boolean(dadosAdesaoJson.beneficiariosSeguro?.[0]?.nome && dadosAdesaoJson.beneficiariosSeguro?.[0]?.parentesco);
      case 13:
        return true;
      default:
        return false;
    }
  };

  const secoesPreenchidasCount = SECOES_ADESAO.filter(s => s.id !== 13 && isSecaoConcluida(s.id)).length;

  // ── Detecção de SO / Download do App ───────────────────────────────────────
  const abrirGooglePlay = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.open('https://play.google.com/store/search?q=ATESA+Cooperativa&c=apps', '_blank');
  };

  const abrirAppStore = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    window.open('https://apps.apple.com/br/search?term=ATESA+Cooperativa', '_blank');
  };

  if (carregando) {
    return (
      <IonPage>
        <IonContent scrollY={false} style={{ '--background': '#f4f6fa' }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ textAlign: 'center', color: '#1b5e20' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Carregando Portal do Cooperado...</div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (erro && !dados) {
    return (
      <IonPage>
        <IonContent scrollY={true} style={{ '--background': '#f4f6fa' }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 40, color: '#c62828', marginBottom: 12 }}>⚠️</div>
              <h2 style={{ fontSize: 18, color: '#222', margin: '0 0 10px' }}>Acesso ao Portal</h2>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>{erro}</p>
              <IonButton color="secondary" shape="round" onClick={() => window.location.reload()}>Tentar novamente</IonButton>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const { candidato, alocacaoAtual, documentos = [], statusGeral } = dados!;
  const homologado100 = Boolean(statusGeral?.homologado100);
  const isVideoAssistido = Boolean(videoAssistido || statusGeral?.videoAssistido || dados?.propostaAdesao?.video_assistido_em);
  const isDeclaracaoEnviada = Boolean(isVideoAssistido && (statusGeral?.declaracaoEnviada || dados?.propostaAdesao?.declaracao_enviada_em || documentos.some((d) => d.tipo === 'declaracao_adesao')));
  const isAdesaoPreenchida = Boolean(
    isVideoAssistido &&
    isDeclaracaoEnviada &&
    (statusGeral?.adesaoPreenchida || (dados?.propostaAdesao?.dados_json && (dados?.propostaAdesao?.status_adesao === 'adesao_preenchida' || dados?.propostaAdesao?.status_adesao === 'homologado_100')))
  );
  const declaracaoEnviada = isDeclaracaoEnviada;
  const docsObrigatoriosKeys = ['foto_3x4', 'rg_frente', 'rg_verso', 'cpf', 'comprovante_residencia', 'comprovante_bancario'];
  const docsObrigatoriosEnviadosCount = docsObrigatoriosKeys.filter((k) => documentos.some((d) => d.tipo === k)).length;
  const todosObrigatoriosProntos = isAdesaoPreenchida && docsObrigatoriosEnviadosCount === 6;

  const vagaFoiDeclinada = Boolean(
    vagaDeclinada ||
    statusGeral?.vagaDeclinada ||
    (alocacaoAtual && (alocacaoAtual.status === 'encerrada' || alocacaoAtual.status === 'recusada' || alocacaoAtual.status === 'declinada') && String(alocacaoAtual.observacoes || '').includes('Vaga Recusada')) ||
    candidato?.status === 2
  );

  // ── SE VAGA DECLINADA: BLOQUEIO TOTAL E TELA DE PROCESSO ENCERRADO ─────────
  if (vagaFoiDeclinada) {
    return (
      <IonPage>
        <IonContent scrollY={true} style={{ '--background': '#f4f6fa' }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', maxWidth: 540, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(0,0,0,0.08)', border: '1.5px solid #fed7aa' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <img src="/atesa_logo.png" alt="ATESA" style={{ height: 48, objectFit: 'contain' }} />
              </div>
              
              <div style={{ fontSize: 52, marginBottom: 16 }}>🤝</div>
              
              <span style={{ display: 'inline-block', padding: '6px 16px', background: '#fef3c7', color: '#92400e', borderRadius: 20, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>
                Processo de Adesão Encerrado
              </span>
              
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1f2937', margin: '0 0 12px' }}>
                Oportunidade Declinada
              </h1>
              
              <p style={{ fontSize: 15, color: '#4b5563', lineHeight: 1.6, margin: '0 0 20px' }}>
                Olá, <strong>{candidato.nome.split(' ')[0]}</strong>. Você optou por declinar a oportunidade para a vaga de <strong>{alocacaoAtual?.cargo || 'Cooperado'}</strong>{alocacaoAtual?.nome_unidade ? ` na unidade ${alocacaoAtual.nome_unidade}` : ''}.
              </p>

              <div style={{ background: '#fffbeb', borderRadius: 12, padding: '18px 20px', border: '1px solid #fde68a', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: '#b45309', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  Status da Vaga
                </div>
                <div style={{ fontSize: 14, color: '#78350f', lineHeight: 1.5 }}>
                  A vaga foi devolvida ao banco de oportunidades da Cooperativa ATESA e a equipe de Recrutamento & Alocação (RA) foi notificada para nova seleção.
                </div>
                <div style={{ fontSize: 12, color: '#92400e', marginTop: 8 }}>
                  ✅ Seus dados cadastrais continuarão em nosso banco de talentos para futuras oportunidades compatíveis com seu perfil.
                </div>
              </div>

              <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 24px' }}>
                Por medidas de conformidade e segurança, o acesso às demais etapas (vídeo institucional, declaração, documentos e app) foi bloqueado para este processo.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => window.location.href = 'https://atesa.com.br'}
                  style={{
                    background: '#556b2f', color: '#fff', border: 'none', borderRadius: 10,
                    padding: '14px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(85,107,47,0.25)',
                  }}
                >
                  Conhecer mais sobre a ATESA
                </button>
              </div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  // ── SE HOMOLOGADO 100%: BLOQUEIO E REDIRECIONAMENTO COM TELA DE SUCESSO ──────
  if (homologado100) {
    return (
      <IonPage>
        <IonContent scrollY={true} style={{ '--background': '#f4f7fb' }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ background: '#fff', borderRadius: 16, padding: '40px 32px', maxWidth: 540, width: '100%', textAlign: 'center', boxShadow: '0 8px 32px rgba(27,94,32,0.15)', border: '2px solid #2e7d32' }}>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                <img src="/atesa_logo.png" alt="ATESA" style={{ height: 48, objectFit: 'contain' }} />
              </div>
              <div style={{ fontSize: 56, marginBottom: 16 }}>🎉</div>
              <span style={{ display: 'inline-block', padding: '6px 16px', background: '#e8f5e9', color: '#1b5e20', borderRadius: 20, fontSize: 13, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 }}>
                Adesão 100% Homologada
              </span>
              <h1 style={{ fontSize: 24, fontWeight: 800, color: '#1b5e20', margin: '0 0 10px' }}>
                Parabéns, {candidato.nome.split(' ')[0]}!
              </h1>
              <p style={{ fontSize: 15, color: '#444', lineHeight: 1.6, margin: '0 0 20px' }}>
                Seu cadastro e proposta de adesão foram homologados com sucesso pela cooperativa <strong>{candidato.cooperativa}</strong>.
              </p>

              <div style={{ background: '#f0f9f1', borderRadius: 12, padding: '18px 20px', border: '1px solid #c8e6c9', marginBottom: 24, textAlign: 'left' }}>
                <div style={{ fontSize: 12, color: '#2e7d32', fontWeight: 700, textTransform: 'uppercase' }}>Sua Matrícula Oficial</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#1b5e20', marginTop: 4 }}>
                  #{candidato.matricula || 'Homologada'}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginTop: 6 }}>
                  Sua ficha de admissão está finalizada e seu acesso ao sistema e escalas já está ativo.
                </div>
              </div>

              <p style={{ fontSize: 13, color: '#777', marginBottom: 24 }}>
                Para sua segurança, a edição de documentos neste portal de adesão foi concluída. Acesse agora suas escalas pelo aplicativo oficial.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  onClick={() => window.location.href = '/cooperado/app'}
                  style={{
                    background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 10,
                    padding: '14px 24px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(27,94,32,0.3)',
                  }}
                >
                  Abrir App do Cooperado →
                </button>
                <button
                  onClick={() => abrirGooglePlay()}
                  style={{
                    background: '#f1f5f9', color: '#333', border: '1px solid #cbd5e1', borderRadius: 10,
                    padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  📱 Baixar Aplicativo ATESA
                </button>
              </div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonContent scrollY={true} style={{ '--background': '#f4f7fb', height: '100%' }}>
        <style>{`
          .portal-tabs-container {
            display: flex;
            gap: 6px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            -ms-overflow-style: none;
            padding: 6px;
            background: #fff;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            margin-bottom: 20px;
          }
          .portal-tabs-container::-webkit-scrollbar {
            display: none;
          }
          .portal-tab-btn {
            flex: 1 1 auto;
            min-width: 140px;
            padding: 10px 14px;
            border-radius: 8px;
            border: none;
            font-size: 13px;
            font-weight: 600;
            white-space: nowrap;
            cursor: pointer;
            transition: all 0.2s;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          }
          @media (min-width: 769px) {
            .adesao-layout-split {
              display: flex;
              gap: 18px;
              align-items: flex-start;
            }
            .secoes-sidebar-desktop {
              width: 280px;
              max-width: 280px;
              flex-shrink: 0;
              display: flex;
              flex-direction: column;
              gap: 6px;
              background: #fff;
              border-radius: 12px;
              padding: 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.06);
              position: sticky;
              top: 16px;
            }
            .secoes-nav-mobile {
              display: none !important;
            }
            .secao-painel-conteudo {
              flex: 1;
              min-width: 0;
              background: #fff;
              border-radius: 12px;
              padding: 24px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
          }
          @media (max-width: 768px) {
            .portal-header-box {
              padding: 18px 14px 22px !important;
            }
            .portal-main-box {
              padding: 0 10px !important;
              margin-top: -12px !important;
            }
            .portal-tabs-container {
              padding: 4px;
              gap: 4px;
              margin-bottom: 14px;
            }
            .portal-tab-btn {
              min-width: max-content !important;
              flex: 0 0 auto !important;
              padding: 8px 12px !important;
              font-size: 12px !important;
            }
            .adesao-layout-split {
              display: block !important;
            }
            .secoes-sidebar-desktop {
              display: none !important;
            }
            .secoes-nav-mobile {
              display: block !important;
              margin-bottom: 14px;
            }
            .secao-painel-conteudo {
              width: 100% !important;
              padding: 16px 14px !important;
              background: #fff;
              border-radius: 12px;
              box-shadow: 0 2px 8px rgba(0,0,0,0.06);
            }
            .secao-grid-responsive {
              grid-template-columns: 1fr !important;
            }
            input, select, textarea {
              font-size: 14px !important;
            }
          }
        `}</style>
        <div style={{ minHeight: '100%', paddingBottom: 60, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#222' }}>

          {/* Input de arquivo invisível */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Top Header */}
          <header className="portal-header-box" style={{ background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', color: '#fff', padding: '24px 20px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700 }}>
                  Cooperativa {candidato.cooperativa} · Portal de Adesão
                </div>
                <h1 style={{ fontSize: 24, margin: '4px 0 2px', fontWeight: 800 }}>
                  Olá, {candidato.nome.split(' ')[0]}! 👋
                </h1>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  CPF: {formatarCPF(candidato.cpf)} {candidato.matricula && `· Matrícula: #${candidato.matricula}`}
                </div>
              </div>
              {alocacaoAtual && (
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 16px', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700 }}>Vaga Selecionada</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{alocacaoAtual.cargo}</div>
                  {alocacaoAtual.cbo && <div style={{ fontSize: 11, opacity: 0.85 }}>CBO: {alocacaoAtual.cbo}</div>}
                </div>
              )}
            </div>
          </header>

          {/* Container principal */}
          <main className="portal-main-box" style={{ maxWidth: 1100, margin: '-16px auto 40px', padding: '0 16px' }}>

            {/* Alertas */}
            {mensagemSucesso && (
              <div style={{ background: '#0a3622', border: '2px solid #198754', borderRadius: 10, padding: '14px 18px', color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>✅</span>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{mensagemSucesso}</div>
                </div>
                <button onClick={() => setMensagemSucesso('')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            )}
            {erro && (
              <div style={{ background: '#58151c', border: '2px solid #ea868f', borderRadius: 10, padding: '14px 18px', color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>⚠️</span>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{erro}</div>
                </div>
                <button onClick={() => setErro('')} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>✕</button>
              </div>
            )}

            {/* Barra de Progresso Geral */}
            <div style={{ background: '#fff', borderRadius: 12, padding: '14px 20px', marginBottom: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Progresso Geral da Adesão</span>
                <span style={{ fontSize: 13, fontWeight: 800, color: '#2e7d32' }}>{statusGeral?.progressoPercentual ?? 0}%</span>
              </div>
              <div style={{ width: '100%', height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${statusGeral?.progressoPercentual ?? 0}%`, height: '100%', background: 'linear-gradient(90deg, #2e7d32, #4caf50)', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Navegação por 5 Abas Sequenciais com Scroll Touch e Layout Responsivo */}
            <div className="portal-tabs-container">
              {[
                { id: 'vaga', label: '1. Vaga', icon: '📋', disabled: false },
                { id: 'video', label: '2. Vídeo & Declaração', icon: '🎬', disabled: !vagaAceita },
                { id: 'adesao', label: '3. Adesão Completa', icon: '📝', disabled: !vagaAceita || !isVideoAssistido || !isDeclaracaoEnviada },
                { id: 'documentos', label: '4. Documentos', icon: '📁', disabled: !vagaAceita || !isVideoAssistido || !isDeclaracaoEnviada || !isAdesaoPreenchida },
                { id: 'app', label: '5. Finalização & App', icon: '📱', disabled: !vagaAceita || !isVideoAssistido || !isDeclaracaoEnviada || !isAdesaoPreenchida || !todosObrigatoriosProntos },
              ].map((tab) => {
                const isSelected = aba === tab.id;
                return (
                  <button
                    key={tab.id}
                    disabled={tab.disabled}
                    onClick={() => !tab.disabled && setAba(tab.id as AbaPortal)}
                    className="portal-tab-btn"
                    style={{
                      background: isSelected ? '#2e7d32' : 'transparent',
                      color: isSelected ? '#fff' : tab.disabled ? '#aaa' : '#555',
                      opacity: tab.disabled ? 0.45 : 1,
                      cursor: tab.disabled ? 'not-allowed' : 'pointer',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    <span style={{ marginRight: 6 }}>{tab.icon}</span>{tab.label}
                  </button>
                );
              })}
            </div>

            {/* ── ABA 1: VAGA OFERTADA ─────────────────────────────────────────── */}
            {aba === 'vaga' && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, margin: '0 0 16px' }}>
                  <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#1b5e20', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span>📋</span> Oportunidade / Detalhes da Vaga Ofertada
                  </h2>
                  {alocacaoAtual?.status === 'encerrada' || vagaDeclinada ? (
                    <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                      ⚠️ Vaga Declinada / Encerrada
                    </span>
                  ) : vagaAceita ? (
                    <span style={{ background: '#dcfce7', color: '#15803d', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                      ✓ Vaga Aceita
                    </span>
                  ) : (
                    <span style={{ background: '#fef3c7', color: '#92400e', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20 }}>
                      ⏳ Aguardando sua decisão
                    </span>
                  )}
                </div>

                {vagaDeclinada ? (
                  <div style={{ background: '#f8fafc', padding: 20, borderRadius: 10, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🤝</div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', margin: '0 0 6px' }}>
                      Você declinou esta oportunidade
                    </h3>
                    <p style={{ fontSize: 13, color: '#64748b', maxWidth: 500, margin: '0 auto 16px' }}>
                      A vaga foi devolvida ao banco de vagas abertas e nossa equipe do RA foi notificada. Você continuará no nosso banco para futuras oportunidades.
                    </p>
                    <button
                      onClick={() => setVagaDeclinada(false)}
                      style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: 6, padding: '8px 16px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Revisar informações da vaga
                    </button>
                  </div>
                ) : alocacaoAtual ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {/* Grid Principal de Informações */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Cargo / Função</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>{alocacaoAtual.cargo}</div>
                        {alocacaoAtual.cbo && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>CBO: {alocacaoAtual.cbo}</div>}
                      </div>

                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Unidade / Posto</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>{alocacaoAtual.nome_unidade || alocacaoAtual.nome_empresa}</div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>{alocacaoAtual.nome_empresa}</div>
                      </div>

                      <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Escala & Periodicidade</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', marginTop: 2 }}>
                          {alocacaoAtual.tipo_escala === '12x36' ? 'Plantão 12x36' :
                           alocacaoAtual.tipo_escala === 'plantao' ? 'Plantões' :
                           alocacaoAtual.tipo_escala === 'mensal' ? 'Escala Mensal' : alocacaoAtual.tipo_escala || 'A definir'}
                        </div>
                        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Pagamento: {alocacaoAtual.periodicidade || 'Mensal'}</div>
                      </div>

                      <div style={{ background: '#f0fdf4', padding: 14, borderRadius: 8, border: '1px solid #bbf7d0' }}>
                        <div style={{ fontSize: 11, color: '#166534', fontWeight: 600, textTransform: 'uppercase' }}>Remuneração Estimada</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: '#15803d', marginTop: 2 }}>
                          {alocacaoAtual.salario_base ? formatarMoeda(alocacaoAtual.salario_base) : 'Tabela da Unidade'}
                        </div>
                        <div style={{ fontSize: 11, color: '#166534', marginTop: 2 }}>Base: {alocacaoAtual.recebe_por === 'dia' ? 'Por Dia/Plantão' : 'Mensal'}</div>
                      </div>
                    </div>

                    {/* Grade de Agenda, Tempos Operacionais & Pausas */}
                    <div style={{ background: '#f8fafc', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span>⏱️</span> Parâmetros Operacionais & Intervalos Cadastrados
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                        <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Tempo de Refeição</span>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>{alocacaoAtual.tempo_refeicao ? `${alocacaoAtual.tempo_refeicao} min` : '60 min (padrão)'}</strong>
                          <span style={{ fontSize: 10, color: alocacaoAtual.desconta_refeicao ? '#b91c1c' : '#15803d', display: 'block', marginTop: 2 }}>
                            {alocacaoAtual.desconta_refeicao ? '• Descontado da jornada' : '• Não descontado'}
                          </span>
                        </div>

                        <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Tempo de Pausa</span>
                          <strong style={{ fontSize: 14, color: '#0f172a' }}>{alocacaoAtual.tempo_pausa ? `${alocacaoAtual.tempo_pausa} min` : '15 min (padrão)'}</strong>
                          <span style={{ fontSize: 10, color: alocacaoAtual.desconta_pausa ? '#b91c1c' : '#15803d', display: 'block', marginTop: 2 }}>
                            {alocacaoAtual.desconta_pausa ? '• Descontado da jornada' : '• Não descontado'}
                          </span>
                        </div>

                        <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Adicional Noturno / DSR</span>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>
                            {alocacaoAtual.adicional_noturno ? '✓ Aplicável' : 'Não'} · DSR {alocacaoAtual.dsr_percentual ? `${alocacaoAtual.dsr_percentual}%` : '16.67%'}
                          </strong>
                          <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 2 }}>Conforme escala</span>
                        </div>

                        <div style={{ background: '#fff', padding: 10, borderRadius: 6, border: '1px solid #cbd5e1' }}>
                          <span style={{ fontSize: 11, color: '#64748b', display: 'block' }}>Benefícios VR / VT</span>
                          <strong style={{ fontSize: 13, color: '#0f172a' }}>
                            VR: {alocacaoAtual.valor_vr_dia ? formatarMoeda(alocacaoAtual.valor_vr_dia) : 'R$ 0,00'} · VT: {alocacaoAtual.valor_vt_dia ? formatarMoeda(alocacaoAtual.valor_vt_dia) : 'R$ 0,00'}
                          </strong>
                          <span style={{ fontSize: 10, color: '#64748b', display: 'block', marginTop: 2 }}>Por dia trabalhado</span>
                        </div>
                      </div>
                    </div>

                    {/* Informações explicativas do passo */}
                    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '12px 16px', color: '#166534', fontSize: 13, lineHeight: 1.5, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 20 }}>ℹ️</span>
                      <div>
                        <strong>Etapa 1 de 5:</strong> Confira com atenção os parâmetros da oportunidade acima. Ao clicar em <strong>Aceitar Vaga</strong>, você confirmará seu interesse e liberará o acesso ao <strong>Vídeo da Palestra Institucional</strong> e ao formulário de adesão.
                      </div>
                    </div>

                    {/* Ações: Declinar e Aceitar */}
                    <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                      <button
                        type="button"
                        onClick={() => setModalDeclinarAberto(true)}
                        style={{
                          background: '#fff', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 8,
                          padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6,
                        }}
                      >
                        <span>✕</span> Declinar Oportunidade
                      </button>

                      <button
                        disabled={aceitandoVaga}
                        onClick={handleAceitarVaga}
                        style={{
                          background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8,
                          padding: '12px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(27,94,32,0.3)',
                        }}
                      >
                        {aceitandoVaga ? 'Processando...' : vagaAceita ? 'Avançar para Palestra & Declaração →' : '✓ Aceitar Vaga e Avançar para o Vídeo →'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ color: '#666', fontSize: 14 }}>Você está em processo de credenciamento geral para o banco de cooperados da ATESA.</p>
                )}
              </div>
            )}

            {/* ── MODAL DE CONFIRMAÇÃO DE DECLÍNIO DE VAGA ────────────────────── */}
            {modalDeclinarAberto && (
              <div style={{
                position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                background: 'rgba(0,0,0,0.6)', zIndex: 9999,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
                backdropFilter: 'blur(3px)',
              }}>
                <div style={{
                  background: '#fff', borderRadius: 14, maxWidth: 500, width: '100%',
                  padding: '24px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
                  display: 'flex', flexDirection: 'column', gap: 16,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#991b1b', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>⚠️</span> Confirmar Recusa da Vaga
                    </h3>
                    <button
                      onClick={() => setModalDeclinarAberto(false)}
                      style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer' }}
                    >
                      ✕
                    </button>
                  </div>

                  <p style={{ margin: 0, fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                    Tem certeza de que deseja declinar a vaga de <strong>{alocacaoAtual?.cargo}</strong> na unidade <strong>{alocacaoAtual?.nome_unidade || alocacaoAtual?.nome_empresa}</strong>?
                  </p>
                  <p style={{ margin: 0, fontSize: 12, color: '#64748b' }}>
                    Ao confirmar, a vaga retornará para o status <strong>Aberta</strong> no sistema e o setor de Recrutamento & Alocação (RA) será avisado imediatamente para selecionar outro candidato.
                  </p>

                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: '#334155', marginBottom: 4 }}>
                      Motivo da recusa (opcional):
                    </label>
                    <textarea
                      value={motivoRecusa}
                      onChange={(e) => setMotivoRecusa(e.target.value)}
                      placeholder="Ex: Conflito de horário com outro compromisso, distância da unidade, etc."
                      rows={3}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e1',
                        fontSize: 13, color: '#1e293b', boxSizing: 'border-box', outline: 'none'
                      }}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                    <button
                      onClick={() => setModalDeclinarAberto(false)}
                      style={{ background: '#f1f5f9', color: '#475569', border: 'none', borderRadius: 6, padding: '9px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    >
                      Voltar
                    </button>
                    <button
                      disabled={declinandoVaga}
                      onClick={handleDeclinarVaga}
                      style={{
                        background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6,
                        padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer'
                      }}
                    >
                      {declinandoVaga ? 'Processando...' : 'Confirmar e Declinar Vaga'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ── ABA 2: VÍDEO & DECLARAÇÃO DE LIVRE ADESÃO ───────────────────── */}
            {aba === 'video' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Card 1: Vídeo Institucional com Bloqueio de Skip */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                    <div>
                      <span style={{ background: '#e8f5e9', color: '#1b5e20', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                        Etapa Obrigatória · 5:48 min
                      </span>
                      <h2 style={{ fontSize: 18, fontWeight: 800, margin: '6px 0 2px', color: '#1b5e20' }}>
                        1. Palestra Cooperativista Institucional
                      </h2>
                      <p style={{ margin: 0, fontSize: 13, color: '#666' }}>
                        Assista ao vídeo explicativo na íntegra. Não é permitido avançar o vídeo antes de assisti-lo por completo.
                      </p>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: videoAssistido ? '#15803d' : '#d97706' }}>
                        {videoAssistido ? '✓ Vídeo Assistido' : `${videoProgressoPercentual}% Assistido`}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748b' }}>
                        {formatarTempo(videoTempoAtual)} / {formatarTempo(videoDuracao)}
                      </div>
                    </div>
                  </div>

                  {/* Player de Vídeo */}
                  <div style={{ position: 'relative', background: '#000', borderRadius: 10, overflow: 'hidden', maxHeight: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <video
                      ref={videoRef}
                      src="/videos/Palestra_Atesa.mp4"
                      controls
                      controlsList="nodownload noplaybackrate"
                      disablePictureInPicture
                      onTimeUpdate={handleVideoTimeUpdate}
                      onSeeking={handleVideoSeeking}
                      onEnded={finalizarVideo}
                      style={{ width: '100%', maxHeight: 420, objectFit: 'contain' }}
                    >
                      Seu navegador não suporta a tag de vídeo.
                    </video>
                  </div>
                </div>

                {/* Card 2: Declaração de Livre Adesão (Pág. 1) */}
                <div style={{
                  background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  border: videoAssistido ? '2px solid #2e7d32' : '1px solid #e2e8f0',
                  opacity: videoAssistido ? 1 : 0.6,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
                    <div>
                      <span style={{ background: declaracaoEnviada ? '#dcfce7' : '#fef3c7', color: declaracaoEnviada ? '#15803d' : '#b45309', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                        {declaracaoEnviada ? 'Declaração Enviada' : 'Página 1 do Documento · Obrigatório'}
                      </span>
                      <h3 style={{ margin: '6px 0 0', fontSize: 16, fontWeight: 800, color: '#1b5e20' }}>
                        2. Declaração de Livre Adesão de Próprio Punho
                      </h3>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#555', maxWidth: 650 }}>
                        Conforme exigência legal cooperativista, redija e assine a declaração de livre adesão de <strong>próprio punho (manuscrita)</strong> conforme o modelo oficial, tire uma foto e envie abaixo.
                      </p>
                    </div>

                    <button
                      disabled={!videoAssistido}
                      onClick={() => setModalDeclaracaoAberto(true)}
                      style={{
                        background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8,
                        padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: videoAssistido ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <span>📄</span> Ver Modelo / Imprimir Folha
                    </button>
                  </div>

                  {/* Status de Upload da Declaração */}
                  <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        Foto da Declaração Manuscrita e Assinada
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                        {declaracaoEnviada ? '✓ Documento anexado com sucesso e registrado com seu IP.' : 'Nenhum arquivo enviado ainda.'}
                      </div>
                    </div>

                    <button
                      disabled={!videoAssistido || uploadingTipo === 'declaracao_adesao'}
                      onClick={() => triggerUpload('declaracao_adesao')}
                      style={{
                        background: declaracaoEnviada ? '#2e7d32' : '#0284c7', color: '#fff', border: 'none', borderRadius: 8,
                        padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: videoAssistido ? 'pointer' : 'not-allowed',
                        display: 'flex', alignItems: 'center', gap: 6,
                      }}
                    >
                      <IconUpload size={16} />
                      {uploadingTipo === 'declaracao_adesao' ? 'Enviando...' : declaracaoEnviada ? 'Substituir Foto da Declaração' : 'Enviar Foto da Declaração'}
                    </button>
                  </div>

                  {declaracaoEnviada && (
                    <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end' }}>
                      <button
                        onClick={() => setAba('adesao')}
                        style={{
                          background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8,
                          padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                          boxShadow: '0 2px 8px rgba(27,94,32,0.3)',
                        }}
                      >
                        Próximo: Preencher Adesão Completa →
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── ABA 3: ADESÃO COMPLETA (LAYOUT SPLIT COM SIDEBAR LATERAL) ───────── */}
            {aba === 'adesao' && (!isVideoAssistido || !isDeclaracaoEnviada ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1b5e20', margin: '0 0 8px' }}>Etapa Bloqueada</h3>
                <p style={{ fontSize: 14, color: '#555', margin: '0 0 20px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                  Para preencher a Proposta de Adesão Completa, é obrigatório assistir à Palestra Institucional completa (5:48 min) e enviar a foto da sua Declaração de Livre Adesão manuscrita na Aba 2.
                </p>
                <button
                  onClick={() => setAba('video')}
                  style={{
                    background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ← Ir para Vídeo & Declaração (Aba 2)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

                {/* Header da Proposta de Adesão */}
                <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, color: '#1b5e20' }}>
                      Proposta de Adesão Completa do Cooperado
                    </h2>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
                      Digitalização oficial das Páginas 2 a 15 do documento da Cooperativa ATESA.
                    </p>
                  </div>
                  <div style={{ background: secoesPreenchidasCount === 12 ? '#dcfce7' : '#f1f5f9', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, color: secoesPreenchidasCount === 12 ? '#15803d' : '#475569' }}>
                    {secoesPreenchidasCount} de 12 Seções Preenchidas
                  </div>
                </div>

                {/* ── SELETOR MOBILE RETRÁTIL DE SEÇÕES (Visível apenas em Mobile) ── */}
                {(() => {
                  const secaoAtualObj = SECOES_ADESAO.find(s => s.id === secaoAtiva) || SECOES_ADESAO[0];
                  const concluida = secaoAtiva === 13 ? secoesPreenchidasCount === 12 : isSecaoConcluida(secaoAtiva);

                  return (
                    <div className="secoes-nav-mobile" style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', border: '1.5px solid #2e7d32' }}>
                      {/* Top info */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: '#e8f5e9', color: '#1b5e20', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                            Seção {secaoAtualObj.num} de 13
                          </span>
                          <span style={{ fontSize: 11, color: '#64748b' }}>{secaoAtualObj.paginas}</span>
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 800, color: concluida ? '#15803d' : '#d97706', display: 'flex', alignItems: 'center', gap: 4 }}>
                          {concluida ? '✓ Preenchida' : '○ Pendente'}
                        </span>
                      </div>

                      {/* Botão de Toggle Acordeão */}
                      <button
                        type="button"
                        onClick={() => setMenuSecoesMobileAberto(!menuSecoesMobileAberto)}
                        style={{
                          width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 8, padding: '10px 12px',
                          cursor: 'pointer', textAlign: 'left',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                          <span style={{ fontSize: 18 }}>{secaoAtualObj.icon}</span>
                          <div style={{ fontWeight: 800, fontSize: 13, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {secaoAtualObj.num}. {secaoAtualObj.titulo}
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: '#1b5e20', fontWeight: 800, fontSize: 12 }}>
                          <span>{menuSecoesMobileAberto ? '▲ Fechar' : '▼ Trocar Seção'}</span>
                        </div>
                      </button>

                      {/* Navegação Rápida (Anterior / Próxima) */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8 }}>
                        <button
                          type="button"
                          disabled={secaoAtiva <= 1}
                          onClick={() => {
                            setSecaoAtiva(p => Math.max(1, p - 1));
                            setMenuSecoesMobileAberto(false);
                          }}
                          style={{
                            flex: 1, padding: '7px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                            border: '1px solid #cbd5e1', background: secaoAtiva <= 1 ? '#f1f5f9' : '#fff',
                            color: secaoAtiva <= 1 ? '#94a3b8' : '#334155', cursor: secaoAtiva <= 1 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          ‹ Anterior
                        </button>
                        <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>
                          {secoesPreenchidasCount}/12 Concluídas
                        </div>
                        <button
                          type="button"
                          disabled={secaoAtiva >= 13}
                          onClick={() => {
                            setSecaoAtiva(p => Math.min(13, p + 1));
                            setMenuSecoesMobileAberto(false);
                          }}
                          style={{
                            flex: 1, padding: '7px 10px', fontSize: 11, fontWeight: 700, borderRadius: 6,
                            border: 'none', background: secaoAtiva >= 13 ? '#f1f5f9' : '#1b5e20',
                            color: secaoAtiva >= 13 ? '#94a3b8' : '#fff', cursor: secaoAtiva >= 13 ? 'not-allowed' : 'pointer',
                          }}
                        >
                          Próxima ›
                        </button>
                      </div>

                      {/* Lista Expansível no Mobile */}
                      {menuSecoesMobileAberto && (
                        <div style={{ marginTop: 10, borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
                          <div style={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: 2, paddingLeft: 4 }}>
                            Selecione para preencher:
                          </div>
                          {SECOES_ADESAO.map((s) => {
                            const isAtiva = secaoAtiva === s.id;
                            const isDone = s.id === 13 ? secoesPreenchidasCount === 12 : isSecaoConcluida(s.id);
                            return (
                              <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                  setSecaoAtiva(s.id);
                                  setMenuSecoesMobileAberto(false);
                                }}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                  padding: '8px 10px', borderRadius: 6, border: 'none', textAlign: 'left',
                                  cursor: 'pointer',
                                  background: isAtiva ? '#e8f5e9' : '#f8fafc',
                                  borderLeft: isAtiva ? '4px solid #2e7d32' : '4px solid transparent',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, overflow: 'hidden' }}>
                                  <span style={{ fontSize: 14 }}>{s.icon}</span>
                                  <div style={{ overflow: 'hidden' }}>
                                    <div style={{ fontSize: 12, fontWeight: isAtiva ? 800 : 600, color: isAtiva ? '#1b5e20' : '#334155', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                      {s.num}. {s.titulo}
                                    </div>
                                    <div style={{ fontSize: 10, color: isAtiva ? '#2e7d32' : '#94a3b8' }}>
                                      {s.paginas}
                                    </div>
                                  </div>
                                </div>
                                <div style={{ marginLeft: 6, flexShrink: 0 }}>
                                  {isDone ? (
                                    <span style={{ fontSize: 12, color: '#15803d', fontWeight: 800 }}>✓</span>
                                  ) : (
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Container Split: Sidebar à Esquerda + Painel de Conteúdo à Direita */}
                <div className="adesao-layout-split">

                  {/* ── SIDEBAR LATERAL (MENU DAS SEÇÕES) ─────────────────────────── */}
                  <aside className="secoes-sidebar-desktop">
                    <div style={{ padding: '8px 10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: 12, fontWeight: 800, color: '#1b5e20', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      📑 Seções do Documento
                    </div>

                    {SECOES_ADESAO.map((s) => {
                      const isAtiva = secaoAtiva === s.id;
                      const concluida = s.id === 13 ? secoesPreenchidasCount === 12 : isSecaoConcluida(s.id);

                      return (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => setSecaoAtiva(s.id)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '10px 12px', borderRadius: 8, border: 'none', textAlign: 'left',
                            cursor: 'pointer', transition: 'all 0.15s ease',
                            background: isAtiva ? '#e8f5e9' : 'transparent',
                            borderLeft: isAtiva ? '4px solid #2e7d32' : '4px solid transparent',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                            <span style={{ fontSize: 16 }}>{s.icon}</span>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ fontSize: 12, fontWeight: isAtiva ? 800 : 600, color: isAtiva ? '#1b5e20' : '#334155', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                                {s.num}. {s.titulo}
                              </div>
                              <div style={{ fontSize: 10, color: isAtiva ? '#2e7d32' : '#94a3b8' }}>
                                {s.paginas}
                              </div>
                            </div>
                          </div>

                          <div style={{ marginLeft: 6, flexShrink: 0 }}>
                            {concluida ? (
                              <span style={{ fontSize: 12, color: '#15803d', fontWeight: 800 }}>✓</span>
                            ) : (
                              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#cbd5e1', display: 'inline-block' }} />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </aside>

                  {/* ── PAINEL DIREITO (CONTEÚDO DA SEÇÃO ATIVA) ────────────────── */}
                  <div className="secao-painel-conteudo">

                    {/* SEÇÃO 1: Identificação & Dados Cadastrais (Págs 2-3) */}
                    {secaoAtiva === 1 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 01 · Páginas 2 e 3</span>
                          <h3 style={secaoTituloStyle}>Proposta de Adesão & Identificação Cadastral</h3>
                          <p style={secaoDescStyle}>Confira e preencha seus dados pessoais, documentos civis e endereço residencial.</p>
                        </div>

                        <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Nome Completo *</label>
                            <input style={{ ...inputStyle, background: '#f1f5f9' }} readOnly value={candidato.nome} />
                          </div>
                          <div>
                            <label style={labelStyle}>Nome Social (se houver)</label>
                            <input style={inputStyle} value={ds.nome_social || ''} onChange={e => setDs(p => ({ ...p, nome_social: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>CPF *</label>
                            <input style={{ ...inputStyle, background: '#f1f5f9' }} readOnly value={formatarCPF(candidato.cpf)} />
                          </div>
                          <div>
                            <label style={labelStyle}>Data de Nascimento *</label>
                            <input style={inputStyle} type="date" required value={ds.data_nascimento || ''} onChange={e => setDs(p => ({ ...p, data_nascimento: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Gênero</label>
                            <select style={inputStyle} value={ds.genero || ''} onChange={e => setDs(p => ({ ...p, genero: e.target.value }))}>
                              <option value="">Selecione...</option>
                              <option value="Feminino">Feminino</option>
                              <option value="Masculino">Masculino</option>
                              <option value="Neutro">Neutro / Outro</option>
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Estado Civil</label>
                            <select style={inputStyle} value={ds.estado_civil || ''} onChange={e => setDs(p => ({ ...p, estado_civil: e.target.value }))}>
                              <option value="">Selecione...</option>
                              <option value="solteiro">Solteiro(a)</option>
                              <option value="casado">Casado(a)</option>
                              <option value="uniao_estavel">União Estável</option>
                              <option value="divorciado">Divorciado(a)</option>
                              <option value="separado">Separado(a)</option>
                              <option value="viuvo">Viúvo(a)</option>
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Naturalidade (Cidade/UF)</label>
                            <input style={inputStyle} placeholder="Ex: São Paulo / SP" value={ds.naturalidade || ''} onChange={e => setDs(p => ({ ...p, naturalidade: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Nacionalidade</label>
                            <input style={inputStyle} value={ds.nacionalidade || 'Brasileiro(a)'} onChange={e => setDs(p => ({ ...p, nacionalidade: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Cor / Etnia</label>
                            <select style={inputStyle} value={ds.cor_etnia || ''} onChange={e => setDs(p => ({ ...p, cor_etnia: e.target.value }))}>
                              <option value="">Selecione...</option>
                              <option value="Branca">Branca</option>
                              <option value="Negra">Negra</option>
                              <option value="Parda">Parda</option>
                              <option value="Oriental">Oriental</option>
                              <option value="Indigena">Indígena</option>
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>RG *</label>
                            <input style={inputStyle} required value={ds.rg || ''} onChange={e => setDs(p => ({ ...p, rg: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Órgão Emissor / UF</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input style={{ ...inputStyle, flex: 2 }} placeholder="SSP" value={ds.orgao_emissor || ''} onChange={e => setDs(p => ({ ...p, orgao_emissor: e.target.value }))} />
                              <input style={{ ...inputStyle, flex: 1 }} maxLength={2} placeholder="SP" value={ds.uf_rg || ''} onChange={e => setDs(p => ({ ...p, uf_rg: e.target.value.toUpperCase() }))} />
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Data Expedição RG</label>
                            <input style={inputStyle} type="date" value={ds.data_expedicao_rg || ''} onChange={e => setDs(p => ({ ...p, data_expedicao_rg: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>PIS / PASEP / NIS</label>
                            <input style={inputStyle} value={ds.pis_pasep || ''} onChange={e => setDs(p => ({ ...p, pis_pasep: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>NIT</label>
                            <input style={inputStyle} value={ds.nit || ''} onChange={e => setDs(p => ({ ...p, nit: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Título de Eleitor</label>
                            <input style={inputStyle} value={ds.titulo_eleitor || ''} onChange={e => setDs(p => ({ ...p, titulo_eleitor: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>CNH (Número / Categoria)</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input style={{ ...inputStyle, flex: 2 }} placeholder="Nº CNH" value={ds.cnh || ''} onChange={e => setDs(p => ({ ...p, cnh: e.target.value }))} />
                              <input style={{ ...inputStyle, flex: 1 }} maxLength={3} placeholder="B" value={ds.categoria_cnh || ''} onChange={e => setDs(p => ({ ...p, categoria_cnh: e.target.value.toUpperCase() }))} />
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Órgão de Classe / Registro</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input style={{ ...inputStyle, flex: 1 }} placeholder="Ex: COREN" value={ds.orgaos_classe || ''} onChange={e => setDs(p => ({ ...p, orgaos_classe: e.target.value }))} />
                              <input style={{ ...inputStyle, flex: 2 }} placeholder="Nº Inscrição" value={ds.numero_classe || ''} onChange={e => setDs(p => ({ ...p, numero_classe: e.target.value }))} />
                            </div>
                          </div>
                        </div>

                        {/* Endereço */}
                        <h4 style={subsecaoHeaderStyle}>Endereço Residencial</h4>
                        <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={labelStyle}>CEP {buscandoCep && <span style={{ color: '#0284c7' }}>· Buscando...</span>}</label>
                            <input style={inputStyle} maxLength={9} placeholder="00000-000" value={ds.cep || ''} onChange={e => handleCep(e.target.value)} />
                          </div>
                          <div style={{ gridColumn: 'span 2' }}>
                            <label style={labelStyle}>Logradouro</label>
                            <input style={inputStyle} value={ds.logradouro || ''} onChange={e => setDs(p => ({ ...p, logradouro: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Número</label>
                            <input style={inputStyle} value={ds.numero || ''} onChange={e => setDs(p => ({ ...p, numero: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Complemento</label>
                            <input style={inputStyle} value={ds.complemento || ''} onChange={e => setDs(p => ({ ...p, complemento: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Bairro</label>
                            <input style={inputStyle} value={ds.bairro || ''} onChange={e => setDs(p => ({ ...p, bairro: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Cidade / UF</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input style={{ ...inputStyle, flex: 3 }} value={ds.cidade || ''} onChange={e => setDs(p => ({ ...p, cidade: e.target.value }))} />
                              <input style={{ ...inputStyle, flex: 1 }} maxLength={2} value={ds.uf || ''} onChange={e => setDs(p => ({ ...p, uf: e.target.value.toUpperCase() }))} />
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Zona</label>
                            <select style={inputStyle} value={ds.zona || 'Centro'} onChange={e => setDs(p => ({ ...p, zona: e.target.value }))}>
                              <option value="Centro">Centro</option>
                              <option value="Norte">Norte</option>
                              <option value="Sul">Sul</option>
                              <option value="Leste">Leste</option>
                              <option value="Oeste">Oeste</option>
                              <option value="Rural">Rural</option>
                            </select>
                          </div>
                        </div>

                        {/* Filiação & Família */}
                        <h4 style={subsecaoHeaderStyle}>Filiação & Família</h4>
                        <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Nome da Mãe *</label>
                            <input style={inputStyle} required value={ds.nome_mae || ''} onChange={e => setDs(p => ({ ...p, nome_mae: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Nome do Pai</label>
                            <input style={inputStyle} value={ds.nome_pai || ''} onChange={e => setDs(p => ({ ...p, nome_pai: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Nome do Cônjuge</label>
                            <input style={inputStyle} value={ds.nome_conjuge || ''} onChange={e => setDs(p => ({ ...p, nome_conjuge: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Grau de Instrução</label>
                            <select style={inputStyle} value={ds.grau_instrucao || ''} onChange={e => setDs(p => ({ ...p, grau_instrucao: e.target.value }))}>
                              <option value="">Selecione...</option>
                              <option value="Ensino Fundamental Completo">Ensino Fundamental Completo</option>
                              <option value="Ensino Médio Completo">Ensino Médio Completo</option>
                              <option value="Educação Superior Incompleta">Educação Superior Incompleta</option>
                              <option value="Educação Superior Completa">Educação Superior Completa</option>
                              <option value="Pós Graduação Completa">Pós Graduação Completa</option>
                              <option value="Mestrado Completo">Mestrado Completo</option>
                              <option value="Doutorado Completo">Doutorado Completo</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SEÇÃO 2: Contatos de Emergência & Histórico (Pág. 3) */}
                    {secaoAtiva === 2 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 02 · Página 3</span>
                          <h3 style={secaoTituloStyle}>Pessoas a serem Avisadas em Caso de Emergência</h3>
                          <p style={secaoDescStyle}>Informe contatos que possam ser acionados rapidamente em qualquer intercorrência.</p>
                        </div>

                        <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
                          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#1b5e20', marginBottom: 10 }}>Contato Principal 1 *</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div>
                                <label style={labelStyle}>Nome Completo *</label>
                                <input style={inputStyle} required value={emergencia.nome_1 || ''} onChange={e => setEmergencia(p => ({ ...p, nome_1: e.target.value }))} />
                              </div>
                              <div>
                                <label style={labelStyle}>Grau de Parentesco *</label>
                                <input style={inputStyle} placeholder="Ex: Mãe, Cônjuge, Irmão" required value={emergencia.parentesco_1 || ''} onChange={e => setEmergencia(p => ({ ...p, parentesco_1: e.target.value }))} />
                              </div>
                              <div>
                                <label style={labelStyle}>Telefone com DDD *</label>
                                <input style={inputStyle} placeholder="(00) 00000-0000" required value={emergencia.telefone_1 || ''} onChange={e => setEmergencia(p => ({ ...p, telefone_1: e.target.value }))} />
                              </div>
                            </div>
                          </div>

                          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                            <div style={{ fontSize: 13, fontWeight: 800, color: '#475569', marginBottom: 10 }}>Contato Secundário 2 (Opcional)</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                              <div>
                                <label style={labelStyle}>Nome Completo</label>
                                <input style={inputStyle} value={emergencia.nome_2 || ''} onChange={e => setEmergencia(p => ({ ...p, nome_2: e.target.value }))} />
                              </div>
                              <div>
                                <label style={labelStyle}>Grau de Parentesco</label>
                                <input style={inputStyle} placeholder="Ex: Pai, Amigo" value={emergencia.parentesco_2 || ''} onChange={e => setEmergencia(p => ({ ...p, parentesco_2: e.target.value }))} />
                              </div>
                              <div>
                                <label style={labelStyle}>Telefone com DDD</label>
                                <input style={inputStyle} placeholder="(00) 00000-0000" value={emergencia.telefone_2 || ''} onChange={e => setEmergencia(p => ({ ...p, telefone_2: e.target.value }))} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SEÇÃO 3: Cota-Parte & Dados Bancários (Pág. 4) */}
                    {secaoAtiva === 3 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 03 · Página 4</span>
                          <h3 style={secaoTituloStyle}>Ficha de Matrícula, Quota-Parte & Dados Bancários</h3>
                          <p style={secaoDescStyle}>Informações para controle da integralização de capital e crédito dos repasses de produtividade.</p>
                        </div>

                        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: 14 }}>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#1b5e20' }}>Subscrição e Integralização da Quota Parte de Capital</div>
                          <div style={{ fontSize: 12, color: '#333', marginTop: 4, lineHeight: 1.5 }}>
                            Subscrição de <strong>50 quotas-partes no valor unitário de R$ 1,00 cada, totalizando R$ 50,00</strong>, a ser integralizada em 05 parcelas de R$ 10,00 via rateio de remuneração conforme previsão estatutária da Cooperativa ATESA.
                          </div>
                        </div>

                        <h4 style={subsecaoHeaderStyle}>Dados da Conta Bancária (Titularidade do Cooperado) *</h4>
                        <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                          <div>
                            <label style={labelStyle}>Banco *</label>
                            <input style={inputStyle} required placeholder="Ex: Itaú, Bradesco, Santander, Nubank" value={db.banco || ''} onChange={e => setDb(p => ({ ...p, banco: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Agência *</label>
                            <input style={inputStyle} required placeholder="0000" value={db.agencia || ''} onChange={e => setDb(p => ({ ...p, agencia: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Conta com Dígito *</label>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <input style={{ ...inputStyle, flex: 3 }} required placeholder="00000" value={db.conta || ''} onChange={e => setDb(p => ({ ...p, conta: e.target.value }))} />
                              <input style={{ ...inputStyle, flex: 1 }} maxLength={2} placeholder="X" value={db.digito || ''} onChange={e => setDb(p => ({ ...p, digito: e.target.value }))} />
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Tipo de Conta</label>
                            <select style={inputStyle} value={db.tipo_conta || 'corrente'} onChange={e => setDb(p => ({ ...p, tipo_conta: e.target.value as any }))}>
                              <option value="corrente">Conta Corrente</option>
                              <option value="poupanca">Conta Poupança</option>
                            </select>
                          </div>
                          <div>
                            <label style={labelStyle}>Chave PIX</label>
                            <input style={inputStyle} placeholder="CPF, e-mail ou celular" value={db.chave_pix || ''} onChange={e => setDb(p => ({ ...p, chave_pix: e.target.value }))} />
                          </div>
                          <div>
                            <label style={labelStyle}>Tipo de PIX</label>
                            <select style={inputStyle} value={db.tipo_pix || 'cpf'} onChange={e => setDb(p => ({ ...p, tipo_pix: e.target.value as any }))}>
                              <option value="cpf">CPF</option>
                              <option value="email">E-mail</option>
                              <option value="telefone">Telefone</option>
                              <option value="aleatoria">Chave Aleatória</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* SEÇÃO 4: Ata de Palestra Cooperativista (Pág. 5) */}
                    {secaoAtiva === 4 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 04 · Página 5</span>
                          <h3 style={secaoTituloStyle}>Ata de Palestra Cooperativista</h3>
                          <p style={secaoDescStyle}>Declaração formal de esclarecimento do Sistema Cooperativista e legislação aplicável.</p>
                        </div>

                        {/* Seleção do Formato da Palestra */}
                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <label style={{ ...labelStyle, fontSize: 13, marginBottom: 8 }}>Em qual formato você participou da palestra cooperativista? *</label>
                          <div style={{ display: 'flex', gap: 20 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                              <input
                                type="radio"
                                name="palestra_formato"
                                value="online"
                                checked={dadosAdesaoJson.palestraAta?.formato === 'online'}
                                onChange={() => setDadosAdesaoJson((p: any) => ({
                                  ...p,
                                  palestraAta: { ...(p.palestraAta || {}), formato: 'online' }
                                }))}
                              />
                              💻 Online (Vídeo / Plataforma)
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                              <input
                                type="radio"
                                name="palestra_formato"
                                value="presencial"
                                checked={dadosAdesaoJson.palestraAta?.formato === 'presencial'}
                                onChange={() => setDadosAdesaoJson((p: any) => ({
                                  ...p,
                                  palestraAta: { ...(p.palestraAta || {}), formato: 'presencial' }
                                }))}
                              />
                              🏢 Presencial na Sede / Polo
                            </label>
                          </div>
                        </div>

                        {/* Texto Oficial da Ata */}
                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                          <p style={{ margin: '0 0 10px' }}>
                            Eu, <strong>{candidato.nome}</strong>, declaro ter assistido a palestra da <strong>ATESA Cooperativa de Trabalho dos Profissionais da Saúde</strong>, sobre esclarecimento do Sistema Cooperativista.
                            O palestrante explicou sobre o modelo de cooperativa de trabalho de acordo com as <strong>Leis Federais 5.764/1971 e 12.690/2012</strong>, sobre os Fundos de Reserva, do Estatuto Social, da Integralização da Quota Parte, da participação nas Assembleias Gerais, da destinação das sobras líquidas e das perdas, se houver, e dos benefícios que a Cooperativa oferece a custos acessíveis.
                          </p>
                          <p style={{ margin: '0 0 10px' }}>
                            O interessado declara que entendeu as explicações sobre o Sistema de Cooperativa de Trabalho, e manifesta de livre e espontânea vontade, sem interferência de qualquer pessoa, fazer parte da cooperativa, estando ciente que o trabalhador cooperado não é caracterizado como empregado, conforme o <strong>parágrafo único, do artigo 442 da CLT</strong>: <em>"Qualquer que seja o ramo de atividade da sociedade cooperativa, não existe vínculo empregatício entre ela e seus associados, nem entre estes e os tomadores de serviços daquela"</em>, bem como o <strong>artigo 90 da Lei 5.764/1971</strong>.
                          </p>
                          <p style={{ margin: 0 }}>
                            Neste ato, aceito plenamente participar das atividades propostas pela cooperativa, concordando com a forma de distribuição dos serviços oferecidos por esta junto aos seus tomadores de serviços e/ou pessoas físicas.
                          </p>
                        </div>

                        {/* Checkbox de Aceite */}
                        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', background: '#e8f5e9', padding: 14, borderRadius: 8, border: '1px solid #a5d6a7' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, marginTop: 2, accentColor: '#2e7d32' }}
                            checked={Boolean(dadosAdesaoJson.palestraAta?.concorda)}
                            onChange={e => setDadosAdesaoJson((p: any) => ({
                              ...p,
                              palestraAta: { ...(p.palestraAta || {}), concorda: e.target.checked }
                            }))}
                          />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                            Declaro que assisti à palestra, compreendi todas as orientações e concordo integralmente com os termos da Ata de Palestra Cooperativista.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* SEÇÃO 5: Declaração de Informações Estatutárias (Pág. 6) */}
                    {secaoAtiva === 5 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 05 · Página 6</span>
                          <h3 style={secaoTituloStyle}>Declaração que Recebeu Informações Estatutárias</h3>
                          <p style={secaoDescStyle}>Responda individualmente a cada um dos 10 itens estatutários abaixo marcando <strong>SIM</strong> ou <strong>NÃO</strong>.</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          {[
                            { id: 'item1', texto: '1. Que recebi as informações legais e estatutárias sobre o Sistema Cooperativista:' },
                            { id: 'item2', texto: '2. Que tenho ciência que a Assembléia Geral Ordinária ocorrerá uma vez ao ano, ou seja, no mês de março:' },
                            { id: 'item3', texto: '3. Que tenho ciência que as Assembléias Gerais têm competência para decidir sobre todos os interesses da cooperativa, respeitados os limites da lei e do Estatuto Social:' },
                            { id: 'item4', texto: '4. Que tenho ciência da obrigatoriedade de participação nas Assembléias Gerais:' },
                            { id: 'item5', texto: '5. Que tenho ciência do desconto de 3% (três por cento) em minha remuneração, referente a rateio de custos da cooperativa:' },
                            { id: 'item6', texto: '6. Que efetuarei a integralização da quota parte, no valor de R$ 50,00 (cinquenta reais), em 05 parcelas:' },
                            { id: 'item7', texto: '7. Que tenho ciência que o Seguro de Vida em grupo é obrigatório, conforme aprovação da Assembléia Geral Ordinária:' },
                            { id: 'item8', texto: '8. Que a devolução de quotas partes só poderão ser solicitadas caso o associado venha a se desligar da Cooperativa:' },
                            { id: 'item9', texto: '9. Que a restituição das quotas partes se dará após solicitação, por escrito, e aprovação pela Assembléia Geral Ordinária do Balanço e Contas do Exercício em que o desligamento tenha ocorrido:' },
                            { id: 'item10', texto: '10. Que o valor da remuneração pela execução dos serviços, será creditada em conta bancária indicada por escrito:' },
                          ].map((item) => {
                            const valorAtual = dadosAdesaoJson.estatutario?.[item.id] || '';
                            return (
                              <div key={item.id} style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                                <div style={{ fontSize: 13, color: '#1e293b', fontWeight: 600, flex: 1, minWidth: 260 }}>
                                  {item.texto}
                                </div>
                                <div style={{ display: 'flex', gap: 14 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: valorAtual === 'sim' ? '#1b5e20' : '#475569' }}>
                                    <input
                                      type="radio"
                                      name={`estatuto_${item.id}`}
                                      value="sim"
                                      checked={valorAtual === 'sim'}
                                      onChange={() => setDadosAdesaoJson((p: any) => ({
                                        ...p,
                                        estatutario: { ...(p.estatutario || {}), [item.id]: 'sim' }
                                      }))}
                                    />
                                    SIM
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', fontSize: 13, fontWeight: 700, color: valorAtual === 'nao' ? '#b91c1c' : '#475569' }}>
                                    <input
                                      type="radio"
                                      name={`estatuto_${item.id}`}
                                      value="nao"
                                      checked={valorAtual === 'nao'}
                                      onChange={() => setDadosAdesaoJson((p: any) => ({
                                        ...p,
                                        estatutario: { ...(p.estatutario || {}), [item.id]: 'nao' }
                                      }))}
                                    />
                                    NÃO
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SEÇÃO 6: Questionário Dirigido aos Associados (Pág. 7) */}
                    {secaoAtiva === 6 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 06 · Página 7</span>
                          <h3 style={secaoTituloStyle}>Questionário Dirigido aos Associados</h3>
                          <p style={secaoDescStyle}>Responda às 12 perguntas conforme o entendimento dos princípios do cooperativismo.</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {/* Q1 */}
                          <div style={questionarioCardStyle}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>1. Na Cooperativa, você é?</div>
                            <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                              <label style={radioOptionLabelStyle}>
                                <input
                                  type="radio"
                                  name="q_q1"
                                  value="associado"
                                  checked={dadosAdesaoJson.questionario?.q1 === 'associado'}
                                  onChange={() => setDadosAdesaoJson((p: any) => ({
                                    ...p,
                                    questionario: { ...(p.questionario || {}), q1: 'associado' }
                                  }))}
                                />
                                ASSOCIADO
                              </label>
                              <label style={radioOptionLabelStyle}>
                                <input
                                  type="radio"
                                  name="q_q1"
                                  value="empregado"
                                  checked={dadosAdesaoJson.questionario?.q1 === 'empregado'}
                                  onChange={() => setDadosAdesaoJson((p: any) => ({
                                    ...p,
                                    questionario: { ...(p.questionario || {}), q1: 'empregado' }
                                  }))}
                                />
                                EMPREGADO
                              </label>
                            </div>
                          </div>

                          {/* Q2 */}
                          <div style={questionarioCardStyle}>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>2. O que significa Integralização de Capital?</div>
                            <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                              <label style={radioOptionLabelStyle}>
                                <input
                                  type="radio"
                                  name="q_q2"
                                  value="quota_parte"
                                  checked={dadosAdesaoJson.questionario?.q2 === 'quota_parte'}
                                  onChange={() => setDadosAdesaoJson((p: any) => ({
                                    ...p,
                                    questionario: { ...(p.questionario || {}), q2: 'quota_parte' }
                                  }))}
                                />
                                VALOR DA QUOTA PARTE
                              </label>
                              <label style={radioOptionLabelStyle}>
                                <input
                                  type="radio"
                                  name="q_q2"
                                  value="outras_taxas"
                                  checked={dadosAdesaoJson.questionario?.q2 === 'outras_taxas'}
                                  onChange={() => setDadosAdesaoJson((p: any) => ({
                                    ...p,
                                    questionario: { ...(p.questionario || {}), q2: 'outras_taxas' }
                                  }))}
                                />
                                OUTRAS TAXAS
                              </label>
                            </div>
                          </div>

                          {/* Q3 a Q12 */}
                          {[
                            { id: 'q3', num: '3', txt: 'Você terá vínculo empregatício?' },
                            { id: 'q4', num: '4', txt: 'Você terá vínculo empregatício com as tomadoras de serviço, nas quais irá exercer as atividades, quando designado pela cooperativa?' },
                            { id: 'q5', num: '5', txt: 'Como associado, você terá direito a 13º, FGTS e Seguro Desemprego?' },
                            { id: 'q6', num: '6', txt: 'Você terá seu INSS recolhido enquanto estiver em atividade?' },
                            { id: 'q7', num: '7', txt: 'A sua Adesão foi de livre vontade e poderá desligar-se assim que desejar?' },
                            { id: 'q8', num: '8', txt: 'Você tem o direito de votar e ser votado?' },
                            { id: 'q9', num: '9', txt: 'As decisões são sempre tomadas pela maioria dos associados?' },
                            { id: 'q10', num: '10', txt: 'Você terá direito a Descanso Anual Remunerado?' },
                            { id: 'q11', num: '11', txt: 'Na cooperativa todos são iguais e não há qualquer discriminação?' },
                            { id: 'q12', num: '12', txt: 'Um dos princípios cooperativistas é a educação permanente aos seus associados?' },
                          ].map((q) => {
                            const val = dadosAdesaoJson.questionario?.[q.id] || '';
                            return (
                              <div key={q.id} style={questionarioCardStyle}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{q.num}. {q.txt}</div>
                                <div style={{ display: 'flex', gap: 20, marginTop: 6 }}>
                                  <label style={radioOptionLabelStyle}>
                                    <input
                                      type="radio"
                                      name={`q_${q.id}`}
                                      value="sim"
                                      checked={val === 'sim'}
                                      onChange={() => setDadosAdesaoJson((p: any) => ({
                                        ...p,
                                        questionario: { ...(p.questionario || {}), [q.id]: 'sim' }
                                      }))}
                                    />
                                    SIM
                                  </label>
                                  <label style={radioOptionLabelStyle}>
                                    <input
                                      type="radio"
                                      name={`q_${q.id}`}
                                      value="nao"
                                      checked={val === 'nao'}
                                      onChange={() => setDadosAdesaoJson((p: any) => ({
                                        ...p,
                                        questionario: { ...(p.questionario || {}), [q.id]: 'nao' }
                                      }))}
                                    />
                                    NÃO
                                  </label>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* SEÇÃO 7: Autorização de Descontos & Convênios (Pág. 8) */}
                    {secaoAtiva === 7 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 07 · Página 8</span>
                          <h3 style={secaoTituloStyle}>Autorização de Descontos & Adesão a Benefícios</h3>
                          <p style={secaoDescStyle}>Autorização estatutária de retenções e seleção opcional de parcerias com convênios.</p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <h4 style={{ fontSize: 13, fontWeight: 800, color: '#1b5e20', margin: '0 0 10px' }}>
                            Descontos Obrigatórios em Remuneração (Conforme Estatuto Social):
                          </h4>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {[
                              { key: 'desconto_quota', label: 'Quota parte R$ 50,00, sendo 05 parcelas de R$ 10,00 (conforme Estatuto Social)' },
                              { key: 'desconto_rateio', label: '3% (três por cento) para cobertura de rateio de custos da Cooperativa (conforme aprovado em Assembleia)' },
                              { key: 'desconto_inss', label: 'Recolhimento de INSS de 20% (vinte por cento) sobre a produtividade (conforme Ato Declaratório nº 05/2015)' },
                            ].map((d) => (
                              <label key={d.key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#334155' }}>
                                <input
                                  type="checkbox"
                                  style={{ width: 16, height: 16, accentColor: '#2e7d32' }}
                                  checked={Boolean(dadosAdesaoJson.autorizacoes?.[d.key])}
                                  onChange={e => setDadosAdesaoJson((p: any) => ({
                                    ...p,
                                    autorizacoes: { ...(p.autorizacoes || {}), [d.key]: e.target.checked }
                                  }))}
                                />
                                {d.label}
                              </label>
                            ))}
                          </div>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <h4 style={{ fontSize: 13, fontWeight: 800, color: '#0369a1', margin: '0 0 6px' }}>
                            Benefícios Opcionais em Forma de Parcerias (Disponíveis após 60 dias):
                          </h4>
                          <p style={{ fontSize: 11, color: '#64748b', margin: '0 0 12px' }}>
                            Selecione os convênios que tiver interesse para adesão:
                          </p>

                          <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
                            {[
                              'Convênio Médico - Amil (SP/RJ)',
                              'Convênio Médico - Biovida (SP)',
                              'Convênio Academia Total Pass (SP/RJ/PE/CE/MA)',
                              'Faculdade Estácio (SP/RJ/PE/CE/MA)',
                              'Faculdade Sumaré (SP/RJ/PE/CE/MA)',
                              'Faculdade Unip Polo Anália Franco (SP/RJ/PE/CE/MA)',
                              'Faculdade Uninove (SP/RJ/PE/CE/MA)',
                              'Faculdade Unissuam (SP/RJ/PE/CE/MA)',
                              'Fisk (SP/RJ/PE/CE/MA)',
                              'Instituto Carreira e Saúde (SP/RJ/PE/CE/MA)',
                              'Pós Graduação Mackenzie (SP/RJ/PE/CE/MA)',
                              'Arajara Park (CE)',
                              'Castelo Park Aquático (SP)',
                              'Parque Magic City (SP)',
                              'Extra Farma - Pague Menos (SP/RJ/PE/CE/MA)',
                            ].map((conv) => {
                              const selecionados: string[] = dadosAdesaoJson.autorizacoes?.convenios_opcionais || [];
                              const isSel = selecionados.includes(conv);
                              return (
                                <label key={conv} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#334155', cursor: 'pointer' }}>
                                  <input
                                    type="checkbox"
                                    checked={isSel}
                                    onChange={e => {
                                      const next = e.target.checked
                                        ? [...selecionados, conv]
                                        : selecionados.filter(x => x !== conv);
                                      setDadosAdesaoJson((p: any) => ({
                                        ...p,
                                        autorizacoes: { ...(p.autorizacoes || {}), convenios_opcionais: next }
                                      }));
                                    }}
                                  />
                                  {conv}
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <div style={{ fontSize: 12, color: '#64748b', background: '#fffbeb', padding: 10, borderRadius: 6, border: '1px solid #fef3c7' }}>
                          Ademais, comprometo-me a comparecer à sede da Cooperativa para quitar débitos, se houver, em virtude de falta de produtividade, devolver equipamentos ou uniformes que estejam em meu poder.
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#e8f5e9', padding: 12, borderRadius: 8, border: '1px solid #a5d6a7' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, accentColor: '#2e7d32' }}
                            checked={Boolean(dadosAdesaoJson.autorizacoes?.concorda_descontos)}
                            onChange={e => setDadosAdesaoJson((p: any) => ({
                              ...p,
                              autorizacoes: { ...(p.autorizacoes || {}), concorda_descontos: e.target.checked }
                            }))}
                          />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                            Declaro que li e autorizo os descontos e opções acima assinaladas.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* SEÇÃO 8: Termo de Adesão a Contrato (Pág. 9) */}
                    {secaoAtiva === 8 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 08 · Página 9</span>
                          <h3 style={secaoTituloStyle}>Termo de Adesão de Cooperado a Contrato</h3>
                          <p style={secaoDescStyle}>Manifestação voluntária de interesse para execução de serviços autônomos.</p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                          <p style={{ margin: '0 0 12px' }}>
                            Eu, <strong>{candidato.nome}</strong>, associado com base nas <strong>Leis Federais 5.764/71 e 12.690/12</strong> e do Estatuto Social, considerando minha disponibilidade pessoal e segundo as condições propostas pela cooperativa, tais como, local e forma da prestação de serviços, declaro meu interesse em executar os serviços autônomos, conforme contrato firmado entre a ATESA e a empresa tomadora de seus serviços.
                          </p>
                          <p style={{ margin: 0 }}>
                            Declaro ainda, estar ciente das minhas atividades na qualidade de profissional autônomo atuante no tomador de serviços parceiro da cooperativa, inclusive, tendo a autonomia de comunicar à Sociedade Cooperativa qualquer infringência relacionada ao trabalho.
                          </p>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#e8f5e9', padding: 14, borderRadius: 8, border: '1px solid #a5d6a7' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, accentColor: '#2e7d32' }}
                            checked={Boolean(dadosAdesaoJson.termoAdesaoContrato?.concorda)}
                            onChange={e => setDadosAdesaoJson((p: any) => ({
                              ...p,
                              termoAdesaoContrato: { ...(p.termoAdesaoContrato || {}), concorda: e.target.checked }
                            }))}
                          />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                            Li, compreendi e assino o Termo de Adesão ao Contrato de Serviços Autônomos.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* SEÇÃO 9: Termo de Confidencialidade e Sigilo Ético (Pág. 10) */}
                    {secaoAtiva === 9 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 09 · Página 10</span>
                          <h3 style={secaoTituloStyle}>Termo de Confidencialidade e Sigilo Ético</h3>
                          <p style={secaoDescStyle}>Compromisso de sigilo absoluto sobre prontuários, dados clínicos e segredos profissionais.</p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                          <p style={{ margin: '0 0 10px' }}>
                            Pelo presente termo eu, <strong>{candidato.nome}</strong>, CPF nº <strong>{formatarCPF(candidato.cpf)}</strong>, associado à ATESA, me comprometo a não divulgar, sob qualquer hipótese, informações de que venha a tomar conhecimento em razão dos serviços prestados.
                          </p>
                          <p style={{ margin: '0 0 10px' }}>
                            Comprometo-me a não fornecer, divulgar ou tornar disponível, sem consentimento prévio e por escrito, qualquer documento ou informação exclusiva ou confidencial da cooperativa e ou tomador de serviços, sob qualquer forma e a qualquer pretexto, seja à pessoa física ou jurídica, salvo aos seus colaboradores e/ou prestadores de serviços diretamente ligados às atividades desempenhadas, ou em razão de determinação legal, prevalecendo esta obrigação mesmo após a extinção da prestação de serviços.
                          </p>
                          <p style={{ margin: 0 }}>
                            O descumprimento da obrigação assumida importará no pagamento de multa equivalente ao valor da média das 03 (três) últimas remunerações por mim auferidas, independentemente das perdas e danos.
                          </p>
                        </div>

                        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', padding: 12, borderRadius: 8, fontSize: 12, color: '#991b1b' }}>
                          <strong>⚠️ VIOLAÇÃO DE SEGREDO PROFISSIONAL - ART. 154 DO CÓDIGO PENAL:</strong><br />
                          "Revelar alguém, sem justa causa, segredo, de que tem ciência em razão de função, ministério, ofício ou profissão, e cuja revelação possa produzir dano a outrem. Pena: detenção de três meses a um ano ou multa."
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#e8f5e9', padding: 14, borderRadius: 8, border: '1px solid #a5d6a7' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, accentColor: '#2e7d32' }}
                            checked={Boolean(dadosAdesaoJson.termoConfidencialidade?.concorda)}
                            onChange={e => setDadosAdesaoJson((p: any) => ({
                              ...p,
                              termoConfidencialidade: { ...(p.termoConfidencialidade || {}), concorda: e.target.checked }
                            }))}
                          />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                            Declaro que li e assumo formalmente o compromisso de Confidencialidade e Sigilo Ético.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* SEÇÃO 10: Termo de Consentimento LGPD (Págs 11 a 13) */}
                    {secaoAtiva === 10 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 10 · Páginas 11 a 13</span>
                          <h3 style={secaoTituloStyle}>Consentimento para Tratamento de Dados Pessoais (LGPD)</h3>
                          <p style={secaoDescStyle}>Cláusulas 1ª a 9ª em conformidade com a Lei Federal nº 13.709/2018.</p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', maxHeight: 300, overflowY: 'auto', fontSize: 12, color: '#334155', lineHeight: 1.6 }}>
                          <p><strong>Cláusula 1ª - Controladora:</strong> ATESA Cooperativa de Trabalho dos Profissionais da Saúde (CNPJ 08.930.337/0001-00), ouvidoria@atesa.com.br.</p>
                          <p><strong>Cláusula 2ª - Dados Pessoais Tratados:</strong> Nome, RG, CPF, CNH, Foto 3x4, dados bancários, tipo sanguíneo, contatos de emergência, escolaridade e certidões.</p>
                          <p><strong>Cláusula 3ª - Finalidades:</strong> Formalização de associação cooperativista, recolhimento de INSS e tributos, inclusão em seguros e convênios, e envio de escalas e produtividade.</p>
                          <p><strong>Cláusula 4ª - Armazenamento:</strong> Enquanto perdurar a associação ou pelo período de exigência legal.</p>
                          <p><strong>Cláusula 5ª - Compartilhamento:</strong> Autorizado com tomadores parceiros, órgãos públicos fiscais, seguradora MetLife e operadoras de benefícios.</p>
                          <p><strong>Cláusula 6ª - Segurança:</strong> Medidas de segurança técnicas e administrativas aptas a proteger os dados pessoais.</p>
                          <p><strong>Cláusula 7ª e 8ª - Direitos do Titular:</strong> Acesso, correção, anonimização e informações via canais oficiais.</p>
                          <p><strong>Cláusula 9ª - Revogação:</strong> O consentimento poderá ser revogado a qualquer momento pelo titular mediante manifestação formal.</p>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#e8f5e9', padding: 14, borderRadius: 8, border: '1px solid #a5d6a7' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, accentColor: '#2e7d32' }}
                            checked={Boolean(dadosAdesaoJson.termoLgpd?.concorda)}
                            onChange={e => setDadosAdesaoJson((p: any) => ({
                              ...p,
                              termoLgpd: { ...(p.termoLgpd || {}), concorda: e.target.checked }
                            }))}
                          />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                            Concordo expressamente com o tratamento e compartilhamento dos meus dados pessoais nos termos da LGPD.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* SEÇÃO 11: Termo de Geolocalização & Apontamento no App (Pág. 14) */}
                    {secaoAtiva === 11 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 11 · Página 14</span>
                          <h3 style={secaoTituloStyle}>Termo de Consentimento de Dados Sensíveis e Geolocalização</h3>
                          <p style={secaoDescStyle}>Autorização para apuração de produtividade e conferência eletrônica de plantões no aplicativo.</p>
                        </div>

                        <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                          <p style={{ margin: '0 0 10px' }}>
                            Através do presente instrumento eu, <strong>{candidato.nome}</strong>, CPF nº <strong>{formatarCPF(candidato.cpf)}</strong>, autorizo a <strong>ATESA COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA SAÚDE</strong> a dispor de meus dados e localização para exercício das atividades cooperativas.
                          </p>
                          <ul style={{ margin: '0 0 10px', paddingLeft: 20 }}>
                            <li style={{ marginBottom: 6 }}>Estou ciente que o apontamento eletrônico deve ser efetuado de maneira correta no APP da Cooperativa, bem como da importância para apuração da minha produtividade.</li>
                            <li>Estou ciente que preciso <strong>SEMPRE apertar o botão PERMITIR</strong> para a localização no aplicativo da cooperativa, e efetuar o apontamento dentro do local da realização dos serviços.</li>
                          </ul>
                          <p style={{ margin: 0 }}>
                            Por esta ser a expressão da minha vontade, declaro e autorizo o uso descrito, em caráter irrevogável e irretratável.
                          </p>
                        </div>

                        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', background: '#e8f5e9', padding: 14, borderRadius: 8, border: '1px solid #a5d6a7' }}>
                          <input
                            type="checkbox"
                            style={{ width: 18, height: 18, accentColor: '#2e7d32' }}
                            checked={Boolean(dadosAdesaoJson.termoGeolocalizacao?.concorda)}
                            onChange={e => setDadosAdesaoJson((p: any) => ({
                              ...p,
                              termoGeolocalizacao: { ...(p.termoGeolocalizacao || {}), concorda: e.target.checked }
                            }))}
                          />
                          <span style={{ fontSize: 13, fontWeight: 700, color: '#1b5e20' }}>
                            Declaro estar ciente e autorizo a utilização da geolocalização e apontamento eletrônico no App Oficial.
                          </span>
                        </label>
                      </div>
                    )}

                    {/* SEÇÃO 12: MetLife Beneficiários do Seguro de Vida (Pág. 15) */}
                    {secaoAtiva === 12 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={secaoBadgeStyle}>Seção 12 · Página 15</span>
                          <h3 style={secaoTituloStyle}>Nomeação de Beneficiários - Seguro de Vida em Grupo (MetLife)</h3>
                          <p style={secaoDescStyle}>Indique os beneficiários da sua apólice de seguro de vida em grupo. A soma das porcentagens deve totalizar 100%.</p>
                        </div>

                        <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8, padding: 12, fontSize: 12, color: '#0369a1' }}>
                          Na qualidade de segurado(a), nomeio por meio deste formulário os beneficiários abaixo indicados para o Seguro de Vida em Grupo MetLife da ATESA.
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                          {(dadosAdesaoJson.beneficiariosSeguro || [{ nome: '', parentesco: '', cpf: '', data_nascimento: '', percentual: '100' }]).map((ben: any, idx: number) => (
                            <div key={idx} style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', position: 'relative' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <span style={{ fontSize: 13, fontWeight: 800, color: '#1b5e20' }}>Beneficiário #{idx + 1}</span>
                                {idx > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const atual = [...(dadosAdesaoJson.beneficiariosSeguro || [])];
                                      atual.splice(idx, 1);
                                      setDadosAdesaoJson((p: any) => ({ ...p, beneficiariosSeguro: atual }));
                                    }}
                                    style={{ background: '#fee2e2', color: '#b91c1c', border: 'none', borderRadius: 6, padding: '4px 8px', fontSize: 11, cursor: 'pointer', fontWeight: 700 }}
                                  >
                                    Remover
                                  </button>
                                )}
                              </div>

                              <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
                                <div>
                                  <label style={labelStyle}>Nome Completo *</label>
                                  <input
                                    style={inputStyle}
                                    placeholder="Ex: Maria da Silva"
                                    value={ben.nome || ''}
                                    onChange={e => {
                                      const atual = [...(dadosAdesaoJson.beneficiariosSeguro || [])];
                                      atual[idx] = { ...atual[idx], nome: e.target.value };
                                      setDadosAdesaoJson((p: any) => ({ ...p, beneficiariosSeguro: atual }));
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>Grau de Parentesco *</label>
                                  <input
                                    style={inputStyle}
                                    placeholder="Ex: Cônjuge, Mãe, Filho"
                                    value={ben.parentesco || ''}
                                    onChange={e => {
                                      const atual = [...(dadosAdesaoJson.beneficiariosSeguro || [])];
                                      atual[idx] = { ...atual[idx], parentesco: e.target.value };
                                      setDadosAdesaoJson((p: any) => ({ ...p, beneficiariosSeguro: atual }));
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>CPF</label>
                                  <input
                                    style={inputStyle}
                                    placeholder="000.000.000-00"
                                    value={ben.cpf || ''}
                                    onChange={e => {
                                      const atual = [...(dadosAdesaoJson.beneficiariosSeguro || [])];
                                      atual[idx] = { ...atual[idx], cpf: e.target.value };
                                      setDadosAdesaoJson((p: any) => ({ ...p, beneficiariosSeguro: atual }));
                                    }}
                                  />
                                </div>
                                <div>
                                  <label style={labelStyle}>% de Participação *</label>
                                  <input
                                    style={inputStyle}
                                    placeholder="100"
                                    value={ben.percentual || ''}
                                    onChange={e => {
                                      const atual = [...(dadosAdesaoJson.beneficiariosSeguro || [])];
                                      atual[idx] = { ...atual[idx], percentual: e.target.value };
                                      setDadosAdesaoJson((p: any) => ({ ...p, beneficiariosSeguro: atual }));
                                    }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}

                          {((dadosAdesaoJson.beneficiariosSeguro || []).length < 4) && (
                            <button
                              type="button"
                              onClick={() => {
                                const atual = [...(dadosAdesaoJson.beneficiariosSeguro || [])];
                                atual.push({ nome: '', parentesco: '', cpf: '', data_nascimento: '', percentual: '50' });
                                setDadosAdesaoJson((p: any) => ({ ...p, beneficiariosSeguro: atual }));
                              }}
                              style={{ background: '#f1f5f9', color: '#1e293b', border: '1px dashed #cbd5e1', borderRadius: 8, padding: '10px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer', alignSelf: 'flex-start' }}
                            >
                              + Adicionar Outro Beneficiário
                            </button>
                          )}
                        </div>
                      </div>
                    )}

                    {/* SEÇÃO 13: Resumo Geral & Conferência da Ficha em Formato de Formulário */}
                    {secaoAtiva === 13 && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                        <div style={secaoTituloContainerStyle}>
                          <span style={{ background: '#1b5e20', color: '#fff', fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6, textTransform: 'uppercase' }}>
                            Conferência Final · Resumo Consolidado
                          </span>
                          <h3 style={secaoTituloStyle}>Resumo Geral da Ficha de Adesão do Cooperado</h3>
                          <p style={secaoDescStyle}>Confira abaixo todos os dados e respostas consolidadas antes de salvar e avançar para o envio de documentos.</p>
                        </div>

                        {/* Formulário de Resumo Estilizado */}
                        <div style={{ background: '#fff', borderRadius: 10, border: '2px solid #2e7d32', padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>

                          {/* Cabeçalho Institucional do Resumo */}
                          <div style={{ textAlign: 'center', borderBottom: '2px solid #1b5e20', paddingBottom: 12 }}>
                            <div style={{ fontSize: 16, fontWeight: 900, color: '#1b5e20', textTransform: 'uppercase' }}>
                              ATESA COOPERATIVA DE TRABALHO DOS PROFISSIONAIS DA SAÚDE
                            </div>
                            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
                              Ficha Cadastral e Proposta de Adesão Consolidada
                            </div>
                          </div>

                          {/* Bloco 1: Identificação & Documentos */}
                          <div style={resumoSecaoBoxStyle}>
                            <div style={resumoSecaoTituloStyle}>1. Dados Cadastrais & Documentos</div>
                            <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 12 }}>
                              <div><strong>Nome:</strong> {candidato.nome}</div>
                              <div><strong>CPF:</strong> {formatarCPF(candidato.cpf)}</div>
                              <div><strong>RG:</strong> {ds.rg || '—'} {ds.orgao_emissor && `(${ds.orgao_emissor}/${ds.uf_rg})`}</div>
                              <div><strong>Nascimento:</strong> {ds.data_nascimento ? formatarDataBR(ds.data_nascimento) : '—'}</div>
                              <div><strong>Nome da Mãe:</strong> {ds.nome_mae || '—'}</div>
                              <div><strong>Estado Civil:</strong> {ds.estado_civil || '—'}</div>
                              <div><strong>Endereço:</strong> {ds.logradouro ? `${ds.logradouro}, ${ds.numero || 'S/N'} - ${ds.bairro}, ${ds.cidade}/${ds.uf}` : '—'}</div>
                              <div><strong>CEP:</strong> {ds.cep || '—'}</div>
                              <div><strong>Telefone:</strong> {candidato.telefone || '—'}</div>
                              <div><strong>E-mail:</strong> {candidato.email || '—'}</div>
                            </div>
                          </div>

                          {/* Bloco 2: Emergência */}
                          <div style={resumoSecaoBoxStyle}>
                            <div style={resumoSecaoTituloStyle}>2. Contatos de Emergência</div>
                            <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 12 }}>
                              <div><strong>Principal:</strong> {emergencia.nome_1 || '—'} ({emergencia.parentesco_1 || '—'}) - {emergencia.telefone_1 || '—'}</div>
                              {emergencia.nome_2 && (
                                <div><strong>Secundário:</strong> {emergencia.nome_2} ({emergencia.parentesco_2}) - {emergencia.telefone_2}</div>
                              )}
                            </div>
                          </div>

                          {/* Bloco 3: Dados Bancários */}
                          <div style={resumoSecaoBoxStyle}>
                            <div style={resumoSecaoTituloStyle}>3. Conta Bancária para Repasses & Quota-Parte</div>
                            <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 12 }}>
                              <div><strong>Banco:</strong> {db.banco || '—'}</div>
                              <div><strong>Agência:</strong> {db.agencia || '—'}</div>
                              <div><strong>Conta:</strong> {db.conta || '—'}-{db.digito || ''} ({db.tipo_conta || 'Corrente'})</div>
                              <div><strong>Chave PIX:</strong> {db.chave_pix ? `${db.chave_pix} (${db.tipo_pix?.toUpperCase()})` : '—'}</div>
                              <div><strong>Quota-Parte:</strong> 50 quotas (R$ 50,00 em 5x R$ 10,00)</div>
                            </div>
                          </div>

                          {/* Bloco 4: Palestra, Questionário e Termos */}
                          <div style={resumoSecaoBoxStyle}>
                            <div style={resumoSecaoTituloStyle}>4. Termos e Declarações Estatutárias</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
                              <div>• <strong>Palestra Cooperativista:</strong> {dadosAdesaoJson.palestraAta?.concorda ? `✓ Assistida (${dadosAdesaoJson.palestraAta?.formato || 'Online'}) e Ata Aceita` : '⚠️ Pendente'}</div>
                              <div>• <strong>Declaração Estatutária (Pág. 6):</strong> {isSecaoConcluida(5) ? '✓ 10 itens respondidos' : '⚠️ Pendente de preenchimento completo'}</div>
                              <div>• <strong>Questionário dos Associados (Pág. 7):</strong> {isSecaoConcluida(6) ? `✓ 12 perguntas respondidas (Papel: ${dadosAdesaoJson.questionario?.q1?.toUpperCase() || 'Associado'})` : '⚠️ Pendente de resposta'}</div>
                              <div>• <strong>Descontos Estatutários:</strong> {dadosAdesaoJson.autorizacoes?.concorda_descontos ? '✓ Autorizados (Quota-Parte, Rateio 3%, INSS 20%)' : '⚠️ Pendente'}</div>
                              <div>• <strong>Termo de Adesão ao Contrato:</strong> {dadosAdesaoJson.termoAdesaoContrato?.concorda ? '✓ Aceito formalmente' : '⚠️ Pendente'}</div>
                              <div>• <strong>Confidencialidade & Sigilo (Art. 154 CP):</strong> {dadosAdesaoJson.termoConfidencialidade?.concorda ? '✓ Assinado e Ciente' : '⚠️ Pendente'}</div>
                              <div>• <strong>Consentimento LGPD (Lei 13.709):</strong> {dadosAdesaoJson.termoLgpd?.concorda ? '✓ Consentimento Expresso Concedido' : '⚠️ Pendente'}</div>
                              <div>• <strong>Geolocalização & Apontamento App:</strong> {dadosAdesaoJson.termoGeolocalizacao?.concorda ? '✓ Autorizado para o App' : '⚠️ Pendente'}</div>
                            </div>
                          </div>

                          {/* Bloco 5: Beneficiários MetLife */}
                          <div style={resumoSecaoBoxStyle}>
                            <div style={resumoSecaoTituloStyle}>5. Beneficiários do Seguro MetLife (Pág. 15)</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                              {(dadosAdesaoJson.beneficiariosSeguro || []).map((b: any, i: number) => (
                                <div key={i}>
                                  #{i + 1}: <strong>{b.nome || 'Não informado'}</strong> - Parentesco: {b.parentesco || '—'} - {b.percentual || 100}%
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Assinatura Digital do Cooperado */}
                          <div style={{ background: '#f8fafc', padding: 14, borderRadius: 8, border: '1px solid #e2e8f0', textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', fontWeight: 700 }}>Assinatura Digital do Cooperado</div>
                            <div style={{ fontSize: 15, fontWeight: 900, color: '#1b5e20', margin: '4px 0' }}>{candidato.nome}</div>
                            <div style={{ fontSize: 11, color: '#94a3b8' }}>
                              CPF: {formatarCPF(candidato.cpf)} · Registrado digitalmente no Portal ATESA
                            </div>
                          </div>

                        </div>
                      </div>
                    )}

                    {/* Barra de Navegação Inferior (Anterior / Próxima / Salvar) */}
                    <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                      <div>
                        {secaoAtiva > 1 && (
                          <button
                            type="button"
                            onClick={() => setSecaoAtiva(secaoAtiva - 1)}
                            style={{
                              background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', borderRadius: 8,
                              padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                            }}
                          >
                            ← Seção Anterior
                          </button>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 10 }}>
                        {secaoAtiva < 13 ? (
                          <button
                            type="button"
                            onClick={() => setSecaoAtiva(secaoAtiva + 1)}
                            style={{
                              background: '#1565c0', color: '#fff', border: 'none', borderRadius: 8,
                              padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 6,
                            }}
                          >
                            Próxima Seção →
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={salvandoAdesao}
                            onClick={() => handleSalvarAdesaoCompleta()}
                            style={{
                              background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8,
                              padding: '12px 24px', fontSize: 14, fontWeight: 800, cursor: 'pointer',
                              display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 10px rgba(27,94,32,0.3)',
                            }}
                          >
                            <IconCheck size={18} />
                            {salvandoAdesao ? 'Salvando Proposta...' : 'Confirmar e Salvar Proposta de Adesão →'}
                          </button>
                        )}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            ))}

            {/* ── ABA 4: ENVIAR DOCUMENTOS ─────────────────────────────────────── */}
            {aba === 'documentos' && (!isAdesaoPreenchida ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1b5e20', margin: '0 0 8px' }}>Etapa Bloqueada</h3>
                <p style={{ fontSize: 14, color: '#555', margin: '0 0 20px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                  O envio de documentos comprobatórios só é liberado após o preenchimento e confirmação de todas as seções da Proposta de Adesão Completa na Aba 3.
                </p>
                <button
                  onClick={() => setAba('adesao')}
                  style={{
                    background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ← Ir para Adesão Completa (Aba 3)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: '18px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: '#1b5e20' }}>
                        📁 Envio de Documentos Comprobatórios
                      </h2>
                      <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
                        Os 6 primeiros documentos com asterisco (<span style={{ color: '#dc2626', fontWeight: 700 }}>*</span>) são <strong>obrigatórios</strong> para aprovação da adesão.
                      </p>
                    </div>
                    <div style={{ background: todosObrigatoriosProntos ? '#e8f5e9' : '#fff3e0', padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, color: todosObrigatoriosProntos ? '#1b5e20' : '#d97706' }}>
                      {docsObrigatoriosEnviadosCount} de 6 Obrigatórios Enviados
                    </div>
                  </div>
                </div>

                {/* Grid dos 8 Cards de Documentos */}
                <div className="secao-grid-responsive" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  {CARDS_DOCUMENTOS.map((card) => {
                    const docEnviado = documentos.find(d => d.tipo === card.tipo);
                    const isValidado = docEnviado?.validado === 1;
                    const isRejeitado = docEnviado?.rejeitado === 1;
                    const isPendente = docEnviado && !isValidado && !isRejeitado;

                    return (
                      <div
                        key={card.tipo}
                        style={{
                          background: '#fff',
                          borderRadius: 10,
                          padding: 18,
                          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                          border: isRejeitado
                            ? '1.5px solid #ef4444'
                            : isValidado
                              ? '1.5px solid #22c55e'
                              : isPendente
                                ? '1.5px solid #0ea5e9'
                                : '1px solid #e2e8f0',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          gap: 12,
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 22 }}>{card.icon}</span>
                              <div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>
                                  {card.titulo} {card.obrigatorio ? <span style={{ color: '#dc2626' }}>*</span> : <span style={{ fontSize: 11, fontWeight: 500, color: '#64748b' }}>(Opcional)</span>}
                                </div>
                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{card.desc}</div>
                              </div>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div style={{ marginTop: 10 }}>
                            {isValidado && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                ✓ Validado e Aprovado
                              </span>
                            )}
                            {isRejeitado && (
                              <div style={{ background: '#fee2e2', color: '#b91c1c', padding: '6px 8px', borderRadius: 6, fontSize: 11, marginTop: 4 }}>
                                <strong>Rejeitado:</strong> {docEnviado.motivo_rejeicao || 'Documento ilegível ou incompleto. Reenvie.'}
                              </div>
                            )}
                            {isPendente && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 700 }}>
                                ⏳ Enviado · Em Análise
                              </span>
                            )}
                            {!docEnviado && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: card.obrigatorio ? '#fef3c7' : '#f1f5f9', color: card.obrigatorio ? '#b45309' : '#64748b', padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                                {card.obrigatorio ? '⚠️ Pendente de Envio' : 'Não enviado'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                          <button
                            onClick={() => triggerUpload(card.tipo)}
                            disabled={uploadingTipo === card.tipo}
                            style={{
                              flex: 1,
                              background: docEnviado ? '#f1f5f9' : '#1b5e20',
                              color: docEnviado ? '#334155' : '#fff',
                              border: docEnviado ? '1px solid #cbd5e1' : 'none',
                              borderRadius: 6,
                              padding: '8px 12px',
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 6,
                            }}
                          >
                            <IconUpload size={14} />
                            {uploadingTipo === card.tipo ? 'Enviando...' : docEnviado ? 'Substituir' : 'Anexar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Botão de Avançar se todos obrigatórios enviados */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                  <button
                    disabled={!todosObrigatoriosProntos}
                    onClick={() => setAba('app')}
                    style={{
                      background: todosObrigatoriosProntos ? '#1b5e20' : '#94a3b8',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 8,
                      padding: '12px 24px',
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: todosObrigatoriosProntos ? 'pointer' : 'not-allowed',
                      boxShadow: todosObrigatoriosProntos ? '0 2px 8px rgba(27,94,32,0.3)' : 'none',
                    }}
                  >
                    Próximo: Finalizar & Baixar Aplicativo →
                  </button>
                </div>
              </div>
            ))}

            {/* ── ABA 5: FINALIZAÇÃO & BAIXAR APP ──────────────────────────────── */}
            {aba === 'app' && (!todosObrigatoriosProntos ? (
              <div style={{ background: '#fff', borderRadius: 12, padding: 32, textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: '#1b5e20', margin: '0 0 8px' }}>Etapa Bloqueada</h3>
                <p style={{ fontSize: 14, color: '#555', margin: '0 0 20px', maxWidth: 500, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
                  Para finalizar a adesão e liberar o download do aplicativo, é necessário anexar todos os 6 documentos obrigatórios na Aba 4.
                </p>
                <button
                  onClick={() => setAba('documentos')}
                  style={{
                    background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8,
                    padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  ← Ir para Envio de Documentos (Aba 4)
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: '24px 28px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1b5e20', margin: '0 0 8px' }}>
                    Processo de Adesão Enviado com Sucesso!
                  </h2>
                  <p style={{ fontSize: 14, color: '#555', maxWidth: 600, margin: '0 auto 16px', lineHeight: 1.5 }}>
                    Sua documentação completa e proposta de adesão foram recebidas pela equipe de Benefícios da ATESA.
                    O processo de validação documental está em andamento.
                  </p>

                  <div style={{ background: '#f8fafc', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0', maxWidth: 500, margin: '0 auto 20px', textAlign: 'left' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase' }}>Status de Homologação</div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#0369a1', marginTop: 2 }}>
                      Em Análise Documental pela Supervisão
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                      Assim que todos os seus documentos forem validados 100%, sua matrícula definitiva será ativada automaticamente.
                    </div>
                  </div>

                  <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '24px 0' }} />

                  {/* Seção Baixar o App */}
                  {/* Card de Configuração de Senha do App */}
                  <div style={{
                    background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: 12,
                    padding: 20, margin: '20px 0', textAlign: 'left',
                  }}>
                    <h4 style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 800, color: '#1b5e20', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>🔐</span> Configure sua Senha de Acesso ao Aplicativo
                    </h4>
                    <p style={{ margin: '0 0 14px', fontSize: 12, color: '#64748b' }}>
                      Crie sua senha pessoal para efetuar login no App do Cooperado e no módulo de apontamentos diários:
                    </p>

                    <form onSubmit={handleSalvarSenhaApp} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'flex-end' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Nova Senha (mín. 6 dígitos)
                        </label>
                        <input
                          type="password"
                          value={senhaApp}
                          onChange={(e) => setSenhaApp(e.target.value)}
                          placeholder="Digite sua senha"
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 6,
                            border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 4 }}>
                          Confirmar Senha
                        </label>
                        <input
                          type="password"
                          value={confirmarSenhaApp}
                          onChange={(e) => setConfirmarSenhaApp(e.target.value)}
                          placeholder="Repita a senha"
                          style={{
                            width: '100%', padding: '9px 12px', borderRadius: 6,
                            border: '1px solid #cbd5e1', fontSize: 13, outline: 'none', boxSizing: 'border-box'
                          }}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={salvandoSenhaApp}
                        style={{
                          background: senhaSalvaSucesso ? '#15803d' : '#0f172a', color: '#fff', border: 'none',
                          borderRadius: 6, padding: '10px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                      >
                        {salvandoSenhaApp ? 'Salvando...' : senhaSalvaSucesso ? '✓ Senha Definida' : 'Salvar Senha do App'}
                      </button>
                    </form>
                    {erroSenhaApp && <div style={{ color: '#dc2626', fontSize: 12, marginTop: 8 }}>{erroSenhaApp}</div>}
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: '0 0 10px' }}>
                    📱 Baixe o Aplicativo ATESA Cooperativa
                  </h3>
                  <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 20px' }}>
                    Disponível gratuitamente para Android e iPhone. Acompanhe suas escalas, plantões e realize seus apontamentos diários de jornada, refeição e pausas na palma da sua mão.
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <button
                      onClick={abrirGooglePlay}
                      style={{
                        background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10,
                        padding: '12px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>🤖</span> Google Play (Android)
                    </button>
                    <button
                      onClick={abrirAppStore}
                      style={{
                        background: '#0f172a', color: '#fff', border: 'none', borderRadius: 10,
                        padding: '12px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}
                    >
                      <span style={{ fontSize: 20 }}>🍎</span> App Store (Apple / iOS)
                    </button>
                    <a
                      href={`/cooperado/app${token ? `?token=${token}` : ''}`}
                      style={{
                        background: 'linear-gradient(135deg, #1b5e20, #2e7d32)', color: '#fff', textDecoration: 'none',
                        borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 12px rgba(27,94,32,0.3)',
                      }}
                    >
                      <span style={{ fontSize: 20 }}>🚀</span> Acessar App Web / PWA Agora
                    </a>
                  </div>
                </div>
              </div>
            ))}

          </main>

          {/* ── MODAL: MODELO DA DECLARAÇÃO DE LIVRE ADESÃO (PÁG 1) ─────────── */}
          {modalDeclaracaoAberto && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0,0,0,0.65)', zIndex: 9999,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
              backdropFilter: 'blur(3px)',
            }}>
              <div style={{
                background: '#fff', borderRadius: 14, maxWidth: 640, width: '100%', maxHeight: '92vh',
                overflowY: 'auto', padding: '22px 24px', boxShadow: '0 20px 50px rgba(0,0,0,0.4)',
                display: 'flex', flexDirection: 'column', gap: 14,
              }}>
                {/* Cabeçalho do Modal */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: 10 }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#1b5e20' }}>
                      📄 Declaração de Livre Adesão (Página 1 Oficial)
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748b' }}>
                      Folha oficial pautada para redação de próprio punho (manuscrita) e assinatura.
                    </p>
                  </div>
                  <button
                    onClick={() => setModalDeclaracaoAberto(false)}
                    style={{ background: '#f1f5f9', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 16, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Preview da Folha Oficial Exata com layout e linhas */}
                <div style={{
                  background: '#e2e8f0', borderRadius: 8, padding: '14px 12px',
                  display: 'flex', justifyContent: 'center', alignItems: 'center',
                }}>
                  <div style={{
                    background: '#fff', borderRadius: 4, width: '100%', maxWidth: 460,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)', border: '1px solid #cbd5e1',
                    overflow: 'hidden',
                  }}>
                    <img
                      src="/documentos/declaracao_pagina_1.png"
                      alt="Folha Oficial de Declaração de Livre Adesão - ATESA"
                      style={{ width: '100%', height: 'auto', display: 'block' }}
                    />
                  </div>
                </div>

                {/* Rodapé do Modal com APENAS UM botão de imprimir e um de enviar */}
                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 14, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <button
                    onClick={imprimirFolhaOficial}
                    style={{
                      background: '#1b5e20', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(27,94,32,0.25)',
                    }}
                  >
                    🖨️ Imprimir Folha Oficial
                  </button>

                  <button
                    onClick={() => {
                      setModalDeclaracaoAberto(false);
                      triggerUpload('declaracao_adesao');
                    }}
                    style={{
                      background: '#0284c7', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '11px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 6, boxShadow: '0 2px 8px rgba(2,132,199,0.25)',
                    }}
                  >
                    📷 Tirar Foto / Enviar Declaração
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </IonContent>
    </IonPage>
  );
};

// ── Estilos CSS em Objetos ───────────────────────────────────────────────────
const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 700,
  color: '#475569',
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 6,
  border: '1px solid #cbd5e1',
  fontSize: 13,
  color: '#1e293b',
  outline: 'none',
  boxSizing: 'border-box',
};

const secaoTituloContainerStyle: React.CSSProperties = {
  borderBottom: '1px solid #f1f5f9',
  paddingBottom: 12,
  marginBottom: 4,
};

const secaoTituloStyle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: '#1b5e20',
  margin: '6px 0 2px',
};

const secaoDescStyle: React.CSSProperties = {
  fontSize: 13,
  color: '#64748b',
  margin: 0,
};

const secaoBadgeStyle: React.CSSProperties = {
  background: '#e8f5e9',
  color: '#1b5e20',
  fontSize: 11,
  fontWeight: 800,
  padding: '3px 8px',
  borderRadius: 6,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
};

const subsecaoHeaderStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 800,
  color: '#334155',
  margin: '14px 0 8px',
  borderTop: '1px solid #f1f5f9',
  paddingTop: 12,
};

const questionarioCardStyle: React.CSSProperties = {
  background: '#f8fafc',
  padding: 12,
  borderRadius: 8,
  border: '1px solid #e2e8f0',
};

const radioOptionLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 700,
  color: '#334155',
};

const resumoSecaoBoxStyle: React.CSSProperties = {
  background: '#f8fafc',
  padding: 12,
  borderRadius: 8,
  border: '1px solid #e2e8f0',
};

const resumoSecaoTituloStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 800,
  color: '#1b5e20',
  textTransform: 'uppercase',
  marginBottom: 6,
  borderBottom: '1px solid #e2e8f0',
  paddingBottom: 4,
};

export default PortalCooperado;
