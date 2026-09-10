/**
 * CandidatoDetalhe — Visualização e edição completa do candidato/cooperado.
 * Abas: Dados Pessoais | Endereço | Dados Bancários | Documentos | Descontos | Histórico
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IonButton } from '@ionic/react';
import { useToast } from '../../components/ToastContext';
import { useAuth } from '../../auth/AuthContext';
import { usePermissoes } from '../../auth/PermissoesContext';
import {
  Candidato, Alocacao, inativarCandidato, desligarCandidato, reativarCandidato,
  atualizarCandidato, avaliarCandidato, TipoContratacao,
  HistoricoNota, HistoricoDesligamento, listarHistoricoNotas, listarHistoricoDesligamentos, obterCandidato,
} from '../../api/raApi';
import {
  DadosSensiveis, DadosBancarios, Documento, Descontos, RegistroAuditoria, QualificacaoCatalogo, CotaMensal,
  ROTULO_TIPO_DOC, TipoDocumento, ContatosEmergencia, PropostaAdesao,
  obterDadosSensiveis, salvarDadosSensiveis,
  obterDadosBancarios, salvarDadosBancarios,
  listarDocumentos, enviarDocumento, validarDocumento, rejeitarDocumento, removerDocumento, urlDownloadDocumento,
  obterDescontos, salvarDescontos,
  listarAuditoria,
  listarQualificacoesCatalogo, obterQualificacoesCandidato, salvarQualificacoesCandidato, criarQualificacaoCatalogo,
  listarCotasMensais, criarCotaMensal, atualizarCotaMensal, removerCotaMensal,
  enviarWhatsApp,
  processarFechamentoMensal,
  obterPropostaAdesaoAdmin,
  homologarAdesao100Admin,
} from '../../api/beneficiosApi';
import { buscarEnderecoPorCep, formatarCEP, formatarDataBR, formatarMoeda } from '../../utils/formatters';
import { LISTA_BANCOS_BRASIL } from '../../data/bancos';
import {
  IconFile, IconImage, IconTrash, IconCheck, IconX, IconBell, IconLock,
  IconUpload, IconCheckCircle, IconEdit, IconRefresh, IconPhone2, IconMail, IconPhone,
  IconBuilding, IconAlert, IconSearch,
} from '../../components/Icons';

// ── Estilos compartilhados ─────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
  padding: '20px 22px', marginBottom: 16,
};
const sTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#4a9e4f',
  borderBottom: '2px solid #c8e6c9', paddingBottom: 5, marginBottom: 14, marginTop: 0,
};
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
const label: React.CSSProperties = { fontSize: 11, color: '#666666', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' };
const input: React.CSSProperties = {
  border: '1.5px solid #cccccc',
  borderRadius: 6,
  padding: '7px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  width: '100%',
  boxSizing: 'border-box',
  background: '#ffffff',
  backgroundColor: '#ffffff',
  color: '#1a1a1a',
  colorScheme: 'light',
  outline: 'none',
};
const select: React.CSSProperties = {
  ...input,
  background: '#ffffff',
  backgroundColor: '#ffffff',
  color: '#1a1a1a',
  colorScheme: 'light',
};
const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, fontWeight: 700, background: bg, color,
});

type Aba = 'pessoal' | 'endereco' | 'bancario' | 'documentos' | 'descontos' | 'historico' | 'auditoria';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'pessoal', label: 'Dados Pessoais' },
  { id: 'endereco', label: 'Endereço' },
  { id: 'bancario', label: 'Dados Bancários' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'descontos', label: 'Descontos Fixos' },
  { id: 'historico', label: 'Histórico de alocações' },
  { id: 'auditoria', label: 'Auditoria' },
];

const DS_VAZIO: DadosSensiveis = {
  data_nascimento: '', rg: '', orgao_emissor: '', uf_rg: '', nome_mae: '', nome_pai: '',
  estado_civil: undefined, naturalidade: '', nacionalidade: 'Brasileiro(a)',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  pis_pasep: '', titulo_eleitor: '', cnh: '', categoria_cnh: '', qualificacoes: '',
};

const DB_VAZIO: DadosBancarios = {
  banco: '', codigo_banco: '', agencia: '', conta: '', digito: '',
  tipo_conta: 'corrente', chave_pix: '', tipo_pix: undefined,
};

const DESC_VAZIO: Descontos = {
  inss_percentual: 20, seguro_vida_percentual: 4.15,
  quota_parte_valor: 0, quota_parcelada: false,
  quota_total_cotas: undefined, quota_cotas_pagas: 0,
  rateio_percentual: 5, outras_descricao: '', outras_valor: 0,
};

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Campo({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={field}>
      <span style={label}>{lbl}</span>
      {children}
    </div>
  );
}

function ValorLeitura({ valor }: { valor?: string | number | null }) {
  return <span style={{ fontSize: 13, color: valor ? '#222' : '#bbb' }}>{valor || '—'}</span>;
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  candidato: Candidato;
  alocacoes: Alocacao[];
  onVoltar: () => void;
  onAtualizado?: () => void;
  abaInicial?: Aba;
}

const CandidatoDetalhe: React.FC<Props> = ({ candidato: candInicial, alocacoes, onVoltar, onAtualizado, abaInicial }) => {
  const { showToast } = useToast();
  const { usuario } = useAuth();
  const { temPermissao } = usePermissoes();
  const [candidato, setCandidato] = useState<Candidato>(candInicial);
  const [tipoContratacao, setTipoContratacao] = useState<TipoContratacao>(candInicial.tipo_contratacao || 'externo');
  const [modalInativar, setModalInativar] = useState(false);
  const [motivoInativar, setMotivoInativar] = useState('');
  const [inativando, setInativando] = useState(false);

  // Modal de desligamento com dupla confirmação
  const [modalDesligar, setModalDesligar] = useState(false);
  const [tipoDesligamento, setTipoDesligamento] = useState<'total' | 'realocacao'>('total');
  const [etapaDesligar, setEtapaDesligar] = useState<1 | 2>(1);
  const [motivoDesligar, setMotivoDesligar] = useState('');
  const [dataDesligar, setDataDesligar] = useState('');
  const [desligando, setDesligando] = useState(false);

  // Modal de avaliação (nota 0.0 a 10.0)
  const [modalAvaliacao, setModalAvaliacao] = useState<{
    aberto: boolean;
    nota: string;
    observacao: string;
    salvando: boolean;
  }>({
    aberto: false,
    nota: '',
    observacao: '',
    salvando: false,
  });

  const [aba, setAba] = useState<Aba>(abaInicial ?? 'pessoal');

  const [ds, setDs] = useState<DadosSensiveis>(DS_VAZIO);
  const [db, setDb] = useState<DadosBancarios>(DB_VAZIO);
  const [desc, setDesc] = useState<Descontos>(DESC_VAZIO);
  const [emergencia, setEmergencia] = useState<ContatosEmergencia>({});
  const [propostaAdesao, setPropostaAdesao] = useState<PropostaAdesao | null>(null);
  const [homologando100, setHomologando100] = useState(false);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipoUpload, setTipoUpload] = useState<TipoDocumento>('outro');
  const [enviandoDoc, setEnviandoDoc] = useState(false);

  // Auditoria e Históricos
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([]);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);
  const [historicoNotas, setHistoricoNotas] = useState<HistoricoNota[]>([]);
  const [historicoDesligamentos, setHistoricoDesligamentos] = useState<HistoricoDesligamento[]>([]);
  const [carregandoHistoricos, setCarregandoHistoricos] = useState(false);
  const [filtroAcaoAuditoria, setFiltroAcaoAuditoria] = useState<string>('todos');
  const [buscaAuditoria, setBuscaAuditoria] = useState<string>('');
  const [paginaAuditoria, setPaginaAuditoria] = useState<number>(1);

  // Qualificações
  const [catalogo, setCatalogo] = useState<QualificacaoCatalogo[]>([]);
  const [qualSelecionadas, setQualSelecionadas] = useState<number[]>([]);
  const [salvandoQual, setSalvandoQual] = useState(false);
  const [novaQual, setNovaQual] = useState('');

  // Cotas Mensais
  const [cotas, setCotas] = useState<CotaMensal[]>([]);
  const [carregandoCotas, setCarregandoCotas] = useState(false);
  const [novaCota, setNovaCota] = useState({ descricao: '', tipo: 'outro', valor: '', totalParcelas: '', recorrente: false, observacao: '' });
  const [adicionandoCota, setAdicionandoCota] = useState(false);
  const [showFormCota, setShowFormCota] = useState(false);

  // Rejeição de documentos
  const [rejeitandoDoc, setRejeitandoDoc] = useState<number | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  // WhatsApp
  const [enviandoWpp, setEnviandoWpp] = useState(false);

  // Fechamento Mensal
  const [processandoFechamento, setProcessandoFechamento] = useState(false);

  // Homologação 100% da Adesão
  const handleHomologarAdesao100 = async () => {
    if (!confirm(`Homologar 100% a proposta de adesão de "${candidato.nome}"? Isso ativará o cooperado com status 1 e gerará a matrícula oficial sequencial.`)) return;
    setHomologando100(true);
    try {
      const res = await homologarAdesao100Admin(candidato.id);
      showToast(`Adesão 100% homologada com sucesso! Matrícula: #${res.matricula}`, 'success');
      setCandidato((p) => ({
        ...p,
        status: 1,
        matricula: res.matricula,
        aprovado_em: new Date().toISOString(),
      }));
      setPropostaAdesao((p) => p ? ({ ...p, status_adesao: 'homologado_100', homologado_em: new Date().toISOString(), homologado_por_nome: usuario?.nome || 'Admin' }) : null);
      carregarAuditoria();
      onAtualizado?.();
    } catch (e: any) {
      showToast(e.message || 'Erro ao homologar adesão.', 'error');
    } finally {
      setHomologando100(false);
    }
  };

  const carregarHistoricos = useCallback(async () => {
    setCarregandoHistoricos(true);
    try {
      const [hNotas, hDesl] = await Promise.all([
        listarHistoricoNotas(candidato.id).catch(() => []),
        listarHistoricoDesligamentos(candidato.id).catch(() => []),
      ]);
      setHistoricoNotas(hNotas);
      setHistoricoDesligamentos(hDesl);
    } catch {
      /* silencioso */
    } finally {
      setCarregandoHistoricos(false);
    }
  }, [candidato.id]);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [dadosS, dadosB, dadosD, dadosDocs, qual, catCatalogo, propEme] = await Promise.all([
        obterDadosSensiveis(candidato.id).catch(() => ({})),
        obterDadosBancarios(candidato.id).catch(() => ({})),
        obterDescontos(candidato.id).catch(() => ({})),
        listarDocumentos(candidato.id).catch(() => []),
        obterQualificacoesCandidato(candidato.id).catch(() => []),
        listarQualificacoesCatalogo().catch(() => []),
        obterPropostaAdesaoAdmin(candidato.id).catch(() => ({ proposta: null, contatos: null })),
      ]);
      setDs({ ...DS_VAZIO, ...dadosS });
      setDb({ ...DB_VAZIO, ...dadosB });
      setDesc({ ...DESC_VAZIO, ...dadosD });
      setDocs(dadosDocs);
      setQualSelecionadas((qual as QualificacaoCatalogo[]).map((q) => q.id));
      setCatalogo(catCatalogo as QualificacaoCatalogo[]);
      if (propEme?.contatos) setEmergencia(propEme.contatos);
      if (propEme?.proposta) setPropostaAdesao(propEme.proposta);
      carregarHistoricos();
    } finally {
      setCarregando(false);
    }
  }, [candidato.id, carregarHistoricos]);

  const carregarAuditoria = useCallback(async () => {
    setCarregandoAuditoria(true);
    try {
      const [regsAuditoria] = await Promise.all([
        listarAuditoria(candidato.id, 500),
        carregarHistoricos(),
      ]);
      setAuditoria(regsAuditoria);
    } catch {
      /* silencioso */
    } finally {
      setCarregandoAuditoria(false);
    }
  }, [candidato.id, carregarHistoricos]);

  const carregarCotas = useCallback(async () => {
    setCarregandoCotas(true);
    try { setCotas(await listarCotasMensais(candidato.id)); }
    catch { /* silencioso */ } finally { setCarregandoCotas(false); }
  }, [candidato.id]);

  useEffect(() => { carregar(); }, [carregar]);

  useEffect(() => {
    if (abaInicial) {
      setAba(abaInicial);
    }
  }, [abaInicial, candInicial.id]);

  useEffect(() => {
    setCandidato(candInicial);
    setTipoContratacao(candInicial.tipo_contratacao || 'externo');
  }, [candInicial]);

  // Lazy-load de dados pesados ao trocar de aba
  useEffect(() => {
    if (aba === 'auditoria') {
      carregarAuditoria();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  const updDs = (k: keyof DadosSensiveis, v: string) => setDs((p) => ({ ...p, [k]: v }));
  const updDb = (k: keyof DadosBancarios, v: string) => setDb((p) => ({ ...p, [k]: v }));
  const updDesc = (k: keyof Descontos, v: unknown) => setDesc((p) => ({ ...p, [k]: v }));

  // Busca CEP
  const handleCep = async (cep: string) => {
    updDs('cep', formatarCEP(cep));
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCep(digits);
      if (end) {
        setDs((p) => ({
          ...p,
          logradouro: end.rua ?? p.logradouro,
          bairro: end.bairro ?? p.bairro,
          cidade: end.cidade ?? p.cidade,
          uf: end.uf ?? p.uf,
        }));
      }
    } catch { /* silencioso */ } finally { setBuscandoCep(false); }
  };

  // ── Salvar Todas as Informações (Unificado) ──────────────────────────────────
  const [salvandoTudo, setSalvandoTudo] = useState(false);

  const salvarTudo = async () => {
    setSalvandoTudo(true);
    try {
      await Promise.all([
        salvarDadosSensiveis(candidato.id, ds),
        atualizarCandidato(candidato.id, {
          nome: candidato.nome,
          email: candidato.email ?? undefined,
          telefone: candidato.telefone ?? undefined,
          whatsapp: candidato.whatsapp ?? undefined,
          cooperativa: candidato.cooperativa,
          tipo_contratacao: tipoContratacao,
          observacoes: candidato.observacoes ?? undefined,
        }),
        salvarDadosBancarios(candidato.id, db),
        salvarDescontos(candidato.id, desc),
        salvarQualificacoesCandidato(candidato.id, qualSelecionadas),
      ]);
      setCandidato((p) => ({ ...p, tipo_contratacao: tipoContratacao }));
      showToast('Todas as informações foram salvas com sucesso!', 'success');
      onAtualizado?.();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao salvar informações.', 'error');
    } finally {
      setSalvandoTudo(false);
    }
  };

  // Salvar dados sensíveis (pessoal + endereço juntos) e tipo de contratação (mantido para compatibilidade)
  const salvarPessoal = async () => {
    return salvarTudo();
  };

  const abrirModalAvaliacao = (notaSugerida: string = '') => {
    setModalAvaliacao({
      aberto: true,
      nota: notaSugerida || (candidato.nota_avaliacao !== null && candidato.nota_avaliacao !== undefined ? String(candidato.nota_avaliacao) : ''),
      observacao: candidato.observacao_avaliacao || '',
      salvando: false,
    });
  };

  const handleConfirmarAvaliacao = async () => {
    const notaNum = parseFloat(modalAvaliacao.nota.replace(',', '.'));
    if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) {
      showToast('A nota deve estar entre 0.0 e 10.0', 'warning');
      return;
    }
    setModalAvaliacao((p) => ({ ...p, salvando: true }));
    try {
      const resp = await avaliarCandidato(candidato.id, {
        nota: notaNum,
        observacao: modalAvaliacao.observacao || undefined,
      });
      if (resp.aprovado) {
        showToast(`Cooperado APROVADO com nota ${notaNum.toFixed(1)}!\nMatrícula: ${resp.matricula || 'Gerada'}`, 'success');
        setCandidato((p) => ({
          ...p,
          status: 1,
          nota_avaliacao: notaNum,
          matricula: resp.matricula || p.matricula,
          observacao_avaliacao: modalAvaliacao.observacao || p.observacao_avaliacao,
          avaliado_em: new Date().toISOString(),
          avaliado_por_nome: usuario?.nome,
        }));
      } else {
        showToast(`Cooperado REPROVADO com nota ${notaNum.toFixed(1)}. O cooperado poderá realizar nova prova futuramente.`, 'warning');
        setCandidato((p) => ({
          ...p,
          status: 3,
          nota_avaliacao: notaNum,
          observacao_avaliacao: modalAvaliacao.observacao || p.observacao_avaliacao,
          avaliado_em: new Date().toISOString(),
          avaliado_por_nome: usuario?.nome,
        }));
      }
      setModalAvaliacao({ aberto: false, nota: '', observacao: '', salvando: false });
      carregarHistoricos();
      onAtualizado?.();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao registrar avaliação.', 'error');
      setModalAvaliacao((p) => ({ ...p, salvando: false }));
    }
  };

  const handleConfirmarInativar = async () => {
    setInativando(true);
    try {
      await inativarCandidato(candidato.id, motivoInativar);
      showToast('Cooperado inativado com sucesso.', 'success');
      setCandidato((p) => ({ ...p, status: 2, motivo_inativacao: motivoInativar, inativado_em: new Date().toISOString(), inativado_por_nome: usuario?.nome }));
      setModalInativar(false);
      setMotivoInativar('');
      carregarHistoricos();
      onAtualizado?.();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao inativar cooperado.', 'error');
    } finally {
      setInativando(false);
    }
  };

  const handleConfirmarDesligar = async () => {
    setDesligando(true);
    try {
      await desligarCandidato(candidato.id, motivoDesligar, dataDesligar, tipoDesligamento);
      if (tipoDesligamento === 'realocacao') {
        showToast(`Posto encerrado para realocação/troca de função com sucesso. Matrícula #${candidato.matricula || ''} preservada.`, 'success');
        setCandidato((p) => ({
          ...p,
          alocacoes_ativas: 0,
        }));
      } else {
        showToast('Cooperado desligado totalmente e matrícula cancelada com sucesso.', 'success');
        setCandidato((p) => ({
          ...p,
          status: 4,
          matricula: null,
          motivo_inativacao: motivoDesligar,
          inativado_em: dataDesligar || new Date().toISOString(),
          inativado_por_nome: usuario?.nome,
          alocacoes_ativas: 0,
          total_desligamentos: (p.total_desligamentos || 0) + 1,
        }));
      }
      setModalDesligar(false);
      setEtapaDesligar(1);
      setMotivoDesligar('');
      setDataDesligar('');
      setTipoDesligamento('total');
      carregarHistoricos();
      onAtualizado?.();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao desligar cooperado.', 'error');
    } finally {
      setDesligando(false);
    }
  };

  const handleReativar = async () => {
    const eraDesligado = candidato.status === 4;
    const msgConfirmacao = eraDesligado
      ? `Recontratar o cooperado "${candidato.nome}"? Uma nova matrícula sequencial será gerada automaticamente mantendo todo o histórico anterior.`
      : `Reativar o cooperado "${candidato.nome}"?`;
    if (!confirm(msgConfirmacao)) return;
    try {
      const res = await reativarCandidato(candidato.id);
      if (res.recontratado && res.novaMatricula) {
        showToast(`Cooperado recontratado com sucesso! Nova matrícula: #${res.novaMatricula}`, 'success');
        setCandidato((p) => ({
          ...p,
          status: 1,
          matricula: res.novaMatricula!,
          matricula_anterior: res.matriculaAnterior || p.matricula,
          inativado_em: null,
          inativado_por_nome: null,
          motivo_inativacao: null,
        }));
      } else {
        showToast('Cooperado reativado com sucesso!', 'success');
        setCandidato((p) => ({ ...p, status: 1, inativado_em: null, inativado_por_nome: null, motivo_inativacao: null }));
      }
      carregarHistoricos();
      onAtualizado?.();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao reativar cooperado.', 'error');
    }
  };

  const salvarBancario = async () => {
    setSalvando(true);
    try {
      await salvarDadosBancarios(candidato.id, db);
      showToast('Dados bancários salvos!', 'success');
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSalvando(false); }
  };

  const salvarDescontosHandler = async () => {
    setSalvando(true);
    try {
      await salvarDescontos(candidato.id, desc);
      showToast('Descontos salvos!', 'success');
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSalvando(false); }
  };

  // WhatsApp
  const handleWhatsApp = async () => {
    setEnviandoWpp(true);
    try {
      const resp = await enviarWhatsApp(candidato.id);
      if (resp.enviado) {
        showToast('Mensagem enviada com sucesso via WhatsApp!', 'success');
      } else if (resp.whatsappWebUrl) {
        if (navigator.clipboard && resp.link) {
          navigator.clipboard.writeText(resp.link).catch(() => { });
        }
        window.open(resp.whatsappWebUrl, '_blank');
        showToast('Abrindo WhatsApp Web para envio... Link copiado para a área de transferência!', 'success');
      } else {
        showToast(`Link de cadastro gerado: ${resp.link}`, 'info');
      }
    } catch { showToast('Erro ao processar envio de WhatsApp.', 'error'); }
    finally { setEnviandoWpp(false); }
  };

  // Qualificações
  const toggleQual = (id: number) =>
    setQualSelecionadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSalvarQual = async () => {
    setSalvandoQual(true);
    try {
      await salvarQualificacoesCandidato(candidato.id, qualSelecionadas);
      showToast('Qualificações salvas!', 'success');
    } catch { showToast('Erro ao salvar qualificações.', 'error'); }
    finally { setSalvandoQual(false); }
  };

  const handleNovaQual = async () => {
    const nome = novaQual.trim();
    if (!nome) return;
    try {
      const r = await criarQualificacaoCatalogo(nome);
      const novaCat: QualificacaoCatalogo = { id: r.id, nome, categoria: null, ativo: 1 };
      setCatalogo((prev) => [...prev, novaCat]);
      setQualSelecionadas((prev) => [...prev, r.id]);
      setNovaQual('');
      showToast('Qualificação criada e selecionada!', 'success');
    } catch { showToast('Essa qualificação já existe ou houve um erro.', 'error'); }
  };

  // Fechamento Mensal de Quotas
  const handleFechamentoMensal = async () => {
    if (!confirm(`Confirmar processamento do fechamento mensal para "${candidato.nome}"? Isso registrará o pagamento da cota mensal vigente.`)) return;
    setProcessandoFechamento(true);
    try {
      const res = await processarFechamentoMensal(candidato.id);
      showToast(`Fechamento processado com sucesso! (${res.novasCotasPagas}/${res.totalCotas || 'única'} cotas pagas)${res.quitado ? ' - Quitado!' : ''}`, 'success');
      setDesc((p) => ({ ...p, quota_cotas_pagas: res.novasCotasPagas }));
      await carregarCotas();
      if (aba === 'auditoria') carregarAuditoria();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao processar fechamento mensal.', 'error');
    } finally {
      setProcessandoFechamento(false);
    }
  };

  // Rejeição de documentos
  const handleRejeitar = async (docId: number) => {
    if (!motivoRejeicao.trim()) { showToast('Informe o motivo da rejeição.', 'warning'); return; }
    try {
      await rejeitarDocumento(docId, motivoRejeicao);
      showToast('Documento rejeitado. Cooperado notificado.', 'success');
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, rejeitado: 1, motivo_rejeicao: motivoRejeicao, validado: 0 } : d));
      setRejeitandoDoc(null);
      setMotivoRejeicao('');
    } catch { showToast('Erro ao rejeitar documento.', 'error'); }
  };

  // Cotas Mensais
  const handleAdicionarCota = async () => {
    if (!novaCota.descricao || !novaCota.valor) { showToast('Preencha descrição e valor.', 'warning'); return; }
    setAdicionandoCota(true);
    try {
      await criarCotaMensal(candidato.id, {
        descricao: novaCota.descricao,
        tipo: novaCota.tipo as CotaMensal['tipo'],
        valor: parseFloat(novaCota.valor),
        total_parcelas: novaCota.totalParcelas ? parseInt(novaCota.totalParcelas) : undefined,
        recorrente: novaCota.recorrente ? 1 : 0,
        observacao: novaCota.observacao || undefined,
      } as Partial<CotaMensal>);
      showToast('Cota cadastrada!', 'success');
      setNovaCota({ descricao: '', tipo: 'outro', valor: '', totalParcelas: '', recorrente: false, observacao: '' });
      setShowFormCota(false);
      await carregarCotas();
    } catch { showToast('Erro ao cadastrar cota.', 'error'); }
    finally { setAdicionandoCota(false); }
  };

  const handleRemoverCota = async (cotaId: number) => {
    if (!confirm('Remover esta cota?')) return;
    try {
      await removerCotaMensal(cotaId);
      setCotas((prev) => prev.filter((c) => c.id !== cotaId));
      showToast('Cota removida.', 'success');
    } catch { showToast('Erro ao remover cota.', 'error'); }
  };

  const handleToggleAtivaCota = async (cota: CotaMensal) => {
    try {
      await atualizarCotaMensal(cota.id, { ...cota, ativa: cota.ativa ? 0 : 1 });
      setCotas((prev) => prev.map((c) => c.id === cota.id ? { ...c, ativa: c.ativa ? 0 : 1 } : c));
    } catch { showToast('Erro ao atualizar cota.', 'error'); }
  };

  // Upload de documento
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem('atesa_token') ?? '';
    setEnviandoDoc(true);
    try {
      await enviarDocumento(candidato.id, tipoUpload, file, token);
      showToast('Documento enviado!', 'success');
      const updated = await listarDocumentos(candidato.id);
      setDocs(updated);
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Erro ao enviar.', 'error');
    } finally {
      setEnviandoDoc(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleValidar = async (docId: number) => {
    try {
      await validarDocumento(docId);
      showToast('Documento validado!', 'success');
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, validado: 1 } : d));
    } catch { showToast('Erro ao validar.', 'error'); }
  };

  const handleRemoverDoc = async (docId: number) => {
    if (!confirm('Remover este documento?')) return;
    try {
      await removerDocumento(docId);
      showToast('Documento removido.', 'success');
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch { showToast('Erro ao remover.', 'error'); }
  };

  // ── Cabeçalho do candidato ──────────────────────────────────────────────────

  const statusLabel = candidato.status === 1 ? 'Aprovado'
    : candidato.status === 2 ? 'Inativo'
      : candidato.status === 3 ? 'Reprovado'
        : candidato.status === 4 ? 'Desligado'
          : 'Pré-cadastro';
  const statusBg = candidato.status === 1 ? '#e8f5e9'
    : candidato.status === 2 ? '#f5f5f5'
      : candidato.status === 3 ? '#ffebee'
        : candidato.status === 4 ? '#ffebee'
          : '#fff8e1';
  const statusCor = candidato.status === 1 ? '#2e7d32'
    : candidato.status === 2 ? '#616161'
      : candidato.status === 3 ? '#c62828'
        : candidato.status === 4 ? '#b71c1c'
          : '#e65100';

  const tipoLabel = (candidato.tipo_contratacao || tipoContratacao) === 'interno' ? 'Interno' : 'Externo';
  const tipoBg = (candidato.tipo_contratacao || tipoContratacao) === 'interno' ? '#ede7f6' : '#e0f2f1';
  const tipoCor = (candidato.tipo_contratacao || tipoContratacao) === 'interno' ? '#512da8' : '#00695c';

  if (carregando) return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 48,
      textAlign: 'center', color: '#888', fontSize: 14,
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    }}>
      Carregando dados do candidato…
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden', colorScheme: 'light' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderBottom: '3px solid #4a9e4f',
        padding: '18px 20px 16px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {/* Avatar */}
        <div style={{
          width: 58, height: 58, borderRadius: '50%', flexShrink: 0,
          background: '#4a9e4f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, color: '#fff',
          boxShadow: '0 2px 8px rgba(74,158,79,0.25)',
        }}>
          {candidato.nome.charAt(0).toUpperCase()}
        </div>

        {/* Infos — ocupa todo o espaço disponível */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.2 }}>
              {candidato.nome}
            </h2>
            <span style={{
              display: 'inline-block', padding: '3px 11px', borderRadius: 20,
              fontSize: 12, fontWeight: 700,
              background: statusBg, color: statusCor,
              border: `1px solid ${statusCor}33`,
            }}>{statusLabel}</span>
            <span style={{
              display: 'inline-block', padding: '3px 11px', borderRadius: 20,
              fontSize: 12, fontWeight: 700,
              background: tipoBg, color: tipoCor,
              border: `1px solid ${tipoCor}33`,
            }}>{tipoLabel}</span>
            {candidato.nota_avaliacao !== null && candidato.nota_avaliacao !== undefined && (
              <span style={{
                display: 'inline-block', padding: '3px 11px', borderRadius: 20,
                fontSize: 12, fontWeight: 700,
                background: '#ede7f6', color: '#4527a0',
                border: '1px solid #d1c4e9',
              }}>
                Nota: {Number(candidato.nota_avaliacao).toFixed(1)}
              </span>
            )}
            {candidato.matricula && (
              <span style={{ fontSize: 12, color: '#4a9e4f', fontWeight: 700, fontFamily: 'monospace' }}>
                #{candidato.matricula}
              </span>
            )}
            {(candidato.matricula_anterior || historicoDesligamentos.some((h) => h.data_recontratacao)) && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '3px 10px',
                  borderRadius: 20,
                  fontSize: 11,
                  fontWeight: 700,
                  background: '#fff3e0',
                  color: '#e65100',
                  border: '1px solid #ffe0b2',
                }}
                title={`Cooperado recontratado após desligamento. Matrícula anterior: #${candidato.matricula_anterior || (historicoDesligamentos.find((h) => h.matricula)?.matricula || '—')}`}
              >
                🏷️ Recontratado {candidato.matricula_anterior ? `· Matrícula anterior: #${candidato.matricula_anterior}` : (historicoDesligamentos.find((h) => h.matricula)?.matricula ? `· Matrícula anterior: #${historicoDesligamentos.find((h) => h.matricula)?.matricula}` : '')}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>CPF</span>
              <span style={{ fontWeight: 600, color: '#222' }}>{candidato.cpf}</span>
            </span>
            <span style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cooperativa</span>
              <span style={{ fontWeight: 600, color: '#222' }}>{candidato.cooperativa}</span>
            </span>
            {candidato.email && (
              <span style={{ fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconMail size={12} />{candidato.email}
              </span>
            )}
            {candidato.telefone && (
              <span style={{ fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconPhone size={12} />{candidato.telefone}
              </span>
            )}
          </div>
        </div>

        {/* Coluna direita: Fechar, WhatsApp e Inativar/Reativar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0, alignSelf: 'stretch', justifyContent: 'space-between' }}>
          {/* Fechar */}
          <button
            onClick={onVoltar}
            title="Fechar ficha"
            style={{
              background: '#f0f0f0', border: '1.5px solid #d0d0d0',
              borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
              color: '#444', fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, lineHeight: 1, flexShrink: 0,
            }}
          >×</button>

          {/* Botões de Ação */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {candidato.status === 0 && (
              <>
                <button
                  onClick={() => abrirModalAvaliacao('8.0')}
                  title="Aprovar com avaliação"
                  style={{
                    background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '7px 12px',
                    cursor: 'pointer', color: '#2e7d32', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <IconCheck size={13} /> Aprovar
                </button>
                <button
                  onClick={() => abrirModalAvaliacao('5.0')}
                  title="Reprovar com avaliação"
                  style={{
                    background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '7px 12px',
                    cursor: 'pointer', color: '#c62828', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <IconX size={13} /> Reprovar
                </button>
              </>
            )}
            {candidato.status === 3 && (
              <button
                onClick={() => abrirModalAvaliacao('')}
                title="Reavaliar / Registrar nova prova"
                style={{
                  background: '#ede7f6', border: '1px solid #d1c4e9', borderRadius: 8, padding: '7px 12px',
                  cursor: 'pointer', color: '#512da8', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <IconEdit size={13} /> Reavaliar / Nova Prova
              </button>
            )}
            {candidato.status === 1 && temPermissao('ra.candidatos_inativar') && (
              <>
                <button
                  onClick={() => setModalInativar(true)}
                  title="Inativar cooperado temporariamente"
                  style={{
                    background: '#f5f5f5', border: '1px solid #ccc', borderRadius: 8, padding: '7px 12px',
                    cursor: 'pointer', color: '#555', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <IconX size={13} /> Inativar
                </button>
                <button
                  onClick={() => setModalDesligar(true)}
                  title="Desligamento formal do cooperado (cancela benefícios)"
                  style={{
                    background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '7px 12px',
                    cursor: 'pointer', color: '#c62828', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <IconAlert size={13} /> Desligar
                </button>
              </>
            )}
            {candidato.status === 2 && temPermissao('ra.candidatos_inativar') && (
              <>
                <button
                  onClick={handleReativar}
                  title="Reativar cooperado"
                  style={{
                    background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '7px 12px',
                    cursor: 'pointer', color: '#2e7d32', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <IconCheck size={13} /> Reativar
                </button>
                <button
                  onClick={() => setModalDesligar(true)}
                  title="Desligar cooperado inativo (cancela benefícios)"
                  style={{
                    background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '7px 12px',
                    cursor: 'pointer', color: '#c62828', fontSize: 12, fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <IconAlert size={13} /> Desligar
                </button>
              </>
            )}
            {candidato.status === 4 && temPermissao('ra.candidatos_inativar') && (
              <button
                onClick={handleReativar}
                title="Recontratar / Reativar cooperado desligado"
                style={{
                  background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '7px 12px',
                  cursor: 'pointer', color: '#2e7d32', fontSize: 12, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}
              >
                <IconCheck size={13} /> Reativar Cooperado
              </button>
            )}

            {/* Homologação 100% */}
            {propostaAdesao?.status_adesao !== 'homologado_100' && (
              <button
                onClick={handleHomologarAdesao100}
                disabled={homologando100}
                title="Homologar 100% a proposta de adesão e gerar matrícula definitiva"
                style={{
                  background: '#1b5e20', border: 'none', borderRadius: 8, padding: '8px 14px',
                  cursor: homologando100 ? 'default' : 'pointer',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 2px 6px rgba(27,94,32,0.3)',
                  flexShrink: 0,
                }}
              >
                <IconCheck size={14} /> {homologando100 ? 'Homologando...' : 'Homologar 100% Adesão'}
              </button>
            )}

            {/* WhatsApp */}
            {temPermissao('beneficios.whatsapp') && (
              <button
                onClick={handleWhatsApp}
                disabled={enviandoWpp}
                title="Enviar link de cadastro via WhatsApp"
                style={{
                  background: enviandoWpp ? '#ccc' : '#25D366',
                  border: 'none', borderRadius: 8, padding: '8px 14px',
                  cursor: enviandoWpp ? 'default' : 'pointer',
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  display: 'flex', alignItems: 'center', gap: 6,
                  boxShadow: '0 2px 6px rgba(37,211,102,0.28)',
                  flexShrink: 0,
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" /><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.121 1.528 5.853L.057 23.432a.5.5 0 0 0 .611.611l5.579-1.471A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.895 0-3.668-.525-5.176-1.437l-.37-.221-3.843 1.013 1.013-3.843-.22-.37A9.963 9.963 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" /></svg>
                {enviandoWpp ? 'Enviando…' : 'WhatsApp'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Abas ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e8edf4', background: '#f5f8fc', overflowX: 'auto' }}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            style={{
              padding: '11px 18px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: aba === a.id ? 700 : 400,
              color: aba === a.id ? '#4a9e4f' : '#666',
              background: aba === a.id ? '#fff' : 'transparent',
              borderBottom: aba === a.id ? '3px solid #4a9e4f' : '3px solid transparent',
              whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}
          >{a.label}</button>
        ))}
      </div>

      {/* ── Conteúdo das abas ────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 28px 32px' }}>

        {/* ── ABA: Dados Pessoais ──────────────────────────────────────────── */}
        {aba === 'pessoal' && (
          <>
            <div style={card}>
              <p style={sTitle}>Informações Pessoais</p>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="Tipo de Contratação">
                  <select style={select} value={tipoContratacao} onChange={(e) => setTipoContratacao(e.target.value as TipoContratacao)}>
                    <option value="externo">Externo</option>
                    <option value="interno">Interno</option>
                  </select>
                </Campo>
                <Campo label="Data de Nascimento">
                  <input style={input} type="date" value={ds.data_nascimento ?? ''} onChange={(e) => updDs('data_nascimento', e.target.value)} />
                </Campo>
                <Campo label="Estado Civil">
                  <select style={select} value={ds.estado_civil ?? ''} onChange={(e) => updDs('estado_civil', e.target.value)}>
                    <option value="">—</option>
                    <option value="solteiro">Solteiro(a)</option>
                    <option value="casado">Casado(a)</option>
                    <option value="divorciado">Divorciado(a)</option>
                    <option value="viuvo">Viúvo(a)</option>
                    <option value="uniao_estavel">União Estável</option>
                  </select>
                </Campo>
              </div>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="Naturalidade">
                  <input style={input} value={ds.naturalidade ?? ''} onChange={(e) => updDs('naturalidade', e.target.value)} />
                </Campo>
                <Campo label="Nome da Mãe">
                  <input style={input} value={ds.nome_mae ?? ''} onChange={(e) => updDs('nome_mae', e.target.value)} />
                </Campo>
                <Campo label="Nome do Pai">
                  <input style={input} value={ds.nome_pai ?? ''} onChange={(e) => updDs('nome_pai', e.target.value)} />
                </Campo>
              </div>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="RG">
                  <input style={input} value={ds.rg ?? ''} onChange={(e) => updDs('rg', e.target.value)} />
                </Campo>
                <Campo label="Órgão Emissor">
                  <input style={input} value={ds.orgao_emissor ?? ''} onChange={(e) => updDs('orgao_emissor', e.target.value)} placeholder="SSP/SP" />
                </Campo>
                <Campo label="UF do RG">
                  <input style={input} maxLength={2} value={ds.uf_rg ?? ''} onChange={(e) => updDs('uf_rg', e.target.value.toUpperCase())} />
                </Campo>
              </div>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="PIS / NIS / PASEP">
                  <input style={input} value={ds.pis_pasep ?? ''} onChange={(e) => updDs('pis_pasep', e.target.value)} />
                </Campo>
                <Campo label="Título de Eleitor">
                  <input style={input} value={ds.titulo_eleitor ?? ''} onChange={(e) => updDs('titulo_eleitor', e.target.value)} />
                </Campo>
                <Campo label="CNH — Categoria">
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input style={{ ...input, flex: 2 }} placeholder="Número" value={ds.cnh ?? ''} onChange={(e) => updDs('cnh', e.target.value)} />
                    <input style={{ ...input, flex: 1 }} placeholder="Cat." maxLength={3} value={ds.categoria_cnh ?? ''} onChange={(e) => updDs('categoria_cnh', e.target.value.toUpperCase())} />
                  </div>
                </Campo>
              </div>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="CBO (Classificação Brasileira de Ocupações)">
                  <input style={input} placeholder="Ex: 3222-05" value={ds.cbo ?? ''} onChange={(e) => updDs('cbo', e.target.value)} />
                </Campo>
              </div>
              <div style={field}>
                <span style={label}>Qualificações / Aptidões</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {catalogo.map((q) => {
                    const sel = qualSelecionadas.includes(q.id);
                    return (
                      <button
                        key={q.id}
                        type="button"
                        onClick={() => toggleQual(q.id)}
                        style={{
                          padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                          border: sel ? '1.5px solid #4a9e4f' : '1.5px solid #ccc',
                          background: sel ? '#4a9e4f' : '#f5f5f5',
                          color: sel ? '#fff' : '#555', fontWeight: sel ? 700 : 400,
                          transition: 'all 0.15s',
                        }}
                      >{q.nome}</button>
                    );
                  })}
                </div>
                {/* Criar nova qualificação inline */}
                <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                  <input
                    style={{ ...input, flex: 1 }}
                    placeholder="Nova qualificação…"
                    value={novaQual}
                    onChange={(e) => setNovaQual(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNovaQual(); } }}
                  />
                  <IonButton size="small" color="medium" onClick={handleNovaQual}>+ Criar</IonButton>
                </div>
              </div>
            </div>

            {/* Pessoa a ser avisada em caso de emergência */}
            <div style={card}>
              <p style={sTitle}>Pessoa a ser avisada em caso de emergência</p>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="Contato Principal — Nome">
                  <input style={input} value={emergencia.nome_1 ?? ''} onChange={(e) => setEmergencia((p) => ({ ...p, nome_1: e.target.value }))} placeholder="Nome completo" />
                </Campo>
                <Campo label="Grau de Parentesco">
                  <input style={input} value={emergencia.parentesco_1 ?? ''} onChange={(e) => setEmergencia((p) => ({ ...p, parentesco_1: e.target.value }))} placeholder="Ex: Cônjuge, Mãe" />
                </Campo>
                <Campo label="Telefone com DDD">
                  <input style={input} value={emergencia.telefone_1 ?? ''} onChange={(e) => setEmergencia((p) => ({ ...p, telefone_1: e.target.value }))} placeholder="(00) 00000-0000" />
                </Campo>
              </div>
              <div style={grid3}>
                <Campo label="Contato Secundário — Nome (Opcional)">
                  <input style={input} value={emergencia.nome_2 ?? ''} onChange={(e) => setEmergencia((p) => ({ ...p, nome_2: e.target.value }))} placeholder="Nome completo" />
                </Campo>
                <Campo label="Grau de Parentesco">
                  <input style={input} value={emergencia.parentesco_2 ?? ''} onChange={(e) => setEmergencia((p) => ({ ...p, parentesco_2: e.target.value }))} placeholder="Ex: Pai, Irmão" />
                </Campo>
                <Campo label="Telefone com DDD">
                  <input style={input} value={emergencia.telefone_2 ?? ''} onChange={(e) => setEmergencia((p) => ({ ...p, telefone_2: e.target.value }))} placeholder="(00) 00000-0000" />
                </Campo>
              </div>
            </div>
          </>
        )}

        {/* ── ABA: Endereço ──────────────────────────────────────────────────── */}
        {aba === 'endereco' && (
          <>
            <div style={card}>
              <p style={sTitle}>Endereço Residencial</p>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label={buscandoCep ? 'CEP (buscando…)' : 'CEP'}>
                  <input
                    style={input}
                    value={ds.cep ?? ''}
                    onChange={(e) => handleCep(e.target.value)}
                    placeholder="00000-000"
                  />
                </Campo>
                <Campo label="Logradouro">
                  <input style={input} value={ds.logradouro ?? ''} onChange={(e) => updDs('logradouro', e.target.value)} />
                </Campo>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <Campo label="Número">
                    <input style={input} value={ds.numero ?? ''} onChange={(e) => updDs('numero', e.target.value)} />
                  </Campo>
                  <Campo label="Complemento">
                    <input style={input} value={ds.complemento ?? ''} onChange={(e) => updDs('complemento', e.target.value)} />
                  </Campo>
                </div>
              </div>
              <div style={grid3}>
                <Campo label="Bairro">
                  <input style={input} value={ds.bairro ?? ''} onChange={(e) => updDs('bairro', e.target.value)} />
                </Campo>
                <Campo label="Cidade">
                  <input style={input} value={ds.cidade ?? ''} onChange={(e) => updDs('cidade', e.target.value)} />
                </Campo>
                <Campo label="UF">
                  <input style={input} maxLength={2} value={ds.uf ?? ''} onChange={(e) => updDs('uf', e.target.value.toUpperCase())} />
                </Campo>
              </div>
            </div>
          </>
        )}

        {/* ── ABA: Dados Bancários ───────────────────────────────────────────── */}
        {aba === 'bancario' && (
          <>
            <div style={card}>
              <p style={sTitle}>Conta Bancária</p>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="Banco">
                  <input
                    style={input}
                    list="lista-bancos-brasil"
                    value={db.banco ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const encontrado = LISTA_BANCOS_BRASIL.find(
                        (b) => `${b.codigo} - ${b.nome}`.toLowerCase() === val.toLowerCase() ||
                          b.nome.toLowerCase() === val.toLowerCase() ||
                          b.codigo === val
                      );
                      if (encontrado) {
                        setDb((prev) => ({ ...prev, banco: encontrado.nome, codigo_banco: encontrado.codigo }));
                      } else {
                        updDb('banco', val);
                      }
                    }}
                    placeholder="Digite ou selecione o banco..."
                  />
                  <datalist id="lista-bancos-brasil">
                    {LISTA_BANCOS_BRASIL.map((b) => (
                      <option key={b.codigo} value={`${b.codigo} - ${b.nome}`} />
                    ))}
                  </datalist>
                </Campo>
                <Campo label="Código do Banco">
                  <input style={input} value={db.codigo_banco ?? ''} onChange={(e) => updDb('codigo_banco', e.target.value)} placeholder="Ex: 237" />
                </Campo>
                <Campo label="Tipo de Conta">
                  <select style={select} value={db.tipo_conta ?? 'corrente'} onChange={(e) => updDb('tipo_conta', e.target.value)}>
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                  </select>
                </Campo>
              </div>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="Agência">
                  <input style={input} value={db.agencia ?? ''} onChange={(e) => updDb('agencia', e.target.value)} />
                </Campo>
                <Campo label="Conta">
                  <input style={input} value={db.conta ?? ''} onChange={(e) => updDb('conta', e.target.value)} />
                </Campo>
                <Campo label="Dígito">
                  <input style={input} maxLength={3} value={db.digito ?? ''} onChange={(e) => updDb('digito', e.target.value)} />
                </Campo>
              </div>
            </div>

            <div style={card}>
              <p style={sTitle}>PIX</p>
              <div style={grid2}>
                <Campo label="Tipo da Chave PIX">
                  <select style={select} value={db.tipo_pix ?? ''} onChange={(e) => updDb('tipo_pix', e.target.value)}>
                    <option value="">— Selecione —</option>
                    <option value="cpf">CPF</option>
                    <option value="email">E-mail</option>
                    <option value="telefone">Telefone</option>
                    <option value="aleatoria">Chave Aleatória</option>
                  </select>
                </Campo>
                <Campo label="Chave PIX">
                  <input style={input} value={db.chave_pix ?? ''} onChange={(e) => updDb('chave_pix', e.target.value)} />
                </Campo>
              </div>
            </div>
          </>
        )}

        {/* ── ABA: Documentos ───────────────────────────────────────────────── */}
        {aba === 'documentos' && (
          <>
            {/* Upload */}
            <div style={card}>
              <p style={sTitle}>Enviar Documento</p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <Campo label="Tipo do documento">
                    <select style={select} value={tipoUpload} onChange={(e) => setTipoUpload(e.target.value as TipoDocumento)}>
                      {(Object.entries(ROTULO_TIPO_DOC) as [TipoDocumento, string][]).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </Campo>
                </div>
                <div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    style={{ display: 'none' }}
                    onChange={handleUpload}
                  />
                  <IonButton size="small" color="primary" disabled={enviandoDoc} onClick={() => fileRef.current?.click()}>
                    {enviandoDoc ? 'Enviando…' : '+ Enviar Arquivo'}
                  </IonButton>
                </div>
              </div>
              <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>Formatos aceitos: JPG, PNG, WEBP, PDF — máx. 10 MB</p>
            </div>

            {/* Lista de documentos */}
            <div style={card}>
              <p style={sTitle}>Documentos Enviados ({docs.length})</p>
              {docs.length === 0 && <p style={{ fontSize: 13, color: '#aaa' }}>Nenhum documento enviado ainda.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {docs.map((doc) => (
                  <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }}>
                    <span style={{ color: doc.mime_type.startsWith('image') ? '#6a1b9a' : '#1565c0', flexShrink: 0 }}>
                      {doc.mime_type.startsWith('image') ? <IconImage size={22} /> : <IconFile size={22} />}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo}</div>
                      <div style={{ fontSize: 11, color: '#888' }}>
                        {doc.nome_original} · {(doc.tamanho_bytes / 1024).toFixed(0)} KB
                      </div>
                      <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                        Enviado por {doc.enviado_por_nome ?? '—'} em {formatarDataBR(doc.enviado_em)}
                      </div>
                      {doc.rejeitado ? (
                        <div style={{ fontSize: 11, color: '#c62828', marginTop: 3, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                          <span>⚠</span>
                          <span>Rejeitado por {doc.rejeitado_por_nome ?? '—'}: {doc.motivo_rejeicao ?? ''}</span>
                        </div>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {doc.validado
                        ? <span style={badge('#e8f5e9', '#2e7d32')}>✓ Validado</span>
                        : <span style={badge('#fff8e1', '#e65100')}>Pendente</span>
                      }
                      <a
                        href={urlDownloadDocumento(doc.id)}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontSize: 12, color: '#4a9e4f' }}
                      >
                        Ver
                      </a>
                      {temPermissao('beneficios.documentos') && !doc.validado && !doc.rejeitado && (
                        <>
                          <button
                            onClick={() => handleValidar(doc.id)}
                            style={{ fontSize: 12, color: '#2e7d32', background: 'none', border: 'none', cursor: 'pointer' }}
                          >✓ Validar</button>
                          <button
                            onClick={() => { setRejeitandoDoc(doc.id); setMotivoRejeicao(''); }}
                            style={{ fontSize: 12, color: '#e65100', background: 'none', border: 'none', cursor: 'pointer' }}
                          >✕ Rejeitar</button>
                        </>
                      )}
                      {doc.rejeitado ? (
                        <span style={badge('#fce4ec', '#c62828')}>✕ Rejeitado</span>
                      ) : null}
                      {temPermissao('beneficios.documentos') && (
                        <button
                          onClick={() => handleRemoverDoc(doc.id)}
                          title="Remover documento"
                          style={{ color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                        ><IconTrash size={14} /></button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── ABA: Descontos ────────────────────────────────────────────────── */}
        {aba === 'descontos' && (
          <>
            <div style={card}>
              <p style={sTitle}>Descontos Obrigatórios do Contrato</p>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
                Estes valores são aplicados automaticamente no cálculo do contrato do cooperado.
              </p>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="INSS (%)">
                  <input style={input} type="number" step="0.01" min="0" max="100"
                    value={desc.inss_percentual ?? 0}
                    onChange={(e) => updDesc('inss_percentual', parseFloat(e.target.value) || 0)} />
                </Campo>
                <Campo label="Seguro de Vida (%)">
                  <input style={input} type="number" step="0.01" min="0" max="100"
                    value={desc.seguro_vida_percentual ?? 0}
                    onChange={(e) => updDesc('seguro_vida_percentual', parseFloat(e.target.value) || 0)} />
                </Campo>
                <Campo label="Rateio (%)">
                  <input style={input} type="number" step="0.01" min="0" max="100"
                    value={desc.rateio_percentual ?? 0}
                    onChange={(e) => updDesc('rateio_percentual', parseFloat(e.target.value) || 0)} />
                </Campo>
              </div>
            </div>

            <div style={card}>
              <p style={sTitle}>Quota Parte</p>
              <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                Pagas enquanto o contrato estiver vigente. Se parcelada, o cooperado continua pagando após desligamento até quitar.
              </p>
              <div style={{ ...grid3, marginBottom: 12 }}>
                <Campo label="Valor da Quota Parte (R$)">
                  <input style={input} type="number" step="0.01" min="0"
                    value={desc.quota_parte_valor ?? 0}
                    onChange={(e) => updDesc('quota_parte_valor', parseFloat(e.target.value) || 0)} />
                </Campo>
                <Campo label="Parcelada?">
                  <select style={select}
                    value={desc.quota_parcelada ? '1' : '0'}
                    onChange={(e) => updDesc('quota_parcelada', e.target.value === '1')}>
                    <option value="0">Não (única vez)</option>
                    <option value="1">Sim (parcelada)</option>
                  </select>
                </Campo>
                {desc.quota_parcelada && (
                  <>
                    <Campo label="Total de Cotas">
                      <input style={input} type="number" min="1"
                        value={desc.quota_total_cotas ?? ''}
                        onChange={(e) => updDesc('quota_total_cotas', parseInt(e.target.value) || null)} />
                    </Campo>
                    <Campo label="Cotas Pagas">
                      <input style={input} type="number" min="0"
                        value={desc.quota_cotas_pagas ?? 0}
                        onChange={(e) => updDesc('quota_cotas_pagas', parseInt(e.target.value) || 0)} />
                    </Campo>
                  </>
                )}
              </div>
            </div>

            <div style={card}>
              <p style={sTitle}>Outros Descontos</p>
              <div style={grid2}>
                <Campo label="Descrição">
                  <input style={input} value={desc.outras_descricao ?? ''}
                    onChange={(e) => updDesc('outras_descricao', e.target.value)}
                    placeholder="Ex: Uniforme, crachá…" />
                </Campo>
                <Campo label="Valor (R$)">
                  <input style={input} type="number" step="0.01" min="0"
                    value={desc.outras_valor ?? 0}
                    onChange={(e) => updDesc('outras_valor', parseFloat(e.target.value) || 0)} />
                </Campo>
              </div>
            </div>

            {/* Resumo dos descontos */}
            <div style={{ ...card, background: '#f5f8fb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ ...sTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Resumo de Descontos & Quota Parte</p>
                <button
                  type="button"
                  onClick={handleFechamentoMensal}
                  disabled={processandoFechamento}
                  style={{
                    background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 6,
                    padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <IconCheck size={14} />
                  {processandoFechamento ? 'Processando…' : 'Processar Fechamento Mensal (+1 Cota)'}
                </button>
              </div>
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>INSS</span><span>{desc.inss_percentual ?? 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Seguro de Vida</span><span>{desc.seguro_vida_percentual ?? 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Rateio</span><span>{desc.rateio_percentual ?? 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Quota Parte</span>
                  <span>{formatarMoeda(Number(desc.quota_parte_valor ?? 0))}
                    {desc.quota_parcelada ? ` (${desc.quota_cotas_pagas ?? 0}/${desc.quota_total_cotas ?? '?'} pagas)` : ''}
                  </span>
                </div>
                {(desc.outras_valor ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{desc.outras_descricao || 'Outros'}</span>
                    <span>{formatarMoeda(Number(desc.outras_valor ?? 0))}</span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ── ABA: Auditoria e Históricos ──────────────────────────────────── */}
        {aba === 'auditoria' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Rastreamento de IP, Dispositivo & Termos da Adesão Web */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ ...sTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0, color: '#1b5e20', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconLock size={15} /> Rastreamento de IP, Dispositivo & Proposta de Adesão Web
                </p>
              </div>

              <div style={{ ...grid3, marginBottom: 14 }}>
                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>IP Registrado do Cooperado</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#1e293b', marginTop: 4, fontFamily: 'monospace' }}>
                    {propostaAdesao?.ip_registro || (docs.find((d) => d.ip_envio)?.ip_envio || 'Nenhum IP registrado')}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Capturado no Portal Web e App Mobile</div>
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Palestra Institucional ATESA</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: propostaAdesao?.video_assistido_em ? '#2e7d32' : '#d97706', marginTop: 4 }}>
                    {propostaAdesao?.video_assistido_em ? `✓ Assistido em ${formatarDataBR(propostaAdesao.video_assistido_em)}` : 'Pendente de visualização'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Duração: 5:48 min (Avanço bloqueado)</div>
                </div>

                <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>Declaração de Livre Adesão (Pág 1)</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: (propostaAdesao?.declaracao_enviada_em || docs.some((d) => d.tipo === 'declaracao_adesao')) ? '#2e7d32' : '#d97706', marginTop: 4 }}>
                    {(propostaAdesao?.declaracao_enviada_em || docs.some((d) => d.tipo === 'declaracao_adesao')) ? '✓ Enviada e Assinada de próprio punho' : 'Pendente de envio'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>Manuscrita e fotografada</div>
                </div>
              </div>

              {propostaAdesao?.user_agent && (
                <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569', marginBottom: 12 }}>
                  <strong>Dispositivo / User-Agent:</strong> {propostaAdesao.user_agent}
                </div>
              )}

              {propostaAdesao?.homologado_em && (
                <div style={{ background: '#e8f5e9', padding: '12px 16px', borderRadius: 8, border: '1px solid #a5d6a7', color: '#1b5e20', fontSize: 13, fontWeight: 700 }}>
                  🎉 Adesão 100% Homologada por {propostaAdesao.homologado_por_nome || 'Administrador'} em {formatarDataBR(propostaAdesao.homologado_em)}. Matrícula ativa: #{candidato.matricula}. Portal bloqueado para edições do cooperado.
                </div>
              )}
            </div>

            {/* 1. Histórico de Desligamentos & Recontratações */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ ...sTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0, color: '#c62828', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconAlert size={15} /> Histórico de Desligamentos & Recontratações ({historicoDesligamentos.length})
                </p>
                <button onClick={carregarHistoricos} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4a9e4f', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <IconRefresh size={13} /> Atualizar
                </button>
              </div>

              {carregandoHistoricos && <p style={{ fontSize: 13, color: '#aaa' }}>Carregando histórico…</p>}
              {!carregandoHistoricos && historicoDesligamentos.length === 0 && (
                <p style={{ fontSize: 13, color: '#777', margin: '6px 0', background: '#f9f9f9', padding: '12px 14px', borderRadius: 8, border: '1px dashed #ddd' }}>
                  ✓ Nenhum desligamento registrado para este cooperado. O cooperado mantém vínculo contínuo.
                </p>
              )}

              {historicoDesligamentos.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {historicoDesligamentos.map((h) => (
                    <div
                      key={h.id}
                      style={{
                        padding: '14px 16px',
                        borderRadius: 8,
                        background: h.data_recontratacao ? '#f9fbe7' : '#fff5f5',
                        border: `1.5px solid ${h.data_recontratacao ? '#dce775' : '#ffcdd2'}`,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
                            background: h.data_recontratacao ? '#e8f5e9' : '#ffebee',
                            color: h.data_recontratacao ? '#2e7d32' : '#c62828',
                            border: `1px solid ${h.data_recontratacao ? '#a5d6a7' : '#ef9a9a'}`,
                          }}>
                            {h.data_recontratacao ? '🔄 Recontratado' : '⚠️ Desligado'}
                          </span>
                          {h.matricula && (
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 13, color: '#444' }}>
                              Matrícula na época: #{h.matricula}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 11, color: '#888' }}>
                          Registrado em: {new Date(h.criado_em).toLocaleDateString('pt-BR')} {new Date(h.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Detalhes do Desligamento */}
                      <div style={{ fontSize: 13, color: '#333', marginBottom: h.data_recontratacao ? 10 : 0 }}>
                        <div>
                          <strong>Data do Desligamento:</strong> {formatarDataBR(h.data_desligamento || '')}
                          {h.desligado_por_nome && <span> · <strong>Desligado por:</strong> {h.desligado_por_nome}</span>}
                        </div>
                        {h.motivo_desligamento && (
                          <div style={{ marginTop: 4, color: '#666', background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid #eee' }}>
                            <strong>Motivo:</strong> {h.motivo_desligamento}
                          </div>
                        )}
                      </div>

                      {/* Detalhes da Recontratação (se houver) */}
                      {h.data_recontratacao && (
                        <div style={{
                          marginTop: 8, paddingTop: 8, borderTop: '1px dashed #c5e1a5',
                          fontSize: 13, color: '#1b5e20',
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <IconCheck size={14} /> Ciclo de Recontratação Concluído:
                          </div>
                          <div>
                            <strong>Data da Recontratação:</strong> {formatarDataBR(h.data_recontratacao || '')}
                            {h.recontratado_por_nome && <span> · <strong>Recontratado por:</strong> {h.recontratado_por_nome}</span>}
                          </div>
                          {h.matricula_sucessora && (
                            <div style={{ marginTop: 4, fontWeight: 700, color: '#2e7d32' }}>
                              Nova Matrícula Gerada: #{h.matricula_sucessora} (Histórico anterior preservado)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Histórico de Avaliações & Alterações de Notas */}
            <div style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <p style={{ ...sTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0, color: '#512da8', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconEdit size={15} /> Histórico de Avaliações & Alterações de Notas ({historicoNotas.length})
                </p>
                <button onClick={carregarHistoricos} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4a9e4f', background: 'none', border: 'none', cursor: 'pointer' }}>
                  <IconRefresh size={13} /> Atualizar
                </button>
              </div>

              {carregandoHistoricos && <p style={{ fontSize: 13, color: '#aaa' }}>Carregando histórico…</p>}
              {!carregandoHistoricos && historicoNotas.length === 0 && (
                <p style={{ fontSize: 13, color: '#777', margin: '6px 0', background: '#f9f9f9', padding: '12px 14px', borderRadius: 8, border: '1px dashed #ddd' }}>
                  Nenhuma avaliação registrada no histórico até o momento.
                </p>
              )}

              {historicoNotas.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {historicoNotas.map((hn) => {
                    const aprovado = Number(hn.nota_nova) >= 7.0;
                    return (
                      <div
                        key={hn.id}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 8,
                          background: aprovado ? '#f1f8e9' : '#fff8e1',
                          border: `1px solid ${aprovado ? '#c5e1a5' : '#ffe082'}`,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{
                              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700,
                              background: aprovado ? '#2e7d32' : '#c62828',
                              color: '#fff',
                            }}>
                              {aprovado ? 'Aprovado' : 'Reprovado'}
                            </span>
                            <span style={{ fontSize: 14, fontWeight: 800, color: aprovado ? '#2e7d32' : '#c62828' }}>
                              Nota: {Number(hn.nota_nova).toFixed(1)}
                            </span>
                            {hn.nota_anterior !== null && hn.nota_anterior !== undefined && (
                              <span style={{ fontSize: 12, color: '#888', textDecoration: 'line-through' }}>
                                (Anterior: {Number(hn.nota_anterior).toFixed(1)})
                              </span>
                            )}
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontSize: 11, color: '#555', fontWeight: 600 }}>{hn.usuario_nome || 'Sistema'}</span>
                            <span style={{ fontSize: 10, color: '#999', marginLeft: 8 }}>
                              {new Date(hn.criado_em).toLocaleDateString('pt-BR')} {new Date(hn.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>

                        {hn.observacao_nova && (
                          <div style={{ fontSize: 12, color: '#444', background: '#fff', padding: '6px 10px', borderRadius: 6, border: '1px solid #eee', marginTop: 4 }}>
                            <strong>Parecer / Observação:</strong> {hn.observacao_nova}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 3. Log Geral de Auditoria do Sistema com Filtros e Paginação */}
            {(() => {
              const OPCOES_FILTRO_AUDITORIA = [
                { id: 'todos', label: 'Todos', cor: '#1e293b', bg: '#f1f5f9' },
                { id: 'edicao', label: 'Edição', cor: '#d97706', bg: '#fef3c7' },
                { id: 'upload', label: 'Upload', cor: '#7c3aed', bg: '#ede9fe' },
                { id: 'exclusao', label: 'Exclusão', cor: '#dc2626', bg: '#fee2e2' },
                { id: 'rejeicao', label: 'Rejeição', cor: '#b91c1c', bg: '#ffe4e6' },
                { id: 'validacao', label: 'Validação', cor: '#15803d', bg: '#dcfce7' },
                { id: 'whatsapp', label: 'WhatsApp', cor: '#16a34a', bg: '#dcfce7' },
                { id: 'criacao', label: 'Criação', cor: '#2563eb', bg: '#dbeafe' },
                { id: 'desligamento', label: 'Desligamento', cor: '#991b1b', bg: '#fee2e2' },
                { id: 'recontratacao', label: 'Recontratação', cor: '#047857', bg: '#d1fae5' },
                { id: 'notificacao', label: 'Notificação', cor: '#ea580c', bg: '#ffedd5' },
              ];

              const contagemPorAcao: Record<string, number> = {
                todos: auditoria.length,
                edicao: 0,
                upload: 0,
                exclusao: 0,
                rejeicao: 0,
                validacao: 0,
                whatsapp: 0,
                criacao: 0,
                desligamento: 0,
                recontratacao: 0,
                notificacao: 0,
              };

              for (const reg of auditoria) {
                const a = (reg.acao || '').toLowerCase();
                if (contagemPorAcao[a] !== undefined) {
                  contagemPorAcao[a]++;
                } else {
                  contagemPorAcao[a] = 1;
                }
              }

              const auditoriaFiltrada = auditoria.filter((reg) => {
                if (filtroAcaoAuditoria !== 'todos') {
                  if ((reg.acao || '').toLowerCase() !== filtroAcaoAuditoria.toLowerCase()) {
                    return false;
                  }
                }
                if (buscaAuditoria.trim()) {
                  const termo = buscaAuditoria.trim().toLowerCase();
                  const texto = `
                    ${reg.acao || ''}
                    ${reg.observacao || ''}
                    ${reg.tabela || ''}
                    ${reg.campo || ''}
                    ${reg.usuario_nome || ''}
                    ${reg.valor_anterior || ''}
                    ${reg.valor_novo || ''}
                    ${new Date(reg.criado_em).toLocaleDateString('pt-BR')}
                  `.toLowerCase();
                  if (!texto.includes(termo)) return false;
                }
                return true;
              });

              const ITENS_POR_PAGINA_AUDITORIA = 10;
              const totalPaginasAuditoria = Math.max(1, Math.ceil(auditoriaFiltrada.length / ITENS_POR_PAGINA_AUDITORIA));
              const paginaAtualAuditoria = Math.min(paginaAuditoria, totalPaginasAuditoria);
              const indiceInicioAuditoria = (paginaAtualAuditoria - 1) * ITENS_POR_PAGINA_AUDITORIA;
              const auditoriaPaginada = auditoriaFiltrada.slice(indiceInicioAuditoria, indiceInicioAuditoria + ITENS_POR_PAGINA_AUDITORIA);

              const acaoIconComp: Record<string, React.ReactNode> = {
                criacao: <IconCheckCircle size={15} />,
                edicao: <IconEdit size={15} />,
                exclusao: <IconTrash size={15} />,
                validacao: <IconCheck size={15} />,
                rejeicao: <IconX size={15} />,
                upload: <IconUpload size={15} />,
                whatsapp: <IconPhone2 size={15} />,
                notificacao: <IconBell size={15} />,
                desligamento: <IconAlert size={15} />,
                recontratacao: <IconCheck size={15} />,
              };
              const acaoCor: Record<string, string> = {
                criacao: '#1565c0', edicao: '#e65100', exclusao: '#c62828',
                validacao: '#2e7d32', rejeicao: '#c62828', upload: '#6a1b9a',
                whatsapp: '#128c7e', notificacao: '#ea580c',
                desligamento: '#c62828', recontratacao: '#2e7d32',
              };
              const acaoBg: Record<string, string> = {
                criacao: '#e3f2fd', edicao: '#fff3e0', exclusao: '#ffebee',
                validacao: '#e8f5e9', rejeicao: '#ffebee', upload: '#f3e5f5',
                whatsapp: '#e8f5e9', notificacao: '#fff3e0',
                desligamento: '#ffebee', recontratacao: '#e8f5e9',
              };

              return (
                <div style={card}>
                  {/* Cabeçalho do Card */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
                    <div>
                      <p style={{ ...sTitle, marginBottom: 2, borderBottom: 'none', paddingBottom: 0 }}>
                        Log Geral de Auditoria ({auditoria.length})
                      </p>
                      <span style={{ fontSize: 12, color: '#666' }}>
                        Histórico cronológico de modificações, acessos, WhatsApp e validações
                      </span>
                    </div>
                    <button
                      onClick={carregarAuditoria}
                      disabled={carregandoAuditoria}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
                        color: '#2e7d32', background: '#e8f5e9', border: '1px solid #c8e6c9',
                        borderRadius: 6, padding: '6px 12px', cursor: carregandoAuditoria ? 'not-allowed' : 'pointer',
                      }}
                    >
                      <IconRefresh size={13} /> {carregandoAuditoria ? 'Atualizando…' : 'Atualizar Logs'}
                    </button>
                  </div>

                  {/* Barra de Filtros e Busca */}
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 14px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Campo de Busca Livre */}
                      <div style={{ flex: 1, minWidth: 220, position: 'relative', display: 'flex', alignItems: 'center' }}>
                        <span style={{ position: 'absolute', left: 10, color: '#94a3b8', display: 'flex' }}>
                          <IconSearch size={15} />
                        </span>
                        <input
                          type="text"
                          value={buscaAuditoria}
                          onChange={(e) => {
                            setBuscaAuditoria(e.target.value);
                            setPaginaAuditoria(1);
                          }}
                          placeholder="Buscar por observação, usuário, campo ou data..."
                          style={{
                            ...input,
                            paddingLeft: 32,
                            paddingRight: buscaAuditoria ? 30 : 10,
                            fontSize: 12,
                            height: 36,
                          }}
                        />
                        {buscaAuditoria && (
                          <button
                            onClick={() => {
                              setBuscaAuditoria('');
                              setPaginaAuditoria(1);
                            }}
                            style={{
                              position: 'absolute', right: 8, background: 'transparent', border: 'none',
                              color: '#94a3b8', cursor: 'pointer', fontSize: 14, fontWeight: 700,
                            }}
                          >
                            ✕
                          </button>
                        )}
                      </div>

                      {/* Dropdown de Ação */}
                      <div style={{ minWidth: 190 }}>
                        <select
                          value={filtroAcaoAuditoria}
                          onChange={(e) => {
                            setFiltroAcaoAuditoria(e.target.value);
                            setPaginaAuditoria(1);
                          }}
                          style={{ ...select, fontSize: 12, height: 36, fontWeight: 600 }}
                        >
                          <option value="todos">Todas as Ações ({auditoria.length})</option>
                          <option value="edicao">Edição ({contagemPorAcao.edicao || 0})</option>
                          <option value="upload">Upload ({contagemPorAcao.upload || 0})</option>
                          <option value="exclusao">Exclusão ({contagemPorAcao.exclusao || 0})</option>
                          <option value="rejeicao">Rejeição ({contagemPorAcao.rejeicao || 0})</option>
                          <option value="validacao">Validação ({contagemPorAcao.validacao || 0})</option>
                          <option value="whatsapp">WhatsApp ({contagemPorAcao.whatsapp || 0})</option>
                          <option value="criacao">Criação ({contagemPorAcao.criacao || 0})</option>
                          <option value="desligamento">Desligamento ({contagemPorAcao.desligamento || 0})</option>
                          <option value="recontratacao">Recontratação ({contagemPorAcao.recontratacao || 0})</option>
                          <option value="notificacao">Notificação ({contagemPorAcao.notificacao || 0})</option>
                        </select>
                      </div>
                    </div>

                    {/* Chips de Ações Rápidas */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', flexShrink: 0, marginRight: 2 }}>
                        Filtro:
                      </span>
                      {OPCOES_FILTRO_AUDITORIA.map((op) => {
                        const count = contagemPorAcao[op.id] ?? 0;
                        const isAtivo = filtroAcaoAuditoria === op.id;
                        return (
                          <button
                            key={op.id}
                            onClick={() => {
                              setFiltroAcaoAuditoria(op.id);
                              setPaginaAuditoria(1);
                            }}
                            style={{
                              flexShrink: 0,
                              padding: '4px 10px',
                              borderRadius: 20,
                              border: isAtivo ? '1.5px solid #1b5e20' : '1px solid #e2e8f0',
                              background: isAtivo ? '#1b5e20' : op.bg,
                              color: isAtivo ? '#ffffff' : op.cor,
                              fontSize: 11,
                              fontWeight: isAtivo ? 700 : 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <span>{op.label}</span>
                            <span
                              style={{
                                padding: '1px 6px',
                                borderRadius: 10,
                                fontSize: 10,
                                fontWeight: 800,
                                background: isAtivo ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.08)',
                                color: isAtivo ? '#ffffff' : op.cor,
                              }}
                            >
                              {count}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {carregandoAuditoria && (
                    <p style={{ fontSize: 13, color: '#aaa', margin: '20px 0', textAlign: 'center' }}>
                      Carregando registros de auditoria…
                    </p>
                  )}

                  {!carregandoAuditoria && auditoria.length === 0 && (
                    <p style={{ fontSize: 13, color: '#aaa', margin: '20px 0', textAlign: 'center' }}>
                      Nenhum registro de auditoria encontrado para este cooperado.
                    </p>
                  )}

                  {!carregandoAuditoria && auditoria.length > 0 && auditoriaFiltrada.length === 0 && (
                    <div style={{ background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: 8, padding: 20, textAlign: 'center', margin: '14px 0' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>
                        Nenhum registro encontrado
                      </div>
                      <div style={{ fontSize: 12, color: '#b45309', marginBottom: 10 }}>
                        Nenhum evento corresponde aos filtros selecionados.
                      </div>
                      <button
                        onClick={() => {
                          setFiltroAcaoAuditoria('todos');
                          setBuscaAuditoria('');
                          setPaginaAuditoria(1);
                        }}
                        style={{
                          background: '#92400e', color: '#fff', border: 'none', borderRadius: 6,
                          padding: '6px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                        }}
                      >
                        Limpar Filtros
                      </button>
                    </div>
                  )}

                  {/* Lista de Registros Paginada */}
                  {!carregandoAuditoria && auditoriaPaginada.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {auditoriaPaginada.map((reg) => {
                        const cor = acaoCor[reg.acao] ?? '#555';
                        const bg = acaoBg[reg.acao] ?? '#f5f5f5';
                        return (
                          <div
                            key={reg.id}
                            style={{
                              display: 'flex',
                              gap: 12,
                              padding: '10px 12px',
                              borderRadius: 8,
                              border: '1px solid #f1f5f9',
                              background: '#ffffff',
                              transition: 'background 0.15s ease',
                              alignItems: 'flex-start',
                            }}
                          >
                            {/* Ícone de Ação */}
                            <div
                              style={{
                                flexShrink: 0,
                                marginTop: 2,
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                background: bg,
                                color: cor,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {acaoIconComp[reg.acao] ?? <IconLock size={15} />}
                            </div>

                            {/* Conteúdo / Observações */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span
                                  style={{
                                    display: 'inline-block',
                                    padding: '2px 8px',
                                    borderRadius: 12,
                                    fontSize: 11,
                                    fontWeight: 800,
                                    background: bg,
                                    color: cor,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.4px',
                                  }}
                                >
                                  {reg.acao}
                                </span>
                                {reg.tabela && (
                                  <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                                    {reg.tabela}{reg.campo ? ` › ${reg.campo}` : ''}
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: 12, color: '#334155', marginTop: 4, lineHeight: 1.4 }}>
                                {reg.observacao ?? 'Alteração registrada no sistema'}
                              </div>

                              {(reg.valor_anterior || reg.valor_novo) && (
                                <div style={{ fontSize: 11, color: '#64748b', marginTop: 4, background: '#f8fafc', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                  {reg.valor_anterior && <span style={{ textDecoration: 'line-through', color: '#94a3b8' }}>{reg.valor_anterior}</span>}
                                  {reg.valor_anterior && reg.valor_novo && <span style={{ color: '#64748b' }}>→</span>}
                                  {reg.valor_novo && <span style={{ color: '#15803d', fontWeight: 700 }}>{reg.valor_novo}</span>}
                                </div>
                              )}
                            </div>

                            {/* Usuário e Data/Hora */}
                            <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
                              <div style={{ fontSize: 11, color: '#15803d', fontWeight: 700 }}>
                                {reg.usuario_nome ?? 'Sistema'}
                              </div>
                              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>
                                {new Date(reg.criado_em).toLocaleDateString('pt-BR')} às {new Date(reg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Controles de Paginação (10 linhas por página) */}
                  {!carregandoAuditoria && auditoriaFiltrada.length > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 14, paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 12, color: '#64748b' }}>
                        Mostrando <strong>{indiceInicioAuditoria + 1}</strong> a <strong>{Math.min(indiceInicioAuditoria + ITENS_POR_PAGINA_AUDITORIA, auditoriaFiltrada.length)}</strong> de <strong>{auditoriaFiltrada.length}</strong> registros
                        {auditoriaFiltrada.length !== auditoria.length && ` (filtrados de ${auditoria.length})`}
                      </div>

                      {totalPaginasAuditoria > 1 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <button
                            disabled={paginaAtualAuditoria <= 1}
                            onClick={() => setPaginaAuditoria((p) => Math.max(1, p - 1))}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
                              background: paginaAtualAuditoria <= 1 ? '#f8fafc' : '#fff',
                              color: paginaAtualAuditoria <= 1 ? '#94a3b8' : '#334155',
                              cursor: paginaAtualAuditoria <= 1 ? 'not-allowed' : 'pointer',
                              fontSize: 12, fontWeight: 600,
                            }}
                          >
                            ← Anterior
                          </button>

                          {Array.from({ length: totalPaginasAuditoria }, (_, i) => i + 1).map((num) => {
                            if (
                              num === 1 ||
                              num === totalPaginasAuditoria ||
                              (num >= paginaAtualAuditoria - 1 && num <= paginaAtualAuditoria + 1)
                            ) {
                              return (
                                <button
                                  key={num}
                                  onClick={() => setPaginaAuditoria(num)}
                                  style={{
                                    minWidth: 30, height: 30, padding: '0 4px', borderRadius: 6,
                                    border: num === paginaAtualAuditoria ? 'none' : '1px solid #cbd5e1',
                                    background: num === paginaAtualAuditoria ? '#1b5e20' : '#fff',
                                    color: num === paginaAtualAuditoria ? '#fff' : '#334155',
                                    cursor: 'pointer', fontSize: 12, fontWeight: 700,
                                  }}
                                >
                                  {num}
                                </button>
                              );
                            }
                            if (num === paginaAtualAuditoria - 2 || num === paginaAtualAuditoria + 2) {
                              return <span key={num} style={{ fontSize: 12, color: '#94a3b8', padding: '0 2px' }}>…</span>;
                            }
                            return null;
                          })}

                          <button
                            disabled={paginaAtualAuditoria >= totalPaginasAuditoria}
                            onClick={() => setPaginaAuditoria((p) => Math.min(totalPaginasAuditoria, p + 1))}
                            style={{
                              padding: '5px 10px', borderRadius: 6, border: '1px solid #cbd5e1',
                              background: paginaAtualAuditoria >= totalPaginasAuditoria ? '#f8fafc' : '#fff',
                              color: paginaAtualAuditoria >= totalPaginasAuditoria ? '#94a3b8' : '#334155',
                              cursor: paginaAtualAuditoria >= totalPaginasAuditoria ? 'not-allowed' : 'pointer',
                              fontSize: 12, fontWeight: 600,
                            }}
                          >
                            Próxima →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ── ABA: Histórico de Alocações ────────────────────────────────────── */}
        {aba === 'historico' && (
          <div style={card}>
            <p style={sTitle}>Histórico de Alocações ({alocacoes.length})</p>
            {alocacoes.length === 0 && <p style={{ fontSize: 13, color: '#aaa' }}>Nenhuma alocação registrada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {alocacoes.map((a) => (
                <div key={a.id} style={{ padding: '12px 14px', border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{a.cargo ?? '—'}{a.cbo ? ` (CBO: ${a.cbo})` : ''}</div>
                      <div style={{ fontSize: 12, color: '#666' }}>{a.nome_empresa ?? '—'} · {a.nome_unidade ?? '—'}</div>
                      <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                        Início: {formatarDataBR(a.data_inicio)}
                        {a.data_fim ? ` · Fim: ${formatarDataBR(a.data_fim)}` : ''}
                      </div>
                    </div>
                    <span style={badge(
                      a.status === 'ativa' ? '#e8f5e9' : a.status === 'encerrada' ? '#f5f5f5' : '#fce4ec',
                      a.status === 'ativa' ? '#2e7d32' : a.status === 'encerrada' ? '#757575' : '#c62828',
                    )}>
                      {a.status === 'ativa' ? 'Ativa' : a.status === 'encerrada' ? 'Encerrada' : 'Cancelada'}
                    </span>
                  </div>
                  {a.observacoes && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{a.observacoes}</div>}
                </div>
              ))}
            </div>
          </div>
        )}
        {/* ── Modal: Avaliação / Nota do Cooperado ───────────────────────────── */}
        {modalAvaliacao.aberto && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '26px 30px', width: 460, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>
                  Avaliação do Cooperado
                </h3>
                <button
                  onClick={() => setModalAvaliacao({ aberto: false, nota: '', observacao: '', salvando: false })}
                  style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa', padding: 0 }}
                >×</button>
              </div>

              <p style={{ fontSize: 13, color: '#444', margin: '0 0 16px' }}>
                Cooperado: <strong>{candidato.nome}</strong>
              </p>

              <div style={{ ...field, marginBottom: 14 }}>
                <label style={label}>Nota da Prova / Avaliação (0.0 a 10.0) *</label>
                <input
                  style={{ ...input, fontSize: 16, fontWeight: 700 }}
                  type="number"
                  step="0.1"
                  min="0"
                  max="10"
                  placeholder="Ex: 8.5"
                  value={modalAvaliacao.nota}
                  onChange={(e) => setModalAvaliacao((p) => ({ ...p, nota: e.target.value }))}
                />
              </div>

              {/* Indicador de Aprovado / Reprovado em tempo real */}
              {modalAvaliacao.nota !== '' && !isNaN(parseFloat(modalAvaliacao.nota.replace(',', '.'))) && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  marginBottom: 14,
                  background: parseFloat(modalAvaliacao.nota.replace(',', '.')) >= 7.0 ? '#e8f5e9' : '#ffebee',
                  border: `1px solid ${parseFloat(modalAvaliacao.nota.replace(',', '.')) >= 7.0 ? '#a5d6a7' : '#ef9a9a'}`,
                  color: parseFloat(modalAvaliacao.nota.replace(',', '.')) >= 7.0 ? '#2e7d32' : '#c62828',
                  fontSize: 13,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}>
                  {parseFloat(modalAvaliacao.nota.replace(',', '.')) >= 7.0
                    ? <><span>✓</span> APROVADO (Nota ≥ 7.0 — Status Ativo e matrícula gerada)</>
                    : <><span>✕</span> REPROVADO (Nota &lt; 7.0 — Poderá realizar nova prova futuramente)</>
                  }
                </div>
              )}

              <div style={{ ...field, marginBottom: 18 }}>
                <label style={label}>Observações / Parecer da Prova (opcional)</label>
                <textarea
                  style={{ ...input, height: 60 }}
                  placeholder="Ex: Bom desempenho na prova prática e entrevista..."
                  value={modalAvaliacao.observacao}
                  onChange={(e) => setModalAvaliacao((p) => ({ ...p, observacao: e.target.value }))}
                />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <IonButton
                  shape="round"
                  fill="outline"
                  onClick={() => setModalAvaliacao({ aberto: false, nota: '', observacao: '', salvando: false })}
                >
                  Cancelar
                </IonButton>
                <IonButton
                  shape="round"
                  color={parseFloat(modalAvaliacao.nota.replace(',', '.')) >= 7.0 ? 'success' : 'danger'}
                  onClick={handleConfirmarAvaliacao}
                  disabled={modalAvaliacao.salvando || modalAvaliacao.nota === ''}
                >
                  {modalAvaliacao.salvando ? 'Salvando...' : 'Confirmar Avaliação'}
                </IonButton>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Inativar cooperado ────────────────────────────────────── */}
        {modalInativar && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: 440, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#616161', fontWeight: 700 }}>
                Inativar cooperado (Pausa temporária)
              </h3>
              <p style={{ fontSize: 13, color: '#444', margin: '0 0 16px', lineHeight: 1.4 }}>
                O cooperado <strong>{candidato.nome}</strong> ficará com status <em>Inativo</em> e não receberá novas alocações até ser reativado.
              </p>
              <div style={field}>
                <label style={label}>Motivo da inativação (opcional)</label>
                <textarea
                  style={{ ...input, height: 70 }}
                  placeholder="Ex: Pausa temporária, licença, indisponibilidade de agenda..."
                  value={motivoInativar}
                  onChange={(e) => setMotivoInativar(e.target.value)}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <IonButton shape="round" fill="outline" onClick={() => setModalInativar(false)}>
                  Cancelar
                </IonButton>
                <IonButton shape="round" color="medium" onClick={handleConfirmarInativar} disabled={inativando}>
                  {inativando ? 'Inativando...' : 'Confirmar Inativação'}
                </IonButton>
              </div>
            </div>
          </div>
        )}

        {/* ── Modal: Desligar cooperado com dupla confirmação ──────────────── */}
        {modalDesligar && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '26px 30px', width: 520, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.25)', maxHeight: '90vh', overflowY: 'auto' }}>
              {etapaDesligar === 1 ? (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <div style={{ width: 38, height: 38, borderRadius: 19, background: tipoDesligamento === 'total' ? '#ffebee' : '#e0f2fe', color: tipoDesligamento === 'total' ? '#c62828' : '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <IconAlert size={20} />
                    </div>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 17, color: tipoDesligamento === 'total' ? '#c62828' : '#0369a1', fontWeight: 700 }}>
                        {tipoDesligamento === 'total' ? 'Desligamento Total do Cooperado' : 'Desligamento de Posto / Realocação'}
                      </h3>
                      <span style={{ fontSize: 12, color: '#777' }}>Etapa 1 de 2: Tipo e Dados do Desligamento</span>
                    </div>
                  </div>

                  <p style={{ fontSize: 13, color: '#444', margin: '0 0 14px', lineHeight: 1.4 }}>
                    Selecione o tipo de desligamento para <strong>{candidato.nome}</strong>:
                  </p>

                  {/* Seleção do Tipo de Desligamento */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${tipoDesligamento === 'total' ? '#c62828' : '#e2e8f0'}`,
                        background: tipoDesligamento === 'total' ? '#fff5f5' : '#f8fafc',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="radio"
                        name="tipoDesligamento"
                        value="total"
                        checked={tipoDesligamento === 'total'}
                        onChange={() => setTipoDesligamento('total')}
                        style={{ marginTop: 3 }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#c62828' }}>
                          🔴 Desligamento Total (Cancelamento de Cadastro)
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2, lineHeight: 1.35 }}>
                          O cooperado perde o número de matrícula e o cadastro é cancelado. Caso retorne futuramente, precisará fazer uma nova adesão a partir do <strong>status 0</strong>.
                        </div>
                      </div>
                    </label>

                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 10,
                        padding: '12px 14px',
                        borderRadius: 10,
                        border: `1.5px solid ${tipoDesligamento === 'realocacao' ? '#0284c7' : '#e2e8f0'}`,
                        background: tipoDesligamento === 'realocacao' ? '#f0f9ff' : '#f8fafc',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                      }}
                    >
                      <input
                        type="radio"
                        name="tipoDesligamento"
                        value="realocacao"
                        checked={tipoDesligamento === 'realocacao'}
                        onChange={() => setTipoDesligamento('realocacao')}
                        style={{ marginTop: 3 }}
                      />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0369a1' }}>
                          🔄 Desligamento de Posto para Realocação / Troca de Função
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2, lineHeight: 1.35 }}>
                          Encerra a alocação no cliente/posto atual, mas <strong>mantém o cooperado ativo e preserva sua matrícula (#{candidato.matricula || '—'})</strong> para ser realocado em outra função.
                        </div>
                      </div>
                    </label>
                  </div>

                  <div style={{ ...field, marginBottom: 12 }}>
                    <label style={label}>Data do Desligamento *</label>
                    <input
                      type="date"
                      style={input}
                      value={dataDesligar}
                      onChange={(e) => setDataDesligar(e.target.value)}
                    />
                  </div>
                  <div style={field}>
                    <label style={label}>Motivo do Desligamento *</label>
                    <textarea
                      style={{ ...input, height: 65 }}
                      placeholder={
                        tipoDesligamento === 'total'
                          ? 'Ex: Pedido de demissão/saída da cooperativa, rescisão voluntária...'
                          : 'Ex: Fim do contrato no posto do cliente, transferência de unidade, troca de função...'
                      }
                      value={motivoDesligar}
                      onChange={(e) => setMotivoDesligar(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
                    <IonButton shape="round" fill="outline" onClick={() => { setModalDesligar(false); setEtapaDesligar(1); }}>
                      Cancelar
                    </IonButton>
                    <IonButton
                      shape="round"
                      color={tipoDesligamento === 'total' ? 'danger' : 'primary'}
                      onClick={() => {
                        if (!dataDesligar) {
                          showToast('Por favor, informe a data do desligamento.', 'warning');
                          return;
                        }
                        if (!motivoDesligar.trim()) {
                          showToast('Por favor, descreva o motivo do desligamento.', 'warning');
                          return;
                        }
                        setEtapaDesligar(2);
                      }}
                    >
                      Avançar para Confirmação →
                    </IonButton>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ width: 48, height: 48, borderRadius: 24, background: tipoDesligamento === 'total' ? '#ffebee' : '#e0f2fe', color: tipoDesligamento === 'total' ? '#c62828' : '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <IconAlert size={28} />
                  </div>
                  <h3 style={{ margin: '0 0 8px', fontSize: 18, color: tipoDesligamento === 'total' ? '#c62828' : '#0369a1', fontWeight: 800, textAlign: 'center' }}>
                    {tipoDesligamento === 'total'
                      ? 'Confirmar Desligamento Total Definitivo?'
                      : 'Confirmar Encerramento de Posto para Realocação?'}
                  </h3>
                  <p style={{ fontSize: 12, color: '#666', textAlign: 'center', margin: '0 0 16px' }}>
                    Etapa 2 de 2: Confirmação de Segurança
                  </p>

                  <div style={{
                    background: tipoDesligamento === 'total' ? '#fff5f5' : '#f0f9ff',
                    border: `1.5px solid ${tipoDesligamento === 'total' ? '#ffcdd2' : '#bae6fd'}`,
                    borderRadius: 10,
                    padding: '14px 16px',
                    marginBottom: 18
                  }}>
                    <p style={{ fontSize: 13, color: '#333', margin: '0 0 10px', lineHeight: 1.5 }}>
                      Cooperado: <strong style={{ fontSize: 14, color: tipoDesligamento === 'total' ? '#c62828' : '#0369a1' }}>{candidato.nome}</strong> {candidato.matricula ? `(Matrícula #${candidato.matricula})` : ''}
                    </p>
                    <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: '#555', lineHeight: 1.6 }}>
                      <li><strong>Tipo:</strong> {tipoDesligamento === 'total' ? '🔴 Desligamento Total (Cancelamento)' : '🔄 Desligamento de Posto para Realocação'}</li>
                      <li><strong>Data:</strong> {formatarDataBR(dataDesligar)}</li>
                      <li><strong>Motivo:</strong> {motivoDesligar}</li>
                      {tipoDesligamento === 'total' ? (
                        <>
                          <li>Todas as <strong>alocações ativas serão encerradas</strong>.</li>
                          <li>Todos os <strong>benefícios vinculados serão cancelados</strong>.</li>
                          <li>A matrícula atual (#{candidato.matricula || '—'}) será <strong>cancelada e arquivada</strong>.</li>
                          <li>Caso queira retornar futuramente, deverá iniciar uma <strong>nova adesão do status 0</strong>.</li>
                        </>
                      ) : (
                        <>
                          <li>A <strong>alocação no posto atual será encerrada</strong>.</li>
                          <li>A <strong>matrícula (#{candidato.matricula || '—'}) e o cadastro continuam ativos</strong> na cooperativa.</li>
                          <li>O cooperado fica <strong>disponível para nova alocação / troca de função</strong>.</li>
                        </>
                      )}
                    </ul>
                  </div>

                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <IonButton shape="round" fill="outline" onClick={() => setEtapaDesligar(1)} disabled={desligando}>
                      ← Voltar
                    </IonButton>
                    <IonButton
                      shape="round"
                      color={tipoDesligamento === 'total' ? 'danger' : 'primary'}
                      onClick={handleConfirmarDesligar}
                      disabled={desligando}
                    >
                      {desligando
                        ? 'Processando...'
                        : tipoDesligamento === 'total'
                        ? 'Sim, confirmar desligamento total'
                        : 'Sim, confirmar encerramento e manter cooperado'}
                    </IonButton>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        {/* ── Modal: Rejeitar documento ────────────────────────────────────── */}
        {rejeitandoDoc !== null && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
            <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: 460, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
              <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#c62828', fontWeight: 700 }}>
                Rejeitar Documento
              </h3>
              <p style={{ fontSize: 13, color: '#555', margin: '0 0 16px', lineHeight: 1.4 }}>
                Informe o motivo da rejeição do documento para notificar o cooperado.
              </p>
              <div style={field}>
                <label style={label}>Motivo da Rejeição *</label>
                <textarea
                  style={{ ...input, height: 80 }}
                  placeholder="Ex: Documento ilegível, foto cortada ou documento vencido..."
                  value={motivoRejeicao}
                  onChange={(e) => setMotivoRejeicao(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <IonButton shape="round" fill="outline" onClick={() => { setRejeitandoDoc(null); setMotivoRejeicao(''); }}>
                  Cancelar
                </IonButton>
                <IonButton
                  shape="round"
                  color="danger"
                  onClick={() => handleRejeitar(rejeitandoDoc)}
                  disabled={!motivoRejeicao.trim()}
                >
                  Confirmar Rejeição
                </IonButton>
              </div>
            </div>
          </div>
        )}
      </div>{/* fim do div de conteúdo das abas */}

      {/* ── Barra Inferior Fixa: Salvar Todas as Informações ── */}
      <div style={{
        background: '#fff',
        borderTop: '2px solid #e8edf4',
        padding: '16px 28px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
        position: 'sticky',
        bottom: 0,
        zIndex: 50,
      }}>
        <div style={{ fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#4a9e4f' }} />
          As alterações feitas em qualquer aba são salvas em conjunto.
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <IonButton shape="round" fill="outline" color="medium" onClick={onVoltar}>
            Fechar
          </IonButton>
          <IonButton
            shape="round"
            color="primary"
            disabled={salvandoTudo}
            onClick={salvarTudo}
            style={{ fontWeight: 700 }}
          >
            {salvandoTudo ? 'Salvando tudo…' : 'Salvar Todas as Informações'}
          </IonButton>
        </div>
      </div>
    </div>
  );
};

export default CandidatoDetalhe;
