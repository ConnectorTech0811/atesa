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
  const [filtroBuscaCoop, setFiltroBuscaCoop] = useState('');
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
          listarCooperadosMonitoramento({ limite: 300 }),
          listarVagasDisponiveis(),
        ]);
        setCooperados(listaCoop || []);
        setVagas(listaVag || []);
        if (listaCoop && listaCoop.length > 0 && !cooperadoSelecionadoId) {
          setCooperadoSelecionadoId(listaCoop[0].id);
        }
      } catch (err) {
        console.error('Erro ao carregar listas de filtros', err);
      }
    }
    carregarListas();
  }, []);

  const cooperadosFiltradosDropdown = cooperados.filter((c) => {
    if (!filtroBuscaCoop.trim()) return true;
    const termo = filtroBuscaCoop.trim().toLowerCase();
    const digitos = termo.replace(/\D/g, '');
    const matchNome = (c.nome || '').toLowerCase().includes(termo);
    const matchMatricula = String(c.matricula || c.id || '').toLowerCase().includes(termo);
    const matchCpf = digitos.length >= 3 && (c.cpf || '').replace(/\D/g, '').includes(digitos);
    return matchNome || matchMatricula || matchCpf;
  });

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
        setRelPorVaga(data || []);
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
      let msg = err?.message || 'Erro ao gerar relatório.';
      if (msg.includes('<!DOCTYPE') || msg.includes('Cannot GET')) {
        msg = 'Serviço de supervisão temporariamente indisponível. Tente novamente em instantes.';
      }
      setErro(msg);
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

  // ── Emissão de Impressão Direta e Limpa (Sem Tela Branca) ──
  const handleImprimir = () => {
    try {
      const dtIniStr = dataInicio ? dataInicio.split('-').reverse().join('/') : '—';
      const dtFimStr = dataFim ? dataFim.split('-').reverse().join('/') : '—';
      const emitidoEm = `${new Date().toLocaleDateString('pt-BR')} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

      let tituloDoc = 'ATESA — Relatório de Supervisão';
      let conteudoCorpo = '';

      if (tipoRelatorio === 'individual' && relIndividual) {
        tituloDoc = `Relatório Individual — ${relIndividual.cooperado?.nome || 'Cooperado'}`;
        const coop = relIndividual.cooperado || ({} as any);
        const res = relIndividual.resumo || ({} as any);
        const aponts = relIndividual.apontamentos || [];
        const compls = relIndividual.complementos || [];
        const logs = relIndividual.logsAuditoria || [];

        conteudoCorpo = `
          <div class="header-box">
            <div class="brand">
              <h1>ATESA COOPERATIVA DE TRABALHO</h1>
              <p>Relatório Individual de Monitoramento, Apontamentos & Auditoria</p>
            </div>
            <div class="meta">
              <p><strong>Período:</strong> ${dtIniStr} a ${dtFimStr}</p>
              <p><strong>Emissão:</strong> ${emitidoEm}</p>
            </div>
          </div>

          <div class="card-info">
            <div><span>COOPERADO:</span> <strong>${coop.nome || '—'}</strong></div>
            <div><span>CPF:</span> <strong>${formatarCPF(coop.cpf)}</strong></div>
            <div><span>MATRÍCULA:</span> <strong>${coop.matricula || `#${coop.id || '—'}`}</strong></div>
            <div><span>TOMADOR / OPERAÇÃO:</span> <strong>${coop.alocacao?.empresaNome || 'Não alocado'}</strong></div>
            <div><span>VAGA / CARGO:</span> <strong>${coop.alocacao?.vagaCargo || '—'}</strong></div>
            <div><span>ESCALA:</span> <strong>${coop.alocacao?.vagaEscala || 'Normal'}</strong></div>
          </div>

          <div class="summary-grid">
            <div class="sum-box"><span>HORAS TRABALHADAS</span><strong>${res.totalHoras || '00:00'}h</strong></div>
            <div class="sum-box"><span>HORAS ADICIONAIS</span><strong>${res.horasAdicionais || '00:00'}h</strong></div>
            <div class="sum-box"><span>ADICIONAL NOTURNO</span><strong>${res.adicionalNoturno || '00:00'}h</strong></div>
            <div class="sum-box"><span>DESCONTO DE HORAS</span><strong>${res.descontoHoras || '00:00'}h</strong></div>
            <div class="sum-box"><span>BONIFICAÇÕES</span><strong>R$ ${(Number(res.bonificacoesTotal) || 0).toFixed(2)}</strong></div>
          </div>

          <h3 class="section-title">1. Apontamentos do Aplicativo & Ajustes (${aponts.length} registros)</h3>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Evento</th>
                <th>Operação / Posto</th>
                <th>Observação / Ajuste</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${aponts.length === 0 ? '<tr><td colspan="6" style="text-align:center;">Nenhum apontamento registrado no período.</td></tr>' :
                aponts.map(ap => {
                  const dt = ap.timestamp_dispositivo ? new Date(ap.timestamp_dispositivo) : null;
                  const hora = dt ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}` : '—';
                  const dStr = ap.data_referencia ? String(ap.data_referencia).slice(0, 10).split('-').reverse().join('/') : '—';
                  const ehAj = ap.ajustado === 1 || (ap.status && ap.status.toLowerCase() === 'ajustado');
                  return `
                    <tr>
                      <td>${dStr}</td>
                      <td><strong>${hora}</strong></td>
                      <td>${ap.tipo_evento || '—'}</td>
                      <td>${ap.vaga_cargo || ap.atividade || '—'}</td>
                      <td>${ehAj && ap.observacao_ajuste ? `[AJUSTE] ${ap.observacao_ajuste}` : (ap.observacao || '—')}</td>
                      <td>${ehAj ? 'Ajustado' : 'Normal'}</td>
                    </tr>
                  `;
                }).join('')
              }
            </tbody>
          </table>

          <h3 class="section-title">2. Lançamentos Complementares & Bonificações</h3>
          <table>
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
              ${compls.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Nenhum lançamento complementar no período.</td></tr>' :
                compls.map(c => `
                  <tr>
                    <td>${String(c.data_referencia || '').slice(0, 10).split('-').reverse().join('/')}</td>
                    <td style="text-transform: capitalize;">${String(c.tipo || '').replace('_', ' ')}</td>
                    <td>${c.tipo === 'bonificacao' ? `R$ ${(Number(c.valor) || 0).toFixed(2)}` : `${c.quantidade_horas || 0}h`}</td>
                    <td>${c.motivo || '—'}</td>
                    <td>${c.criado_por_nome || 'Supervisão'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>

          <h3 class="section-title">3. Trilha de Auditoria & Alterações da Supervisão</h3>
          <table>
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Responsável</th>
                <th>Ação / Campo</th>
                <th>Valor Anterior → Novo</th>
                <th>Motivo</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? '<tr><td colspan="5" style="text-align:center;">Nenhuma alteração de supervisão gravada no período.</td></tr>' :
                logs.map(l => `
                  <tr>
                    <td>${new Date(l.criado_em).toLocaleDateString('pt-BR')} ${new Date(l.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                    <td>${l.usuario_nome || '—'} (${l.usuario_perfil || 'Supervisão'})</td>
                    <td>${l.campo || l.acao || '—'}</td>
                    <td>${l.valor_anterior || '—'} → ${l.valor_novo || '—'}</td>
                    <td>${l.motivo || '—'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>

          <div class="signature-box">
            <div class="sig-line"><p>Assinatura do Supervisor Responsável</p></div>
            <div class="sig-line"><p>Assinatura do Cooperado</p></div>
          </div>
        `;
      } else if (tipoRelatorio === 'vaga') {
        tituloDoc = 'Relatório Consolidado por Vaga e Posto';
        conteudoCorpo = `
          <div class="header-box">
            <div class="brand">
              <h1>ATESA COOPERATIVA DE TRABALHO</h1>
              <p>Relatório Consolidado de Apontamentos por Vaga / Tomador</p>
            </div>
            <div class="meta">
              <p><strong>Período:</strong> ${dtIniStr} a ${dtFimStr}</p>
              <p><strong>Emissão:</strong> ${emitidoEm}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Vaga / Cargo</th>
                <th>Tomador / Operação</th>
                <th>Escala</th>
                <th>Cooperado Alocado</th>
                <th>CPF</th>
                <th style="text-align:center;">Apontamentos</th>
                <th style="text-align:center;">Ajustes</th>
              </tr>
            </thead>
            <tbody>
              ${relPorVaga.length === 0 ? '<tr><td colspan="7" style="text-align:center;">Nenhum registro encontrado.</td></tr>' :
                relPorVaga.map(v => `
                  <tr>
                    <td><strong>${v.vaga_cargo || '—'}</strong></td>
                    <td>${v.empresa_nome || '—'}</td>
                    <td>${v.tipo_escala || 'Normal'}</td>
                    <td>${v.candidato_nome || '—'}</td>
                    <td>${formatarCPF(v.candidato_cpf)}</td>
                    <td style="text-align:center;"><strong>${v.total_apontamentos || 0}</strong></td>
                    <td style="text-align:center;">${v.total_ajustes || 0}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        `;
      } else if (tipoRelatorio === 'geral' && relGeral) {
        tituloDoc = 'Relatório Geral Executivo da Supervisão';
        const cards = relGeral.resumo?.cards || ({} as any);
        const coops = relGeral.cooperados || [];

        conteudoCorpo = `
          <div class="header-box">
            <div class="brand">
              <h1>ATESA COOPERATIVA DE TRABALHO</h1>
              <p>Relatório Geral Executivo da Supervisão & Monitoramento</p>
            </div>
            <div class="meta">
              <p><strong>Período:</strong> ${dtIniStr} a ${dtFimStr}</p>
              <p><strong>Emissão:</strong> ${emitidoEm}</p>
            </div>
          </div>

          <div class="summary-grid">
            <div class="sum-box"><span>TOTAL COOPERADOS ATIVOS</span><strong>${cards.totalCooperadosAtivos ?? 0}</strong></div>
            <div class="sum-box"><span>HORAS TRABALHADAS</span><strong>${cards.horasTrabalhadasHoje || '00:00'}h</strong></div>
            <div class="sum-box"><span>HORAS ADICIONAIS</span><strong>${cards.horasAdicionais || '00:00'}h</strong></div>
            <div class="sum-box"><span>BONIFICAÇÕES</span><strong>R$ ${(Number(cards.bonificacoesTotal) || 0).toFixed(2)}</strong></div>
          </div>

          <h3 class="section-title">Listagem de Cooperados e Situação Operacional (${coops.length} registros)</h3>
          <table>
            <thead>
              <tr>
                <th>Cooperado</th>
                <th>CPF</th>
                <th>Tomador / Operação</th>
                <th>Vaga / Cargo</th>
                <th style="text-align:center;">Apontamentos</th>
                <th style="text-align:center;">Ajustes</th>
                <th>Situação</th>
              </tr>
            </thead>
            <tbody>
              ${coops.length === 0 ? '<tr><td colspan="7" style="text-align:center;">Nenhum cooperado encontrado no período.</td></tr>' :
                coops.map(c => `
                  <tr>
                    <td><strong>${c.nome || '—'}</strong></td>
                    <td>${formatarCPF(c.cpf)}</td>
                    <td>${c.alocacao?.empresaNome || 'Não alocado'}</td>
                    <td>${c.alocacao?.vagaCargo || '—'}</td>
                    <td style="text-align:center;"><strong>${c.totalApontamentosPeriodo ?? 0}</strong></td>
                    <td style="text-align:center;">${c.totalAjustesPeriodo ?? 0}</td>
                    <td>${c.situacao === 'em_atividade' ? 'Em Atividade' : 'Ativo'}</td>
                  </tr>
                `).join('')
              }
            </tbody>
          </table>
        `;
      }

      const htmlCompleto = `
        <!DOCTYPE html>
        <html lang="pt-BR">
        <head>
          <meta charset="UTF-8" />
          <title>${tituloDoc}</title>
          <style>
            @page { size: A4 portrait; margin: 12mm 10mm; }
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; padding: 12px; font-size: 11px; }
            .header-box { display: flex; justify-content: space-between; align-items: center; border-bottom: 2.5px solid #2e7d32; padding-bottom: 10px; margin-bottom: 14px; }
            .brand h1 { font-size: 16px; font-weight: 800; color: #1e293b; margin: 0; }
            .brand p { font-size: 11px; color: #2e7d32; font-weight: 700; margin-top: 2px; }
            .meta { text-align: right; font-size: 10.5px; color: #475569; line-height: 1.4; }
            .card-info { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; margin-bottom: 12px; }
            .card-info div span { font-size: 9.5px; color: #64748b; display: block; font-weight: 600; }
            .card-info div strong { font-size: 11px; color: #0f172a; }
            .summary-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 14px; }
            .sum-box { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 8px; text-align: center; }
            .sum-box span { font-size: 9px; color: #166534; font-weight: 700; display: block; }
            .sum-box strong { font-size: 14px; color: #14532d; }
            .section-title { font-size: 12px; font-weight: 700; color: #0f172a; margin: 14px 0 6px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 10px; }
            th { background: #f1f5f9; color: #334155; font-weight: 700; text-align: left; padding: 6px 8px; border: 1px solid #cbd5e1; }
            td { padding: 5px 8px; border: 1px solid #cbd5e1; color: #1e293b; vertical-align: top; }
            tr:nth-child(even) td { background: #f8fafc; }
            .signature-box { display: flex; justify-content: space-around; margin-top: 36px; page-break-inside: avoid; }
            .sig-line { width: 240px; border-top: 1px solid #475569; text-align: center; padding-top: 4px; }
            .sig-line p { font-size: 10px; color: #475569; font-weight: 600; }
          </style>
        </head>
        <body>
          ${conteudoCorpo}
        </body>
        </html>
      `;

      const printWin = window.open('', '_blank', 'width=900,height=700');
      if (printWin) {
        printWin.document.open();
        printWin.document.write(htmlCompleto);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => {
          printWin.print();
        }, 300);
      } else {
        // Se popup bloqueado pelo navegador, usa window.print() direto
        window.print();
      }
    } catch (err) {
      console.error('Erro ao emitir relatório para impressão:', err);
      window.print();
    }
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
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', minWidth: 320 }}>
              <input
                type="text"
                className="filter-input"
                placeholder="Filtrar cooperado por nome/CPF..."
                style={{ width: 220 }}
                value={filtroBuscaCoop}
                onChange={(e) => setFiltroBuscaCoop(e.target.value)}
              />
              <select
                className="filter-input"
                style={{ minWidth: 260, maxWidth: 360 }}
                value={cooperadoSelecionadoId}
                onChange={(e) => setCooperadoSelecionadoId(e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">-- Selecione o Cooperado --</option>
                {cooperadosFiltradosDropdown.map((c) => (
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
      {tipoRelatorio === 'individual' && (
        !cooperadoSelecionadoId ? (
          <div className="report-print-sheet" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <p style={{ fontSize: 15, fontWeight: 600 }}>Selecione um cooperado acima para emitir o relatório individual.</p>
          </div>
        ) : !relIndividual ? (
          <div className="report-print-sheet" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <p>{carregando ? 'Carregando dados do cooperado...' : 'Nenhum dado encontrado para o cooperado no período selecionado.'}</p>
          </div>
        ) : (
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
                <strong>{relIndividual.cooperado?.nome || '—'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>CPF</span>
                <strong>{formatarCPF(relIndividual.cooperado?.cpf)}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>OPERAÇÃO / TOMADOR</span>
                <strong>{relIndividual.cooperado?.alocacao?.empresaNome || 'Não alocado'}</strong>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block', fontSize: 11 }}>VAGA / TURNO</span>
                <strong>{relIndividual.cooperado?.alocacao?.vagaCargo || '—'} ({relIndividual.cooperado?.alocacao?.vagaEscala || '—'})</strong>
              </div>
            </div>

            {/* Resumo de Horas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
              <div style={{ padding: 10, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#166534', display: 'block' }}>HORAS TRABALHADAS</span>
                <strong style={{ fontSize: 16, color: '#14532d' }}>{relIndividual.resumo?.totalHoras || '00:00'}h</strong>
              </div>
              <div style={{ padding: 10, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#1e40af', display: 'block' }}>HORAS ADICIONAIS</span>
                <strong style={{ fontSize: 16, color: '#1d4ed8' }}>{relIndividual.resumo?.horasAdicionais || '00:00'}h</strong>
              </div>
              <div style={{ padding: 10, background: '#faf5ff', borderRadius: 6, border: '1px solid #e9d5ff', textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#6b21a8', display: 'block' }}>ADICIONAL NOTURNO</span>
                <strong style={{ fontSize: 16, color: '#581c87' }}>{relIndividual.resumo?.adicionalNoturno || '00:00'}h</strong>
              </div>
              <div style={{ padding: 10, background: '#fff1f2', borderRadius: 6, border: '1px solid #fecdd3', textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#9f1239', display: 'block' }}>DESCONTO DE HORAS</span>
                <strong style={{ fontSize: 16, color: '#881337' }}>{relIndividual.resumo?.descontoHoras || '00:00'}h</strong>
              </div>
              <div style={{ padding: 10, background: '#fefce8', borderRadius: 6, border: '1px solid #fef08a', textAlign: 'center' }}>
                <span style={{ fontSize: 11, color: '#854d0e', display: 'block' }}>BONIFICAÇÕES</span>
                <strong style={{ fontSize: 16, color: '#713f12' }}>R$ {(Number(relIndividual.resumo?.bonificacoesTotal) || 0).toFixed(2)}</strong>
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
                {(!relIndividual.apontamentos || relIndividual.apontamentos.length === 0) ? (
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
                      <td>{String(c.data_referencia || '').slice(0, 10).split('-').reverse().join('/')}</td>
                      <td style={{ textTransform: 'capitalize' }}>{String(c.tipo || '').replace('_', ' ')}</td>
                      <td>
                        {c.tipo === 'bonificacao' ? `R$ ${(Number(c.valor) || 0).toFixed(2)}` : `${c.quantidade_horas || 0}h`}
                      </td>
                      <td>{c.motivo || '—'}</td>
                      <td>{c.criado_por_nome || 'Supervisão'}</td>
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
                      <td>{l.usuario_nome || '—'} ({l.usuario_perfil || 'Supervisão'})</td>
                      <td>{l.campo || l.acao || '—'}</td>
                      <td>{l.valor_anterior || '—'} → {l.valor_novo || '—'}</td>
                      <td>{l.motivo || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )
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
                    {carregando ? 'Carregando relatório...' : 'Nenhuma vaga ou alocação encontrada no filtro selecionado.'}
                  </td>
                </tr>
              ) : (
                relPorVaga.map((item, idx) => (
                  <tr key={`${item.vaga_id}-${item.candidato_id}-${idx}`}>
                    <td><strong>{item.vaga_cargo || '—'}</strong></td>
                    <td>{item.empresa_nome || '—'}</td>
                    <td>{item.tipo_escala || 'Normal'}</td>
                    <td>{item.candidato_nome || '—'}</td>
                    <td>{formatarCPF(item.candidato_cpf)}</td>
                    <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.total_apontamentos ?? 0}</td>
                    <td style={{ textAlign: 'center', color: (item.total_ajustes || 0) > 0 ? '#b45309' : '#64748b' }}>
                      {item.total_ajustes ?? 0}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── 3. RENDER DO RELATÓRIO GERAL DA SUPERVISÃO ── */}
      {tipoRelatorio === 'geral' && (
        !relGeral ? (
          <div className="report-print-sheet" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
            <p>{carregando ? 'Gerando relatório geral da supervisão...' : 'Nenhum dado encontrado para o período.'}</p>
          </div>
        ) : (
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
                <strong style={{ fontSize: 20, color: '#0f172a' }}>{relGeral.resumo?.cards?.totalCooperadosAtivos ?? 0}</strong>
              </div>
              <div style={{ padding: 12, background: '#f0fdf4', borderRadius: 6, border: '1px solid #bbf7d0', textAlign: 'center' }}>
                <span style={{ fontSize: 11.5, color: '#166534', display: 'block' }}>HORAS TRABALHADAS</span>
                <strong style={{ fontSize: 20, color: '#14532d' }}>{relGeral.resumo?.cards?.horasTrabalhadasHoje || '00:00'}h</strong>
              </div>
              <div style={{ padding: 12, background: '#eff6ff', borderRadius: 6, border: '1px solid #bfdbfe', textAlign: 'center' }}>
                <span style={{ fontSize: 11.5, color: '#1e40af', display: 'block' }}>HORAS ADICIONAIS</span>
                <strong style={{ fontSize: 20, color: '#1d4ed8' }}>{relGeral.resumo?.cards?.horasAdicionais || '00:00'}h</strong>
              </div>
              <div style={{ padding: 12, background: '#fefce8', borderRadius: 6, border: '1px solid #fef08a', textAlign: 'center' }}>
                <span style={{ fontSize: 11.5, color: '#854d0e', display: 'block' }}>BONIFICAÇÕES</span>
                <strong style={{ fontSize: 20, color: '#713f12' }}>R$ {(Number(relGeral.resumo?.cards?.bonificacoesTotal) || 0).toFixed(2)}</strong>
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
                {(!relGeral.cooperados || relGeral.cooperados.length === 0) ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>
                      Nenhum cooperado encontrado para o período.
                    </td>
                  </tr>
                ) : (
                  relGeral.cooperados.map((coop) => (
                    <tr key={coop.id}>
                      <td><strong>{coop.nome || '—'}</strong></td>
                      <td>{formatarCPF(coop.cpf)}</td>
                      <td>{coop.alocacao?.empresaNome || 'Não alocado'}</td>
                      <td>{coop.alocacao?.vagaCargo || '—'}</td>
                      <td style={{ textAlign: 'center', fontWeight: 600 }}>{coop.totalApontamentosPeriodo ?? 0}</td>
                      <td style={{ textAlign: 'center', color: (coop.totalAjustesPeriodo || 0) > 0 ? '#b45309' : '#64748b' }}>
                        {coop.totalAjustesPeriodo ?? 0}
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
        )
      )}
    </div>
  );
};

export default MonitoramentoRelatorios;
