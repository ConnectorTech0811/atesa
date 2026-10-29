import React, { useEffect, useMemo, useState } from 'react';
import './monitoramento/Monitoramento.css';
import { useToast } from '../../components/ToastContext';
import { parseDataHoraServidor } from '../../utils/formatters';
import { rotuloTipoUsuario, TipoUsuario } from '../../api/usuariosApi';
import {
  DetalheEscalista,
  Escalista,
  HistoricoEscalista,
  definirTodosClientesEscalista,
  detalharEscalista,
  liberarClienteEscalista,
  listarEscalistas,
  removerClienteEscalista,
} from '../../api/escalistasApi';

const rotuloPerfil = (p?: string | null) => (p ? rotuloTipoUsuario(p as TipoUsuario).replace(/ \(.*\)$/, '') : '');
const dataHora = (v?: string | null) => {
  if (!v) return '';
  const d = parseDataHoraServidor(v);
  return isNaN(d.getTime()) ? v : `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};
const ROTULO_ACAO: Record<HistoricoEscalista['acao'], string> = {
  cliente_liberado: 'Cliente liberado',
  cliente_removido: 'Cliente removido',
  todos_liberado: 'Acesso a todos os clientes liberado',
  todos_removido: 'Acesso a todos os clientes retirado',
};
const chip: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6, background: '#eff6ff', color: '#1e40af',
  border: '1px solid #bfdbfe', borderRadius: 999, padding: '2px 10px', fontSize: 12, margin: '2px 4px 2px 0',
};

/**
 * Cadastro de Usuários → Escalistas: de onde é cada escalista (região) e quais clientes ela atende.
 * Os clientes da região dela são automáticos; clientes de outras regiões podem ser liberados.
 */
export const CadastroEscalistas: React.FC = () => {
  const { showToast } = useToast();
  const [escalistas, setEscalistas] = useState<Escalista[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroRegiao, setFiltroRegiao] = useState('');
  const [selecionada, setSelecionada] = useState<DetalheEscalista | null>(null);
  const [clienteParaLiberar, setClienteParaLiberar] = useState<number | ''>('');
  const [salvando, setSalvando] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    try { setEscalistas(await listarEscalistas()); }
    catch (e: any) { showToast(e?.message || 'Erro ao carregar as escalistas.', 'error'); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  const regioes = useMemo(() => [...new Set(escalistas.map((e) => e.regiao_nome).filter(Boolean))] as string[], [escalistas]);
  const filtradas = escalistas.filter((e) => {
    const b = busca.trim().toLowerCase();
    if (b && !e.nome.toLowerCase().includes(b) && !e.email.toLowerCase().includes(b)) return false;
    if (filtroRegiao && e.regiao_nome !== filtroRegiao) return false;
    return true;
  });

  const abrir = async (id: number) => {
    setClienteParaLiberar('');
    try { setSelecionada(await detalharEscalista(id)); }
    catch (e: any) { showToast(e?.message || 'Erro ao carregar a escalista.', 'error'); }
  };

  const executar = async (acao: () => Promise<DetalheEscalista>, msg: string) => {
    setSalvando(true);
    try {
      setSelecionada(await acao());
      showToast(msg, 'success');
      carregar();
    } catch (e: any) {
      showToast(e?.message || 'Erro ao salvar.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  // Clientes disponíveis agrupados por região, para o select de liberação
  const disponiveisPorRegiao = useMemo(() => {
    const m = new Map<string, DetalheEscalista['clientes_disponiveis']>();
    for (const c of selecionada?.clientes_disponiveis ?? []) {
      const k = c.regiao_nome || 'Sem região';
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(c);
    }
    return [...m.entries()];
  }, [selecionada]);

  return (
    <div className="monitoramento-container">
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Escalistas e Clientes
          </h1>
          <p>
            Cada escalista vê nas Escalas os clientes da região dela. Para quem atende outra região (ex.: escalista de São Paulo atendendo o Rio de Janeiro),
            libere o cliente aqui. Para cadastrar uma escalista, use o Cadastro de Usuários com o perfil <strong>Escalista</strong> e a região dela.
          </p>
        </div>
      </div>

      <div className="monitoramento-filters-card">
        <div className="filter-item" style={{ flex: 2, minWidth: 220 }}>
          <label htmlFor="esc-busca">Buscar escalista</label>
          <input id="esc-busca" className="filter-input" placeholder="Nome ou e-mail..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        </div>
        <div className="filter-item" style={{ minWidth: 200 }}>
          <label htmlFor="esc-regiao">Região</label>
          <select id="esc-regiao" className="filter-select" value={filtroRegiao} onChange={(e) => setFiltroRegiao(e.target.value)}>
            <option value="">Todas as regiões</option>
            {regioes.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      </div>

      <div className="monitoramento-table-card">
        <div className="table-card-header">
          <h3 className="table-card-title">Escalistas</h3>
          <span className="table-card-count">{filtradas.length} escalista(s)</span>
        </div>
        <div className="table-responsive">
          <table className="monitoramento-table">
            <thead>
              <tr>
                <th>Escalista</th>
                <th>Região (de onde é)</th>
                <th>Clientes da região</th>
                <th>Clientes liberados de outras regiões</th>
                <th>Status</th>
                <th style={{ textAlign: 'center' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando && escalistas.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>Carregando...</td></tr>
              ) : filtradas.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>Nenhuma escalista cadastrada. Cadastre um usuário com o perfil Escalista.</td></tr>
              ) : filtradas.map((e) => (
                <tr key={e.id} style={selecionada?.id === e.id ? { background: '#f0fdf4' } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{e.nome}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{e.email}</div>
                  </td>
                  <td>{e.regiao_nome || <span style={{ color: '#94a3b8' }}>Sem região</span>}</td>
                  <td>
                    {e.todos_clientes
                      ? <span className="badge-status" style={{ background: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}>Todos os clientes</span>
                      : `${e.clientes_regiao} cliente(s)`}
                  </td>
                  <td style={{ maxWidth: 360 }}>
                    {e.clientes_liberados.length === 0
                      ? <span style={{ color: '#94a3b8' }}>—</span>
                      : e.clientes_liberados.map((c) => <span key={c.empresa_id} style={chip}>{c.nome_empresa}{c.regiao_nome ? ` · ${c.regiao_nome}` : ''}</span>)}
                  </td>
                  <td>
                    <span className="badge-status" style={e.ativo
                      ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                      : { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}>
                      {e.ativo ? 'Ativa' : 'Inativa'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button type="button" className="btn-action-edit" onClick={() => abrir(e.id)}>Gerenciar clientes</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selecionada && (
        <div className="monitoramento-table-card">
          <div className="table-card-header" style={{ flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h3 className="table-card-title">Clientes de {selecionada.nome}</h3>
              <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                Região: <strong>{selecionada.regiao_nome || 'sem região'}</strong>. Ela vê nas Escalas os clientes da região e os liberados abaixo.
              </p>
            </div>
            <button type="button" className="btn-cancel" onClick={() => setSelecionada(null)}>Fechar</button>
          </div>

          <div style={{ padding: '0 24px 20px', display: 'grid', gap: 18 }}>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={selecionada.todos_clientes} disabled={salvando} style={{ marginTop: 3 }}
                onChange={(ev) => executar(
                  () => definirTodosClientesEscalista(selecionada.id, ev.target.checked),
                  ev.target.checked ? 'Escalista com acesso a todos os clientes.' : 'Acesso voltou a ser pela região e clientes liberados.',
                )} />
              <span><strong>Acesso a todos os clientes</strong> (todas as regiões). Desmarcado, vale a região dela mais os clientes liberados.</span>
            </label>

            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Liberar cliente de outra região</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <select className="filter-select" style={{ minWidth: 320, flex: 1 }} value={clienteParaLiberar}
                  onChange={(e) => setClienteParaLiberar(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">— Selecione o cliente —</option>
                  {disponiveisPorRegiao.map(([regiao, lista]) => (
                    <optgroup key={regiao} label={regiao}>
                      {lista.map((c) => <option key={c.empresa_id} value={c.empresa_id}>{c.nome_empresa}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button type="button" className="btn-primary-filter" disabled={!clienteParaLiberar || salvando}
                  onClick={() => executar(async () => {
                    const d = await liberarClienteEscalista(selecionada.id, Number(clienteParaLiberar));
                    setClienteParaLiberar('');
                    return d;
                  }, 'Cliente liberado para a escalista.')}>
                  + Liberar cliente
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Liberados de outras regiões ({selecionada.clientes_liberados.length})</h4>
                {selecionada.clientes_liberados.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>Nenhum cliente liberado.</div>
                ) : selecionada.clientes_liberados.map((c) => (
                  <div key={c.empresa_id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', padding: '8px 10px', border: '1px solid #e2e8f0', borderRadius: 8, marginBottom: 6 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{c.nome_empresa}</div>
                      <div style={{ fontSize: 11.5, color: '#64748b' }}>
                        {c.regiao_nome || 'Sem região'} · liberado por {c.liberado_por_nome || '—'}
                        {c.liberado_por_perfil && ` (${rotuloPerfil(c.liberado_por_perfil)})`} em {dataHora(c.criado_em)}
                      </div>
                    </div>
                    <button type="button" className="btn-cancel" disabled={salvando} style={{ color: '#dc2626' }}
                      onClick={() => window.confirm(`Remover o acesso de ${selecionada.nome} a ${c.nome_empresa}?`)
                        && executar(() => removerClienteEscalista(selecionada.id, c.empresa_id), 'Cliente removido da escalista.')}>
                      Remover
                    </button>
                  </div>
                ))}
              </div>
              <div>
                <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Da região {selecionada.regiao_nome || ''} — automáticos ({selecionada.clientes_regiao.length})</h4>
                {selecionada.clientes_regiao.length === 0 ? (
                  <div style={{ fontSize: 13, color: '#94a3b8' }}>Nenhum cliente nesta região.</div>
                ) : (
                  <div>{selecionada.clientes_regiao.map((c) => <span key={c.empresa_id} style={{ ...chip, background: '#f0fdf4', color: '#166534', borderColor: '#bbf7d0' }}>{c.nome_empresa}</span>)}</div>
                )}
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Histórico de acessos</h4>
              {selecionada.historico.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Nenhuma alteração registrada.</div>
              ) : selecionada.historico.map((h) => (
                <div key={h.id} style={{ fontSize: 12.5, color: '#475569', padding: '4px 0', borderBottom: '1px dashed #e2e8f0' }}>
                  <strong>{ROTULO_ACAO[h.acao]}</strong>{h.nome_empresa ? `: ${h.nome_empresa}` : ''} — por {h.autor_nome || '—'}
                  {h.autor_perfil && ` (${rotuloPerfil(h.autor_perfil)})`} em {dataHora(h.criado_em)}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroEscalistas;
