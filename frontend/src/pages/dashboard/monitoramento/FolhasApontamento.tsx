import React, { useEffect, useMemo, useState } from 'react';
import { dataLocalISO, formatarCPF } from '../../../utils/formatters';
import {
  ApontamentoDetalhado, RelatorioPorVagaItem, VagaDisponivel, listarClientesApontamentos, listarTodosApontamentos, listarVagasDisponiveis, obterRelatorioPorVaga,
} from '../../../api/monitoramentoApi';
import { addDias } from './jornadaApontamentos';
import { CooperadoFolha, Folha, htmlFolhas, montarFolhas } from './folhaApontamento';

const POR_PAGINA = 1000;
const MAX_PAGINAS = 30;

/** Busca as batidas do período. O dia seguinte entra para fechar o plantão que vira a noite. */
async function buscarApontamentos(filtros: { empresaId: number; vagaId?: number; candidatoId?: number; dataInicio: string; dataFim: string }) {
  const todos: ApontamentoDetalhado[] = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
    const lote = await listarTodosApontamentos({ ...filtros, dataFim: addDias(filtros.dataFim, 1), limite: POR_PAGINA, pagina });
    todos.push(...lote);
    if (lote.length < POR_PAGINA) break;
  }
  return todos;
}

/** Gera a folha de apontamentos de um cooperado ou de todos os cooperados do projeto. */
export const FolhasApontamento: React.FC = () => {
  const hoje = dataLocalISO();
  const [clientes, setClientes] = useState<{ id: number; nome_empresa: string }[]>([]);
  const [vagas, setVagas] = useState<VagaDisponivel[]>([]);
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [vagaId, setVagaId] = useState<number | ''>('');
  const [escopo, setEscopo] = useState<'todos' | 'unico'>('todos');
  const [candidatoId, setCandidatoId] = useState<number | ''>('');
  const [dataInicio, setDataInicio] = useState(`${hoje.slice(0, 7)}-01`);
  const [dataFim, setDataFim] = useState(hoje);
  const [alocados, setAlocados] = useState<RelatorioPorVagaItem[]>([]);
  const [folhas, setFolhas] = useState<Folha[] | null>(null);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    listarClientesApontamentos().then(setClientes).catch((e) => setErro(e?.message || 'Erro ao carregar os clientes.'));
    listarVagasDisponiveis().then((v) => setVagas(v || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    setFolhas(null);
    setCandidatoId('');
    if (!empresaId) { setAlocados([]); return; }
    obterRelatorioPorVaga({ empresaId: Number(empresaId), vagaId: vagaId ? Number(vagaId) : undefined })
      .then((l) => setAlocados(l || []))
      .catch((e) => setErro(e?.message || 'Erro ao carregar os cooperados do projeto.'));
  }, [empresaId, vagaId]);

  useEffect(() => { setFolhas(null); }, [escopo, candidatoId, dataInicio, dataFim]);

  const vagasCliente = vagas.filter((v) => v.empresa_id === empresaId);
  const cooperados = useMemo(() => {
    const porId = new Map<number, CooperadoFolha>();
    for (const a of alocados) {
      if (!porId.has(a.candidato_id)) porId.set(a.candidato_id, { id: a.candidato_id, nome: a.candidato_nome, cpf: a.candidato_cpf, matricula: a.candidato_matricula, atividade: a.vaga_cargo });
    }
    return [...porId.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [alocados]);
  const nomeCliente = clientes.find((c) => c.id === empresaId)?.nome_empresa ?? '';

  const gerar = async () => {
    setErro('');
    if (!empresaId) { setErro('Selecione o cliente / projeto.'); return; }
    if (!dataInicio || !dataFim || dataFim < dataInicio) { setErro('Informe um período válido.'); return; }
    if (escopo === 'unico' && !candidatoId) { setErro('Selecione o cooperado.'); return; }
    setGerando(true);
    try {
      const unico = escopo === 'unico' ? Number(candidatoId) : undefined;
      const apontamentos = await buscarApontamentos({ empresaId: Number(empresaId), vagaId: vagaId ? Number(vagaId) : undefined, candidatoId: unico, dataInicio, dataFim });
      setFolhas(montarFolhas(unico ? cooperados.filter((c) => c.id === unico) : cooperados, apontamentos, dataInicio, dataFim));
    } catch (err: any) {
      setErro(err?.message || 'Erro ao gerar as folhas.');
    } finally {
      setGerando(false);
    }
  };

  const imprimir = () => {
    if (!folhas) return;
    const janela = window.open('', '_blank');
    if (!janela) { setErro('O navegador bloqueou a janela de impressão. Libere pop-ups para este site.'); return; }
    janela.document.open();
    janela.document.write(htmlFolhas(folhas, { cliente: nomeCliente, inicio: dataInicio, fim: dataFim }));
    janela.document.close();
    janela.focus();
    setTimeout(() => janela.print(), 300);
  };

  return (
    <div className="monitoramento-table-card">
      <div className="table-card-header">
        <div>
          <h3 className="table-card-title">Folha de Apontamentos</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>Gere a folha de um cooperado ou de todos do projeto. Cada cooperado sai em uma página, com todos os dias do período.</p>
        </div>
      </div>
      <div style={{ padding: '0 24px 16px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="filter-item" style={{ minWidth: 240 }}>
          <label htmlFor="folha-cliente">Cliente / Projeto</label>
          <select id="folha-cliente" className="filter-select" value={empresaId} onChange={(e) => { setEmpresaId(e.target.value ? Number(e.target.value) : ''); setVagaId(''); }}>
            <option value="">— Selecione —</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome_empresa}</option>)}
          </select>
        </div>
        <div className="filter-item" style={{ minWidth: 200 }}>
          <label htmlFor="folha-vaga">Atividade</label>
          <select id="folha-vaga" className="filter-select" value={vagaId} disabled={!empresaId} onChange={(e) => setVagaId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Todas</option>
            {vagasCliente.map((v) => <option key={v.vaga_id} value={v.vaga_id}>{v.vaga_cargo} — {v.nome_unidade}</option>)}
          </select>
        </div>
        <div className="filter-item"><label htmlFor="folha-ini">De</label><input id="folha-ini" type="date" className="filter-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} /></div>
        <div className="filter-item"><label htmlFor="folha-fim">Até</label><input id="folha-fim" type="date" className="filter-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} /></div>
        <div className="filter-item">
          <label>Gerar para</label>
          <div style={{ display: 'flex', gap: 12, fontSize: 13, padding: '8px 0' }}>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontWeight: 400 }}><input type="radio" name="folha-escopo" checked={escopo === 'todos'} onChange={() => setEscopo('todos')} /> Todos do projeto</label>
            <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontWeight: 400 }}><input type="radio" name="folha-escopo" checked={escopo === 'unico'} onChange={() => setEscopo('unico')} /> Um cooperado</label>
          </div>
        </div>
        {escopo === 'unico' && (
          <div className="filter-item" style={{ minWidth: 240 }}>
            <label htmlFor="folha-cooperado">Cooperado</label>
            <select id="folha-cooperado" className="filter-select" value={candidatoId} disabled={!empresaId} onChange={(e) => setCandidatoId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">{empresaId ? '— Selecione —' : 'Selecione o cliente primeiro'}</option>
              {cooperados.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.matricula ? ` (mat. ${c.matricula})` : ''}</option>)}
            </select>
          </div>
        )}
        <button type="button" className="btn-primary-filter" disabled={gerando} onClick={gerar}>{gerando ? 'Gerando...' : 'Gerar folhas'}</button>
        {folhas && folhas.length > 0 && <button type="button" className="btn-secondary-filter" onClick={imprimir}>Imprimir / Exportar PDF</button>}
      </div>
      {erro && <div role="alert" style={{ margin: '0 24px 16px', padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{erro}</div>}
      {folhas && (folhas.length === 0
        ? <p role="status" style={{ padding: '0 24px 24px', color: '#64748b', fontSize: 14 }}>Nenhum cooperado encontrado para este projeto no período.</p>
        : (
          <div className="table-responsive">
            <table className="monitoramento-table" style={{ fontSize: 12.5 }}>
              <thead><tr><th>Cooperado</th><th>Matrícula</th><th>CPF</th><th>Atividade</th><th style={{ textAlign: 'right' }}>Dias com registro</th></tr></thead>
              <tbody>
                {folhas.map((f) => (
                  <tr key={f.cooperado.id}>
                    <td><strong>{f.cooperado.nome}</strong></td><td>{f.cooperado.matricula || '—'}</td><td>{f.cooperado.cpf ? formatarCPF(f.cooperado.cpf) : '—'}</td>
                    <td>{f.cooperado.atividade || '—'}</td><td style={{ textAlign: 'right' }}>{f.diasComRegistro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
};

export default FolhasApontamento;
