import React, { useEffect, useState } from 'react';
import {
  CooperadoMonitoramento,
  listarCooperadosMonitoramento,
} from '../../../api/monitoramentoApi';
import { formatarCPF } from '../../../utils/formatters';

interface Props {
  onVisualizarCooperado: (candidatoId: number) => void;
}

export const MonitoramentoCooperados: React.FC<Props> = ({ onVisualizarCooperado }) => {
  const [cooperados, setCooperados] = useState<CooperadoMonitoramento[]>([]);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState<string>('');
  const [situacaoFiltro, setSituacaoFiltro] = useState<string>('');
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  const carregarCooperados = async () => {
    setCarregando(true);
    setErro('');
    try {
      const data = await listarCooperadosMonitoramento({
        busca: busca.trim() || undefined,
        status: statusFiltro !== '' ? statusFiltro : undefined,
        limite: 200,
      });
      setCooperados(data);
    } catch (err: any) {
      console.error(err);
      let msg = err.message || 'Erro ao carregar lista de cooperados.';
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
      carregarCooperados();
    }, 250);
    return () => clearTimeout(timer);
  }, [busca, statusFiltro]);

  const cooperadosFiltrados = cooperados.filter((c) => {
    if (situacaoFiltro && c.situacao !== situacaoFiltro) return false;
    if (busca.trim()) {
      const termo = busca.trim().toLowerCase();
      const digitos = termo.replace(/\D/g, '');
      const matchNome = (c.nome || '').toLowerCase().includes(termo);
      const matchMatricula = String(c.matricula || c.id || '').toLowerCase().includes(termo);
      const matchCpf = digitos.length >= 3 && (c.cpf || '').replace(/\D/g, '').includes(digitos);
      if (!matchNome && !matchMatricula && !matchCpf) return false;
    }
    return true;
  });

  return (
    <div>
      {/* ── Filtros e Busca ── */}
      <div className="monitoramento-filters-card">
        <div className="filter-item" style={{ flex: 2, minWidth: 240 }}>
          <label>Buscar Cooperado</label>
          <input
            type="text"
            className="filter-input"
            placeholder="Digite nome, CPF ou matrícula..."
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
        </div>

        <div className="filter-item" style={{ minWidth: 160 }}>
          <label>Situação Hoje</label>
          <select
            className="filter-select"
            value={situacaoFiltro}
            onChange={(e) => setSituacaoFiltro(e.target.value)}
          >
            <option value="">Todas as situações</option>
            <option value="em_atividade">Em Atividade</option>
            <option value="ativo">Ativo (Sem Ponto Hoje)</option>
            <option value="inativo">Inativo</option>
          </select>
        </div>

        <div className="filter-item" style={{ minWidth: 150 }}>
          <label>Status Cadastral</label>
          <select
            className="filter-select"
            value={statusFiltro}
            onChange={(e) => setStatusFiltro(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="1">Ativo</option>
            <option value="0">Pré-cadastro / Inativo</option>
          </select>
        </div>

        <div className="filter-actions">
          <button type="button" className="btn-primary-filter" onClick={carregarCooperados}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            Filtrar
          </button>
        </div>
      </div>

      {erro && (
        <div style={{ padding: '12px 16px', background: '#fee2e2', color: '#991b1b', borderRadius: 10, marginBottom: 20, fontSize: 13.5 }}>
          {erro}
        </div>
      )}

      {/* ── Tabela de Cooperados ── */}
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <h3 className="table-card-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Listagem de Cooperados
          </h3>
          <span className="table-card-count">
            {cooperadosFiltrados.length} cooperado(s) encontrado(s)
          </span>
        </div>

        <div className="table-responsive">
          <table className="monitoramento-table">
            <thead>
              <tr>
                <th>Nome / Matrícula</th>
                <th>CPF</th>
                <th>Operação (Tomador)</th>
                <th>Vaga / Posto</th>
                <th>Turno / Escala</th>
                <th>Status</th>
                <th>Último Apontamento</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                    Carregando cooperados...
                  </td>
                </tr>
              ) : cooperadosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="empty-state-box">
                      <svg className="empty-state-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                        <circle cx="11" cy="11" r="8" />
                        <line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <h4 className="empty-state-title">Nenhum cooperado localizado</h4>
                      <p className="empty-state-desc">Tente ajustar os filtros ou o termo de busca por nome/CPF.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                cooperadosFiltrados.map((c) => {
                  let ultApFormatado = '—';
                  if (c.ultimoApontamento?.timestamp_dispositivo) {
                    const dt = new Date(c.ultimoApontamento.timestamp_dispositivo);
                    if (!isNaN(dt.getTime())) {
                      const hora = `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                      const data = dt.toLocaleDateString('pt-BR');
                      const evtRotulo = c.ultimoApontamento.tipo_evento === 'jornada_inicio' ? 'Início' :
                                        c.ultimoApontamento.tipo_evento === 'jornada_fim' ? 'Fim' :
                                        c.ultimoApontamento.tipo_evento === 'refeicao_inicio' ? 'Refeição' :
                                        c.ultimoApontamento.tipo_evento === 'pausa_inicio' ? 'Pausa' : c.ultimoApontamento.tipo_evento;
                      ultApFormatado = `${data} às ${hora} (${evtRotulo})`;
                    }
                  }

                  return (
                    <tr key={c.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.nome}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>
                          Matrícula: <strong>{c.matricula || `#${c.id}`}</strong>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontSize: 13 }}>
                          {formatarCPF(c.cpf)}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>
                          {c.alocacao?.empresaNome || <span style={{ color: '#94a3b8' }}>Não alocado</span>}
                        </div>
                        {c.alocacao?.unidadeNome && (
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>{c.alocacao.unidadeNome}</div>
                        )}
                      </td>
                      <td>
                        <div>{c.alocacao?.vagaCargo || '—'}</div>
                      </td>
                      <td>
                        <span style={{ fontSize: 12.5, color: '#475569' }}>
                          {c.alocacao?.vagaEscala ? (
                            c.alocacao.vagaEscala === '12x36' ? 'Escala 12x36' :
                            c.alocacao.vagaEscala === 'plantao' ? 'Plantão' :
                            c.alocacao.vagaEscala === 'mensal' ? 'Mensal' : c.alocacao.vagaEscala
                          ) : '—'}
                        </span>
                      </td>
                      <td>
                        {c.situacao === 'em_atividade' ? (
                          <span className="badge-status badge-em-atividade">
                            <span className="badge-status-dot" /> Em Atividade
                          </span>
                        ) : c.statusCandidato === 1 ? (
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
                        <div style={{ fontSize: 12.5, color: '#334155' }}>{ultApFormatado}</div>
                        {c.totalAjustesPeriodo > 0 && (
                          <div style={{ fontSize: 11, color: '#b45309', fontWeight: 600 }}>
                            {c.totalAjustesPeriodo} ajuste(s) registrado(s)
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn-action-view"
                          onClick={() => onVisualizarCooperado(c.id)}
                          title="Abrir painel individual de monitoramento e apontamentos"
                        >
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                          Visualizar Monitoramento
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
    </div>
  );
};

export default MonitoramentoCooperados;
