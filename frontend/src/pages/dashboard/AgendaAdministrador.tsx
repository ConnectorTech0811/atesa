import React, { useState } from 'react';
import './monitoramento/Monitoramento.css';
import AgendaReuniones from './AgendaReuniones';
import AgendaSupervisao from './AgendaSupervisao';

type AbaAgenda = 'executivos' | 'supervisao';

/** Administrador: acesso às duas agendas — a dos executivos (lista) e a da supervisão (calendário). */
const AgendaAdministrador: React.FC = () => {
  const [aba, setAba] = useState<AbaAgenda>('executivos');

  return (
    <div>
      <div className="monitoramento-tabs-nav" style={{ margin: '16px 24px 0' }}>
        <button
          type="button"
          className={`monitoramento-tab-btn ${aba === 'executivos' ? 'active' : ''}`}
          onClick={() => setAba('executivos')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
          Agenda dos Executivos
        </button>
        <button
          type="button"
          className={`monitoramento-tab-btn ${aba === 'supervisao' ? 'active' : ''}`}
          onClick={() => setAba('supervisao')}
        >
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          Agenda da Supervisão
        </button>
      </div>

      {aba === 'executivos' ? <AgendaReuniones /> : <AgendaSupervisao />}
    </div>
  );
};

export default AgendaAdministrador;
