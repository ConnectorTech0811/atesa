import React, { useEffect, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { OpcoesEscala, obterOpcoesEscala } from '../../../api/escalaFaturamentoApi';
import PainelFechamento from './PainelFechamento';
import RegrasComissao from './RegrasComissao';
import MunicipiosNfse from './MunicipiosNfse';
import ProdutividadeProcessos from './ProdutividadeProcessos';
import { useAuth } from '../../../auth/AuthContext';
import { usePermissoes } from '../../../auth/PermissoesContext';
import { calcularAcessoSupervisao } from '../../../auth/acessoFaturamento';

// Produtividade e processos de faturamento ficam na Supervisão; aqui só para quem não vê a Supervisão
type AbaFaturamento = 'produtividade' | 'fechamento' | 'comissoes' | 'prefeituras';

export const MonitoramentoFaturamento: React.FC = () => {
  const { showToast } = useToast();
  const [opcoes, setOpcoes] = useState<OpcoesEscala>({ cooperados: [], empresas: [], alocacoes: [], vagas: [] });
  const { usuario } = useAuth();
  const { permissoes } = usePermissoes();
  const produtividadeAqui = !calcularAcessoSupervisao(usuario?.perfil, permissoes);
  const [aba, setAba] = useState<AbaFaturamento>(produtividadeAqui ? 'produtividade' : 'fechamento');
  const abas: [AbaFaturamento, string][] = [
    ...(produtividadeAqui ? [['produtividade', 'Produtividade e processos'] as [AbaFaturamento, string]] : []),
    ['fechamento', 'Fechamento'], ['comissoes', 'Regras de comissão'], ['prefeituras', 'Prefeituras (NFS-e)'],
  ];

  useEffect(() => {
    obterOpcoesEscala().then(setOpcoes).catch((e) => showToast(e?.message || 'Erro ao carregar empresas.', 'error'));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carrega uma vez
  }, []);

  return (
    <div className="monitoramento-container">
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
            </svg>
            Faturamento / Produtividade
            Faturamento
          </h1>
          <p>Fechamento, regras de comissão e prefeituras (NFS-e). A produtividade e o processo de faturamento ficam na Supervisão, aba Produtividade e Processos.</p>
        </div>
      </div>

      <div className="monitoramento-tabs-nav">
        {abas.map(([id, rotulo]) => (
          <button key={id} type="button" className={`monitoramento-tab-btn ${aba === id ? 'active' : ''}`} onClick={() => setAba(id)}>{rotulo}</button>
        ))}
      </div>

      {aba === 'produtividade' && produtividadeAqui && <ProdutividadeProcessos embutido />}
      {aba === 'fechamento' && <PainelFechamento />}
      {aba === 'comissoes' && <RegrasComissao empresas={opcoes.empresas} />}
      {aba === 'prefeituras' && <MunicipiosNfse />}
    </div>
  );
};

export default MonitoramentoFaturamento;
