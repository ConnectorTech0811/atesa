import React, { useEffect, useState } from 'react';
import {
  DetalhesCooperadoMonitoramento,
  ApontamentoDetalhado,
  obterDetalhesCooperadoMonitoramento,
  excluirComplemento,
} from '../../../api/monitoramentoApi';
import { formatarCPF, formatarTelefone } from '../../../utils/formatters';
import { useToast } from '../../../components/ToastContext';
import ModalEdicaoApontamento from './ModalEdicaoApontamento';
import ModalObservacaoApontamento from './ModalObservacaoApontamento';
import ModalLancamentoComplemento from './ModalLancamentoComplemento';
import ModalAlteracaoOperacao from './ModalAlteracaoOperacao';
import ModalResetSenhaCooperado from './ModalResetSenhaCooperado';

interface Props {
  candidatoId: number;
  onVoltar: () => void;
}

const formatarTipoEvento = (tipo?: string) => {
  if (!tipo) return 'Evento';
  const mapa: Record<string, string> = {
    deslocamento_inicio: 'A Caminho do Posto',
    deslocamento_fim: 'Chegada ao Posto',
    jornada_inicio: 'Início de Jornada',
    jornada_fim: 'Fim de Jornada',
    refeicao_inicio: 'Início de Refeição',
    refeicao_fim: 'Fim de Refeição',
    pausa_inicio: 'Início de Pausa',
    pausa_fim: 'Fim de Pausa',
    ajuste_manual: 'Ajuste Manual',
  };
  return mapa[tipo] || tipo.replace(/_/g, ' ');
};

export const MonitoramentoCooperadoDetalhe: React.FC<Props> = ({ candidatoId, onVoltar }) => {
  const { showToast } = useToast();
  const [detalhes, setDetalhes] = useState<DetalhesCooperadoMonitoramento | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<
    'dados' | 'apontamentos' | 'atividades_app' | 'horas' | 'bonificacoes' | 'historico_operacao' | 'auditoria' | 'acoes'
  >('dados');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Modais de ação
  const [apontamentoParaEditar, setApontamentoParaEditar] = useState<ApontamentoDetalhado | null>(null);
  const [apontamentoParaObs, setApontamentoParaObs] = useState<ApontamentoDetalhado | null>(null);
  const [modalComplementoAberto, setModalComplementoAberto] = useState(false);
  const [tipoComplementoPredefinido, setTipoComplementoPredefinido] = useState<
    'hora_adicional' | 'hora_extra' | 'adicional_noturno' | 'desconto' | 'bonificacao'
  >('hora_adicional');
  const [modalAlteracaoOperacaoAberto, setModalAlteracaoOperacaoAberto] = useState(false);
  const [modalResetSenhaAberto, setModalResetSenhaAberto] = useState(false);

  const carregarDados = async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await obterDetalhesCooperadoMonitoramento(candidatoId, {
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
      });
      setDetalhes(data);
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao carregar histórico do cooperado.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [candidatoId, dataInicio, dataFim]);

  const abrirLancamento = (tipo: 'hora_adicional' | 'hora_extra' | 'adicional_noturno' | 'desconto' | 'bonificacao') => {
    setTipoComplementoPredefinido(tipo);
    setModalComplementoAberto(true);
  };

  const handleExcluirComplemento = async (id: number) => {
    const motivo = window.prompt('Informe a justificativa para o cancelamento deste lançamento complementar:');
    if (!motivo || !motivo.trim()) {
      alert('A justificativa é obrigatória para cancelamento de lançamentos.');
      return;
    }
    try {
      await excluirComplemento(id, motivo.trim());
      showToast('Lançamento complementar cancelado com sucesso.', 'success');
      carregarDados();
    } catch (e: any) {
      alert(e.message || 'Erro ao excluir lançamento.');
    }
  };

  if (carregando && !detalhes) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
        Carregando monitoramento individual do cooperado...
      </div>
    );
  }

  if (erro || !detalhes) {
    return (
      <div style={{ padding: 24 }}>
        <button type="button" className="btn-secondary-filter" onClick={onVoltar} style={{ marginBottom: 16 }}>
          ← Voltar para Cooperados
        </button>
        <div style={{ padding: 20, background: '#fee2e2', color: '#991b1b', borderRadius: 10 }}>
          {erro || 'Cooperado não encontrado.'}
        </div>
      </div>
    );
  }

  const { cooperado, resumo, apontamentos, complementos = [], historicoOperacao = [], logsAuditoria = [] } = detalhes;

  const bonificacoes = complementos.filter((c) => c.tipo === 'bonificacao');
  const horasComplementares = complementos.filter((c) => c.tipo !== 'bonificacao');

  return (
    <div>
      {/* ── Botão Voltar e Filtros ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <button type="button" className="btn-secondary-filter" onClick={onVoltar} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Voltar para Cooperados
        </button>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            type="date"
            className="filter-input"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            title="Data início do filtro"
          />
          <span style={{ color: '#94a3b8' }}>até</span>
          <input
            type="date"
            className="filter-input"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            title="Data fim do filtro"
          />
          {(dataInicio || dataFim) && (
            <button
              type="button"
              className="btn-secondary-filter"
              onClick={() => { setDataInicio(''); setDataFim(''); }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>

      {/* ── Ficha Resumo do Cooperado ── */}
      <div className="cooperado-profile-card">
        <div className="profile-top-header">
          <div className="profile-user-main">
            <div className="profile-avatar-large">
              {cooperado.nome.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="profile-info-name">{cooperado.nome}</h2>
              <div className="profile-info-meta">
                <span>CPF: <strong>{formatarCPF(cooperado.cpf)}</strong></span>
                <span>Matrícula: <strong>{cooperado.matricula || `#${cooperado.id}`}</strong></span>
                {cooperado.telefone && <span>Telefone: {formatarTelefone(cooperado.telefone)}</span>}
                {cooperado.email && <span>E-mail: {cooperado.email}</span>}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {cooperado.status === 1 ? (
              <span className="badge-status badge-ativo" style={{ fontSize: 13, padding: '6px 14px' }}>
                <span className="badge-status-dot" /> Cooperado Ativo
              </span>
            ) : (
              <span className="badge-status badge-inativo" style={{ fontSize: 13, padding: '6px 14px' }}>
                <span className="badge-status-dot" /> Inativo
              </span>
            )}
            <button
              type="button"
              className="btn-action-view"
              onClick={() => setModalAlteracaoOperacaoAberto(true)}
              style={{ fontSize: 13, padding: '6px 12px' }}
            >
              Alterar Operação
            </button>
          </div>
        </div>

        {/* Informações da Operação Atual */}
        <div className="profile-grid-details">
          <div className="profile-detail-item">
            <span className="profile-detail-label">Operação / Tomador</span>
            <span className="profile-detail-val">{cooperado.alocacao?.empresaNome || 'Sem alocação ativa'}</span>
          </div>
          <div className="profile-detail-item">
            <span className="profile-detail-label">Unidade / Posto</span>
            <span className="profile-detail-val">{cooperado.alocacao?.unidadeNome || '—'}</span>
          </div>
          <div className="profile-detail-item">
            <span className="profile-detail-label">Vaga / Cargo</span>
            <span className="profile-detail-val">{cooperado.alocacao?.vagaCargo || '—'}</span>
          </div>
          <div className="profile-detail-item">
            <span className="profile-detail-label">Escala / Turno</span>
            <span className="profile-detail-val">
              {cooperado.alocacao?.vagaEscala || '—'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Cards de Indicadores do Cooperado ── */}
      <div className="monitoramento-cards-grid" style={{ marginBottom: 20 }}>
        <div className="metric-card card-purple">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Horas Trabalhadas</span>
            <div className="metric-card-icon">⏱️</div>
          </div>
          <div className="metric-card-value">{resumo.totalHoras}h</div>
          <div className="metric-card-subtitle">Apontamentos do app</div>
        </div>

        <div className="metric-card card-blue">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Horas Adicionais</span>
            <div className="metric-card-icon">➕</div>
          </div>
          <div className="metric-card-value">{resumo.horasAdicionais || '00:00'}h</div>
          <div className="metric-card-subtitle">Adicionais e extras</div>
        </div>

        <div className="metric-card card-teal">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Adicional Noturno</span>
            <div className="metric-card-icon">🌙</div>
          </div>
          <div className="metric-card-value">{resumo.adicionalNoturno || '00:00'}h</div>
          <div className="metric-card-subtitle">Jornada noturna</div>
        </div>

        <div className="metric-card card-rose">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Desconto de Horas</span>
            <div className="metric-card-icon">➖</div>
          </div>
          <div className="metric-card-value">{resumo.descontoHoras || '00:00'}h</div>
          <div className="metric-card-subtitle">Ausências / Descontos</div>
        </div>

        <div className="metric-card card-amber">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Bonificações</span>
            <div className="metric-card-icon">💰</div>
          </div>
          <div className="metric-card-value">R$ {(resumo.bonificacoesTotal || 0).toFixed(2)}</div>
          <div className="metric-card-subtitle">Prêmios e incentivos</div>
        </div>
      </div>

      {/* ── Navegação pelas 8 Abas do Cooperado ── */}
      <div className="monitoramento-tabs-nav" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className={`monitoramento-tab-btn ${abaAtiva === 'dados' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('dados')}
        >
          1. Dados & Operação
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${abaAtiva === 'apontamentos' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('apontamentos')}
        >
          2. Apontamentos
          <span className="monitoramento-tab-badge">{apontamentos.length}</span>
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${abaAtiva === 'atividades_app' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('atividades_app')}
        >
          3. Atividades (App)
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${abaAtiva === 'horas' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('horas')}
        >
          4. Horas & Complementos
          <span className="monitoramento-tab-badge">{horasComplementares.length}</span>
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${abaAtiva === 'bonificacoes' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('bonificacoes')}
        >
          5. Bonificações
          <span className="monitoramento-tab-badge">{bonificacoes.length}</span>
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${abaAtiva === 'historico_operacao' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('historico_operacao')}
        >
          6. Histórico da Operação
          <span className="monitoramento-tab-badge">{historicoOperacao.length}</span>
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${abaAtiva === 'auditoria' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('auditoria')}
        >
          7. Trilha de Auditoria
          <span className="monitoramento-tab-badge">{logsAuditoria.length}</span>
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${abaAtiva === 'acoes' ? 'active' : ''}`}
          onClick={() => setAbaAtiva('acoes')}
        >
          8. Ações Administrativas
        </button>
      </div>

      {/* ── 1. ABA DADOS & OPERAÇÃO ── */}
      {abaAtiva === 'dados' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="monitoramento-table-card">
            <div className="table-card-header">
              <h3 className="table-card-title">Dados Cadastrais & Contato</h3>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5 }}>
              <div><strong>Nome Completo:</strong> {cooperado.nome}</div>
              <div><strong>CPF:</strong> {formatarCPF(cooperado.cpf)}</div>
              <div><strong>Matrícula:</strong> {cooperado.matricula || `#${cooperado.id}`}</div>
              <div><strong>E-mail:</strong> {cooperado.email || 'Não cadastrado'}</div>
              <div><strong>Telefone / WhatsApp:</strong> {formatarTelefone(cooperado.telefone || '') || 'Não informado'}</div>
              <div><strong>Cooperativa:</strong> {cooperado.cooperativa || 'ATESA'}</div>
            </div>
          </div>

          <div className="monitoramento-table-card">
            <div className="table-card-header" style={{ justifyContent: 'space-between' }}>
              <h3 className="table-card-title">Operação & Posto Vigente</h3>
              <button
                type="button"
                className="btn-action-view"
                onClick={() => setModalAlteracaoOperacaoAberto(true)}
              >
                Alterar Operação
              </button>
            </div>
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 13.5 }}>
              <div><strong>Tomador:</strong> {cooperado.alocacao?.empresaNome || 'Sem alocação'}</div>
              <div><strong>Unidade:</strong> {cooperado.alocacao?.unidadeNome || '—'}</div>
              <div><strong>Vaga / Cargo:</strong> {cooperado.alocacao?.vagaCargo || '—'}</div>
              <div><strong>Escala / Turno:</strong> {cooperado.alocacao?.vagaEscala || '—'}</div>
              <div><strong>Início da Alocação:</strong> {cooperado.alocacao?.dataInicio ? new Date(cooperado.alocacao.dataInicio).toLocaleDateString('pt-BR') : '—'}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. ABA APONTAMENTOS ── */}
      {abaAtiva === 'apontamentos' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">Apontamentos Realizados pelo Aplicativo</h3>
            <span className="table-card-count">{apontamentos.length} registro(s)</span>
          </div>

          <div className="table-responsive">
            <table className="monitoramento-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Evento</th>
                  <th>Atividade</th>
                  <th>Observação</th>
                  <th>Status</th>
                  <th>Última Alteração</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                      Nenhum apontamento registrado para este período.
                    </td>
                  </tr>
                ) : (
                  apontamentos.map((ap) => {
                    const dt = ap.timestamp_dispositivo ? new Date(ap.timestamp_dispositivo) : null;
                    const hora = dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '—';
                    const dataStr = ap.data_referencia ? String(ap.data_referencia).slice(0, 10).split('-').reverse().join('/') : '—';
                    const ehAjustado = ap.ajustado === 1 || (ap.status && ap.status.toLowerCase() === 'ajustado');

                    return (
                      <tr key={ap.id}>
                        <td><div style={{ fontWeight: 600 }}>{dataStr}</div></td>
                        <td><div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{hora}</div></td>
                        <td>
                          <span className={`badge-tipo-evento badge-evento-${(ap.tipo_evento || '').replace(/_/g, '-')}`}>
                            {formatarTipoEvento(ap.tipo_evento)}
                          </span>
                        </td>
                        <td><div style={{ fontSize: 12.5, color: '#475569' }}>{ap.atividade || ap.vaga_cargo || '—'}</div></td>
                        <td className="obs-cell">
                          {ehAjustado && ap.observacao_ajuste ? (
                            <div>
                              <span className="obs-ajuste-tag">AJUSTE</span>
                              <span>{ap.observacao_ajuste.replace(/^AJUSTE\s*-\s*/i, '')}</span>
                              {ap.observacao_original && (
                                <div className="obs-original-text" style={{ marginTop: 3 }}>
                                  Orig: "{ap.observacao_original}"
                                </div>
                              )}
                            </div>
                          ) : ap.observacao ? (
                            <span>{ap.observacao}</span>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>—</span>
                          )}
                        </td>
                        <td>
                          {ehAjustado ? (
                            <span className="badge-status badge-ajustado">Ajustado</span>
                          ) : (
                            <span className="badge-status badge-ativo">Normal</span>
                          )}
                        </td>
                        <td>
                          {ap.ajustado_em ? (
                            <div style={{ fontSize: 11.5, color: '#64748b' }}>
                              Por <strong>{ap.ajustado_por_nome || 'Supervisão'}</strong> em {new Date(ap.ajustado_em).toLocaleDateString('pt-BR')}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Registro App</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="btn-action-edit"
                              onClick={() => setApontamentoParaEditar(ap)}
                              title="Editar apontamento e registrar ajuste"
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn-action-obs"
                              onClick={() => setApontamentoParaObs(ap)}
                              title="Adicionar ou alterar observação"
                            >
                              Obs
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 3. ABA ATIVIDADES (APP) ── */}
      {abaAtiva === 'atividades_app' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">Registros Brutos do Aplicativo & Geolocalização</h3>
            <span className="table-card-count">{apontamentos.length} evento(s)</span>
          </div>

          <div className="table-responsive">
            <table className="monitoramento-table">
              <thead>
                <tr>
                  <th>Data / Hora Dispositivo</th>
                  <th>Evento</th>
                  <th>Geolocalização (Lat, Long)</th>
                  <th>Precisão</th>
                  <th>Endereço Aproximado</th>
                  <th>Sincronizado Em</th>
                </tr>
              </thead>
              <tbody>
                {apontamentos.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                      Nenhum evento registrado pelo aplicativo.
                    </td>
                  </tr>
                ) : (
                  apontamentos.map((ap) => {
                    const dtDisp = ap.timestamp_dispositivo ? new Date(ap.timestamp_dispositivo) : null;
                    const dataDisp = dtDisp && !isNaN(dtDisp.getTime())
                      ? `${dtDisp.toLocaleDateString('pt-BR')} ${dtDisp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                      : (ap.timestamp_dispositivo || '—');
                    const dtSync = ap.sincronizado_em ? new Date(ap.sincronizado_em) : null;
                    const dataSync = dtSync && !isNaN(dtSync.getTime())
                      ? `${dtSync.toLocaleDateString('pt-BR')} ${dtSync.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                      : (ap.sincronizado_em || '—');

                    const latNum = ap.latitude != null ? Number(ap.latitude) : null;
                    const lngNum = ap.longitude != null ? Number(ap.longitude) : null;
                    const temGeoValida = latNum != null && lngNum != null && !isNaN(latNum) && !isNaN(lngNum) && (latNum !== 0 || lngNum !== 0);

                    const precNum = ap.precisao_metros != null ? Number(ap.precisao_metros) : null;

                    return (
                      <tr key={ap.id}>
                        <td><div style={{ fontWeight: 600 }}>{dataDisp}</div></td>
                        <td>
                          <span className={`badge-tipo-evento badge-evento-${(ap.tipo_evento || '').replace(/_/g, '-')}`}>
                            {formatarTipoEvento(ap.tipo_evento)}
                          </span>
                        </td>
                        <td>
                          {temGeoValida ? (
                            <a
                              href={`https://www.google.com/maps?q=${latNum},${lngNum}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ fontFamily: 'monospace', fontSize: 12, color: '#2563eb', textDecoration: 'underline' }}
                              title="Abrir coordenadas no Google Maps"
                            >
                              {latNum!.toFixed(5)}, {lngNum!.toFixed(5)} ↗
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Não capturada</span>
                          )}
                        </td>
                        <td>{precNum != null && !isNaN(precNum) ? `±${precNum.toFixed(0)}m` : '—'}</td>
                        <td>{ap.endereco_aproximado || '—'}</td>
                        <td><span style={{ fontSize: 12, color: '#64748b' }}>{dataSync}</span></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 4. ABA HORAS & COMPLEMENTOS ── */}
      {abaAtiva === 'horas' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3 className="table-card-title">Controle Complementar de Horas</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Horas adicionais, horas extras, adicional noturno e descontos lançados pela Supervisão.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="btn-action-view"
                onClick={() => abrirLancamento('hora_adicional')}
              >
                + Hora Adicional
              </button>
              <button
                type="button"
                className="btn-action-view"
                onClick={() => abrirLancamento('adicional_noturno')}
              >
                + Adicional Noturno
              </button>
              <button
                type="button"
                className="btn-action-view"
                style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                onClick={() => abrirLancamento('desconto')}
              >
                - Desconto de Horas
              </button>
            </div>
          </div>

          <div className="table-responsive">
            <table className="monitoramento-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Tipo</th>
                  <th>Quantidade</th>
                  <th>Motivo / Justificativa</th>
                  <th>Observação</th>
                  <th>Responsável</th>
                  <th>Lançado Em</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {horasComplementares.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                      Nenhum complemento de horas registrado para este período.
                    </td>
                  </tr>
                ) : (
                  horasComplementares.map((comp) => {
                    const tipoFormatado = {
                      hora_adicional: 'Hora Adicional',
                      hora_extra: 'Hora Extra',
                      adicional_noturno: 'Adicional Noturno',
                      desconto: 'Desconto de Horas',
                      bonificacao: 'Bonificação',
                    }[comp.tipo] || comp.tipo;

                    return (
                      <tr key={comp.id}>
                        <td><strong>{comp.data_referencia.slice(0, 10).split('-').reverse().join('/')}</strong></td>
                        <td>
                          <span className={`badge-status ${comp.tipo === 'desconto' ? 'badge-inativo' : 'badge-ativo'}`}>
                            {tipoFormatado}
                          </span>
                        </td>
                        <td>
                          <strong>{comp.quantidade_horas ? `${comp.quantidade_horas}h` : '—'}</strong>
                        </td>
                        <td>{comp.motivo}</td>
                        <td>{comp.observacao || '—'}</td>
                        <td>{comp.criado_por_nome}</td>
                        <td>{new Date(comp.criado_em).toLocaleDateString('pt-BR')}</td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-action-delete"
                            onClick={() => handleExcluirComplemento(comp.id)}
                            title="Cancelar lançamento"
                            style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                          >
                            ✕ Cancelar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. ABA BONIFICAÇÕES ── */}
      {abaAtiva === 'bonificacoes' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3 className="table-card-title">Bonificações & Premiações Financeiras</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Lançamentos de bonificações financeiras autorizadas pela Supervisão.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary-filter"
              onClick={() => abrirLancamento('bonificacao')}
            >
              + Registrar Bonificação
            </button>
          </div>

          <div className="table-responsive">
            <table className="monitoramento-table">
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Valor (R$)</th>
                  <th>Motivo / Descrição</th>
                  <th>Observações</th>
                  <th>Responsável</th>
                  <th>Data do Registro</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {bonificacoes.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                      Nenhuma bonificação financeira registrada no período.
                    </td>
                  </tr>
                ) : (
                  bonificacoes.map((boni) => (
                    <tr key={boni.id}>
                      <td><strong>{boni.data_referencia.slice(0, 10).split('-').reverse().join('/')}</strong></td>
                      <td>
                        <strong style={{ color: '#15803d', fontSize: 14 }}>
                          R$ {(boni.valor || 0).toFixed(2)}
                        </strong>
                      </td>
                      <td>{boni.motivo}</td>
                      <td>{boni.observacao || '—'}</td>
                      <td>{boni.criado_por_nome}</td>
                      <td>{new Date(boni.criado_em).toLocaleDateString('pt-BR')}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleExcluirComplemento(boni.id)}
                          style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}
                        >
                          ✕ Cancelar
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 6. ABA HISTÓRICO DA OPERAÇÃO (TIMELINE) ── */}
      {abaAtiva === 'historico_operacao' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header" style={{ justifyContent: 'space-between' }}>
            <div>
              <h3 className="table-card-title">Linha do Tempo das Alterações da Operação</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Histórico cronológico e imutável de trocas de vaga, postos, turnos e funções.
              </p>
            </div>
            <button
              type="button"
              className="btn-action-view"
              onClick={() => setModalAlteracaoOperacaoAberto(true)}
            >
              + Nova Alteração de Operação
            </button>
          </div>

          <div style={{ padding: 24 }}>
            {historicoOperacao.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                Nenhuma alteração de operação registrada até o momento.
              </div>
            ) : (
              <div className="timeline-container">
                {historicoOperacao.map((item) => {
                  const dt = new Date(item.criado_em);
                  const dataStr = `${dt.toLocaleDateString('pt-BR')} às ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

                  return (
                    <div className="timeline-item" key={item.id}>
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-title">
                            Alteração de {item.tipo_alteracao.toUpperCase()} realizada por {item.usuario_nome}
                          </span>
                          <span className="timeline-time">{dataStr}</span>
                        </div>

                        {item.vaga_nova_nome && (
                          <div className="timeline-diff">
                            <strong>Vaga:</strong>
                            <span className="diff-badge-prev">{item.vaga_anterior_nome || '—'}</span>
                            <span className="diff-badge-arrow">→</span>
                            <span className="diff-badge-next">{item.vaga_nova_nome}</span>
                          </div>
                        )}

                        {item.turno_novo && (
                          <div className="timeline-diff">
                            <strong>Turno/Escala:</strong>
                            <span className="diff-badge-prev">{item.turno_anterior || '—'}</span>
                            <span className="diff-badge-arrow">→</span>
                            <span className="diff-badge-next">{item.turno_novo}</span>
                          </div>
                        )}

                        {item.atividade_nova && (
                          <div className="timeline-diff">
                            <strong>Atividade:</strong>
                            <span className="diff-badge-prev">{item.atividade_anterior || '—'}</span>
                            <span className="diff-badge-arrow">→</span>
                            <span className="diff-badge-next">{item.atividade_nova}</span>
                          </div>
                        )}

                        <div className="timeline-reason">
                          <strong>Motivo registrado:</strong> "{item.motivo}"
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── 7. ABA TRILHA DE AUDITORIA ── */}
      {abaAtiva === 'auditoria' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">Trilha de Auditoria & Alterações</h3>
            <span className="table-card-count">{logsAuditoria.length} log(s)</span>
          </div>

          <div className="table-responsive">
            <table className="monitoramento-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Usuário Responsável</th>
                  <th>Perfil</th>
                  <th>Ação / Campo</th>
                  <th>Valor Anterior → Novo</th>
                  <th>Justificativa / Motivo</th>
                </tr>
              </thead>
              <tbody>
                {logsAuditoria.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>
                      Nenhum registro de auditoria gravado para este cooperado.
                    </td>
                  </tr>
                ) : (
                  logsAuditoria.map((log) => {
                    const dt = new Date(log.criado_em);
                    const dataFormatada = `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

                    return (
                      <tr key={log.id}>
                        <td><div style={{ fontWeight: 600, fontSize: 12.5 }}>{dataFormatada}</div></td>
                        <td><div style={{ fontWeight: 600, color: '#0f172a' }}>{log.usuario_nome}</div></td>
                        <td>
                          <span className="badge-status badge-ativo" style={{ fontSize: 11.5, textTransform: 'capitalize' }}>
                            {log.usuario_perfil}
                          </span>
                        </td>
                        <td><strong style={{ fontSize: 12.5, color: '#334155' }}>{log.campo || log.acao}</strong></td>
                        <td>
                          <div className="diff-badge-container">
                            <span className="diff-badge-prev">{log.valor_anterior || '(vazio)'}</span>
                            <span className="diff-badge-arrow">→</span>
                            <span className="diff-badge-next">{log.valor_novo || '(vazio)'}</span>
                          </div>
                        </td>
                        <td><div style={{ fontSize: 12.5, color: '#475569', fontStyle: 'italic' }}>{log.motivo || '—'}</div></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 8. ABA AÇÕES ADMINISTRATIVAS ── */}
      {abaAtiva === 'acoes' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="monitoramento-table-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>
              Alterar Operação & Vaga Vigente
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.5, marginBottom: 18 }}>
              Permite transferir o cooperado de posto de trabalho, alterar a vaga, turno de trabalho ou atividade com preservação automática de histórico e justificativa obrigatória.
            </p>
            <button
              type="button"
              className="btn-primary-filter"
              onClick={() => setModalAlteracaoOperacaoAberto(true)}
            >
              Alterar Vaga / Posto
            </button>
          </div>

          <div className="monitoramento-table-card" style={{ padding: 24 }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: 16, color: '#0f172a' }}>
              Solicitar Reset de Senha do Cooperado
            </h3>
            <p style={{ fontSize: 13.5, color: '#64748b', lineHeight: 1.5, marginBottom: 18 }}>
              Gera um código temporário de segurança de 6 dígitos com validade de 30 minutos e envia ao e-mail do cooperado para permitir redefinição segura de sua senha de acesso ao aplicativo.
            </p>
            <button
              type="button"
              className="btn-primary-filter"
              style={{ background: '#d97706' }}
              onClick={() => setModalResetSenhaAberto(true)}
            >
              Solicitar Reset de Senha
            </button>
          </div>
        </div>
      )}

      {/* ── Modais ── */}
      {apontamentoParaEditar && (
        <ModalEdicaoApontamento
          apontamento={apontamentoParaEditar}
          onClose={() => setApontamentoParaEditar(null)}
          onSuccess={carregarDados}
        />
      )}

      {apontamentoParaObs && (
        <ModalObservacaoApontamento
          apontamento={apontamentoParaObs}
          onClose={() => setApontamentoParaObs(null)}
          onSuccess={carregarDados}
        />
      )}

      {modalComplementoAberto && (
        <ModalLancamentoComplemento
          candidatoId={cooperado.id}
          candidatoNome={cooperado.nome}
          alocacaoId={cooperado.alocacao?.id}
          tipoPredefinido={tipoComplementoPredefinido}
          onClose={() => setModalComplementoAberto(false)}
          onSuccess={carregarDados}
        />
      )}

      {modalAlteracaoOperacaoAberto && (
        <ModalAlteracaoOperacao
          candidatoId={cooperado.id}
          candidatoNome={cooperado.nome}
          alocacaoAtual={cooperado.alocacao}
          onClose={() => setModalAlteracaoOperacaoAberto(false)}
          onSuccess={carregarDados}
        />
      )}

      {modalResetSenhaAberto && (
        <ModalResetSenhaCooperado
          candidatoId={cooperado.id}
          candidatoNome={cooperado.nome}
          candidatoEmail={cooperado.email}
          onClose={() => setModalResetSenhaAberto(false)}
          onSuccess={carregarDados}
        />
      )}
    </div>
  );
};

export default MonitoramentoCooperadoDetalhe;
