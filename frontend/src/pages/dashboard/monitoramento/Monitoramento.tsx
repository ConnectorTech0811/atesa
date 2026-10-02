import React, { useState } from 'react';
import './Monitoramento.css';
import MonitoramentoDashboard from './MonitoramentoDashboard';
import MonitoramentoCooperados from './MonitoramentoCooperados';
import MonitoramentoApontamentos from './MonitoramentoApontamentos';
import MonitoramentoRelatorios from './MonitoramentoRelatorios';
import MonitoramentoLogsAuditoria from './MonitoramentoLogsAuditoria';
import MonitoramentoCooperadoDetalhe from './MonitoramentoCooperadoDetalhe';

export type AbaMonitoramento = 'dashboard' | 'cooperados' | 'apontamentos' | 'relatorios' | 'logs';

export const Monitoramento: React.FC = () => {
  const [abaAtiva, setAbaAtiva] = useState<AbaMonitoramento>('dashboard');
  const [cooperadoSelecionadoId, setCooperadoSelecionadoId] = useState<number | null>(null);

  const handleVisualizarCooperado = (candidatoId: number) => {
    setCooperadoSelecionadoId(candidatoId);
  };

  const handleVoltarParaCooperados = () => {
    setCooperadoSelecionadoId(null);
    setAbaAtiva('cooperados');
  };

  return (
    <div className="monitoramento-container">
      {/* ── Cabeçalho do Módulo ── */}
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
            Monitoramento & Supervisão
          </h1>
          <p>Acompanhamento de cooperados, conferência de horários, ajustes, complementos e relatórios com rastreabilidade completa.</p>
        </div>
      </div>

      {/* Se estiver visualizando detalhe de um cooperado específico */}
      {cooperadoSelecionadoId !== null ? (
        <MonitoramentoCooperadoDetalhe
          candidatoId={cooperadoSelecionadoId}
          onVoltar={handleVoltarParaCooperados}
        />
      ) : (
        <>
          {/* ── Menu de Abas Superior ── */}
          <div className="monitoramento-tabs-nav">
            <button
              type="button"
              className={`monitoramento-tab-btn ${abaAtiva === 'dashboard' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('dashboard')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="9" />
                <rect x="14" y="3" width="7" height="5" />
                <rect x="14" y="12" width="7" height="9" />
                <rect x="3" y="16" width="7" height="5" />
              </svg>
              Dashboard de Monitoramento
            </button>

            <button
              type="button"
              className={`monitoramento-tab-btn ${abaAtiva === 'cooperados' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('cooperados')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              Cooperados
            </button>

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
                <polyline points="10 9 9 9 8 9" />
              </svg>
              Relatórios da Supervisão
            </button>

            <button
              type="button"
              className={`monitoramento-tab-btn ${abaAtiva === 'logs' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('logs')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Logs de Auditoria
            </button>
          </div>

          {/* ── Conteúdo da Aba Ativa ── */}
          {abaAtiva === 'dashboard' && (
            <MonitoramentoDashboard
              onVisualizarCooperado={handleVisualizarCooperado}
              onIrParaCooperados={() => setAbaAtiva('cooperados')}
              onIrParaApontamentos={() => setAbaAtiva('apontamentos')}
            />
          )}

          {abaAtiva === 'cooperados' && (
            <MonitoramentoCooperados
              onVisualizarCooperado={handleVisualizarCooperado}
            />
          )}

          {abaAtiva === 'apontamentos' && (
            <MonitoramentoApontamentos
              onVisualizarCooperado={handleVisualizarCooperado}
            />
          )}

          {abaAtiva === 'relatorios' && (
            <MonitoramentoRelatorios />
          )}

          {abaAtiva === 'logs' && (
            <MonitoramentoLogsAuditoria />
          )}
        </>
      )}
    </div>
  );
};

export default Monitoramento;
