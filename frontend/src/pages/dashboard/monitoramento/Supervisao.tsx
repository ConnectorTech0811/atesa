import React, { useState } from 'react';
import './Monitoramento.css';
import MonitoramentoApontamentos from './MonitoramentoApontamentos';
import MonitoramentoRelatorios from './MonitoramentoRelatorios';
import MonitoramentoCooperadoDetalhe from './MonitoramentoCooperadoDetalhe';
import RegrasApuracao from './RegrasApuracao';
import SolicitacoesVaga from './SolicitacoesVaga';

type AbaSupervisao = 'apontamentos' | 'relatorios' | 'regras' | 'vagas';

/**
 * Menu Supervisão: telas de trabalho do supervisor (ajuste de apontamentos e complementos,
 * relatórios da supervisão e regras de apuração por cliente). O lançamento de escalas é o submenu /dashboard/supervisao/escalas.
 */
export const Supervisao: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<AbaSupervisao>('apontamentos');
  const [cooperadoSelecionadoId, setCooperadoSelecionadoId] = useState<number | null>(null);

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
          <p>Ajuste de apontamentos e complementos, reconferência das escalas, relatórios e regras de apuração de cada cliente antes do faturamento, com rastreabilidade completa.</p>
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
          </div>

          {abaAtiva === 'apontamentos' && <MonitoramentoApontamentos onVisualizarCooperado={setCooperadoSelecionadoId} />}
          {abaAtiva === 'relatorios' && <MonitoramentoRelatorios />}
          {abaAtiva === 'regras' && <RegrasApuracao />}
          {abaAtiva === 'vagas' && <SolicitacoesVaga />}
        </>
      )}
    </div>
  );
};

export default Supervisao;
