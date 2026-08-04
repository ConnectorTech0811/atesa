import React, { useEffect, useState } from 'react';
import { IonButton, IonModal, useIonViewWillEnter } from '@ionic/react';
import {
  EmpresaResumoParametro,
  EmpresaDetalheParametro,
  UnidadeParametro,
  VagaParametro,
  LogAcao,
  NovaVaga,
  TipoEscalaParam,
  TipoInsalubridadeParam,
  PeriodicidadeParam,
  ROTULO_PERIODICIDADE,
  ROTULO_INSALUBRIDADE_PARAM,
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
} from '../../api/parametroApi';
import { formatarCNPJ, formatarCPF, formatarDataBR, formatarTelefone } from '../../utils/formatters';

// ── Utilitários ───────────────────────────────────────────────────────────────

const fmtMoeda = (v?: number | null) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

function dataHoje() {
  return new Date().toISOString().substring(0, 10);
}

const STATUS_COR: Record<string, { bg: string; color: string }> = {
  Ativo: { bg: '#e8f5e9', color: '#2e7d32' },
  Inativo: { bg: '#fce4ec', color: '#c62828' },
  Cadastrado: { bg: '#e3f2fd', color: '#1565c0' },
  Suspenso: { bg: '#fff8e1', color: '#e65100' },
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
  };
}

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
  const [formUnidade, setFormUnidade] = useState({ nomeUnidade: '', endereco: '', contatoResponsavel: '', observacoes: '' });
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
  const [incrementoHistorico, setIncrementoHistorico] = useState<ReturnType<typeof listarIncrementos> extends Promise<infer T> ? T : never>([]);
  const [salvandoIncremento, setSalvandoIncremento] = useState(false);

  // Log
  const [showLog, setShowLog] = useState(false);
  const [log, setLog] = useState<LogAcao[]>([]);
  const [carregandoLog, setCarregandoLog] = useState(false);

  // Status
  const [showConfirmaStatus, setShowConfirmaStatus] = useState(false);
  const [novoStatus, setNovoStatus] = useState('');

  const [erroModal, setErroModal] = useState('');

  // ── Carregamento ───────────────────────────────────────────────────────────

  const carregarEmpresas = async () => {
    setCarregando(true);
    setErro('');
    try {
      setEmpresas(await listarEmpresasParametro());
    } catch {
      setErro('Erro ao carregar empresas.');
    } finally {
      setCarregando(false);
    }
  };

  const carregarDetalhe = async (id: number) => {
    setCarregandoDetalhe(true);
    try {
      const detalhe = await obterEmpresaParametro(id);
      setEmpresaSel(detalhe);
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
    if (empresaSel?.id !== empresa.id) carregarDetalhe(empresa.id);
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
    setFormUnidade({ nomeUnidade: '', endereco: '', contatoResponsavel: '', observacoes: '' });
    setErroModal('');
    setShowFormUnidade(true);
  };

  const abrirEditarUnidade = (u: UnidadeParametro) => {
    setEditandoUnidade(u);
    setFormUnidade({ nomeUnidade: u.nome_unidade, endereco: u.endereco ?? '', contatoResponsavel: u.contato_responsavel ?? '', observacoes: u.observacoes ?? '' });
    setErroModal('');
    setShowFormUnidade(true);
  };

  const handleSalvarUnidade = async () => {
    if (!empresaSel || !formUnidade.nomeUnidade) { setErroModal('Nome da ficha é obrigatório.'); return; }
    setSalvandoUnidade(true);
    try {
      if (editandoUnidade) {
        await atualizarUnidade(editandoUnidade.id, empresaSel.id, formUnidade);
      } else {
        await criarUnidade(empresaSel.id, formUnidade);
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
    try {
      await alternarAtivacaoUnidade(u.id, empresaSel.id, !u.ativa);
      await carregarDetalhe(empresaSel.id);
    } catch {
      setErro('Erro ao alterar ficha.');
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
    setSalvandoVaga(true);
    try {
      if (editandoVaga) {
        await atualizarVaga(editandoVaga.id, vagaUnidadeId, empresaSel.id, formVaga);
      } else {
        await criarVaga(vagaUnidadeId, empresaSel.id, formVaga);
      }
      setShowFormVaga(false);
      await carregarDetalhe(empresaSel.id);
    } catch {
      setErroModal('Erro ao salvar vaga.');
    } finally {
      setSalvandoVaga(false);
    }
  };

  const handleAlternarVaga = async (vaga: VagaParametro) => {
    if (!empresaSel) return;
    try {
      await alternarAtivacaoVaga(vaga.id, vaga.unidade_id, empresaSel.id, !vaga.ativa);
      await carregarDetalhe(empresaSel.id);
    } catch {
      setErro('Erro ao alterar vaga.');
    }
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
    <div className="painel-page" style={{ display: 'flex', gap: 0, height: '100%', overflow: 'hidden' }}>
      {/* ── Painel esquerdo: lista de empresas ── */}
      <div style={{ width: 280, minWidth: 240, borderRight: '1px solid #e0e0e0', display: 'flex', flexDirection: 'column', background: '#fafafa', overflowY: 'auto' }}>
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid #eee', position: 'sticky', top: 0, background: '#fafafa', zIndex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2e6b32', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Parâmetro</div>
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
        {erro && !carregando && <div style={{ padding: 16, fontSize: 13, color: '#c62828' }}>{erro}</div>}

        <div style={{ flex: 1 }}>
          {empresasFiltradas.map((e) => {
            const ativa = empresaSel?.id === e.id;
            const cor = STATUS_COR[e.status] ?? { bg: '#f5f5f5', color: '#555' };
            return (
              <button
                key={e.id}
                onClick={() => selecionarEmpresa(e)}
                style={{
                  width: '100%', textAlign: 'left', padding: '10px 14px',
                  background: ativa ? '#e8f5e9' : 'transparent',
                  borderLeft: ativa ? '3px solid #2e6b32' : '3px solid transparent',
                  border: 'none', borderBottom: '1px solid #eee', cursor: 'pointer',
                }}
              >
                <div style={{ fontSize: 13, fontWeight: 600, color: ativa ? '#2e6b32' : '#222', marginBottom: 3 }}>{e.nome_empresa}</div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: cor.bg, color: cor.color, fontWeight: 600 }}>{e.status}</span>
                  <span style={{ fontSize: 11, color: '#888' }}>{e.total_unidades} ficha{e.total_unidades !== 1 ? 's' : ''}</span>
                </div>
              </button>
            );
          })}
          {!carregando && empresasFiltradas.length === 0 && (
            <div style={{ padding: 16, fontSize: 13, color: '#aaa' }}>Nenhuma empresa encontrada.</div>
          )}
        </div>
      </div>

      {/* ── Painel direito: detalhe da empresa ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
        {!empresaSel && !carregandoDetalhe && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#aaa', fontSize: 14 }}>
            ← Selecione uma empresa
          </div>
        )}
        {carregandoDetalhe && (
          <div style={{ color: '#888', fontSize: 13, padding: 20 }}>Carregando...</div>
        )}

        {empresaSel && !carregandoDetalhe && (() => {
          const cor = STATUS_COR[empresaSel.status] ?? { bg: '#f5f5f5', color: '#555' };
          return (
            <>
              {/* ── Cabeçalho do cliente ── */}
              <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10, padding: '16px 20px', marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h2 style={{ margin: 0, fontSize: 20, color: '#1a1a1a' }}>{empresaSel.nome_empresa}</h2>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {empresaSel.cnpj && <span>CNPJ: {formatarCNPJ(empresaSel.cnpj)}</span>}
                      {empresaSel.cpf && <span>CPF: {formatarCPF(empresaSel.cpf)}</span>}
                      {empresaSel.executivo_nome && <span>Executivo: {empresaSel.executivo_nome}</span>}
                      {empresaSel.regiao_nome && <span>Região: {empresaSel.regiao_nome}</span>}
                      {empresaSel.representante && <span>Representante: {empresaSel.representante}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                      {empresaSel.email_empresa && <span>✉ {empresaSel.email_empresa}</span>}
                      {empresaSel.whatsapp && <span>📱 {formatarTelefone(empresaSel.whatsapp)}</span>}
                      {empresaSel.telefone_empresa && <span>☎ {formatarTelefone(empresaSel.telefone_empresa)}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <span style={{ fontSize: 12, padding: '4px 12px', borderRadius: 20, background: cor.bg, color: cor.color, fontWeight: 700 }}>
                      {empresaSel.status}
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {['Ativo', 'Inativo', 'Suspenso'].map((s) => s !== empresaSel.status && (
                        <button key={s} className="btn-secundario" style={{ fontSize: 11, padding: '3px 10px' }}
                          onClick={() => { setNovoStatus(s); setErroModal(''); setShowConfirmaStatus(true); }}>
                          → {s}
                        </button>
                      ))}
                      <button className="btn-secundario" style={{ fontSize: 11 }} onClick={abrirLog}>Ver log</button>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Fichas ── */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 14, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Fichas de Serviço ({empresaSel.unidades.length})
                </h3>
                <IonButton size="small" shape="round" color="secondary" onClick={abrirNovaUnidade}>+ Nova Ficha</IonButton>
              </div>

              {empresaSel.unidades.length === 0 && (
                <div style={{ background: '#f5f5f5', borderRadius: 8, padding: 24, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                  Nenhuma ficha cadastrada. Clique em "+ Nova Ficha" para começar.
                </div>
              )}

              {empresaSel.unidades.map((unidade) => {
                const expandida = unidadesExpandidas.has(unidade.id);
                const vagasAtivas = unidade.vagas.filter((v) => v.ativa);
                const totalVagas = vagasAtivas.reduce((s, v) => s + v.quantidade, 0);

                return (
                  <div key={unidade.id} style={{
                    background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
                    marginBottom: 14, opacity: unidade.ativa ? 1 : 0.6,
                  }}>
                    {/* Header da ficha */}
                    <div
                      style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', borderBottom: expandida ? '1px solid #eee' : 'none' }}
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
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2, display: 'flex', gap: 12 }}>
                          {unidade.endereco && <span>📍 {unidade.endereco}</span>}
                          {unidade.contato_responsavel && <span>👤 {unidade.contato_responsavel}</span>}
                          <span style={{ color: '#2e6b32', fontWeight: 600 }}>{totalVagas} cooperado{totalVagas !== 1 ? 's' : ''} ativos</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
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
                      <div style={{ padding: '12px 16px' }}>
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
                                <tr style={{ background: '#f5f5f5' }}>
                                  {['Cargo', 'Qtd', 'Salário', 'VR/dia', 'VT/dia', 'DSR', 'Periodicidade', 'Escala', 'Status', 'Ações'].map((h) => (
                                    <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: '#555', whiteSpace: 'nowrap', borderBottom: '1px solid #e0e0e0' }}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {unidade.vagas.map((vaga) => (
                                  <tr key={vaga.id} style={{ borderBottom: '1px solid #f0f0f0', opacity: vaga.ativa ? 1 : 0.5 }}>
                                    <td style={{ padding: '7px 10px', fontWeight: 600, color: '#222' }}>
                                      {vaga.cargo}
                                      <div style={{ fontSize: 10, color: '#888', fontWeight: 400, marginTop: 1 }}>
                                        {vaga.adicional_noturno && '🌙 '}
                                        {vaga.periculosidade && '⚠ Perig. '}
                                        {vaga.insalubridade !== 'sem_risco' && `🔬 ${ROTULO_INSALUBRIDADE_PARAM[vaga.insalubridade]} `}
                                        {vaga.premio_incentivo > 0 && `🎯 +${fmtMoeda(vaga.premio_incentivo)}`}
                                      </div>
                                    </td>
                                    <td style={{ padding: '7px 10px', fontWeight: 700, color: '#2e6b32', textAlign: 'center' }}>{vaga.quantidade}</td>
                                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{fmtMoeda(vaga.salario_base)}</td>
                                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{fmtMoeda(vaga.valor_vr_dia)}</td>
                                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{fmtMoeda(vaga.valor_vt_dia)}</td>
                                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{vaga.dsr_percentual?.toFixed(2)}%</td>
                                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{ROTULO_PERIODICIDADE[vaga.periodicidade]}</td>
                                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{vaga.tipo_escala === 'plantao' ? 'Plantão 12x36' : 'Mensal'}</td>
                                    <td style={{ padding: '7px 10px' }}>
                                      <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 600,
                                        background: vaga.ativa ? '#e8f5e9' : '#ffebee', color: vaga.ativa ? '#2e7d32' : '#c62828' }}>
                                        {vaga.ativa ? 'Ativa' : 'Inativa'}
                                      </span>
                                    </td>
                                    <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>
                                      <div style={{ display: 'flex', gap: 4 }}>
                                        <button style={{ fontSize: 11, padding: '2px 8px', background: '#e3f2fd', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#1565c0' }}
                                          onClick={() => abrirIncremento(vaga)} title="Registrar incremento">↕</button>
                                        <button style={{ fontSize: 11, padding: '2px 8px', background: '#f5f5f5', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#333' }}
                                          onClick={() => abrirEditarVaga(vaga)}>✎</button>
                                        <button style={{ fontSize: 11, padding: '2px 8px', background: vaga.ativa ? '#ffebee' : '#e8f5e9', border: 'none', borderRadius: 4, cursor: 'pointer', color: vaga.ativa ? '#c62828' : '#2e7d32' }}
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

      {/* ══ Modal: Nova / Editar Ficha ══ */}
      <IonModal className="modal-grande" isOpen={showFormUnidade} onDidDismiss={() => setShowFormUnidade(false)}>
        <div className="modal-form">
          <h2>{editandoUnidade ? 'Editar Ficha' : 'Nova Ficha de Serviço'}</h2>
          <div className="form-field">
            <label>Nome da unidade / ficha *</label>
            <input className="form-input" value={formUnidade.nomeUnidade} onChange={(e) => setFormUnidade((p) => ({ ...p, nomeUnidade: e.target.value }))} placeholder="Ex: UTI — Bloco A" />
          </div>
          <div className="form-field">
            <label>Endereço</label>
            <input className="form-input" value={formUnidade.endereco} onChange={(e) => setFormUnidade((p) => ({ ...p, endereco: e.target.value }))} placeholder="Rua, número, bairro..." />
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
              <select className="form-input" value={formVaga.tipoEscala} onChange={(e) => setFormVaga((p) => ({ ...p, tipoEscala: e.target.value as TipoEscalaParam }))}>
                <option value="plantao">Plantão 12x36</option>
                <option value="mensal">Mensal</option>
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
                {(Object.entries(ROTULO_INSALUBRIDADE_PARAM) as [TipoInsalubridadeParam, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Prêmio incentivo (R$)</label>
              <input className="form-input" type="number" min={0} step="0.01" value={formVaga.premioIncentivo ?? 0} onChange={(e) => setFormVaga((p) => ({ ...p, premioIncentivo: Number(e.target.value) }))} />
            </div>
          </div>

          <div className="form-row" style={{ gap: 20, marginTop: 4 }}>
            {[
              { label: 'Adicional noturno', key: 'adicionalNoturno' as const },
              { label: 'Periculosidade', key: 'periculosidade' as const },
            ].map(({ label, key }) => (
              <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer' }}>
                <input type="checkbox" checked={formVaga[key]} onChange={(e) => setFormVaga((p) => ({ ...p, [key]: e.target.checked }))} />
                {label}
              </label>
            ))}
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
