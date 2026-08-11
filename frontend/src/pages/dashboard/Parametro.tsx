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

  const abrirEditarUnidade = (u: UnidadeParametro) => {
    setEditandoUnidade(u);
    // Endereço antigo (string livre) vai para rua para não perder dados
    setFormUnidade({ nomeUnidade: u.nome_unidade, cep: '', rua: u.endereco ?? '', numero: '', complemento: '', bairro: '', cidade: '', uf: '', contatoResponsavel: u.contato_responsavel ?? '', observacoes: u.observacoes ?? '' });
    setErroModal('');
    setShowFormUnidade(true);
  };

  const handleCepUnidadeBlur = async () => {
    if (!formUnidade.cep) return;
    setBuscandoCepUnidade(true);
    const end = await buscarEnderecoPorCep(formUnidade.cep);
    setBuscandoCepUnidade(false);
    if (end) setFormUnidade((p) => ({ ...p, rua: end.rua || p.rua, bairro: end.bairro || p.bairro, cidade: end.cidade || p.cidade, uf: end.uf || p.uf }));
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
      tipoEscala: at.tipo_escala ?? 'plantao',
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
      await regerarAgendaVaga(vagaAgenda.id, vagaAgenda.unidade_id, empresaSel.id, vagaAgenda.tipo_escala, vagaAgenda.data_inicio);
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
              placeholder="🔍 Buscar empresa..."
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
        <div>
          {!empresaSel && !carregandoDetalhe && (
            <div style={{
              background: '#ffffff', borderRadius: 14,
              boxShadow: '0 2px 10px rgba(0,0,0,0.06)', border: '1px solid #e0e0e0',
              padding: 40, textAlign: 'center', color: '#888',
            }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
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
                      <h2 style={{ margin: '0 0 8px', fontSize: 20, color: '#1a1a1a' }}>{empresaSel.nome_empresa}</h2>
                      <div style={{ fontSize: 13, color: '#555', display: 'flex', gap: 20, flexWrap: 'wrap', marginBottom: 6 }}>
                        {empresaSel.cnpj && <span>CNPJ: {formatarCNPJ(empresaSel.cnpj)}</span>}
                        {empresaSel.cpf && <span>CPF: {formatarCPF(empresaSel.cpf)}</span>}
                        {empresaSel.executivo_nome && <span>Executivo: {empresaSel.executivo_nome}</span>}
                        {empresaSel.regiao_nome && <span>Região: {empresaSel.regiao_nome}</span>}
                        {empresaSel.representante && <span>Representante: {empresaSel.representante}</span>}
                      </div>
                      <div style={{ fontSize: 13, color: '#555', display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                        {empresaSel.email_empresa && <span>✉ {empresaSel.email_empresa}</span>}
                        {empresaSel.whatsapp && <span>📱 {formatarTelefone(empresaSel.whatsapp)}</span>}
                        {empresaSel.telefone_empresa && <span>☎ {formatarTelefone(empresaSel.telefone_empresa)}</span>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10, flexShrink: 0 }}>
                      <span style={{ fontSize: 13, padding: '5px 14px', borderRadius: 20, background: cor.bg, color: cor.color, fontWeight: 700, border: `1px solid ${cor.color}33` }}>
                        {empresaSel.status}
                      </span>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        {['Ativo', 'Inativo', 'Suspenso'].filter((s) => s !== empresaSel.status).map((s) => (
                          <button key={s} className="btn-secundario" style={{ fontSize: 12, padding: '4px 12px' }}
                            onClick={() => { setNovoStatus(s); setErroModal(''); setShowConfirmaStatus(true); }}>
                            {s}
                          </button>
                        ))}
                        <button className="btn-secundario" style={{ fontSize: 12, padding: '4px 12px' }} onClick={abrirLog}>Ver log</button>
                        <button className="btn-secundario" style={{ fontSize: 12, padding: '4px 12px' }} onClick={exportarCSV} title="Exportar vagas em CSV (abre no Excel)">📥 Exportar</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Erro inline (ativa/inativa) ── */}
                {erro && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#c62828' }}>
                    <span style={{ flex: 1 }}>⚠ {erro}</span>
                    <button onClick={() => setErro('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#c62828', fontWeight: 700, fontSize: 16, lineHeight: 1, padding: 0 }}>×</button>
                  </div>
                )}

                {/* ── Fichas ── */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    Fichas de Serviço ({empresaSel.unidades.length})
                  </h3>
                  <IonButton size="small" shape="round" color="secondary" onClick={abrirNovaUnidade}>+ Nova Ficha</IonButton>
                </div>

                {empresaSel.unidades.length === 0 && (
                  <div style={{ background: '#fff', borderRadius: 14, border: '1px dashed #ccc', padding: 32, textAlign: 'center', color: '#888', fontSize: 13 }}>
                    Nenhuma ficha cadastrada. Clique em "+ Nova Ficha" para começar.
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
                            {unidade.endereco && <span>📍 {unidade.endereco}</span>}
                            {unidade.contato_responsavel && <span>👤 {unidade.contato_responsavel}</span>}
                            <span style={{ color: '#2e6b32', fontWeight: 600 }}>{totalVagas} cooperado{totalVagas !== 1 ? 's' : ''} ativos</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(ev) => ev.stopPropagation()}>
                          <button className="btn-secundario" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => abrirEditarUnidade(unidade)}>Editar</button>
                          <button className="btn-secundario" style={{ fontSize: 11, padding: '3px 10px', color: unidade.ativa ? '#c62828' : '#2e7d32' }}
                            onClick={() => handleAlternarUnidade(unidade)}>
                            {unidade.ativa ? 'Inativar' : 'Ativar'}
                          </button>
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
                            <IonButton size="small" shape="round" fill="outline" color="secondary" onClick={() => abrirNovaVaga(unidade.id)}>
                              + Vaga
                            </IonButton>
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
                                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#222' }}>
                                        {vaga.cargo}
                                        <div style={{ fontSize: 10, color: '#888', fontWeight: 400, marginTop: 1 }}>
                                          {vaga.adicional_noturno && '🌙 '}
                                          {vaga.periculosidade && '⚠ Perig. '}
                                          {vaga.insalubridade !== 'sem_risco' && `🔬 ${ROTULO_INSALUBRIDADE[vaga.insalubridade]} `}
                                          {vaga.premio_incentivo > 0 && `🎯 +${formatarMoeda(vaga.premio_incentivo)}`}
                                        </div>
                                      </td>
                                      <td style={{ padding: '8px 10px', fontWeight: 700, color: '#2e6b32', textAlign: 'center' }}>{vaga.quantidade}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatarMoeda(vaga.salario_base)}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatarMoeda(vaga.valor_vr_dia)}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{formatarMoeda(vaga.valor_vt_dia)}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{vaga.dsr_percentual?.toFixed(2)}%</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{ROTULO_PERIODICIDADE[vaga.periodicidade]}</td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>{ROTULO_ESCALA[vaga.tipo_escala]}</td>
                                      <td style={{ padding: '8px 10px' }}>
                                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                                          background: vaga.ativa ? '#e8f5e9' : '#ffebee', color: vaga.ativa ? '#2e7d32' : '#c62828' }}>
                                          {vaga.ativa ? 'Ativa' : 'Inativa'}
                                        </span>
                                      </td>
                                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                          <button title="Agenda" style={{ fontSize: 11, padding: '2px 8px', background: '#f3e5f5', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#6a1b9a' }}
                                            onClick={() => abrirAgenda(vaga)}>📅</button>
                                          <button title="Incremento" style={{ fontSize: 11, padding: '2px 8px', background: '#e3f2fd', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#1565c0' }}
                                            onClick={() => abrirIncremento(vaga)}>↕</button>
                                          <button title="Editar" style={{ fontSize: 11, padding: '2px 8px', background: '#f5f5f5', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#333' }}
                                            onClick={() => abrirEditarVaga(vaga)}>✎</button>
                                          <button title={vaga.ativa ? 'Inativar' : 'Ativar'} style={{ fontSize: 11, padding: '2px 8px', background: vaga.ativa ? '#ffebee' : '#e8f5e9', border: 'none', borderRadius: 4, cursor: 'pointer', color: vaga.ativa ? '#c62828' : '#2e7d32' }}
                                            onClick={() => handleAlternarVaga(vaga)}>
                                            {vaga.ativa ? '⏸' : '▶'}
                                          </button>
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
              <label style={{ color: '#2e6b32', fontWeight: 700 }}>📋 Pré-preencher do cadastro primário</label>
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
              <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                {(Object.entries(ROTULO_ESCALA) as [TipoEscalaParam, string][]).map(([k, v]) => (
                  <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer' }}>
                    <input type="radio" name="tipoEscala" value={k} checked={formVaga.tipoEscala === k} onChange={() => setFormVaga((p) => ({ ...p, tipoEscala: k }))} />
                    {v}
                  </label>
                ))}
              </div>
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
        style={{ '--width': '520px', '--height': 'auto' } as React.CSSProperties}>
        <div className="modal-form">
          <h2>Incremento de Vaga</h2>
          {vagaIncremento && (
            <p className="painel-subtitle">{vagaIncremento.cargo} — Quantidade atual: <strong>{vagaIncremento.quantidade}</strong></p>
          )}

          <div className="form-row">
            <div className="form-field form-field-small">
              <label>Variação (positivo = aumento, negativo = redução)</label>
              <input className="form-input" type="number" value={formIncremento.delta}
                onChange={(e) => setFormIncremento((p) => ({ ...p, delta: Number(e.target.value) }))} />
              {vagaIncremento && formIncremento.delta !== 0 && (
                <span className="form-hint">
                  Novo total: <strong>{vagaIncremento.quantidade + formIncremento.delta}</strong>
                </span>
              )}
            </div>
            <div className="form-field">
              <label>Data do incremento</label>
              <input className="form-input" type="date" value={formIncremento.dataIncremento} max={dataHoje()}
                onChange={(e) => setFormIncremento((p) => ({ ...p, dataIncremento: e.target.value }))} />
            </div>
          </div>

          <div className="form-field">
            <label>Motivo</label>
            <textarea className="form-input form-textarea" rows={2} value={formIncremento.motivo}
              onChange={(e) => setFormIncremento((p) => ({ ...p, motivo: e.target.value }))}
              placeholder="Descreva o motivo do incremento..." />
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
          <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '8px 12px', marginBottom: 14, fontSize: 13, color: '#7b5800' }}>
            ⚠ Revise as datas geradas automaticamente. Feriados já estão marcados. Clique no status de cada data para confirmar, cancelar ou marcar como feriado conforme a necessidade da operação.
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
                          const cor = STATUS_AGENDA_COR[item.status];
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
