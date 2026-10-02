import React, { useEffect, useState } from 'react';
import {
  obterRelatorioIndividual,
  obterRelatorioPorVaga,
  obterRelatorioGeralSupervisao,
  listarCooperadosMonitoramento,
  listarVagasDisponiveis,
  CooperadoMonitoramento,
  VagaDisponivel,
  DetalhesCooperadoMonitoramento,
  RelatorioPorVagaItem,
  RelatorioGeralSupervisao,
} from '../../../api/monitoramentoApi';
import { formatarCPF } from '../../../utils/formatters';

export const MonitoramentoRelatorios: React.FC = () => {
  const hoje = new Date().toISOString().slice(0, 10);
  const primeiroDiaMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

  const [tipoRelatorio, setTipoRelatorio] = useState<'individual' | 'vaga' | 'geral'>('individual');
  const [dataInicio, setDataInicio] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(hoje);

  // Seletores para filtros
  const [cooperados, setCooperados] = useState<CooperadoMonitoramento[]>([]);
  const [vagas, setVagas] = useState<VagaDisponivel[]>([]);
  const [cooperadoSelecionadoId, setCooperadoSelecionadoId] = useState<number | ''>('');
  const [vagaSelecionadaId, setVagaSelecionadaId] = useState<number | ''>('');

  // Estados dos resultados
  const [relIndividual, setRelIndividual] = useState<DetalhesCooperadoMonitoramento | null>(null);
  const [relPorVaga, setRelPorVaga] = useState<RelatorioPorVagaItem[]>([]);
  const [relGeral, setRelGeral] = useState<RelatorioGeralSupervisao | null>(null);

  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  // Carregar listas para seleção de filtros
  useEffect(() => {
    async function carregarListas() {
      try {
        const [listaCoop, listaVag] = await Promise.all([
          listarCooperadosMonitoramento({ limite: 100 }),
          listarVagasDisponiveis(),
        ]);
        setCooperados(listaCoop);
        setVagas(listaVag);
        if (listaCoop.length > 0 && !cooperadoSelecionadoId) {
          setCooperadoSelecionadoId(listaCoop[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar listas de filtros', err);
      }
    }
    carregarListas();
  }, []);

  const gerarRelatorio = async () => {
    setCarregando(true);
    setErro('');
    try {
      if (tipoRelatorio === 'individual') {
        if (!cooperadoSelecionadoId) {
          setErro('Selecione um cooperado para gerar o relatório individual.');
          setCarregando(false);
          return;
        }
        const data = await obterRelatorioIndividual(Number(cooperadoSelecionadoId), {
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        });
        setRelIndividual(data);
      } else if (tipoRelatorio === 'vaga') {
        const data = await obterRelatorioPorVaga({
          vagaId: vagaSelecionadaId ? Number(vagaSelecionadaId) : undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        });
        setRelPorVaga(data);
      } else if (tipoRelatorio === 'geral') {
        const data = await obterRelatorioGeralSupervisao({
          vagaId: vagaSelecionadaId ? Number(vagaSelecionadaId) : undefined,
          dataInicio: dataInicio || undefined,
          dataFim: dataFim || undefined,
        });
        setRelGeral(data);
      }
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao gerar relatório.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (tipoRelatorio === 'individual' && cooperadoSelecionadoId) {
      gerarRelatorio();
    } else if (tipoRelatorio !== 'individual') {
      gerarRelatorio();
    }
  }, [tipoRelatorio, cooperadoSelecionadoId, vagaSelecionadaId, dataInicio, dataFim]);

  const handleImprimir = () => {
    window.print();
  };

  return (
    <div className="monitoramento-relatorios-container">
      {/* ── Sub-navegação dos Tipos de Relatórios ── */}
      <div className="monitoramento-tabs-nav" style={{ marginBottom: 16 }}>
        <button
          type="button"
          className={`monitoramento-tab-btn ${tipoRelatorio === 'individual' ? 'active' : ''}`}
          onClick={() => setTipoRelatorio('individual')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          Relatório Individual do Cooperado
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${tipoRelatorio === 'vaga' ? 'active' : ''}`}
          onClick={() => setTipoRelatorio('vaga')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          Relatório Geral por Vaga / Posto
        </button>

        <button
          type="button"
          className={`monitoramento-tab-btn ${tipoRelatorio === 'geral' ? 'active' : ''}`}
          onClick={() => setTipoRelatorio('geral')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <line x1="18" y1="20" x2="18" y2="10" />
            <line x1="12" y1="20" x2="12" y2="4" />
            <line x1="6" y1="20" x2="6" y2="14" />
          </svg>
          Relatório Geral da Supervisão
        </button>
      </div>

      {/* ── Barra de Filtros e Ações ── */}
      <div className="monitoramento-filters-bar no-print">
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', flex: 1 }}>
          {tipoRelatorio === 'individual' && (
            <div style={{ minWidth: 240 }}>
              <select
                className="filter-input"
                style={{ width: '100%' }}
                value={cooperadoSelecionadoId}
                onChange={(e) => setCooperadoSelecionadoId(Number(e.target.value))}
              >
                <option value="">-- Selecione o Cooperado --</option>
                {cooperados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome} ({formatarCPF(c.cpf)})
                  </option>
                ))}
              </select>
            </div>
          )}

          {(tipoRelatorio === 'vaga' || tipoRelatorio === 'geral') && (
            <div style={{ minWidth: 240 }}>
              <select
                className="filter-input"
                style={{ width: '100%' }}
                value={vagaSelecionadaId}
                onChange={(e) => setVagaSelecionadaId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Todas as Vagas / Postos --</option>
                {vagas.map((v) => (
                  <option key={v.vaga_id} value={v.vaga_id}>
                    {v.vaga_cargo} — {v.empresa_nome}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>De:</span>
            <input
              type="date"
              className="filter-input"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 13, color: '#64748b' }}>Até:</span>
            <input
              type="date"
              className="filter-input"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
            />
          </div>

          <button type="button" className="btn-refresh" onClick={gerarRelatorio} disabled={carregando}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M23 4v6h-6" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {carregando ? 'Filtrando...' : 'Atualizar'}
          </button>
        </div>

        <div>
          <button
            type="button"
            className="btn-action-view"
            onClick={handleImprimir}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px', fontWeight: 600 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect x="6" y="14" width="12" height="8" />
            </svg>
            Imprimir / Exportar PDF
          </button>
        </div>
      </div>

      {erro && (
        <div style={{ padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, marginBottom: 16 }}>
          {erro}
        </div>
      )}

      {/* ── 1. RENDER DO RELATÓRIO INDIVIDUAL DO COOPERADO ── */}
      {tipoRelatorio === 'individual' && relIndividual && (
        <div className="report-print-sheet">
          <div className="report-header">
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>ATESA — Relatório Individual de Apontamentos</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Espelho de Ponto, Horas Complementares & Auditoria
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#475569' }}>
              <div><strong>Período:</strong> {dataInicio.split('-').reverse().join('/')} a {dataFim.split('-').reverse().join('/')}</div>
              <div><strong>Emitido em:</strong> {new Date().toLocaleDateString('pt-BR')} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
            </div>
          </div>

          {/* Ficha do Cooperado no Relatório */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', marginBottom: 16, fontSize: 12.5 }}>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>NOME DO COOPERADO</span>
              <strong>{relIndividual.cooperado.nome}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>CPF</span>
              <strong>{formatarCPF(relIndividual.cooperado.cpf)}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>OPERAÇÃO / TOMADOR</span>
              <strong>{relIndividual.cooperado.alocacao?.empresaNome || 'Não alocado'}</strong>
            </div>
            <div>
              <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>VAGA / TURNO</span>
              <strong>{relIndividual.cooperado.alocacao?.vagaCargo || '—'} ({relIndividual.cooperado.alocacao?.vagaEscala || '—'})</strong>
            </div>
          </div>

          {/* Resumo de Horas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#166534', display: 'block' }}>HORAS TRABALHADAS</span>
              <strong style={{ fontSize: 16, color: '#14532d' }}>{relIndividual.resumo.totalHoras}h</strong>
            </div>
            <div style={{ padding: 10, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#1e40af', display: 'block' }}>HORAS ADICIONAIS</span>
              <strong style={{ fontSize: 16, color: '#1d4ed8' }}>{relIndividual.resumo.horasAdicionais || '00:00'}h</strong>
            </div>
            <div style={{ padding: 10, background: '#faf5ff', borderRadius: 6, border: '1px solid #e9d5ff', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#6b21a8', display: 'block' }}>ADICIONAL NOTURNO</span>
              <strong style={{ fontSize: 16, color: '#581c87' }}>{relIndividual.resumo.adicionalNoturno || '00:00'}h</strong>
            </div>
            <div style={{ padding: 10, background: '#fff1f2', borderRadius: 6, border: '1px solid #fecdd3', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#9f1239', display: 'block' }}>DESCONTO DE HORAS</span>
              <strong style={{ fontSize: 16, color: '#881337' }}>{relIndividual.resumo.descontoHoras || '00:00'}h</strong>
            </div>
            <div style={{ padding: 10, background: '#fefce8', borderRadius: 6, border: '1px solid #fef08a', textAlign: 'center' }}>
              <span style={{ fontSize: 11, color: '#854d0e', display: 'block' }}>BONIFICAÇÕES</span>
              <strong style={{ fontSize: 16, color: '#713f12' }}>R$ {(relIndividual.resumo.bonificacoesTotal || 0).toFixed(2)}</strong>
            </div>
          </div>

          {/* Tabela de Apontamentos */}
          <h4 style={{ margin: '16px 0 8px 0', fontSize: 14, color: '#1e293b' }}>1. Apontamentos do Aplicativo & Ajustes</h4>
          <table className="report-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Evento</th>
                <th>Atividade</th>
                <th>Observação</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {relIndividual.apontamentos.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>
                    Nenhum apontamento registrado no período.
                  </td>
                </tr>
              ) : (
                relIndividual.apontamentos.map((ap) => {
                  const dt = ap.timestamp_dispositivo ? new Date(ap.timestamp_dispositivo) : null;
                  const hora = dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '—';
                  const dataStr = ap.data_referencia ? String(ap.data_referencia).slice(0, 10).split('-').reverse().join('/') : '—';

                  return (
                    <tr key={ap.id}>
                      <td>{dataStr}</td>
                      <td><strong>{hora}</strong></td>
                      <td>{ap.tipo_evento}</td>
                      <td>{ap.atividade || ap.vaga_cargo || '—'}</td>
                      <td>
                        {ap.ajustado === 1 && ap.observacao_ajuste ? (
                          <span style={{ color: '#b45309', fontWeight: 600 }}>[AJUSTE] {ap.observacao_ajuste}</span>
                        ) : ap.observacao || '—'}
                      </td>
                      <td>{ap.ajustado === 1 ? 'Ajustado' : 'Normal'}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>

          {/* Tabela de Complementos de Horas */}
          <h4 style={{ margin: '20px 0 8px 0', fontSize: 14, color: '#1e293b' }}>2. Lançamentos Complementares de Horas e Bonificações</h4>
          <table className="report-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Tipo</th>
                <th>Qtd Horas / Valor</th>
                <th>Motivo / Justificativa</th>
                <th>Responsável</th>
              </tr>
            </thead>
            <tbody>
              {(!relIndividual.complementos || relIndividual.complementos.length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>
                    Nenhum lançamento complementar no período.
                  </td>
                </tr>
              ) : (
                relIndividual.complementos.map((c) => (
                  <tr key={c.id}>
                    <td>{c.data_referencia.slice(0, 10).split('-').reverse().join('/')}</td>
                    <td style={{ textTransform: 'capitalize' }}>{c.tipo.replace('_', ' ')}</td>
                    <td>
                      {c.tipo === 'bonificacao' ? `R$ ${(c.valor || 0).toFixed(2)}` : `${c.quantidade_horas || 0}h`}
                    </td>
                    <td>{c.motivo}</td>
                    <td>{c.criado_por_nome}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Trilha de Auditoria */}
          <h4 style={{ margin: '20px 0 8px 0', fontSize: 14, color: '#1e293b' }}>3. Trilha de Auditoria & Justificativas da Supervisão</h4>
          <table className="report-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Responsável</th>
                <th>Ação / Campo</th>
                <th>Anterior → Novo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              {(!relIndividual.logsAuditoria || relIndividual.logsAuditoria.length === 0) ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: 16, color: '#94a3b8' }}>
                    Nenhuma alteração de auditoria gravada para este período.
                  </td>
                </tr>
              ) : (
                relIndividual.logsAuditoria.map((l) => (
                  <tr key={l.id}>
                    <td>{new Date(l.criado_em).toLocaleDateString('pt-BR')} {new Date(l.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>{l.usuario_nome} ({l.usuario_perfil})</td>
                    <td>{l.campo || l.acao}</td>
                    <td>{l.valor_anterior || '—'} → {l.valor_novo || '—'}</td>
                    <td>{l.motivo || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 2. RENDER DO RELATÓRIO GERAL POR VAGA / POSTO ── */}
      {tipoRelatorio === 'vaga' && (
        <div className="report-print-sheet">
          <div className="report-header">
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>ATESA — Relatório Geral Consolidado por Vaga</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Acompanhamento de alocação de cooperados e volume de apontamentos
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#475569' }}>
              <div><strong>Período:</strong> {dataInicio.split('-').reverse().join('/')} a {dataFim.split('-').reverse().join('/')}</div>
              <div><strong>Emitido em:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          <table className="report-table" style={{ marginTop: 16 }}>
            <thead>
              <tr>
                <th>Vaga / Posto</th>
                <th>Tomador / Operação</th>
                <th>Escala / Turno</th>
                <th>Cooperado Alocado</th>
                <th>CPF</th>
                <th style={{ textAlign: 'center' }}>Total Apontamentos</th>
                <th style={{ textAlign: 'center' }}>Ajustes Supervisão</th>
              </tr>
            </thead>
            <tbody>
              {relPorVaga.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                    Nenhuma vaga ou alocação encontrada no filtro selecionado.
                  </td>
                </tr>
              ) : (
                relPorVaga.map((item, idx) => (
                  <tr key={`${item.vaga_id}-${item.candidato_id}-${idx}`}>
                    <td><strong>{item.vaga_cargo}</strong></td>
                    <td>{item.empresa_nome}</td>
                    <td>{item.tipo_escala || 'Normal'}</td>
                    <td>{item.candidato_nome}</td>
                    <td>{formatarCPF(item.candidato_cpf)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.total_apontamentos}</td>
                    <td style={{ textAlign: 'center', color: item.total_ajustes > 0 ? '#b45309' : '#64748b' }}>
                      {item.total_ajustes}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 3. RENDER DO RELATÓRIO GERAL DA SUPERVISÃO ── */}
      {tipoRelatorio === 'geral' && relGeral && (
        <div className="report-print-sheet">
          <div className="report-header">
            <div>
              <h2 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>ATESA — Relatório Geral Executivo da Supervisão</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                Consolidado geral de horas operacionais, complementos, ajustes e cooperados
              </div>
            </div>
            <div style={{ textAlign: 'right', fontSize: 12, color: '#475569' }}>
              <div><strong>Período:</strong> {dataInicio.split('-').reverse().join('/')} a {dataFim.split('-').reverse().join('/')}</div>
              <div><strong>Emitido em:</strong> {new Date().toLocaleDateString('pt-BR')}</div>
            </div>
          </div>

          {/* Cards do Relatório Geral */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '16px 0' }}>
            <div style={{ padding: 12, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', textAlign: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#64748b', display: 'block' }}>TOTAL COOPERADOS</span>
              <strong style={{ fontSize: 20, color: '#0f172a' }}>{relGeral.resumo.cards.totalCooperadosAtivos}</strong>
            </div>
            <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', textAlign: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#166534', display: 'block' }}>HORAS TRABALHADAS</span>
              <strong style={{ fontSize: 20, color: '#14532d' }}>{relGeral.resumo.cards.horasTrabalhadasHoje}h</strong>
            </div>
            <div style={{ padding: 12, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', textAlign: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#1e40af', display: 'block' }}>HORAS ADICIONAIS</span>
              <strong style={{ fontSize: 20, color: '#1d4ed8' }}>{relGeral.resumo.cards.horasAdicionais || '00:00'}h</strong>
            </div>
            <div style={{ padding: 12, background: '#fefce8', borderRadius: 6, border: '1px solid #fef08a', textAlign: 'center' }}>
              <span style={{ fontSize: 11.5, color: '#854d0e', display: 'block' }}>BONIFICAÇÕES</span>
              <strong style={{ fontSize: 20, color: '#713f12' }}>R$ {(relGeral.resumo.cards.bonificacoesTotal || 0).toFixed(2)}</strong>
            </div>
          </div>

          <table className="report-table">
            <thead>
              <tr>
                <th>Cooperado</th>
                <th>CPF</th>
                <th>Operação / Tomador</th>
                <th>Vaga / Cargo</th>
                <th style={{ textAlign: 'center' }}>Apontamentos</th>
                <th style={{ textAlign: 'center' }}>Ajustes</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              {relGeral.cooperados.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                    Nenhum cooperado encontrado para o período.
                  </td>
                </tr>
              ) : (
                relGeral.cooperados.map((coop) => (
                  <tr key={coop.id}>
                    <td><strong>{coop.nome}</strong></td>
                    <td>{formatarCPF(coop.cpf)}</td>
                    <td>{coop.alocacao?.empresaNome || 'Não alocado'}</td>
                    <td>{coop.alocacao?.vagaCargo || '—'}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{coop.totalApontamentosPeriodo}</td>
                    <td style={{ textAlign: 'center', color: coop.totalAjustesPeriodo > 0 ? '#b45309' : '#64748b' }}>
                      {coop.totalAjustesPeriodo}
                    </td>
                    <td>
                      <span className={`badge-status ${coop.situacao === 'em_atividade' ? 'badge-em-atividade' : 'badge-ativo'}`}>
                        {coop.situacao === 'em_atividade' ? 'Em Atividade' : 'Ativo'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default MonitoramentoRelatorios;
