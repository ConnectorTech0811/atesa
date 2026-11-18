import React, { useEffect, useMemo, useState } from 'react';
import { EscalaCooperado, obterEscalasPortal } from '../api/beneficiosApi';
import { dataLocalISO } from '../utils/formatters';

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const STATUS: Record<string, { rotulo: string; cor: string; fundo: string }> = {
  prevista: { rotulo: 'Agendada', cor: '#1d4ed8', fundo: '#dbeafe' },
  realizada: { rotulo: 'Realizada', cor: '#166534', fundo: '#dcfce7' },
  cancelada: { rotulo: 'Cancelada', cor: '#b91c1c', fundo: '#fee2e2' },
};

function rotuloData(data: string) {
  const [a, m, d] = data.split('-').map(Number);
  const dt = new Date(a, m - 1, d);
  return `${DIAS[dt.getDay()]}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
}

const CardEscala: React.FC<{ e: EscalaCooperado; hoje: string }> = ({ e, hoje }) => {
  const st = e.data < hoje && e.status === 'prevista' ? { rotulo: 'Encerrada', cor: '#475569', fundo: '#f1f5f9' } : (STATUS[e.status] ?? STATUS.prevista);
  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '12px 14px', border: `1.5px solid ${e.data === hoje ? '#86efac' : '#e8ebe0'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <strong style={{ fontSize: 14, color: '#182210' }}>{rotuloData(e.data)}{e.data === hoje ? ' · Hoje' : ''}</strong>
        <span style={{ fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 10, color: st.cor, background: st.fundo }}>{st.rotulo}</span>
      </div>
      <div style={{ fontSize: 13, color: '#334155', marginTop: 4, fontWeight: 700 }}>
        {e.hora_inicio} às {e.hora_fim}{e.turno ? ` · ${e.turno === 'noturno' ? 'Noturno' : 'Diurno'}` : ''}
      </div>
      {(e.paciente_nome || e.nome_empresa) && (
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
          {[e.paciente_nome && `${e.paciente_tipo === 'local' ? 'Local' : 'Paciente'}: ${e.paciente_nome}`, e.nome_empresa].filter(Boolean).join(' · ')}
        </div>
      )}
      {e.paciente_endereco && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{e.paciente_endereco}</div>}
    </div>
  );
};

/** Escalas do cooperado no App: futuras e histórico. Somente visualização (sem edição). */
export const EscalasCooperadoApp: React.FC<{ token: string }> = ({ token }) => {
  const [escalas, setEscalas] = useState<EscalaCooperado[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [visao, setVisao] = useState<'futuras' | 'historico'>('futuras');
  const hoje = dataLocalISO();

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    obterEscalasPortal(token, { diasPassados: 90, diasFuturos: 90 })
      .then((l) => { if (ativo) { setEscalas(l); setErro(''); } })
      .catch((e) => { if (ativo) setErro(e instanceof Error ? e.message : 'Erro ao carregar as escalas.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [token]);

  const futuras = useMemo(() => escalas.filter((e) => e.data >= hoje && e.status !== 'cancelada'), [escalas, hoje]);
  const historico = useMemo(() => escalas.filter((e) => e.data < hoje).reverse(), [escalas, hoje]);
  const lista = visao === 'futuras' ? futuras : historico;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '14px 16px', border: '1.5px solid #e8ebe0' }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: '#182210' }}>Minhas Escalas</div>
        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>Consulta dos seus plantões. Para alterações, procure a escalista ou a supervisão.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
          {([['futuras', `Próximas (${futuras.length})`], ['historico', `Histórico (${historico.length})`]] as const).map(([id, rotulo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setVisao(id)}
              style={{
                padding: '9px 10px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer',
                border: visao === id ? '1.5px solid #556b2f' : '1.5px solid #e5e7eb',
                background: visao === id ? '#eaf2d7' : '#fff', color: visao === id ? '#3d5020' : '#6b7280',
              }}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {carregando && <div style={{ textAlign: 'center', color: '#6b7280', fontSize: 13, padding: 20 }}>Carregando escalas...</div>}
      {!carregando && erro && <div style={{ background: '#fef2f2', color: '#b91c1c', borderRadius: 12, padding: 12, fontSize: 13 }}>{erro}</div>}
      {!carregando && !erro && lista.length === 0 && (
        <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 13, padding: 24, background: '#fff', borderRadius: 12, border: '1.5px dashed #e5e7eb' }}>
          {visao === 'futuras' ? 'Nenhuma escala agendada.' : 'Nenhuma escala nos últimos 90 dias.'}
        </div>
      )}
      {!carregando && !erro && lista.map((e) => <CardEscala key={e.id} e={e} hoje={hoje} />)}
    </div>
  );
};

export default EscalasCooperadoApp;
