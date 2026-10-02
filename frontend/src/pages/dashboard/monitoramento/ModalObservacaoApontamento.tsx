import React, { useState } from 'react';
import { ApontamentoDetalhado, adicionarObservacaoApontamento } from '../../../api/monitoramentoApi';
import { useToast } from '../../../components/ToastContext';

interface Props {
  apontamento: ApontamentoDetalhado;
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalObservacaoApontamento: React.FC<Props> = ({ apontamento, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const [observacao, setObservacao] = useState(apontamento.observacao_ajuste || apontamento.observacao || '');
  const [motivo, setMotivo] = useState('');
  const [ehAjuste, setEhAjuste] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!observacao.trim()) {
      setErro('Digite o texto da observação.');
      return;
    }

    setSalvando(true);
    setErro('');
    try {
      await adicionarObservacaoApontamento(apontamento.id, {
        observacao: observacao.trim(),
        motivo: motivo.trim() || undefined,
        ehAjuste,
      });
      showToast('Observação adicionada com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao salvar observação.');
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
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            Observação no Apontamento #{apontamento.id}
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog-body">
            {apontamento.observacao_original && (
              <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
                <strong style={{ color: '#475569' }}>Observação Original do Cooperado:</strong>
                <p style={{ margin: '4px 0 0 0', fontStyle: 'italic', color: '#334155' }}>"{apontamento.observacao_original}"</p>
              </div>
            )}

            {erro && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {erro}
              </div>
            )}

            <div className="modal-form-group">
              <label>Texto da Observação da Supervisão *</label>
              <textarea
                rows={3}
                placeholder="Insira a observação ou parecer sobre este apontamento..."
                value={observacao}
                onChange={(e) => setObservacao(e.target.value)}
                required
              />
            </div>

            <div className="modal-form-group">
              <label>Motivo / Justificativa (Opcional)</label>
              <input
                type="text"
                placeholder="Ex: Alinhamento com o tomador de serviço"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <input
                type="checkbox"
                id="checkAjuste"
                checked={ehAjuste}
                onChange={(e) => setEhAjuste(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              <label htmlFor="checkAjuste" style={{ fontSize: 13, color: '#475569', cursor: 'pointer' }}>
                Marcar como <strong>AJUSTE</strong> de conferência operacional
              </label>
            </div>
          </div>

          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar Observação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalObservacaoApontamento;
