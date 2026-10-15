import React, { useEffect, useMemo, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import { dataLocalISO, formatarDataBR } from '../../../utils/formatters';
import {
  ConferenciaPlantao,
  DadosEscala,
  DadosPaciente,
  Escala,
  OpcoesEscala,
  Paciente,
  StatusEscala,
  atualizarEscala,
  atualizarPaciente,
  criarEscala,
  criarPaciente,
  excluirEscala,
  listarEscalas,
  listarPacientes,
  obterConferenciaPlantoes,
  obterOpcoesEscala,
} from '../../../api/escalaFaturamentoApi';

type Aba = 'escalas' | 'pacientes' | 'conferencia';

const hojeISO = dataLocalISO();
const primeiroDiaMes = `${hojeISO.slice(0, 8)}01`;
const ultimoDiaMes = (() => {
  const [a, m] = hojeISO.split('-').map(Number);
  return `${hojeISO.slice(0, 8)}${String(new Date(a, m, 0).getDate()).padStart(2, '0')}`;
})();

const fmtHoras = (min: number) => {
  const sinal = min < 0 ? '-' : '';
  const m = Math.abs(Math.round(min));
  return `${sinal}${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// Mesma regra do backend: diurno se o plantão começa entre 07:00 e 18:59
const turnoDaHora = (h: string) => {
  const hh = Number(String(h).slice(0, 2));
  if (Number.isNaN(hh)) return null;
  return hh >= 7 && hh < 19 ? 'diurno' : 'noturno';
};

const ROTULO_STATUS: Record<StatusEscala, string> = { prevista: 'Prevista', realizada: 'Realizada', cancelada: 'Cancelada' };

const BadgeTurno: React.FC<{ turno: string }> = ({ turno }) => (
  <span
    className="badge-status"
    style={turno === 'noturno'
      ? { background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe' }
      : { background: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}
  >
    {turno === 'noturno' ? '🌙 Noturno' : '☀️ Diurno'}
  </span>
);

// ── Modal: Paciente / Local ─────────────────────────────────────────────────
const ModalPaciente: React.FC<{
  paciente: Paciente | null;
  empresas: OpcoesEscala['empresas'];
  onClose: () => void;
  onSalvo: (id: number) => void;
}> = ({ paciente, empresas, onClose, onSalvo }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<DadosPaciente>({
    nome: paciente?.nome ?? '',
    tipo: paciente?.tipo ?? 'paciente',
    empresaId: paciente?.empresa_id ?? null,
    endereco: paciente?.endereco ?? '',
    patologia: paciente?.patologia ?? '',
    cuidados: paciente?.cuidados ?? '',
    observacoes: paciente?.observacoes ?? '',
    ativo: paciente ? !!paciente.ativo : true,
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');
  const upd = (k: keyof DadosPaciente, v: unknown) => setForm((p) => ({ ...p, [k]: v }));

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome.trim()) { setErro('Informe o nome.'); return; }
    setSalvando(true);
    setErro('');
    try {
      const r = paciente ? await atualizarPaciente(paciente.id, form) : await criarPaciente(form);
      showToast(paciente ? 'Cadastro atualizado.' : 'Paciente / local cadastrado.', 'success');
      onSalvo(r.id);
    } catch (err: any) {
      setErro(err?.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const ehPaciente = form.tipo === 'paciente';

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h3>{paciente ? 'Editar' : 'Cadastrar'} {ehPaciente ? 'Paciente' : 'Local'} da Escala</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <form onSubmit={salvar}>
          <div className="modal-dialog-body">
            {erro && <div className="modal-alert-box" style={{ background: '#fee2e2', color: '#991b1b' }}>{erro}</div>}
            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Tipo *</label>
                <select value={form.tipo} onChange={(e) => upd('tipo', e.target.value)}>
                  <option value="paciente">Paciente (home care / atendimento)</option>
                  <option value="local">Local / Posto</option>
                </select>
              </div>
              <div className="modal-form-group">
                <label>Cliente (empresa)</label>
                <select value={form.empresaId ?? ''} onChange={(e) => upd('empresaId', e.target.value ? Number(e.target.value) : null)}>
                  <option value="">— Não vinculado —</option>
                  {empresas.map((em) => <option key={em.id} value={em.id}>{em.nome_empresa}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-form-group">
              <label>{ehPaciente ? 'Nome do paciente *' : 'Nome do local *'}</label>
              <input type="text" value={form.nome} onChange={(e) => upd('nome', e.target.value)} required />
            </div>
            <div className="modal-form-group">
              <label>{ehPaciente ? 'Endereço do paciente' : 'Endereço do local'}</label>
              <input type="text" placeholder="Rua, número, bairro, cidade" value={form.endereco ?? ''} onChange={(e) => upd('endereco', e.target.value)} />
            </div>
            {ehPaciente && (
              <>
                <div className="modal-form-group">
                  <label>Patologia</label>
                  <textarea rows={2} placeholder="Ex.: Alzheimer, pós-AVC, diabetes tipo 2..." value={form.patologia ?? ''} onChange={(e) => upd('patologia', e.target.value)} />
                </div>
                <div className="modal-form-group">
                  <label>Cuidados do paciente</label>
                  <textarea rows={3} placeholder="Ex.: mudança de decúbito 2/2h, medicação às 8h e 20h, dieta pastosa..." value={form.cuidados ?? ''} onChange={(e) => upd('cuidados', e.target.value)} />
                </div>
              </>
            )}
            <div className="modal-form-group">
              <label>Observações</label>
              <textarea rows={2} value={form.observacoes ?? ''} onChange={(e) => upd('observacoes', e.target.value)} />
            </div>
            {paciente && (
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13 }}>
                <input type="checkbox" checked={!!form.ativo} onChange={(e) => upd('ativo', e.target.checked)} />
                Cadastro ativo (desmarque para ocultar das novas escalas)
              </label>
            )}
          </div>
          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Modal: Lançamento de Escala ─────────────────────────────────────────────
const ModalEscala: React.FC<{
  escala: Escala | null;
  opcoes: OpcoesEscala;
  pacientes: Paciente[];
  onNovoPaciente: () => void;
  onClose: () => void;
  onSalvo: () => void;
}> = ({ escala, opcoes, pacientes, onNovoPaciente, onClose, onSalvo }) => {
  const { showToast } = useToast();
  const [candidatoId, setCandidatoId] = useState<number | ''>(escala?.candidato_id ?? '');
  const [pacienteId, setPacienteId] = useState<number | ''>(escala?.paciente_id ?? '');
  const [alocacaoId, setAlocacaoId] = useState<number | ''>(escala?.alocacao_id ?? '');
  const [datasTexto, setDatasTexto] = useState<string[]>([escala?.data?.slice(0, 10) ?? hojeISO]);
  const [horaInicio, setHoraInicio] = useState(escala?.hora_inicio?.slice(0, 5) ?? '07:00');
  const [horaFim, setHoraFim] = useState(escala?.hora_fim?.slice(0, 5) ?? '19:00');
  const [status, setStatus] = useState<StatusEscala>(escala?.status ?? 'prevista');
  const [observacao, setObservacao] = useState(escala?.observacao ?? '');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  const alocacoesCoop = opcoes.alocacoes.filter((a) => a.candidato_id === candidatoId);
  const pacienteSel = pacientes.find((p) => p.id === pacienteId);
  const turno = turnoDaHora(horaInicio);

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    if (!candidatoId) { setErro('Selecione o cooperado.'); return; }
    if (!pacienteId) { setErro('Selecione o paciente / local.'); return; }
    const datas = datasTexto.filter(Boolean);
    if (datas.length === 0) { setErro('Informe ao menos uma data.'); return; }
    const dados: DadosEscala = {
      candidatoId: Number(candidatoId),
      pacienteId: Number(pacienteId),
      alocacaoId: alocacaoId ? Number(alocacaoId) : null,
      horaInicio,
      horaFim,
      status,
      observacao,
    };
    setSalvando(true);
    try {
      if (escala) {
        await atualizarEscala(escala.id, { ...dados, data: datas[0] });
        showToast('Escala atualizada.', 'success');
      } else {
        const r = await criarEscala({ ...dados, datas });
        showToast(r.ids.length > 1 ? `${r.ids.length} plantões lançados.` : 'Plantão lançado na escala.', 'success');
      }
      onSalvo();
    } catch (err: any) {
      setErro(err?.message || 'Erro ao salvar escala.');
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay-custom" onClick={onClose}>
      <div className="modal-dialog-custom" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-dialog-header">
          <h3>{escala ? 'Editar Plantão' : 'Lançamento de Escala'}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Fechar">✕</button>
        </div>
        <form onSubmit={salvar}>
          <div className="modal-dialog-body">
            {erro && <div className="modal-alert-box" style={{ background: '#fee2e2', color: '#991b1b' }}>{erro}</div>}

            <div className="modal-form-group">
              <label>Cooperado *</label>
              <select value={candidatoId} onChange={(e) => { setCandidatoId(e.target.value ? Number(e.target.value) : ''); setAlocacaoId(''); }} required>
                <option value="">— Selecione —</option>
                {opcoes.cooperados.map((c) => <option key={c.id} value={c.id}>{c.nome} — Mat. {c.matricula}</option>)}
              </select>
            </div>

            {alocacoesCoop.length > 1 && (
              <div className="modal-form-group">
                <label>Alocação / Posto (para o faturamento)</label>
                <select value={alocacaoId} onChange={(e) => setAlocacaoId(e.target.value ? Number(e.target.value) : '')}>
                  <option value="">— Automático —</option>
                  {alocacoesCoop.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.nome_empresa} · {a.cargo || 'Sem cargo'} · {a.nome_unidade || ''} {a.status !== 'ativa' ? `(${a.status})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="modal-form-group">
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Paciente / Local *</span>
                <button type="button" className="btn-action-view" style={{ padding: '2px 10px', fontSize: 12 }} onClick={onNovoPaciente}>+ Novo paciente / local</button>
              </label>
              <select value={pacienteId} onChange={(e) => setPacienteId(e.target.value ? Number(e.target.value) : '')} required>
                <option value="">— Selecione —</option>
                {pacientes.map((p) => (
                  <option key={p.id} value={p.id}>{p.tipo === 'local' ? '📍' : '🧑‍⚕️'} {p.nome}{p.nome_empresa ? ` — ${p.nome_empresa}` : ''}</option>
                ))}
              </select>
              {pacienteSel && (
                <div style={{ marginTop: 8, padding: '10px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12, color: '#334155', lineHeight: 1.5 }}>
                  {pacienteSel.endereco && <div><strong>Endereço:</strong> {pacienteSel.endereco}</div>}
                  {pacienteSel.patologia && <div><strong>Patologia:</strong> {pacienteSel.patologia}</div>}
                  {pacienteSel.cuidados && <div><strong>Cuidados:</strong> {pacienteSel.cuidados}</div>}
                  {!pacienteSel.endereco && !pacienteSel.patologia && !pacienteSel.cuidados && <div style={{ color: '#94a3b8' }}>Sem informações adicionais no cadastro.</div>}
                </div>
              )}
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Hora início *</label>
                <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} required />
              </div>
              <div className="modal-form-group">
                <label>Hora fim *</label>
                <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)} required />
              </div>
              <div className="modal-form-group">
                <label>Turno (automático)</label>
                <div style={{ paddingTop: 8 }}>{turno ? <BadgeTurno turno={turno} /> : '—'}</div>
              </div>
            </div>

            <div className="modal-form-group">
              <label>{escala ? 'Data *' : 'Data(s) do plantão *'}</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {datasTexto.map((d, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6 }}>
                    <input type="date" value={d} style={{ flex: 1 }} onChange={(e) => setDatasTexto((l) => l.map((x, j) => (j === i ? e.target.value : x)))} required={i === 0} />
                    {!escala && datasTexto.length > 1 && (
                      <button type="button" className="btn-cancel" style={{ padding: '0 12px' }} onClick={() => setDatasTexto((l) => l.filter((_, j) => j !== i))}>✕</button>
                    )}
                  </div>
                ))}
                {!escala && (
                  <button type="button" className="btn-action-view" style={{ alignSelf: 'flex-start' }} onClick={() => setDatasTexto((l) => [...l, ''])}>
                    + Adicionar outra data (mesmo horário)
                  </button>
                )}
              </div>
            </div>

            <div className="modal-form-row">
              <div className="modal-form-group">
                <label>Situação</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as StatusEscala)}>
                  <option value="prevista">Prevista</option>
                  <option value="realizada">Realizada</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </div>
            </div>
            <div className="modal-form-group">
              <label>Observação</label>
              <textarea rows={2} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>
          </div>
          <div className="modal-dialog-footer">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={salvando}>Cancelar</button>
            <button type="submit" className="btn-save-ajuste" disabled={salvando}>{salvando ? 'Salvando...' : 'Salvar Escala'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Página ──────────────────────────────────────────────────────────────────
export const MonitoramentoEscalas: React.FC = () => {
  const { showToast } = useToast();
  const [aba, setAba] = useState<Aba>('escalas');
  const [opcoes, setOpcoes] = useState<OpcoesEscala>({ cooperados: [], empresas: [], alocacoes: [] });
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [escalas, setEscalas] = useState<Escala[]>([]);
  const [conferencia, setConferencia] = useState<ConferenciaPlantao[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');

  const [dataInicio, setDataInicio] = useState(primeiroDiaMes);
  const [dataFim, setDataFim] = useState(ultimoDiaMes);
  const [filtroCooperado, setFiltroCooperado] = useState<number | ''>('');
  const [filtroEmpresa, setFiltroEmpresa] = useState<number | ''>('');
  const [filtroTurno, setFiltroTurno] = useState<'' | 'diurno' | 'noturno'>('');
  const [buscaPaciente, setBuscaPaciente] = useState('');

  const [modalEscala, setModalEscala] = useState<{ aberto: boolean; escala: Escala | null }>({ aberto: false, escala: null });
  const [modalPaciente, setModalPaciente] = useState<{ aberto: boolean; paciente: Paciente | null }>({ aberto: false, paciente: null });

  const carregarPacientes = async () => {
    try { setPacientes(await listarPacientes({ incluirInativos: aba === 'pacientes' })); } catch { /* exibido nas outras chamadas */ }
  };

  useEffect(() => {
    obterOpcoesEscala().then(setOpcoes).catch((e) => setErro(e?.message || 'Erro ao carregar opções.'));
  }, []);

  const carregar = async () => {
    setCarregando(true);
    setErro('');
    try {
      if (aba === 'escalas') {
        setEscalas(await listarEscalas({
          dataInicio, dataFim,
          candidatoId: filtroCooperado || undefined,
          empresaId: filtroEmpresa || undefined,
          turno: filtroTurno,
        }));
      } else if (aba === 'conferencia') {
        setConferencia(await obterConferenciaPlantoes({
          dataInicio, dataFim,
          candidatoId: filtroCooperado || undefined,
          empresaId: filtroEmpresa || undefined,
        }));
      }
      await carregarPacientes();
    } catch (e: any) {
      setErro(e?.message || 'Erro ao carregar dados da escala.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregar(); }, [aba, dataInicio, dataFim, filtroCooperado, filtroEmpresa, filtroTurno]);

  const handleExcluir = async (e: Escala) => {
    if (!window.confirm(`Excluir o plantão de ${e.cooperado_nome} em ${formatarDataBR(e.data)} (${e.hora_inicio.slice(0, 5)}–${e.hora_fim.slice(0, 5)})?`)) return;
    try {
      await excluirEscala(e.id);
      showToast('Plantão excluído.', 'success');
      carregar();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir.', 'error');
    }
  };

  const resumo = useMemo(() => {
    const validas = escalas.filter((e) => e.status !== 'cancelada');
    const d = validas.filter((e) => e.turno === 'diurno');
    const n = validas.filter((e) => e.turno === 'noturno');
    return {
      diurnos: d.length,
      minDiurnos: d.reduce((s, e) => s + e.duracao_minutos, 0),
      noturnos: n.length,
      minNoturnos: n.reduce((s, e) => s + e.duracao_minutos, 0),
    };
  }, [escalas]);

  const pacientesFiltrados = pacientes.filter((p) => {
    const b = buscaPaciente.trim().toLowerCase();
    if (!b) return true;
    return [p.nome, p.endereco, p.patologia, p.nome_empresa].some((v) => String(v || '').toLowerCase().includes(b));
  });

  const filtrosPeriodo = (
    <div className="monitoramento-filters-card">
      <div className="filter-item" style={{ minWidth: 140 }}>
        <label>Data início</label>
        <input type="date" className="filter-input" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
      </div>
      <div className="filter-item" style={{ minWidth: 140 }}>
        <label>Data fim</label>
        <input type="date" className="filter-input" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      </div>
      <div className="filter-item" style={{ flex: 2, minWidth: 200 }}>
        <label>Cooperado</label>
        <select className="filter-select" value={filtroCooperado} onChange={(e) => setFiltroCooperado(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Todos</option>
          {opcoes.cooperados.map((c) => <option key={c.id} value={c.id}>{c.nome} — {c.matricula}</option>)}
        </select>
      </div>
      <div className="filter-item" style={{ flex: 2, minWidth: 180 }}>
        <label>Cliente (empresa)</label>
        <select className="filter-select" value={filtroEmpresa} onChange={(e) => setFiltroEmpresa(e.target.value ? Number(e.target.value) : '')}>
          <option value="">Todos</option>
          {opcoes.empresas.map((em) => <option key={em.id} value={em.id}>{em.nome_empresa}</option>)}
        </select>
      </div>
      {aba === 'escalas' && (
        <div className="filter-item" style={{ minWidth: 130 }}>
          <label>Turno</label>
          <select className="filter-select" value={filtroTurno} onChange={(e) => setFiltroTurno(e.target.value as any)}>
            <option value="">Todos</option>
            <option value="diurno">Diurno</option>
            <option value="noturno">Noturno</option>
          </select>
        </div>
      )}
    </div>
  );

  return (
    <div className="monitoramento-container">
      <div className="monitoramento-header">
        <div className="monitoramento-title-group">
          <h1>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#4a9e4f" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            Escalas de Plantão
          </h1>
          <p>Lançamento de escalas por cooperado e paciente/local, cadastro do paciente e conferência das horas de plantão diurno e noturno.</p>
        </div>
      </div>

      <div className="monitoramento-tabs-nav">
        <button type="button" className={`monitoramento-tab-btn ${aba === 'escalas' ? 'active' : ''}`} onClick={() => setAba('escalas')}>Lançamento de Escalas</button>
        <button type="button" className={`monitoramento-tab-btn ${aba === 'pacientes' ? 'active' : ''}`} onClick={() => setAba('pacientes')}>
          Pacientes / Locais <span className="monitoramento-tab-badge">{pacientes.length}</span>
        </button>
        <button type="button" className={`monitoramento-tab-btn ${aba === 'conferencia' ? 'active' : ''}`} onClick={() => setAba('conferencia')}>Conferência de Plantões</button>
      </div>

      {erro && <div style={{ padding: 14, background: '#fee2e2', color: '#991b1b', borderRadius: 10, marginBottom: 16 }}>{erro}</div>}

      {/* ── Aba: Lançamento de Escalas ── */}
      {aba === 'escalas' && (
        <>
          {filtrosPeriodo}
          <div className="monitoramento-cards-grid">
            <div className="metric-card card-amber">
              <div className="metric-card-accent" />
              <div className="metric-card-header"><span className="metric-card-title">Plantões Diurnos</span></div>
              <div className="metric-card-value">{resumo.diurnos}</div>
              <div className="metric-card-subtitle">{fmtHoras(resumo.minDiurnos)} h na escala</div>
            </div>
            <div className="metric-card card-indigo">
              <div className="metric-card-accent" />
              <div className="metric-card-header"><span className="metric-card-title">Plantões Noturnos</span></div>
              <div className="metric-card-value">{resumo.noturnos}</div>
              <div className="metric-card-subtitle">{fmtHoras(resumo.minNoturnos)} h na escala</div>
            </div>
          </div>

          <div className="monitoramento-table-card">
            <div className="table-card-header">
              <h3 className="table-card-title">Plantões lançados <span className="table-card-count">{escalas.length}</span></h3>
              <button type="button" className="btn-primary-filter" onClick={() => setModalEscala({ aberto: true, escala: null })}>+ Lançar Escala</button>
            </div>
            <div className="table-responsive">
              <table className="monitoramento-table">
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Horário</th>
                    <th>Turno</th>
                    <th>Cooperado</th>
                    <th>Paciente / Local</th>
                    <th>Cliente</th>
                    <th>Situação</th>
                    <th style={{ textAlign: 'center' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {carregando && escalas.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Carregando...</td></tr>
                  ) : escalas.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Nenhum plantão lançado no período.</td></tr>
                  ) : escalas.map((e) => (
                    <tr key={e.id} style={e.status === 'cancelada' ? { opacity: 0.55 } : undefined}>
                      <td><strong>{formatarDataBR(e.data)}</strong></td>
                      <td>{e.hora_inicio.slice(0, 5)} – {e.hora_fim.slice(0, 5)} <span style={{ color: '#94a3b8', fontSize: 12 }}>({fmtHoras(e.duracao_minutos)}h)</span></td>
                      <td><BadgeTurno turno={e.turno} /></td>
                      <td>{e.cooperado_nome}<div style={{ fontSize: 11, color: '#94a3b8' }}>Mat. {e.matricula}</div></td>
                      <td>
                        {e.paciente_nome || '—'}
                        {e.paciente_patologia && <div style={{ fontSize: 11, color: '#64748b' }}>Patologia: {e.paciente_patologia}</div>}
                      </td>
                      <td>{e.nome_empresa || '—'}</td>
                      <td>{ROTULO_STATUS[e.status]}</td>
                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button type="button" className="btn-action-edit" onClick={() => setModalEscala({ aberto: true, escala: e })}>Editar</button>{' '}
                        <button type="button" onClick={() => handleExcluir(e)} style={{ color: '#dc2626', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 600 }}>✕ Excluir</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Aba: Pacientes / Locais ── */}
      {aba === 'pacientes' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <h3 className="table-card-title">Cadastro de pacientes e locais da escala</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input className="filter-input" style={{ minWidth: 220 }} placeholder="Buscar nome, endereço, patologia..." value={buscaPaciente} onChange={(e) => setBuscaPaciente(e.target.value)} />
              <button type="button" className="btn-primary-filter" onClick={() => setModalPaciente({ aberto: true, paciente: null })}>+ Novo Paciente / Local</button>
            </div>
          </div>
          <div className="table-responsive">
            <table className="monitoramento-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Endereço</th>
                  <th>Patologia</th>
                  <th>Cuidados</th>
                  <th style={{ textAlign: 'center' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {pacientesFiltrados.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>Nenhum paciente / local cadastrado.</td></tr>
                ) : pacientesFiltrados.map((p) => (
                  <tr key={p.id} style={!p.ativo ? { opacity: 0.55 } : undefined}>
                    <td><strong>{p.nome}</strong>{!p.ativo && <div style={{ fontSize: 11, color: '#dc2626' }}>Inativo</div>}</td>
                    <td>{p.tipo === 'local' ? 'Local' : 'Paciente'}</td>
                    <td>{p.nome_empresa || '—'}</td>
                    <td>{p.endereco || '—'}</td>
                    <td style={{ maxWidth: 220 }}>{p.patologia || '—'}</td>
                    <td style={{ maxWidth: 260 }}>{p.cuidados || '—'}</td>
                    <td style={{ textAlign: 'center' }}>
                      <button type="button" className="btn-action-edit" onClick={() => setModalPaciente({ aberto: true, paciente: p })}>Editar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Aba: Conferência de Plantões (Supervisão) ── */}
      {aba === 'conferencia' && (
        <>
          {filtrosPeriodo}
          <div className="monitoramento-table-card">
            <div className="table-card-header">
              <div>
                <h3 className="table-card-title">Conferência de horas de plantão</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: 13, color: '#64748b' }}>
                  Horas previstas na escala (diurno: início 07:00–18:59 · noturno: início 19:00–06:59) comparadas às horas apontadas no App.
                </p>
              </div>
            </div>
            <div className="table-responsive">
              <table className="monitoramento-table">
                <thead>
                  <tr>
                    <th>Cooperado</th>
                    <th style={{ textAlign: 'center' }}>Plantões Diurnos</th>
                    <th style={{ textAlign: 'center' }}>Horas Diurnas</th>
                    <th style={{ textAlign: 'center' }}>Plantões Noturnos</th>
                    <th style={{ textAlign: 'center' }}>Horas Noturnas</th>
                    <th style={{ textAlign: 'center' }}>Total Escala</th>
                    <th style={{ textAlign: 'center' }}>Horas Apontadas</th>
                    <th style={{ textAlign: 'center' }}>Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {conferencia.length === 0 ? (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#94a3b8' }}>{carregando ? 'Carregando...' : 'Nenhum plantão na escala para o período.'}</td></tr>
                  ) : conferencia.map((c) => (
                    <tr key={c.candidato_id}>
                      <td><strong>{c.cooperado_nome}</strong><div style={{ fontSize: 11, color: '#94a3b8' }}>Mat. {c.matricula}</div></td>
                      <td style={{ textAlign: 'center' }}>{c.plantoes_diurnos}</td>
                      <td style={{ textAlign: 'center' }}>{fmtHoras(c.minutos_diurnos)}</td>
                      <td style={{ textAlign: 'center' }}>{c.plantoes_noturnos}</td>
                      <td style={{ textAlign: 'center' }}>{fmtHoras(c.minutos_noturnos)}</td>
                      <td style={{ textAlign: 'center' }}><strong>{fmtHoras(c.minutos_escala)}</strong></td>
                      <td style={{ textAlign: 'center' }}>{fmtHoras(c.minutos_apontados)}</td>
                      <td style={{ textAlign: 'center', fontWeight: 700, color: c.diferenca_minutos < 0 ? '#dc2626' : c.diferenca_minutos > 0 ? '#15803d' : '#64748b' }}>
                        {c.diferenca_minutos > 0 ? '+' : ''}{fmtHoras(c.diferenca_minutos)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {modalEscala.aberto && (
        <ModalEscala
          escala={modalEscala.escala}
          opcoes={opcoes}
          pacientes={pacientes.filter((p) => p.ativo || p.id === modalEscala.escala?.paciente_id)}
          onNovoPaciente={() => setModalPaciente({ aberto: true, paciente: null })}
          onClose={() => setModalEscala({ aberto: false, escala: null })}
          onSalvo={() => { setModalEscala({ aberto: false, escala: null }); carregar(); }}
        />
      )}
      {modalPaciente.aberto && (
        <ModalPaciente
          paciente={modalPaciente.paciente}
          empresas={opcoes.empresas}
          onClose={() => setModalPaciente({ aberto: false, paciente: null })}
          onSalvo={() => { setModalPaciente({ aberto: false, paciente: null }); carregarPacientes(); }}
        />
      )}
    </div>
  );
};

export default MonitoramentoEscalas;
