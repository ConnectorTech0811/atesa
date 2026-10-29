import React, { useMemo, useState } from 'react';
import { formatarDataBR } from '../../../utils/formatters';
import { LinhaFaturamento, PlanilhaFaturamento } from '../../../api/escalaFaturamentoApi';

const h = (n: number) => (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Conferência das horas por cooperado: trabalhado × previsto, extra, falta, noturno e problemas de jornada. */
export const ConferenciaJornadas: React.FC<{ planilha: PlanilhaFaturamento }> = ({ planilha }) => {
  const [aberto, setAberto] = useState<string | null>(null);
  const [soProblemas, setSoProblemas] = useState(false);
  const linhas = useMemo(
    () => planilha.linhas.filter((l) => (l.alocacao_id || l.origem === 'escala') && (!soProblemas || l.inconsistencias.length > 0)),
    [planilha, soProblemas]
  );
  const r = planilha.regras;
  const chave = (l: LinhaFaturamento) => `${l.alocacao_id}-${l.candidato_id}`;

  return (
    <div className="monitoramento-table-card">
      <div className="table-card-header">
        <div>
          <h3 className="table-card-title">
            Conferência de jornadas
            {planilha.total_inconsistencias > 0
              ? <span className="badge-status badge-divergente" style={{ marginLeft: 8 }}>{planilha.total_inconsistencias} problema(s)</span>
              : <span className="badge-status badge-ativo" style={{ marginLeft: 8 }}>Sem problemas de jornada</span>}
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
            Jornadas montadas pelas batidas do App (entrada → saída, inclusive plantões que viram o dia) e comparadas com a escala ou o horário da vaga.
            Tolerância {r.tolerancia_minutos} min · noturno {r.noturno_inicio}–{r.noturno_fim}{r.hora_noturna_reduzida ? ' (hora reduzida)' : ''}
            {r.extras_automaticos ? '' : ' · extra/falta automáticas desligadas'}.
          </p>
        </div>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: '#475569' }}>
          <input type="checkbox" checked={soProblemas} onChange={(e) => setSoProblemas(e.target.checked)} /> Só com problemas
        </label>
      </div>
      <div className="table-responsive">
        <table className="monitoramento-table" style={{ fontSize: 12.5 }}>
          <thead>
            <tr>
              <th>Cooperado</th>
              <th>Atividade / Local</th>
              <th style={{ textAlign: 'right' }}>Dias</th>
              <th style={{ textAlign: 'right' }}>Trabalhadas</th>
              <th style={{ textAlign: 'right' }}>Previstas</th>
              <th style={{ textAlign: 'right' }}>Extra</th>
              <th style={{ textAlign: 'right' }}>Falta</th>
              <th style={{ textAlign: 'right' }}>Noturnas</th>
              <th style={{ textAlign: 'right' }}>Ad. noturno</th>
              <th>Situação</th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={10} style={{ textAlign: 'center', padding: 24, color: '#94a3b8' }}>{soProblemas ? 'Nenhum cooperado com problema de jornada.' : 'Nenhuma alocação na competência.'}</td></tr>
            ) : linhas.map((l) => {
              const k = chave(l);
              const ocorrencias = [...l.inconsistencias.map((o) => ({ ...o, bloqueia: true })), ...l.avisos.map((o) => ({ ...o, bloqueia: false }))]
                .sort((a, b) => a.data.localeCompare(b.data));
              return (
                <React.Fragment key={k}>
                  <tr>
                    <td><strong>{l.cooperado}</strong><div style={{ fontSize: 11, color: '#94a3b8' }}>Mat. {l.matricula}</div></td>
                    <td>{l.atividade || '—'}<div style={{ fontSize: 11, color: '#64748b' }}>{l.local}</div></td>
                    <td style={{ textAlign: 'right' }}>{l.dias_trabalhados}</td>
                    <td style={{ textAlign: 'right' }}><strong>{h(l.total_horas)}</strong></td>
                    <td style={{ textAlign: 'right' }}>{h(l.horas_previstas)}</td>
                    <td style={{ textAlign: 'right', color: l.hora_excedente > 0 ? '#15803d' : undefined }}>{h(l.hora_excedente)}</td>
                    <td style={{ textAlign: 'right', color: l.horas_falta > 0 ? '#b91c1c' : undefined }}>{h(l.horas_falta)}</td>
                    <td style={{ textAlign: 'right' }}>{h(l.horas_noturnas)}</td>
                    <td style={{ textAlign: 'right' }}>{h(l.ad_noturno)}</td>
                    <td>
                      {ocorrencias.length === 0 ? <span className="badge-status badge-ativo">OK</span> : (
                        <button type="button" className={l.inconsistencias.length ? 'btn-action-edit' : 'btn-action-view'} onClick={() => setAberto(aberto === k ? null : k)}>
                          {l.inconsistencias.length ? `⚠ ${l.inconsistencias.length} problema(s)` : `${l.avisos.length} aviso(s)`} {aberto === k ? '▲' : '▼'}
                        </button>
                      )}
                    </td>
                  </tr>
                  {aberto === k && (
                    <tr>
                      <td colSpan={10} style={{ background: '#f8fafc' }}>
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, lineHeight: 1.6 }}>
                          {ocorrencias.map((o, i) => (
                            <li key={i} style={{ color: o.bloqueia ? '#991b1b' : '#92400e' }}>
                              <strong>{formatarDataBR(o.data)}</strong> · {o.bloqueia ? (planilha.tipos_inconsistencia[o.tipo] || o.tipo) : 'Aviso'}: {o.descricao}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ConferenciaJornadas;
