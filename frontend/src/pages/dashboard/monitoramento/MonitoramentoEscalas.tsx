import React, { useEffect, useState } from 'react';
import './Monitoramento.css';
import { useToast } from '../../../components/ToastContext';
import {
  DadosPaciente,
  OpcoesEscala,
  Paciente,
  atualizarPaciente,
  criarPaciente,
  listarPacientes,
  obterOpcoesEscala,
} from '../../../api/escalaFaturamentoApi';
import LancamentoEscala from './LancamentoEscala';
import HistoricoSubstituicoes from './HistoricoSubstituicoes';

type Aba = 'escalas' | 'pacientes' | 'substituicoes';

// Cor por tipo de cadastro (identificação visual na lista de pacientes / locais)
const COR_TIPO = {
  paciente: { rotulo: 'Paciente', fundo: '#ecfeff', texto: '#0e7490', borda: '#a5f3fc', faixa: '#06b6d4' },
  local: { rotulo: 'Local', fundo: '#f5f3ff', texto: '#6d28d9', borda: '#ddd6fe', faixa: '#8b5cf6' },
} as const;

const TagTipo: React.FC<{ tipo: 'paciente' | 'local' }> = ({ tipo }) => {
  const c = COR_TIPO[tipo] ?? COR_TIPO.paciente;
  return (
    <span style={{ display: 'inline-block', padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700, background: c.fundo, color: c.texto, border: `1px solid ${c.borda}` }}>
      {tipo === 'local' ? '📍' : '🧑‍⚕️'} {c.rotulo}
    </span>
  );
};

// ── Modal: Paciente / Local ─────────────────────────────────────────────────
const ModalPaciente: React.FC<{
  paciente: Paciente | null;
  empresas: OpcoesEscala['empresas'];
  empresaPadrao?: number | null;
  onClose: () => void;
  onSalvo: (id: number) => void;
}> = ({ paciente, empresas, empresaPadrao = null, onClose, onSalvo }) => {
  const { showToast } = useToast();
  const [form, setForm] = useState<DadosPaciente>({
    nome: paciente?.nome ?? '',
    tipo: paciente?.tipo ?? 'paciente',
    empresaId: paciente ? paciente.empresa_id : empresaPadrao,
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

// ── Página ──────────────────────────────────────────────────────────────────
export const MonitoramentoEscalas: React.FC = () => {
  const [aba, setAba] = useState<Aba>('escalas');
  const [opcoes, setOpcoes] = useState<OpcoesEscala>({ cooperados: [], empresas: [], alocacoes: [], vagas: [] });
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [erro, setErro] = useState('');

  const [buscaPaciente, setBuscaPaciente] = useState('');

  const [modalPaciente, setModalPaciente] = useState<{ aberto: boolean; paciente: Paciente | null; empresaId?: number | null }>({ aberto: false, paciente: null });

  const carregarPacientes = async () => {
    try { setPacientes(await listarPacientes({ incluirInativos: aba === 'pacientes' })); }
    catch (e: any) { setErro(e?.message || 'Erro ao carregar pacientes / locais.'); }
  };

  useEffect(() => {
    obterOpcoesEscala().then(setOpcoes).catch((e) => setErro(e?.message || 'Erro ao carregar opções.'));
  }, []);

  useEffect(() => { carregarPacientes(); }, [aba]);

  const pacientesFiltrados = pacientes.filter((p) => {
    const b = buscaPaciente.trim().toLowerCase();
    if (!b) return true;
    return [p.nome, p.endereco, p.patologia, p.nome_empresa].some((v) => String(v || '').toLowerCase().includes(b));
  });

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
          <p>Lançamento de escalas por cooperado e paciente/local e cadastro dos pacientes e locais.</p>
        </div>
      </div>

      <div className="monitoramento-tabs-nav">
        <button type="button" className={`monitoramento-tab-btn ${aba === 'escalas' ? 'active' : ''}`} onClick={() => setAba('escalas')}>Lançamento de Escalas</button>
        <button type="button" className={`monitoramento-tab-btn ${aba === 'pacientes' ? 'active' : ''}`} onClick={() => setAba('pacientes')}>
          Pacientes / Locais <span className="monitoramento-tab-badge">{pacientes.length}</span>
        </button>
        <button type="button" className={`monitoramento-tab-btn ${aba === 'substituicoes' ? 'active' : ''}`} onClick={() => setAba('substituicoes')}>
          Histórico de Substituições
        </button>
      </div>

      {erro && <div style={{ padding: 14, background: '#fee2e2', color: '#991b1b', borderRadius: 10, marginBottom: 16 }}>{erro}</div>}

      {/* ── Aba: Lançamento de Escalas ── */}
      {aba === 'escalas' && (
        <LancamentoEscala
          opcoes={opcoes}
          pacientes={pacientes}
          onNovoPaciente={(empresaId) => setModalPaciente({ aberto: true, paciente: null, empresaId })}
        />
      )}

      {/* ── Aba: Histórico de Substituições / Coberturas ── */}
      {aba === 'substituicoes' && <HistoricoSubstituicoes opcoes={opcoes} />}

      {/* ── Aba: Pacientes / Locais ── */}
      {aba === 'pacientes' && (
        <div className="monitoramento-table-card">
          <div className="table-card-header">
            <div>
              <h3 className="table-card-title">Cadastro de pacientes e locais da escala</h3>
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}><TagTipo tipo="paciente" /><TagTipo tipo="local" /></div>
            </div>
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
                  <th>Status</th>
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
                  <tr key={p.id} style={{ background: (COR_TIPO[p.tipo] ?? COR_TIPO.paciente).fundo }}>
                    <td style={{ boxShadow: `inset 4px 0 0 ${(COR_TIPO[p.tipo] ?? COR_TIPO.paciente).faixa}` }}>
                      <strong>{p.nome}</strong>
                      <div style={{ marginTop: 3 }}><TagTipo tipo={p.tipo} /></div>
                    </td>
                    <td>
                      <span
                        className="badge-status"
                        style={p.ativo
                          ? { background: '#dcfce7', color: '#15803d', border: '1px solid #bbf7d0' }
                          : { background: '#fee2e2', color: '#b91c1c', border: '1px solid #fecaca' }}
                      >
                        {p.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
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

      {modalPaciente.aberto && (
        <ModalPaciente
          paciente={modalPaciente.paciente}
          empresas={opcoes.empresas}
          empresaPadrao={modalPaciente.empresaId ?? null}
          onClose={() => setModalPaciente({ aberto: false, paciente: null })}
          onSalvo={() => { setModalPaciente({ aberto: false, paciente: null }); carregarPacientes(); }}
        />
      )}
    </div>
  );
};

export default MonitoramentoEscalas;
