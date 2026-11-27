import React, { useEffect, useState } from 'react';
import { ConfigESocial, SituacaoCertificado, obterConfigESocial } from '../../../api/esocialApi';
import { CabecalhoAmbiente, SecaoFolha, SecaoLotes } from './ESocialBeneficios';
import ESocialCadastrosTabela from './ESocialCadastrosTabela';

type Aba = 'tabelas' | 'folha' | 'lotes';

/**
 * Área reservada do eSocial: Folha mensal (S-1200 / S-1210) e Lotes enviados.
 * Só aparece para quem tiver o módulo "esocial_folha" liberado em Permissões e Grupos
 * (além de Administrador e Suporte).
 */
const ESocialFolhaReservada: React.FC = () => {
  const [aba, setAba] = useState<Aba>('folha');
  const [config, setConfig] = useState<ConfigESocial | null>(null);
  const [certificado, setCertificado] = useState<SituacaoCertificado | null>(null);
  const [erro, setErro] = useState('');

  useEffect(() => {
    obterConfigESocial()
      .then((r) => { setConfig(r.config); setCertificado(r.certificado); })
      .catch((e) => setErro(e.message));
  }, []);

  return (
    <div className="painel-page" style={{ padding: 24 }}>
      <div className="painel-header" style={{ marginBottom: 16 }}>
        <div>
          <h2 style={{ margin: 0 }}>🔒 eSocial — Folha e Lotes</h2>
          <p className="painel-subtitle" style={{ margin: '4px 0 0' }}>Área reservada: cadastros de tabela, folha mensal (S-1200 / S-1210) e lotes enviados ao eSocial</p>
        </div>
      </div>

      {erro && <div className="form-erro" style={{ marginBottom: 12 }}>{erro}</div>}
      <CabecalhoAmbiente config={config} certificado={certificado} />

      <div className="exec-abas" style={{ marginBottom: 16 }}>
        {([
          ['tabelas', 'Cadastros de tabela (S-1000 / S-1005 / S-1010 / S-1020)'],
          ['folha', 'Folha mensal (S-1200 / S-1210)'],
          ['lotes', 'Lotes enviados'],
        ] as [Aba, string][]).map(([id, texto]) => (
          <button key={id} className={`exec-aba${aba === id ? ' exec-aba-ativa' : ''}`} onClick={() => setAba(id)}>{texto}</button>
        ))}
      </div>

      {aba === 'tabelas' && <ESocialCadastrosTabela />}
      {aba === 'folha' && <SecaoFolha />}
      {aba === 'lotes' && <SecaoLotes />}
    </div>
  );
};

export default ESocialFolhaReservada;
