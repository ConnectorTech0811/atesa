import React, { useCallback, useEffect, useState } from 'react';
import { IonButton, useIonViewWillEnter } from '@ionic/react';
import {
  IconChart, IconUsers, IconSearch, IconAlert, IconCheck,
  IconCheckCircle, IconEdit, IconPin, IconX,
  IconFile, IconTrash, IconBell, IconUpload, IconUser,
} from '../../components/Icons';
import {
  Candidato, Alocacao,
  listarCandidatos, obterCandidato,
} from '../../api/raApi';
import {
  AlertaBeneficio, Descontos,
  listarAlertas, marcarAlertaLido, marcarTodosLidos,
  obterDescontos,
} from '../../api/beneficiosApi';
import CandidatoDetalhe from './CandidatoDetalhe';
import { formatarCPF, formatarDataBR } from '../../utils/formatters';
import { useToast } from '../../components/ToastContext';

// ── Tipos locais ──────────────────────────────────────────────────────────────

type Aba = 'dashboard' | 'cooperados' | 'descontos' | 'alertas';

interface CooperadoBeneficio extends Candidato {
  docs_pendentes?: number;
  docs_total?: number;
  desconto_ok?: boolean;
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function KpiCard({
  label, valor, cor, bg, sub,
}: {
  label: string; valor: number | string; cor: string; bg: string; sub?: string;
}) {
  return (
    <div style={{
      background: bg, border: `1px solid ${cor}22`,
      borderRadius: 12, padding: '18px 22px',
    }}>
      <div style={{ fontSize: 30, fontWeight: 800, color: cor, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 12, color: '#555', marginTop: 6, fontWeight: 600 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────

const Beneficios: React.FC = () => {
  const { showToast } = useToast();
  const [aba, setAba] = useState<Aba>('dashboard');
  const [erro, setErro] = useState('');

  // ── Cooperados ─────────────────────────────────────────────────────────────
  const [cooperados, setCooperados] = useState<CooperadoBeneficio[]>([]);
  const [carregandoCoop, setCarregandoCoop] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('1'); // ativos por padrão

  // ── Ficha completa ─────────────────────────────────────────────────────────
  const [verDetalhe, setVerDetalhe] = useState<{ candidato: Candidato; alocacoes: Alocacao[] } | null>(null);

  // ── Descontos ──────────────────────────────────────────────────────────────
  const [descontosMap, setDescontosMap] = useState<Record<number, Descontos>>({});
  const [carregandoDesc, setCarregandoDesc] = useState(false);

  // ── Alertas ────────────────────────────────────────────────────────────────
  const [alertas, setAlertas] = useState<AlertaBeneficio[]>([]);
  const [alertasNaoLidos, setAlertasNaoLidos] = useState(0);
  const [carregandoAlertas, setCarregandoAlertas] = useState(false);

  // ── Documentos pendentes (dashboard) ──────────────────────────────────────
  const [docsPendentes, setDocsPendentes] = useState(0);

  // ── Carregamento ───────────────────────────────────────────────────────────

  const carregarCooperados = useCallback(async () => {
    setCarregandoCoop(true);
    try {
      const lista = await listarCandidatos({ status: filtroStatus, busca });
      setCooperados(lista);
    } catch {
      setErro('Erro ao carregar cooperados.');
    } finally {
      setCarregandoCoop(false);
    }
  }, [filtroStatus, busca]);

  const carregarAlertas = useCallback(async () => {
    setCarregandoAlertas(true);
    try {
      const lista = await listarAlertas();
      setAlertas(lista);
      setAlertasNaoLidos(lista.filter((a) => a.lido === 0).length);
    } catch { /* silencioso */ }
    finally { setCarregandoAlertas(false); }
  }, []);

  const carregarDescontos = useCallback(async () => {
    if (cooperados.length === 0) return;
    setCarregandoDesc(true);
    try {
      const resultados = await Promise.allSettled(
        cooperados.slice(0, 50).map((c) => obterDescontos(c.id).then((d) => [c.id, d] as [number, Descontos]))
      );
      const mapa: Record<number, Descontos> = {};
      for (const r of resultados) {
        if (r.status === 'fulfilled') {
          const [id, d] = r.value;
          mapa[id] = d;
        }
      }
      setDescontosMap(mapa);
    } catch { /* silencioso */ }
    finally { setCarregandoDesc(false); }
  }, [cooperados]);

  const carregarDocsPendentes = useCallback(async () => {
    try {
      const lista = await listarAlertas();
      const pendentes = lista.filter((a) => a.tipo === 'documento_enviado' && a.lido === 0).length;
      setDocsPendentes(pendentes);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { carregarCooperados(); }, [carregarCooperados]);
  useEffect(() => { if (aba === 'alertas') carregarAlertas(); }, [aba, carregarAlertas]);
  useEffect(() => { if (aba === 'descontos') carregarDescontos(); }, [aba, carregarDescontos]);
  useIonViewWillEnter(() => { carregarCooperados(); carregarAlertas(); carregarDocsPendentes(); });

  // ── Handlers ───────────────────────────────────────────────────────────────

  const abrirFicha = async (c: Candidato) => {
    try {
      const dados = await obterCandidato(c.id);
      setVerDetalhe({ candidato: dados, alocacoes: dados.alocacoes ?? [] });
    } catch {
      setVerDetalhe({ candidato: c, alocacoes: [] });
    }
  };

  const handleMarcarLido = async (a: AlertaBeneficio) => {
    try {
      await marcarAlertaLido(a.id);
      setAlertas((prev) => prev.map((x) => x.id === a.id ? { ...x, lido: 1 as const } : x));
      setAlertasNaoLidos((n) => Math.max(0, n - 1));
    } catch { /* silencioso */ }
  };

  const handleMarcarTodosLidos = async () => {
    try {
      await marcarTodosLidos();
      setAlertas((prev) => prev.map((x) => ({ ...x, lido: 1 as const })));
      setAlertasNaoLidos(0);
      showToast('Todos os alertas marcados como lidos.', 'success');
    } catch { /* silencioso */ }
  };

  // ── Métricas do dashboard ──────────────────────────────────────────────────
  const totalAtivos = cooperados.filter((c) => c.status === 1).length;
  const totalPreCadastro = cooperados.filter((c) => c.status === 0).length;
  const totalAlocados = cooperados.filter((c) => c.alocacoes_ativas > 0).length;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="painel-page">

      {/* Cabeçalho */}
      <div className="painel-header">
        <div>
          <h1>Módulo Benefícios</h1>
          <p className="painel-subtitle">Gestão de Cooperados, Descontos e Documentos</p>
        </div>
      </div>

      {/* Erro global */}
      {erro && (
        <p style={{ fontSize: 13, padding: '8px 12px', marginBottom: 16, borderRadius: 6, background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a', display: 'flex', alignItems: 'center', gap: 6 }}>
          <IconAlert size={14} />{erro}
          <button onClick={() => setErro('')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700, color: '#c62828', marginLeft: 8 }}>×</button>
        </p>
      )}

      {/* Abas */}
      <div className="exec-abas" style={{ marginBottom: 24 }}>
        {(['dashboard', 'cooperados', 'descontos', 'alertas'] as Aba[]).map((a) => (
          <button key={a} className={`exec-aba${aba === a ? ' exec-aba-ativa' : ''}`} onClick={() => setAba(a)}>
            {a === 'dashboard'
              ? <><IconChart size={15} style={{ marginRight: 6 }} />Dashboard</>
              : a === 'cooperados'
              ? <><IconUsers size={15} style={{ marginRight: 6 }} />Cooperados</>
              : a === 'descontos'
              ? <><IconPercent size={15} style={{ marginRight: 6 }} />Descontos</>
              : (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <IconAlert size={15} />Alertas
                  {alertasNaoLidos > 0 && (
                    <span style={{ background: '#c62828', color: '#fff', borderRadius: 10, fontSize: 10, fontWeight: 700, padding: '1px 5px', minWidth: 16, textAlign: 'center' }}>
                      {alertasNaoLidos}
                    </span>
                  )}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* ── ABA: DASHBOARD ──────────────────────────────────────────────── */}
      {aba === 'dashboard' && (
        <div>
          {/* KPIs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>
            <KpiCard label="Cooperados ativos" valor={totalAtivos} cor="#2e7d32" bg="#e8f5e9" />
            <KpiCard label="Pré-cadastro pendente" valor={totalPreCadastro} cor="#e65100" bg="#fff8e1" sub="Aguardando aprovação" />
            <KpiCard label="Cooperados alocados" valor={totalAlocados} cor="#1565c0" bg="#e3f2fd" />
            <KpiCard label="Docs. pendentes validação" valor={docsPendentes} cor="#6a1b9a" bg="#f3e5f5" sub="Alertas de documentos" />
            <KpiCard label="Alertas não lidos" valor={alertasNaoLidos} cor="#c62828" bg="#fce4ec" />
          </div>

          {/* Acesso rápido */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 28 }}>

            {/* Atalho: últimos alertas */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#c62828', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Alertas recentes
                </h3>
                <button onClick={() => setAba('alertas')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#1565c0', textDecoration: 'underline' }}>
                  Ver todos
                </button>
              </div>
              {alertas.filter((a) => a.lido === 0).slice(0, 5).length === 0 ? (
                <p style={{ color: '#aaa', fontSize: 13, margin: 0 }}>Nenhum alerta pendente. ✓</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {alertas.filter((a) => a.lido === 0).slice(0, 5).map((a) => (
                    <div key={a.id} style={{ fontSize: 12, padding: '8px 10px', borderRadius: 8, background: '#fff8e1', border: '1px solid #ffe082' }}>
                      <div style={{ fontWeight: 600, color: '#333' }}>{a.candidato_nome}</div>
                      <div style={{ color: '#666', marginTop: 2 }}>{a.mensagem}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Atalho: cooperados sem desconto configurado */}
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px 22px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#1565c0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Acesso rápido
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  { label: 'Gerenciar cooperados', aba: 'cooperados' as Aba, cor: '#2e7d32', bg: '#e8f5e9' },
                  { label: 'Ver descontos', aba: 'descontos' as Aba, cor: '#1565c0', bg: '#e3f2fd' },
                  { label: 'Central de alertas', aba: 'alertas' as Aba, cor: '#c62828', bg: '#fce4ec' },
                ].map((item) => (
                  <button
                    key={item.aba}
                    onClick={() => setAba(item.aba)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: item.bg, border: `1px solid ${item.cor}33`,
                      borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                      fontSize: 13, fontWeight: 600, color: item.cor,
                      textAlign: 'left',
                    }}
                  >
                    <IconCheck size={14} />{item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Lista de cooperados com alocações ativas */}
          {cooperados.filter((c) => c.alocacoes_ativas > 0).length > 0 && (
            <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12, padding: '20px 22px' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 13, fontWeight: 700, color: '#2e6b32', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Cooperados alocados ({cooperados.filter((c) => c.alocacoes_ativas > 0).length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {cooperados.filter((c) => c.alocacoes_ativas > 0).slice(0, 10).map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, background: '#f9f9f9', border: '1px solid #f0f0f0' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#222' }}>{c.nome}</div>
                      <div style={{ fontSize: 12, color: '#777', marginTop: 2 }}>
                        CPF: {formatarCPF(c.cpf)}
                        {c.matricula && <span style={{ marginLeft: 10, color: '#1565c0' }}>{c.matricula}</span>}
                        <span style={{ marginLeft: 10, color: '#2e7d32', fontWeight: 600 }}>
                          <IconPin size={11} style={{ marginRight: 3 }} />
                          {c.alocacoes_ativas} alocação{c.alocacoes_ativas > 1 ? 'ões' : ''}
                        </span>
                      </div>
                    </div>
                    <IonButton size="small" shape="round" color="primary" fill="outline" onClick={() => abrirFicha(c)}>
                      Ficha completa
                    </IonButton>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── ABA: COOPERADOS ─────────────────────────────────────────────── */}
      {aba === 'cooperados' && (
        <div>
          {/* Filtros */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              className="form-input"
              style={{ flex: 1, minWidth: 220, maxWidth: 360, height: 38 }}
              placeholder="Buscar por nome, CPF ou matrícula..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && carregarCooperados()}
            />
            <select className="form-input" style={{ width: 170, height: 38 }} value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
              <option value="">Todos os status</option>
              <option value="0">Pré-cadastro</option>
              <option value="1">Ativos</option>
            </select>
            <IonButton size="small" shape="round" color="secondary" onClick={carregarCooperados}>
              <IconSearch size={14} style={{ marginRight: 5 }} />Buscar
            </IonButton>
          </div>

          {carregandoCoop && <p style={{ color: '#888', fontSize: 13 }}>Carregando...</p>}

          <div className="painel-lista">
            {cooperados.length === 0 && !carregandoCoop && (
              <div className="painel-vazio">Nenhum cooperado encontrado.</div>
            )}
            {cooperados.map((c) => {
              const isPre = c.status === 0;
              const corStatus = isPre
                ? { bg: '#fff8e1', color: '#e65100', label: 'Pré-cadastro' }
                : { bg: '#e8f5e9', color: '#2e7d32', label: 'Ativo' };
              return (
                <div key={c.id} className="painel-card">
                  <div className="painel-card-info" style={{ flex: 1 }}>
                    <div className="painel-card-titulo">
                      <h3 style={{ fontSize: 15 }}>{c.nome}</h3>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 10, background: corStatus.bg, color: corStatus.color, border: `1px solid ${corStatus.color}33` }}>
                        {corStatus.label}
                      </span>
                      {c.matricula && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10, background: '#e3f2fd', color: '#1565c0' }}>
                          {c.matricula}
                        </span>
                      )}
                      {c.alocacoes_ativas > 0 && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 10, background: '#e8f5e9', color: '#2e7d32' }}>
                          <IconPin size={10} style={{ marginRight: 3 }} />
                          {c.alocacoes_ativas} alocação{c.alocacoes_ativas > 1 ? 'ões' : ''} ativa{c.alocacoes_ativas > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 4 }}>
                      <p className="painel-detalhe">CPF: {formatarCPF(c.cpf)}</p>
                      <p className="painel-detalhe">Cooperativa: {c.cooperativa}</p>
                      {c.aprovado_em && (
                        <p className="painel-detalhe">Aprovado em {formatarDataBR(c.aprovado_em)}</p>
                      )}
                    </div>
                  </div>
                  <div className="painel-card-acoes" style={{ gap: 6, flexDirection: 'column', alignItems: 'stretch' }}>
                    <button
                      className="btn-secundario"
                      style={{ fontSize: 12, padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 5, background: '#e3f2fd', color: '#1565c0' }}
                      onClick={() => abrirFicha(c)}
                    >
                      <IconUsers size={13} />Ficha completa
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ABA: DESCONTOS ──────────────────────────────────────────────── */}
      {aba === 'descontos' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Descontos dos cooperados</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>
                INSS, seguro de vida e quota parte. Clique em "Ficha completa" para editar.
              </p>
            </div>
            {carregandoDesc && <span style={{ fontSize: 12, color: '#888' }}>Carregando descontos...</span>}
          </div>

          {/* Legenda de campos */}
          <div style={{ background: '#f5f5f5', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: '#555' }}>
            <span><strong>INSS Patronal:</strong> percentual aplicado ao salário</span>
            <span><strong>Seguro de vida:</strong> desconto mensal fixo</span>
            <span><strong>Quota parte:</strong> cotas de entrada na cooperativa</span>
            <span><strong>Rateio:</strong> percentual da sobra distribuída</span>
          </div>

          {cooperados.filter((c) => c.status === 1).length === 0 ? (
            <div className="painel-vazio">Nenhum cooperado ativo encontrado.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={thStyle}>Cooperado</th>
                    <th style={thStyle}>Matrícula</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>INSS (%)</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Seg. Vida (%)</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Quota Parte</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Rateio (%)</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Status</th>
                    <th style={thStyle}></th>
                  </tr>
                </thead>
                <tbody>
                  {cooperados.filter((c) => c.status === 1).map((c) => {
                    const d = descontosMap[c.id];
                    const configurado = d && (d.inss_percentual || d.seguro_vida_percentual || d.quota_parte_valor);
                    return (
                      <tr key={c.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                        <td style={tdStyle}><strong>{c.nome}</strong></td>
                        <td style={tdStyle}>{c.matricula ?? <span style={{ color: '#bbb' }}>—</span>}</td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {d?.inss_percentual != null
                            ? `${(Number(d.inss_percentual) * 100).toFixed(1)}%`
                            : <span style={{ color: '#bbb' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {d?.seguro_vida_percentual != null
                            ? `${(Number(d.seguro_vida_percentual) * 100).toFixed(1)}%`
                            : <span style={{ color: '#bbb' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {d?.quota_parte_valor != null
                            ? <>
                                R$ {Number(d.quota_parte_valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                {d.quota_parcelada
                                  ? <div style={{ fontSize: 10, color: '#888' }}>
                                      {d.quota_cotas_pagas ?? 0}/{d.quota_total_cotas ?? '?'} cotas
                                    </div>
                                  : <div style={{ fontSize: 10, color: '#888' }}>Única</div>}
                              </>
                            : <span style={{ color: '#bbb' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {d?.rateio_percentual != null
                            ? `${Number(d.rateio_percentual).toFixed(1)}%`
                            : <span style={{ color: '#bbb' }}>—</span>}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {carregandoDesc
                            ? <span style={{ color: '#aaa' }}>...</span>
                            : configurado
                            ? <span style={{ color: '#2e7d32', fontWeight: 700, fontSize: 11 }}>✓ Config.</span>
                            : <span style={{ color: '#e65100', fontWeight: 700, fontSize: 11 }}>Pendente</span>}
                        </td>
                        <td style={tdStyle}>
                          <button
                            className="btn-secundario"
                            style={{ fontSize: 11, padding: '4px 10px', display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => abrirFicha(c)}
                          >
                            <IconEdit size={12} />Editar
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Resumo de desconto obrigatório */}
          <div style={{ background: '#e3f2fd', border: '1px solid #90caf9', borderRadius: 10, padding: '14px 18px', marginTop: 20, fontSize: 13, color: '#1565c0' }}>
            <strong>Atenção:</strong> Os descontos são obrigatórios e calculados automaticamente no contrato.
            A quota parte pode ser parcelada — as cotas continuam sendo pagas mesmo que o cooperado troque de vaga.
            Só é paga uma única vez se o cooperado se desligar totalmente da cooperativa.
          </div>
        </div>
      )}

      {/* ── ABA: ALERTAS ────────────────────────────────────────────────── */}
      {aba === 'alertas' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
              Central de alertas
              {alertasNaoLidos > 0 && (
                <span style={{ marginLeft: 10, background: '#c62828', color: '#fff', borderRadius: 10, fontSize: 11, padding: '2px 8px', fontWeight: 700 }}>
                  {alertasNaoLidos} não lidos
                </span>
              )}
            </h3>
            {alertasNaoLidos > 0 && (
              <IonButton size="small" shape="round" fill="outline" onClick={handleMarcarTodosLidos}>
                <IconCheckCircle size={14} style={{ marginRight: 5 }} />Marcar todos como lidos
              </IonButton>
            )}
          </div>

          {/* Filtro por tipo */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {['Todos', 'documento_enviado', 'documento_validado', 'dados_sensiveis', 'dados_bancarios', 'documento_removido'].map((tipo) => (
              <span key={tipo} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: '#f5f5f5', color: '#555', border: '1px solid #e0e0e0', cursor: 'default' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {iconAlerta(tipo === 'Todos' ? '' : tipo)}
                  {tipo === 'Todos' ? 'Todos' :
                   tipo === 'documento_enviado' ? 'Doc. enviado' :
                   tipo === 'documento_validado' ? 'Doc. validado' :
                   tipo === 'dados_sensiveis' ? 'Dados pessoais' :
                   tipo === 'dados_bancarios' ? 'Dados bancários' :
                   'Doc. removido'}
                </span>
              </span>
            ))}
          </div>

          {carregandoAlertas && <p style={{ color: '#888', fontSize: 13 }}>Carregando alertas...</p>}

          {!carregandoAlertas && alertas.length === 0 && (
            <div className="painel-vazio">Nenhum alerta registrado.</div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alertas.map((a) => (
              <div key={a.id} style={{
                background: a.lido ? '#f9f9f9' : corAlerta(a.tipo).bg,
                border: `1px solid ${a.lido ? '#e0e0e0' : corAlerta(a.tipo).borda}`,
                borderRadius: 10, padding: '12px 16px',
                display: 'flex', gap: 12, alignItems: 'flex-start',
                opacity: a.lido ? 0.7 : 1,
                transition: 'opacity 0.2s',
              }}>
                <span style={{ flexShrink: 0, marginTop: 1, color: corAlerta(a.tipo).borda }}>{iconAlerta(a.tipo)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{a.candidato_nome}</span>
                    {a.matricula && <span style={{ fontSize: 11, color: '#1565c0', background: '#e3f2fd', padding: '1px 6px', borderRadius: 6 }}>{a.matricula}</span>}
                    {!a.lido && <span style={{ fontSize: 10, fontWeight: 700, color: '#e65100', background: '#fff8e1', padding: '1px 6px', borderRadius: 6 }}>NOVO</span>}
                  </div>
                  <div style={{ fontSize: 12, color: '#555', marginTop: 3 }}>{a.mensagem}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                    {rotulaTipo(a.tipo)} · {new Date(a.criado_em).toLocaleString('pt-BR')}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  {a.lido === 0 && (
                    <button className="btn-secundario" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => handleMarcarLido(a)}>
                      Marcar lido
                    </button>
                  )}
                  <button
                    className="btn-secundario"
                    style={{ fontSize: 11, padding: '3px 10px', background: '#e3f2fd', color: '#1565c0' }}
                    onClick={() => {
                      const coop = cooperados.find((c) => c.id === a.candidato_id);
                      if (coop) abrirFicha(coop);
                    }}
                  >
                    Ver ficha
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Overlay: Ficha completa do cooperado ─────────────────────────── */}
      {verDetalhe && (
        <div
          onClick={() => { setVerDetalhe(null); carregarCooperados(); carregarAlertas(); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 9999, overflowY: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '28px 16px 48px' }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: 940 }}>
            <CandidatoDetalhe
              candidato={verDetalhe.candidato}
              alocacoes={verDetalhe.alocacoes}
              onVoltar={() => { setVerDetalhe(null); carregarCooperados(); carregarAlertas(); }}
              onAtualizado={() => { carregarCooperados(); carregarAlertas(); }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

// ── Estilos de tabela ─────────────────────────────────────────────────────────

const thStyle: React.CSSProperties = {
  padding: '10px 14px', textAlign: 'left', fontSize: 12,
  fontWeight: 700, color: '#555', borderBottom: '2px solid #e0e0e0',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '10px 14px', verticalAlign: 'middle',
};

// ── Helpers de alertas ────────────────────────────────────────────────────────

function iconAlerta(tipo: string): React.ReactNode {
  const s = { size: 16 };
  switch (tipo) {
    case 'documento_enviado':   return <IconUpload {...s} />;
    case 'documento_validado':  return <IconCheckCircle {...s} />;
    case 'documento_rejeitado': return <IconX {...s} />;
    case 'documento_removido':  return <IconTrash {...s} />;
    case 'dados_sensiveis':     return <IconUser {...s} />;
    case 'dados_bancarios':     return <IconFile {...s} />;
    default:                    return <IconBell {...s} />;
  }
}

function rotulaTipo(tipo: string): string {
  switch (tipo) {
    case 'documento_enviado':   return 'Documento enviado';
    case 'documento_validado':  return 'Documento validado';
    case 'documento_removido':  return 'Documento removido';
    case 'dados_sensiveis':     return 'Dados pessoais';
    case 'dados_bancarios':     return 'Dados bancários';
    default: return tipo;
  }
}

function corAlerta(tipo: string): { bg: string; borda: string } {
  switch (tipo) {
    case 'documento_enviado':  return { bg: '#fff8e1', borda: '#ffe082' };
    case 'documento_validado': return { bg: '#e8f5e9', borda: '#a5d6a7' };
    case 'documento_removido': return { bg: '#fce4ec', borda: '#ef9a9a' };
    case 'dados_sensiveis':    return { bg: '#f3e5f5', borda: '#ce93d8' };
    case 'dados_bancarios':    return { bg: '#e3f2fd', borda: '#90caf9' };
    default: return { bg: '#f5f5f5', borda: '#e0e0e0' };
  }
}

// Ícone de percentual (local)
function IconPercent({ size = 20, style }: { size?: number; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={style}>
      <line x1="19" y1="5" x2="5" y2="19" />
      <circle cx="6.5" cy="6.5" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
    </svg>
  );
}

export default Beneficios;
