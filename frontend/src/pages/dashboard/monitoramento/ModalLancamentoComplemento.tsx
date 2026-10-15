import React, { useState } from 'react';
import { dataLocalISO } from '../../../utils/formatters';
import { criarComplementoCooperado, DadosLancamentoComplemento } from '../../../api/monitoramentoApi';
import { useToast } from '../../../components/ToastContext';

interface Props {
  candidatoId: number;
  candidatoNome: string;
  alocacaoId?: number | null;
  tipoPredefinido?: 'hora_adicional' | 'hora_extra' | 'adicional_noturno' | 'desconto' | 'bonificacao';
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalLancamentoComplemento: React.FC<Props> = ({
  candidatoId,
  candidatoNome,
  alocacaoId,
  tipoPredefinido = 'hora_adicional',
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();
  const hoje = dataLocalISO();

  const [tipo, setTipo] = useState<DadosLancamentoComplemento['tipo']>(tipoPredefinido);
  const [dataReferencia, setDataReferencia] = useState(hoje);
  const [quantidadeHoras, setQuantidadeHoras] = useState('01:00');
  const [valor, setValor] = useState('');
  const [motivo, setMotivo] = useState('');
  const [observacao, setObservacao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  // Bonificação (valor em R$) e complementos de horas são fluxos separados:
  // aberto pela aba Bonificações o tipo fica travado; pela aba Horas não
  // permite trocar para bonificação (evita lançamento salvo na aba errada).
  const modoBonificacao = tipoPredefinido === 'bonificacao';

  // Aceita "20,00", "1.234,56" e "20.5"
  const valorNumerico = (() => {
    const v = valor.trim();
    if (!v) return 0;
    const normalizado = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v;
    return Number(normalizado) || 0;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!motivo.trim()) {
      setErro('Informe obrigatoriamente o motivo/justificativa.');
      return;
    }

    if (!dataReferencia) {
      setErro('Informe a data do lançamento.');
      return;
    }

    let mins = 0;
    if (tipo !== 'bonificacao') {
      if (quantidadeHoras.includes(':')) {
        const [h, m] = quantidadeHoras.split(':');
        mins = (Number(h) || 0) * 60 + (Number(m) || 0);
      } else {
        mins = Math.round((Number(quantidadeHoras) || 0) * 60);
      }

      if (mins <= 0) {
        setErro('Informe uma quantidade de horas válida maior que zero.');
        return;
      }
    } else {
      if (valorNumerico <= 0) {
        setErro('Informe o valor da bonificação em R$.');
        return;
      }
    }

    setSalvando(true);
    try {
      await criarComplementoCooperado(candidatoId, {
        alocacaoId: alocacaoId || undefined,
        dataReferencia,
        tipo,
        quantidadeHoras: mins / 60,
        quantidadeMinutos: mins,
        valor: tipo === 'bonificacao' ? valorNumerico : undefined,
        motivo: motivo.trim(),
        observacao: observacao.trim() || undefined,
      });

      showToast('Lançamento complementar registrado com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao registrar lançamento.');
    } finally {
      setSalvando(false);
    }
  };

  const rotuloTipo = {
    hora_adicional: 'Horas Excedentes',
    hora_extra: 'Horas Excedentes',
    adicional_noturno: 'Adicional Noturno',
    desconto: 'Desconto de Horas',
    bonificacao: 'Bonificação (R$)',
  }[tipo];

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 14 14" />
            </svg>
            Lançamento: {rotuloTipo}
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog-body">
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <strong>Cooperado:</strong> {candidatoNome}
            </div>

            {erro && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {erro}
              </div>
            )}

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Tipo de Complemento *</label>
                {modoBonificacao ? (
                  <input type="text" value="Bonificação Financeira (R$)" readOnly disabled />
                ) : (
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    required
                  >
                    <option value="hora_adicional">Horas Excedentes</option>
                    <option value="adicional_noturno">Adicional Noturno</option>
                    <option value="desconto">Desconto de Horas</option>
                  </select>
                )}
              </div>

              <div className="modal-form-group">
                <label>Data de Referência *</label>
                <input
                  type="date"
                  value={dataReferencia}
                  onChange={(e) => setDataReferencia(e.target.value)}
                  required
                />
              </div>
            </div>

            {tipo !== 'bonificacao' ? (
              <div className="modal-form-group">
                <label>Quantidade de Horas (HH:mm ou decimal) *</label>
                <input
                  type="text"
                  placeholder="Ex: 02:30 ou 2.5"
                  value={quantidadeHoras}
                  onChange={(e) => setQuantidadeHoras(e.target.value)}
                  required
                />
              </div>
            ) : (
              <div className="modal-form-group">
                <label>Valor da Bonificação (R$) *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="Ex: 250,00"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="modal-form-group">
              <label>Motivo / Justificativa * (Obrigatório para Auditoria)</label>
              <input
                type="text"
                placeholder="Ex: Cobertura de plantão emergencial"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
              />
            </div>

            <div className="modal-form-group">
              <label>Observação Adicional (Opcional)</label>
              <textarea
                rows={2}
                placeholder="Detalhes operacionais complementares..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
              />
            </div>
          </div>

          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>
              {salvando ? 'Gravando...' : 'Salvar Lançamento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalLancamentoComplemento;
