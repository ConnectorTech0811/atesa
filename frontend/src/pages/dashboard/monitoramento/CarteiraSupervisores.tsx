import React, { useEffect, useMemo, useState } from 'react';
import './Monitoramento.css';
import { useAuth } from '../../../auth/AuthContext';
import { CarteiraSupervisores as Carteira, ClienteCarteira, obterCarteiraSupervisores } from '../../../api/carteiraSupervisoresApi';
import { formatarCNPJ, formatarCPF, formatarDataHora, formatarTelefone, parseDataHoraServidor } from '../../../utils/formatters';

type FiltroKpi = 'todos' | 'com_visita' | 'sem_visita' | 'sem_supervisor';

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000;
const visitaEmBreve = (c: ClienteCarteira) => {
  if (!c.proxima_visita) return false;
  const t = parseDataHoraServidor(c.proxima_visita).getTime();
  return Number.isFinite(t) && t - Date.now() <= SETE_DIAS;
};

/** Garante o formato esperado mesmo se a API responder algo inesperado (ex.: HTML ou serviço sem a rota). */
function normalizarCarteira(resposta: unknown): Carteira {
  const r = (resposta && typeof resposta === 'object' ? resposta : {}) as Partial<Carteira>;
  if (!Array.isArray(r.supervisores)) {
    throw new Error('O serviço de Supervisão não respondeu a Carteira de Supervisores. Reinicie/atualize o supervisao-service e tente novamente.');
  }
  return {
    supervisores: r.supervisores.map((s) => ({
      ...s,
      id: Number(s.id),
      nome: String(s.nome ?? 'Sem nome'),
      ativo: !!s.ativo,
      clientes: Array.isArray(s.clientes) ? s.clientes.map((c) => ({ ...c, nome_empresa: String(c.nome_empresa ?? '—') })) : [],
    })),
    semSupervisor: Array.isArray(r.semSupervisor) ? r.semSupervisor.map((c) => ({ ...c, nome_empresa: String(c.nome_empresa ?? '—') })) : [],
  };
}

const documento = (c: ClienteCarteira) => (c.cpf ? `CPF ${formatarCPF(c.cpf)}` : c.cnpj ? `CNPJ ${formatarCNPJ(c.cnpj)}` : '');
const iniciais = (nome: string) => String(nome || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

const LinhaCliente: React.FC<{ c: ClienteCarteira }> = ({ c }) => (
  <li style={{ padding: '9px 0', borderTop: '1px solid #f1f5f9', listStyle: 'none', breakInside: 'avoid' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, color: '#1f2937', fontSize: 13.5 }}>{c.nome_empresa}</div>
        <div style={{ fontSize: 11.5, color: '#64748b' }}>
          {[documento(c), [c.cidade, c.uf].filter(Boolean).join('/'), c.regiao_nome].filter(Boolean).join(' · ') || '—'}
        </div>
        {(c.representante || c.telefone_empresa) && (
          <div style={{ fontSize: 11.5, color: '#64748b' }}>
            {[c.representante, c.telefone_empresa ? formatarTelefone(c.telefone_empresa) : ''].filter(Boolean).join(' · ')}
          </div>
        )}
      </div>
      {c.status && <span className="painel-tag" style={{ background: '#e8f0fe', color: '#1976d2', fontSize: 10.5, padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{c.status}</span>}
    </div>
    <div style={{ fontSize: 11.5, marginTop: 3, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
      <span style={{ color: c.proxima_visita ? (visitaEmBreve(c) ? '#1565c0' : '#334155') : '#b45309', fontWeight: 600 }}>
        📅 {c.proxima_visita ? `Próxima visita: ${formatarDataHora(c.proxima_visita)}` : 'Sem visita agendada'}
      </span>
      {c.ultima_visita && <span style={{ color: '#94a3b8' }}>Última: {formatarDataHora(c.ultima_visita)}</span>}
    </div>
  </li>
);

/**
 * Carteira de Supervisores: um card por supervisor com os clientes que ele atende no pós-venda
 * (supervisor escolhido no Parâmetro), no mesmo formato de cards do Painel Executivo.
 */
export const CarteiraSupervisores: React.FC = () => {
  const { usuario } = useAuth();
  const ehSupervisor = usuario?.perfil === 'supervisao';
  const [dados, setDados] = useState<Carteira>({ supervisores: [], semSupervisor: [] });
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState<FiltroKpi>('todos');
  const [somenteMinha, setSomenteMinha] = useState(ehSupervisor);
  const [expandidos, setExpandidos] = useState<Record<number, boolean>>({});

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try { setDados(normalizarCarteira(await obterCarteiraSupervisores())); }
    catch (e) { setErro(e instanceof Error ? e.message : 'Erro ao carregar a carteira de supervisores.'); }
    finally { setCarregando(false); }
  };
  useEffect(() => { carregar(); }, []);

  const todosClientes = useMemo(() => dados.supervisores.flatMap((s) => s.clientes), [dados]);
  const kpis = [
    { id: 'todos' as const, label: 'Supervisores', valor: dados.supervisores.filter((s) => s.ativo).length, cor: '#2e6b32', bg: '#f0f7f0', dica: 'Mostrar todos' },
    { id: 'com_visita' as const, label: 'Visitas (7 dias)', valor: todosClientes.filter(visitaEmBreve).length, cor: '#1565c0', bg: '#e3f2fd', dica: 'Clientes com visita nos próximos 7 dias' },
    { id: 'sem_visita' as const, label: 'Clientes sem visita agendada', valor: todosClientes.filter((c) => !c.proxima_visita).length, cor: '#e65100', bg: '#fff3e0', dica: 'Clientes da carteira sem próxima visita' },
    { id: 'sem_supervisor' as const, label: 'Clientes sem supervisor', valor: dados.semSupervisor.length, cor: '#cf3c4f', bg: '#fdecee', dica: 'Negócio Fechado sem supervisor do pós-venda (definir no Parâmetro)' },
  ];

  const termo = busca.trim().toLowerCase();
  const casaCliente = (c: ClienteCarteira) => {
    if (filtro === 'com_visita' && !visitaEmBreve(c)) return false;
    if (filtro === 'sem_visita' && c.proxima_visita) return false;
    return true;
  };
  const casaBusca = (c: ClienteCarteira) => !termo || [c.nome_empresa, c.cidade, c.regiao_nome, c.cnpj, c.cpf].some((v) => String(v || '').toLowerCase().includes(termo));

  const cards = dados.supervisores
    .filter((s) => !somenteMinha || s.id === usuario?.id)
    .map((s) => {
      const nomeCasa = !!termo && [s.nome, s.regiao_nome].some((v) => String(v || '').toLowerCase().includes(termo));
      const clientes = s.clientes.filter(casaCliente).filter((c) => nomeCasa || casaBusca(c));
      return { s, clientes, visivel: filtro === 'todos' ? (!termo || nomeCasa || clientes.length > 0) : clientes.length > 0 };
    })
    .filter((x) => x.visivel)
    // O próprio supervisor primeiro; depois, quem atende mais clientes
    .sort((a, b) => Number(b.s.id === usuario?.id) - Number(a.s.id === usuario?.id) || b.s.clientes.length - a.s.clientes.length || a.s.nome.localeCompare(b.s.nome));

  const semSupervisor = dados.semSupervisor.filter(casaBusca);
  const LIMITE = 6;

  return (
    <div className="monitoramento-container">
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="9" cy="7" r="4" />
              <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
              <path d="M16 3.13a4 4 0 0 1 0 7.75" />
            </svg>
            Carteira de Supervisores
          </h1>
          <p>Clientes que cada supervisor atende no pós-venda. O supervisor de cada cliente é definido no Parâmetro, e as visitas vêm da agenda.</p>
        </div>
      </div>

      {/* KPIs clicáveis (mesmo padrão do Painel Executivo) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
        {kpis.map((k) => {
          const ativo = filtro === k.id && k.id !== 'todos';
          return (
            <div
              key={k.id}
              role="button"
              tabIndex={0}
              onClick={() => setFiltro(filtro === k.id ? 'todos' : k.id)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setFiltro(filtro === k.id ? 'todos' : k.id)}
              title={ativo ? 'Clique para limpar o filtro' : k.dica}
              style={{
                background: k.bg, borderRadius: 10, padding: '14px 16px', cursor: 'pointer',
                border: `${ativo ? 2 : 1}px solid ${k.cor}${ativo ? '88' : '22'}`,
                boxShadow: ativo ? `0 4px 14px ${k.cor}33` : undefined,
              }}
            >
              <div style={{ fontSize: 26, fontWeight: 800, color: k.cor, lineHeight: 1 }}>{carregando ? '…' : k.valor}</div>
              <div style={{ fontSize: 11, color: '#555', marginTop: 4, fontWeight: 500 }}>{k.label}</div>
              {ativo && <div style={{ fontSize: 10, color: k.cor, marginTop: 2, opacity: 0.8 }}>● filtro ativo</div>}
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input className="filter-input" style={{ minWidth: 260, flex: '1 1 260px', maxWidth: 420 }} placeholder="Buscar supervisor, cliente, cidade, região..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        {ehSupervisor && (
          <label style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#334155' }}>
            <input type="checkbox" checked={somenteMinha} onChange={(e) => setSomenteMinha(e.target.checked)} />
            Somente a minha carteira
          </label>
        )}
        <button type="button" className="btn-action-edit" onClick={carregar} disabled={carregando}>{carregando ? 'Atualizando...' : 'Atualizar'}</button>
      </div>

      {erro && <div style={{ padding: 14, background: '#fee2e2', color: '#991b1b', borderRadius: 10, marginBottom: 16 }}>{erro}</div>}

      {filtro !== 'sem_supervisor' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {!carregando && cards.length === 0 && (
            <div className="monitoramento-table-card" style={{ padding: 28, textAlign: 'center', color: '#94a3b8', gridColumn: '1 / -1' }}>
              {dados.supervisores.length === 0 ? 'Nenhum usuário do perfil Supervisão cadastrado.' : 'Nenhum supervisor corresponde ao filtro.'}
            </div>
          )}
          {cards.map(({ s, clientes }) => {
            const aberto = !!expandidos[s.id];
            const mostrar = aberto ? clientes : clientes.slice(0, LIMITE);
            const souEu = s.id === usuario?.id;
            return (
              <div key={s.id} className="monitoramento-table-card" style={{ padding: 16, margin: 0, borderTop: `4px solid ${souEu ? '#1565c0' : '#4a9e4f'}`, opacity: s.ativo ? 1 : 0.75 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 8 }}>
                  <span style={{ width: 42, height: 42, borderRadius: '50%', background: souEu ? '#e3f2fd' : '#f0f7f0', color: souEu ? '#1565c0' : '#2e6b32', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, flexShrink: 0 }}>
                    {iniciais(s.nome)}
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontWeight: 800, color: '#111827', fontSize: 15 }}>
                      {s.nome} {souEu && <span style={{ fontSize: 11, color: '#1565c0' }}>(você)</span>}
                      {!s.ativo && <span style={{ fontSize: 11, color: '#b91c1c', marginLeft: 6 }}>inativo</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      {[s.regiao_nome, s.telefone ? formatarTelefone(s.telefone) : '', s.email].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center', flexShrink: 0 }}>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#2e6b32', lineHeight: 1 }}>{s.clientes.length}</div>
                    <div style={{ fontSize: 10.5, color: '#64748b' }}>cliente{s.clientes.length === 1 ? '' : 's'}</div>
                  </div>
                </div>
                {clientes.length === 0 ? (
                  <div style={{ fontSize: 12.5, color: '#94a3b8', padding: '10px 0', borderTop: '1px solid #f1f5f9' }}>
                    {s.clientes.length === 0 ? 'Nenhum cliente atribuído. Defina o supervisor do cliente no Parâmetro.' : 'Nenhum cliente corresponde ao filtro.'}
                  </div>
                ) : (
                  <ul style={{ margin: 0, padding: 0 }}>
                    {mostrar.map((c) => <LinhaCliente key={c.id} c={c} />)}
                  </ul>
                )}
                {clientes.length > LIMITE && (
                  <button type="button" className="btn-action-edit" style={{ marginTop: 8 }} onClick={() => setExpandidos((p) => ({ ...p, [s.id]: !aberto }))}>
                    {aberto ? 'Mostrar menos' : `Ver todos os ${clientes.length} clientes`}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Clientes com Negócio Fechado e sem supervisor do pós-venda */}
      {(filtro === 'sem_supervisor' || (filtro === 'todos' && !somenteMinha)) && semSupervisor.length > 0 && (
        <div className="monitoramento-table-card" style={{ padding: 16, marginTop: 20, borderTop: '4px solid #cf3c4f' }}>
          <h3 className="table-card-title" style={{ margin: 0 }}>Clientes sem supervisor ({semSupervisor.length})</h3>
          <p style={{ margin: '4px 0 6px', fontSize: 12.5, color: '#64748b' }}>Negócio Fechado sem supervisor do pós-venda. Defina em Parâmetro → cliente → Supervisor (pós-venda).</p>
          <ul style={{ margin: 0, padding: 0, columns: '320px', columnGap: 24 }}>
            {semSupervisor.map((c) => <LinhaCliente key={c.id} c={c} />)}
          </ul>
        </div>
      )}
      {filtro === 'sem_supervisor' && !carregando && semSupervisor.length === 0 && (
        <div className="monitoramento-table-card" style={{ padding: 28, textAlign: 'center', color: '#94a3b8' }}>Todos os clientes com Negócio Fechado têm supervisor.</div>
      )}
    </div>
  );
};

export default CarteiraSupervisores;
