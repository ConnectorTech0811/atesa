import React, { useEffect, useMemo, useState } from 'react';
import { dataLocalISO, formatarDataBR, parseDataHoraServidor } from '../../../utils/formatters';
import {
  ApontamentoDetalhado,
  listarClientesApontamentos,
  listarTodosApontamentos,
} from '../../../api/monitoramentoApi';
import ModalEdicaoApontamento from './ModalEdicaoApontamento';
import { addDias, agruparJornadas, dataDe, ehAjustado, horaDe, LinhaJornada, msDe, ROTULO_EVENTO } from './jornadaApontamentos';
import ModalObservacaoApontamento from './ModalObservacaoApontamento';

interface Props {
  onVisualizarCooperado?: (candidatoId: number) => void;
}

/** Faixa de horário do plantão aplicada à entrada (ou ao primeiro evento); início > fim vira a noite. */
function dentroDaFaixa(l: LinhaJornada, horaInicio: string, horaFim: string): boolean {
  if (!horaInicio && !horaFim) return true;
  const h = horaDe(l.entrada ?? l.batidas[0]);
  if (horaInicio && horaFim && horaInicio > horaFim) return h >= horaInicio || h <= horaFim;
  return (!horaInicio || h >= horaInicio) && (!horaFim || h <= horaFim);
}

export const MonitoramentoApontamentos: React.FC<Props> = ({ onVisualizarCooperado }) => {
  const hoje = dataLocalISO();
  const [dataInicio, setDataInicio] = useState(hoje);
  const [dataFim, setDataFim] = useState(hoje);
  const [busca, setBusca] = useState('');
  const [statusFiltro, setStatusFiltro] = useState('');
  const [apenasAjustados, setApenasAjustados] = useState(false);
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFim, setHoraFim] = useState('');
  const [clientes, setClientes] = useState<{ id: number; nome_empresa: string }[]>([]);

  useEffect(() => {
    listarClientesApontamentos().then(setClientes).catch(() => setClientes([]));
  }, []);

  const [apontamentos, setApontamentos] = useState<ApontamentoDetalhado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Edição abre a jornada inteira, com o apontamento clicado em destaque
  const [edicao, setEdicao] = useState<{ jornada: LinhaJornada; focoId: number | null } | null>(null);
  const [apontamentoParaObs, setApontamentoParaObs] = useState<ApontamentoDetalhado | null>(null);
  // Menu da coluna Ações: qual jornada e qual ação (escolhe-se a batida na lista)
  const [menuAcao, setMenuAcao] = useState<{ chave: string; top: number; right: number } | null>(null);

  const carregarApontamentos = async () => {
    setCarregando(true);
    setErro('');
    try {
      // Um dia a mais em cada ponta para completar plantões que viram a noite;
      // status, ajustes e horário são filtrados por jornada (abaixo), não por batida.
      const data = await listarTodosApontamentos({
        busca: busca.trim() || undefined,
        dataInicio: dataInicio ? addDias(dataInicio, -1) : undefined,
        dataFim: dataFim ? addDias(dataFim, 1) : undefined,
        empresaId: empresaId || undefined,
        limite: 2000,
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
  }, [busca, dataInicio, dataFim, empresaId]);

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

  const jornadas = useMemo(() => agruparJornadas(apontamentosFiltrados).filter((l) => {
    if (dataInicio && l.data < dataInicio) return false;
    if (dataFim && l.data > dataFim) return false;
    if (!dentroDaFaixa(l, horaInicio, horaFim)) return false;
    const ajustada = l.batidas.some(ehAjustado);
    const divergente = l.batidas.some((b) => b.status === 'divergente');
    if (apenasAjustados && !ajustada) return false;
    if (statusFiltro === 'ajustado' && !ajustada) return false;
    if (statusFiltro === 'divergente' && !divergente) return false;
    if (statusFiltro === 'pendente' && !(l.batidas.some((b) => b.status === 'pendente') || !l.entrada || !l.saida)) return false;
    if (statusFiltro === 'normal' && (ajustada || divergente)) return false;
    return true;
  }), [apontamentosFiltrados, dataInicio, dataFim, horaInicio, horaFim, apenasAjustados, statusFiltro]);

  /** Horário de uma batida: clique edita; o balão abre a observação. Outro dia aparece com a data. */
  const Batida: React.FC<{ ap: ApontamentoDetalhado | null; linha: LinhaJornada }> = ({ ap, linha }) => {
    const dataLinha = linha.data;
    if (!ap) return <span style={{ color: '#cbd5e1' }}>—</span>;
    const ajustada = ehAjustado(ap);
    const outroDia = dataDe(ap) !== dataLinha;
    const obs = ajustada && ap.observacao_ajuste ? ap.observacao_ajuste : ap.observacao;
    const dica = [
      ajustada ? `Ajustado por ${ap.ajustado_por_nome || 'Supervisão'}${ap.ajustado_em ? ` em ${parseDataHoraServidor(ap.ajustado_em).toLocaleString('pt-BR')}` : ''}` : 'Registro do App',
      ap.motivo_ajuste ? `Motivo: ${ap.motivo_ajuste}` : '',
      obs ? `Obs.: ${obs}` : '',
      'Clique para editar o horário',
    ].filter(Boolean).join('\n');
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }}>
        <button type="button" onClick={() => setEdicao({ jornada: linha, focoId: ap.id })} title={dica}
          style={{
            border: `1px solid ${ajustada ? '#f59e0b' : ap.status === 'divergente' ? '#fca5a5' : '#e2e8f0'}`,
            background: ajustada ? '#fffbeb' : ap.status === 'divergente' ? '#fef2f2' : '#f8fafc',
            borderRadius: 6, padding: '2px 6px', fontWeight: 700, fontSize: 13, color: '#0f172a', cursor: 'pointer',
          }}>
          {horaDe(ap)}
          {outroDia && <span style={{ fontWeight: 500, fontSize: 10.5, color: '#64748b', marginLeft: 3 }}>{formatarDataBR(dataDe(ap)).slice(0, 5)}</span>}
        </button>
        <button type="button" onClick={() => setApontamentoParaObs(ap)} title={obs ? `Observação: ${obs}` : 'Adicionar observação'}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 2, color: obs ? '#4a9e4f' : '#cbd5e1', display: 'inline-flex' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      </span>
    );
  };

  const Intervalos: React.FC<{ lista: LinhaJornada['refeicoes']; linha: LinhaJornada }> = ({ lista, linha }) => (
    lista.length === 0 ? <span style={{ color: '#cbd5e1' }}>—</span> : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {lista.map((i, k) => (
          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Batida ap={i.ini} linha={linha} /><span style={{ color: '#94a3b8' }}>→</span><Batida ap={i.fim} linha={linha} />
          </span>
        ))}
      </div>
    )
  );

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

        <div className="filter-item" style={{ flex: 2, minWidth: 200 }}>
          <label>Cliente</label>
          <select
            className="filter-select"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">Todos os clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome_empresa}</option>)}
          </select>
        </div>

        <div className="filter-item" style={{ minWidth: 220 }}>
          <label title="Mostra as jornadas cuja entrada está dentro da faixa. Se o início for maior que o fim (ex.: 19:00 → 07:00), a faixa vira a noite.">
            Horário do Plantão (início / fim)
          </label>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="time" className="filter-input" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} aria-label="Hora de início do plantão" />
            <span style={{ color: '#94a3b8' }}>–</span>
            <input type="time" className="filter-input" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} aria-label="Hora de fim do plantão" />
            {(horaInicio || horaFim) && (
              <button type="button" onClick={() => { setHoraInicio(''); setHoraFim(''); }} title="Limpar horário" style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>✕</button>
            )}
          </div>
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
            {jornadas.length} jornada(s)
          </span>
        </div>

        <div className="table-responsive">
          <table className="monitoramento-table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Cooperado</th>
                <th>Operação / Vaga</th>
                <th>Deslocamento</th>
                <th>Entrada</th>
                <th>Refeição</th>
                <th>Pausa</th>
                <th>Saída</th>
                <th>Status</th>
                <th>Última Alteração</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', padding: 36, color: '#64748b' }}>
                    Carregando apontamentos...
                  </td>
                </tr>
              ) : jornadas.length === 0 ? (
                <tr>
                  <td colSpan={11}>
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
                          : 'Tente alterar os filtros de data, cliente, horário, status ou busca.'}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                jornadas.map((l) => {
                  const ap = l.referencia;
                  const ajustada = l.batidas.some(ehAjustado);
                  const divergente = l.batidas.some((b) => b.status === 'divergente');
                  const incompleta = !l.entrada || !l.saida;
                  const ultimaAlteracao = l.batidas
                    .filter((b) => b.ajustado_em)
                    .sort((a, b) => parseDataHoraServidor(b.ajustado_em!).getTime() - parseDataHoraServidor(a.ajustado_em!).getTime())[0];
                  const menuAberto = menuAcao?.chave === l.chave;
                  // Menu em posição fixa na tela: a tabela tem rolagem e cortaria o menu nas últimas linhas
                  const abrirMenu = (e: React.MouseEvent<HTMLButtonElement>) => {
                    const r = e.currentTarget.getBoundingClientRect();
                    setMenuAcao(menuAberto ? null : { chave: l.chave, top: r.bottom + 4, right: window.innerWidth - r.right });
                  };
                  return (
                    <tr key={l.chave}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{formatarDataBR(l.data)}</div>
                      </td>
                      <td>
                        <div
                          style={{ fontWeight: 600, color: '#0f172a', cursor: onVisualizarCooperado ? 'pointer' : 'default' }}
                          onClick={() => onVisualizarCooperado && onVisualizarCooperado(l.candidatoId)}
                          title="Clique para abrir monitoramento individual do cooperado"
                        >
                          {ap.candidato_nome || `ID #${l.candidatoId}`}
                        </div>
                        {ap.candidato_matricula && (
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>Matrícula: {ap.candidato_matricula}</div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{ap.empresa_nome || '—'}</div>
                        <div style={{ fontSize: 12, color: '#64748b' }}>{ap.vaga_cargo || ap.atividade || '—'}</div>
                      </td>
                      <td><Batida ap={l.deslocamento} linha={l} /></td>
                      <td><Batida ap={l.entrada} linha={l} /></td>
                      <td><Intervalos lista={l.refeicoes} linha={l} /></td>
                      <td><Intervalos lista={l.pausas} linha={l} /></td>
                      <td><Batida ap={l.saida} linha={l} /></td>
                      <td>
                        {ajustada ? (
                          <span className="badge-status badge-ajustado">Ajustado</span>
                        ) : divergente ? (
                          <span className="badge-status badge-divergente">Divergente</span>
                        ) : incompleta ? (
                          <span className="badge-status badge-pendente" title={!l.entrada ? 'Sem registro de entrada' : 'Sem registro de saída'}>Incompleta</span>
                        ) : (
                          <span className="badge-status badge-ativo">Normal</span>
                        )}
                      </td>
                      <td>
                        {ultimaAlteracao ? (
                          <div style={{ fontSize: 11.5, color: '#64748b' }}>
                            Por <strong>{ultimaAlteracao.ajustado_por_nome || 'Supervisão'}</strong> em {parseDataHoraServidor(ultimaAlteracao.ajustado_em!).toLocaleDateString('pt-BR')} às {parseDataHoraServidor(ultimaAlteracao.ajustado_em!).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            <div>({ROTULO_EVENTO[ultimaAlteracao.tipo_evento] ?? ultimaAlteracao.tipo_evento})</div>
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
                            onClick={() => setEdicao({ jornada: l, focoId: null })}
                            title="Editar os horários dos apontamentos desta jornada"
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
                            onClick={abrirMenu}
                            title="Escolha o apontamento da jornada para adicionar ou alterar a observação"
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                            </svg>
                            Obs
                          </button>
                        </div>
                        {menuAberto && menuAcao && (<>
                          <div onClick={() => setMenuAcao(null)} style={{ position: 'fixed', inset: 0, zIndex: 999 }} />
                          <div role="menu" style={{
                            position: 'fixed', right: menuAcao.right, top: Math.min(menuAcao.top, window.innerHeight - 290), zIndex: 1000, background: '#fff', border: '1px solid #e2e8f0',
                            borderRadius: 8, boxShadow: '0 8px 24px rgba(15,23,42,0.12)', padding: 4, minWidth: 190, textAlign: 'left',
                          }}>
                            <div style={{ fontSize: 11, color: '#64748b', padding: '4px 8px', fontWeight: 700, textTransform: 'uppercase' }}>
                              Observação de qual apontamento?
                            </div>
                            {[...l.batidas].sort((a, b) => msDe(a) - msDe(b)).map((b) => (
                              <button key={b.id} type="button" role="menuitem"
                                onClick={() => { setMenuAcao(null); setApontamentoParaObs(b); }}
                                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, width: '100%', border: 'none', background: 'transparent', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#0f172a' }}
                                onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                              >
                                <span>{ROTULO_EVENTO[b.tipo_evento] ?? b.tipo_evento}{ehAjustado(b) ? ' · ajustado' : ''}</span>
                                <strong>{horaDe(b)}</strong>
                              </button>
                            ))}
                          </div>
                        </>)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <p style={{ padding: '10px 24px', margin: 0, fontSize: 12, color: '#64748b' }}>
          Uma linha por jornada. Editar abre todos os apontamentos da jornada (deslocamento, início, refeição, pausa e fim) já com os horários marcados; Obs escolhe o apontamento. Também dá para clicar direto no horário (editar) e no balão (observação); passe o mouse para ver quem ajustou e o motivo.
          Horário em outro dia (plantão que vira a noite) aparece com a data ao lado.
        </p>
      </div>

      {/* Modais */}
      {edicao && (
        <ModalEdicaoApontamento
          jornada={edicao.jornada}
          focoId={edicao.focoId}
          onClose={() => setEdicao(null)}
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
