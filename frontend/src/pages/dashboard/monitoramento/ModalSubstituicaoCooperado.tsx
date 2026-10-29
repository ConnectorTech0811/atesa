import React, { useEffect, useMemo, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataBR } from '../../../utils/formatters';
import {
  MotivoSubstituicao,
  OpcoesEscala,
  OrigemSubstituicao,
  PeriodoSubstituicao,
  PreviaSubstituicao,
  obterOpcoesEscala,
  obterPreviaSubstituicao,
  substituirCooperado,
} from '../../../api/escalaFaturamentoApi';

interface Props {
  /** Plantão clicado em Escalas ou o cooperado aberto no Monitoramento (alocação ativa). */
  origem: { escalaId: number } | { candidatoId: number; alocacaoId?: number | null };
  titularNome: string;
  /** Plantão clicado (Escalas): data e horário exibidos no resumo. */
  plantaoTexto?: string;
  /** Lista de cooperados já carregada (Escalas); sem ela, o modal busca. */
  opcoes?: OpcoesEscala | null;
  /** Ação extra no rodapé (Monitoramento: transferir o cooperado para outra vaga). */
  acaoExtra?: React.ReactNode;
  onClose: () => void;
  onSuccess: () => void;
}

const PERIODOS: { valor: PeriodoSubstituicao; rotulo: string }[] = [
  { valor: '1d', rotulo: '1 dia' },
  { valor: '7d', rotulo: '7 dias' },
  { valor: '15d', rotulo: '15 dias' },
  { valor: '1m', rotulo: '1 mês' },
  { valor: 'personalizado', rotulo: 'Outro período' },
  { valor: 'definitiva', rotulo: 'Assumir a vaga (definitivo)' },
];

const MOTIVOS: { valor: MotivoSubstituicao; rotulo: string }[] = [
  { valor: 'falta', rotulo: 'Falta' },
  { valor: 'imprevisto', rotulo: 'Imprevisto' },
  { valor: 'atestado', rotulo: 'Atestado / afastamento' },
  { valor: 'ferias', rotulo: 'Férias' },
  { valor: 'desligamento', rotulo: 'Desligamento' },
  { valor: 'outro', rotulo: 'Outro' },
];

const MAX_PLANTOES_LISTADOS = 8;

export const ModalSubstituicaoCooperado: React.FC<Props> = ({ origem, titularNome, plantaoTexto, opcoes: opcoesProp, acaoExtra, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const doMonitoramento = 'candidatoId' in origem;
  const titularId = doMonitoramento ? origem.candidatoId : null;

  const [opcoes, setOpcoes] = useState<OpcoesEscala | null>(opcoesProp ?? null);
  const [dataInicio, setDataInicio] = useState(dataLocalISO());
  const [periodo, setPeriodo] = useState<PeriodoSubstituicao>('1d');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [substitutoId, setSubstitutoId] = useState<number | ''>('');
  const [motivoTipo, setMotivoTipo] = useState<MotivoSubstituicao>('falta');
  const [motivo, setMotivo] = useState('');
  const [encerrarAtual, setEncerrarAtual] = useState(true);
  const [previa, setPrevia] = useState<PreviaSubstituicao | null>(null);
  const [erroPrevia, setErroPrevia] = useState('');
  const [carregandoPrevia, setCarregandoPrevia] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (opcoes) return;
    obterOpcoesEscala().then(setOpcoes).catch((e) => setErro(e?.message || 'Erro ao carregar os cooperados.'));
  }, []);

  const origemApi: OrigemSubstituicao = doMonitoramento
    ? { candidatoId: origem.candidatoId, alocacaoId: origem.alocacaoId ?? null, dataInicio }
    : { escalaId: origem.escalaId };

  // Prévia: posto e plantões do titular que passam para o substituto no período
  useEffect(() => {
    if (periodo === 'personalizado' && !dataFim) { setPrevia(null); setErroPrevia(''); return; }
    let ativo = true;
    setCarregandoPrevia(true);
    const t = setTimeout(() => {
      obterPreviaSubstituicao(origemApi, { periodo, dataFim: periodo === 'personalizado' ? dataFim : undefined })
        .then((p) => {
          if (!ativo) return;
          setPrevia(p);
          setErroPrevia('');
        })
        .catch((e) => { if (ativo) { setPrevia(null); setErroPrevia(e?.message || 'Erro ao carregar os plantões.'); } })
        .finally(() => { if (ativo) setCarregandoPrevia(false); });
    }, 250);
    return () => { ativo = false; clearTimeout(t); };
  }, [periodo, dataFim, dataInicio]);

  const idTitular = previa?.titularId ?? titularId;
  const cooperadosFiltrados = useMemo(() => {
    const lista = (opcoes?.cooperados ?? []).filter((c) => c.id !== idTitular);
    const b = busca.trim().toLowerCase();
    return (b ? lista.filter((c) => c.nome.toLowerCase().includes(b) || String(c.matricula || '').toLowerCase().includes(b)) : lista).slice(0, 60);
  }, [opcoes, busca, idTitular]);

  const substituto = opcoes?.cooperados.find((c) => c.id === substitutoId);
  const alocacoesSubstituto = (opcoes?.alocacoes ?? []).filter((a) => a.candidato_id === substitutoId && a.status === 'ativa');
  const jaNaVaga = !!previa?.vagaId && alocacoesSubstituto.some((a) => a.vaga_id === previa.vagaId);
  const outrasAlocacoes = alocacoesSubstituto.filter((a) => !previa?.vagaId || a.vaga_id !== previa.vagaId);
  const definitiva = periodo === 'definitiva';
  const descreverAlocacao = (a: OpcoesEscala['alocacoes'][number]) => [a.cargo, a.nome_unidade, a.nome_empresa].filter(Boolean).join(' · ');

  const mudarPeriodo = (p: PeriodoSubstituicao) => {
    setPeriodo(p);
    // "Outro período" começa com o fim do período que estava escolhido
    setDataFim(p === 'personalizado' ? (previa?.dataFim ?? previa?.dataInicio ?? '') : '');
  };

  const confirmar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!substitutoId) { setErro('Selecione o cooperado que vai cobrir.'); return; }
    if (periodo === 'personalizado' && !dataFim) { setErro('Informe a data final da cobertura.'); return; }
    if (!motivo.trim()) { setErro('Informe obrigatoriamente a justificativa da substituição.'); return; }
    if (erroPrevia) { setErro(erroPrevia); return; }
    if (definitiva && !window.confirm(
      `${substituto?.nome} vai assumir a vaga de ${titularNome} em definitivo a partir de ${formatarDataBR(previa?.dataInicio ?? dataInicio)}.\n`
      + 'A alocação do titular neste posto será encerrada. Confirmar?',
    )) return;

    setSalvando(true);
    try {
      const r = await substituirCooperado(origemApi, {
        substitutoId: Number(substitutoId),
        periodo,
        dataFim: periodo === 'personalizado' ? dataFim : undefined,
        motivoTipo,
        motivo: motivo.trim(),
        encerrarAlocacaoAtualSubstituto: definitiva && !jaNaVaga && outrasAlocacoes.length > 0 ? encerrarAtual : undefined,
      });
      showToast(
        r.tipo === 'definitiva'
          ? `${substituto?.nome} assumiu a vaga${r.plantoes ? ` e ${r.plantoes} plantão(ões)` : ''}.`
          : `Cobertura registrada: ${r.plantoes} plantão(ões) passaram para ${substituto?.nome}.`,
        'success',
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      setErro(err?.message || 'Erro ao registrar a substituição.');
    } finally {
      setSalvando(false);
    }
  };

  const plantoes = previa?.plantoes ?? [];
  const periodoTexto = previa
    ? definitiva
      ? `a partir de ${formatarDataBR(previa.dataInicio)}`
      : previa.dataFim === previa.dataInicio
        ? `em ${formatarDataBR(previa.dataInicio)}`
        : `de ${formatarDataBR(previa.dataInicio)} a ${formatarDataBR(previa.dataFim!)}`
    : '';

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
            Substituir Cooperado / Cobertura
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>

        <form onSubmit={confirmar}>
          <div className="modal-dialog-body">
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, display: 'grid', gap: 3 }}>
              <div><strong>Sai do posto:</strong> {titularNome}</div>
              <div><strong>Posto / Vaga:</strong> {previa?.posto ?? (carregandoPrevia ? 'Carregando...' : '—')}</div>
              {plantaoTexto && <div><strong>Plantão:</strong> {plantaoTexto}</div>}
            </div>

            {erro && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>{erro}</div>
            )}

            <div className="modal-form-group">
              <label>Cooperado que vai cobrir *</label>
              <input type="text" placeholder="Buscar por nome ou matrícula..." value={busca} onChange={(e) => setBusca(e.target.value)} />
              <select size={5} value={substitutoId} onChange={(e) => setSubstitutoId(Number(e.target.value))} style={{ padding: 4 }}>
                {!opcoes && <option disabled>Carregando...</option>}
                {opcoes && cooperadosFiltrados.length === 0 && <option disabled>Nenhum cooperado encontrado.</option>}
                {cooperadosFiltrados.map((c) => (
                  <option key={c.id} value={c.id}>{c.nome} — Mat. {c.matricula}</option>
                ))}
              </select>
              {substituto && (
                <div style={{ fontSize: 12.5, color: '#475569' }}>
                  <strong>{substituto.nome}</strong>
                  {alocacoesSubstituto.length
                    ? <> · alocado hoje em {alocacoesSubstituto.map(descreverAlocacao).join('; ')}</>
                    : ' · sem alocação ativa'}
                </div>
              )}
            </div>

            <div className="modal-form-group">
              <label>Período da cobertura *</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {PERIODOS.map((p) => (
                  <button key={p.valor} type="button" onClick={() => mudarPeriodo(p.valor)}
                    style={{
                      padding: '7px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      border: `1px solid ${periodo === p.valor ? (p.valor === 'definitiva' ? '#b45309' : '#4a9e4f') : '#cbd5e1'}`,
                      background: periodo === p.valor ? (p.valor === 'definitiva' ? '#fffbeb' : '#f0fdf4') : '#fff',
                      color: periodo === p.valor ? (p.valor === 'definitiva' ? '#92400e' : '#166534') : '#334155',
                    }}>
                    {p.rotulo}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>{doMonitoramento ? 'Início *' : 'Início'}</label>
                {doMonitoramento
                  ? <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} required />
                  : <input type="date" value={previa?.dataInicio ?? ''} disabled />}
              </div>
              <div className="modal-form-group">
                <label>Fim {periodo === 'personalizado' ? '*' : ''}</label>
                {definitiva
                  ? <input type="text" value="Sem data final (contrato)" disabled />
                  : <input type="date" value={periodo === 'personalizado' ? dataFim : previa?.dataFim ?? ''} min={previa?.dataInicio ?? dataInicio}
                      disabled={periodo !== 'personalizado'} onChange={(e) => setDataFim(e.target.value)} />}
              </div>
            </div>

            {/* Prévia dos plantões que passam para o substituto */}
            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, padding: 12, fontSize: 13, background: '#fff' }}>
              {erroPrevia ? (
                <div style={{ color: '#991b1b' }}>{erroPrevia}</div>
              ) : carregandoPrevia && !previa ? (
                <div style={{ color: '#64748b' }}>Carregando plantões...</div>
              ) : periodo === 'personalizado' && !dataFim ? (
                <div style={{ color: '#64748b' }}>Informe a data final para ver os plantões.</div>
              ) : previa && (
                <>
                  <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: 6 }}>
                    {plantoes.length
                      ? `${plantoes.length} plantão(ões) previsto(s) de ${titularNome} ${periodoTexto} passam para ${substituto?.nome ?? 'o substituto'}`
                      : `Nenhum plantão previsto de ${titularNome} neste posto ${periodoTexto}.`}
                  </div>
                  {plantoes.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {plantoes.slice(0, MAX_PLANTOES_LISTADOS).map((p) => (
                        <span key={p.id} style={{ background: '#f1f5f9', borderRadius: 6, padding: '3px 8px', fontSize: 12 }}>
                          {formatarDataBR(p.data).slice(0, 5)} · {p.hora_inicio}–{p.hora_fim}
                        </span>
                      ))}
                      {plantoes.length > MAX_PLANTOES_LISTADOS && <span style={{ fontSize: 12, color: '#64748b', alignSelf: 'center' }}>+ {plantoes.length - MAX_PLANTOES_LISTADOS}</span>}
                    </div>
                  )}
                  <div style={{ marginTop: 8, fontSize: 12, color: '#64748b' }}>
                    {definitiva
                      ? 'A alocação do titular neste posto é encerrada no dia anterior ao início e o substituto passa a ser alocado na vaga.'
                      : 'Os plantões do titular ficam como Cancelados (com o nome de quem cobriu) e são lançados iguais para o substituto. A alocação de cada um não muda.'}
                  </div>
                </>
              )}
            </div>

            {definitiva && substituto && !jaNaVaga && outrasAlocacoes.length > 0 && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#334155', cursor: 'pointer' }}>
                <input type="checkbox" checked={encerrarAtual} onChange={(e) => setEncerrarAtual(e.target.checked)} style={{ marginTop: 2 }} />
                <span>Encerrar a alocação atual de <strong>{substituto.nome}</strong> ({outrasAlocacoes.map(descreverAlocacao).join('; ')}) — ele deixa o posto atual para assumir esta vaga.</span>
              </label>
            )}

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Motivo *</label>
                <select value={motivoTipo} onChange={(e) => setMotivoTipo(e.target.value as MotivoSubstituicao)}>
                  {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
                </select>
              </div>
              <div className="modal-form-group">
                <label>Justificativa * (Auditoria)</label>
                <input type="text" placeholder="Ex: Cooperado avisou que não comparecerá" value={motivo} onChange={(e) => setMotivo(e.target.value)} required />
              </div>
            </div>
          </div>

          <div className="modal-dialog-footer" style={{ justifyContent: acaoExtra ? 'space-between' : undefined }}>
            {acaoExtra && <div>{acaoExtra}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>Cancelar</button>
              <button type="submit" className="btn-save-ajuste" disabled={salvando || !!erroPrevia || carregandoPrevia}>
                {salvando ? 'Registrando...' : definitiva ? 'Confirmar Substituição' : 'Confirmar Cobertura'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalSubstituicaoCooperado;
