import React, { useState } from 'react';
import '../monitoramento/Monitoramento.css';
import { lerArquivoBase64 } from '../../../api/financeiroApi';

export interface CampoFormulario {
  nome: string;
  rotulo: string;
  tipo?: 'texto' | 'numero' | 'data' | 'select' | 'textarea' | 'arquivo' | 'checkbox';
  obrigatorio?: boolean;
  opcoes?: { valor: string | number; rotulo: string }[];
  placeholder?: string;
  ajuda?: string;
  aceitar?: string; // extensões do input de arquivo
  largura?: 'metade' | 'inteira';
}

export type ValoresFormulario = Record<string, any>;

interface Props {
  titulo: string;
  descricao?: React.ReactNode;
  campos: CampoFormulario[];
  valoresIniciais?: ValoresFormulario;
  rotuloConfirmar?: string;
  onConfirmar: (valores: ValoresFormulario) => Promise<void>;
  onClose: () => void;
}

/** Formulário em modal: valida obrigatórios, lê arquivos em base64 e mostra o erro do servidor. */
export const ModalFormulario: React.FC<Props> = ({ titulo, descricao, campos, valoresIniciais = {}, rotuloConfirmar = 'Confirmar', onConfirmar, onClose }) => {
  const [valores, setValores] = useState<ValoresFormulario>(valoresIniciais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const [detalhes, setDetalhes] = useState<string[]>([]);

  const set = (nome: string, v: unknown) => setValores((s) => ({ ...s, [nome]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setDetalhes([]);
    setSalvando(true);
    try {
      const final: ValoresFormulario = { ...valores };
      for (const c of campos) {
        if (c.tipo === 'arquivo' && valores[c.nome] instanceof File) final[c.nome] = await lerArquivoBase64(valores[c.nome]);
      }
      await onConfirmar(final);
      onClose();
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível concluir a ação.');
      setDetalhes(Array.isArray(err?.detalhes) ? err.detalhes : []);
    } finally {
      setSalvando(false);
    }
  };

  const renderCampo = (c: CampoFormulario) => {
    const v = valores[c.nome] ?? '';
    switch (c.tipo) {
      case 'select':
        return (
          <select value={v} onChange={(e) => set(c.nome, e.target.value)} required={c.obrigatorio}>
            {!c.obrigatorio && <option value="">—</option>}
            {c.opcoes?.map((o) => <option key={String(o.valor)} value={o.valor}>{o.rotulo}</option>)}
          </select>
        );
      case 'textarea':
        return <textarea rows={3} value={v} onChange={(e) => set(c.nome, e.target.value)} required={c.obrigatorio} placeholder={c.placeholder} />;
      case 'arquivo':
        return <input type="file" accept={c.aceitar} onChange={(e) => set(c.nome, e.target.files?.[0] ?? null)} required={c.obrigatorio} />;
      case 'checkbox':
        return (
          <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontWeight: 400 }}>
            <input type="checkbox" checked={!!valores[c.nome]} onChange={(e) => set(c.nome, e.target.checked)} /> {c.placeholder ?? 'Sim'}
          </label>
        );
      case 'data':
        return <input type="date" value={v} onChange={(e) => set(c.nome, e.target.value)} required={c.obrigatorio} />;
      case 'numero':
        return <input type="text" inputMode="decimal" value={v} onChange={(e) => set(c.nome, e.target.value)} required={c.obrigatorio} placeholder={c.placeholder ?? 'Ex: 1.234,56'} />;
      default:
        return <input type="text" value={v} onChange={(e) => set(c.nome, e.target.value)} required={c.obrigatorio} placeholder={c.placeholder} />;
    }
  };

  // Agrupa campos de meia largura em pares
  const linhas: CampoFormulario[][] = [];
  for (const c of campos) {
    const ultima = linhas[linhas.length - 1];
    if (c.largura === 'metade' && ultima && ultima.length === 1 && ultima[0].largura === 'metade') ultima.push(c);
    else linhas.push([c]);
  }

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-dialog-header">
          <h3>{titulo}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-dialog-body" style={{ maxHeight: '65vh', overflowY: 'auto' }}>
            {descricao && <div style={{ background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13 }}>{descricao}</div>}
            {erro && (
              <div style={{ padding: '10px 14px', background: '#fee2e2', color: '#991b1b', borderRadius: 8, fontSize: 13 }}>
                {erro}
                {detalhes.length > 0 && <ul style={{ margin: '6px 0 0 18px' }}>{detalhes.map((d, i) => <li key={i}>{d}</li>)}</ul>}
              </div>
            )}
            {linhas.map((grupo, i) => (
              <div key={i} className={grupo.length > 1 ? 'modal-form-row' : undefined}>
                {grupo.map((c) => (
                  <div key={c.nome} className="modal-form-group">
                    <label>{c.rotulo}{c.obrigatorio ? ' *' : ''}</label>
                    {renderCampo(c)}
                    {c.ajuda && <small style={{ color: '#64748b' }}>{c.ajuda}</small>}
                  </div>
                ))}
              </div>
            ))}
          </div>
          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>{salvando ? 'Gravando...' : rotuloConfirmar}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalFormulario;
