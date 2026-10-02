import React, { useState } from 'react';
import { solicitarResetSenhaCooperado, confirmarResetSenhaCooperado } from '../../../api/monitoramentoApi';
import { useToast } from '../../../components/ToastContext';

interface Props {
  candidatoId: number;
  candidatoNome: string;
  candidatoEmail?: string | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ModalResetSenhaCooperado: React.FC<Props> = ({
  candidatoId,
  candidatoNome,
  candidatoEmail,
  onClose,
  onSuccess,
}) => {
  const { showToast } = useToast();

  const [etapa, setEtapa] = useState<'solicitar' | 'confirmar'>('solicitar');
  const [solicitando, setSolicitando] = useState(false);
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const [codigo, setCodigo] = useState('');
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleSolicitar = async () => {
    setSolicitando(true);
    setErro('');
    try {
      const res = await solicitarResetSenhaCooperado(candidatoId);
      setMensagemSucesso(res.mensagem || 'Código de verificação enviado com sucesso para o e-mail cadastrado.');
      showToast('Código temporário gerado e enviado!', 'success');
      setEtapa('confirmar');
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao gerar solicitação de reset.');
    } finally {
      setSolicitando(false);
    }
  };

  const handleConfirmarRedefinicao = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');

    if (!codigo.trim() || codigo.trim().length !== 6) {
      setErro('Informe o código de 6 dígitos enviado ao cooperado.');
      return;
    }

    if (!novaSenha || novaSenha.length < 6) {
      setErro('A nova senha deve possuir no mínimo 6 caracteres.');
      return;
    }

    if (novaSenha !== confirmarSenha) {
      setErro('A confirmação de senha não coincide com a nova senha digitada.');
      return;
    }

    setSolicitando(true);
    try {
      await confirmarResetSenhaCooperado({
        candidatoId,
        codigo: codigo.trim(),
        novaSenha,
      });

      showToast('Senha do cooperado redefinida com sucesso!', 'success');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setErro(err.message || 'Erro ao validar código e redefinir senha.');
    } finally {
      setSolicitando(false);
    }
  };

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
        <div className="modal-dialog-header">
          <h3>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Reset de Senha do Cooperado
          </h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">
            ✕
          </button>
        </div>

        <div className="modal-dialog-body">
          <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, marginBottom: 12 }}>
            <div><strong>Cooperado:</strong> {candidatoNome}</div>
            <div style={{ marginTop: 4, color: '#64748b' }}>
              <strong>E-mail cadastrado:</strong> {candidatoEmail || 'Não informado'}
            </div>
          </div>

          {erro && (
            <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
              {erro}
            </div>
          )}

          {etapa === 'solicitar' ? (
            <div>
              <p style={{ fontSize: 13.5, color: '#334155', lineHeight: 1.5 }}>
                Ao solicitar o reset, o sistema irá gerar um <strong>código de segurança temporário (6 dígitos)</strong> com validade de 30 minutos e enviará para o e-mail do cooperado.
              </p>
              <div style={{ marginTop: 14, padding: 12, background: '#fffbeb', borderRadius: 8, border: '1px solid #fef3c7', fontSize: 12.5, color: '#92400e' }}>
                🛡️ Esta ação é registrada na trilha de auditoria para garantir conformidade e segurança da conta.
              </div>
            </div>
          ) : (
            <form onSubmit={handleConfirmarRedefinicao}>
              <div style={{ padding: 10, background: '#ecfdf5', borderRadius: 8, border: '1px solid #a7f3d0', fontSize: 12.5, color: '#065f46', marginBottom: 14 }}>
                ✓ {mensagemSucesso}
              </div>

              <div className="modal-form-group">
                <label>Código de Segurança (6 dígitos)</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="000000"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                  style={{ letterSpacing: 4, textAlign: 'center', fontSize: 18, fontWeight: 700 }}
                  required
                />
              </div>

              <div className="modal-form-group">
                <label>Nova Senha de Acesso</label>
                <input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  value={novaSenha}
                  onChange={(e) => setNovaSenha(e.target.value)}
                  required
                />
              </div>

              <div className="modal-form-group">
                <label>Confirmar Nova Senha</label>
                <input
                  type="password"
                  placeholder="Repita a nova senha"
                  value={confirmarSenha}
                  onChange={(e) => setConfirmarSenha(e.target.value)}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                <button type="button" className="btn-cancel" onClick={onClose} disabled={solicitando} style={{ flex: 1 }}>
                  Fechar
                </button>
                <button type="submit" className="btn-save-ajuste" disabled={solicitando} style={{ flex: 1 }}>
                  {solicitando ? 'Validando...' : 'Salvar Nova Senha'}
                </button>
              </div>
            </form>
          )}
        </div>

        {etapa === 'solicitar' && (
          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={solicitando}>
              Cancelar
            </button>
            <button
              type="button"
              className="btn-save-ajuste"
              style={{ background: '#d97706' }}
              onClick={handleSolicitar}
              disabled={solicitando}
            >
              {solicitando ? 'Gerando Código...' : 'Enviar Código de Reset'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ModalResetSenhaCooperado;
