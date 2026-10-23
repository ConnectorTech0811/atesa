import React, { useEffect, useState } from 'react';
import '../monitoramento/Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataBR, formatarMoeda } from '../../../utils/formatters';
import { Relatorio, SecaoRelatorio, TipoColunaRelatorio, gerarRelatorio, listarRelatoriosDisponiveis, obterOpcoesRelatorios } from '../../../api/financeiroApi';

type TipoFiltro = 'competencias' | 'datas' | 'dataBase';
const CONFIG: Record<string, { filtro: TipoFiltro; rotuloDatas?: string; status?: { valor: string; rotulo: string }[]; empresa?: boolean; categoria?: boolean; extra?: 'origem' | 'tipo_pagamento' }> = {
  faturamento: { filtro: 'competencias', empresa: true, status: [{ valor: 'aberto', rotulo: 'Aberto' }, { valor: 'apurado', rotulo: 'Em conferência' }, { valor: 'aprovado', rotulo: 'Aprovado' }, { valor: 'rejeitado', rotulo: 'Rejeitado' }] },
  notas: { filtro: 'datas', rotuloDatas: 'Emissão', empresa: true, status: [{ valor: 'emitida', rotulo: 'Emitida' }, { valor: 'rascunho', rotulo: 'Rascunho' }, { valor: 'cancelada', rotulo: 'Cancelada' }] },
  cobrancas: { filtro: 'datas', rotuloDatas: 'Vencimento', empresa: true, status: [{ valor: 'aberta,parcial', rotulo: 'Em aberto' }, { valor: 'paga', rotulo: 'Paga' }, { valor: 'divergente', rotulo: 'Recebida a maior' }, { valor: 'cancelada', rotulo: 'Cancelada' }] },
  recebimentos: { filtro: 'datas', rotuloDatas: 'Pagamento', extra: 'origem', status: [{ valor: 'ativo', rotulo: 'Ativo' }, { valor: 'estornado', rotulo: 'Estornado' }] },
  inadimplencia: { filtro: 'dataBase', empresa: true },
  conciliacao: { filtro: 'datas', rotuloDatas: 'Importação' },
  pagamentos_cooperados: { filtro: 'competencias', extra: 'tipo_pagamento', status: [{ valor: 'em_preparacao,retido,rejeitado', rotulo: 'Não liberados' }, { valor: 'liberado,em_lote', rotulo: 'Liberados' }, { valor: 'pago', rotulo: 'Pagos' }] },
  contas_pagar: { filtro: 'datas', rotuloDatas: 'Vencimento', categoria: true, status: [{ valor: 'aguardando_aprovacao,aprovada,programada', rotulo: 'Em aberto' }, { valor: 'paga', rotulo: 'Paga' }, { valor: 'rejeitada', rotulo: 'Rejeitada' }, { valor: 'cancelada', rotulo: 'Cancelada' }] },
  consolidacao: { filtro: 'competencias' },
};

const hoje = dataLocalISO();
const mesAtual = hoje.slice(0, 7);
const inicioAno = `${hoje.slice(0, 4)}-01`;

function formatar(v: unknown, tipo: TipoColunaRelatorio): string {
  if (v === null || v === undefined || v === '') return '';
  if (tipo === 'moeda') return formatarMoeda(Number(v));
  if (tipo === 'numero') return Number(v).toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  if (tipo === 'data') return formatarDataBR(String(v));
  if (tipo === 'competencia') return String(v).split('-').reverse().join('/');
  return String(v);
}

/** Exporta o relatório em .xlsx: filtros, resumo, divergências e uma aba por seção. */
async function exportarXlsx(r: Relatorio) {
  const XLSX = await import('xlsx');
  const wb = XLSX.utils.book_new();
  const cabecalho = [[r.titulo], [`Gerado em ${new Date(r.gerado_em).toLocaleString('pt-BR')}`], ...Object.entries(r.filtros).filter(([, v]) => v !== null).map(([k, v]) => [k, String(v)]), [],
    ['Resumo'], ...r.resumo.map((x) => [x.rotulo, x.valor]), [], ...r.avisos.map((a) => [a])];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(cabecalho), 'Resumo');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Nível', 'Referência', 'Divergência'], ...r.divergencias.map((d) => [d.nivel, d.referencia, d.texto])]), 'Divergências');
  r.secoes.forEach((s, i) => {
    const valor = (l: Record<string, unknown>, c: SecaoRelatorio['colunas'][number]) => {
      const v = l[c.chave];
      if (v === null || v === undefined) return '';
      if (c.tipo === 'moeda' || c.tipo === 'numero') return Number(v);
      if (c.tipo === 'data') return formatarDataBR(String(v));
      if (c.tipo === 'competencia') return String(v).split('-').reverse().join('/');
      return String(v);
    };
    const aoa: (string | number)[][] = [s.colunas.map((c) => c.titulo), ...s.linhas.map((l) => s.colunas.map((c) => valor(l, c)))];
    if (s.totais) aoa.push(s.colunas.map((c, j) => (j === 0 ? 'TOTAL' : s.totais![c.chave] ?? '')));
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    s.colunas.forEach((c, j) => {
      if (c.tipo !== 'moeda') return;
      for (let lin = 1; lin < aoa.length; lin++) {
        const cel = ws[XLSX.utils.encode_cell({ r: lin, c: j })];
        if (cel && typeof cel.v === 'number') cel.z = '#,##0.00';
      }
    });
    XLSX.utils.book_append_sheet(wb, ws, `${i + 1}. ${s.titulo}`.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  });
  XLSX.writeFile(wb, `${r.titulo.replace(/[\\/:*?"<>|]+/g, ' ')} - ${hoje}.xlsx`);
}

export const RelatoriosFinanceiros: React.FC = () => {
  const { showToast } = useToast();
  const [disponiveis, setDisponiveis] = useState<{ tipo: string; titulo: string }[]>([]);
  const [tipo, setTipo] = useState('');
  const [opcoes, setOpcoes] = useState<{ empresas: { id: number; nome_empresa: string }[]; categorias: { id: number; nome: string }[] }>({ empresas: [], categorias: [] });
  const [filtros, setFiltros] = useState<Record<string, string>>({ competenciaInicio: inicioAno, competenciaFim: mesAtual, dataInicio: `${inicioAno}-01`, dataFim: hoje, dataBase: hoje });
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [gerando, setGerando] = useState(false);
  const [soDivergentes, setSoDivergentes] = useState(false);

  useEffect(() => {
    listarRelatoriosDisponiveis().then((l) => { setDisponiveis(l); setTipo(l[0]?.tipo ?? ''); }).catch((e) => showToast(e?.message || 'Erro ao carregar relatórios.', 'error'));
    obterOpcoesRelatorios().then(setOpcoes).catch(() => undefined);
  }, []);
  useEffect(() => { setRelatorio(null); }, [tipo]);

  const cfg = CONFIG[tipo];
  const set = (k: string, v: string) => setFiltros((f) => ({ ...f, [k]: v }));

  const gerar = async () => {
    if (!cfg) return;
    const f: Record<string, string> = {};
    if (cfg.filtro === 'competencias') { f.competenciaInicio = filtros.competenciaInicio; f.competenciaFim = filtros.competenciaFim; }
    if (cfg.filtro === 'datas') { f.dataInicio = filtros.dataInicio; f.dataFim = filtros.dataFim; }
    if (cfg.filtro === 'dataBase') f.dataBase = filtros.dataBase;
    // Recebimentos, pagamentos e contas usam "situacao" no servidor; os demais, "status"
    const nomeSituacao = ['recebimentos', 'pagamentos_cooperados', 'contas_pagar'].includes(tipo) ? 'situacao' : 'status';
    for (const k of ['status', 'empresaId', 'categoriaId', 'origem', 'tipo']) {
      const v = filtros[`${tipo}:${k}`];
      if (v) f[k === 'status' ? nomeSituacao : k] = v;
    }
    setGerando(true);
    try { setRelatorio(await gerarRelatorio(tipo, f)); }
    catch (err: any) { showToast(err?.message || 'Erro ao gerar relatório.', 'error'); }
    finally { setGerando(false); }
  };

  if (!disponiveis.length) {
    return <div className="monitoramento-container"><div className="monitoramento-table-card" style={{ padding: 24, color: '#94a3b8' }}>Nenhum relatório disponível para o seu perfil.</div></div>;
  }

  return (
    <div className="monitoramento-container">
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>Relatórios Financeiros</h1>
          <p>Faturamento, notas fiscais, cobranças, recebimentos, inadimplência, conciliação, pagamentos dos cooperados, contas a pagar e consolidação. Divergências entre faturado, recebido, liberado e pago são destacadas.</p>
        </div>
      </div>

      <div className="monitoramento-filters-card">
        <div className="filter-item" style={{ minWidth: 240 }}>
          <label>Relatório</label>
          <select className="filter-select" value={tipo} onChange={(e) => setTipo(e.target.value)}>
            {disponiveis.map((d) => <option key={d.tipo} value={d.tipo}>{d.titulo}</option>)}
          </select>
        </div>
        {cfg?.filtro === 'competencias' && (
          <>
            <div className="filter-item"><label>Competência inicial</label><input type="month" className="filter-input" value={filtros.competenciaInicio} onChange={(e) => set('competenciaInicio', e.target.value)} /></div>
            <div className="filter-item"><label>Competência final</label><input type="month" className="filter-input" value={filtros.competenciaFim} onChange={(e) => set('competenciaFim', e.target.value)} /></div>
          </>
        )}
        {cfg?.filtro === 'datas' && (
          <>
            <div className="filter-item"><label>{cfg.rotuloDatas} de</label><input type="date" className="filter-input" value={filtros.dataInicio} onChange={(e) => set('dataInicio', e.target.value)} /></div>
            <div className="filter-item"><label>até</label><input type="date" className="filter-input" value={filtros.dataFim} onChange={(e) => set('dataFim', e.target.value)} /></div>
          </>
        )}
        {cfg?.filtro === 'dataBase' && (
          <div className="filter-item"><label>Data base</label><input type="date" className="filter-input" value={filtros.dataBase} onChange={(e) => set('dataBase', e.target.value)} /></div>
        )}
        {cfg?.empresa && (
          <div className="filter-item" style={{ minWidth: 200 }}><label>Cliente</label>
            <select className="filter-select" value={filtros[`${tipo}:empresaId`] ?? ''} onChange={(e) => set(`${tipo}:empresaId`, e.target.value)}>
              <option value="">Todos</option>{opcoes.empresas.map((e) => <option key={e.id} value={e.id}>{e.nome_empresa}</option>)}
            </select></div>
        )}
        {cfg?.categoria && (
          <div className="filter-item" style={{ minWidth: 180 }}><label>Categoria</label>
            <select className="filter-select" value={filtros[`${tipo}:categoriaId`] ?? ''} onChange={(e) => set(`${tipo}:categoriaId`, e.target.value)}>
              <option value="">Todas</option>{opcoes.categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
            </select></div>
        )}
        {cfg?.status && (
          <div className="filter-item" style={{ minWidth: 170 }}><label>Situação</label>
            <select className="filter-select" value={filtros[`${tipo}:status`] ?? ''} onChange={(e) => set(`${tipo}:status`, e.target.value)}>
              <option value="">Todas</option>{cfg.status.map((s) => <option key={s.valor} value={s.valor}>{s.rotulo}</option>)}
            </select></div>
        )}
        {cfg?.extra === 'origem' && (
          <div className="filter-item"><label>Origem</label>
            <select className="filter-select" value={filtros[`${tipo}:origem`] ?? ''} onChange={(e) => set(`${tipo}:origem`, e.target.value)}>
              <option value="">Todas</option><option value="retorno">Retorno bancário</option><option value="manual">Baixa manual</option>
            </select></div>
        )}
        {cfg?.extra === 'tipo_pagamento' && (
          <div className="filter-item"><label>Tipo</label>
            <select className="filter-select" value={filtros[`${tipo}:tipo`] ?? ''} onChange={(e) => set(`${tipo}:tipo`, e.target.value)}>
              <option value="">Todos</option><option value="repasse">Repasse</option><option value="adiantamento">Adiantamento</option>
            </select></div>
        )}
        <div className="filter-actions" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <button type="button" className="btn-primary-filter" disabled={gerando} onClick={gerar}>{gerando ? 'Gerando...' : 'Gerar relatório'}</button>
          {relatorio && <button type="button" className="btn-secondary-filter" onClick={() => exportarXlsx(relatorio).catch((e) => showToast(e?.message || 'Erro ao exportar.', 'error'))}>⬇ Exportar .xlsx</button>}
        </div>
      </div>

      {relatorio && (
        <>
          <div className="monitoramento-cards-grid">
            {relatorio.resumo.map((x) => (
              <div key={x.rotulo} className="metric-card">
                <div className="metric-card-header"><span className="metric-card-title">{x.rotulo}</span></div>
                <div className="metric-card-value">{formatar(x.valor, x.tipo)}</div>
              </div>
            ))}
          </div>

          {relatorio.divergencias.length > 0 && (
            <div className="monitoramento-table-card">
              <div className="table-card-header"><h3 className="table-card-title">Divergências ({relatorio.divergencias.length})</h3></div>
              <div style={{ padding: '8px 24px 16px', fontSize: 13, maxHeight: 260, overflowY: 'auto' }}>
                {relatorio.divergencias.map((d, i) => (
                  <div key={i} style={{ padding: '3px 0', color: d.nivel === 'erro' ? '#b91c1c' : '#92400e' }}>
                    {d.nivel === 'erro' ? '●' : '▲'} <strong>{d.referencia}</strong> — {d.texto}
                  </div>
                ))}
              </div>
            </div>
          )}

          {relatorio.secoes.map((s) => {
            const temDiv = s.colunas.some((c) => c.chave === 'divergencias');
            const linhas = soDivergentes && temDiv ? s.linhas.filter((l) => l.divergencias) : s.linhas;
            return (
              <div key={s.titulo} className="monitoramento-table-card">
                <div className="table-card-header">
                  <h3 className="table-card-title">{s.titulo} ({linhas.length})</h3>
                  {temDiv && (
                    <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input type="checkbox" checked={soDivergentes} onChange={(e) => setSoDivergentes(e.target.checked)} /> Somente com divergência
                    </label>
                  )}
                </div>
                <div className="table-responsive">
                  <table className="monitoramento-table" style={{ fontSize: 12 }}>
                    <thead><tr>{s.colunas.map((c) => <th key={c.chave} style={{ textAlign: c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : undefined, whiteSpace: 'nowrap' }}>{c.titulo}</th>)}</tr></thead>
                    <tbody>
                      {linhas.length === 0 ? <tr><td colSpan={s.colunas.length} style={{ textAlign: 'center', padding: 20, color: '#94a3b8' }}>Nenhum registro.</td></tr>
                        : linhas.map((l, i) => (
                          <tr key={i} style={{ background: l.divergencias ? '#fff7ed' : undefined }}>
                            {s.colunas.map((c) => (
                              <td key={c.chave} style={{ textAlign: c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : undefined, whiteSpace: c.chave === 'divergencias' ? 'normal' : 'nowrap', color: c.chave === 'divergencias' ? '#9a3412' : undefined, maxWidth: c.chave === 'divergencias' ? 360 : undefined }}>
                                {formatar(l[c.chave], c.tipo)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      {s.totais && linhas.length > 0 && (
                        <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                          {s.colunas.map((c, j) => <td key={c.chave} style={{ textAlign: c.tipo === 'moeda' || c.tipo === 'numero' ? 'right' : undefined, whiteSpace: 'nowrap' }}>{j === 0 ? 'Total' : c.chave in s.totais! ? formatar(s.totais![c.chave], c.tipo) : ''}</td>)}
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
          {relatorio.avisos.map((a, i) => <p key={i} style={{ fontSize: 12, color: '#64748b', margin: '0 4px 6px' }}>ℹ {a}</p>)}
          {soDivergentes && <p style={{ fontSize: 12, color: '#64748b', margin: '0 4px' }}>Total da seção considera as linhas exibidas pelo servidor (sem o filtro "somente com divergência").</p>}
        </>
      )}
    </div>
  );
};

export default RelatoriosFinanceiros;
