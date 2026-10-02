import React, { useState } from 'react';
import { ApontamentoDetalhado, editarApontamentoMonitoramento } from '../../../api/monitoramentoApi';
import { useToast } from '../../../components/ToastContext';

interface Props {
  apontamento: ApontamentoDetalhado;
  onClose: () => void;
  onSuccess: () => void;
}

const TIPOS_EVENTO = [
  { valor: 'jornada_inicio', rotulo: 'Início de Jornada' },
  { valor: 'jornada_fim', rotulo: 'Fim de Jornada' },
  { valor: 'refeicao_inicio', rotulo: 'Início de Refeição' },
  { valor: 'refeicao_fim', rotulo: 'Fim de Refeição' },
  { valor: 'pausa_inicio', rotulo: 'Início de Pausa' },
  { valor: 'pausa_fim', rotulo: 'Fim de Pausa' },
  { valor: 'deslocamento_inicio', rotulo: 'Deslocamento / A Caminho' },
];

export const ModalEdicaoApontamento: React.FC<Props> = ({ apontamento, onClose, onSuccess }) => {
  const { showToast } = useToast();

  const dataOriginalBR = apontamento.data_referencia ? String(apontamento.data_referencia).slice(0, 10) : '';
  const dataHoraDispositivo = apontamento.timestamp_dispositivo ? new Date(apontamento.timestamp_dispositivo) : new Date();

  // Formata hora no formato HH:mm local
  const horaFormatada = !isNaN(dataHoraDispositivo.getTime())
    ? `${String(dataHoraDispositivo.getHours()).padStart(2, '0')}:${String(dataHoraDispositivo.getMinutes()).padStart(2, '0')}`
    : '08:00';

  const [dataReferencia, setDataReferencia] = useState(dataOriginalBR);
  const [horario, setHorario] = useState(horaFormatada);
  const [tipoEvento, setTipoEvento] = useState(apontamento.tipo_evento || 'jornada_inicio');
  const [atividade, setAtividade] = useState(apontamento.atividade || '');
  const [status, setStatus] = useState(apontamento.status || 'ajustado');
  const [motivo, setMotivo] = useState(apontamento.motivo_ajuste || '');
  const [observacaoComplementar, setObservacaoComplementar] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!motivo.trim()) {
      setErro('Informe obrigatoriamente a justificativa/motivo do ajuste.');
      return;
    }

    if (!dataReferencia) {
      setErro('Informe a data de referência.');
      return;
    }

    if (!horario) {
      setErro('Informe o horário do apontamento.');
      return;
    }

    setSalvando(true);
    try {
      // Monta novo ISO timestamp combinando data e horário
      const [ano, mes, dia] = dataReferencia.split('-');
      const [horas, minutos] = horario.split(':');
      const novoTimestampDate = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(horas), Number(minutos), 0);

      const observacaoFinal = observacaoComplementar.trim()
        ? `${motivo.trim()} - ${observacaoComplementar.trim()}`
        : motivo.trim();

      await editarApontamentoMonitoramento(apontamento.id, {
        dataReferencia,
        timestampDispositivo: novoTimestampDate.toISOString(),
        tipoEvento,
        atividade,
        status: status || 'ajustado',
        motivo: motivo.trim(),
        observacao: observacaoFinal,
      });

      showToast('Apontamento ajustado com sucesso e registrado na auditoria!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao ajustar apontamento.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Ajustar Apontamento #{apontamento.id}
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
              O registro original do cooperado será preservado. Esta alteração receberá automaticamente o prefixo <strong>AJUSTE</strong> e registrará seu usuário, data/hora e valores anteriores no log de auditoria.
            </div>

            {erro && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13, fontWeight: 500 }}>
                {erro}
              </div>
            )}

            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div><strong>Cooperado:</strong> {apontamento.candidato_nome || `ID #${apontamento.candidato_id}`}</div>
              {apontamento.empresa_nome && <div><strong>Operação:</strong> {apontamento.empresa_nome}</div>}
              {apontamento.vaga_cargo && <div><strong>Vaga:</strong> {apontamento.vaga_cargo}</div>}
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Data de Referência *</label>
                <input
                  type="date"
                  value={dataReferencia}
                  onChange={(e) => setDataReferencia(e.target.value)}
                  required
                />
              </div>

              <div className="modal-form-group">
                <label>Horário (HH:mm) *</label>
                <input
                  type="time"
                  value={horario}
                  onChange={(e) => setHorario(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Tipo de Evento *</label>
                <select
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  required
                >
                  {TIPOS_EVENTO.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.rotulo}
                    </option>
                  ))}
                </select>
              </div>

              <div className="modal-form-group">
                <label>Status do Apontamento</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  <option value="ajustado">Ajustado</option>
                  <option value="normal">Normal</option>
                  <option value="divergente">Divergente</option>
                  <option value="pendente">Pendente de Conferência</option>
                </select>
              </div>
            </div>

            <div className="modal-form-group">
              <label>Atividade / Posto (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Plantão Diurno - Ala 3"
                value={atividade}
                onChange={(e) => setAtividade(e.target.value)}
              />
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
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>
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
