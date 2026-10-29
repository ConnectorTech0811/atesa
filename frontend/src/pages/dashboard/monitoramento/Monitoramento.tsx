import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import './Monitoramento.css';
import MonitoramentoDashboard from './MonitoramentoDashboard';
import MonitoramentoCooperados from './MonitoramentoCooperados';
import MonitoramentoJornadas from './MonitoramentoJornadas';
import MonitoramentoLogsAuditoria from './MonitoramentoLogsAuditoria';
import MonitoramentoCooperadoDetalhe from './MonitoramentoCooperadoDetalhe';

// Apontamentos (ajustes) e Relatórios da Supervisão ficam no menu Supervisão (Supervisao.tsx)
export type AbaMonitoramento = 'dashboard' | 'cooperados' | 'jornadas' | 'logs';

export const Monitoramento: React.FC = () => {
  const history = useHistory();
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
            Monitoramento
          </h1>
          <p>Acompanhamento dos cooperados, das jornadas registradas no App e do histórico de auditoria.</p>
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
              className={`monitoramento-tab-btn ${abaAtiva === 'jornadas' ? 'active' : ''}`}
              onClick={() => setAbaAtiva('jornadas')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Jornadas
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
              onIrParaApontamentos={() => history.push('/dashboard/supervisao')}
            />
          )}

          {abaAtiva === 'cooperados' && (
            <MonitoramentoCooperados
              onVisualizarCooperado={handleVisualizarCooperado}
            />
          )}

          {abaAtiva === 'jornadas' && <MonitoramentoJornadas />}

          {abaAtiva === 'logs' && (
            <MonitoramentoLogsAuditoria />
          )}
        </>
      )}
    </div>
  );
};

export default Monitoramento;
