import React, { useState } from 'react';
import './Monitoramento.css';
import MonitoramentoApontamentos, { FiltroApontamentos } from './MonitoramentoApontamentos';
import PainelFechamento from './PainelFechamento';
import MonitoramentoRelatorios from './MonitoramentoRelatorios';
import MonitoramentoCooperadoDetalhe from './MonitoramentoCooperadoDetalhe';
import RegrasApuracao from './RegrasApuracao';
import SolicitacoesVaga from './SolicitacoesVaga';
import ProdutividadeProcessos from './ProdutividadeProcessos';
import { useAuth } from '../../../auth/AuthContext';
import { usePermissoes } from '../../../auth/PermissoesContext';
import { calcularAcessoFaturamento } from '../../../auth/acessoFaturamento';

type AbaSupervisao = 'apontamentos' | 'relatorios' | 'regras' | 'produtividade' | 'vagas' | 'fechamento';

/** Primeiro e último dia da competência (YYYY-MM). */
function periodoCompetencia(competencia: string): { dataInicio: string; dataFim: string } {
  const [ano, mes] = competencia.split('-').map(Number);
  const ultimo = new Date(ano, mes, 0).getDate();
  return { dataInicio: `${competencia}-01`, dataFim: `${competencia}-${String(ultimo).padStart(2, '0')}` };
}

/**
 * Menu Supervisão: telas de trabalho do supervisor (ajuste de apontamentos e complementos,
 * relatórios, regras de apuração, solicitações de vagas e fechamento por cliente). As Escalas ficam no Monitoramento
 * (/dashboard/monitoramento/escalas) e a Carteira de Supervisores é o submenu /dashboard/supervisao/carteira.
 */
export const Supervisao: React.FC = () => {
  const { usuario } = useAuth();
  const { permissoes } = usePermissoes();
  // Produtividade e processos de faturamento: mesma permissão do Faturamento
  const verProdutividade = calcularAcessoFaturamento(usuario?.perfil, permissoes);
  const [abaAtiva, setAbaAtiva] = useState<AbaSupervisao>('apontamentos');
  const [cooperadoSelecionadoId, setCooperadoSelecionadoId] = useState<number | null>(null);
  // Filtro levado do Fechamento para os Apontamentos (cooperados que precisam de ajuste); a chave remonta a aba
  const [filtroApontamentos, setFiltroApontamentos] = useState<{ chave: number; filtro?: FiltroApontamentos }>({ chave: 0 });

  const verAjustesPendentes = (empresaId: number, competencia: string) => {
    setFiltroApontamentos((f) => ({ chave: f.chave + 1, filtro: { empresaId, ...periodoCompetencia(competencia), status: 'ajustar' } }));
    setAbaAtiva('apontamentos');
  };

  return (
    <div className="monitoramento-container">
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Supervisão
          </h1>
          <p>A Supervisão não faz o monitoramento: visualiza quais cooperados precisam de ajuste, ajusta apontamentos e complementos, confere relatórios e regras de apuração e conduz o fechamento de cada cliente até o faturamento, com rastreabilidade completa.</p>
        </div>
      </div>

      {cooperadoSelecionadoId !== null ? (
        <MonitoramentoCooperadoDetalhe
          candidatoId={cooperadoSelecionadoId}
          onVoltar={() => setCooperadoSelecionadoId(null)}
        />
      ) : (
        <>
          <div className="monitoramento-tabs-nav">
            <button
              type="button"
              className={`monitoramento-tab-btn ${abaAtiva === 'apontamentos' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('apontamentos')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Apontamentos
            </button>
            <button
              type="button"
              className={`monitoramento-tab-btn ${abaAtiva === 'relatorios' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('relatorios')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
              </svg>
              Relatórios da Supervisão
            </button>
            <button
              type="button"
              className={`monitoramento-tab-btn ${abaAtiva === 'regras' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('regras')}
              title="Faturamento / Produtividade: regra de apuração das jornadas de cada cliente"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
                <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
                <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
                <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
              </svg>
              Regras de Apuração (Produtividade)
            </button>
            {verProdutividade && (
              <button
                type="button"
                className={`monitoramento-tab-btn ${abaAtiva === 'produtividade' ? 'active' : ''}`}
                onClick={() => setAbaAtiva('produtividade')}
                title="Planilha de produtividade, valores (R$) e processo de faturamento"
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="8" y1="13" x2="16" y2="13" /><line x1="8" y1="17" x2="16" y2="17" />
                </svg>
                Produtividade e Processos
              </button>
            )}
            <button
              type="button"
              className={`monitoramento-tab-btn ${abaAtiva === 'vagas' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('vagas')}
              title="Pedidos do cliente para abrir ou reabrir posições numa vaga do Parâmetro"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Solicitações de Vagas
            </button>
            <button
              type="button"
              className={`monitoramento-tab-btn ${abaAtiva === 'fechamento' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('fechamento')}
              title="Fechamento por cliente e competência: Supervisão → Faturamento, com reabertura justificada"
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              Fechamento
            </button>
          </div>

          {abaAtiva === 'apontamentos' && (
            <MonitoramentoApontamentos
              key={filtroApontamentos.chave}
              filtroInicial={filtroApontamentos.filtro}
              onVisualizarCooperado={setCooperadoSelecionadoId}
            />
          )}
          {abaAtiva === 'relatorios' && <MonitoramentoRelatorios />}
          {abaAtiva === 'regras' && <RegrasApuracao />}
          {abaAtiva === 'produtividade' && verProdutividade && <ProdutividadeProcessos embutido />}
          {abaAtiva === 'vagas' && <SolicitacoesVaga />}
          {abaAtiva === 'fechamento' && <PainelFechamento onVerAjustes={verAjustesPendentes} />}
        </>
      )}
    </div>
  );
};

export default Supervisao;
