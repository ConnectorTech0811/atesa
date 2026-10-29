import React, { useEffect, useMemo, useState } from 'react';
import './Monitoramento.css';
import { useAuth } from '../../../auth/AuthContext';
import { formatarDataBR, parseDataHoraServidor } from '../../../utils/formatters';
import {
  CooperadoDaVaga,
  PosicaoVaga,
  ROTULO_TIPO_SOLICITACAO,
  SituacaoVaga,
  SolicitacaoVaga,
  StatusSolicitacaoVaga,
  TipoSolicitacaoVaga,
  alterarPosicaoVaga,
  aprovarSolicitacaoVaga,
  cancelarSolicitacaoVaga,
  criarSolicitacaoVaga,
  listarCooperadosDaPosicao,
  listarSituacaoVagas,
  listarSolicitacoesVaga,
  recusarSolicitacaoVaga,
} from '../../../api/solicitacoesVagaApi';

const COR_STATUS: Record<StatusSolicitacaoVaga, { bg: string; fg: string; bd: string; rotulo: string }> = {
  pendente: { bg: '#fffbeb', fg: '#92400e', bd: '#fde68a', rotulo: 'Pendente' },
  aprovada: { bg: '#f0fdf4', fg: '#166534', bd: '#bbf7d0', rotulo: 'Aprovada' },
  recusada: { bg: '#fef2f2', fg: '#991b1b', bd: '#fecaca', rotulo: 'Recusada' },
  cancelada: { bg: '#f1f5f9', fg: '#475569', bd: '#cbd5e1', rotulo: 'Cancelada' },
};
const COR_POSICAO = {
  aberta: { bg: '#eff6ff', fg: '#1d4ed8', bd: '#bfdbfe', rotulo: 'Em aberto' },
  preenchida: { bg: '#f0fdf4', fg: '#166534', bd: '#bbf7d0', rotulo: 'Preenchida' },
  cancelada: { bg: '#f1f5f9', fg: '#64748b', bd: '#cbd5e1', rotulo: 'Cancelada' },
};

const dataHora = (v: string | null) => {
  if (!v) return '—';
  const d = parseDataHoraServidor(v);
  return isNaN(d.getTime()) ? v : `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
};
const autor = (nome: string | null, perfil: string | null) => (nome ? `${nome}${perfil ? ` (${perfil})` : ''}` : '—');
const hoje = () => new Date().toISOString().slice(0, 10);
const badge = (c: { bg: string; fg: string; bd: string }): React.CSSProperties => ({ background: c.bg, color: c.fg, border: `1px solid ${c.bd}` });

type Decisao = { solicitacao: SolicitacaoVaga; acao: 'aprovar' | 'recusar' | 'cancelar' };
type AcaoPosicao = { posicao: PosicaoVaga; cargo: string; acao: 'preencher' | 'cancelar' | 'reabrir' };

/**
 * Supervisão → Solicitações de Vagas: pedidos do cliente para abrir mais posições numa vaga do Parâmetro
 * (aumento de quadro) ou repor posições sem cooperado (reabertura). A Supervisão aprova/recusa e acompanha
 * cada posição aberta até ser preenchida.
 */
export const SolicitacoesVaga: React.FC = () => {
  const { usuario } = useAuth();
  const podeDecidir = ['administrador', 'suporte', 'supervisao'].includes(usuario?.perfil ?? '');

  const [situacao, setSituacao] = useState<SituacaoVaga[]>([]);
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoVaga[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [status, setStatus] = useState<StatusSolicitacaoVaga | ''>('');
  const [soPendencias, setSoPendencias] = useState(true);
  const [versao, setVersao] = useState(0);
  const [novaAberta, setNovaAberta] = useState<SituacaoVaga | 'nova' | null>(null);
  const [decisao, setDecisao] = useState<Decisao | null>(null);
  const [acaoPosicao, setAcaoPosicao] = useState<AcaoPosicao | null>(null);
  const [historicoAberto, setHistoricoAberto] = useState<number | null>(null);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    Promise.all([
      listarSituacaoVagas(empresaId || undefined),
      listarSolicitacoesVaga({ status: status || undefined, empresaId: empresaId || undefined }),
    ])
      .then(([sv, ss]) => { if (ativo) { setSituacao(sv); setSolicitacoes(ss); setErro(''); } })
      .catch((e) => { if (ativo) setErro(e?.message || 'Erro ao carregar as solicitações de vagas.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [empresaId, status, versao]);

  // Lista de clientes vem da situação sem filtro de cliente (carregada uma vez)
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([]);
  useEffect(() => {
    listarSituacaoVagas().then((sv) => {
      const m = new Map<number, string>();
      sv.forEach((v) => m.set(v.empresa_id, v.nome_empresa));
      setClientes([...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
    }).catch(() => undefined);
  }, [versao]);

  const vagasVisiveis = useMemo(
    () => situacao.filter((v) => !soPendencias || v.abertas > 0 || v.pendentes > 0),
    [situacao, soPendencias],
  );
  const totais = useMemo(() => ({
    pendentes: solicitacoes.filter((s) => s.status === 'pendente').length,
    abertas: situacao.reduce((t, v) => t + v.abertas, 0),
    semCooperado: situacao.reduce((t, v) => t + v.sem_cooperado, 0),
  }), [solicitacoes, situacao]);

  const recarregar = (msg?: string) => { setVersao((v) => v + 1); if (msg) { setAviso(msg); setTimeout(() => setAviso(''), 5000); } };

  return (
    <>
      <div className="monitoramento-table-card">
        <div className="table-card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3 className="table-card-title">Solicitações de Vagas (abertura e reabertura)</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
              O cliente pede mais pessoas para uma vaga do Parâmetro: registre o pedido, a Supervisão aprova e as novas posições
              ficam em aberto na mesma vaga até serem preenchidas.
            </p>
          </div>
          <button type="button" className="btn-save-ajuste" onClick={() => setNovaAberta('nova')}>+ Nova Solicitação</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '0 24px 14px', alignItems: 'center' }}>
          <select className="filter-select" value={empresaId} onChange={(e) => setEmpresaId(e.target.value ? Number(e.target.value) : '')} aria-label="Cliente">
            <option value="">Todos os clientes</option>
            {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
          </select>
          <select className="filter-select" value={status} onChange={(e) => setStatus(e.target.value as StatusSolicitacaoVaga | '')} aria-label="Status">
            <option value="">Todos os status</option>
            {(Object.keys(COR_STATUS) as StatusSolicitacaoVaga[]).map((s) => <option key={s} value={s}>{COR_STATUS[s].rotulo}</option>)}
          </select>
          <span style={{ fontSize: 13, color: '#475569', marginLeft: 'auto' }}>
            <strong style={{ color: '#92400e' }}>{totais.pendentes}</strong> pendente(s) ·{' '}
            <strong style={{ color: '#1d4ed8' }}>{totais.abertas}</strong> posição(ões) em aberto ·{' '}
            <strong>{totais.semCooperado}</strong> sem cooperado no total
          </span>
        </div>

        {aviso && <div style={{ margin: '0 24px 12px', padding: 12, background: '#dcfce7', color: '#166534', borderRadius: 8, fontSize: 13 }}>{aviso}</div>}
        {erro && <div style={{ margin: '0 24px 12px', padding: 12, background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{erro}</div>}
      </div>

      {/* Situação das vagas */}
      <div className="monitoramento-table-card">
        <div className="table-card-header" style={{ justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <h3 className="table-card-title">Situação das vagas</h3>
          <label style={{ fontSize: 13, color: '#475569', display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" checked={soPendencias} onChange={(e) => setSoPendencias(e.target.checked)} />
            Só vagas com posições em aberto ou pedidos pendentes
          </label>
        </div>
        <div className="table-responsive">
          <table className="monitoramento-table">
            <thead>
              <tr>
                <th>Cliente / Unidade</th>
                <th>Vaga</th>
                <th style={{ textAlign: 'center' }}>Contratadas</th>
                <th style={{ textAlign: 'center' }}>Ocupadas</th>
                <th style={{ textAlign: 'center' }}>Sem cooperado</th>
                <th style={{ textAlign: 'center' }}>Em aberto</th>
                <th style={{ textAlign: 'center' }}>Pedidos pendentes</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {carregando && situacao.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: '#64748b' }}>Carregando...</td></tr>
              ) : vagasVisiveis.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: '#94a3b8' }}>
                  {soPendencias ? 'Nenhuma vaga com posições em aberto ou pedidos pendentes.' : 'Nenhuma vaga cadastrada no Parâmetro.'}
                </td></tr>
              ) : vagasVisiveis.map((v) => (
                <tr key={v.vaga_id} style={!v.ativa ? { opacity: 0.55 } : undefined}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{v.nome_empresa}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{v.nome_unidade}</div>
                  </td>
                  <td>{v.cargo}{!v.ativa && <span style={{ fontSize: 11, color: '#991b1b' }}> (inativa)</span>}</td>
                  <td style={{ textAlign: 'center', fontWeight: 600 }}>{v.quantidade}</td>
                  <td style={{ textAlign: 'center' }}>{v.ocupadas}</td>
                  <td style={{ textAlign: 'center', color: v.sem_cooperado > 0 ? '#b45309' : undefined }}>{v.sem_cooperado}</td>
                  <td style={{ textAlign: 'center', color: v.abertas > 0 ? '#1d4ed8' : undefined, fontWeight: v.abertas > 0 ? 700 : undefined }}>{v.abertas}</td>
                  <td style={{ textAlign: 'center', color: v.pendentes > 0 ? '#92400e' : undefined, fontWeight: v.pendentes > 0 ? 700 : undefined }}>{v.pendentes}</td>
                  <td>
                    <button type="button" className="btn-action-view" disabled={!v.ativa} onClick={() => setNovaAberta(v)}>Solicitar posições</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Solicitações */}
      <div className="monitoramento-table-card">
        <div className="table-card-header"><h3 className="table-card-title">Solicitações</h3></div>
        <div style={{ display: 'grid', gap: 12, padding: '0 24px 20px' }}>
          {!carregando && solicitacoes.length === 0 && (
            <div style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhuma solicitação registrada.</div>
          )}
          {solicitacoes.map((s) => {
            const cor = COR_STATUS[s.status];
            const preenchidas = s.posicoes.filter((p) => p.status === 'preenchida').length;
            return (
              <div key={s.id} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ display: 'grid', gap: 3 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <strong>Nº {s.id}</strong>
                      <span className="badge-status" style={badge(cor)}>{cor.rotulo}</span>
                      <span className="badge-status" style={badge({ bg: '#f8fafc', fg: '#334155', bd: '#e2e8f0' })}>{s.tipo_rotulo}</span>
                      <span style={{ fontWeight: 700, color: '#166534' }}>+{s.quantidade} posição(ões)</span>
                    </div>
                    <div style={{ fontSize: 14 }}>
                      <strong>{s.nome_empresa}</strong> · {s.nome_unidade ?? '—'} · Vaga <strong>{s.cargo ?? '—'}</strong>
                    </div>
                    <div style={{ fontSize: 13, color: '#334155' }}>{s.motivo}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>
                      Pedido em {formatarDataBR(s.data_solicitacao)}
                      {s.solicitante_cliente && <> por <strong>{s.solicitante_cliente}</strong> (cliente)</>}
                      {s.data_inicio_prevista && <> · início previsto {formatarDataBR(s.data_inicio_prevista)}</>}
                      {' '}· registrado por {autor(s.criado_por_nome, s.criado_por_perfil_rotulo)} em {dataHora(s.criado_em)}
                    </div>
                    {s.status !== 'pendente' && (
                      <div style={{ fontSize: 12, color: '#475569' }}>
                        {cor.rotulo} por {autor(s.decidido_por_nome, s.decidido_por_perfil_rotulo)} em {dataHora(s.decidido_em)}
                        {s.status === 'aprovada' && s.tipo === 'aumento_quadro' && s.quantidade_anterior !== null && (
                          <> · quantidade da vaga {s.quantidade_anterior} → {s.quantidade_nova}</>
                        )}
                        {s.observacao_decisao && <> · “{s.observacao_decisao}”</>}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    {s.status === 'pendente' && podeDecidir && (
                      <>
                        <button type="button" className="btn-save-ajuste" onClick={() => setDecisao({ solicitacao: s, acao: 'aprovar' })}>Aprovar</button>
                        <button type="button" className="btn-cancel" onClick={() => setDecisao({ solicitacao: s, acao: 'recusar' })}>Recusar</button>
                      </>
                    )}
                    {s.status === 'pendente' && (
                      <button type="button" className="btn-cancel" onClick={() => setDecisao({ solicitacao: s, acao: 'cancelar' })}>Cancelar pedido</button>
                    )}
                    <button type="button" className="btn-action-view" onClick={() => setHistoricoAberto(historicoAberto === s.id ? null : s.id)}>
                      {historicoAberto === s.id ? 'Ocultar histórico' : `Histórico (${s.historico.length})`}
                    </button>
                  </div>
                </div>

                {s.posicoes.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                      Posições ({preenchidas}/{s.posicoes.filter((p) => p.status !== 'cancelada').length} preenchidas)
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {s.posicoes.map((p) => {
                        const c = COR_POSICAO[p.status];
                        return (
                          <div key={p.id} style={{ ...badge(c), borderRadius: 8, padding: '8px 10px', fontSize: 12.5, minWidth: 190, display: 'grid', gap: 4 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                              <strong>{s.cargo} #{p.numero}</strong><span>{c.rotulo}</span>
                            </div>
                            {p.status === 'preenchida' && <div>{p.cooperado_nome}{p.matricula ? ` · Mat. ${p.matricula}` : ''}</div>}
                            {p.observacao && <div style={{ color: '#475569' }}>{p.observacao}</div>}
                            {p.alterado_em && <div style={{ fontSize: 11, color: '#64748b' }}>{autor(p.alterado_por_nome, p.alterado_por_perfil_rotulo)} · {dataHora(p.alterado_em)}</div>}
                            {podeDecidir && (
                              <div style={{ display: 'flex', gap: 6 }}>
                                {p.status === 'aberta' && (
                                  <>
                                    <button type="button" className="btn-action-view" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => setAcaoPosicao({ posicao: p, cargo: s.cargo ?? '', acao: 'preencher' })}>Preencher</button>
                                    <button type="button" className="btn-cancel" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => setAcaoPosicao({ posicao: p, cargo: s.cargo ?? '', acao: 'cancelar' })}>Cancelar</button>
                                  </>
                                )}
                                {p.status !== 'aberta' && (
                                  <button type="button" className="btn-action-view" style={{ padding: '3px 8px', fontSize: 12 }} onClick={() => setAcaoPosicao({ posicao: p, cargo: s.cargo ?? '', acao: 'reabrir' })}>Reabrir</button>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {historicoAberto === s.id && (
                  <div style={{ marginTop: 12, borderTop: '1px dashed #e2e8f0', paddingTop: 10, display: 'grid', gap: 6 }}>
                    {s.historico.map((h) => (
                      <div key={h.id} style={{ fontSize: 12.5 }}>
                        <strong>{h.acao_rotulo}</strong> — {dataHora(h.criado_em)} por {autor(h.autor_nome, h.autor_perfil_rotulo)}
                        {h.descricao && <div style={{ color: '#475569' }}>{h.descricao}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {novaAberta && (
        <ModalNovaSolicitacao
          vagas={situacao.length && !empresaId ? situacao : null}
          vagaInicial={novaAberta === 'nova' ? null : novaAberta}
          onClose={() => setNovaAberta(null)}
          onSuccess={(id) => { setNovaAberta(null); recarregar(`Solicitação nº ${id} registrada. Aguardando aprovação da Supervisão.`); }}
        />
      )}
      {decisao && (
        <ModalDecisao
          decisao={decisao}
          onClose={() => setDecisao(null)}
          onSuccess={(msg) => { setDecisao(null); recarregar(msg); }}
        />
      )}
      {acaoPosicao && (
        <ModalPosicao
          dados={acaoPosicao}
          onClose={() => setAcaoPosicao(null)}
          onSuccess={(msg) => { setAcaoPosicao(null); recarregar(msg); }}
        />
      )}
    </>
  );
};

// ── Modais ───────────────────────────────────────────────────────────────────

const Modal: React.FC<{ titulo: string; onClose: () => void; children: React.ReactNode; largura?: number }> = ({ titulo, onClose, children, largura = 620 }) => (
  <div className="modal-overlay-custom" onClick={onClose}>
    <div className="modal-dialog-custom" style={{ maxWidth: largura }} onClick={(e) => e.stopPropagation()}>
      <div className="modal-dialog-header">
        <h3>{titulo}</h3>
        <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">✕</button>
      </div>
      {children}
    </div>
  </div>
);

const Erro: React.FC<{ texto: string }> = ({ texto }) => (texto
  ? <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>{texto}</div>
  : null);

const ModalNovaSolicitacao: React.FC<{
  vagas: SituacaoVaga[] | null;
  vagaInicial: SituacaoVaga | null;
  onClose: () => void;
  onSuccess: (id: number) => void;
}> = ({ vagas: vagasProp, vagaInicial, onClose, onSuccess }) => {
  const [vagas, setVagas] = useState<SituacaoVaga[]>(vagasProp ?? []);
  const [empresaId, setEmpresaId] = useState<number | ''>(vagaInicial?.empresa_id ?? '');
  const [vagaId, setVagaId] = useState<number | ''>(vagaInicial?.vaga_id ?? '');
  const [tipo, setTipo] = useState<TipoSolicitacaoVaga>('aumento_quadro');
  const [quantidade, setQuantidade] = useState(1);
  const [motivo, setMotivo] = useState('');
  const [solicitante, setSolicitante] = useState('');
  const [dataSolicitacao, setDataSolicitacao] = useState(hoje());
  const [dataInicio, setDataInicio] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!vagasProp) listarSituacaoVagas().then(setVagas).catch((e) => setErro(e?.message || 'Erro ao carregar as vagas.'));
  }, [vagasProp]);

  const clientes = useMemo(() => {
    const m = new Map<number, string>();
    vagas.filter((v) => v.ativa).forEach((v) => m.set(v.empresa_id, v.nome_empresa));
    return [...m].map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome));
  }, [vagas]);
  const vagasCliente = vagas.filter((v) => v.ativa && v.empresa_id === empresaId);
  const vaga = vagas.find((v) => v.vaga_id === vagaId) ?? null;
  const livres = vaga ? Math.max(0, vaga.quantidade - vaga.ocupadas - vaga.abertas) : 0;

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vagaId) { setErro('Selecione o cliente e a vaga.'); return; }
    if (motivo.trim().length < 5) { setErro('Descreva o motivo do pedido.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const r = await criarSolicitacaoVaga({
        vagaId: Number(vagaId), tipo, quantidade, motivo: motivo.trim(),
        solicitanteCliente: solicitante.trim() || undefined, dataSolicitacao, dataInicioPrevista: dataInicio || undefined,
      });
      onSuccess(r.id);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar a solicitação.');
      setSalvando(false);
    }
  };

  return (
    <Modal titulo="Nova Solicitação de Vaga" onClose={onClose}>
      <form onSubmit={salvar}>
        <div className="modal-dialog-body">
          <Erro texto={erro} />
          <div className="modal-form-row">
            <div className="modal-form-group">
              <label>Cliente *</label>
              <select value={empresaId} onChange={(e) => { setEmpresaId(e.target.value ? Number(e.target.value) : ''); setVagaId(''); }}>
                <option value="">Selecione...</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </div>
            <div className="modal-form-group">
              <label>Vaga (Parâmetro) *</label>
              <select value={vagaId} onChange={(e) => setVagaId(e.target.value ? Number(e.target.value) : '')} disabled={!empresaId}>
                <option value="">Selecione...</option>
                {vagasCliente.map((v) => <option key={v.vaga_id} value={v.vaga_id}>{v.cargo} · {v.nome_unidade}</option>)}
              </select>
            </div>
          </div>

          {vaga && (
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              Hoje: <strong>{vaga.quantidade}</strong> contratada(s) · <strong>{vaga.ocupadas}</strong> ocupada(s) ·{' '}
              <strong>{vaga.abertas}</strong> em aberto · <strong>{vaga.pendentes}</strong> em pedidos pendentes
            </div>
          )}

          <div className="modal-form-group">
            <label>Tipo de solicitação *</label>
            <div style={{ display: 'grid', gap: 6 }}>
              {(Object.keys(ROTULO_TIPO_SOLICITACAO) as TipoSolicitacaoVaga[]).map((t) => (
                <label key={t} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontWeight: 400, cursor: 'pointer' }}>
                  <input type="radio" name="tipo" checked={tipo === t} onChange={() => setTipo(t)} style={{ marginTop: 3 }} />
                  <span>
                    <strong>{ROTULO_TIPO_SOLICITACAO[t]}</strong>
                    <span style={{ display: 'block', fontSize: 12, color: '#64748b' }}>
                      {t === 'aumento_quadro'
                        ? 'O cliente quer mais pessoas: ao aprovar, a quantidade da vaga no Parâmetro aumenta e as novas posições ficam em aberto.'
                        : `Repor posições já contratadas que estão sem cooperado (não muda a quantidade).${vaga ? ` Disponível para reabrir: ${livres}.` : ''}`}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="modal-form-row">
            <div className="modal-form-group">
              <label>Quantidade de posições *</label>
              <input type="number" min={1} max={100} value={quantidade} onChange={(e) => setQuantidade(Math.max(1, Number(e.target.value) || 1))} />
            </div>
            <div className="modal-form-group">
              <label>Quem pediu no cliente</label>
              <input type="text" placeholder="Nome / cargo do solicitante" value={solicitante} onChange={(e) => setSolicitante(e.target.value)} />
            </div>
          </div>
          <div className="modal-form-row">
            <div className="modal-form-group">
              <label>Data do pedido *</label>
              <input type="date" value={dataSolicitacao} onChange={(e) => setDataSolicitacao(e.target.value)} />
            </div>
            <div className="modal-form-group">
              <label>Início previsto</label>
              <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
            </div>
          </div>
          <div className="modal-form-group">
            <label>Motivo / detalhes do pedido *</label>
            <textarea rows={3} placeholder="Ex.: aumento de demanda na produção a partir de novembro" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <div className="modal-dialog-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>Cancelar</button>
          <button type="submit" className="btn-save-ajuste" disabled={salvando}>{salvando ? 'Registrando...' : 'Registrar Solicitação'}</button>
        </div>
      </form>
    </Modal>
  );
};

const ModalDecisao: React.FC<{ decisao: Decisao; onClose: () => void; onSuccess: (msg: string) => void }> = ({ decisao, onClose, onSuccess }) => {
  const { solicitacao: s, acao } = decisao;
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const obrigatoria = acao !== 'aprovar';
  const titulo = { aprovar: 'Aprovar Solicitação', recusar: 'Recusar Solicitação', cancelar: 'Cancelar Pedido' }[acao];

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (obrigatoria && observacao.trim().length < 5) { setErro('Informe a justificativa (mínimo de 5 caracteres).'); return; }
    setSalvando(true);
    setErro('');
    try {
      if (acao === 'aprovar') {
        const r = await aprovarSolicitacaoVaga(s.id, observacao.trim() || undefined);
        onSuccess(s.tipo === 'aumento_quadro'
          ? `Solicitação nº ${s.id} aprovada: vaga ${s.cargo} passou de ${r.quantidadeAnterior} para ${r.quantidadeNova}. ${s.quantidade} posição(ões) em aberto.`
          : `Solicitação nº ${s.id} aprovada: ${s.quantidade} posição(ões) reaberta(s).`);
      } else if (acao === 'recusar') {
        await recusarSolicitacaoVaga(s.id, observacao.trim());
        onSuccess(`Solicitação nº ${s.id} recusada.`);
      } else {
        await cancelarSolicitacaoVaga(s.id, observacao.trim());
        onSuccess(`Solicitação nº ${s.id} cancelada.`);
      }
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao registrar a decisão.');
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={titulo} onClose={onClose} largura={520}>
      <form onSubmit={confirmar}>
        <div className="modal-dialog-body">
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, display: 'grid', gap: 3 }}>
            <div><strong>{s.nome_empresa}</strong> · {s.nome_unidade} · Vaga {s.cargo}</div>
            <div>{s.tipo_rotulo}: <strong>+{s.quantidade}</strong> posição(ões)</div>
            {acao === 'aprovar' && s.tipo === 'aumento_quadro' && s.quantidade_atual !== null && (
              <div>A quantidade da vaga no Parâmetro passará de <strong>{s.quantidade_atual}</strong> para <strong>{s.quantidade_atual + s.quantidade}</strong>.</div>
            )}
          </div>
          <Erro texto={erro} />
          <div className="modal-form-group">
            <label>{obrigatoria ? 'Justificativa *' : 'Observação'}</label>
            <textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <div className="modal-dialog-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>Voltar</button>
          <button type="submit" className="btn-save-ajuste" disabled={salvando}>{salvando ? 'Salvando...' : titulo}</button>
        </div>
      </form>
    </Modal>
  );
};

const ModalPosicao: React.FC<{ dados: AcaoPosicao; onClose: () => void; onSuccess: (msg: string) => void }> = ({ dados, onClose, onSuccess }) => {
  const { posicao: p, cargo, acao } = dados;
  const [cooperados, setCooperados] = useState<CooperadoDaVaga[] | null>(null);
  const [candidatoId, setCandidatoId] = useState<number | ''>('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const titulo = { preencher: 'Preencher Posição', cancelar: 'Cancelar Posição', reabrir: 'Reabrir Posição' }[acao];

  useEffect(() => {
    if (acao === 'preencher') listarCooperadosDaPosicao(p.id).then(setCooperados).catch((e) => setErro(e?.message || 'Erro ao carregar os cooperados.'));
  }, [acao, p.id]);

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (acao === 'preencher' && !candidatoId) { setErro('Selecione o cooperado.'); return; }
    if (acao === 'cancelar' && observacao.trim().length < 5) { setErro('Informe o motivo do cancelamento.'); return; }
    setSalvando(true);
    setErro('');
    try {
      await alterarPosicaoVaga(p.id, acao, { candidatoId: candidatoId || undefined, observacao: observacao.trim() || undefined });
      onSuccess(`${cargo} #${p.numero}: ${{ preencher: 'posição preenchida', cancelar: 'posição cancelada', reabrir: 'posição reaberta' }[acao]}.`);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao atualizar a posição.');
      setSalvando(false);
    }
  };

  return (
    <Modal titulo={`${titulo} — ${cargo} #${p.numero}`} onClose={onClose} largura={520}>
      <form onSubmit={confirmar}>
        <div className="modal-dialog-body">
          <Erro texto={erro} />
          {acao === 'preencher' && (
            <div className="modal-form-group">
              <label>Cooperado alocado nesta vaga *</label>
              <select value={candidatoId} onChange={(e) => setCandidatoId(e.target.value ? Number(e.target.value) : '')}>
                <option value="">{cooperados ? 'Selecione...' : 'Carregando...'}</option>
                {(cooperados ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.nome}{c.matricula ? ` — Mat. ${c.matricula}` : ''} (desde {formatarDataBR(c.data_inicio)})</option>
                ))}
              </select>
              {cooperados && cooperados.length === 0 && (
                <span style={{ fontSize: 12, color: '#b45309' }}>
                  Nenhum cooperado alocado nesta vaga sem posição. Aloque o cooperado na vaga pelo RA e volte aqui.
                </span>
              )}
            </div>
          )}
          <div className="modal-form-group">
            <label>{acao === 'cancelar' ? 'Motivo *' : 'Observação'}</label>
            <textarea rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </div>
        <div className="modal-dialog-footer">
          <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>Voltar</button>
          <button type="submit" className="btn-save-ajuste" disabled={salvando}>{salvando ? 'Salvando...' : titulo}</button>
        </div>
      </form>
    </Modal>
  );
};

export default SolicitacoesVaga;
