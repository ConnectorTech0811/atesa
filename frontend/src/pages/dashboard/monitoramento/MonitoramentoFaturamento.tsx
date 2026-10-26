import React, { useEffect, useRef, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataBR, formatarMoeda } from '../../../utils/formatters';
import {
  LinhaValoresCliente,
  OpcoesEscala,
  PlanilhaFaturamento,
  ResultadoImportacao,
  ValorClienteSalvo,
  excluirValoresCliente,
  gerarPlanilhaFaturamento,
  importarValoresCliente,
  listarValoresCliente,
  obterOpcoesEscala,
} from '../../../api/escalaFaturamentoApi';
import {
  COLUNAS_MODELO_VALORES,
  ModeloFaturamento,
  ROTULO_MODELO,
  baixarModeloValoresCliente,
  baixarPlanilhaFaturamento,
  colunasDoModelo,
  lerPlanilhaValoresCliente,
  sugerirModelo,
} from '../../../utils/planilhasFaturamento';
import ProcessoFaturamento from './ProcessoFaturamento';
import RegrasComissao from './RegrasComissao';
import MunicipiosNfse from './MunicipiosNfse';
import ConferenciaJornadas from './ConferenciaJornadas';
import RegrasApuracao from './RegrasApuracao';

type AbaFaturamento = 'processos' | 'regras' | 'comissoes' | 'prefeituras';

// Competência padrão: mês anterior (o cliente envia os valores após o fechamento)
const competenciaPadrao = (() => {
  const [a, m] = dataLocalISO().split('-').map(Number);
  const d = new Date(a, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
})();

const formatarCelula = (v: unknown) => {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return formatarDataBR(dataLocalISO(v));
  if (typeof v === 'number') return v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return String(v);
};

export const MonitoramentoFaturamento: React.FC = () => {
  const { showToast } = useToast();
  const [opcoes, setOpcoes] = useState<OpcoesEscala>({ cooperados: [], empresas: [], alocacoes: [], vagas: [] });
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [competencia, setCompetencia] = useState(competenciaPadrao);

  const [linhasLidas, setLinhasLidas] = useState<LinhaValoresCliente[] | null>(null);
  const [nomeArquivo, setNomeArquivo] = useState('');
  const [importando, setImportando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [valoresSalvos, setValoresSalvos] = useState<ValorClienteSalvo[]>([]);
  const inputArquivo = useRef<HTMLInputElement>(null);

  const [planilha, setPlanilha] = useState<PlanilhaFaturamento | null>(null);
  const [modelo, setModelo] = useState<ModeloFaturamento>('horista');
  const [gerando, setGerando] = useState(false);
  const [baixando, setBaixando] = useState(false);
  const [aba, setAba] = useState<AbaFaturamento>('processos');

  useEffect(() => {
    obterOpcoesEscala().then(setOpcoes).catch((e) => showToast(e?.message || 'Erro ao carregar empresas.', 'error'));
  }, []);

  const carregarValores = async () => {
    if (!/^\d{4}-\d{2}$/.test(competencia)) return;
    try {
      setValoresSalvos(await listarValoresCliente({ competencia, empresaId: empresaId || undefined }));
    } catch {
      setValoresSalvos([]);
    }
  };

  useEffect(() => {
    carregarValores();
    setPlanilha(null);
  }, [competencia, empresaId]);

  const handleArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const arq = e.target.files?.[0];
    e.target.value = '';
    if (!arq) return;
    setResultado(null);
    try {
      const { linhas } = await lerPlanilhaValoresCliente(arq);
      if (linhas.length === 0) throw new Error('Nenhuma linha com matrícula encontrada na planilha.');
      setLinhasLidas(linhas);
      setNomeArquivo(arq.name);
    } catch (err: any) {
      setLinhasLidas(null);
      showToast(err?.message || 'Não foi possível ler a planilha.', 'error');
    }
  };

  const handleImportar = async () => {
    if (!linhasLidas) return;
    if (!empresaId && !window.confirm('Nenhuma empresa selecionada. Os valores serão importados para a competência e aplicados ao cooperado em qualquer cliente em que ele estiver alocado. Continuar?')) return;
    setImportando(true);
    try {
      const r = await importarValoresCliente({ competencia, empresaId: empresaId || undefined, linhas: linhasLidas });
      setResultado(r);
      setLinhasLidas(null);
      showToast(`${r.importados} cooperado(s) importado(s)${r.erros.length ? ` · ${r.erros.length} linha(s) com erro` : ''}.`, r.erros.length ? 'warning' : 'success');
      await carregarValores();
      setPlanilha(null);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao importar.', 'error');
    } finally {
      setImportando(false);
    }
  };

  const handleLimpar = async () => {
    if (!window.confirm(`Remover todos os valores importados da competência ${competencia}${empresaId ? ' para esta empresa' : ' (sem empresa)'}?`)) return;
    try {
      const r = await excluirValoresCliente({ competencia, empresaId: empresaId || undefined });
      showToast(`${r.removidos} registro(s) removido(s).`, 'success');
      setResultado(null);
      carregarValores();
      setPlanilha(null);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao remover.', 'error');
    }
  };

  const handleGerar = async () => {
    if (!empresaId) { showToast('Selecione a empresa (cliente).', 'warning'); return; }
    setGerando(true);
    try {
      const p = await gerarPlanilhaFaturamento({ empresaId: Number(empresaId), competencia });
      setPlanilha(p);
      setModelo(sugerirModelo(p.linhas));
      if (p.linhas.length === 0) showToast('Nenhum cooperado alocado nesta empresa na competência.', 'warning');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar planilha.', 'error');
    } finally {
      setGerando(false);
    }
  };

  const handleBaixar = async () => {
    if (!planilha) return;
    setBaixando(true);
    try {
      await baixarPlanilhaFaturamento(planilha, modelo);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar o arquivo .xlsx.', 'error');
    } finally {
      setBaixando(false);
    }
  };

  const cols = colunasDoModelo(modelo);
  const totalValores = (k: keyof ValorClienteSalvo) => valoresSalvos.reduce((s, v) => s + (Number(v[k]) || 0), 0);

  return (
    <div className="monitoramento-container">
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
            </svg>
            Faturamento / Produtividade
          </h1>
          <p>Importe os valores enviados pelo cliente (por matrícula) e gere a planilha de produtividade/faturamento no modelo do cliente.</p>
        </div>
      </div>

      <div className="monitoramento-tabs-nav">
        {([['processos', 'Produtividade e processos'], ['regras', 'Regras de apuração'], ['comissoes', 'Regras de comissão'], ['prefeituras', 'Prefeituras (NFS-e)']] as [AbaFaturamento, string][]).map(([id, rotulo]) => (
          <button key={id} type="button" className={`monitoramento-tab-btn ${aba === id ? 'active' : ''}`} onClick={() => setAba(id)}>{rotulo}</button>
        ))}
      </div>

      {aba === 'regras' && <RegrasApuracao />}
      {aba === 'comissoes' && <RegrasComissao empresas={opcoes.empresas} />}
      {aba === 'prefeituras' && <MunicipiosNfse />}

      {aba === 'processos' && (<>

      <div className="monitoramento-filters-card">
        <div className="filter-item" style={{ flex: 2, minWidth: 240 }}>
          <label>Cliente (empresa)</label>
          <select className="filter-select" value={empresaId} onChange={(e) => setEmpresaId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Selecione —</option>
            {opcoes.empresas.map((em) => <option key={em.id} value={em.id}>{em.nome_empresa}</option>)}
          </select>
        </div>
        <div className="filter-item" style={{ minWidth: 160 }}>
          <label>Competência</label>
          <input type="month" className="filter-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        </div>
      </div>

      {/* ── 1. Valores do cliente ── */}
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">1. Valores enviados pelo cliente</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Colunas: {COLUNAS_MODELO_VALORES.join(' · ')}. O cooperado é identificado pela matrícula.
              Também aceita a planilha de produtividade do cliente (ex.: HSM).
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="btn-secondary-filter" onClick={() => baixarModeloValoresCliente().catch(() => showToast('Erro ao gerar modelo.', 'error'))}>
              ⬇ Baixar planilha modelo
            </button>
            <button type="button" className="btn-primary-filter" onClick={() => inputArquivo.current?.click()}>
              ⬆ Selecionar planilha (.xlsx / .csv)
            </button>
            <input ref={inputArquivo} type="file" accept=".xlsx,.xls,.csv" style={{ display: 'none' }} onChange={handleArquivo} />
          </div>
        </div>

        {linhasLidas && (
          <div style={{ padding: '14px 24px', background: '#f0f9ff', borderBottom: '1px solid #e0f2fe', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
            <span style={{ fontSize: 13 }}>
              <strong>{nomeArquivo}</strong>: {linhasLidas.length} linha(s) lida(s) para a competência <strong>{competencia.split('-').reverse().join('/')}</strong>
              {empresaId ? <> · cliente <strong>{opcoes.empresas.find((e) => e.id === empresaId)?.nome_empresa}</strong></> : ' · sem empresa'}.
              {' '}Uma nova importação substitui os valores já importados do mesmo cooperado.
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-cancel" onClick={() => setLinhasLidas(null)} disabled={importando}>Cancelar</button>
              <button type="button" className="btn-save-ajuste" onClick={handleImportar} disabled={importando}>{importando ? 'Importando...' : 'Confirmar importação'}</button>
            </div>
          </div>
        )}

        {resultado && (resultado.erros.length > 0 || resultado.avisos.length > 0) && (
          <div style={{ padding: '14px 24px', borderBottom: '1px solid #f1f5f9', fontSize: 13 }}>
            {resultado.erros.length > 0 && (
              <>
                <strong style={{ color: '#b91c1c' }}>Linhas não importadas ({resultado.erros.length}):</strong>
                <ul style={{ margin: '6px 0 10px 18px', color: '#7f1d1d' }}>
                  {resultado.erros.map((e, i) => <li key={i}>Linha {e.linha}{e.matricula ? ` · Mat. ${e.matricula}` : ''}{e.nome ? ` · ${e.nome}` : ''}: {e.motivo}</li>)}
                </ul>
              </>
            )}
            {resultado.avisos.length > 0 && (
              <>
                <strong style={{ color: '#b45309' }}>Avisos ({resultado.avisos.length}):</strong>
                <ul style={{ margin: '6px 0 0 18px', color: '#78350f' }}>
                  {resultado.avisos.map((e, i) => <li key={i}>Linha {e.linha} · Mat. {e.matricula}: {e.motivo}</li>)}
                </ul>
              </>
            )}
          </div>
        )}

        <div className="table-responsive">
          <table className="monitoramento-table">
            <thead>
              <tr>
                <th>Cooperado</th>
                <th>Matrícula</th>
                <th style={{ textAlign: 'right' }}>Desc. Refeição</th>
                <th style={{ textAlign: 'right' }}>Bonificação</th>
                <th style={{ textAlign: 'right' }}>Desc. Estacionamento</th>
                <th style={{ textAlign: 'right' }}>Desc. Farmácia</th>
                <th style={{ textAlign: 'right' }}>Reembolso</th>
              </tr>
            </thead>
            <tbody>
              {valoresSalvos.length === 0 ? (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>Nenhum valor importado para esta competência{empresaId ? ' e empresa' : ''}.</td></tr>
              ) : (
                <>
                  {valoresSalvos.map((v) => (
                    <tr key={v.id}>
                      <td><strong>{v.cooperado_nome}</strong></td>
                      <td>{v.matricula}</td>
                      <td style={{ textAlign: 'right' }}>{formatarMoeda(v.desc_refeicao)}</td>
                      <td style={{ textAlign: 'right' }}>{formatarMoeda(v.bonificacao)}</td>
                      <td style={{ textAlign: 'right' }}>{formatarMoeda(v.desc_estacionamento)}</td>
                      <td style={{ textAlign: 'right' }}>{formatarMoeda(v.desc_farmacia)}</td>
                      <td style={{ textAlign: 'right' }}>{formatarMoeda(v.reembolso)}</td>
                    </tr>
                  ))}
                  <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                    <td colSpan={2}>Total ({valoresSalvos.length})</td>
                    <td style={{ textAlign: 'right' }}>{formatarMoeda(totalValores('desc_refeicao'))}</td>
                    <td style={{ textAlign: 'right' }}>{formatarMoeda(totalValores('bonificacao'))}</td>
                    <td style={{ textAlign: 'right' }}>{formatarMoeda(totalValores('desc_estacionamento'))}</td>
                    <td style={{ textAlign: 'right' }}>{formatarMoeda(totalValores('desc_farmacia'))}</td>
                    <td style={{ textAlign: 'right' }}>{formatarMoeda(totalValores('reembolso'))}</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        {valoresSalvos.length > 0 && (
          <div style={{ padding: '10px 24px', textAlign: 'right' }}>
            <button type="button" onClick={handleLimpar} style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>
              ✕ Remover valores importados desta competência
            </button>
          </div>
        )}
      </div>

      {/* ── 2. Planilha de faturamento ── */}
      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <div>
            <h3 className="table-card-title">2. Planilha de Faturamento / Produtividade</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              Uma linha por alocação (cooperado × atividade × local), com as horas apuradas das batidas do App (validadas contra a escala e a vaga), complementos da supervisão e os valores do cliente.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" className="btn-primary-filter" onClick={handleGerar} disabled={gerando || !empresaId}>
              {gerando ? 'Gerando...' : planilha ? '↻ Atualizar' : 'Gerar planilha'}
            </button>
            {planilha && (
              <>
                <select className="filter-select" value={modelo} onChange={(e) => setModelo(e.target.value as ModeloFaturamento)} style={{ minWidth: 220 }}>
                  {(Object.keys(ROTULO_MODELO) as ModeloFaturamento[]).map((m) => <option key={m} value={m}>Modelo: {ROTULO_MODELO[m]}</option>)}
                </select>
                <button type="button" className="btn-save-ajuste" onClick={handleBaixar} disabled={baixando || planilha.linhas.length === 0}>
                  {baixando ? 'Gerando...' : '⬇ Baixar .xlsx'}
                </button>
              </>
            )}
          </div>
        </div>

        {planilha?.avisos.map((a, i) => (
          <div key={i} style={{ padding: '10px 24px', background: '#fffbeb', color: '#92400e', fontSize: 13, borderBottom: '1px solid #fde68a' }}>⚠ {a}</div>
        ))}

        {planilha && (
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12 }}>
              <thead>
                <tr>{cols.map((c) => <th key={c.titulo} style={{ whiteSpace: 'nowrap' }}>{c.titulo}</th>)}</tr>
              </thead>
              <tbody>
                {planilha.linhas.length === 0 ? (
                  <tr><td colSpan={cols.length} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>Nenhum cooperado alocado nesta empresa na competência.</td></tr>
                ) : planilha.linhas.map((l, i) => (
                  <tr key={`${l.alocacao_id ?? 'v'}-${l.candidato_id}-${i}`}>
                    {cols.map((c) => <td key={c.titulo} style={{ whiteSpace: 'nowrap' }}>{formatarCelula(c.valor(l))}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {planilha && (
          <p style={{ padding: '10px 24px', margin: 0, fontSize: 12, color: '#64748b' }}>
            Colunas sem fonte no sistema (ex.: Ajuda de Custo Extra, DAR, Não Exerceu Atividade, Folga, D.S.R) saem em branco no arquivo para preenchimento.
            Total de horas = jornadas apontadas no App + plantões marcados como realizados na escala. Plantão previsto sem batida conta como falta. Hora excedente e ad. noturno incluem os complementos da Supervisão.
          </p>
        )}
      </div>

      {planilha && planilha.linhas.length > 0 && <ConferenciaJornadas planilha={planilha} />}

      {/* ── 3. Processo de faturamento ── */}
      <ProcessoFaturamento empresaId={empresaId} competencia={competencia} nomeEmpresa={opcoes.empresas.find((e) => e.id === empresaId)?.nome_empresa} />
      </>)}
    </div>
  );
};

export default MonitoramentoFaturamento;
