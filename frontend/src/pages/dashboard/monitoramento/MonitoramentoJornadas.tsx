import React, { useEffect, useState } from 'react';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO } from '../../../utils/formatters';
import { obterConferenciaJornadas, obterOpcoesEscala, PlanilhaFaturamento } from '../../../api/escalaFaturamentoApi';
import ConferenciaJornadas from './ConferenciaJornadas';

const competenciaAtual = dataLocalISO().slice(0, 7);

/** Aba Jornadas do Monitoramento: horas trabalhadas × previstas por cooperado, pelas batidas do App. */
export const MonitoramentoJornadas: React.FC = () => {
  const { showToast } = useToast();
  const [empresas, setEmpresas] = useState<{ id: number; nome_empresa: string }[]>([]);
  const [empresaId, setEmpresaId] = useState<number | ''>('');
  const [competencia, setCompetencia] = useState(competenciaAtual);
  const [conferencia, setConferencia] = useState<PlanilhaFaturamento | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    obterOpcoesEscala().then((o) => setEmpresas(o.empresas)).catch((e) => showToast(e?.message || 'Erro ao carregar clientes.', 'error'));
  }, []);

  useEffect(() => { setConferencia(null); }, [empresaId, competencia]);

  const conferir = async () => {
    if (!empresaId) { showToast('Selecione o cliente.', 'warning'); return; }
    setCarregando(true);
    try {
      setConferencia(await obterConferenciaJornadas({ empresaId: Number(empresaId), competencia }));
    } catch (err: any) {
      showToast(err?.message || 'Erro ao conferir as jornadas.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <>
      <div className="monitoramento-filters-card">
        <div className="filter-item" style={{ flex: 2, minWidth: 240 }}>
          <label>Cliente (empresa)</label>
          <select className="filter-select" value={empresaId} onChange={(e) => setEmpresaId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">— Selecione —</option>
            {empresas.map((em) => <option key={em.id} value={em.id}>{em.nome_empresa}</option>)}
          </select>
        </div>
        <div className="filter-item" style={{ minWidth: 160 }}>
          <label>Competência</label>
          <input type="month" className="filter-input" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
        </div>
        <div className="filter-item" style={{ justifyContent: 'flex-end' }}>
          <button type="button" className="btn-primary-filter" onClick={conferir} disabled={carregando || !empresaId}>
            {carregando ? 'Conferindo...' : conferencia ? '↻ Atualizar' : 'Conferir jornadas'}
          </button>
        </div>
      </div>

      {conferencia?.avisos.map((a, i) => (
        <div key={i} style={{ padding: '10px 16px', marginBottom: 8, background: '#fffbeb', color: '#92400e', fontSize: 13, border: '1px solid #fde68a', borderRadius: 8 }}>⚠ {a}</div>
      ))}

      {conferencia && <ConferenciaJornadas planilha={conferencia} />}
    </>
  );
};

export default MonitoramentoJornadas;
