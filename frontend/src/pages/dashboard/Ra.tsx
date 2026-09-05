import React, { useEffect, useState, useCallback, useRef } from 'react';
import { IonButton, useIonViewWillEnter } from '@ionic/react';
import {
  IconChart, IconUsers, IconBuilding, IconSearch, IconEdit,
  IconCheck, IconX, IconPlus, IconMail, IconPhone, IconPin,
  IconAlert, IconBell, IconFile, IconTrash,
} from '../../components/Icons';
import {
  Candidato, VagaRA, Alocacao, MetricasRA, NovoCandidato, TipoContratacao, StatusCandidato,
  obterMetricasRA, listarCandidatos, buscarCandidatos, cadastrarCandidato,
  atualizarCandidato, avaliarCandidato, inativarCandidato, reativarCandidato, removerCandidato, excluirCandidato,
  listarVagasRA, fecharVagaRA, listarAlocacoesPorVaga, alocarCandidato, encerrarAlocacao,
  verificarNomeCandidato, verificarCpfCandidato, obterCandidato,
} from '../../api/raApi';
import { listarAlertas, marcarAlertaLido, marcarTodosLidos, AlertaBeneficio } from '../../api/beneficiosApi';
import { listarEmpresas, Empresa } from '../../api/empresasApi';
import CandidatoDetalhe from './CandidatoDetalhe';
import { formatarCPF, formatarTelefone, formatarDataBR, dataHoje, validarCPF, formatarMoeda } from '../../utils/formatters';
import { useToast } from '../../components/ToastContext';
import { usePermissoes } from '../../auth/PermissoesContext';
import { useAuth } from '../../auth/AuthContext';

// ── Helpers ──────────────────────────────────────────────────────────────────

type Aba = 'dashboard' | 'candidatos' | 'vagas';

const COR_STATUS: Record<number, { bg: string; color: string; label: string }> = {
  0: { bg: '#fff8e1', color: '#e65100', label: 'Pré-cadastro' },
  1: { bg: '#e8f5e9', color: '#2e7d32', label: 'Aprovado' },
  2: { bg: '#f5f5f5', color: '#616161', label: 'Inativo' },
  3: { bg: '#ffebee', color: '#c62828', label: 'Reprovado' },
  4: { bg: '#ffebee', color: '#b71c1c', label: 'Desligado' },
};

const COR_TIPO: Record<TipoContratacao, { bg: string; color: string; label: string }> = {
  interno: { bg: '#ede7f6', color: '#512da8', label: 'Interno' },
  externo: { bg: '#e0f2f1', color: '#00695c', label: 'Externo' },
};

const CANDIDATO_VAZIO: NovoCandidato = {
  nome: '', cpf: '', email: '', telefone: '', whatsapp: '', cooperativa: 'ATESA', tipo_contratacao: 'externo', observacoes: '',
};

function formatarCpfInput(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function OcupacaoBar({ ocupadas, total }: { ocupadas: number; total: number }) {
  const pct = total > 0 ? Math.min((ocupadas / total) * 100, 100) : 0;
  const cor = pct >= 100 ? '#c62828' : pct >= 80 ? '#e65100' : '#2e7d32';
  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#777', marginBottom: 3 }}>
        <span>{ocupadas}/{total} ocupadas</span>
        <span style={{ color: cor, fontWeight: 700 }}>{Math.round(pct)}%</span>
      </div>
      <div style={{ height: 6, background: '#eee', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: cor, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const Ra: React.FC = () => {
  const { showToast } = useToast();
  const { temPermissao } = usePermissoes();
  const { usuario } = useAuth();
  const ehAdmin = usuario?.perfil === 'administrador' || temPermissao('ra.candidatos_excluir') || temPermissao('admin');
  const [aba, setAba] = useState<Aba>('dashboard');
  const [erro, setErro] = useState('');

  // ── Dashboard ──────────────────────────────────────────────────────────────
  const [metricas, setMetricas] = useState<MetricasRA | null>(null);
  const [carregandoMetricas, setCarregandoMetricas] = useState(true);

  type FiltroDash = 'total' | 'pre_cadastro' | 'ativos' | 'reprovados' | 'inativos' | 'desligados' | 'alocacoes' | 'alocados';
  const [filtroDash, setFiltroDash] = useState<FiltroDash | null>(null);
  const [candidatosDash, setCandidatosDash] = useState<Candidato[]>([]);
  const [carregandoDash, setCarregandoDash] = useState(false);

  // ── Candidatos ─────────────────────────────────────────────────────────────
  const [candidatos, setCandidatos] = useState<Candidato[]>([]);
  const [carregandoCand, setCarregandoCand] = useState(false);
  const [filtroCandStatus, setFiltroCandStatus] = useState('');
  const [filtroCandTipo, setFiltroCandTipo] = useState('');
  const [filtroCandBusca, setFiltroCandBusca] = useState('');
  const [showFormCand, setShowFormCand] = useState(false);
  const [editandoCand, setEditandoCand] = useState<Candidato | null>(null);
  const [formCand, setFormCand] = useState<NovoCandidato>(CANDIDATO_VAZIO);
  const [salvandoCand, setSalvandoCand] = useState(false);
  const [erroForm, setErroForm] = useState('');

  // Modal de avaliação (nota da prova 0.0 a 10.0)
  const [modalAvaliacao, setModalAvaliacao] = useState<{
    aberto: boolean;
    candidato: Candidato | null;
    nota: string;
    observacao: string;
    salvando: boolean;
  }>({
    aberto: false,
    candidato: null,
    nota: '',
    observacao: '',
    salvando: false,
  });

  // Modal de inativação
  const [modalInativar, setModalInativar] = useState<{
    aberto: boolean;
    candidato: Candidato | null;
    motivo: string;
    salvando: boolean;
  }>({
    aberto: false,
    candidato: null,
    motivo: '',
    salvando: false,
  });

  // Modal de exclusão definitiva (apenas Administrador)
  const [modalExcluir, setModalExcluir] = useState<{
    aberto: boolean;
    candidato: Candidato | null;
    salvando: boolean;
  }>({
    aberto: false,
    candidato: null,
    salvando: false,
  });

  // Verificação de duplicatas no formulário
  const [nomesParecidos, setNomesParecidos] = useState<{ id: number; nome: string; cpf: string; matricula: string | null; status: StatusCandidato }[]>([]);
  const [cpfDuplicado, setCpfDuplicado] = useState<{ nome: string; matricula: string | null } | null>(null);
  const [cpfInvalido, setCpfInvalido] = useState(false);
  const nomeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cpfTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Ficha completa do cooperado ────────────────────────────────────────────
  const [verDetalhe, setVerDetalhe] = useState<{
    candidato: Candidato;
    alocacoes: Alocacao[];
    abaInicial?: 'pessoal' | 'endereco' | 'bancario' | 'documentos' | 'descontos' | 'historico' | 'auditoria';
  } | null>(null);

  const abrirFicha = async (c: Candidato, abaInicial?: 'pessoal' | 'endereco' | 'bancario' | 'documentos' | 'descontos' | 'historico' | 'auditoria') => {
    try {
      const dados = await obterCandidato(c.id);
      setVerDetalhe({ candidato: dados, alocacoes: dados.alocacoes ?? [], abaInicial: abaInicial ?? 'pessoal' });
    } catch {
      setVerDetalhe({ candidato: c, alocacoes: [], abaInicial: abaInicial ?? 'pessoal' });
    }
  };

  // ── Alertas e Notificações de Documentos / Sistema ────────────────────────
  const [alertasPendentes, setAlertasPendentes] = useState<AlertaBeneficio[]>([]);
  const [carregandoAlertas, setCarregandoAlertas] = useState(false);
  const [showModalNotificacoes, setShowModalNotificacoes] = useState(false);

  const carregarAlertasPendentes = useCallback(async () => {
    setCarregandoAlertas(true);
    try {
      const lista = await listarAlertas({ lido: 0 });
      setAlertasPendentes(lista.filter((a) => a.lido === 0));
    } catch {
      /* silencioso */
    } finally {
      setCarregandoAlertas(false);
    }
  }, []);

  const handleMarcarAlertaLido = async (alertaId: number) => {
    try {
      await marcarAlertaLido(alertaId);
      setAlertasPendentes((prev) => prev.filter((a) => a.id !== alertaId));
      showToast('Notificação marcada como lida.', 'success');
    } catch {
      showToast('Erro ao marcar notificação.', 'error');
    }
  };

  const handleMarcarTodosAlertasLidos = async () => {
    try {
      await marcarTodosLidos();
      setAlertasPendentes([]);
      showToast('Todas as notificações foram marcadas como lidas.', 'success');
    } catch {
      showToast('Erro ao marcar notificações.', 'error');
    }
  };

  const abrirFichaDoc = async (alerta: AlertaBeneficio) => {
    setShowModalNotificacoes(false);
    try {
      const dados = await obterCandidato(alerta.candidato_id);
      setVerDetalhe({
        candidato: dados,
        alocacoes: dados.alocacoes ?? [],
        abaInicial: alerta.tipo.startsWith('documento_') ? 'documentos' : 'pessoal',
      });
    } catch {
      const cand = candidatos.find((c) => c.id === alerta.candidato_id);
      if (cand) {
        setVerDetalhe({
          candidato: cand,
          alocacoes: [],
          abaInicial: alerta.tipo.startsWith('documento_') ? 'documentos' : 'pessoal',
        });
      } else {
        showToast('Não foi possível carregar a ficha do cooperado.', 'error');
      }
    }
  };

  // ── Vagas / Alocação ───────────────────────────────────────────────────────
  const [vagas, setVagas] = useState<VagaRA[]>([]);
  const [carregandoVagas, setCarregandoVagas] = useState(false);
  const [empresasTomadores, setEmpresasTomadores] = useState<Empresa[]>([]);
  const [filtroVagaCargo, setFiltroVagaCargo] = useState('');
  const [filtroVagaTomador, setFiltroVagaTomador] = useState('');
  const [filtroVagaStatus, setFiltroVagaStatus] = useState<'abertas' | 'fechadas' | 'todas'>('abertas');
  const [vagaSel, setVagaSel] = useState<VagaRA | null>(null);
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([]);
  const [carregandoAloc, setCarregandoAloc] = useState(false);

  // Modal fechar / reabrir vaga
  const [modalFecharVaga, setModalFecharVaga] = useState<{
    aberto: boolean;
    vaga: VagaRA | null;
    ativa: boolean;
    motivo: string;
    salvando: boolean;
  }>({
    aberto: false,
    vaga: null,
    ativa: false,
    motivo: '',
    salvando: false,
  });

  // Modal de alocação
  const [showModalAlocar, setShowModalAlocar] = useState(false);
  const [buscaAlocar, setBuscaAlocar] = useState('');
  const [resultadosBusca, setResultadosBusca] = useState<Candidato[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [candAlocar, setCandAlocar] = useState<Pick<Candidato, 'id' | 'nome' | 'cpf' | 'matricula' | 'qualificacoes'> | null>(null);
  const [dataInicioAlocar, setDataInicioAlocar] = useState(dataHoje());
  const [obsAlocar, setObsAlocar] = useState('');
  const [alocando, setAlocando] = useState(false);
  const [erroAlocar, setErroAlocar] = useState('');

  // ── Carregamento ───────────────────────────────────────────────────────────

  const carregarMetricas = useCallback(async () => {
    setCarregandoMetricas(true);
    try {
      const m = await obterMetricasRA();
      setMetricas(m);
    } catch { setErro('Erro ao carregar métricas.'); }
    finally { setCarregandoMetricas(false); }
  }, []);

  const aplicarFiltroDash = useCallback(async (novo: FiltroDash | null) => {
    const proximo = filtroDash === novo ? null : novo;
    setFiltroDash(proximo);
    if (!proximo) { setCandidatosDash([]); return; }
    setCarregandoDash(true);
    try {
      const status = proximo === 'pre_cadastro' ? '0'
        : proximo === 'reprovados' ? '3'
          : proximo === 'inativos' ? '2'
            : proximo === 'desligados' ? '4'
              : proximo === 'total' ? ''
                : '1'; // ativos, alocacoes, alocados
      const lista = await listarCandidatos({ status });
      const filtrados = (proximo === 'alocacoes' || proximo === 'alocados')
        ? lista.filter((c) => c.alocacoes_ativas > 0)
        : lista;
      setCandidatosDash(filtrados);
    } catch { setErro('Erro ao carregar lista.'); }
    finally { setCarregandoDash(false); }
  }, [filtroDash]);

  const carregarCandidatos = useCallback(async () => {
    setCarregandoCand(true);
    try {
      const lista = await listarCandidatos({
        status: filtroCandStatus,
        tipo_contratacao: filtroCandTipo,
        busca: filtroCandBusca,
      });
      setCandidatos(lista);
    } catch { setErro('Erro ao carregar candidatos.'); }
    finally { setCarregandoCand(false); }
  }, [filtroCandStatus, filtroCandTipo, filtroCandBusca]);

  const carregarTomadores = useCallback(async () => {
    try {
      const emps = await listarEmpresas();
      setEmpresasTomadores(emps);
    } catch { /* silencioso */ }
  }, []);

  const carregarVagas = useCallback(async () => {
    setCarregandoVagas(true);
    setErro('');
    try {
      const lista = await listarVagasRA({
        cargo: filtroVagaCargo,
        tomador: filtroVagaTomador,
        status: filtroVagaStatus,
      });
      setVagas(lista);
      setVagaSel((prev) => {
        if (!prev) return lista[0] ?? null;
        const atualizada = lista.find((x) => x.id === prev.id);
        return atualizada ?? lista[0] ?? null;
      });
    } catch { setErro('Erro ao carregar vagas.'); }
    finally { setCarregandoVagas(false); }
  }, [filtroVagaCargo, filtroVagaTomador, filtroVagaStatus]);

  const handleConfirmarFecharVaga = async () => {
    if (!modalFecharVaga.vaga) return;
    setModalFecharVaga((prev) => ({ ...prev, salvando: true }));
    try {
      await fecharVagaRA(modalFecharVaga.vaga.id, modalFecharVaga.ativa, modalFecharVaga.motivo);
      showToast(modalFecharVaga.ativa ? 'Vaga reaberta com sucesso!' : 'Vaga fechada com sucesso!', 'success');
      const vagaId = modalFecharVaga.vaga.id;
      const novaAtiva = modalFecharVaga.ativa;
      setModalFecharVaga({ aberto: false, vaga: null, ativa: false, motivo: '', salvando: false });
      if (vagaSel && vagaSel.id === vagaId) {
        setVagaSel((prev) => prev ? { ...prev, ativa: novaAtiva } : null);
      }
      await carregarVagas();
      await carregarMetricas();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao alterar ativação da vaga.', 'error');
      setModalFecharVaga((prev) => ({ ...prev, salvando: false }));
    }
  };

  const carregarAlocacoes = useCallback(async (vagaId: number) => {
    setCarregandoAloc(true);
    try {
      const lista = await listarAlocacoesPorVaga(vagaId);
      setAlocacoes(lista);
    } catch { }
    finally { setCarregandoAloc(false); }
  }, []);

  useEffect(() => {
    carregarMetricas();
    carregarTomadores();
    carregarAlertasPendentes();
  }, [carregarMetricas, carregarTomadores, carregarAlertasPendentes]);
  useEffect(() => { if (aba === 'candidatos') carregarCandidatos(); }, [aba, carregarCandidatos]);
  useEffect(() => { if (aba === 'vagas') carregarVagas(); }, [aba, carregarVagas]);
  useIonViewWillEnter(() => {
    carregarMetricas();
    carregarTomadores();
    carregarAlertasPendentes();
  });

  // ── Busca de candidatos para alocação ──────────────────────────────────────

  useEffect(() => {
    if (buscaAlocar.length < 2) { setResultadosBusca([]); return; }
    const timer = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscarCandidatos(buscaAlocar);
        setResultadosBusca(r as Candidato[]);
      } catch { }
      finally { setBuscando(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaAlocar]);

  // ── Handlers de candidatos ─────────────────────────────────────────────────

  const limparAvisosDuplicata = () => {
    setNomesParecidos([]);
    setCpfDuplicado(null);
    setCpfInvalido(false);
  };

  const abrirNovoCandidato = () => {
    setEditandoCand(null);
    setFormCand(CANDIDATO_VAZIO);
    setErroForm('');
    limparAvisosDuplicata();
    setShowFormCand(true);
  };

  const abrirEditarCandidato = (c: Candidato) => {
    setEditandoCand(c);
    setFormCand({
      nome: c.nome,
      cpf: formatarCPF(c.cpf),
      email: c.email ?? '',
      telefone: formatarTelefone(c.telefone ?? ''),
      whatsapp: formatarTelefone(c.whatsapp ?? ''),
      cooperativa: c.cooperativa,
      tipo_contratacao: c.tipo_contratacao === 'interno' ? 'interno' : 'externo',
      observacoes: c.observacoes ?? '',
    });
    setErroForm('');
    limparAvisosDuplicata();
    setShowFormCand(true);
  };

  const handleNomeCandChange = (valor: string) => {
    setFormCand((p) => ({ ...p, nome: valor }));
    if (nomeTimerRef.current) clearTimeout(nomeTimerRef.current);
    if (valor.trim().length < 3) { setNomesParecidos([]); return; }
    nomeTimerRef.current = setTimeout(async () => {
      try { setNomesParecidos(await verificarNomeCandidato(valor, editandoCand?.id)); }
      catch { setNomesParecidos([]); }
    }, 400);
  };

  const handleCpfCandChange = (valor: string) => {
    const formatado = formatarCpfInput(valor);
    setFormCand((p) => ({ ...p, cpf: formatado }));
    setCpfDuplicado(null);
    setCpfInvalido(false);
    if (cpfTimerRef.current) clearTimeout(cpfTimerRef.current);
    const limpo = formatado.replace(/\D/g, '');
    if (limpo.length !== 11) return;
    if (!validarCPF(formatado)) { setCpfInvalido(true); return; }
    cpfTimerRef.current = setTimeout(async () => {
      try {
        const { existe, candidato } = await verificarCpfCandidato(limpo);
        if (existe && candidato) setCpfDuplicado({ nome: candidato.nome, matricula: candidato.matricula });
      } catch { /* silencioso */ }
    }, 300);
  };

  const handleSalvarCandidato = async () => {
    if (!formCand.nome || !formCand.cpf || !formCand.cooperativa) { setErroForm('Nome, CPF e cooperativa são obrigatórios.'); return; }
    if (!editandoCand && cpfInvalido) { setErroForm('CPF inválido. Verifique os dígitos.'); return; }
    if (!editandoCand && cpfDuplicado) { setErroForm('Já existe um cooperado cadastrado com este CPF.'); return; }
    const cpfLimpo = formCand.cpf.replace(/\D/g, '');
    if (!editandoCand && !validarCPF(formCand.cpf)) { setErroForm('CPF inválido. Verifique os dígitos.'); return; }
    setSalvandoCand(true);
    setErroForm('');
    try {
      if (editandoCand) {
        await atualizarCandidato(editandoCand.id, {
          nome: formCand.nome,
          email: formCand.email,
          telefone: formCand.telefone,
          whatsapp: formCand.whatsapp,
          cooperativa: formCand.cooperativa,
          tipo_contratacao: formCand.tipo_contratacao === 'interno' ? 'interno' : 'externo',
          observacoes: formCand.observacoes,
        });
        showToast('Cooperado atualizado com sucesso!', 'success');
      } else {
        await cadastrarCandidato({
          ...formCand,
          cpf: cpfLimpo,
          tipo_contratacao: formCand.tipo_contratacao === 'interno' ? 'interno' : 'externo',
        });
        showToast('Pré-cadastro de cooperado realizado!', 'success');
      }
      setShowFormCand(false);
      await carregarCandidatos();
      await carregarMetricas();
    } catch (e: any) {
      setErroForm(e?.message ?? 'Erro ao salvar.');
    } finally { setSalvandoCand(false); }
  };

  // ── Avaliação / Nota ───────────────────────────────────────────────────────

  const abrirModalAvaliacao = (c: Candidato, notaSugerida: string = '') => {
    setModalAvaliacao({
      aberto: true,
      candidato: c,
      nota: notaSugerida || (c.nota_avaliacao !== null && c.nota_avaliacao !== undefined ? String(c.nota_avaliacao) : ''),
      observacao: c.observacao_avaliacao || '',
      salvando: false,
    });
  };

  const handleConfirmarAvaliacao = async () => {
    if (!modalAvaliacao.candidato) return;
    const notaNum = parseFloat(modalAvaliacao.nota.replace(',', '.'));
    if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) {
      showToast('A nota deve estar entre 0.0 e 10.0', 'warning');
      return;
    }
    setModalAvaliacao((p) => ({ ...p, salvando: true }));
    try {
      const resp = await avaliarCandidato(modalAvaliacao.candidato.id, {
        nota: notaNum,
        observacao: modalAvaliacao.observacao || undefined,
      });
      if (resp.aprovado) {
        showToast(`Cooperado APROVADO com nota ${notaNum.toFixed(1)}! Encaminhado para o setor de Benefícios.`, 'success');
      } else {
        showToast(`Cooperado REPROVADO com nota ${notaNum.toFixed(1)}. O cooperado poderá realizar nova prova futuramente.`, 'warning');
      }
      setModalAvaliacao({ aberto: false, candidato: null, nota: '', observacao: '', salvando: false });
      await carregarCandidatos();
      await carregarMetricas();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao registrar avaliação.', 'error');
      setModalAvaliacao((p) => ({ ...p, salvando: false }));
    }
  };

  const handleAbrirInativar = (c: Candidato) => {
    setModalInativar({ aberto: true, candidato: c, motivo: '', salvando: false });
  };

  const handleConfirmarInativar = async () => {
    if (!modalInativar.candidato) return;
    setModalInativar((p) => ({ ...p, salvando: true }));
    try {
      await inativarCandidato(modalInativar.candidato.id, modalInativar.motivo);
      showToast(`Cooperado ${modalInativar.candidato.nome} inativado com sucesso.`, 'success');
      setModalInativar({ aberto: false, candidato: null, motivo: '', salvando: false });
      await carregarCandidatos();
      await carregarMetricas();
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao inativar cooperado.', 'error');
      setModalInativar((p) => ({ ...p, salvando: false }));
    }
  };

  const handleReativar = async (c: Candidato) => {
    if (!window.confirm(`Reativar o cooperado "${c.nome}"?`)) return;
    try {
      await reativarCandidato(c.id);
      showToast(`Cooperado ${c.nome} reativado com sucesso!`, 'success');
      await carregarCandidatos();
      await carregarMetricas();
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao reativar.');
    }
  };

  const handleRemover = async (c: Candidato) => {
    setModalExcluir({ aberto: true, candidato: c, salvando: false });
  };

  const handleConfirmarExcluir = async () => {
    if (!modalExcluir.candidato) return;
    setModalExcluir((p) => ({ ...p, salvando: true }));
    try {
      await excluirCandidato(modalExcluir.candidato.id);
      showToast(`Cooperado ${modalExcluir.candidato.nome} excluído com sucesso!`, 'success');
      setModalExcluir({ aberto: false, candidato: null, salvando: false });
      await carregarCandidatos();
      await carregarMetricas();
      if (filtroDash) aplicarFiltroDash(filtroDash);
    } catch (e: any) {
      showToast(e?.message ?? 'Erro ao excluir cooperado.', 'error');
      setModalExcluir((p) => ({ ...p, salvando: false }));
    }
  };

  // ── Handlers de vagas / alocação ───────────────────────────────────────────

  const selecionarVaga = (v: VagaRA) => {
    setVagaSel(v);
    carregarAlocacoes(v.id);
  };

  const abrirModalAlocar = () => {
    setCandAlocar(null);
    setBuscaAlocar('');
    setResultadosBusca([]);
    setDataInicioAlocar(dataHoje());
    setObsAlocar('');
    setErroAlocar('');
    setShowModalAlocar(true);
  };

  const handleAlocar = async () => {
    if (!vagaSel || !candAlocar || !dataInicioAlocar) { setErroAlocar('Selecione o cooperado e a data de início.'); return; }
    setAlocando(true);
    setErroAlocar('');
    try {
      await alocarCandidato(vagaSel.id, {
        candidatoId: candAlocar.id,
        unidadeId: vagaSel.unidade_id,
        empresaId: vagaSel.empresa_id,
        dataInicio: dataInicioAlocar,
        observacoes: obsAlocar || undefined,
      });
      showToast('Cooperado alocado com sucesso!', 'success');
      setShowModalAlocar(false);
      await carregarAlocacoes(vagaSel.id);
      await carregarVagas();
      await carregarMetricas();
    } catch (e: any) {
      setErroAlocar(e?.message ?? 'Erro ao alocar.');
    } finally { setAlocando(false); }
  };

  const handleEncerrarAlocacao = async (a: Alocacao) => {
    if (!window.confirm(`Encerrar alocação de "${a.candidato_nome}"?`)) return;
    try {
      await encerrarAlocacao(a.id, { dataFim: dataHoje() });
      showToast('Alocação encerrada.', 'success');
      if (vagaSel) await carregarAlocacoes(vagaSel.id);
      await carregarVagas();
      await carregarMetricas();
    } catch (e: any) {
      setErro(e?.message ?? 'Erro ao encerrar.');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const tomadoresOpcoes = [
    ...new Set([
      ...empresasTomadores.map((e) => e.nome_empresa).filter(Boolean),
      ...vagas.map((v) => v.nome_empresa).filter(Boolean),
    ]),
  ].sort();

  return (
    <div className="painel-page">
      {/* Cabeçalho */}
      <div className="painel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1>Módulo RA</h1>
          <p className="painel-subtitle">Gestão de Recursos Associados</p>
        </div>

        {/* Botão Ícone de Notificações no Canto Direito */}
        <button
          onClick={() => setShowModalNotificacoes(true)}
          title="Central de Notificações do RA"
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 44,
            height: 44,
            borderRadius: 12,
            border: alertasPendentes.length > 0 ? '1.5px solid #ffb74d' : '1px solid #d0d7de',
            background: alertasPendentes.length > 0 ? '#fff8e1' : '#ffffff',
            color: alertasPendentes.length > 0 ? '#e65100' : '#444',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: alertasPendentes.length > 0 ? '0 2px 10px rgba(230,81,0,0.18)' : '0 1px 3px rgba(0,0,0,0.06)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1.04)';
            e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.12)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(1)';
            e.currentTarget.style.boxShadow = alertasPendentes.length > 0 ? '0 2px 10px rgba(230,81,0,0.18)' : '0 1px 3px rgba(0,0,0,0.06)';
          }}
        >
          <IconBell size={22} />
          {alertasPendentes.length > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -5,
                right: -5,
                background: '#c62828',
                color: '#ffffff',
                borderRadius: 12,
                minWidth: 20,
                height: 20,
                padding: '0 5px',
                fontSize: 11,
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '2px solid #ffffff',
                boxShadow: '0 2px 6px rgba(198,40,40,0.4)',
                lineHeight: 1,
              }}
            >
              {alertasPendentes.length > 99 ? '99+' : alertasPendentes.length}
            </span>
          )}
        </button>
      </div>

      {erro && (
        <p style={{ fontSize: 13, padding: '8px 12px', marginBottom: 16, borderRadius: 6, background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAlert size={14} />{erro} <button onClick={() => setErro('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#c62828', marginLeft: 8 }}>×</button>
        </p>
      )}

      {/* Abas */}
      <div className="exec-abas" style={{ marginBottom: 24 }}>
        {(['dashboard', 'candidatos', ...(temPermissao('ra.vagas_visualizar') ? ['vagas'] : [])] as Aba[]).map((a) => (
          <button key={a} className={`exec-aba${aba === a ? ' exec-aba-ativa' : ''}`} onClick={() => setAba(a)}>
            {a === 'dashboard'
              ? <><IconChart size={15} style={{ marginRight: 6 }} />Dashboard</>
              : a === 'candidatos'
                ? <><IconUsers size={15} style={{ marginRight: 6 }} />Cooperados</>
                : <><IconBuilding size={15} style={{ marginRight: 6 }} />Vagas</>
            }
          </button>
        ))}
      </div>

      {/* ── ABA: DASHBOARD ──────────────────────────────────────────────── */}
      {aba === 'dashboard' && (
        <div>
          {carregandoMetricas && <p style={{ color: '#888', fontSize: 13 }}>Carregando...</p>}
          {metricas && (
            <>
              {/* KPIs — clique para filtrar lista abaixo; clique novamente para limpar */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: filtroDash ? 16 : 28 }}>
                {([
                  { label: 'Total de cooperados', valor: metricas.total_candidatos, cor: '#1565c0', bg: '#e3f2fd', id: 'total' },
                  { label: 'Pré-cadastro pendente', valor: metricas.pre_cadastro, cor: '#e65100', bg: '#fff8e1', id: 'pre_cadastro' },
                  { label: 'Cooperados aprovados', valor: metricas.ativos, cor: '#2e7d32', bg: '#e8f5e9', id: 'ativos' },
                  { label: 'Cooperados inativos', valor: metricas.inativos, cor: '#616161', bg: '#f5f5f5', id: 'inativos' },
                  { label: 'Cooperados desligados', valor: metricas.desligados || 0, cor: '#b71c1c', bg: '#ffebee', id: 'desligados' },
                  { label: 'Cooperados reprovados', valor: metricas.reprovados || 0, cor: '#c62828', bg: '#fbe9e7', id: 'reprovados' },
                  { label: 'Alocações ativas', valor: metricas.ativas, cor: '#6a1b9a', bg: '#f3e5f5', id: 'alocacoes' },
                  { label: 'Cooperados alocados', valor: metricas.candidatos_alocados, cor: '#00695c', bg: '#e0f2f1', id: 'alocados' },
                ] as { label: string; valor: number; cor: string; bg: string; id: FiltroDash }[]).map((kpi) => {
                  const ativo = filtroDash === kpi.id;
                  return (
                    <button
                      key={kpi.label}
                      onClick={() => aplicarFiltroDash(kpi.id)}
                      title={ativo ? 'Clique para limpar o filtro' : `Filtrar por ${kpi.label.toLowerCase()}`}
                      style={{
                        background: kpi.bg,
                        border: `${ativo ? '2px' : '1px'} solid ${ativo ? kpi.cor + '88' : kpi.cor + '22'}`,
                        borderRadius: 12, padding: '14px 16px',
                        cursor: 'pointer', textAlign: 'left', width: '100%',
                        transition: 'transform 0.1s, box-shadow 0.1s',
                        boxShadow: ativo ? `0 4px 14px ${kpi.cor}33` : undefined,
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = `0 4px 14px ${kpi.cor}44`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ativo ? `0 4px 14px ${kpi.cor}33` : ''; }}
                    >
                      <div style={{ fontSize: 24, fontWeight: 800, color: kpi.cor, lineHeight: 1 }}>{kpi.valor}</div>
                      <div style={{ fontSize: 11, color: '#555', marginTop: 6, fontWeight: 600 }}>{kpi.label}</div>
                      {ativo && <div style={{ fontSize: 10, color: kpi.cor, marginTop: 3, opacity: 0.8 }}>● filtro ativo</div>}
                    </button>
                  );
                })}
              </div>

              {/* Indicador de filtro ativo + botão limpar */}
              {filtroDash && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#555', marginBottom: 16 }}>
                  <span style={{ color: '#1976d2' }}>● Filtro ativo:</span>
                  <strong>
                    {filtroDash === 'total' ? 'Total de cooperados'
                      : filtroDash === 'pre_cadastro' ? 'Pré-cadastro pendente'
                        : filtroDash === 'ativos' ? 'Cooperados aprovados'
                          : filtroDash === 'inativos' ? 'Cooperados inativos'
                            : filtroDash === 'desligados' ? 'Cooperados desligados'
                              : filtroDash === 'reprovados' ? 'Cooperados reprovados'
                                : filtroDash === 'alocacoes' ? 'Alocações ativas'
                                  : 'Cooperados alocados'}
                  </strong>
                  <button onClick={() => aplicarFiltroDash(filtroDash)} style={{ fontSize: 11, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                    Limpar filtro
                  </button>
                </div>
              )}

              {/* Resultado do filtro */}
              {filtroDash && (
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '16px 20px', marginBottom: 28 }}>
                  {carregandoDash && <p style={{ color: '#888', fontSize: 13, margin: 0 }}>Carregando...</p>}
                  {!carregandoDash && candidatosDash.length === 0 && (
                    <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>Nenhum cooperado encontrado para este filtro.</p>
                  )}
                  {!carregandoDash && candidatosDash.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {candidatosDash.map((c) => {
                        const cor = COR_STATUS[c.status] ?? COR_STATUS[0];
                        const tipo = COR_TIPO[c.tipo_contratacao || 'externo'];
                        return (
                          <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#f9f9f9', border: '1px solid #f0f0f0' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 14, fontWeight: 600, color: '#222' }}>{c.nome}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 8, background: cor.bg, color: cor.color, border: `1px solid ${cor.color}33` }}>{cor.label}</span>
                                <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 8, background: tipo.bg, color: tipo.color, border: `1px solid ${tipo.color}33` }}>{tipo.label}</span>
                                {c.nota_avaliacao !== null && c.nota_avaliacao !== undefined && (
                                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 8, background: '#ede7f6', color: '#4527a0' }}>
                                    Nota: {Number(c.nota_avaliacao).toFixed(1)}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 3 }}>
                                <span style={{ fontSize: 12, color: '#777' }}>CPF: {formatarCPF(c.cpf)}</span>
                                <span style={{ fontSize: 12, color: '#777' }}>{c.cooperativa}</span>
                                {c.alocacoes_ativas > 0 && (
                                  <span style={{ fontSize: 12, color: '#2e7d32', fontWeight: 600 }}>
                                    <IconPin size={11} style={{ marginRight: 3 }} />{c.alocacoes_ativas} alocação{c.alocacoes_ativas > 1 ? 'ões' : ''} ativa{c.alocacoes_ativas > 1 ? 's' : ''}
                                  </span>
                                )}
                                {c.status === 2 && (
                                  <span style={{ fontSize: 12, color: '#616161', fontWeight: 600 }}>
                                    ⏸️ Inativo {c.inativado_em ? `em ${formatarDataBR(c.inativado_em)}` : ''} {c.inativado_por_nome ? `por ${c.inativado_por_nome}` : ''} {c.motivo_inativacao ? `(Motivo: ${c.motivo_inativacao})` : ''}
                                  </span>
                                )}
                                {c.status === 4 && (
                                  <span style={{ fontSize: 12, color: '#b71c1c', fontWeight: 600 }}>
                                    ⚠️ Desligado {c.data_desligamento ? `em ${formatarDataBR(c.data_desligamento)}` : c.inativado_em ? `em ${formatarDataBR(c.inativado_em)}` : ''} {c.inativado_por_nome ? `por ${c.inativado_por_nome}` : ''} {c.motivo_desligamento ? `(Motivo: ${c.motivo_desligamento})` : c.motivo_inativacao ? `(Motivo: ${c.motivo_inativacao})` : ''}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <button className="btn-secundario" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => abrirFicha(c)}>
                                Ver ficha
                              </button>
                              {ehAdmin && (
                                <button
                                  className="btn-secundario"
                                  style={{ fontSize: 11, padding: '4px 10px', background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2', display: 'flex', alignItems: 'center', gap: 4 }}
                                  onClick={() => setModalExcluir({ aberto: true, candidato: c, salvando: false })}
                                  title="Excluir cooperado permanentemente"
                                >
                                  <IconTrash size={11} />Excluir
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Top vagas */}
              {metricas.vagas_top && metricas.vagas_top.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px 24px' }}>
                  <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Vagas com maior ocupação
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {metricas.vagas_top.map((v) => (
                      <div key={v.id} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#333' }}>{v.cargo}</div>
                          <div style={{ fontSize: 12, color: '#777' }}>{v.nome_empresa} — {v.nome_unidade}</div>
                        </div>
                        <div style={{ width: 160, flexShrink: 0 }}>
                          <OcupacaoBar ocupadas={v.ocupadas} total={v.total_vagas} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── ABA: COOPERADOS ─────────────────────────────────────────────── */}
      {aba === 'candidatos' && (
        <div>
          {/* Filtros + botão novo */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input" style={{ flex: '1', minWidth: 200, maxWidth: 300, height: 38 }}
              placeholder="Buscar por nome, CPF ou matrícula..."
              value={filtroCandBusca}
              onChange={(e) => setFiltroCandBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregarCandidatos()}
            />
            <select className="form-input" style={{ width: 160, height: 38 }} value={filtroCandStatus} onChange={(e) => setFiltroCandStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="0">Pré-cadastro</option>
              <option value="1">Aprovados</option>
              <option value="2">Inativos</option>
              <option value="4">Desligados</option>
              <option value="3">Reprovados</option>
            </select>
            <select className="form-input" style={{ width: 150, height: 38 }} value={filtroCandTipo} onChange={(e) => setFiltroCandTipo(e.target.value)}>
              <option value="">Todos os tipos</option>
              <option value="externo">Externo</option>
              <option value="interno">Interno</option>
            </select>
            <IonButton size="small" shape="round" color="secondary" onClick={carregarCandidatos}><IconSearch size={14} style={{ marginRight: 5 }} />Buscar</IonButton>
            {temPermissao('ra.candidatos_criar') && (
              <IonButton size="small" shape="round" color="secondary" onClick={abrirNovoCandidato}><IconPlus size={14} style={{ marginRight: 5 }} />Novo cooperado</IonButton>
            )}
          </div>

          {carregandoCand && <p style={{ color: '#888', fontSize: 13 }}>Carregando...</p>}

          {/* Formulário de cadastro/edição */}
          {showFormCand && (
            <div style={{ background: '#f8faf8', border: '1px solid #d4e8d5', borderRadius: 12, padding: 20, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: '#2e6b32' }}>
                {editandoCand ? 'Editar cooperado' : 'Pré-cadastro de cooperado'}
              </h3>
              <div className="form-row">
                <div className="form-field">
                  <label>Nome completo *</label>
                  <input className="form-input" value={formCand.nome} onChange={(e) => handleNomeCandChange(e.target.value)} />
                  {nomesParecidos.length > 0 && (
                    <div className="form-alerta">
                      Atenção: já existe(m) cooperado(s) com nome parecido:
                      <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                        {nomesParecidos.map((c) => (
                          <li key={c.id}>
                            {c.nome} — CPF: {formatarCPF(c.cpf)}
                            {c.matricula ? ` · Matrícula: ${c.matricula}` : ' · Pré-cadastro'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="form-field">
                  <label>CPF *</label>
                  <input
                    className="form-input"
                    value={formCand.cpf}
                    placeholder="000.000.000-00"
                    onChange={(e) => handleCpfCandChange(e.target.value)}
                    disabled={!!editandoCand}
                    style={(!editandoCand && (cpfInvalido || cpfDuplicado)) ? { borderColor: '#e53935' } : undefined}
                  />
                  {!editandoCand && cpfInvalido && (
                    <div className="form-alerta" style={{ color: '#c62828' }}>CPF inválido. Verifique os dígitos.</div>
                  )}
                  {!editandoCand && cpfDuplicado && !cpfInvalido && (
                    <div className="form-alerta">
                      Já existe um cooperado com este CPF: <strong>{cpfDuplicado.nome}</strong>
                      {cpfDuplicado.matricula ? ` (${cpfDuplicado.matricula})` : ' (pré-cadastro)'}.
                    </div>
                  )}
                </div>
                <div className="form-field">
                  <label>Tipo de Contratação *</label>
                  <select
                    className="form-input"
                    value={formCand.tipo_contratacao ?? 'externo'}
                    onChange={(e) => setFormCand((p) => ({ ...p, tipo_contratacao: e.target.value as TipoContratacao }))}
                  >
                    <option value="externo">Externo</option>
                    <option value="interno">Interno</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Cooperativa</label>
                  <input className="form-input" value="ATESA" readOnly style={{ background: '#f5f5f5', color: '#555' }} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>E-mail</label>
                  <input className="form-input" type="email" value={formCand.email} onChange={(e) => setFormCand((p) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="form-field">
                  <label>Telefone</label>
                  <input className="form-input" type="tel" placeholder="(00) 00000-0000" value={formCand.telefone} onChange={(e) => setFormCand((p) => ({ ...p, telefone: formatarTelefone(e.target.value) }))} />
                </div>
                <div className="form-field">
                  <label>WhatsApp</label>
                  <input className="form-input" type="tel" placeholder="(00) 00000-0000" value={formCand.whatsapp ?? ''} onChange={(e) => setFormCand((p) => ({ ...p, whatsapp: formatarTelefone(e.target.value) }))} />
                </div>
                <div className="form-field">
                  <label>Observações</label>
                  <input className="form-input" value={formCand.observacoes} onChange={(e) => setFormCand((p) => ({ ...p, observacoes: e.target.value }))} />
                </div>
              </div>
              {erroForm && <p className="form-erro">{erroForm}</p>}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <IonButton size="small" shape="round" color="secondary" onClick={handleSalvarCandidato} disabled={salvandoCand}>
                  {salvandoCand ? 'Salvando...' : 'Salvar'}
                </IonButton>
                <IonButton size="small" shape="round" fill="outline" onClick={() => setShowFormCand(false)}>Cancelar</IonButton>
              </div>
            </div>
          )}

          {/* Lista de cooperados */}
          <div className="painel-lista">
            {candidatos.length === 0 && !carregandoCand && (
              <div className="painel-vazio">Nenhum cooperado encontrado.</div>
            )}
            {candidatos.map((c) => {
              const cor = COR_STATUS[c.status] ?? COR_STATUS[0];
              const tipo = COR_TIPO[c.tipo_contratacao || 'externo'];
              const isPre = c.status === 0;
              const isAtivo = c.status === 1;
              const isInativo = c.status === 2;
              const isReprovado = c.status === 3;
              const isDesligado = c.status === 4;

              return (
                <div key={c.id} className="painel-card" style={{ cursor: 'default', opacity: (isInativo || isDesligado) ? 0.8 : 1 }}>
                  <div className="painel-card-info" style={{ flex: 1 }}>
                    <div className="painel-card-titulo">
                      <h3 style={{ fontSize: 15 }}>{c.nome}</h3>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: cor.bg, color: cor.color, border: `1px solid ${cor.color}33` }}>
                        {cor.label}
                      </span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: tipo.bg, color: tipo.color, border: `1px solid ${tipo.color}33` }}>
                        {tipo.label}
                      </span>
                      {c.nota_avaliacao !== null && c.nota_avaliacao !== undefined && (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: '#ede7f6', color: '#4527a0', border: '1px solid #d1c4e9' }}>
                          Nota: {Number(c.nota_avaliacao).toFixed(1)}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', marginTop: 4 }}>
                      <p className="painel-detalhe">CPF: {formatarCPF(c.cpf)}</p>
                      <p className="painel-detalhe">Cooperativa: {c.cooperativa}</p>
                      {c.email && <p className="painel-detalhe"><IconMail size={12} style={{ marginRight: 4 }} />{c.email}</p>}
                      {c.telefone && <p className="painel-detalhe"><IconPhone size={12} style={{ marginRight: 4 }} />{formatarTelefone(c.telefone)}</p>}
                      {c.alocacoes_ativas > 0 && (
                        <p className="painel-detalhe" style={{ color: '#2e7d32', fontWeight: 600 }}>
                          <IconPin size={12} style={{ marginRight: 4 }} />{c.alocacoes_ativas} alocação{c.alocacoes_ativas > 1 ? 'ões' : ''} ativa{c.alocacoes_ativas > 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                    {c.avaliado_em && (
                      <p className="painel-detalhe" style={{ fontSize: 11, marginTop: 2, color: '#555' }}>
                        Avaliado em {formatarDataBR(c.avaliado_em)}{c.avaliado_por_nome ? ` por ${c.avaliado_por_nome}` : ''}{c.observacao_avaliacao ? ` · Obs: ${c.observacao_avaliacao}` : ''}
                      </p>
                    )}
                    {isInativo && c.inativado_em && (
                      <p className="painel-detalhe" style={{ fontSize: 11, marginTop: 2, color: '#616161' }}>
                        Inativado em {formatarDataBR(c.inativado_em)}{c.inativado_por_nome ? ` por ${c.inativado_por_nome}` : ''}{c.motivo_inativacao ? ` · Motivo: ${c.motivo_inativacao}` : ''}
                      </p>
                    )}
                    {isDesligado && (
                      <p className="painel-detalhe" style={{ fontSize: 11, marginTop: 2, color: '#b71c1c' }}>
                        Desligado {c.data_desligamento ? `em ${formatarDataBR(c.data_desligamento)}` : c.inativado_em ? `em ${formatarDataBR(c.inativado_em)}` : ''}{c.inativado_por_nome ? ` por ${c.inativado_por_nome}` : ''}{c.motivo_desligamento ? ` · Motivo: ${c.motivo_desligamento}` : c.motivo_inativacao ? ` · Motivo: ${c.motivo_inativacao}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="painel-card-acoes" style={{ gap: 6, flexDirection: 'column', alignItems: 'stretch' }}>
                    <button className="btn-secundario" style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5, background: '#e3f2fd', color: '#1565c0' }} onClick={() => abrirFicha(c)}>
                      <IconUsers size={13} />Ficha completa
                    </button>
                    {temPermissao('ra.candidatos_criar') && (
                      <button className="btn-secundario" style={{ fontSize: 12, padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => abrirEditarCandidato(c)}>
                        <IconEdit size={13} />Editar
                      </button>
                    )}

                    {/* Ações de Avaliação / Status */}
                    {isPre && temPermissao('ra.candidatos_avaliar') && (
                      <>
                        <button
                          className="btn-secundario"
                          style={{ fontSize: 12, padding: '5px 12px', background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 5 }}
                          onClick={() => abrirModalAvaliacao(c, '8.0')}
                        >
                          <IconCheck size={13} />Aprovar
                        </button>
                        <button
                          className="btn-secundario"
                          style={{ fontSize: 12, padding: '5px 12px', background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', gap: 5 }}
                          onClick={() => abrirModalAvaliacao(c, '5.0')}
                        >
                          <IconX size={13} />Reprovar
                        </button>
                      </>
                    )}

                    {isReprovado && temPermissao('ra.candidatos_avaliar') && (
                      <button
                        className="btn-secundario"
                        style={{ fontSize: 12, padding: '5px 12px', background: '#ede7f6', color: '#512da8', display: 'flex', alignItems: 'center', gap: 5 }}
                        onClick={() => abrirModalAvaliacao(c, '')}
                      >
                        <IconEdit size={13} />Reavaliar / Nova Prova
                      </button>
                    )}

                    {isAtivo && temPermissao('ra.candidatos_inativar') && (
                      <button className="btn-secundario" style={{ fontSize: 12, padding: '5px 12px', background: '#f5f5f5', color: '#616161', display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => handleAbrirInativar(c)}>
                        <IconX size={13} />Inativar
                      </button>
                    )}

                    {(isInativo || isDesligado) && temPermissao('ra.candidatos_inativar') && (
                      <button className="btn-secundario" style={{ fontSize: 12, padding: '5px 12px', background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => handleReativar(c)}>
                        <IconCheck size={13} />{isDesligado ? 'Recontratar / Reativar' : 'Reativar'}
                      </button>
                    )}

                    {/* Botão Excluir exclusivo para Administrador */}
                    {ehAdmin && (
                      <button
                        className="btn-secundario"
                        style={{ fontSize: 12, padding: '5px 12px', background: '#ffebee', color: '#c62828', display: 'flex', alignItems: 'center', gap: 5, border: '1px solid #ffcdd2' }}
                        onClick={() => setModalExcluir({ aberto: true, candidato: c, salvando: false })}
                        title="Excluir cooperado permanentemente"
                      >
                        <IconTrash size={13} />Excluir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ABA: VAGAS & ALOCAÇÃO ───────────────────────────────────────── */}
      {aba === 'vagas' && (
        <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

          {/* Coluna esquerda: lista de vagas */}
          <div style={{ flex: '0 0 380px', minWidth: 0 }}>
            {/* Filtros */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
              <input
                className="form-input"
                style={{ height: 36 }}
                placeholder="Filtrar por cargo..."
                value={filtroVagaCargo}
                onChange={(e) => setFiltroVagaCargo(e.target.value)}
              />
              <select
                className="form-input"
                style={{ height: 36 }}
                value={filtroVagaTomador}
                onChange={(e) => setFiltroVagaTomador(e.target.value)}
              >
                <option value="">Filtrar tomador (Todos)</option>
                {tomadoresOpcoes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
              <select
                className="form-input"
                style={{ height: 36 }}
                value={filtroVagaStatus}
                onChange={(e) => setFiltroVagaStatus(e.target.value as any)}
              >
                <option value="abertas">Vagas Abertas</option>
                <option value="fechadas">Vagas Fechadas</option>
                <option value="todas">Todas as Vagas</option>
              </select>
              <IonButton size="small" shape="round" color="secondary" onClick={carregarVagas}><IconSearch size={14} style={{ marginRight: 5 }} />Filtrar</IonButton>
            </div>

            {carregandoVagas && <p style={{ color: '#888', fontSize: 13 }}>Carregando vagas...</p>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {vagas.length === 0 && !carregandoVagas && (
                <div className="painel-vazio" style={{ fontSize: 13 }}>Nenhuma vaga encontrada para os filtros selecionados.</div>
              )}
              {vagas.map((v) => {
                const selecionada = vagaSel?.id === v.id;
                const livre = v.vagas_livres > 0;
                const isFechada = !v.ativa || v.ativa === 0;
                return (
                  <div
                    key={v.id}
                    onClick={() => selecionarVaga(v)}
                    style={{
                      background: '#fff', border: `2px solid ${selecionada ? '#4a9e4f' : '#e0e0e0'}`,
                      borderRadius: 10, padding: '12px 16px', cursor: 'pointer',
                      boxShadow: selecionada ? '0 2px 12px rgba(74,158,79,0.15)' : '0 1px 4px rgba(0,0,0,0.05)',
                      transition: 'border 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 6 }}>
                          {v.cargo}
                          {isFechada && (
                            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 4, background: '#ffebee', color: '#c62828', border: '1px solid #ffcdd2' }}>
                              Fechada
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{v.nome_empresa}</div>
                        <div style={{ fontSize: 11, color: '#999' }}>{v.nome_unidade}</div>
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 8, background: isFechada ? '#f5f5f5' : (livre ? '#e8f5e9' : '#fce4ec'), color: isFechada ? '#757575' : (livre ? '#2e7d32' : '#c62828'), flexShrink: 0 }}>
                        {isFechada ? 'Fechada' : `${v.vagas_livres} livre${v.vagas_livres !== 1 ? 's' : ''}`}
                      </span>
                    </div>
                    <OcupacaoBar ocupadas={v.ocupadas} total={v.total_vagas} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Coluna direita: detalhe da vaga */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {!vagaSel && (
              <div className="painel-vazio" style={{ marginTop: 0 }}>
                ← Selecione uma vaga para ver os detalhes
              </div>
            )}

            {vagaSel && (() => {
              const vagaFechada = !vagaSel.ativa || vagaSel.ativa === 0;
              return (
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px 24px' }}>
                {/* Cabeçalho da vaga */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <h2 style={{ margin: '0', fontSize: 18, color: '#1a1a1a', fontWeight: 800 }}>{vagaSel.cargo}</h2>
                      {vagaSel.cbo && (
                        <span style={{ fontSize: 11, background: '#f0f4f8', color: '#1565c0', padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>
                          CBO: {vagaSel.cbo}
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: 13, color: '#555' }}>{vagaSel.nome_empresa} — {vagaSel.nome_unidade}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 14,
                      background: vagaFechada ? '#ffebee' : (vagaSel.vagas_livres === 0 ? '#e8f5e9' : '#fff8e1'),
                      color: vagaFechada ? '#c62828' : (vagaSel.vagas_livres === 0 ? '#2e7d32' : '#e65100'),
                      border: `1px solid ${vagaFechada ? '#ef9a9a' : (vagaSel.vagas_livres === 0 ? '#a5d6a7' : '#ffe082')}`,
                    }}>
                      {vagaFechada ? '🔒 Vaga Fechada' : (vagaSel.vagas_livres === 0 ? '✓ Vaga Preenchida' : '● Vaga em Aberto')}
                    </span>

                    {/* Botão de Fechar / Reabrir Vaga */}
                    {!vagaFechada ? (
                      <button
                        className="btn-secundario"
                        style={{
                          background: '#ffebee',
                          border: '1px solid #ef9a9a',
                          color: '#c62828',
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '6px 14px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onClick={() => setModalFecharVaga({ aberto: true, vaga: vagaSel, ativa: false, motivo: '', salvando: false })}
                      >
                        <IconX size={13} /> Fechar Vaga
                      </button>
                    ) : (
                      <button
                        className="btn-secundario"
                        style={{
                          background: '#e8f5e9',
                          border: '1px solid #a5d6a7',
                          color: '#2e7d32',
                          fontWeight: 700,
                          fontSize: 12,
                          padding: '6px 14px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                        onClick={() => setModalFecharVaga({ aberto: true, vaga: vagaSel, ativa: true, motivo: '', salvando: false })}
                      >
                        <IconCheck size={13} /> Reabrir Vaga
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, background: '#fbfcfb', border: '1px solid #eef2ee', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#777', display: 'block' }}>Total de Vagas</span>
                    <strong style={{ fontSize: 16, color: '#222' }}>{vagaSel.total_vagas}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#777', display: 'block' }}>Ocupadas</span>
                    <strong style={{ fontSize: 16, color: '#2e7d32' }}>{vagaSel.ocupadas}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#777', display: 'block' }}>Vagas Livres</span>
                    <strong style={{ fontSize: 16, color: vagaSel.vagas_livres > 0 ? '#1565c0' : '#c62828' }}>{vagaSel.vagas_livres}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#777', display: 'block' }}>Salário Base</span>
                    <strong style={{ fontSize: 14, color: '#2e6b32' }}>{vagaSel.salario_base ? formatarMoeda(vagaSel.salario_base) : '—'}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: '#777', display: 'block' }}>Escala / Regime</span>
                    <strong style={{ fontSize: 13, color: '#444' }}>{vagaSel.tipo_escala ?? '12x36'}</strong>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                    <span style={{ color: '#555', fontWeight: 600 }}>Ocupação do Quadro da Vaga:</span>
                    <strong style={{ color: '#2e7d32' }}>
                      {Math.round((vagaSel.ocupadas / (vagaSel.total_vagas || 1)) * 100)}%
                    </strong>
                  </div>
                  <OcupacaoBar ocupadas={vagaSel.ocupadas} total={vagaSel.total_vagas} />
                </div>

                {/* Nota informativa de responsabilidade do RA vs Benefícios */}
                <div style={{ background: '#f4f8f4', border: '1px solid #c8e6c9', borderRadius: 8, padding: '12px 16px', color: '#2e7d32', fontSize: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IconCheck size={18} style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Ficha de Vagas — Recrutamento & Admissão (RA)</strong><br />
                    <span style={{ color: '#555', fontSize: 11 }}>
                      O RA controla a abertura, quadro de vagas e fechamento da requisição. A alocação individual e parametrização dos benefícios é executada no Módulo de Benefícios.
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {/* ── Modal: Avaliação / Nota do Cooperado ───────────────────────────── */}
      {modalAvaliacao.aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '26px 30px', width: 460, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1a1a1a' }}>
                Avaliação do Cooperado
              </h3>
              <button
                onClick={() => setModalAvaliacao({ aberto: false, candidato: null, nota: '', observacao: '', salvando: false })}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa', padding: 0 }}
              >×</button>
            </div>

            <p style={{ fontSize: 13, color: '#444', margin: '0 0 16px' }}>
              Cooperado: <strong>{modalAvaliacao.candidato?.nome}</strong>
            </p>

            <div className="form-field" style={{ marginBottom: 14 }}>
              <label>Nota da Prova / Avaliação (0.0 a 10.0) *</label>
              <input
                className="form-input"
                type="number"
                step="0.1"
                min="0"
                max="10"
                placeholder="Ex: 8.5"
                value={modalAvaliacao.nota}
                onChange={(e) => setModalAvaliacao((p) => ({ ...p, nota: e.target.value }))}
                style={{ fontSize: 16, fontWeight: 700, width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Resultado prévio com base na nota digitada */}
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

            <div className="form-field" style={{ marginBottom: 18 }}>
              <label>Observações / Parecer da Prova (opcional)</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Ex: Bom desempenho em raciocínio lógico e conhecimentos gerais..."
                value={modalAvaliacao.observacao}
                onChange={(e) => setModalAvaliacao((p) => ({ ...p, observacao: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <IonButton
                shape="round"
                fill="outline"
                onClick={() => setModalAvaliacao({ aberto: false, candidato: null, nota: '', observacao: '', salvando: false })}
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
      {modalInativar.aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: 440, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, color: '#c62828', fontWeight: 700 }}>
              Inativar cooperado
            </h3>
            <p style={{ fontSize: 13, color: '#444', margin: '0 0 16px', lineHeight: 1.4 }}>
              Tem certeza que deseja inativar <strong>{modalInativar.candidato?.nome}</strong>? O cooperado não poderá receber novas alocações enquanto estiver inativo.
            </p>
            <div className="form-field" style={{ marginBottom: 16 }}>
              <label>Motivo da inativação (opcional)</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Ex: Desligamento a pedido, encerramento de contrato..."
                value={modalInativar.motivo}
                onChange={(e) => setModalInativar((p) => ({ ...p, motivo: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <IonButton shape="round" fill="outline" onClick={() => setModalInativar({ aberto: false, candidato: null, motivo: '', salvando: false })}>
                Cancelar
              </IonButton>
              <IonButton shape="round" color="danger" onClick={handleConfirmarInativar} disabled={modalInativar.salvando}>
                {modalInativar.salvando ? 'Inativando...' : 'Confirmar Inativação'}
              </IonButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Excluir cooperado (Administrador) ────────────────────── */}
      {modalExcluir.aberto && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '24px 28px', width: 460, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 21, background: '#ffebee', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#c62828', flexShrink: 0 }}>
                <IconTrash size={22} />
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: '#c62828', fontWeight: 700 }}>
                  Excluir Cooperado
                </h3>
                <span style={{ fontSize: 12, color: '#777' }}>Ação exclusiva de Administrador</span>
              </div>
            </div>

            <p style={{ fontSize: 13, color: '#444', margin: '0 0 14px', lineHeight: 1.5 }}>
              Tem certeza que deseja excluir o cooperado <strong>{modalExcluir.candidato?.nome}</strong>{modalExcluir.candidato?.cpf ? ` (CPF: ${formatarCPF(modalExcluir.candidato.cpf)})` : ''}?
            </p>

            <div style={{ background: '#fff3e0', border: '1px solid #ffe0b2', borderRadius: 8, padding: '10px 14px', marginBottom: 18, fontSize: 12, color: '#e65100', lineHeight: 1.4 }}>
              ⚠️ <strong>Atenção:</strong> Esta ação é <strong>irreversível</strong> e removerá todos os dados pessoais, documentos, dados bancários e histórico vinculados a este cooperado.
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <IonButton shape="round" fill="outline" onClick={() => setModalExcluir({ aberto: false, candidato: null, salvando: false })} disabled={modalExcluir.salvando}>
                Cancelar
              </IonButton>
              <IonButton shape="round" color="danger" onClick={handleConfirmarExcluir} disabled={modalExcluir.salvando}>
                {modalExcluir.salvando ? 'Excluindo...' : 'Confirmar Exclusão'}
              </IonButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Ficha completa do cooperado ──────────────────────────────────── */}
      {verDetalhe && (
        <div
          onClick={() => setVerDetalhe(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '28px 16px 48px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 940 }}>
            <CandidatoDetalhe
              candidato={verDetalhe.candidato}
              alocacoes={verDetalhe.alocacoes}
              abaInicial={verDetalhe.abaInicial}
              onVoltar={() => setVerDetalhe(null)}
              onAtualizado={() => { carregarCandidatos(); carregarMetricas(); carregarAlertasPendentes(); }}
            />
          </div>
        </div>
      )}

      {/* ── Modal: Alocar cooperado ─────────────────────────────────────── */}
      {showModalAlocar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', width: 480, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ margin: 0, fontSize: 17 }}>Alocar cooperado</h2>
              <button onClick={() => setShowModalAlocar(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb' }}>×</button>
            </div>

            <p style={{ margin: '0 0 16px', fontSize: 13, color: '#555' }}>
              Vaga: <strong>{vagaSel?.cargo}</strong> — {vagaSel?.nome_empresa}
            </p>

            {/* Busca de cooperado */}
            <div className="form-field">
              <label>Buscar cooperado (nome, CPF, matrícula ou aptidão/qualificação) *</label>
              <input
                className="form-input"
                placeholder="Digite nome, CPF, matrícula ou aptidão..."
                value={buscaAlocar}
                onChange={(e) => { setBuscaAlocar(e.target.value); setCandAlocar(null); }}
              />
              {buscando && <span className="form-hint">Buscando...</span>}
            </div>

            {/* Resultados da busca */}
            {resultadosBusca.length > 0 && !candAlocar && (
              <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden', marginBottom: 12, maxHeight: 180, overflowY: 'auto' }}>
                {resultadosBusca.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setCandAlocar(r); setBuscaAlocar(r.nome); setResultadosBusca([]); }}
                    style={{ display: 'block', width: '100%', padding: '10px 14px', textAlign: 'left', background: 'none', border: 'none', borderBottom: '1px solid #f0f0f0', cursor: 'pointer', fontSize: 13 }}
                  >
                    <div>
                      <strong>{r.nome}</strong>
                      <span style={{ color: '#777', marginLeft: 10 }}>{formatarCPF(r.cpf)}</span>
                      {r.matricula && <span style={{ color: '#1565c0', marginLeft: 10, fontSize: 11 }}>{r.matricula}</span>}
                    </div>
                    {r.qualificacoes && (
                      <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {r.qualificacoes.split(',').map((q, idx) => (
                          <span key={idx} style={{ background: '#e3f2fd', color: '#1565c0', borderRadius: 4, padding: '2px 6px', fontSize: 10, fontWeight: 600 }}>
                            {q.trim()}
                          </span>
                        ))}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {candAlocar && (
              <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '10px 12px', marginBottom: 12, fontSize: 13, color: '#2e7d32' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconCheck size={14} />Selecionado: <strong>{candAlocar.nome}</strong>
                  {candAlocar.matricula && <span style={{ marginLeft: 8, color: '#1565c0', fontWeight: 600 }}>Matrícula: {candAlocar.matricula}</span>}
                </div>
                {candAlocar.qualificacoes && (
                  <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#2e7d32' }}>Aptidões:</span>
                    {candAlocar.qualificacoes.split(',').map((q, idx) => (
                      <span key={idx} style={{ background: '#c8e6c9', color: '#1b5e20', borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 600 }}>
                        {q.trim()}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-field">
                <label>Data de início *</label>
                <input className="form-input" type="date" value={dataInicioAlocar} onChange={(e) => setDataInicioAlocar(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Observações</label>
                <input className="form-input" value={obsAlocar} onChange={(e) => setObsAlocar(e.target.value)} />
              </div>
            </div>

            {erroAlocar && <p className="form-erro" style={{ marginBottom: 12 }}>{erroAlocar}</p>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <IonButton shape="round" fill="outline" onClick={() => setShowModalAlocar(false)}>Cancelar</IonButton>
              <IonButton shape="round" color="secondary" onClick={handleAlocar} disabled={alocando || !candAlocar}>
                {alocando ? 'Alocando...' : 'Confirmar alocação'}
              </IonButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Fechar / Reabrir Vaga ──────────────────────────────────── */}
      {modalFecharVaga.aberto && modalFecharVaga.vaga && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '26px 30px', width: 480, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: modalFecharVaga.ativa ? '#2e7d32' : '#c62828' }}>
                {modalFecharVaga.ativa ? 'Reabrir Vaga' : 'Fechar / Encerrar Vaga'}
              </h3>
              <button
                onClick={() => setModalFecharVaga({ aberto: false, vaga: null, ativa: false, motivo: '', salvando: false })}
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa', padding: 0 }}
              >×</button>
            </div>

            <div style={{ background: '#f9fbf9', border: '1px solid #e5ebe5', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
              <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 700, color: '#1a1a1a' }}>
                {modalFecharVaga.vaga.cargo}
              </p>
              <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                {modalFecharVaga.vaga.nome_empresa} — {modalFecharVaga.vaga.nome_unidade}
              </p>
            </div>

            <p style={{ fontSize: 13, color: '#444', lineHeight: 1.5, marginBottom: 16 }}>
              {modalFecharVaga.ativa ? (
                <>Você está prestes a <strong>reabrir</strong> esta vaga no sistema para novas alocações e processos seletivos.</>
              ) : (
                <>Você está prestes a <strong>fechar</strong> esta vaga. Ela deixará de receber novas alocações até ser reaberta.</>
              )}
            </p>

            <div className="form-field" style={{ marginBottom: 20 }}>
              <label>Motivo ou Observação (opcional)</label>
              <textarea
                className="form-input"
                style={{ minHeight: 70, resize: 'vertical' }}
                placeholder={modalFecharVaga.ativa ? 'Ex: Reabertura solicitada pelo cliente...' : 'Ex: Vaga preenchida / Concluído processo seletivo...'}
                value={modalFecharVaga.motivo}
                onChange={(e) => setModalFecharVaga((prev) => ({ ...prev, motivo: e.target.value }))}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <IonButton
                shape="round"
                fill="outline"
                disabled={modalFecharVaga.salvando}
                onClick={() => setModalFecharVaga({ aberto: false, vaga: null, ativa: false, motivo: '', salvando: false })}
              >
                Cancelar
              </IonButton>
              <IonButton
                shape="round"
                color={modalFecharVaga.ativa ? 'secondary' : 'danger'}
                disabled={modalFecharVaga.salvando}
                onClick={handleConfirmarFecharVaga}
              >
                {modalFecharVaga.salvando ? 'Salvando...' : (modalFecharVaga.ativa ? 'Confirmar Reabertura' : 'Confirmar Fechamento')}
              </IonButton>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Central de Notificações do RA ─────────────────────────── */}
      {showModalNotificacoes && (
        <div
          onClick={() => setShowModalNotificacoes(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            backdropFilter: 'blur(2px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 16,
              width: 580,
              maxWidth: '95vw',
              maxHeight: '85vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 12px 40px rgba(0,0,0,0.22)',
              border: '1px solid #e0e0e0',
              overflow: 'hidden',
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '18px 24px',
                background: '#fafafa',
                borderBottom: '1px solid #eaeaea',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 36,
                    height: 36,
                    borderRadius: 10,
                    background: '#fff3e0',
                    color: '#e65100',
                  }}
                >
                  <IconBell size={20} />
                </span>
                <div>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 8 }}>
                    Notificações do Sistema
                    {alertasPendentes.length > 0 ? (
                      <span style={{ fontSize: 11, background: '#c62828', color: '#fff', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                        {alertasPendentes.length} pendente(s)
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>
                        Tudo lido ✓
                      </span>
                    )}
                  </h2>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#666' }}>
                    Alertas de atualização de documentos, cadastros e validações pendentes
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowModalNotificacoes(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 22,
                  cursor: 'pointer',
                  color: '#888',
                  padding: 4,
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* Modal Content - List */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', maxHeight: 'calc(80vh - 130px)' }}>
              {alertasPendentes.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '30px 20px', color: '#888' }}>
                  <IconCheck size={36} style={{ color: '#4caf50' }} />
                  <p style={{ marginTop: 10, fontSize: 14, fontWeight: 500 }}>Nenhuma notificação pendente no momento.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {alertasPendentes.map((alerta) => (
                    <div
                      key={alerta.id}
                      style={{
                        background: '#ffffff',
                        border: '1px solid #ffe0b2',
                        borderRadius: 10,
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 12,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 240 }}>
                        <span
                          style={{
                            marginTop: 2,
                            color: alerta.tipo === 'documento_validado' ? '#2e7d32' : alerta.tipo === 'documento_rejeitado' ? '#c62828' : '#e65100',
                          }}
                        >
                          {alerta.tipo.startsWith('documento_') ? <IconFile size={18} /> : <IconBell size={18} />}
                        </span>
                        <div>
                          <div style={{ fontSize: 13, color: '#222', fontWeight: 600, lineHeight: 1.4 }}>
                            {alerta.mensagem}
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
                            {alerta.candidato_nome && <strong style={{ color: '#444' }}>{alerta.candidato_nome} </strong>}
                            {alerta.matricula && ` · Matrícula: ${alerta.matricula} `}
                            · {new Date(alerta.criado_em).toLocaleString('pt-BR')}
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <button
                          onClick={() => abrirFichaDoc(alerta)}
                          style={{
                            background: '#e8f5e9',
                            border: '1px solid #a5d6a7',
                            color: '#2e7d32',
                            borderRadius: 6,
                            padding: '6px 10px',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          Visualizar
                        </button>
                        <button
                          onClick={() => handleMarcarAlertaLido(alerta.id)}
                          title="Marcar como lida"
                          style={{
                            background: '#f5f5f5',
                            border: '1px solid #e0e0e0',
                            color: '#666',
                            borderRadius: 6,
                            padding: '6px 8px',
                            fontSize: 12,
                            cursor: 'pointer',
                          }}
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '12px 20px',
                background: '#fafafa',
                borderTop: '1px solid #eaeaea',
              }}
            >
              {alertasPendentes.length > 0 ? (
                <button
                  onClick={handleMarcarTodosAlertasLidos}
                  style={{
                    background: '#fff',
                    border: '1px solid #ffb74d',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    color: '#bf360c',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <IconCheck size={14} /> Marcar todas como lidas
                </button>
              ) : <div />}

              <IonButton
                size="small"
                shape="round"
                fill="outline"
                onClick={() => setShowModalNotificacoes(false)}
              >
                Fechar
              </IonButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Ra;
