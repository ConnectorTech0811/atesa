import React, { useEffect, useState } from 'react';
import {
  ApontamentoDetalhado,
  listarTodosApontamentos,
} from '../../../api/monitoramentoApi';
import ModalEdicaoApontamento from './ModalEdicaoApontamento';
import ModalObservacaoApontamento from './ModalObservacaoApontamento';

interface Props {
  onVisualizarCooperado?: (candidatoId: number) => void;
}

export const MonitoramentoApontamentos: React.FC<Props> = ({ onVisualizarCooperado }) => {
  const hoje = new Date().toISOString().slice(0, 10);
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [tipoEvento, setTipoEvento] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [apenasAjustados, setApenasAjustados] = useState(false);

  const [apontamentos, setApontamentos] = useState<ApontamentoDetalhado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const [apontamentoParaEditar, setApontamentoParaEditar] = useState<ApontamentoDetalhado | null>(null);
  const [apontamentoParaObs, setApontamentoParaObs] = useState<ApontamentoDetalhado | null>(null);

  const carregarApontamentos = async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await listarTodosApontamentos({
        busca: busca.trim() || undefined,
        tipoEvento: tipoEvento || undefined,
        status: statusFiltro || undefined,
        apenasAjustados,
        dataInicio: dataInicio || undefined,
        dataFim: dataFim || undefined,
        limite: 200,
      });
      setApontamentos(data);
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Erro ao carregar lista de apontamentos.';
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
      carregarApontamentos();
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, tipoEvento, statusFiltro, apenasAjustados, dataInicio, dataFim]);

  const apontamentosFiltrados = apontamentos.filter((ap) => {
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      const digitos = termo.replace(/\D/g, '');
      const matchNome = (ap.candidato_nome || '').toLowerCase().includes(termo);
      const matchMatricula = String(ap.candidato_matricula || ap.candidato_id || '').toLowerCase().includes(termo);
      const matchCpf = digitos.length >= 3 && (ap.candidato_cpf || '').replace(/\D/g, '').includes(digitos);
      if (!matchNome && !matchMatricula && !matchCpf) return false;
    }
    return true;
  });

  return (
    <div>
      {/* ── Filtros ── */}
      <div className="monitoramento-filters-card">
        <div className="filter-item" style={{ flex: 2, minWidth: 200 }}>
          <label>Buscar Cooperado</label>
          <input
            type="text"
            className="filter-input"
            placeholder="Nome, CPF ou matrícula..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
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

        <div className="filter-item" style={{ minWidth: 150 }}>
          <label>Tipo de Evento</label>
          <select
            className="filter-select"
            value={tipoEvento}
            onChange={(e) => setTipoEvento(e.target.value)}
          >
            <option value="">Todos os eventos</option>
            <option value="jornada_inicio">Início de Jornada</option>
            <option value="jornada_fim">Fim de Jornada</option>
            <option value="refeicao_inicio">Início de Refeição</option>
            <option value="refeicao_fim">Fim de Refeição</option>
            <option value="pausa_inicio">Início de Pausa</option>
            <option value="pausa_fim">Fim de Pausa</option>
            <option value="deslocamento_inicio">Deslocamento</option>
          </select>
        </div>

        <div className="filter-item" style={{ minWidth: 130 }}>
          <label>Status</label>
          <select
            className="filter-select"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="normal">Normal</option>
            <option value="ajustado">Ajustado</option>
            <option value="divergente">Divergente</option>
            <option value="pendente">Pendente</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 22 }}>
          <input
            type="checkbox"
            id="apenasAjustadosCheck"
            checked={apenasAjustados}
            onChange={(e) => setApenasAjustados(e.target.checked)}
            style={{ width: 16, height: 16, cursor: 'pointer' }}
          />
          <label htmlFor="apenasAjustadosCheck" style={{ fontSize: 13, fontWeight: 600, color: '#475569', cursor: 'pointer' }}>
            Apenas Ajustados
          </label>
        </div>
      </div>

      {erro && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 10, marginBottom: 20, fontSize: 13.5 }}>
          {erro}
        </div>
      )}

      {/* ── Tabela Global de Apontamentos ── */}
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <h3 className="table-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Apontamentos Operacionais
          </h3>
          <span className="table-card-count">
            {apontamentosFiltrados.length} registro(s)
          </span>
        </div>

        <div className="table-responsive">
          <table className="monitoramento-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Cooperado</th>
                <th>Operação / Vaga</th>
                <th>Evento</th>
                <th>Observação</th>
                <th>Status</th>
                <th>Última Alteração</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                    Carregando apontamentos...
                  </td>
                </tr>
              ) : apontamentosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="empty-state-box">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="11" cy="11" r="8" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                      <h4 className="empty-state-title">
                        {busca.trim() ? `Nenhum apontamento encontrado para "${busca.trim()}"` : 'Nenhum apontamento encontrado'}
                      </h4>
                      <p className="empty-state-desc">
                        {busca.trim()
                          ? 'O cooperado buscado não possui apontamentos registrados para a data/filtro selecionado ou o nome não foi localizado.'
                          : 'Tente alterar os filtros de data, tipo de evento ou busca.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                apontamentosFiltrados.map((ap) => {
                  const dt = ap.timestamp_dispositivo ? new Date(ap.timestamp_dispositivo) : null;
                  const hora = dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '—';
                  const dataStr = ap.data_referencia ? String(ap.data_referencia).slice(0, 10).split('-').reverse().join('/') : '—';
                  const ehAjustado = ap.ajustado === 1 || (ap.status && ap.status.toLowerCase() === 'ajustado');

                  return (
                    <tr key={ap.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{dataStr}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 14, color: '#0f172a' }}>{hora}</div>
                      </td>
                      <td>
                        <div
                          style={{ fontWeight: 600, color: '#0f172a', cursor: onVisualizarCooperado ? 'pointer' : 'default' }}
                          onClick={() => onVisualizarCooperado && onVisualizarCooperado(ap.candidato_id)}
                          title="Clique para abrir monitoramento individual do cooperado"
                        >
                          {ap.candidato_nome || `ID #${ap.candidato_id}`}
                        </div>
                        {ap.candidato_matricula && (
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>Matrícula: {ap.candidato_matricula}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{ap.empresa_nome || '—'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{ap.vaga_cargo || ap.atividade || '—'}</div>
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
                      <td className="obs-cell">
                        {ehAjustado && ap.observacao_ajuste ? (
                          <div>
                            <span className="obs-ajuste-tag">AJUSTE</span>
                            <span>{ap.observacao_ajuste.replace(/^AJUSTE\s*-\s*/i, '')}</span>
                            {ap.observacao_original && (
                              <div className="obs-original-text" style={{ marginTop: 2 }}>
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
                        ) : ap.status === 'divergente' ? (
                          <span className="badge-status badge-divergente">Divergente</span>
                        ) : (
                          <span className="badge-status badge-ativo">Normal</span>
                        )}
                      </td>
                      <td>
                        {ap.ajustado_em ? (
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>
                            Por <strong>{ap.ajustado_por_nome || 'Supervisão'}</strong> em {new Date(ap.ajustado_em).toLocaleDateString('pt-BR')} às {new Date(ap.ajustado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
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
                            title="Editar horário e registrar ajuste"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn-action-obs"
                            onClick={() => setApontamentoParaObs(ap)}
                            title="Adicionar ou alterar observação"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
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

      {/* Modais */}
      {apontamentoParaEditar && (
        <ModalEdicaoApontamento
          apontamento={apontamentoParaEditar}
          onClose={() => setApontamentoParaEditar(null)}
          onSuccess={carregarApontamentos}
        />
      )}

      {apontamentoParaObs && (
        <ModalObservacaoApontamento
          apontamento={apontamentoParaObs}
          onClose={() => setApontamentoParaObs(null)}
          onSuccess={carregarApontamentos}
        />
      )}
    </div>
  );
};

export default MonitoramentoApontamentos;
