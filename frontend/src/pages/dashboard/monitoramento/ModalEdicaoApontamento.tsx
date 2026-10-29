import React, { useMemo, useState } from 'react';
import { formatarDataBR, parseDataHoraServidor } from '../../../utils/formatters';
import { ApontamentoDetalhado, editarApontamentoMonitoramento } from '../../../api/monitoramentoApi';
import { useToast } from '../../../components/ToastContext';
import { dataDe, ehAjustado, horaDe, LinhaJornada } from './jornadaApontamentos';

interface Props {
  jornada: LinhaJornada;
  /** Apontamento clicado: o campo dele fica destacado. */
  focoId?: number | null;
  onClose: () => void;
  onSuccess: () => void;
}

// Campo fixo do modal: cada apontamento que o cooperado bate no App (ou falta dele)
interface Campo { chave: string; rotulo: string; ap: ApontamentoDetalhado | null }
interface Valor { data: string; hora: string }

function montarCampos(j: LinhaJornada): Campo[] {
  const campos: Campo[] = [
    { chave: 'deslocamento', rotulo: 'Deslocamento ao Posto', ap: j.deslocamento },
    { chave: 'entrada', rotulo: 'Início de Jornada', ap: j.entrada },
  ];
  const intervalos = (lista: LinhaJornada['refeicoes'], nome: string, chave: string) => {
    const itens = lista.length ? lista : [{ ini: null, fim: null }];
    itens.forEach((i, k) => {
      const n = itens.length > 1 ? ` (${k + 1}ª)` : '';
      campos.push({ chave: `${chave}-ini-${k}`, rotulo: `Início de ${nome}${n}`, ap: i.ini });
      campos.push({ chave: `${chave}-fim-${k}`, rotulo: `Fim de ${nome}${n}`, ap: i.fim });
    });
  };
  intervalos(j.refeicoes, 'Refeição', 'refeicao');
  intervalos(j.pausas, 'Pausa', 'pausa');
  campos.push({ chave: 'saida', rotulo: 'Fim de Jornada', ap: j.saida });
  return campos;
}

const valorDe = (ap: ApontamentoDetalhado): Valor => ({ data: dataDe(ap), hora: horaDe(ap) });
const msValor = (v: Valor) => new Date(`${v.data}T${v.hora}:00`).getTime();

export const ModalEdicaoApontamento: React.FC<Props> = ({ jornada, focoId, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const campos = useMemo(() => montarCampos(jornada), [jornada]);
  const ref = jornada.referencia;

  const originais = useMemo(() => {
    const m: Record<number, Valor> = {};
    for (const c of campos) if (c.ap) m[c.ap.id] = valorDe(c.ap);
    return m;
  }, [campos]);
  const [valores, setValores] = useState<Record<number, Valor>>(originais);
  const [status, setStatus] = useState('ajustado');
  const [motivo, setMotivo] = useState('');
  const [observacaoComplementar, setObservacaoComplementar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const alterado = (id: number) => valores[id].data !== originais[id].data || valores[id].hora !== originais[id].hora;
  const alterados = campos.filter((c) => c.ap && alterado(c.ap.id)).map((c) => c.ap!);
  const mudar = (id: number, campo: keyof Valor, v: string) => setValores((s) => ({ ...s, [id]: { ...s[id], [campo]: v } }));

  /** A sequência precisa continuar coerente: deslocamento → entrada → intervalos → saída, e cada início antes do fim. */
  const validarOrdem = (): string => {
    const ms = (ap: ApontamentoDetalhado | null) => (ap ? msValor(valores[ap.id]) : null);
    const entrada = ms(jornada.entrada);
    const saida = ms(jornada.saida);
    const desloc = ms(jornada.deslocamento);
    if (desloc !== null && entrada !== null && desloc > entrada) return 'O deslocamento deve ser antes do início da jornada.';
    if (entrada !== null && saida !== null && entrada >= saida) return 'O fim da jornada deve ser depois do início.';
    for (const [lista, nome] of [[jornada.refeicoes, 'refeição'], [jornada.pausas, 'pausa']] as const) {
      for (const i of lista) {
        const a = ms(i.ini);
        const b = ms(i.fim);
        if (a !== null && b !== null && a > b) return `O fim da ${nome} deve ser depois do início.`;
        for (const t of [a, b]) {
          if (t === null) continue;
          if (entrada !== null && t < entrada) return `A ${nome} deve ficar depois do início da jornada.`;
          if (saida !== null && t > saida) return `A ${nome} deve ficar antes do fim da jornada.`;
        }
      }
    }
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (alterados.length === 0) {
      setErro('Nenhum horário foi alterado.');
      return;
    }
    if (alterados.some((ap) => !valores[ap.id].data || !valores[ap.id].hora)) {
      setErro('Informe data e horário de todos os apontamentos alterados.');
      return;
    }
    if (!motivo.trim()) {
      setErro('Informe obrigatoriamente a justificativa/motivo do ajuste.');
      return;
    }
    const erroOrdem = validarOrdem();
    if (erroOrdem) {
      setErro(erroOrdem);
      return;
    }

    setSalvando(true);
    const observacaoFinal = observacaoComplementar.trim()
      ? `${motivo.trim()} - ${observacaoComplementar.trim()}`
      : motivo.trim();
    const rotuloDe = (ap: ApontamentoDetalhado) => campos.find((c) => c.ap?.id === ap.id)?.rotulo ?? `#${ap.id}`;
    const gravados: string[] = [];
    try {
      // Um ajuste por apontamento alterado: cada um fica com seu próprio registro de auditoria
      for (const ap of alterados) {
        const v = valores[ap.id];
        await editarApontamentoMonitoramento(ap.id, {
          // A data de referência só muda quando a data da batida muda
          ...(v.data !== originais[ap.id].data ? { dataReferencia: v.data } : {}),
          timestampDispositivo: `${v.data} ${v.hora}:00`,
          status: status || 'ajustado',
          motivo: motivo.trim(),
          observacao: observacaoFinal,
        });
        gravados.push(rotuloDe(ap));
      }
      showToast(
        gravados.length === 1
          ? `${gravados[0]} ajustado e registrado na auditoria!`
          : `${gravados.length} apontamentos ajustados e registrados na auditoria!`,
        'success',
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      const pendentes = alterados.slice(gravados.length).map(rotuloDe).join(', ');
      setErro(`${gravados.length ? `Gravado: ${gravados.join(', ')}. ` : ''}Não gravado: ${pendentes}. ${err.message || 'Erro ao ajustar apontamento.'}`);
      if (gravados.length) onSuccess();
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Ajustar Apontamentos da Jornada
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog-body">
            <div className="modal-alert-box">
              <strong>Regra de Auditoria e Supervisão:</strong>
              <br />
              O registro original do cooperado será preservado. Só os horários que você alterar são gravados, cada um com o prefixo <strong>AJUSTE</strong>, seu usuário, data/hora e valores anteriores no log de auditoria.
            </div>

            {erro && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                {erro}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div><strong>Cooperado:</strong> {ref.candidato_nome || `ID #${ref.candidato_id}`}</div>
              {ref.empresa_nome && <div><strong>Operação:</strong> {ref.empresa_nome}</div>}
              {ref.vaga_cargo && <div><strong>Vaga:</strong> {ref.vaga_cargo}</div>}
              <div><strong>Jornada de:</strong> {formatarDataBR(jornada.data)}</div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
              {campos.map((c, idx) => {
                const ap = c.ap;
                const mudou = ap ? alterado(ap.id) : false;
                const foco = ap && ap.id === focoId;
                const tsOriginal = ap?.timestamp_original ? parseDataHoraServidor(ap.timestamp_original) : null;
                return (
                  <div key={c.chave} style={{
                    display: 'grid', gridTemplateColumns: 'minmax(150px, 1.3fr) 1fr 0.8fr', gap: 10, alignItems: 'center',
                    padding: '8px 12px', borderTop: idx ? '1px solid #f1f5f9' : 'none',
                    background: mudou ? '#fffbeb' : foco ? '#f0fdf4' : '#fff',
                  }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13, color: '#0f172a' }}>{c.rotulo}</div>
                      {ap ? (
                        <div style={{ fontSize: 11.5, color: '#64748b' }}>
                          {mudou
                            ? `Atual: ${formatarDataBR(originais[ap.id].data).slice(0, 5)} ${originais[ap.id].hora}`
                            : ehAjustado(ap) ? `Ajustado${ap.ajustado_por_nome ? ` por ${ap.ajustado_por_nome}` : ''}` : 'Registro do App'}
                          {tsOriginal && !isNaN(tsOriginal.getTime()) && ehAjustado(ap) && (
                            <> · App: {tsOriginal.toLocaleDateString('pt-BR').slice(0, 5)} {tsOriginal.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize: 11.5, color: '#94a3b8' }}>Não registrado pelo cooperado</div>
                      )}
                    </div>
                    {ap ? (
                      <>
                        <input type="date" value={valores[ap.id].data} onChange={(e) => mudar(ap.id, 'data', e.target.value)}
                          style={{ padding: '7px 8px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 13 }} />
                        <input type="time" value={valores[ap.id].hora} onChange={(e) => mudar(ap.id, 'hora', e.target.value)} autoFocus={!!foco}
                          style={{ padding: '7px 8px', border: `1px solid ${mudou ? '#f59e0b' : '#cbd5e1'}`, borderRadius: 6, fontSize: 13, fontWeight: 700 }} />
                      </>
                    ) : (
                      <div style={{ gridColumn: 'span 2', color: '#cbd5e1', textAlign: 'center' }}>—</div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Status do Apontamento</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                  <option value="ajustado">Ajustado</option>
                  <option value="normal">Normal</option>
                  <option value="divergente">Divergente</option>
                  <option value="pendente">Pendente de Conferência</option>
                </select>
              </div>
              <div className="modal-form-group">
                <label>Alterações</label>
                <div style={{ padding: '9px 0', fontSize: 13, color: alterados.length ? '#92400e' : '#64748b', fontWeight: 600 }}>
                  {alterados.length ? `${alterados.length} horário(s) alterado(s)` : 'Nenhum horário alterado'}
                </div>
              </div>
            </div>

            <div className="modal-form-group">
              <label>Motivo / Justificativa do Ajuste * (Obrigatório)</label>
              <input
                type="text"
                placeholder="Ex: Horário corrigido conforme conferência da Supervisão"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
              />
            </div>

            <div className="modal-form-group">
              <label>Observação Complementar (Opcional)</label>
              <textarea
                rows={2}
                placeholder="Detalhes adicionais sobre o ajuste operacional..."
                value={observacaoComplementar}
                onChange={(e) => setObservacaoComplementar(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando || alterados.length === 0}>
              {salvando ? (
                <>Gravando Ajuste...</>
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Confirmar e Salvar Ajuste
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalEdicaoApontamento;
