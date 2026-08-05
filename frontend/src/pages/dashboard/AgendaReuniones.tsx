import React, { useEffect, useState } from 'react';
import { IonButton, useIonViewWillEnter } from '@ionic/react';
import {
  Reuniao,
  ROTULO_STATUS_REUNIAO,
  STATUS_COR_REUNIAO,
  StatusReuniao,
  agendarReuniao,
  atualizarStatusReuniao,
  listarEmpresasExecutivo,
  listarTodasReunioes,
} from '../../api/executivoApi';
import { Empresa } from '../../api/empresasApi';
import { formatarDataBR } from '../../utils/formatters';

// Alias local para manter a API do componente igual
const STATUS_COR = STATUS_COR_REUNIAO;

function formatarDataHoraReuniao(iso: string) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', weekday: 'long',
    year: 'numeric', month: 'long', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function agruparPorData(reunioes: Reuniao[]): Record<string, Reuniao[]> {
  const grupos: Record<string, Reuniao[]> = {};
  for (const r of reunioes) {
    const data = r.data_hora.substring(0, 10);
    if (!grupos[data]) grupos[data] = [];
    grupos[data].push(r);
  }
  return grupos;
}

const AgendaReuniones: React.FC = () => {
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [erro, setErro] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusReuniao | ''>('');
  const [form, setForm] = useState({
    empresaId: '',
    titulo: '',
    data: '',
    horaH: '',
    horaM: '',
    localReuniao: '',
    observacoes: '',
  });

  const carregar = async () => {
    setCarregando(true);
    try {
      const [rs, es] = await Promise.all([listarTodasReunioes(), listarEmpresasExecutivo()]);
      setReunioes(rs);
      setEmpresas(es);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar agenda.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, []);
  useIonViewWillEnter(() => { carregar(); });

  const handleAgendar = async () => {
    if (!form.empresaId || !form.titulo || !form.data || !form.horaH || !form.horaM) {
      setErro('Informe a empresa, título, data e hora.');
      return;
    }
    const dataHora = `${form.data}T${form.horaH}:${form.horaM}`;
    try {
      await agendarReuniao({
        empresaId: Number(form.empresaId),
        titulo: form.titulo,
        dataHora,
        localReuniao: form.localReuniao || undefined,
        observacoes: form.observacoes || undefined,
      });
      await carregar();
      setForm({ empresaId: '', titulo: '', data: '', horaH: '', horaM: '', localReuniao: '', observacoes: '' });
      setShowForm(false);
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao agendar.');
    }
  };

  const handleStatus = async (id: number, status: StatusReuniao) => {
    setReunioes((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    try {
      await atualizarStatusReuniao(id, status);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar status.');
      await carregar();
    }
  };

  const reunioesFiltradas = filtroStatus ? reunioes.filter((r) => r.status === filtroStatus) : reunioes;
  const grupos = agruparPorData(reunioesFiltradas);
  const datasOrdenadas = Object.keys(grupos).sort().reverse();

  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Agenda de Reuniões</h1>
          <p className="painel-subtitle">Compromissos com clientes</p>
        </div>
        <IonButton className="btn-acao" shape="round" color="secondary" onClick={() => setShowForm((v) => !v)}>
          + Agendar reunião
        </IonButton>
      </div>

      {/* Filtros por status */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        {([['', 'Todos'], ...Object.entries(ROTULO_STATUS_REUNIAO)] as [string, string][]).map(([s, label]) => {
          const cor = s ? STATUS_COR[s as StatusReuniao] : null;
          const ativo = filtroStatus === s;
          return (
            <button
              key={s}
              onClick={() => setFiltroStatus(s as StatusReuniao | '')}
              style={{
                padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontWeight: ativo ? 700 : 500,
                border: `1px solid ${cor?.color ?? '#bdbdbd'}`,
                background: ativo ? (cor?.bg ?? '#e0e0e0') : '#fff',
                color: ativo ? (cor?.color ?? '#333') : '#555',
                transition: 'all 0.15s',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {showForm && (
        <div className="painel-card" style={{ flexDirection: 'column', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Nova reunião</h3>
          <div className="form-row">
            <div className="form-field">
              <label>Empresa *</label>
              <select className="form-input" value={form.empresaId} onChange={(e) => setForm((p) => ({ ...p, empresaId: e.target.value }))}>
                <option value="">Selecione</option>
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome_empresa}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Título *</label>
              <input className="form-input" value={form.titulo} onChange={(e) => setForm((p) => ({ ...p, titulo: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Data *</label>
              <input className="form-input" type="date" value={form.data} onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Hora *</label>
              <div style={{ display: 'flex', gap: 6 }}>
                <select
                  className="form-input"
                  style={{ flex: 1 }}
                  value={form.horaH}
                  onChange={(e) => setForm((p) => ({ ...p, horaH: e.target.value }))}
                >
                  <option value="">hh</option>
                  {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0')).map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
                <select
                  className="form-input"
                  style={{ flex: 1 }}
                  value={form.horaM}
                  onChange={(e) => setForm((p) => ({ ...p, horaM: e.target.value }))}
                >
                  <option value="">mm</option>
                  {['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'].map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Local</label>
              <input className="form-input" value={form.localReuniao} onChange={(e) => setForm((p) => ({ ...p, localReuniao: e.target.value }))} />
            </div>
            <div className="form-field">
              <label>Observações</label>
              <input className="form-input" value={form.observacoes} onChange={(e) => setForm((p) => ({ ...p, observacoes: e.target.value }))} />
            </div>
          </div>
          {erro && <p className="form-erro">{erro}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <IonButton shape="round" color="secondary" onClick={handleAgendar}>Confirmar</IonButton>
            <IonButton shape="round" fill="outline" onClick={() => setShowForm(false)}>Cancelar</IonButton>
          </div>
        </div>
      )}

      {erro && !showForm && (
        <p style={{ fontSize: 13, padding: '8px 12px', marginBottom: 12, borderRadius: 6, background: '#fce4ec', color: '#c62828', border: '1px solid #ef9a9a' }}>{erro}</p>
      )}

      {!carregando && !erro && reunioes.length === 0 && (
        <div className="painel-vazio">Nenhuma reunião agendada ainda.</div>
      )}

      {datasOrdenadas.map((data) => {
        const [ano, mes, dia] = data.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;
        return (
          <div key={data} style={{ marginBottom: 24 }}>
            <div className="agenda-dia-header">{dataFormatada}</div>
            <div className="painel-lista">
              {grupos[data].map((r) => {
                const cor = STATUS_COR[r.status] ?? { bg: '#f5f5f5', color: '#888' };
                return (
                <div key={r.id} className="painel-card" style={{ borderLeft: `4px solid ${cor.color}` }}>
                  <div className="painel-card-info">
                    <div className="painel-card-titulo">
                      <h3 style={{ fontSize: 15 }}>{r.titulo}</h3>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: cor.bg, color: cor.color }}>
                        {ROTULO_STATUS_REUNIAO[r.status] ?? r.status}
                      </span>
                    </div>
                    <p className="painel-detalhe">{formatarDataHoraReuniao(r.data_hora)}</p>
                    {r.nome_empresa && <p className="painel-detalhe">Empresa: {r.nome_empresa}</p>}
                    {r.local_reuniao && <p className="painel-detalhe">Local: {r.local_reuniao}</p>}
                    {r.observacoes && <p className="painel-detalhe">{r.observacoes}</p>}
                  </div>
                  <div className="painel-card-acoes">
                    <select
                      className="form-input"
                      style={{ width: 'auto', height: 34, fontSize: 12 }}
                      value={r.status}
                      onChange={(e) => handleStatus(r.id, e.target.value as StatusReuniao)}
                    >
                      {(Object.keys(ROTULO_STATUS_REUNIAO) as StatusReuniao[]).map((s) => (
                        <option key={s} value={s}>{ROTULO_STATUS_REUNIAO[s]}</option>
                      ))}
                    </select>
                  </div>
                </div>
              );})}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgendaReuniones;
