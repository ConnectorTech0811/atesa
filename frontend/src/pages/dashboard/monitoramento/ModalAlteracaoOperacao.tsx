import React, { useEffect, useState } from 'react';
import {
  alterarOperacaoCooperado,
  listarVagasDisponiveis,
  VagaDisponivel,
  CooperadoAlocacao,
} from '../../../api/monitoramentoApi';
import { useToast } from '../../../components/ToastContext';

interface Props {
  candidatoId: number;
  candidatoNome: string;
  alocacaoAtual?: CooperadoAlocacao | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalAlteracaoOperacao: React.FC<Props> = ({
  candidatoId,
  candidatoNome,
  alocacaoAtual,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [vagas, setVagas] = useState<VagaDisponivel[]>([]);
  const [carregandoVagas, setCarregandoVagas] = useState(true);

  const [novaVagaId, setNovaVagaId] = useState<number | ''>(alocacaoAtual?.vagaId || '');
  const [novoTurno, setNovoTurno] = useState(alocacaoAtual?.vagaEscala || '');
  const [novaAtividade, setNovaAtividade] = useState(alocacaoAtual?.vagaCargo || '');
  const [motivo, setMotivo] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    async function carregar() {
      try {
        const lista = await listarVagasDisponiveis();
        setVagas(lista);
      } catch (e: any) {
        console.error('Erro ao listar vagas disponíveis', e);
      } finally {
        setCarregandoVagas(false);
      }
    }
    carregar();
  }, []);

  const handleVagaChange = (vagaIdStr: string) => {
    const id = vagaIdStr ? Number(vagaIdStr) : '';
    setNovaVagaId(id);
    if (id) {
      const vagaEncontrada = vagas.find((v) => v.vaga_id === id);
      if (vagaEncontrada) {
        setNovaAtividade(vagaEncontrada.vaga_cargo);
        if (vagaEncontrada.tipo_escala) {
          setNovoTurno(vagaEncontrada.tipo_escala);
        }
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!motivo.trim()) {
      setErro('Informe obrigatoriamente a justificativa para a alteração da operação.');
      return;
    }

    setSalvando(true);
    try {
      await alterarOperacaoCooperado(candidatoId, {
        novaVagaId: novaVagaId ? Number(novaVagaId) : undefined,
        novaAtividade: novaAtividade.trim() || undefined,
        novoTurno: novoTurno.trim() || undefined,
        motivo: motivo.trim(),
      });

      showToast('Operação e alocação do cooperado atualizadas com sucesso!', 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao alterar operação do cooperado.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
            Alterar Operação Vigente / Vaga
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-dialog-body">
            <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>
              <div><strong>Cooperado:</strong> {candidatoNome}</div>
              <div style={{ marginTop: 4, color: '#475569' }}>
                <strong>Vaga Atual:</strong> {alocacaoAtual?.vagaCargo || 'Não alocado'} • <strong>Turno:</strong> {alocacaoAtual?.vagaEscala || '—'}
              </div>
            </div>

            {erro && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {erro}
              </div>
            )}

            <div className="modal-form-group">
              <label>Nova Vaga / Posto de Trabalho</label>
              <select
                value={novaVagaId}
                onChange={(e) => handleVagaChange(e.target.value)}
                disabled={carregandoVagas}
              >
                <option value="">-- Selecione uma nova vaga cadastrada --</option>
                {vagas.map((v) => (
                  <option key={v.vaga_id} value={v.vaga_id}>
                    {v.vaga_cargo} — {v.empresa_nome} {v.nome_unidade ? `(${v.nome_unidade})` : ''} [{v.tipo_escala || 'Normal'}]
                  </option>
                ))}
              </select>
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Novo Turno / Escala</label>
                <input
                  type="text"
                  placeholder="Ex: 08:00 às 17:00 ou 12x36"
                  value={novoTurno}
                  onChange={(e) => setNovoTurno(e.target.value)}
                />
              </div>

              <div className="modal-form-group">
                <label>Nova Atividade / Função</label>
                <input
                  type="text"
                  placeholder="Ex: Atendimento Clínico"
                  value={novaAtividade}
                  onChange={(e) => setNovaAtividade(e.target.value)}
                />
              </div>
            </div>

            <div className="modal-form-group">
              <label>Motivo da Alteração * (Obrigatório para Auditoria & Timeline)</label>
              <textarea
                rows={3}
                placeholder="Informe o motivo da troca de vaga, turno ou atividade..."
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>
              Cancelar
            </button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>
              {salvando ? 'Atualizando...' : 'Confirmar Alteração'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalAlteracaoOperacao;
