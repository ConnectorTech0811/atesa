import React, { useEffect, useState } from 'react';
import {
  ApontamentoDetalhado,
  ObservacaoApontamento,
  adicionarObservacaoApontamento,
  excluirObservacaoApontamento,
  listarObservacoesApontamento,
} from '../../../api/monitoramentoApi';
import { TIPOS_USUARIO } from '../../../api/usuariosApi';
import { useAuth } from '../../../auth/AuthContext';
import { useToast } from '../../../components/ToastContext';
import { parseDataHoraServidor } from '../../../utils/formatters';

const rotuloPerfil = (perfil: string) => TIPOS_USUARIO.find((t) => t.valor === perfil)?.rotulo.replace(/ \(.*\)$/, '') ?? perfil;

interface Props {
  apontamento: ApontamentoDetalhado;
  onClose: () => void;
  onSuccess: () => void;
}

export const ModalObservacaoApontamento: React.FC<Props> = ({ apontamento, onClose, onSuccess }) => {
  const { showToast } = useToast();
  const { usuario } = useAuth();
  const ehAdmin = usuario?.perfil === 'administrador';
  // Cada observação é um registro novo do histórico: o campo começa vazio
  const [observacao, setObservacao] = useState('');
  const [historico, setHistorico] = useState<ObservacaoApontamento[]>([]);
  const [carregandoHistorico, setCarregandoHistorico] = useState(true);
  const [excluindoId, setExcluindoId] = useState<number | null>(null);

  const carregarHistorico = () => {
    setCarregandoHistorico(true);
    listarObservacoesApontamento(apontamento.id)
      .then(setHistorico)
      .catch((err) => setErro(err?.message || 'Erro ao carregar o histórico de observações.'))
      .finally(() => setCarregandoHistorico(false));
  };
  useEffect(carregarHistorico, [apontamento.id]);

  const handleExcluir = async (obs: ObservacaoApontamento) => {
    if (!window.confirm(`Excluir a observação de ${obs.usuario_nome}? A exclusão fica registrada nos Logs de Auditoria.`)) return;
    setExcluindoId(obs.id);
    try {
      await excluirObservacaoApontamento(apontamento.id, obs.id);
      showToast('Observação excluída.', 'success');
      carregarHistorico();
      onSuccess();
    } catch (err: any) {
      setErro(err?.message || 'Erro ao excluir observação.');
    } finally {
      setExcluindoId(null);
    }
  };
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
      showToast('Observação adicionada ao histórico.', 'success');
      setObservacao('');
      setMotivo('');
      setEhAjuste(false);
      carregarHistorico();
      onSuccess();
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

            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#475569', textTransform: 'uppercase', marginBottom: 6 }}>
                Histórico de observações {historico.length > 0 && `(${historico.length})`}
              </div>
              {carregandoHistorico ? (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Carregando...</div>
              ) : historico.length === 0 ? (
                <div style={{ fontSize: 13, color: '#94a3b8' }}>Nenhuma observação registrada.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 260, overflowY: 'auto' }}>
                  {historico.map((o) => {
                    const dt = parseDataHoraServidor(o.criado_em);
                    return (
                      <div key={o.id} style={{ border: '1px solid #e2e8f0', borderLeft: `3px solid ${o.eh_ajuste ? '#f59e0b' : '#4a9e4f'}`, borderRadius: 8, padding: '8px 10px', background: '#f8fafc' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                          <div style={{ fontSize: 12, color: '#64748b' }}>
                            <strong style={{ color: '#0f172a' }}>{o.usuario_nome}</strong> · {rotuloPerfil(o.usuario_perfil)}
                            <span> · {dt.toLocaleDateString('pt-BR')} às {dt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          {ehAdmin && (
                            <button type="button" onClick={() => handleExcluir(o)} disabled={excluindoId === o.id}
                              title="Excluir observação (somente Administrador)"
                              style={{ border: 'none', background: 'transparent', color: '#b91c1c', cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: 0 }}>
                              {excluindoId === o.id ? 'Excluindo...' : 'Excluir'}
                            </button>
                          )}
                        </div>
                        <div style={{ fontSize: 13, color: '#0f172a', marginTop: 4, whiteSpace: 'pre-wrap' }}>
                          {o.eh_ajuste ? <span className="obs-ajuste-tag">AJUSTE</span> : null}
                          {o.texto.replace(/^AJUSTE\s*-\s*/i, '')}
                        </div>
                        {o.motivo && <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Motivo: {o.motivo}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="modal-form-group">
              <label>Nova Observação da Supervisão *</label>
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
              Fechar
            </button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Adicionar Observação'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalObservacaoApontamento;
