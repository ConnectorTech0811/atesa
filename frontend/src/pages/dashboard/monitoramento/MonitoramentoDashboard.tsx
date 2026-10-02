import React, { useEffect, useState } from 'react';
import {
  ResumoDashboard,
  CooperadoMonitoramento,
  ApontamentoDetalhado,
  obterResumoDashboard,
  listarCooperadosMonitoramento,
  listarTodosApontamentos,
} from '../../../api/monitoramentoApi';
import { formatarCPF } from '../../../utils/formatters';

interface Props {
  onVisualizarCooperado: (candidatoId: number) => void;
  onIrParaCooperados: () => void;
  onIrParaApontamentos: () => void;
}

export const MonitoramentoDashboard: React.FC<Props> = ({
  onVisualizarCooperado,
  onIrParaCooperados,
  onIrParaApontamentos,
}) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [periodoPredefinido, setPeriodoPredefinido] = useState<'hoje' | 'ontem' | 'semana' | 'mes' | 'custom'>('hoje');

  const [resumo, setResumo] = useState<ResumoDashboard | null>(null);
  const [cooperadosRecentes, setCooperadosRecentes] = useState<CooperadoMonitoramento[]>([]);
  const [apontamentosRecentes, setApontamentosRecentes] = useState<ApontamentoDetalhado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const aplicarPeriodoPredefinido = (tipo: 'hoje' | 'ontem' | 'semana' | 'mes') => {
    setPeriodoPredefinido(tipo);
    const d = new Date();
    if (tipo === 'hoje') {
      const h = d.toISOString().slice(0, 10);
      setDataInicio(h);
      setDataFim(h);
    } else if (tipo === 'ontem') {
      d.setDate(d.getDate() - 1);
      const o = d.toISOString().slice(0, 10);
      setDataInicio(o);
      setDataFim(o);
    } else if (tipo === 'semana') {
      const diaAtual = d.getDay();
      const primeiroDiaSemana = new Date(d);
      primeiroDiaSemana.setDate(d.getDate() - diaAtual);
      const ultimoDiaSemana = new Date(primeiroDiaSemana);
      ultimoDiaSemana.setDate(primeiroDiaSemana.getDate() + 6);

      setDataInicio(primeiroDiaSemana.toISOString().slice(0, 10));
      setDataFim(ultimoDiaSemana.toISOString().slice(0, 10));
    } else if (tipo === 'mes') {
      const primeiroDiaMes = new Date(d.getFullYear(), d.getMonth(), 1);
      const ultimoDiaMes = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      setDataInicio(primeiroDiaMes.toISOString().slice(0, 10));
      setDataFim(ultimoDiaMes.toISOString().slice(0, 10));
    }
  };

  const carregarDados = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [resumoData, coopsData, apData] = await Promise.all([
        obterResumoDashboard({ dataInicio, dataFim }),
        listarCooperadosMonitoramento({ dataInicio, dataFim, limite: 6 }),
        listarTodosApontamentos({ dataInicio, dataFim, limite: 8 }),
      ]);
      setResumo(resumoData);
      setCooperadosRecentes(coopsData);
      setApontamentosRecentes(apData);
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Erro ao carregar dados do dashboard.';
      if (msg.includes('<!DOCTYPE') || msg.includes('Cannot GET')) {
        msg = 'Serviço de supervisão em inicialização. Clique em "Atualizar" para tentar novamente.';
      }
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [dataInicio, dataFim]);

  const cards = resumo?.cards || {
    totalCooperadosAtivos: 0,
    cooperadosEmAtividade: 0,
    cooperadosSemAtividade: 0,
    totalApontamentos: 0,
    apontamentosAjustados: 0,
    apontamentosDivergentes: 0,
    apontamentosPendentes: 0,
    horasTrabalhadasHoje: '00:00',
    horasTrabalhadasMinutos: 0,
    horasAdicionais: '00:00',
    adicionalNoturno: '00:00',
    descontoHoras: '00:00',
    bonificacoesTotal: 0,
  };

  return (
    <div>
      {/* ── Barra de Filtro de Período ── */}
      <div className="monitoramento-filters-card">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            type="button"
            className={`monitoramento-tab-btn ${periodoPredefinido === 'hoje' ? 'active' : ''}`}
            onClick={() => aplicarPeriodoPredefinido('hoje')}
          >
            Hoje
          </button>
          <button
            type="button"
            className={`monitoramento-tab-btn ${periodoPredefinido === 'ontem' ? 'active' : ''}`}
            onClick={() => aplicarPeriodoPredefinido('ontem')}
          >
            Ontem
          </button>
          <button
            type="button"
            className={`monitoramento-tab-btn ${periodoPredefinido === 'semana' ? 'active' : ''}`}
            onClick={() => aplicarPeriodoPredefinido('semana')}
          >
            Esta Semana
          </button>
          <button
            type="button"
            className={`monitoramento-tab-btn ${periodoPredefinido === 'mes' ? 'active' : ''}`}
            onClick={() => aplicarPeriodoPredefinido('mes')}
          >
            Este Mês
          </button>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <div className="filter-item" style={{ minWidth: 140 }}>
            <label>Data Início</label>
            <input
              type="date"
              className="filter-input"
              value={dataInicio}
              onChange={(e) => {
                setDataInicio(e.target.value);
                setPeriodoPredefinido('custom');
              }}
            />
          </div>
          <div className="filter-item" style={{ minWidth: 140 }}>
            <label>Data Fim</label>
            <input
              type="date"
              className="filter-input"
              value={dataFim}
              onChange={(e) => {
                setDataFim(e.target.value);
                setPeriodoPredefinido('custom');
              }}
            />
          </div>
          <button type="button" className="btn-primary-filter" onClick={carregarDados} style={{ marginTop: 20 }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {erro && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 10, marginBottom: 20, fontSize: 13.5 }}>
          {erro}
        </div>
      )}

      {/* ── Grid de Indicadores Principais (Linha 1) ── */}
      <div className="monitoramento-cards-grid">
        {/* Cooperados em Atividade */}
        <div className="metric-card card-green">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Em Atividade</span>
            <div className="metric-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value">{cards.cooperadosEmAtividade}</div>
          <div className="metric-card-subtitle">Cooperados com ponto no período</div>
        </div>

        {/* Total Ativos */}
        <div className="metric-card card-blue">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Cooperados Ativos</span>
            <div className="metric-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value">{cards.totalCooperadosAtivos}</div>
          <div className="metric-card-subtitle">{cards.cooperadosSemAtividade} cooperado(s) sem registro</div>
        </div>

        {/* Total de Apontamentos */}
        <div className="metric-card card-indigo">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Total de Apontamentos</span>
            <div className="metric-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value">{cards.totalApontamentos}</div>
          <div className="metric-card-subtitle">Eventos de jornada, pausas e refeição</div>
        </div>

        {/* Horas Trabalhadas */}
        <div className="metric-card card-purple">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Horas Trabalhadas</span>
            <div className="metric-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 14 14" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value">{cards.horasTrabalhadasHoje}h</div>
          <div className="metric-card-subtitle">Jornadas calculadas do app</div>
        </div>

        {/* Apontamentos Ajustados */}
        <div className="metric-card card-amber">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Apontamentos Ajustados</span>
            <div className="metric-card-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </div>
          </div>
          <div className="metric-card-value">{cards.apontamentosAjustados}</div>
          <div className="metric-card-subtitle">Com justificativa de Supervisão</div>
        </div>
      </div>

      {/* ── Grid de Indicadores Complementares (Linha 2 - Horas & Bonificações) ── */}
      <div className="monitoramento-cards-grid" style={{ marginTop: -8 }}>
        <div className="metric-card card-blue">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Horas Adicionais</span>
            <div className="metric-card-icon">➕</div>
          </div>
          <div className="metric-card-value">{cards.horasAdicionais || '00:00'}h</div>
          <div className="metric-card-subtitle">Horas extras e adicionais lançadas</div>
        </div>

        <div className="metric-card card-teal">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Adicional Noturno</span>
            <div className="metric-card-icon">🌙</div>
          </div>
          <div className="metric-card-value">{cards.adicionalNoturno || '00:00'}h</div>
          <div className="metric-card-subtitle">Horas em período noturno</div>
        </div>

        <div className="metric-card card-rose">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Desconto de Horas</span>
            <div className="metric-card-icon">➖</div>
          </div>
          <div className="metric-card-value">{cards.descontoHoras || '00:00'}h</div>
          <div className="metric-card-subtitle">Ausências não justificadas</div>
        </div>

        <div className="metric-card card-amber">
          <div className="metric-card-accent" />
          <div className="metric-card-header">
            <span className="metric-card-title">Bonificações</span>
            <div className="metric-card-icon">💰</div>
          </div>
          <div className="metric-card-value">R$ {(cards.bonificacoesTotal || 0).toFixed(2)}</div>
          <div className="metric-card-subtitle">Total em premiações financeiras</div>
        </div>
      </div>

      {/* ── Tabelas Resumo Rápidas ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 20 }}>
        {/* Cooperados em Destaque */}
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              Cooperados Acompanhados
            </h3>
            <button type="button" className="btn-action-view" onClick={onIrParaCooperados}>
              Ver Todos ({cards.totalCooperadosAtivos})
            </button>
          </div>

          <div className="table-responsive">
            <table className="monitoramento-table">
              <thead>
                <tr>
                  <th>Cooperado</th>
                  <th>Operação / Vaga</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {cooperadosRecentes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                      Nenhum cooperado encontrado no período selecionado.
                    </td>
                  </tr>
                ) : (
                  cooperadosRecentes.map((coop) => (
                    <tr key={coop.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{coop.nome}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{formatarCPF(coop.cpf)}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, color: '#334155' }}>{coop.alocacao?.empresaNome || 'Não alocado'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{coop.alocacao?.vagaCargo || '—'}</div>
                      </td>
                      <td>
                        {coop.situacao === 'em_atividade' ? (
                          <span className="badge-status badge-em-atividade">
                            <span className="badge-status-dot" /> Em Atividade
                          </span>
                        ) : coop.situacao === 'ativo' ? (
                          <span className="badge-status badge-ativo">
                            <span className="badge-status-dot" /> Ativo
                          </span>
                        ) : (
                          <span className="badge-status badge-inativo">
                            <span className="badge-status-dot" /> Inativo
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-action-view"
                          onClick={() => onVisualizarCooperado(coop.id)}
                        >
                          Ver Ponto
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Últimos Apontamentos */}
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Últimos Apontamentos
            </h3>
            <button type="button" className="btn-action-view" onClick={onIrParaApontamentos}>
              Ver Todos ({cards.totalApontamentos})
            </button>
          </div>

          <div className="table-responsive">
            <table className="monitoramento-table">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Cooperado</th>
                  <th>Evento</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {apontamentosRecentes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                      Nenhum apontamento registrado no período.
                    </td>
                  </tr>
                ) : (
                  apontamentosRecentes.map((ap) => {
                    const dt = ap.timestamp_dispositivo ? new Date(ap.timestamp_dispositivo) : null;
                    const hora = dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '—';
                    const dataStr = ap.data_referencia ? String(ap.data_referencia).slice(0, 10).split('-').reverse().join('/') : '—';

                    return (
                      <tr key={ap.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{hora}</div>
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>{dataStr}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{ap.candidato_nome || `Cooperado #${ap.candidato_id}`}</div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>{ap.empresa_nome || '—'}</div>
                        </td>
                        <td>
                          <span className={`badge-tipo-evento badge-evento-${ap.tipo_evento.replace('_', '-')}`}>
                            {ap.tipo_evento === 'jornada_inicio' ? 'Início Jornada' :
                             ap.tipo_evento === 'jornada_fim' ? 'Fim Jornada' :
                             ap.tipo_evento === 'refeicao_inicio' ? 'Início Refeição' :
                             ap.tipo_evento === 'refeicao_fim' ? 'Fim Refeição' :
                             ap.tipo_evento === 'pausa_inicio' ? 'Início Pausa' :
                             ap.tipo_evento === 'pausa_fim' ? 'Fim Pausa' : ap.tipo_evento}
                          </span>
                        </td>
                        <td>
                          {ap.ajustado === 1 ? (
                            <span className="badge-status badge-ajustado">Ajustado</span>
                          ) : ap.status === 'divergente' ? (
                            <span className="badge-status badge-divergente">Divergente</span>
                          ) : (
                            <span className="badge-status badge-ativo">Normal</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MonitoramentoDashboard;
