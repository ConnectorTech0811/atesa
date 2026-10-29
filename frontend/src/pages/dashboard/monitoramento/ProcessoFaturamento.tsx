import React, { useEffect, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { formatarDataBR, formatarMoeda } from '../../../utils/formatters';
import {
  AuditoriaFaturamento,
  CAMPOS_AJUSTAVEIS_FATURAMENTO,
  CampoAjustavelFaturamento,
  CampoApuracao,
  DetalheProcessoFaturamento,
  ItemFaturamento,
  LinhaFaturamento,
  ProcessoFaturamento as Processo,
  StatusProcessoFaturamento,
  UnidadeFaturamento,
  apurarProcessoFaturamento,
  aprovarProcessoFaturamento,
  cancelarProcessoFaturamento,
  conferirItensFaturamento,
  criarProcessoFaturamento,
  listarAuditoriaFaturamento,
  listarProcessosFaturamento,
  listarUnidadesFaturamento,
  obterProcessoFaturamento,
  registrarAjusteFaturamento,
  registrarDivergenciaFaturamento,
  rejeitarProcessoFaturamento,
  removerAjusteFaturamento,
  resolverDivergenciaFaturamento,
  obterModeloPlanilhaCliente,
} from '../../../api/escalaFaturamentoApi';
import { baixarPlanilhaFaturamento, sugerirModelo } from '../../../utils/planilhasFaturamento';
import ProcessoComissoesNotas from './ProcessoComissoesNotas';

const ROTULO_STATUS: Record<StatusProcessoFaturamento, string> = {
  aberto: 'Aberto',
  apurado: 'Em conferência',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
  cancelado: 'Cancelado',
};
const CLASSE_STATUS: Record<string, string> = {
  aberto: 'badge-ativo',
  apurado: 'badge-pendente',
  aprovado: 'badge-em-atividade',
  rejeitado: 'badge-divergente',
  cancelado: 'badge-inativo',
  pendente: 'badge-pendente',
  conferido: 'badge-em-atividade',
  divergente: 'badge-divergente',
};

const ROTULO_CAMPO: Record<CampoApuracao, string> = {
  dias_mes_fechado: 'Dias mês fechado',
  dias_trabalhados: 'Dias trabalhados',
  total_horas: 'Total horas',
  horas_apontadas: 'Horas apontadas',
  horas_escala: 'Horas escala',
  horas_previstas: 'Horas previstas',
  horas_falta: 'Horas falta',
  horas_noturnas: 'Horas noturnas',
  pl_diurno: 'PL diurno',
  pl_noturno: 'PL noturno',
  hora_excedente: 'Hora excedente',
  ad_noturno: 'Ad. noturno (h)',
  bonificacao: 'Bonificação',
  desc_refeicao: 'Desc. refeição',
  desc_estacionamento: 'Desc. estacionamento',
  desc_farmacia: 'Desc. farmácia',
  reembolso: 'Reembolso',
};
const CAMPOS_MOEDA: CampoApuracao[] = ['bonificacao', 'desc_refeicao', 'desc_estacionamento', 'desc_farmacia', 'reembolso'];
const COLUNAS_ITEM: CampoApuracao[] = [
  'dias_trabalhados', 'horas_apontadas', 'horas_escala', 'horas_previstas', 'total_horas', 'horas_falta', 'pl_diurno', 'pl_noturno',
  'hora_excedente', 'ad_noturno', 'bonificacao', 'desc_refeicao', 'desc_estacionamento', 'desc_farmacia', 'reembolso',
];

const ROTULO_ACAO: Record<string, string> = {
  criacao: 'Processo criado',
  edicao: 'Processo alterado',
  apuracao: 'Apuração gerada',
  conferencia_item: 'Item conferido',
  ajuste: 'Ajuste registrado',
  remocao_ajuste: 'Ajuste removido',
  divergencia_registrada: 'Divergência registrada',
  divergencia_resolvida: 'Divergência resolvida',
  divergencia_descartada: 'Divergência descartada',
  aprovacao: 'Apuração aprovada',
  rejeicao: 'Apuração rejeitada',
  cancelamento: 'Processo cancelado',
};

const fmt = (campo: CampoApuracao, v: number) =>
  CAMPOS_MOEDA.includes(campo) ? formatarMoeda(v) : v.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

const Badge: React.FC<{ status: string; rotulo?: string }> = ({ status, rotulo }) => (
  <span className={`badge-status ${CLASSE_STATUS[status] ?? 'badge-inativo'}`}>
    <span className="badge-status-dot" />
    {rotulo ?? status}
  </span>
);

// ── Modal genérico para ações que exigem justificativa ──
interface ConfigModal {
  titulo: string;
  descricao?: string;
  rotuloTexto: string;
  comAjuste?: { item: ItemFaturamento };
  comResolucao?: boolean;
  confirmar: (dados: { texto: string; campo?: CampoAjustavelFaturamento; valor?: string; status?: 'resolvida' | 'descartada' }) => Promise<void>;
}

const ModalAcao: React.FC<{ config: ConfigModal; onClose: () => void }> = ({ config, onClose }) => {
  const [texto, setTexto] = useState('');
  const [campo, setCampo] = useState<CampoAjustavelFaturamento>('total_horas');
  const [valor, setValor] = useState('');
  const [status, setStatus] = useState<'resolvida' | 'descartada'>('resolvida');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const item = config.comAjuste?.item;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      await config.confirmar({ texto, campo, valor, status });
      onClose();
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível concluir a ação.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h3>{config.titulo}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-dialog-body">
            {config.descricao && (
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>{config.descricao}</div>
            )}
            {erro && <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>{erro}</div>}
            {item && (
              <div className="modal-form-row">
                <div className="modal-form-group">
                  <label>Campo *</label>
                  <select value={campo} onChange={(e) => setCampo(e.target.value as CampoAjustavelFaturamento)}>
                    {CAMPOS_AJUSTAVEIS_FATURAMENTO.map((c) => <option key={c} value={c}>{ROTULO_CAMPO[c]}</option>)}
                  </select>
                </div>
                <div className="modal-form-group">
                  <label>Novo valor * (apurado: {fmt(campo, Number(item[campo]) || 0)})</label>
                  <input type="text" inputMode="decimal" value={valor} onChange={(e) => setValor(e.target.value)} required placeholder="Ex: 12,5" />
                </div>
              </div>
            )}
            {config.comResolucao && (
              <div className="modal-form-group">
                <label>Resultado *</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as 'resolvida' | 'descartada')}>
                  <option value="resolvida">Resolvida</option>
                  <option value="descartada">Descartada (não procede)</option>
                </select>
              </div>
            )}
            <div className="modal-form-group">
              <label>{config.rotuloTexto} *</label>
              <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} required />
            </div>
          </div>
          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>{salvando ? 'Gravando...' : 'Confirmar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Seção principal ──
interface Props {
  empresaId: number | '';
  competencia: string;
  nomeEmpresa?: string;
}

export const ProcessoFaturamento: React.FC<Props> = ({ empresaId, competencia, nomeEmpresa }) => {
  const { showToast } = useToast();
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [unidades, setUnidades] = useState<UnidadeFaturamento[]>([]);
  const [novaUnidade, setNovaUnidade] = useState<number | ''>('');
  const [novoCentroCusto, setNovoCentroCusto] = useState('');
  const [criando, setCriando] = useState(false);

  const [selecionadoId, setSelecionadoId] = useState<number | null>(null);
  const [detalhe, setDetalhe] = useState<DetalheProcessoFaturamento | null>(null);
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [ocupado, setOcupado] = useState(false);
  const [modal, setModal] = useState<ConfigModal | null>(null);
  const [auditoria, setAuditoria] = useState<AuditoriaFaturamento[] | null>(null);
  const [verRegras, setVerRegras] = useState(false);

  const competenciaValida = /^\d{4}-\d{2}$/.test(competencia);

  const carregarProcessos = async () => {
    if (!competenciaValida) return;
    try {
      setProcessos(await listarProcessosFaturamento({ competencia, empresaId: empresaId || undefined }));
    } catch (err: any) {
      setProcessos([]);
      showToast(err?.message || 'Erro ao listar processos.', 'error');
    }
  };

  const carregarDetalhe = async (id: number) => {
    try {
      setDetalhe(await obterProcessoFaturamento(id));
      setMarcados(new Set());
      setAuditoria(null);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar o processo.', 'error');
    }
  };

  useEffect(() => {
    carregarProcessos();
    setSelecionadoId(null);
    setDetalhe(null);
  }, [competencia, empresaId]);

  useEffect(() => {
    setNovaUnidade('');
    setNovoCentroCusto('');
    if (!empresaId) { setUnidades([]); return; }
    listarUnidadesFaturamento(Number(empresaId)).then(setUnidades).catch(() => setUnidades([]));
  }, [empresaId]);

  useEffect(() => {
    if (selecionadoId) carregarDetalhe(selecionadoId);
  }, [selecionadoId]);

  const recarregar = async () => {
    await carregarProcessos();
    if (selecionadoId) await carregarDetalhe(selecionadoId);
  };

  const executar = async (acao: () => Promise<unknown>, sucesso: string) => {
    setOcupado(true);
    try {
      await acao();
      showToast(sucesso, 'success');
      await recarregar();
    } catch (err: any) {
      showToast(err?.message || 'Não foi possível concluir a ação.', 'error');
    } finally {
      setOcupado(false);
    }
  };

  const handleCriar = async () => {
    if (!empresaId) { showToast('Selecione o cliente (empresa).', 'warning'); return; }
    if (!competenciaValida) { showToast('Informe a competência no topo da página.', 'warning'); return; }
    setCriando(true);
    try {
      const r = await criarProcessoFaturamento({
        competencia,
        empresaId: Number(empresaId),
        unidadeId: novaUnidade || undefined,
        centroCusto: novoCentroCusto || undefined,
      });
      showToast(`Processo ${r.codigo} criado.`, 'success');
      setNovoCentroCusto('');
      await carregarProcessos();
      setSelecionadoId(r.id);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao criar processo.', 'error');
    } finally {
      setCriando(false);
    }
  };

  const p = detalhe?.processo;
  const emConferencia = p?.status === 'apurado';
  const podeApurar = p && ['aberto', 'apurado', 'rejeitado'].includes(p.status);
  const chaveParaNome = new Map((detalhe?.itens ?? []).map((i) => [i.chave_item, i.cooperado_nome]));

  const handleApurar = () => {
    if (!p) return;
    if (p.status === 'apurado' && !window.confirm('Refazer a apuração? As conferências dos itens serão desfeitas (ajustes e divergências registradas manualmente são mantidos).')) return;
    executar(async () => {
      const r = await apurarProcessoFaturamento(p.id);
      r.avisos.forEach((a) => showToast(a, 'warning'));
    }, 'Apuração gerada.');
  };

  const handleConferir = (ids: number[]) => {
    if (!p || ids.length === 0) return;
    setOcupado(true);
    conferirItensFaturamento(p.id, ids)
      .then((r) => {
        showToast(
          `${r.conferidos} item(ns) conferido(s)${r.bloqueados_por_divergencia ? ` · ${r.bloqueados_por_divergencia} com divergência em aberto` : ''}.`,
          r.bloqueados_por_divergencia ? 'warning' : 'success'
        );
        return recarregar();
      })
      .catch((err) => showToast(err?.message || 'Erro ao conferir.', 'error'))
      .finally(() => setOcupado(false));
  };

  const handleBaixar = async () => {
    if (!detalhe) return;
    const [ano, mes] = detalhe.processo.competencia.split('-');
    const linhas: LinhaFaturamento[] = detalhe.itens.map((i) => ({
      alocacao_id: i.alocacao_id,
      candidato_id: i.candidato_id,
      cooperado: i.cooperado_nome,
      matricula: i.matricula ?? '',
      data_inicio: i.data_inicio,
      desligamento: i.desligamento,
      atividade: i.atividade ?? '',
      tipo_escala: i.tipo_escala,
      competencia: `${mes}/${ano}`,
      local: i.local ?? '',
      dias_mes_total: i.dias_mes_total,
      inconsistencias: [],
      avisos: i.avisos ?? [],
      ...i.valores_finais,
    }));
    try {
      await baixarPlanilhaFaturamento(
        {
          empresa: { id: detalhe.processo.empresa_id, nome: detalhe.processo.nome_empresa },
          competencia: `${mes}/${ano}`,
          periodo: { inicio: detalhe.processo.periodo_inicio, fim: detalhe.processo.periodo_fim },
          linhas,
          avisos: [],
        },
        // Modelo vinculado ao cliente; sem vínculo, sugerido pelo tipo de escala
        (await obterModeloPlanilhaCliente(detalhe.processo.empresa_id).catch(() => null))?.modelo ?? sugerirModelo(linhas)
      );
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gerar o arquivo .xlsx.', 'error');
    }
  };

  const abrirAuditoria = async () => {
    if (!p) return;
    if (auditoria) { setAuditoria(null); return; }
    try { setAuditoria(await listarAuditoriaFaturamento(p.id)); }
    catch (err: any) { showToast(err?.message || 'Erro ao carregar auditoria.', 'error'); }
  };

  const alternarMarcado = (id: number) => {
    const s = new Set(marcados);
    if (s.has(id)) s.delete(id); else s.add(id);
    setMarcados(s);
  };

  return (
    <div className="monitoramento-table-card">
      <div className="table-card-header">
        <div>
          <h3 className="table-card-title">3. Processo de faturamento — apuração e conferência</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Crie o processo do cliente na competência, gere a apuração (mesmo cálculo da planilha acima), confira os itens,
            registre ajustes e divergências e aprove. Emissão de nota fiscal e cobrança ainda não fazem parte desta etapa.
          </p>
        </div>
      </div>

      {/* Novo processo: cliente e competência vêm dos filtros do topo da página */}
      <div style={{ margin: '14px 24px', padding: '14px 16px', border: '1px solid #e2e8f0', borderRadius: 10, background: '#f8fafc' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a', marginBottom: 10 }}>
          Novo processo
          <span style={{ fontWeight: 400, color: '#64748b', marginLeft: 8 }}>
            {empresaId
              ? <>Cliente <strong>{nomeEmpresa ?? '—'}</strong> · competência <strong>{competenciaValida ? competencia.split('-').reverse().join('/') : '—'}</strong></>
              : 'Selecione o cliente e a competência nos filtros do topo da página.'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="filter-item" style={{ flex: '1 1 260px', maxWidth: 360 }}>
            <label htmlFor="novo-processo-unidade">Unidade / ficha</label>
            <select id="novo-processo-unidade" className="filter-select" value={novaUnidade} onChange={(e) => setNovaUnidade(e.target.value ? Number(e.target.value) : '')} disabled={!empresaId}>
              <option value="">Todas as unidades (empresa inteira)</option>
              {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome_unidade}{u.ativa ? '' : ' (inativa)'}</option>)}
            </select>
          </div>
          <div className="filter-item" style={{ flex: '1 1 200px', maxWidth: 260 }}>
            <label htmlFor="novo-processo-cc">Centro de custo (opcional)</label>
            <input id="novo-processo-cc" className="filter-input" value={novoCentroCusto} maxLength={100} disabled={!empresaId}
              onChange={(e) => setNovoCentroCusto(e.target.value)} placeholder="Ex.: CC-UTI" />
          </div>
          <button type="button" className="btn-primary-filter" onClick={handleCriar} disabled={criando || !empresaId || !competenciaValida} style={{ flex: '0 0 auto' }}>
            {criando ? 'Criando...' : '+ Criar processo'}
          </button>
        </div>
        {empresaId && (
          <p style={{ margin: '8px 0 0', fontSize: 12, color: '#64748b' }}>
            {unidades.length === 0
              ? 'Este cliente não tem unidades (fichas) cadastradas no Parâmetro: o processo será da empresa inteira.'
              : 'Sem unidade, o processo cobre a empresa inteira e não pode coexistir com processos por unidade na mesma competência.'}
          </p>
        )}
      </div>

      {/* Lista de processos */}
      <div className="table-responsive">
        <table className="monitoramento-table">
          <thead>
            <tr>
              <th>Código</th>
              <th>Cliente</th>
              <th>Unidade</th>
              <th>Centro de custo</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Itens conferidos</th>
              <th style={{ textAlign: 'right' }}>Divergências</th>
            </tr>
          </thead>
          <tbody>
            {processos.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhum processo nesta competência{empresaId ? ' para este cliente' : ''}.</td></tr>
            ) : processos.map((pr) => (
              <tr key={pr.id} onClick={() => setSelecionadoId(pr.id)} style={{ cursor: 'pointer', background: pr.id === selecionadoId ? '#f0fdf4' : undefined }}>
                <td><strong>{pr.codigo}</strong></td>
                <td>{pr.nome_empresa}</td>
                <td>{pr.nome_unidade ?? 'Empresa inteira'}</td>
                <td>{pr.centro_custo ?? '—'}</td>
                <td><Badge status={pr.status} rotulo={ROTULO_STATUS[pr.status]} /></td>
                <td style={{ textAlign: 'right' }}>{pr.itens_conferidos ?? 0} / {pr.total_itens ?? 0}</td>
                <td style={{ textAlign: 'right', color: Number(pr.divergencias_abertas) ? '#b91c1c' : undefined }}>{pr.divergencias_abertas ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detalhe do processo */}
      {detalhe && p && (
        <div style={{ borderTop: '2px solid #e2e8f0' }}>
          <div style={{ padding: '16px 24px', display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 13, lineHeight: 1.7 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{p.codigo} <Badge status={p.status} rotulo={ROTULO_STATUS[p.status]} /></div>
              <div><strong>Cliente:</strong> {p.nome_empresa} · <strong>Cooperativa:</strong> {p.cooperativa ?? '—'} · <strong>Unidade:</strong> {p.nome_unidade ?? 'Empresa inteira'} · <strong>Centro de custo:</strong> {p.centro_custo ?? '—'}</div>
              <div><strong>Período:</strong> {formatarDataBR(p.periodo_inicio)} a {formatarDataBR(p.periodo_fim)} · <strong>Versão da apuração:</strong> {p.versao_apuracao || '—'}
                {p.apurado_por_nome && <> · apurado por {p.apurado_por_nome}</>}
                {p.aprovado_por_nome && <> · aprovado por {p.aprovado_por_nome}</>}
              </div>
              {(p.periodo_apuracao || p.apresentacao_faturamento || p.vencimento) && (
                <div style={{ color: '#64748b' }}>Ficha da unidade: período de apuração "{p.periodo_apuracao ?? '—'}" · apresentação "{p.apresentacao_faturamento ?? '—'}" · vencimento "{p.vencimento ?? '—'}"</div>
              )}
              {p.motivo_status && <div style={{ color: '#b91c1c' }}><strong>Motivo ({ROTULO_STATUS[p.status].toLowerCase()}):</strong> {p.motivo_status}</div>}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {podeApurar && (
                <button type="button" className="btn-primary-filter" onClick={handleApurar} disabled={ocupado}>
                  {p.status === 'aberto' ? 'Gerar apuração' : '↻ Refazer apuração'}
                </button>
              )}
              {emConferencia && (
                <>
                  <button
                    type="button"
                    className="btn-save-ajuste"
                    disabled={ocupado || detalhe.impedimentos_aprovacao.length > 0}
                    title={detalhe.impedimentos_aprovacao.join(' ')}
                    onClick={() => window.confirm('Aprovar a apuração? Depois de aprovada ela não pode mais ser alterada.') && executar(() => aprovarProcessoFaturamento(p.id), 'Apuração aprovada.')}
                  >
                    ✓ Aprovar
                  </button>
                  <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={() => setModal({
                    titulo: 'Rejeitar apuração',
                    descricao: 'O processo volta para correção (ex.: apontamentos, escalas ou valores do cliente) e poderá ser apurado novamente.',
                    rotuloTexto: 'Motivo da rejeição',
                    confirmar: async ({ texto }) => { await rejeitarProcessoFaturamento(p.id, texto); showToast('Apuração rejeitada.', 'success'); await recarregar(); },
                  })}>Rejeitar</button>
                  <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={() => setModal({
                    titulo: 'Registrar divergência do processo',
                    rotuloTexto: 'Descrição da divergência',
                    confirmar: async ({ texto }) => { await registrarDivergenciaFaturamento(p.id, { descricao: texto }); showToast('Divergência registrada.', 'success'); await recarregar(); },
                  })}>Registrar divergência</button>
                </>
              )}
              {['aberto', 'apurado', 'rejeitado'].includes(p.status) && (
                <button type="button" className="btn-cancel" disabled={ocupado} onClick={() => setModal({
                  titulo: `Cancelar o processo ${p.codigo}`,
                  descricao: 'O processo cancelado fica no histórico e libera a criação de outro para o mesmo cliente/unidade/competência.',
                  rotuloTexto: 'Motivo do cancelamento',
                  confirmar: async ({ texto }) => { await cancelarProcessoFaturamento(p.id, texto); showToast('Processo cancelado.', 'success'); await recarregar(); },
                })}>Cancelar processo</button>
              )}
              {detalhe.itens.length > 0 && (
                <button type="button" className="btn-secondary-filter" onClick={handleBaixar}>⬇ Baixar .xlsx</button>
              )}
              <button type="button" className="btn-secondary-filter" onClick={abrirAuditoria}>{auditoria ? 'Ocultar histórico' : 'Histórico'}</button>
            </div>
          </div>

          {emConferencia && detalhe.impedimentos_aprovacao.length > 0 && (
            <div style={{ padding: '10px 24px', background: '#f5f3ff', color: '#5b21b6', fontSize: 13 }}>
              Para aprovar: {detalhe.impedimentos_aprovacao.join(' ')}
            </div>
          )}

          <div style={{ padding: '10px 24px', background: '#fffbeb', color: '#92400e', fontSize: 13, borderTop: '1px solid #fde68a', borderBottom: '1px solid #fde68a' }}>
            <button type="button" onClick={() => setVerRegras(!verRegras)} style={{ background: 'none', border: 'none', color: '#92400e', fontWeight: 700, cursor: 'pointer', padding: 0 }}>
              ⚠ Regras ainda não confirmadas pela ATESA ({detalhe.regras_pendentes.length}) {verRegras ? '▲' : '▼'}
            </button>
            {verRegras && <ul style={{ margin: '6px 0 0 18px' }}>{detalhe.regras_pendentes.map((r, i) => <li key={i}>{r}</li>)}</ul>}
          </div>

          {/* Itens */}
          {p.status !== 'aberto' && (
            <>
              {emConferencia && (
                <div style={{ padding: '10px 24px', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button" className="btn-secondary-filter" disabled={ocupado || marcados.size === 0} onClick={() => handleConferir([...marcados])}>
                    ✓ Conferir selecionados ({marcados.size})
                  </button>
                  <button type="button" className="btn-secondary-filter" disabled={ocupado} onClick={() => handleConferir(detalhe.itens.filter((i) => i.status === 'pendente').map((i) => i.id))}>
                    ✓ Conferir todos os pendentes
                  </button>
                </div>
              )}
              <div className="table-responsive">
                <table className="monitoramento-table" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      {emConferencia && <th />}
                      <th>Cooperado</th>
                      <th>Matrícula</th>
                      <th>Atividade / Local</th>
                      {COLUNAS_ITEM.map((c) => <th key={c} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{ROTULO_CAMPO[c]}</th>)}
                      <th>Status</th>
                      {emConferencia && <th>Ações</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {detalhe.itens.length === 0 ? (
                      <tr><td colSpan={COLUNAS_ITEM.length + 6} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>Nenhum item na apuração.</td></tr>
                    ) : detalhe.itens.map((it) => {
                      const ajustados = new Map(it.ajustes.map((a) => [a.campo, a]));
                      return (
                        <tr key={it.id}>
                          {emConferencia && (
                            <td><input type="checkbox" checked={marcados.has(it.id)} onChange={() => alternarMarcado(it.id)} disabled={it.status === 'conferido'} /></td>
                          )}
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <strong>{it.cooperado_nome}</strong>
                            {it.avisos?.length > 0 && (
                              <div style={{ fontSize: 11, color: '#b45309', cursor: 'help' }} title={it.avisos.map((a) => a.descricao).join('\n')}>
                                ⚠ {it.avisos.length} aviso(s) da apuração
                              </div>
                            )}
                          </td>
                          <td>{it.matricula ?? '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{it.atividade || '—'}<br /><span style={{ color: '#64748b' }}>{it.local || '—'}</span></td>
                          {COLUNAS_ITEM.map((c) => {
                            const aj = ajustados.get(c as CampoAjustavelFaturamento);
                            return (
                              <td key={c} style={{ textAlign: 'right', whiteSpace: 'nowrap' }} title={aj ? `Apurado: ${fmt(c, Number(it[c]))} · ajuste de ${aj.criado_por_nome ?? '—'}: ${aj.motivo}` : undefined}>
                                {aj ? (
                                  <span className="badge-ajustado" style={{ padding: '1px 6px', borderRadius: 6 }}>
                                    {fmt(c, it.valores_finais[c])}
                                    {emConferencia && (
                                      <button
                                        type="button"
                                        aria-label="Remover ajuste"
                                        style={{ marginLeft: 4, border: 'none', background: 'none', color: '#b45309', cursor: 'pointer', padding: 0 }}
                                        onClick={() => setModal({
                                          titulo: `Remover ajuste de ${ROTULO_CAMPO[c]}`,
                                          descricao: `${it.cooperado_nome}: volta ao valor apurado (${fmt(c, Number(it[c]))}).`,
                                          rotuloTexto: 'Motivo da remoção',
                                          confirmar: async ({ texto }) => { await removerAjusteFaturamento(p.id, aj.id, texto); showToast('Ajuste removido.', 'success'); await recarregar(); },
                                        })}
                                      >✕</button>
                                    )}
                                  </span>
                                ) : fmt(c, it.valores_finais[c])}
                              </td>
                            );
                          })}
                          <td><Badge status={it.status} /></td>
                          {emConferencia && (
                            <td style={{ whiteSpace: 'nowrap' }}>
                              {it.status === 'pendente' && (
                                <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => handleConferir([it.id])}>Conferir</button>
                              )}{' '}
                              <button type="button" className="btn-action-edit" disabled={ocupado} onClick={() => setModal({
                                titulo: `Ajustar item — ${it.cooperado_nome}`,
                                descricao: 'O valor apurado é preservado; o ajuste substitui o valor final e fica registrado no histórico. O item precisará ser conferido novamente.',
                                rotuloTexto: 'Motivo do ajuste',
                                comAjuste: { item: it },
                                confirmar: async ({ texto, campo, valor }) => {
                                  await registrarAjusteFaturamento(p.id, it.id, { campo: campo!, valor: valor!, motivo: texto });
                                  showToast('Ajuste registrado.', 'success');
                                  await recarregar();
                                },
                              })}>Ajustar</button>{' '}
                              <button type="button" className="btn-action-obs" disabled={ocupado} onClick={() => setModal({
                                titulo: `Divergência — ${it.cooperado_nome}`,
                                rotuloTexto: 'Descrição da divergência',
                                confirmar: async ({ texto }) => { await registrarDivergenciaFaturamento(p.id, { itemId: it.id, descricao: texto }); showToast('Divergência registrada.', 'success'); await recarregar(); },
                              })}>Divergência</button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                    {detalhe.itens.length > 0 && (
                      <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                        {emConferencia && <td />}
                        <td colSpan={3}>Total ({detalhe.itens.length})</td>
                        {COLUNAS_ITEM.map((c) => <td key={c} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{fmt(c, detalhe.totais[c])}</td>)}
                        <td colSpan={emConferencia ? 2 : 1} />
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* Divergências */}
          {detalhe.divergencias.length > 0 && (
            <div style={{ padding: '14px 24px' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Divergências</h4>
              <table className="monitoramento-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Cooperado</th><th>Origem</th><th>Descrição</th><th>Status</th><th>Resolução</th>{emConferencia && <th />}</tr>
                </thead>
                <tbody>
                  {detalhe.divergencias.map((d) => (
                    <tr key={d.id}>
                      <td>{d.chave_item ? chaveParaNome.get(d.chave_item) ?? '—' : 'Processo'}</td>
                      <td>{d.origem === 'automatica' ? 'Automática' : `Manual (${d.criado_por_nome ?? '—'})`}</td>
                      <td>{d.descricao}</td>
                      <td><Badge status={d.status === 'aberta' ? 'divergente' : d.status === 'resolvida' ? 'conferido' : 'cancelado'} rotulo={d.status} /></td>
                      <td>{d.resolucao ? <>{d.resolucao}<br /><span style={{ color: '#64748b' }}>{d.resolvido_por_nome}</span></> : '—'}</td>
                      {emConferencia && (
                        <td>
                          {d.status === 'aberta' && (
                            <button type="button" className="btn-action-view" disabled={ocupado} onClick={() => setModal({
                              titulo: 'Encerrar divergência',
                              descricao: d.descricao,
                              rotuloTexto: 'Como foi resolvida / por que foi descartada',
                              comResolucao: true,
                              confirmar: async ({ texto, status }) => { await resolverDivergenciaFaturamento(p.id, d.id, { status: status!, resolucao: texto }); showToast('Divergência encerrada.', 'success'); await recarregar(); },
                            })}>Resolver</button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Responsáveis, comissões, notas fiscais e cobranças */}
          {p.status !== 'cancelado' && <ProcessoComissoesNotas processo={p} />}

          {/* Auditoria */}
          {auditoria && (
            <div style={{ padding: '14px 24px' }}>
              <h4 style={{ margin: '0 0 8px 0' }}>Histórico do processo</h4>
              <table className="monitoramento-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr><th>Data</th><th>Usuário</th><th>Ação</th><th>Item</th><th>Campo</th><th>De</th><th>Para</th><th>Motivo</th></tr>
                </thead>
                <tbody>
                  {auditoria.map((a) => (
                    <tr key={a.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>{new Date(a.criado_em.replace(' ', 'T')).toLocaleString('pt-BR')}</td>
                      <td>{a.usuario_nome ?? '—'}{a.usuario_perfil ? <span style={{ color: '#64748b' }}> ({a.usuario_perfil})</span> : null}</td>
                      <td>{ROTULO_ACAO[a.acao] ?? a.acao}</td>
                      <td>{a.chave_item ? chaveParaNome.get(a.chave_item) ?? a.chave_item : '—'}</td>
                      <td>{a.campo ? ROTULO_CAMPO[a.campo as CampoApuracao] ?? a.campo : '—'}</td>
                      <td style={{ maxWidth: 220, wordBreak: 'break-word' }}>{a.valor_anterior ?? '—'}</td>
                      <td style={{ maxWidth: 220, wordBreak: 'break-word' }}>{a.valor_novo ?? '—'}</td>
                      <td>{a.motivo ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modal && <ModalAcao config={modal} onClose={() => setModal(null)} />}
    </div>
  );
};

export default ProcessoFaturamento;
