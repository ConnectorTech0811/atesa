import React, { useEffect, useState } from 'react';
import {
  LogAuditoria,
  listarLogsAuditoriaMonitoramento,
} from '../../../api/monitoramentoApi';
import { formatarCPF } from '../../../utils/formatters';

const formatarValorAudit = (campo?: string | null, valor?: string | null) => {
  if (!valor) return '(vazio)';
  if (campo === 'apontamento_ponto' || campo === 'tipo_evento') {
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
    return mapa[valor] || valor.replace(/_/g, ' ');
  }
  return valor;
};

export const MonitoramentoLogsAuditoria: React.FC = () => {
  const [logs, setLogs] = useState<LogAuditoria[]>([]);
  const [busca, setBusca] = useState('');
  const [acaoFiltro, setAcaoFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregarLogs = async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await listarLogsAuditoriaMonitoramento({
        busca: busca.trim() || undefined,
        acao: acaoFiltro || undefined,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        limite: 200,
      });
      setLogs(data);
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Erro ao carregar logs de auditoria.';
      if (msg.includes('<!DOCTYPE') || msg.includes('Cannot GET') || msg.includes('<pre>')) {
        msg = 'Serviço de supervisão em inicialização. Aguarde alguns instantes ou atualize a página.';
      }
      setErro(msg);
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      carregarLogs();
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, acaoFiltro, dataInicio, dataFim]);

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="monitoramento-filters-card">
        <div className="filter-item" style={{ flex: 2, minWidth: 220 }}>
          <label>Buscar no Log</label>
          <input
            type="text"
            className="filter-input"
            placeholder="Nome do cooperado, responsável, motivo ou campo..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="filter-item" style={{ minWidth: 150 }}>
          <label>Tipo de Ação</label>
          <select
            className="filter-select"
            value={acaoFiltro}
            onChange={(e) => setAcaoFiltro(e.target.value)}
          >
            <option value="">Todas as ações</option>
            <option value="criacao">Criação / Registro App</option>
            <option value="ajuste">Ajuste de Horário/Dados</option>
            <option value="inclusao_observacao">Inclusão de Observação</option>
            <option value="edicao">Edição Geral</option>
          </select>
        </div>

        <div className="filter-item" style={{ minWidth: 140 }}>
          <label>Data Início</label>
          <input
            type="date"
            className="filter-input"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>

        <div className="filter-item" style={{ minWidth: 140 }}>
          <label>Data Fim</label>
          <input
            type="date"
            className="filter-input"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>

        <div className="filter-actions">
          {(dataInicio || dataFim || busca || acaoFiltro) && (
            <button
              type="button"
              className="btn-secondary-filter"
              onClick={() => {
                setBusca('');
                setAcaoFiltro('');
                setDataInicio('');
                setDataFim('');
              }}
            >
              Limpar Filtros
            </button>
          )}
        </div>
      </div>

      {erro && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 10, marginBottom: 20, fontSize: 13.5 }}>
          {erro}
        </div>
      )}

      {/* ── Tabela de Auditoria ── */}
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <h3 className="table-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            Trilha e Logs de Auditoria
          </h3>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b', fontWeight: 500 }}>
              🛡️ Registros protegidos contra edição ou exclusão
            </span>
            <span className="table-card-count">
              {logs.length} log(s)
            </span>
          </div>
        </div>

        <div className="table-responsive">
          <table className="monitoramento-table">
            <thead>
              <tr>
                <th>Data / Hora</th>
                <th>Cooperado</th>
                <th>Usuário Responsável</th>
                <th>Ação</th>
                <th>Campo Alterado</th>
                <th>Valor Anterior → Novo</th>
                <th>Justificativa / Motivo</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                    Carregando trilha de auditoria...
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state-box">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                      <h4 className="empty-state-title">Nenhum log encontrado</h4>
                      <p className="empty-state-desc">Nenhum ajuste ou observação gravada para os filtros selecionados.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const dt = new Date(log.criado_em);
                  const dataFormatada = !isNaN(dt.getTime())
                    ? `${dt.toLocaleDateString('pt-BR')} ${dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                    : log.criado_em;

                  return (
                    <tr key={log.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 12.5 }}>{dataFormatada}</div>
                        {log.apontamento_id ? (
                          <div style={{ fontSize: 11, color: '#64748b' }}>Apontamento #{log.apontamento_id}</div>
                        ) : null}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.candidato_nome}</div>
                        {log.candidato_cpf && (
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>CPF: {formatarCPF(log.candidato_cpf)}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{log.usuario_nome}</div>
                        <span className="badge-status badge-ativo" style={{ fontSize: 11, textTransform: 'capitalize', marginTop: 2 }}>
                          {log.usuario_perfil}
                        </span>
                      </td>
                      <td>
                        <span className={`badge-status ${log.acao === 'ajuste' ? 'badge-ajustado' : 'badge-ativo'}`} style={{ textTransform: 'uppercase', fontSize: 11 }}>
                          {log.acao === 'inclusao_observacao' ? 'Observação' : log.acao === 'criacao' ? 'Criação' : log.acao}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 12.5, color: '#334155' }}>
                          {log.campo === 'timestamp_dispositivo' ? 'Horário / Data' :
                           log.campo === 'data_referencia' ? 'Data de Referência' :
                           log.campo === 'tipo_evento' ? 'Tipo de Evento' :
                           log.campo === 'apontamento_ponto' ? 'Registro de Ponto' :
                           log.campo === 'observacao' ? 'Observação' :
                           log.campo === 'status' ? 'Status' : log.campo || '—'}
                        </strong>
                      </td>
                      <td>
                        <div className="diff-badge-container">
                          <span className="diff-badge-prev" title="Valor Anterior">
                            {formatarValorAudit(log.campo, log.valor_anterior)}
                          </span>
                          <span className="diff-badge-arrow">→</span>
                          <span className="diff-badge-next" title="Novo Valor">
                            {formatarValorAudit(log.campo, log.valor_novo)}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12.5, color: '#475569', fontStyle: 'italic', maxWidth: 260 }}>
                          {log.motivo || '—'}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: 11.5, color: log.origem === 'app_cooperado' ? '#15803d' : '#64748b', fontWeight: 500 }}>
                          {log.origem === 'app_cooperado' ? '📱 App Cooperado' : '💻 Supervisão (Web)'}
                        </span>
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
  );
};

export default MonitoramentoLogsAuditoria;
