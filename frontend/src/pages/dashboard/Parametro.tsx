import React, { useEffect, useState } from 'react';
import { IonButton, IonModal, useIonViewWillEnter } from '@ionic/react';
import {
  EmpresaResumoParametro,
  EmpresaDetalheParametro,
  UnidadeParametro,
  VagaParametro,
  LogAcao,
  Incremento,
  AgendaItem,
  AtividadePrimaria,
  NovaVaga,
  TipoEscalaParam,
  TipoInsalubridadeParam,
  PeriodicidadeParam,
  StatusAgendaParam,
  ROTULO_PERIODICIDADE,
  ROTULO_INSALUBRIDADE,
  ROTULO_ESCALA,
  listarEmpresasParametro,
  obterEmpresaParametro,
  alterarStatusEmpresaParametro,
  listarLogEmpresa,
  criarUnidade,
  atualizarUnidade,
  alternarAtivacaoUnidade,
  criarVaga,
  atualizarVaga,
  registrarIncremento,
  listarIncrementos,
  alternarAtivacaoVaga,
  listarAgendaVaga,
  atualizarStatusAgenda,
  regerarAgendaVaga,
  listarAtividadesPrimarias,
} from '../../api/parametroApi';
import { buscarEnderecoPorCep, formatarCEP, formatarCNPJ, formatarCPF, formatarDataBR, formatarMoeda, formatarTelefone, dataHoje } from '../../utils/formatters';
import { IconEdit, IconCalendar, IconMail, IconPhone, IconMapPin, IconUser, IconAlert, IconTarget, IconSettings, IconClipboard, IconSearch, IconBuilding, IconDownload } from '../../components/Icons';
import { usePermissoes } from '../../auth/PermissoesContext';

const STATUS_COR: Record<string, { bg: string; color: string }> = {
  Ativo: { bg: '#e8f5e9', color: '#2e7d32' },
  Inativo: { bg: '#fce4ec', color: '#c62828' },
  Cadastrado: { bg: '#e3f2fd', color: '#1565c0' },
  Suspenso: { bg: '#fff8e1', color: '#e65100' },
  'Primeiro Contato': { bg: '#f3e5f5', color: '#6a1b9a' },
  'Visita Realizada': { bg: '#e8eaf6', color: '#283593' },
  'Proposta Enviada': { bg: '#fff3e0', color: '#e65100' },
  'Em Negociação': { bg: '#fce4ec', color: '#880e4f' },
  'Negócio Fechado': { bg: '#e8f5e9', color: '#1b5e20' },
  'Negócio Perdido': { bg: '#efebe9', color: '#4e342e' },
};

const ROTULO_ACAO: Record<string, string> = {
  criar_unidade: '+ Ficha criada',
  editar_unidade: '✎ Ficha editada',
  ativar_unidade: '▶ Ficha ativada',
  inativar_unidade: '⏸ Ficha inativada',
  criar_vaga: '+ Vaga criada',
  editar_vaga: '✎ Vaga editada',
  ativar_vaga: '▶ Vaga ativada',
  inativar_vaga: '⏸ Vaga inativada',
  incremento_vaga: '↕ Incremento de vaga',
  alterar_status_empresa: '⚙ Status alterado',
};

// ── Formulário de Vaga ───────────────────────────────────────────────────────

const VAGA_VAZIA: NovaVaga = {
  cargo: '',
  cbo: '',
  quantidade: 1,
  salarioBase: undefined,
  tipoEscala: 'plantao',
  adicionalNoturno: false,
  periculosidade: false,
  insalubridade: 'sem_risco',
  premioIncentivo: 0,
  valorVrDia: 0,
  valorVtDia: 0,
  dsrPercentual: 16.67,
  periodicidade: 'mensal',
  tempoPausa: undefined,
  tempoRefeicao: undefined,
  descontaPausa: false,
  descontaRefeicao: false,
  recebePor: 'mes',
  dataInicio: dataHoje(),
};

function vagaParaForm(v: VagaParametro): NovaVaga {
  return {
    cargo: v.cargo,
    cbo: v.cbo ?? '',
    quantidade: v.quantidade,
    salarioBase: v.salario_base ?? undefined,
    tipoEscala: v.tipo_escala,
    adicionalNoturno: Boolean(v.adicional_noturno),
    periculosidade: Boolean(v.periculosidade),
    insalubridade: v.insalubridade,
    premioIncentivo: v.premio_incentivo,
    valorVrDia: v.valor_vr_dia,
    valorVtDia: v.valor_vt_dia,
    dsrPercentual: v.dsr_percentual,
    periodicidade: v.periodicidade,
    tempoPausa: v.tempo_pausa ?? undefined,
    tempoRefeicao: v.tempo_refeicao ?? undefined,
    descontaPausa: Boolean(v.desconta_pausa),
    descontaRefeicao: Boolean(v.desconta_refeicao),
    recebePor: v.recebe_por ?? 'mes',
    dataInicio: v.data_inicio ?? dataHoje(),
  };
}

const STATUS_AGENDA_COR: Record<StatusAgendaParam, { bg: string; color: string; label: string }> = {
  previsto:    { bg: '#e3f2fd', color: '#1565c0', label: 'Previsto' },
  confirmado:  { bg: '#e8f5e9', color: '#2e7d32', label: 'Confirmado' },
  cancelado:   { bg: '#ffebee', color: '#c62828', label: 'Cancelado' },
  feriado:     { bg: '#fff8e1', color: '#e65100', label: 'Feriado' },
};

// ── Componente principal ───────────────────────────────────────────────────────

const Parametro: React.FC = () => {
  const { temPermissao } = usePermissoes();
  const [empresas, setEmpresas] = useState<EmpresaResumoParametro[]>([]);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [empresaSel, setEmpresaSel] = useState<EmpresaDetalheParametro | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);

  // Fichas (unidades)
  const [showFormUnidade, setShowFormUnidade] = useState(false);
  const [editandoUnidade, setEditandoUnidade] = useState<UnidadeParametro | null>(null);
  const [formUnidade, setFormUnidade] = useState({ nomeUnidade: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', contatoResponsavel: '', observacoes: '' });
  const [buscandoCepUnidade, setBuscandoCepUnidade] = useState(false);
  const [salvandoUnidade, setSalvandoUnidade] = useState(false);
  const [unidadesExpandidas, setUnidadesExpandidas] = useState<Set<number>>(new Set());

  // Vagas
  const [showFormVaga, setShowFormVaga] = useState(false);
  const [vagaUnidadeId, setVagaUnidadeId] = useState<number | null>(null);
  const [editandoVaga, setEditandoVaga] = useState<VagaParametro | null>(null);
  const [formVaga, setFormVaga] = useState<NovaVaga>(VAGA_VAZIA);
  const [salvandoVaga, setSalvandoVaga] = useState(false);

  // Incremento
  const [showIncremento, setShowIncremento] = useState(false);
  const [vagaIncremento, setVagaIncremento] = useState<VagaParametro | null>(null);
  const [formIncremento, setFormIncremento] = useState({ delta: 1, motivo: '', dataIncremento: dataHoje() });
  const [incrementoHistorico, setIncrementoHistorico] = useState<Incremento[]>([]);
  const [salvandoIncremento, setSalvandoIncremento] = useState(false);

  // Log
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<LogAcao[]>([]);
  const [carregandoLog, setCarregandoLog] = useState(false);

  // Status
  const [showConfirmaStatus, setShowConfirmaStatus] = useState(false);
  const [novoStatus, setNovoStatus] = useState('');

  // Agenda
  const [showAgenda, setShowAgenda] = useState(false);
  const [vagaAgenda, setVagaAgenda] = useState<VagaParametro | null>(null);
  const [agenda, setAgenda] = useState<AgendaItem[]>([]);
  const [carregandoAgenda, setCarregandoAgenda] = useState(false);
  const [regerandoAgenda, setRegerandoAgenda] = useState(false);

  // Cadastro primário para pré-preenchimento
  const [atividadesPrimarias, setAtividadesPrimarias] = useState<AtividadePrimaria[]>([]);

  const [erroModal, setErroModal] = useState('');

  // ── Carregamento ───────────────────────────────────────────────────────────

  const carregarEmpresas = async () => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarEmpresasParametro();
      setEmpresas(lista);
      if (lista.length > 0 && !empresaSel) {
        carregarDetalhe(lista[0].id);
      }
    } catch {
      setErro('Erro ao carregar empresas.');
    } finally {
      setCarregando(false);
    }
  };

  const carregarDetalhe = async (id: number) => {
    setCarregandoDetalhe(true);
    try {
      const [detalhe, atividades] = await Promise.all([
        obterEmpresaParametro(id),
        listarAtividadesPrimarias(id).catch(() => []),
      ]);
      setEmpresaSel(detalhe);
      setAtividadesPrimarias(atividades);
      setUnidadesExpandidas(new Set(detalhe.unidades.map((u) => u.id)));
    } catch {
      setErro('Erro ao carregar dados da empresa.');
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  useEffect(() => { carregarEmpresas(); }, []);
  useIonViewWillEnter(() => { carregarEmpresas(); });

  const selecionarEmpresa = (empresa: EmpresaResumoParametro) => {
    if (empresaSel?.id !== empresa.id) {
      setErro(''); // limpa erro ao trocar de empresa
      carregarDetalhe(empresa.id);
    }
  };

  // ── Status da empresa ──────────────────────────────────────────────────────

  const handleAlterarStatus = async () => {
    if (!empresaSel || !novoStatus) return;
    try {
      await alterarStatusEmpresaParametro(empresaSel.id, novoStatus);
      setShowConfirmaStatus(false);
      await carregarDetalhe(empresaSel.id);
      await carregarEmpresas();
    } catch {
      setErroModal('Erro ao alterar status.');
    }
  };

  // ── Fichas (unidades) ──────────────────────────────────────────────────────

  const abrirNovaUnidade = () => {
    setEditandoUnidade(null);
    setFormUnidade({ nomeUnidade: '', cep: '', rua: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', contatoResponsavel: '', observacoes: '' });
    setErroModal('');
    setShowFormUnidade(true);
  };

  /** Tenta extrair CEP do final de uma string de endereço composto. */
  const extrairCep = (endereco: string): string => {
    const m = endereco.match(/\b(\d{5}-?\d{3})\b/g);
    return m ? m[m.length - 1] : '';
  };

  /** Tenta extrair apenas a rua do início do endereço composto (antes do primeiro ',', se houver CEP). */
  const extrairRua = (endereco: string, cep: string): string => {
    if (!cep) return endereco;
    // Remove o CEP do final e divide os segmentos
    const semCep = endereco.replace(cep, '').replace(/,\s*$/, '').trim();
    return semCep;
  };

  const abrirEditarUnidade = (u: UnidadeParametro) => {
    setEditandoUnidade(u);
    const cepExtraido = extrairCep(u.endereco ?? '');
    const ruaExtraida = extrairRua(u.endereco ?? '', cepExtraido);
    setFormUnidade({
      nomeUnidade: u.nome_unidade,
      cep: cepExtraido,
      rua: ruaExtraida,
      numero: '',
      complemento: '',
      bairro: '',
      cidade: '',
      uf: '',
      contatoResponsavel: u.contato_responsavel ?? '',
      observacoes: u.observacoes ?? '',
    });
    setErroModal('');
    setShowFormUnidade(true);
  };

  const handleCepUnidadeBlur = async () => {
    if (!formUnidade.cep) return;
    setBuscandoCepUnidade(true);
    const end = await buscarEnderecoPorCep(formUnidade.cep);
    setBuscandoCepUnidade(false);
    if (end) {
      setFormUnidade((p) => ({
        ...p,
        rua: end.rua || p.rua,
        bairro: end.bairro || p.bairro,
        cidade: end.cidade || p.cidade,
        uf: end.uf || p.uf,
      }));
    }
  };

  const handleSalvarUnidade = async () => {
    if (!empresaSel || !formUnidade.nomeUnidade) { setErroModal('Nome da ficha é obrigatório.'); return; }
    // Monta string de endereço a partir dos campos separados
    const partes = [formUnidade.rua, formUnidade.numero, formUnidade.complemento, formUnidade.bairro, formUnidade.cidade && formUnidade.uf ? `${formUnidade.cidade} - ${formUnidade.uf}` : formUnidade.cidade || formUnidade.uf, formUnidade.cep].filter(Boolean);
    const enderecoComposto = partes.join(', ');
    setSalvandoUnidade(true);
    try {
      const dadosUnidade = { nomeUnidade: formUnidade.nomeUnidade, endereco: enderecoComposto || undefined, contatoResponsavel: formUnidade.contatoResponsavel || undefined, observacoes: formUnidade.observacoes || undefined };
      if (editandoUnidade) {
        await atualizarUnidade(editandoUnidade.id, empresaSel.id, dadosUnidade);
      } else {
        await criarUnidade(empresaSel.id, dadosUnidade);
      }
      setShowFormUnidade(false);
      await carregarDetalhe(empresaSel.id);
      await carregarEmpresas();
    } catch {
      setErroModal('Erro ao salvar ficha.');
    } finally {
      setSalvandoUnidade(false);
    }
  };

  const handleAlternarUnidade = async (u: UnidadeParametro) => {
    if (!empresaSel) return;
    const novaAtivacao = !u.ativa;

    // Atualização otimista: muda o estado local imediatamente
    setEmpresaSel((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unidades: prev.unidades.map((un) =>
          un.id === u.id ? { ...un, ativa: novaAtivacao } : un
        ),
      };
    });
    setErro('');

    try {
      await alternarAtivacaoUnidade(u.id, empresaSel.id, novaAtivacao);
      // Atualiza contagem na lista lateral sem reload completo
      setEmpresas((prev) =>
        prev.map((e) => e.id === empresaSel.id ? { ...e } : e)
      );
    } catch {
      // Reverte em caso de erro
      setEmpresaSel((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unidades: prev.unidades.map((un) =>
            un.id === u.id ? { ...un, ativa: u.ativa } : un
          ),
        };
      });
      setErro('Erro ao alterar ficha. Tente novamente.');
    }
  };

  // ── Vagas ──────────────────────────────────────────────────────────────────

  const abrirNovaVaga = (unidadeId: number) => {
    setVagaUnidadeId(unidadeId);
    setEditandoVaga(null);
    setFormVaga(VAGA_VAZIA);
    setErroModal('');
    setShowFormVaga(true);
  };

  const abrirEditarVaga = (vaga: VagaParametro) => {
    setVagaUnidadeId(vaga.unidade_id);
    setEditandoVaga(vaga);
    setFormVaga(vagaParaForm(vaga));
    setErroModal('');
    setShowFormVaga(true);
  };

  const handleSalvarVaga = async () => {
    if (!empresaSel || !vagaUnidadeId || !formVaga.cargo) { setErroModal('Cargo é obrigatório.'); return; }
    if (!formVaga.dataInicio) { setErroModal('A data de início da operação é obrigatória para gerar a agenda.'); return; }
    setSalvandoVaga(true);
    const isNova = !editandoVaga;
    try {
      let novaVagaId: number | null = null;
      if (editandoVaga) {
        await atualizarVaga(editandoVaga.id, vagaUnidadeId, empresaSel.id, formVaga);
      } else {
        const res = await criarVaga(vagaUnidadeId, empresaSel.id, formVaga);
        novaVagaId = res.id;
      }
      setShowFormVaga(false);
      await carregarDetalhe(empresaSel.id);

      // Ao criar vaga nova, abre a agenda imediatamente para a área validar
      if (isNova && novaVagaId !== null) {
        setEmpresaSel((prev) => {
          if (!prev) return prev;
          const vagaCriada = prev.unidades.flatMap((u) => u.vagas).find((v) => v.id === novaVagaId);
          if (vagaCriada) {
            // dispara abrirAgenda fora do setState
            setTimeout(() => abrirAgenda(vagaCriada), 100);
          }
          return prev;
        });
      }
    } catch {
      setErroModal('Erro ao salvar vaga.');
    } finally {
      setSalvandoVaga(false);
    }
  };

  const handleAlternarVaga = async (vaga: VagaParametro) => {
    if (!empresaSel) return;
    const novaAtivacao = !vaga.ativa;

    // Atualização otimista
    setEmpresaSel((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        unidades: prev.unidades.map((un) =>
          un.id === vaga.unidade_id
            ? { ...un, vagas: un.vagas.map((v) => v.id === vaga.id ? { ...v, ativa: novaAtivacao } : v) }
            : un
        ),
      };
    });
    setErro('');

    try {
      await alternarAtivacaoVaga(vaga.id, vaga.unidade_id, empresaSel.id, novaAtivacao);
    } catch {
      // Reverte
      setEmpresaSel((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          unidades: prev.unidades.map((un) =>
            un.id === vaga.unidade_id
              ? { ...un, vagas: un.vagas.map((v) => v.id === vaga.id ? { ...v, ativa: vaga.ativa } : v) }
              : un
          ),
        };
      });
      setErro('Erro ao alterar vaga. Tente novamente.');
    }
  };

  // ── Pré-preenchimento a partir do cadastro primário ────────────────────────

  const preencherDeCadastroPrimario = (atividadeId: number) => {
    const at = atividadesPrimarias.find((a) => a.id === atividadeId);
    if (!at) return;
    setFormVaga((prev) => ({
      ...prev,
      cargo: at.cargo,
      quantidade: at.quantidade ?? 1,
      salarioBase: at.salario_base ?? undefined,
      tipoEscala: at.tipo_escala ?? '12x36',
      adicionalNoturno: Boolean(at.adicional_noturno),
      periculosidade: Boolean(at.periculosidade),
      insalubridade: at.insalubridade ?? 'sem_risco',
      premioIncentivo: at.premio_incentivo ?? 0,
      valorVrDia: at.vr_dias ?? 0,
      valorVtDia: at.vt_dias ?? 0,
    }));
  };

  // ── Agenda ─────────────────────────────────────────────────────────────────

  const abrirAgenda = async (vaga: VagaParametro) => {
    setVagaAgenda(vaga);
    setCarregandoAgenda(true);
    setShowAgenda(true);
    try {
      setAgenda(await listarAgendaVaga(vaga.id));
    } catch { setAgenda([]); }
    finally { setCarregandoAgenda(false); }
  };

  const handleStatusAgenda = async (item: AgendaItem, novoSt: StatusAgendaParam) => {
    try {
      await atualizarStatusAgenda(item.id, novoSt);
      setAgenda((prev) => prev.map((a) => a.id === item.id ? { ...a, status: novoSt } : a));
    } catch { setErroModal('Erro ao atualizar status da agenda.'); }
  };

  const handleRegerarAgenda = async () => {
    if (!vagaAgenda || !empresaSel || !vagaAgenda.data_inicio) return;
    setRegerandoAgenda(true);
    try {
      await regerarAgendaVaga(vagaAgenda.id, vagaAgenda.unidade_id, empresaSel.id, vagaAgenda.tipo_escala, vagaAgenda.data_inicio?.substring(0, 10));
      setAgenda(await listarAgendaVaga(vagaAgenda.id));
    } catch { setErroModal('Erro ao regerar agenda.'); }
    finally { setRegerandoAgenda(false); }
  };

  // ── Incremento ──────────────────────────────────────────────────────────────

  const abrirIncremento = async (vaga: VagaParametro) => {
    setVagaIncremento(vaga);
    setFormIncremento({ delta: 1, motivo: '', dataIncremento: dataHoje() });
    setErroModal('');
    try {
      setIncrementoHistorico(await listarIncrementos(vaga.id));
    } catch { setIncrementoHistorico([]); }
    setShowIncremento(true);
  };

  const handleSalvarIncremento = async () => {
    if (!empresaSel || !vagaIncremento || formIncremento.delta === 0) { setErroModal('Informe o delta (diferente de 0).'); return; }
    setSalvandoIncremento(true);
    try {
      await registrarIncremento(vagaIncremento.id, vagaIncremento.unidade_id, empresaSel.id, formIncremento);
      setShowIncremento(false);
      await carregarDetalhe(empresaSel.id);
    } catch (e) {
      setErroModal(e instanceof Error ? e.message : 'Erro ao registrar incremento.');
    } finally {
      setSalvandoIncremento(false);
    }
  };

  // ── Exportação CSV ─────────────────────────────────────────────────────────

  const exportarCSV = () => {
    if (!empresaSel) return;
    const linhas: string[][] = [
      ['Empresa', 'Unidade', 'Cargo', 'Quantidade', 'Salário Base (R$)', 'VR/dia (R$)', 'VT/dia (R$)',
       'DSR (%)', 'Adicional Noturno', 'Periculosidade', 'Insalubridade', 'Prêmio/Incentivo (R$)',
       'Escala', 'Recebe por', 'Data Início', 'Ativa'],
    ];
    for (const unidade of empresaSel.unidades) {
      for (const v of unidade.vagas) {
        linhas.push([
          empresaSel.nome_empresa,
          unidade.nome_unidade,
          v.cargo,
          String(v.quantidade),
          String(v.salario_base ?? ''),
          String(v.valor_vr_dia ?? ''),
          String(v.valor_vt_dia ?? ''),
          String(v.dsr_percentual ?? ''),
          v.adicional_noturno ? 'Sim' : 'Não',
          v.periculosidade ? 'Sim' : 'Não',
          v.insalubridade ?? '',
          String(v.premio_incentivo ?? ''),
          v.tipo_escala ?? '',
          v.recebe_por ?? '',
          v.data_inicio ?? '',
          v.ativa ? 'Sim' : 'Não',
        ]);
      }
    }
    const bom = '﻿'; // BOM para Excel reconhecer UTF-8
    const csv = bom + linhas.map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vagas_${empresaSel.nome_empresa.replace(/[^a-zA-Z0-9]/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Parâmetro de Projeto (modelo ATESA.pdf) ────────────────────────────

  const gerarPdfInstitucional = () => {
    if (!empresaSel) return;

    const vagasAtivas = empresaSel.unidades.flatMap((u) =>
      u.vagas.filter((v) => v.ativa).map((v) => ({ ...v, nomeUnidade: u.nome_unidade }))
    );

    const dataAtualizacao = new Date().toLocaleDateString('pt-BR');

    const escalaLabel: Record<string, string> = {
      '12x36': '12x36', plantao: 'PLANTÃO', mensal: 'MENSAL', por_procedimento: 'POR PROCEDIMENTO',
    };

    const insalubridadeLabel: Record<string, string> = {
      sem_risco: 'Sem risco', pre: 'Pré (20%)', medio: 'Médio (20%)', alto: 'Alto (40%)',
    };

    const fmt = (v: number | null | undefined) =>
      v != null && Number(v) > 0
        ? Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '';

    // Gera bloco HTML de uma vaga (atividade)
    const blocoAtividade = (v: typeof vagasAtivas[0], idx: number) => `
<div style="margin-bottom:18px">
  <h3 style="text-align:center;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 6px;border-top:2px solid #2d5f1f;padding-top:8px">
    INFORMAÇÕES REFERENTE À ATIVIDADE - ${idx + 1}
  </h3>
  <table style="width:100%;border-collapse:collapse;font-size:9px">
    <!-- Ocupação header -->
    <tr>
      <td style="background:#2d5f1f;color:#fff;font-weight:700;padding:3px 6px;width:90px">OCUPAÇÃO ►</td>
      <td colspan="5" style="border:1px solid #555;padding:3px 6px;font-weight:700">${v.cargo}</td>
    </tr>
    <tr>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999">TIPO DA ATIVIDADE</td>
      <td style="border:1px solid #999;padding:3px 6px">&nbsp;</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999;width:60px">QTDE</td>
      <td style="border:1px solid #999;padding:3px 6px;width:40px;text-align:center">${v.quantidade}</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999">TIPO DE CONTRATAÇÃO</td>
      <td style="border:1px solid #999;padding:3px 6px">Cooperado</td>
    </tr>
    <tr>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999">PERÍODO</td>
      <td style="border:1px solid #999;padding:3px 6px">${escalaLabel[v.tipo_escala] ?? v.tipo_escala}</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999">HORÁRIO</td>
      <td style="border:1px solid #999;padding:3px 6px">&nbsp;</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999">INTERVALO</td>
      <td style="border:1px solid #999;padding:3px 6px">&nbsp;</td>
    </tr>
    <tr>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999">PERICULOSIDADE</td>
      <td style="border:1px solid #999;padding:3px 6px">${v.periculosidade ? 'Sim' : 'Não'}</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999">ADD. NOTURNO</td>
      <td style="border:1px solid #999;padding:3px 6px">${v.adicional_noturno ? 'Sim' : 'Não'}</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999">INSALUBRIDADE</td>
      <td style="border:1px solid #999;padding:3px 6px">${insalubridadeLabel[v.insalubridade] ?? v.insalubridade}</td>
    </tr>
  </table>

  <!-- Remuneração -->
  <table style="width:100%;border-collapse:collapse;font-size:9px;margin-top:4px">
    <tr>
      <td colspan="4" style="background:#2d5f1f;color:#fff;font-weight:700;text-align:center;padding:3px 6px;letter-spacing:1px">REMUNERAÇÃO</td>
    </tr>
    <tr>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999;width:35%">EXPECTATIVA ► ESPECIFICAÇÃO</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999;width:15%;text-align:center">VALOR</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999;width:20%;text-align:center">DESCRIÇÃO</td>
      <td style="background:#c9d9c4;font-weight:700;padding:3px 6px;border:1px solid #999;width:30%">OBSERVAÇÃO</td>
    </tr>
    <tr>
      <td style="border:1px solid #ccc;padding:3px 6px">Remuneração</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${fmt(v.salario_base)}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${escalaLabel[v.tipo_escala] ?? v.tipo_escala}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">&nbsp;</td>
    </tr>
    ${v.insalubridade && v.insalubridade !== 'sem_risco' ? `<tr>
      <td style="border:1px solid #ccc;padding:3px 6px">Insalubridade</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">&nbsp;</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${escalaLabel[v.tipo_escala] ?? v.tipo_escala}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">${insalubridadeLabel[v.insalubridade]}</td>
    </tr>` : ''}
    ${Number(v.valor_vr_dia) > 0 ? `<tr>
      <td style="border:1px solid #ccc;padding:3px 6px">Ajuda de Custo (VR)</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${fmt(v.valor_vr_dia)} <span style="font-size:8px;color:#666">/dia</span></td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${escalaLabel[v.tipo_escala] ?? v.tipo_escala}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">&nbsp;</td>
    </tr>` : ''}
    ${Number(v.valor_vt_dia) > 0 ? `<tr>
      <td style="border:1px solid #ccc;padding:3px 6px">Ajuda de Custo VT</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${fmt(v.valor_vt_dia)} <span style="font-size:8px;color:#666">/dia</span></td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${escalaLabel[v.tipo_escala] ?? v.tipo_escala}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">&nbsp;</td>
    </tr>` : ''}
    ${v.adicional_noturno ? `<tr>
      <td style="border:1px solid #ccc;padding:3px 6px">Adicional Noturno</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">&nbsp;</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${escalaLabel[v.tipo_escala] ?? v.tipo_escala}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">&nbsp;</td>
    </tr>` : ''}
    ${Number(v.premio_incentivo) > 0 ? `<tr>
      <td style="border:1px solid #ccc;padding:3px 6px">Prêmio / Incentivo</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${fmt(v.premio_incentivo)}</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${escalaLabel[v.tipo_escala] ?? v.tipo_escala}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">&nbsp;</td>
    </tr>` : ''}
    <tr>
      <td style="border:1px solid #ccc;padding:3px 6px">Provisão D.A.R</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">&nbsp;</td>
      <td style="border:1px solid #ccc;padding:3px 6px;text-align:center">${escalaLabel[v.tipo_escala] ?? v.tipo_escala}</td>
      <td style="border:1px solid #ccc;padding:3px 6px">&nbsp;</td>
    </tr>
    <tr><td colspan="4" style="height:6px;border:none"></td></tr>
    <!-- Perfil -->
    <tr>
      <td colspan="4" style="background:#2d5f1f;color:#fff;font-weight:700;text-align:center;padding:3px 6px;letter-spacing:1px">PERFIL DA OCUPAÇÃO</td>
    </tr>
    <tr>
      <td colspan="4" style="border:1px solid #ccc;padding:6px;height:50px;vertical-align:top">&nbsp;</td>
    </tr>
    <tr><td colspan="4" style="height:4px;border:none"></td></tr>
    <!-- Recursos -->
    <tr>
      <td colspan="4" style="background:#2d5f1f;color:#fff;font-weight:700;text-align:center;padding:3px 6px;letter-spacing:1px">INFORMAÇÕES DO RECURSOS ASSOCIATIVOS</td>
    </tr>
    <tr>
      <td colspan="4" style="border:1px solid #ccc;padding:6px;height:50px;vertical-align:top">&nbsp;</td>
    </tr>
  </table>
</div>`;

    // Agrupar vagas: 2 por página
    const paginas: (typeof vagasAtivas)[] = [];
    for (let i = 0; i < vagasAtivas.length; i += 2) {
      paginas.push(vagasAtivas.slice(i, i + 2));
    }

    const cnpjFmt = (c: string | null) =>
      c ? c.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5') : '—';

    // Cabeçalho de página (igual ao modelo: logo | título | data)
    const cabecalho = (pag: number) => `
<table style="width:100%;border-collapse:collapse;margin-bottom:6px">
  <tr>
    <td style="width:80px;vertical-align:middle">
      <div style="font-size:18px;font-weight:900;color:#2d5f1f;letter-spacing:-1px;line-height:1">ATESA</div>
      <div style="font-size:7px;color:#666;letter-spacing:1px">COOPERATIVA</div>
    </td>
    <td style="text-align:center;vertical-align:middle">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">PARÂMETRO DE PROJETO</div>
    </td>
    <td style="width:140px;text-align:right;vertical-align:middle;font-size:9px;color:#444">
      Data da Atualização: ${dataAtualizacao}
    </td>
  </tr>
</table>
<hr style="border:none;border-top:2px solid #2d5f1f;margin-bottom:10px"/>`;

    const rodape = (pag: number) => `
<div style="margin-top:16px;border-top:1px solid #ccc;padding-top:4px;display:flex;justify-content:space-between;font-size:8px;color:#888">
  <span>© ${new Date().getFullYear()} Todos os direitos reservados</span>
  <span>${pag}</span>
</div>`;

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8"/>
<title>Parâmetro de Projeto — ${empresaSel.nome_empresa}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size:9px; color:#111; background:#fff; }
  .page { width:210mm; min-height:297mm; margin:0 auto; padding:12mm 14mm 10mm; page-break-after:always; }
  table { border-collapse:collapse; }
  td,th { font-family: Arial, sans-serif; font-size:9px; }
  .th-g { background:#2d5f1f; color:#fff; font-weight:700; padding:3px 5px; }
  .th-s { background:#c9d9c4; font-weight:700; padding:3px 5px; }
  .td-v { padding:3px 5px; border:1px solid #aaa; }
  .sec-title { font-size:11px; font-weight:700; text-align:center; letter-spacing:1px; text-transform:uppercase; border-bottom:2px solid #2d5f1f; padding-bottom:4px; margin:10px 0 6px; }
  @media print {
    body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .page { page-break-after:always; }
  }
</style>
</head>
<body>

<!-- ══════════════════════ PÁGINA 1 — DADOS DA CONTRATANTE ══════════════════ -->
<div class="page">
${cabecalho(1)}

<!-- Informação interna -->
<table style="width:100%;margin-bottom:4px">
  <tr>
    <td class="th-g" style="width:90px">CLIENTE</td>
    <td class="td-v" style="font-weight:700">OBSERVAÇÃO | INCLUSÃO/ALTERAÇÃO</td>
  </tr>
  <tr>
    <td class="td-v">${empresaSel.nome_empresa}</td>
    <td class="td-v">&nbsp;</td>
  </tr>
</table>

<table style="width:100%;margin-bottom:10px">
  <tr>
    <td class="th-g" style="width:25%">COOPERATIVA</td>
    <td class="th-g" style="width:25%">RESPONSÁVEL COMERCIAL</td>
    <td class="th-g" style="width:25%">CONSULTOR DE AGENDAMENTO</td>
    <td class="th-g" style="width:25%">RESPONSÁVEL PÓS-VENDA</td>
  </tr>
  <tr>
    <td class="td-v">ATESA</td>
    <td class="td-v">${empresaSel.executivo_nome ?? ''}</td>
    <td class="td-v">&nbsp;</td>
    <td class="td-v">&nbsp;</td>
  </tr>
</table>

<div class="sec-title">DADOS DA CONTRATANTE</div>
<table style="width:100%;margin-bottom:4px">
  <tr>
    <td class="th-s" style="width:20%">RAZÃO SOCIAL</td>
    <td class="td-v" colspan="3">${empresaSel.nome_empresa}</td>
  </tr>
  <tr>
    <td class="th-s">CNPJ</td>
    <td class="td-v" style="width:30%">${cnpjFmt(empresaSel.cnpj)}</td>
    <td class="th-s" style="width:20%">RAMO DE ATIVIDADE</td>
    <td class="td-v">SAÚDE</td>
  </tr>
  <tr>
    <td class="th-s">STATUS</td>
    <td class="td-v">${empresaSel.status}</td>
    <td class="th-s">REGIÃO</td>
    <td class="td-v">${empresaSel.regiao_nome ?? ''}</td>
  </tr>
</table>

<table style="width:100%;margin-bottom:4px">
  <tr>
    <td class="th-s" style="width:20%">RESP - FINANCEIRO</td>
    <td class="th-s" style="width:20%">TELEFONE</td>
    <td class="th-s" style="width:20%">CELULAR</td>
    <td class="th-s">E-MAIL</td>
  </tr>
  <tr>
    <td class="td-v">${empresaSel.representante ?? ''}</td>
    <td class="td-v">${empresaSel.telefone_empresa ?? ''}</td>
    <td class="td-v">${empresaSel.whatsapp ?? ''}</td>
    <td class="td-v">${empresaSel.email_empresa ?? ''}</td>
  </tr>
  <tr>
    <td class="th-s">RESP - COMERCIAL</td>
    <td class="th-s">TELEFONE</td>
    <td class="th-s">CELULAR</td>
    <td class="th-s">E-MAIL</td>
  </tr>
  <tr>
    <td class="td-v">&nbsp;</td>
    <td class="td-v">&nbsp;</td>
    <td class="td-v">&nbsp;</td>
    <td class="td-v">&nbsp;</td>
  </tr>
  <tr>
    <td class="th-s">RESP - ADMINISTRATIVO</td>
    <td class="th-s">TELEFONE</td>
    <td class="th-s">CELULAR</td>
    <td class="th-s">E-MAIL</td>
  </tr>
  <tr>
    <td class="td-v">&nbsp;</td>
    <td class="td-v">&nbsp;</td>
    <td class="td-v">&nbsp;</td>
    <td class="td-v">&nbsp;</td>
  </tr>
</table>

<div class="sec-title">FICHAS DE SERVIÇO (UNIDADES)</div>
<table style="width:100%;margin-bottom:4px">
  <tr>
    <td class="th-g" style="width:40%">UNIDADE</td>
    <td class="th-g" style="width:35%">ENDEREÇO</td>
    <td class="th-g" style="width:15%;text-align:center">VAGAS ATIVAS</td>
    <td class="th-g" style="width:10%;text-align:center">STATUS</td>
  </tr>
  ${empresaSel.unidades.map((u) => {
    const qtd = u.vagas.filter((v) => v.ativa).reduce((s, v) => s + v.quantidade, 0);
    return `<tr>
      <td class="td-v" style="font-weight:700">${u.nome_unidade}</td>
      <td class="td-v">${u.endereco ?? ''}</td>
      <td class="td-v" style="text-align:center;font-weight:700">${qtd}</td>
      <td class="td-v" style="text-align:center">${u.ativa ? 'Ativa' : 'Inativa'}</td>
    </tr>`;
  }).join('')}
</table>

<div class="sec-title">INFORMAÇÕES DE FATURAMENTO</div>
<table style="width:100%;margin-bottom:4px">
  <tr>
    <td class="th-s" style="width:25%">TAXA DO SERVIÇO</td>
    <td class="td-v" style="width:25%">&nbsp;</td>
    <td class="th-s" style="width:25%">PERÍODO DA APURAÇÃO</td>
    <td class="td-v" style="width:25%">&nbsp;</td>
  </tr>
  <tr>
    <td class="th-s">APRESENTAÇÃO AO CLIENTE</td>
    <td class="td-v">&nbsp;</td>
    <td class="th-s">DATA DE ENVIO BOLETO</td>
    <td class="td-v">&nbsp;</td>
  </tr>
</table>

<table style="width:100%;margin-bottom:4px">
  <tr>
    <td class="th-g" colspan="3" style="text-align:center">OBSERVAÇÕES DO FECHAMENTO</td>
  </tr>
  <tr>
    <td class="th-s" style="width:25%">APRESENTAÇÃO AO FATURAMENTO</td>
    <td class="th-s" style="width:25%">VENCIMENTO</td>
    <td class="th-s">REPASSE AO COOPERADO</td>
  </tr>
  <tr>
    <td class="td-v" style="text-align:center">&nbsp;</td>
    <td class="td-v" style="text-align:center">&nbsp;</td>
    <td class="td-v" style="text-align:center">&nbsp;</td>
  </tr>
</table>

<table style="width:100%;margin-bottom:6px">
  <tr>
    <td class="th-g" colspan="3" style="text-align:center">OBSERVAÇÕES | FATURAMENTO</td>
  </tr>
  <tr>
    <td class="td-v" colspan="3" style="height:50px;vertical-align:top;padding:6px">&nbsp;</td>
  </tr>
  <tr>
    <td class="th-g" colspan="3" style="text-align:center">OBSERVAÇÕES | FINANCEIRO</td>
  </tr>
  <tr>
    <td class="td-v" colspan="3" style="height:50px;vertical-align:top;padding:6px">&nbsp;</td>
  </tr>
</table>

${rodape(1)}
</div>

<!-- ══════════════════════ PÁGINAS DE ATIVIDADES ══════════════════════════ -->
${paginas.map((pag, pi) => `
<div class="page">
${cabecalho(pi + 2)}
${pag.map((v, vi) => blocoAtividade(v, pi * 2 + vi)).join('')}
${rodape(pi + 2)}
</div>`).join('')}

</body></html>`;

    const janela = window.open('', '_blank');
    if (!janela) { alert('Permita pop-ups para gerar o PDF.'); return; }
    janela.document.open();
    janela.document.write(html);
    janela.document.close();
  };

  // ── Log ────────────────────────────────────────────────────────────────────

  const abrirLog = async () => {
    if (!empresaSel) return;
    setCarregandoLog(true);
    setShowLog(true);
    try {
      setLog(await listarLogEmpresa(empresaSel.id));
    } catch { setLog([]); }
    finally { setCarregandoLog(false); }
  };

  // ── Filtro de empresas ─────────────────────────────────────────────────────

  const empresasFiltradas = empresas.filter((e) => {
    const matchBusca = !busca || e.nome_empresa.toLowerCase().includes(busca.toLowerCase());
    const matchStatus = !filtroStatus || e.status === filtroStatus;
    return matchBusca && matchStatus;
  });

  const statusUnicos = [...new Set(empresas.map((e) => e.status))].sort();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Parâmetros de Serviço</h1>
          <p className="painel-subtitle">Configure fichas de serviço, vagas e cooperados por empresa cliente</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>

        {/* ── Painel esquerdo: lista de empresas ── */}
        <div style={{
          background: '#ffffff',
          borderRadius: 14,
          boxShadow: '0 2px 10px rgba(0,0,0,0.06)',
          border: '1px solid #e0e0e0',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid #eee', background: '#fafafa' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#2e6b32', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Empresas ({empresasFiltradas.length})
            </div>
            <input
              className="form-input"
              style={{ marginBottom: 8, fontSize: 13 }}
              placeholder="Buscar empresa..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
            <select className="form-input" style={{ fontSize: 12 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              {statusUnicos.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {carregando && <div style={{ padding: 16, fontSize: 13, color: '#888' }}>Carregando...</div>}

          <div style={{ maxHeight: 600, overflowY: 'auto' }}>
            {empresasFiltradas.map((e) => {
              const ativa = empresaSel?.id === e.id;
              const cor = STATUS_COR[e.status] ?? { bg: '#f5f5f5', color: '#555' };
              return (
                <button
                  key={e.id}
                  onClick={() => selecionarEmpresa(e)}
                  style={{
                    width: '100%', textAlign: 'left', padding: '12px 16px',
                    background: ativa ? '#e8f5e9' : 'transparent',
                    borderLeft: ativa ? '4px solid #2e6b32' : '4px solid transparent',
                    border: 'none', borderBottom: '1px solid #f0f0f0', cursor: 'pointer',
                    transition: 'background 0.15s ease',
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 600, color: ativa ? '#2e6b32' : '#222', marginBottom: 4 }}>{e.nome_empresa}</div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: cor.bg, color: cor.color, fontWeight: 600 }}>{e.status}</span>
                    <span style={{ fontSize: 12, color: '#888' }}>{e.total_unidades} ficha{Number(e.total_unidades) !== 1 ? 's' : ''}</span>
                  </div>
                </button>
              );
            })}
            {!carregando && empresasFiltradas.length === 0 && (
              <div style={{ padding: 20, fontSize: 13, color: '#aaa', textAlign: 'center' }}>Nenhuma empresa encontrada.</div>
            )}
          </div>
        </div>

        {/* ── Painel direito: detalhe da empresa ── */}
        <div style={{ minWidth: 0 }}>
          {!empresaSel && !carregandoDetalhe && (
            <div style={{
              background: '#ffffff', borderRadius: 14,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0',
              padding: 40, textAlign: 'center', color: '#888',
            }}>
              <div style={{ marginBottom: 12, color: '#ccc' }}><IconBuilding size={40} /></div>
              <h3 style={{ margin: '0 0 8px', color: '#333', fontSize: 16 }}>Selecione uma Empresa</h3>
              <p style={{ margin: 0, fontSize: 13 }}>Escolha uma empresa na lista ao lado para visualizar e gerenciar suas fichas de serviço, vagas e cooperados.</p>
            </div>
          )}
          {carregandoDetalhe && (
            <div style={{
              background: '#ffffff', borderRadius: 14,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0',
              padding: 40, textAlign: 'center', color: '#888', fontSize: 14,
            }}>
              Carregando dados da empresa...
            </div>
          )}

          {empresaSel && !carregandoDetalhe && (() => {
            const cor = STATUS_COR[empresaSel.status] ?? { bg: '#f5f5f5', color: '#555' };
            return (
              <>
                {/* ── Cabeçalho do cliente ── */}
                <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14, boxShadow: '0 2px 10px rgba(0,0,0,0.06)', padding: '24px 28px', marginBottom: 24 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ margin: '0 0 10px', fontSize: 20, color: '#1a1a1a' }}>{empresaSel.nome_empresa}</h2>
                      {/* Linha 1: CNPJ/CPF + Executivo */}
                      <div style={{ fontSize: 13, color: '#555', display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 4 }}>
                        {empresaSel.cnpj && <span>CNPJ: {formatarCNPJ(empresaSel.cnpj)}</span>}
                        {empresaSel.cpf && <span>CPF: {formatarCPF(empresaSel.cpf)}</span>}
                        {empresaSel.executivo_nome && <span>Executivo: {empresaSel.executivo_nome}</span>}
                      </div>
                      {/* Linha 2: Região + Representante */}
                      {(empresaSel.regiao_nome || empresaSel.representante) && (
                        <div style={{ fontSize: 13, color: '#555', display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 4 }}>
                          {empresaSel.regiao_nome && <span>Região: {empresaSel.regiao_nome}</span>}
                          {empresaSel.representante && <span>Representante: {empresaSel.representante}</span>}
                        </div>
                      )}
                      {/* Linha 3: Email + Telefone */}
                      {(empresaSel.email_empresa || empresaSel.whatsapp || empresaSel.telefone_empresa) && (
                        <div style={{ fontSize: 13, color: '#555', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                          {empresaSel.email_empresa && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconMail size={12} />{empresaSel.email_empresa}</span>}
                          {empresaSel.whatsapp && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconPhone size={12} />{formatarTelefone(empresaSel.whatsapp)}</span>}
                          {empresaSel.telefone_empresa && <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><IconPhone size={12} />{formatarTelefone(empresaSel.telefone_empresa)}</span>}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 6, flexShrink: 0, minWidth: 108 }}>
                      <span style={{ fontSize: 13, padding: '5px 14px', borderRadius: 20, background: cor.bg, color: cor.color, fontWeight: 700, border: `1px solid ${cor.color}33`, textAlign: 'center', display: 'block' }}>
                        {empresaSel.status}
                      </span>
                      {temPermissao('empresas.inativar') && ['Ativo', 'Inativo', 'Suspenso'].filter((s) => s !== empresaSel.status).map((s) => (
                        <button key={s} className="btn-secundario" style={{ fontSize: 12, padding: '5px 12px', width: '100%', textAlign: 'center' }}
                          onClick={() => { setNovoStatus(s); setErroModal(''); setShowConfirmaStatus(true); }}>
                          {s}
                        </button>
                      ))}
                      <button className="btn-secundario" style={{ fontSize: 12, padding: '5px 12px', width: '100%', textAlign: 'center' }} onClick={abrirLog}>Ver log</button>
                      {temPermissao('parametro.exportar') && (
                        <>
                          <button className="btn-secundario" style={{ fontSize: 12, padding: '5px 12px', width: '100%', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={exportarCSV} title="Exportar vagas em CSV (abre no Excel)"><IconDownload size={13} />Exportar</button>
                          <button className="btn-secundario" style={{ fontSize: 12, padding: '5px 12px', width: '100%', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={gerarPdfInstitucional} title="Gerar parâmetro de projeto em PDF">Parâmetro PDF</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Erro inline (ativa/inativa) ── */}
                {erro && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#c62828' }}>
                    <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}><IconAlert size={14} />{erro}</span>
                    <button onClick={() => setErro('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontWeight: 700, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                )}

                {/* ── Fichas ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Fichas de Serviço ({empresaSel.unidades.length})
                  </h3>
                  {temPermissao('parametro.unidades') && (
                    <IonButton size="small" shape="round" color="secondary" onClick={abrirNovaUnidade}>+ Nova Ficha</IonButton>
                  )}
                </div>

                {empresaSel.unidades.length === 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px dashed #ccc', padding: 32, textAlign: 'center', color: '#888', fontSize: 13 }}>
                    Nenhuma ficha cadastrada.
                  </div>
                )}

                {empresaSel.unidades.map((unidade) => {
                  const expandida = unidadesExpandidas.has(unidade.id);
                  const totalVagas = unidade.vagas.filter((v) => v.ativa).reduce((s, v) => s + v.quantidade, 0);

                  return (
                    <div key={unidade.id} style={{
                      background: '#fff', border: '1px solid #e0e0e0', borderRadius: 14,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                      marginBottom: 16, opacity: unidade.ativa ? 1 : 0.6,
                    }}>
                      {/* Header da ficha */}
                      <div
                        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', cursor: 'pointer', borderBottom: expandida ? '1px solid #eee' : 'none' }}
                        onClick={() => setUnidadesExpandidas((prev) => {
                          const next = new Set(prev);
                          if (next.has(unidade.id)) next.delete(unidade.id); else next.add(unidade.id);
                          return next;
                        })}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 15, fontWeight: 700, color: '#222' }}>{unidade.nome_unidade}</span>
                            {!unidade.ativa && <span style={{ fontSize: 10, background: '#ffebee', color: '#c62828', padding: '1px 7px', borderRadius: 10, fontWeight: 600 }}>INATIVA</span>}
                          </div>
                          <div style={{ fontSize: 12, color: '#666', marginTop: 3, display: 'flex', gap: 12 }}>
                            {unidade.endereco && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IconMapPin size={11} />{unidade.endereco}</span>}
                            {unidade.contato_responsavel && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><IconUser size={11} />{unidade.contato_responsavel}</span>}
                            <span style={{ color: '#2e6b32', fontWeight: 600 }}>{totalVagas} cooperado{totalVagas !== 1 ? 's' : ''} ativos</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(ev) => ev.stopPropagation()}>
                          {temPermissao('parametro.unidades') && (
                            <>
                              <button className="btn-secundario" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => abrirEditarUnidade(unidade)}>Editar</button>
                              <button className="btn-secundario" style={{ fontSize: 11, padding: '3px 10px', color: unidade.ativa ? '#c62828' : '#2e7d32' }}
                                onClick={() => handleAlternarUnidade(unidade)}>
                                {unidade.ativa ? 'Inativar' : 'Ativar'}
                              </button>
                            </>
                          )}
                          <span style={{ color: '#ccc', fontSize: 16 }}>{expandida ? '▲' : '▼'}</span>
                        </div>
                      </div>

                      {/* Conteúdo expandido */}
                      {expandida && (
                        <div style={{ padding: '14px 18px' }}>
                          {unidade.observacoes && (
                            <p style={{ fontSize: 12, color: '#666', marginBottom: 12, fontStyle: 'italic' }}>{unidade.observacoes}</p>
                          )}

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#444', textTransform: 'uppercase' }}>
                              Vagas ({unidade.vagas.length})
                            </span>
                            {temPermissao('parametro.vagas') && (
                              <IonButton size="small" shape="round" fill="outline" color="secondary" onClick={() => abrirNovaVaga(unidade.id)}>
                                + Vaga
                              </IonButton>
                            )}
                          </div>

                          {unidade.vagas.length === 0 && (
                            <div style={{ color: '#aaa', fontSize: 12, padding: '8px 0' }}>Nenhuma vaga cadastrada.</div>
                          )}

                          {unidade.vagas.length > 0 && (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                                <thead>
                                  <tr style={{ background: '#f8f9fa' }}>
                                    {['Cargo', 'Qtd', 'Salário', 'VR/dia', 'VT/dia', 'DSR', 'Periodicidade', 'Escala', 'Status', 'Ações'].map((h) => (
                                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {unidade.vagas.map((vaga) => (
                                    <tr key={vaga.id} style={{ borderBottom: '1px solid #f0f0f0', opacity: vaga.ativa ? 1 : 0.5 }}>
                                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#222', minWidth: 160 }}>
                                        {vaga.cargo}
                                        {vaga.cbo && <span style={{ fontSize: 11, color: '#1565c0', fontWeight: 700, marginLeft: 6 }}>({vaga.cbo})</span>}
                                        <div style={{ fontSize: 10, color: '#888', fontWeight: 400, marginTop: 2 }}>
                                          {vaga.adicional_noturno && '🌙 '}
                                          {vaga.periculosidade && <><IconAlert size={10} style={{ marginRight: 2 }} />Perig. </>}
                                          {vaga.insalubridade !== 'sem_risco' && `${ROTULO_INSALUBRIDADE[vaga.insalubridade]} `}
                                          {vaga.premio_incentivo > 0 && <><IconTarget size={10} style={{ marginRight: 2 }} />+{formatarMoeda(vaga.premio_incentivo)}</>}
                                        </div>
                                      </td>
                                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#2e6b32', textAlign: 'center' }}>{vaga.quantidade}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatarMoeda(vaga.salario_base)}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatarMoeda(vaga.valor_vr_dia)}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatarMoeda(vaga.valor_vt_dia)}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{vaga.dsr_percentual != null ? Number(vaga.dsr_percentual).toFixed(2) : '—'}%</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{ROTULO_PERIODICIDADE[vaga.periodicidade]}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{ROTULO_ESCALA[vaga.tipo_escala as TipoEscalaParam] ?? vaga.tipo_escala}</td>
                                      <td style={{ padding: '8px 10px' }}>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                                          background: vaga.ativa ? '#e8f5e9' : '#ffebee', color: vaga.ativa ? '#2e7d32' : '#c62828' }}>
                                          {vaga.ativa ? 'Ativa' : 'Inativa'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '6px 10px', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                          <div style={{ display: 'flex', gap: 3 }}>
                                            {temPermissao('parametro.escalas') && (
                                              <button title="Agenda" style={{ padding: '3px 8px', background: '#f3e5f5', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#6a1b9a', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                                                onClick={() => abrirAgenda(vaga)}><IconCalendar size={12} />Agenda</button>
                                            )}
                                            {temPermissao('parametro.vagas') && (
                                              <button title="Incremento" style={{ padding: '3px 8px', background: '#e3f2fd', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#1565c0', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                                                onClick={() => abrirIncremento(vaga)}><IconSettings size={12} />Vagas</button>
                                            )}
                                          </div>
                                          {temPermissao('parametro.vagas') && (
                                            <div style={{ display: 'flex', gap: 3 }}>
                                              <button title="Editar" style={{ padding: '3px 8px', background: '#f5f5f5', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#333', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                                                onClick={() => abrirEditarVaga(vaga)}><IconEdit size={12} />Editar</button>
                                              <button title={vaga.ativa ? 'Inativar' : 'Ativar'} style={{ padding: '3px 8px', background: vaga.ativa ? '#ffebee' : '#e8f5e9', border: 'none', borderRadius: 4, cursor: 'pointer', color: vaga.ativa ? '#c62828' : '#2e7d32', display: 'flex', alignItems: 'center', gap: 3, fontSize: 11 }}
                                                onClick={() => handleAlternarVaga(vaga)}>
                                                {vaga.ativa ? '⏸ Inativar' : '▶ Ativar'}
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            );
          })()}
        </div>
      </div>

      {/* ══ Modal: Nova / Editar Ficha ══ */}
      <IonModal className="modal-grande" isOpen={showFormUnidade} onDidDismiss={() => setShowFormUnidade(false)}>
        <div className="modal-form">
          <h2>{editandoUnidade ? 'Editar Ficha' : 'Nova Ficha de Serviço'}</h2>
          <div className="form-field">
            <label>Nome da unidade / ficha *</label>
            <input className="form-input" value={formUnidade.nomeUnidade} onChange={(e) => setFormUnidade((p) => ({ ...p, nomeUnidade: e.target.value }))} placeholder="Ex: UTI — Bloco A" />
          </div>
          <div className="form-section-title">Endereço (opcional)</div>
          <div className="form-row">
            <div className="form-field form-field-small">
              <label>CEP</label>
              <input
                className="form-input"
                value={formUnidade.cep}
                placeholder="00000-000"
                onChange={(e) => setFormUnidade((p) => ({ ...p, cep: formatarCEP(e.target.value) }))}
                onBlur={handleCepUnidadeBlur}
              />
              {buscandoCepUnidade && <span className="form-hint">Buscando endereço...</span>}
            </div>
            <div className="form-field">
              <label>Rua</label>
              <input className="form-input" value={formUnidade.rua} onChange={(e) => setFormUnidade((p) => ({ ...p, rua: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field form-field-small">
              <label>Número</label>
              <input className="form-input" value={formUnidade.numero} onChange={(e) => setFormUnidade((p) => ({ ...p, numero: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Complemento</label>
              <input className="form-input" value={formUnidade.complemento} onChange={(e) => setFormUnidade((p) => ({ ...p, complemento: e.target.value }))} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Bairro</label>
              <input className="form-input" value={formUnidade.bairro} onChange={(e) => setFormUnidade((p) => ({ ...p, bairro: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Cidade</label>
              <input className="form-input" value={formUnidade.cidade} onChange={(e) => setFormUnidade((p) => ({ ...p, cidade: e.target.value }))} />
            </div>
            <div className="form-field form-field-small">
              <label>UF</label>
              <input className="form-input" value={formUnidade.uf} maxLength={2} onChange={(e) => setFormUnidade((p) => ({ ...p, uf: e.target.value.toUpperCase() }))} />
            </div>
          </div>
          <div className="form-field">
            <label>Contato / Responsável</label>
            <input className="form-input" value={formUnidade.contatoResponsavel} onChange={(e) => setFormUnidade((p) => ({ ...p, contatoResponsavel: e.target.value }))} />
          </div>
          <div className="form-field">
            <label>Observações</label>
            <textarea className="form-input form-textarea" rows={3} value={formUnidade.observacoes} onChange={(e) => setFormUnidade((p) => ({ ...p, observacoes: e.target.value }))} />
          </div>
          {erroModal && <p className="form-erro">{erroModal}</p>}
          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowFormUnidade(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={handleSalvarUnidade} disabled={salvandoUnidade}>
              {salvandoUnidade ? 'Salvando...' : 'Salvar ficha'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* ══ Modal: Nova / Editar Vaga ══ */}
      <IonModal className="modal-grande" isOpen={showFormVaga} onDidDismiss={() => setShowFormVaga(false)}>
        <div className="modal-form">
          <h2>{editandoVaga ? 'Editar Vaga' : 'Nova Vaga'}</h2>

          {/* Pré-preenchimento a partir do cadastro primário */}
          {!editandoVaga && atividadesPrimarias.length > 0 && (
            <div className="form-field" style={{ background: '#f0f7f0', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
              <label style={{ color: '#2e6b32', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><IconClipboard size={14} />Pré-preencher do cadastro primário</label>
              <select className="form-input" style={{ marginTop: 6 }} defaultValue=""
                onChange={(e) => { if (e.target.value) preencherDeCadastroPrimario(Number(e.target.value)); }}>
                <option value="">— Selecione uma atividade como modelo —</option>
                {atividadesPrimarias.map((a) => (
                  <option key={a.id} value={a.id}>{a.trabalho_titulo} · {a.cargo} ({a.quantidade} vaga{a.quantidade !== 1 ? 's' : ''})</option>
                ))}
              </select>
              <span className="form-hint">Selecionar preenche os campos com os valores padrão — você pode editá-los.</span>
            </div>
          )}

          <div className="form-row">
            <div className="form-field" style={{ flex: 2 }}>
              <label>Cargo / Função *</label>
              <input className="form-input" value={formVaga.cargo} onChange={(e) => setFormVaga((p) => ({ ...p, cargo: e.target.value }))} placeholder="Ex: Técnico de Enfermagem" />
            </div>
            <div className="form-field" style={{ flex: 1 }}>
              <label>CBO</label>
              <input className="form-input" value={formVaga.cbo ?? ''} onChange={(e) => setFormVaga((p) => ({ ...p, cbo: e.target.value }))} placeholder="Ex: 3222-05" />
            </div>
            <div className="form-field form-field-small">
              <label>Quantidade</label>
              <input className="form-input" type="number" min={1} value={formVaga.quantidade} onChange={(e) => setFormVaga((p) => ({ ...p, quantidade: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Salário base (R$)</label>
              <input className="form-input" type="number" min={0} step="0.01" value={formVaga.salarioBase ?? ''} onChange={(e) => setFormVaga((p) => ({ ...p, salarioBase: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
            <div className="form-field">
              <label>Escala</label>
              <select className="form-input" value={formVaga.tipoEscala} onChange={(e) => setFormVaga((p) => ({ ...p, tipoEscala: e.target.value as TipoEscalaParam }))}>
                {(Object.entries(ROTULO_ESCALA) as [TipoEscalaParam, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Periodicidade</label>
              <select className="form-input" value={formVaga.periodicidade} onChange={(e) => setFormVaga((p) => ({ ...p, periodicidade: e.target.value as PeriodicidadeParam }))}>
                {(Object.entries(ROTULO_PERIODICIDADE) as [PeriodicidadeParam, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>VR / dia (R$)</label>
              <input className="form-input" type="number" min={0} step="0.01" value={formVaga.valorVrDia ?? 0} onChange={(e) => setFormVaga((p) => ({ ...p, valorVrDia: Number(e.target.value) }))} />
            </div>
            <div className="form-field">
              <label>VT / dia (R$)</label>
              <input className="form-input" type="number" min={0} step="0.01" value={formVaga.valorVtDia ?? 0} onChange={(e) => setFormVaga((p) => ({ ...p, valorVtDia: Number(e.target.value) }))} />
            </div>
            <div className="form-field">
              <label>DSR (%)</label>
              <input className="form-input" type="number" min={0} max={100} step="0.01" value={formVaga.dsrPercentual ?? 16.67} onChange={(e) => setFormVaga((p) => ({ ...p, dsrPercentual: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Insalubridade</label>
              <select className="form-input" value={formVaga.insalubridade} onChange={(e) => setFormVaga((p) => ({ ...p, insalubridade: e.target.value as TipoInsalubridadeParam }))}>
                {(Object.entries(ROTULO_INSALUBRIDADE) as [TipoInsalubridadeParam, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Prêmio incentivo (R$)</label>
              <input className="form-input" type="number" min={0} step="0.01" value={formVaga.premioIncentivo ?? 0} onChange={(e) => setFormVaga((p) => ({ ...p, premioIncentivo: Number(e.target.value) }))} />
            </div>
          </div>

          {/* Ficha do cooperado */}
          <div className="form-section-title" style={{ marginTop: 12 }}>Ficha do Cooperado</div>
          <div className="form-row">
            <div className="form-field form-field-small">
              <label>Pausa (min)</label>
              <input className="form-input" type="number" min={0} value={formVaga.tempoPausa ?? ''} placeholder="—"
                onChange={(e) => setFormVaga((p) => ({ ...p, tempoPausa: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
            <div className="form-field form-field-small">
              <label>Refeição (min)</label>
              <input className="form-input" type="number" min={0} value={formVaga.tempoRefeicao ?? ''} placeholder="—"
                onChange={(e) => setFormVaga((p) => ({ ...p, tempoRefeicao: e.target.value ? Number(e.target.value) : undefined }))} />
            </div>
            <div className="form-field">
              <label>Recebe por</label>
              <select className="form-input" value={formVaga.recebePor ?? 'mes'}
                onChange={(e) => setFormVaga((p) => ({ ...p, recebePor: e.target.value as 'dia' | 'mes' }))}>
                <option value="mes">Mês</option>
                <option value="dia">Dia</option>
              </select>
            </div>
          </div>

          <div className="form-row" style={{ gap: 20, marginTop: 4 }}>
            {[
              { label: 'Adicional noturno', key: 'adicionalNoturno' as const },
              { label: 'Periculosidade', key: 'periculosidade' as const },
              { label: 'Desconta pausa', key: 'descontaPausa' as const },
              { label: 'Desconta refeição', key: 'descontaRefeicao' as const },
            ].map(({ label, key }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={Boolean(formVaga[key])} onChange={(e) => setFormVaga((p) => ({ ...p, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
          </div>

          {/* Data de início — gera agenda automaticamente */}
          <div className="form-section-title" style={{ marginTop: 12 }}>Agenda de Operação *</div>
          <div className="form-field">
            <label>Data de início da operação *</label>
            <input className="form-input" type="date" value={formVaga.dataInicio ?? ''}
              onChange={(e) => setFormVaga((p) => ({ ...p, dataInicio: e.target.value }))} />
            <span className="form-hint">
              Ao salvar, o sistema gera automaticamente as datas de plantão (12x36) para os próximos 3 meses, já marcando feriados nacionais.
              A agenda fica disponível para validação e ajuste pela área responsável.
            </span>
          </div>

          {erroModal && <p className="form-erro">{erroModal}</p>}
          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowFormVaga(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={handleSalvarVaga} disabled={salvandoVaga}>
              {salvandoVaga ? 'Salvando...' : 'Salvar vaga'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* ══ Modal: Incremento ══ */}
      <IonModal className="modal-grande" isOpen={showIncremento} onDidDismiss={() => setShowIncremento(false)}
        style={{ '--width': '420px', '--height': 'auto' } as React.CSSProperties}>
        <div className="modal-form">
          <h2>Incremento de Vaga</h2>
          {vagaIncremento && (
            <p className="painel-subtitle" style={{ fontSize: 15, marginBottom: 20 }}>
              {vagaIncremento.cargo}
              <span style={{ fontWeight: 400, color: '#888', marginLeft: 8 }}>— Qtd atual: <strong style={{ color: '#222' }}>{vagaIncremento.quantidade}</strong></span>
            </p>
          )}

          <div className="form-field">
            <label>Data do incremento</label>
            <input className="form-input" type="date" value={formIncremento.dataIncremento} max={dataHoje()}
              onChange={(e) => setFormIncremento((p) => ({ ...p, dataIncremento: e.target.value }))} />
          </div>

          <div className="form-field">
            <label>Variação <span style={{ fontWeight: 400, color: '#888', fontSize: 12 }}>(positivo = aumento · negativo = redução)</span></label>
            <input className="form-input" type="number" value={formIncremento.delta}
              onChange={(e) => setFormIncremento((p) => ({ ...p, delta: Number(e.target.value) }))} />
            {vagaIncremento && formIncremento.delta !== 0 && (
              <span className="form-hint" style={{ color: formIncremento.delta > 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                Novo total: {vagaIncremento.quantidade + formIncremento.delta}
              </span>
            )}
          </div>

          <div className="form-field">
            <label>Motivo <span style={{ fontWeight: 400, color: '#888', fontSize: 12 }}>(opcional)</span></label>
            <textarea className="form-input form-textarea" rows={3} value={formIncremento.motivo}
              onChange={(e) => setFormIncremento((p) => ({ ...p, motivo: e.target.value }))}
              placeholder="Descreva o motivo..." />
          </div>

          {incrementoHistorico.length > 0 && (
            <>
              <div className="form-section-title">Histórico de Incrementos</div>
              <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 12 }}>
                {incrementoHistorico.map((inc) => (
                  <div key={inc.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
                    <span style={{ color: '#888', whiteSpace: 'nowrap' }}>{formatarDataBR(inc.data_incremento)}</span>
                    <span style={{ fontWeight: 600, color: inc.quantidade_nova > inc.quantidade_anterior ? '#2e7d32' : '#c62828' }}>
                      {inc.quantidade_anterior} → {inc.quantidade_nova} ({inc.quantidade_nova > inc.quantidade_anterior ? '+' : ''}{inc.quantidade_nova - inc.quantidade_anterior})
                    </span>
                    <span style={{ color: '#555' }}>{inc.motivo || '—'}</span>
                    <span style={{ color: '#aaa', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{inc.registrado_por_nome}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {erroModal && <p className="form-erro">{erroModal}</p>}
          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowIncremento(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={handleSalvarIncremento} disabled={salvandoIncremento || formIncremento.delta === 0}>
              {salvandoIncremento ? 'Registrando...' : 'Registrar'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* ══ Modal: Confirmação de status ══ */}
      <IonModal isOpen={showConfirmaStatus} onDidDismiss={() => setShowConfirmaStatus(false)}
        style={{ '--width': '400px', '--height': 'auto' } as React.CSSProperties}>
        <div className="modal-form">
          <h2>Alterar status</h2>
          <p style={{ fontSize: 14, color: '#333' }}>
            Confirma alterar o status de <strong>{empresaSel?.status}</strong> para <strong>{novoStatus}</strong>?
          </p>
          <p style={{ fontSize: 12, color: '#888' }}>Esta ação será registrada no log de ações da empresa.</p>
          {erroModal && <p className="form-erro">{erroModal}</p>}
          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowConfirmaStatus(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={handleAlterarStatus}>Confirmar</IonButton>
          </div>
        </div>
      </IonModal>

      {/* ══ Modal: Agenda de Operação ══ */}
      <IonModal className="modal-grande" isOpen={showAgenda} onDidDismiss={() => { setShowAgenda(false); setErroModal(''); }}>
        <div className="modal-form">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
            <h2 style={{ margin: 0 }}>Agenda de Operação</h2>
            {vagaAgenda?.data_inicio && (
              <IonButton size="small" fill="outline" shape="round" disabled={regerandoAgenda}
                onClick={handleRegerarAgenda}>
                {regerandoAgenda ? 'Regerando...' : '↺ Regerar agenda'}
              </IonButton>
            )}
          </div>
          {vagaAgenda && (
            <p className="painel-subtitle">
              {vagaAgenda.cargo} · Plantão 12x36
              {vagaAgenda.data_inicio ? ` · Início: ${formatarDataBR(vagaAgenda.data_inicio)}` : ''}
            </p>
          )}

          {/* Aviso de validação */}
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#7b5800', display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <IconAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} />Revise as datas geradas automaticamente. Feriados já estão marcados. Clique no status de cada data para confirmar, cancelar ou marcar como feriado conforme a necessidade da operação.
          </div>

          {/* Legenda */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            {(Object.entries(STATUS_AGENDA_COR) as [StatusAgendaParam, typeof STATUS_AGENDA_COR[StatusAgendaParam]][]).map(([k, v]) => (
              <span key={k} style={{ fontSize: 11, padding: '2px 10px', borderRadius: 10, background: v.bg, color: v.color, fontWeight: 600 }}>{v.label}</span>
            ))}
            <span style={{ fontSize: 11, color: '#888', marginLeft: 'auto' }}>Clique no status para alternar</span>
          </div>

          {carregandoAgenda && <p style={{ color: '#888', fontSize: 13 }}>Carregando agenda...</p>}
          {!carregandoAgenda && agenda.length === 0 && (
            <p style={{ color: '#aaa', fontSize: 13 }}>
              Nenhuma data na agenda. {vagaAgenda?.data_inicio ? 'Clique em "Regerar agenda" para gerar novamente.' : 'Configure a data de início na edição da vaga.'}
            </p>
          )}

          {agenda.length > 0 && (() => {
            // Agrupar por mês
            const porMes: Record<string, AgendaItem[]> = {};
            for (const item of agenda) {
              const mes = item.data_operacao.substring(0, 7);
              if (!porMes[mes]) porMes[mes] = [];
              porMes[mes].push(item);
            }
            return (
              <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                {Object.entries(porMes).map(([mes, itens]) => {
                  const [ano, m] = mes.split('-');
                  const nomeMes = new Date(Number(ano), Number(m) - 1, 1).toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
                  return (
                    <div key={mes} style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #eee' }}>
                        {nomeMes} ({itens.length} dias)
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {itens.map((item) => {
                          const cor = STATUS_AGENDA_COR[item.status as StatusAgendaParam] ?? STATUS_AGENDA_COR['previsto'];
                          const [, , dia] = item.data_operacao.split('-');
                          const dow = new Date(item.data_operacao + 'T12:00:00').toLocaleString('pt-BR', { weekday: 'short' });
                          const proxStatus: StatusAgendaParam = item.status === 'previsto' ? 'confirmado'
                            : item.status === 'confirmado' ? 'cancelado'
                            : item.status === 'feriado' ? 'feriado' : 'previsto';
                          return (
                            <button
                              key={item.id}
                              title={`${cor.label}${item.observacoes ? ' — ' + item.observacoes : ''}${item.status !== 'feriado' ? '\nClique para → ' + STATUS_AGENDA_COR[proxStatus].label : ''}`}
                              disabled={item.status === 'feriado'}
                              onClick={() => item.status !== 'feriado' && handleStatusAgenda(item, proxStatus)}
                              style={{
                                width: 52, padding: '6px 4px', borderRadius: 8, border: `1px solid ${cor.color}44`,
                                background: cor.bg, color: cor.color, cursor: item.status === 'feriado' ? 'default' : 'pointer',
                                textAlign: 'center', fontSize: 12, fontWeight: 600, lineHeight: 1.3,
                              }}
                            >
                              <div style={{ fontSize: 16, fontWeight: 700 }}>{dia}</div>
                              <div style={{ fontSize: 9, textTransform: 'uppercase', opacity: 0.8 }}>{dow}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {erroModal && <p className="form-erro">{erroModal}</p>}
          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowAgenda(false)}>Fechar</IonButton>
          </div>
        </div>
      </IonModal>

      {/* ══ Modal: Log de ações ══ */}
      <IonModal className="modal-grande" isOpen={showLog} onDidDismiss={() => setShowLog(false)}>
        <div className="modal-form">
          <h2>Log de Ações — {empresaSel?.nome_empresa}</h2>
          {carregandoLog && <p style={{ color: '#888', fontSize: 13 }}>Carregando...</p>}
          {!carregandoLog && log.length === 0 && <p style={{ color: '#aaa', fontSize: 13 }}>Nenhuma ação registrada.</p>}
          <div style={{ maxHeight: 500, overflowY: 'auto' }}>
            {log.map((item) => (
              <div key={item.id} style={{ padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 120, fontSize: 11, color: '#888', paddingTop: 2 }}>
                    {new Date(item.criado_em).toLocaleString('pt-BR')}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, background: '#e8f5e9', color: '#2e6b32', padding: '1px 8px', borderRadius: 10, fontWeight: 600 }}>
                        {ROTULO_ACAO[item.acao] ?? item.acao}
                      </span>
                      <span style={{ fontSize: 11, color: '#888' }}>{item.usuario_nome}</span>
                    </div>
                    <p style={{ fontSize: 13, color: '#333', margin: 0 }}>{item.descricao}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowLog(false)}>Fechar</IonButton>
          </div>
        </div>
      </IonModal>
    </div>
  );
};

export default Parametro;
