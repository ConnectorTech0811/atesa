import React, { useState } from 'react';
import { IonButton, IonModal, useIonViewWillEnter } from '@ionic/react';
import {
  Ocorrencia,
  NovaOcorrencia,
  TipoOcorrencia,
  GravidadeOcorrencia,
  StatusOcorrencia,
  ROTULO_TIPO_OCORRENCIA,
  ROTULO_GRAVIDADE,
  COR_GRAVIDADE,
  listarOcorrencias,
  criarOcorrencia,
  atualizarOcorrencia,
  listarEmpresasExecutivo,
} from '../../api/executivoApi';
import { Empresa } from '../../api/empresasApi';
import { dataHoje, formatarDataBR } from '../../utils/formatters';

const STATUS_COR: Record<StatusOcorrencia, { bg: string; color: string }> = {
  aberta:     { bg: '#fff3e0', color: '#e65100' },
  em_analise: { bg: '#e3f2fd', color: '#1565c0' },
  resolvida:  { bg: '#e8f5e9', color: '#2e7d32' },
  arquivada:  { bg: '#f5f5f5', color: '#757575' },
};

const ROTULO_STATUS: Record<StatusOcorrencia, string> = {
  aberta:     'Aberta',
  em_analise: 'Em Análise',
  resolvida:  'Resolvida',
  arquivada:  'Arquivada',
};

const FORM_VAZIO: NovaOcorrencia = {
  empresa_id: 0,
  cooperado_nome: '',
  tipo: 'outro',
  descricao: '',
  gravidade: 'normal',
  data_ocorrencia: dataHoje(),
};

const Ocorrencias: React.FC = () => {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Filtros
  const [filtroTipo, setFiltroTipo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [filtroEmpresa, setFiltroEmpresa] = useState('');

  // Nova ocorrência
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NovaOcorrencia>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [erroForm, setErroForm] = useState('');

  // Resolver ocorrência
  const [showResolver, setShowResolver] = useState(false);
  const [ocorrenciaSel, setOcorrenciaSel] = useState<Ocorrencia | null>(null);
  const [novoStatus, setNovoStatus] = useState<StatusOcorrencia>('resolvida');
  const [resolucao, setResolucao] = useState('');
  const [resolvendo, setResolvendo] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      const [lista, emps] = await Promise.all([
        listarOcorrencias(),
        listarEmpresasExecutivo().catch(() => [] as Empresa[]),
      ]);
      setOcorrencias(lista);
      setEmpresas(emps);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar ocorrências.');
    } finally {
      setCarregando(false);
    }
  };

  useIonViewWillEnter(() => { carregar(); });

  const handleSalvar = async () => {
    if (!form.empresa_id || !form.tipo || !form.descricao || !form.data_ocorrencia) {
      setErroForm('Preencha empresa, tipo, descrição e data.');
      return;
    }
    setSalvando(true);
    setErroForm('');
    try {
      await criarOcorrencia(form);
      setShowForm(false);
      setForm(FORM_VAZIO);
      await carregar();
    } catch (e) {
      setErroForm(e instanceof Error ? e.message : 'Erro ao registrar ocorrência.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirResolver = (oc: Ocorrencia) => {
    setOcorrenciaSel(oc);
    setNovoStatus('resolvida');
    setResolucao('');
    setShowResolver(true);
  };

  const handleResolver = async () => {
    if (!ocorrenciaSel) return;
    setResolvendo(true);
    try {
      await atualizarOcorrencia(ocorrenciaSel.id, { status: novoStatus, resolucao });
      setShowResolver(false);
      await carregar();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro ao atualizar ocorrência.');
    } finally {
      setResolvendo(false);
    }
  };

  // Filtro local
  const lista = ocorrencias.filter((o) => {
    if (filtroTipo && o.tipo !== filtroTipo) return false;
    if (filtroStatus && o.status !== filtroStatus) return false;
    if (filtroEmpresa && !o.nome_empresa.toLowerCase().includes(filtroEmpresa.toLowerCase())) return false;
    return true;
  });

  // Contadores por status
  const contadores = ocorrencias.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Ocorrências do Cooperado</h1>
          <p className="painel-subtitle">Registro e acompanhamento de ocorrências: faltas, atrasos, elogios e incidentes</p>
        </div>
        <IonButton shape="round" color="secondary" onClick={() => { setForm(FORM_VAZIO); setErroForm(''); setShowForm(true); }}>
          + Nova Ocorrência
        </IonButton>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        {(['aberta', 'em_analise', 'resolvida', 'arquivada'] as StatusOcorrencia[]).map((s) => (
          <div key={s} style={{
            flex: '1 1 140px', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
            padding: '14px 16px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: STATUS_COR[s].color }}>{contadores[s] ?? 0}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{ROTULO_STATUS[s]}</div>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <input className="painel-busca" value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value)}
          placeholder="Filtrar por empresa..." style={{ flex: '1 1 200px', minWidth: 0 }} />
        <select className="modal-input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ flex: '0 0 160px' }}>
          <option value="">Todos os tipos</option>
          {(Object.entries(ROTULO_TIPO_OCORRENCIA) as [TipoOcorrencia, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
        <select className="modal-input" value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)} style={{ flex: '0 0 160px' }}>
          <option value="">Todos os status</option>
          {(Object.entries(ROTULO_STATUS) as [StatusOcorrencia, string][]).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Lista */}
      {carregando && <div style={{ textAlign: 'center', color: '#888', padding: 40 }}>Carregando...</div>}
      {!carregando && erro && <div style={{ color: '#c62828', padding: 16 }}>⚠ {erro}</div>}
      {!carregando && lista.length === 0 && (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <p>Nenhuma ocorrência encontrada.</p>
        </div>
      )}

      {lista.map((oc) => {
        const corGrav = COR_GRAVIDADE[oc.gravidade];
        const corStatus = STATUS_COR[oc.status];
        return (
          <div key={oc.id} style={{
            background: '#fff', border: '1px solid #e0e0e0', borderRadius: 12,
            padding: '16px 20px', marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            borderLeft: `4px solid ${corGrav.color}`,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#222' }}>{oc.nome_empresa}</span>
                  {oc.cooperado_nome && <span style={{ fontSize: 12, color: '#666' }}>· {oc.cooperado_nome}</span>}
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: corGrav.bg, color: corGrav.color, fontWeight: 600 }}>
                    {ROTULO_GRAVIDADE[oc.gravidade]}
                  </span>
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#f0f4ff', color: '#3949ab', fontWeight: 600 }}>
                    {ROTULO_TIPO_OCORRENCIA[oc.tipo]}
                  </span>
                </div>
                <p style={{ margin: '0 0 6px', fontSize: 13, color: '#444', lineHeight: 1.5 }}>{oc.descricao}</p>
                {oc.resolucao && (
                  <p style={{ margin: '0 0 6px', fontSize: 12, color: '#2e7d32', background: '#f1f8e9', borderRadius: 6, padding: '4px 8px' }}>
                    ✓ Resolução: {oc.resolucao}
                  </p>
                )}
                <div style={{ fontSize: 11, color: '#aaa' }}>
                  {formatarDataBR(oc.data_ocorrencia)} · por {oc.registrada_por_nome}
                  {oc.resolvida_em && ` · resolvida em ${formatarDataBR(oc.resolvida_em.substring(0, 10))}`}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
                <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 12, background: corStatus.bg, color: corStatus.color, fontWeight: 700 }}>
                  {ROTULO_STATUS[oc.status]}
                </span>
                {oc.status !== 'resolvida' && oc.status !== 'arquivada' && (
                  <button className="btn-secundario" style={{ fontSize: 11 }} onClick={() => abrirResolver(oc)}>
                    Atualizar status
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      {/* ── Modal: Nova ocorrência ── */}
      <IonModal className="modal-grande" isOpen={showForm} onDidDismiss={() => setShowForm(false)}>
        <div className="modal-form">
          <h2>Nova Ocorrência</h2>

          <div className="modal-campo">
            <label>Empresa *</label>
            <select className="modal-input" value={form.empresa_id || ''}
              onChange={(e) => setForm(f => ({ ...f, empresa_id: Number(e.target.value) }))}>
              <option value="">Selecione a empresa...</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>{e.nome_empresa}</option>
              ))}
            </select>
          </div>
          <div className="modal-campo">
            <label>Nome do Cooperado</label>
            <input type="text" className="modal-input" value={form.cooperado_nome ?? ''}
              onChange={(e) => setForm(f => ({ ...f, cooperado_nome: e.target.value }))} placeholder="Nome do cooperado (opcional)" />
          </div>
          <div className="modal-campo">
            <label>Tipo *</label>
            <select className="modal-input" value={form.tipo} onChange={(e) => setForm(f => ({ ...f, tipo: e.target.value as TipoOcorrencia }))}>
              {(Object.entries(ROTULO_TIPO_OCORRENCIA) as [TipoOcorrencia, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="modal-campo">
            <label>Gravidade</label>
            <select className="modal-input" value={form.gravidade} onChange={(e) => setForm(f => ({ ...f, gravidade: e.target.value as GravidadeOcorrencia }))}>
              {(Object.entries(ROTULO_GRAVIDADE) as [GravidadeOcorrencia, string][]).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="modal-campo">
            <label>Data da Ocorrência *</label>
            <input type="date" className="modal-input" value={form.data_ocorrencia} max={dataHoje()}
              onChange={(e) => setForm(f => ({ ...f, data_ocorrencia: e.target.value }))} />
          </div>
          <div className="modal-campo">
            <label>Descrição *</label>
            <textarea className="modal-input" rows={4} value={form.descricao}
              onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))}
              placeholder="Descreva a ocorrência com detalhes..." style={{ resize: 'vertical' }} />
          </div>

          {erroForm && <p style={{ color: '#c62828', fontSize: 13 }}>⚠ {erroForm}</p>}
          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowForm(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Registrar Ocorrência'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* ── Modal: Atualizar status ── */}
      <IonModal className="modal-pequeno" isOpen={showResolver} onDidDismiss={() => setShowResolver(false)}>
        <div className="modal-form" style={{ padding: 28 }}>
          <h2 style={{ marginBottom: 16 }}>Atualizar Ocorrência</h2>
          <div className="modal-campo">
            <label>Novo status</label>
            <select className="modal-input" value={novoStatus} onChange={(e) => setNovoStatus(e.target.value as StatusOcorrencia)}>
              <option value="em_analise">Em Análise</option>
              <option value="resolvida">Resolvida</option>
              <option value="arquivada">Arquivada</option>
            </select>
          </div>
          <div className="modal-campo">
            <label>Resolução / Observação</label>
            <textarea className="modal-input" rows={3} value={resolucao}
              onChange={(e) => setResolucao(e.target.value)} placeholder="Descreva como foi resolvido ou qual encaminhamento..." style={{ resize: 'vertical' }} />
          </div>
          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowResolver(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={handleResolver} disabled={resolvendo}>
              {resolvendo ? 'Salvando...' : 'Salvar'}
            </IonButton>
          </div>
        </div>
      </IonModal>
    </div>
  );
};

export default Ocorrencias;
