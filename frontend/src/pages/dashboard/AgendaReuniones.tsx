import React, { useEffect, useState } from 'react';
import { IonButton } from '@ionic/react';
import {
  Reuniao,
  StatusReuniao,
  agendarReuniao,
  atualizarStatusReuniao,
  listarTodasReunioes,
} from '../../api/executivoApi';
import { listarEmpresasExecutivo } from '../../api/executivoApi';
import { Empresa } from '../../api/empresasApi';

const STATUS_COR: Record<StatusReuniao, { bg: string; color: string }> = {
  agendada: { bg: '#e8f0fe', color: '#1976d2' },
  realizada: { bg: '#e8f5e9', color: '#388e3c' },
  cancelada: { bg: '#fce4ec', color: '#c62828' },
};

function formatarDataHora(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'full', timeStyle: 'short' });
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
  const [form, setForm] = useState({
    empresaId: '',
    titulo: '',
    dataHora: '',
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

  const handleAgendar = async () => {
    if (!form.empresaId || !form.titulo || !form.dataHora) {
      setErro('Informe a empresa, título e data/hora.');
      return;
    }
    try {
      await agendarReuniao({
        empresaId: Number(form.empresaId),
        titulo: form.titulo,
        dataHora: form.dataHora,
        localReuniao: form.localReuniao || undefined,
        observacoes: form.observacoes || undefined,
      });
      await carregar();
      setForm({ empresaId: '', titulo: '', dataHora: '', localReuniao: '', observacoes: '' });
      setShowForm(false);
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao agendar.');
    }
  };

  const handleStatus = async (id: number, status: StatusReuniao) => {
    try {
      await atualizarStatusReuniao(id, status);
      setReunioes((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar.');
    }
  };

  const grupos = agruparPorData(reunioes.filter((r) => r.status !== 'cancelada'));
  const datasOrdenadas = Object.keys(grupos).sort();

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
              <label>Data e hora *</label>
              <input className="form-input" type="datetime-local" value={form.dataHora} onChange={(e) => setForm((p) => ({ ...p, dataHora: e.target.value }))} />
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

      {!carregando && reunioes.length === 0 && (
        <div className="painel-vazio">Nenhuma reunião agendada ainda.</div>
      )}

      {datasOrdenadas.map((data) => {
        const [ano, mes, dia] = data.split('-');
        const dataFormatada = `${dia}/${mes}/${ano}`;
        return (
          <div key={data} style={{ marginBottom: 24 }}>
            <div className="agenda-dia-header">{dataFormatada}</div>
            <div className="painel-lista">
              {grupos[data].map((r) => (
                <div key={r.id} className="painel-card" style={{ borderLeft: `4px solid ${STATUS_COR[r.status].color}` }}>
                  <div className="painel-card-info">
                    <div className="painel-card-titulo">
                      <h3 style={{ fontSize: 15 }}>{r.titulo}</h3>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: STATUS_COR[r.status].bg, color: STATUS_COR[r.status].color }}>
                        {r.status === 'agendada' ? 'Agendada' : r.status === 'realizada' ? 'Realizada' : 'Cancelada'}
                      </span>
                    </div>
                    <p className="painel-detalhe">{formatarDataHora(r.data_hora)}</p>
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
                      <option value="agendada">Agendada</option>
                      <option value="realizada">Realizada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgendaReuniones;
