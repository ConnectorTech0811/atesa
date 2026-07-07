import React, { useEffect, useState } from 'react';
import { IonButton, IonModal } from '@ionic/react';
import { useAuth } from '../../auth/AuthContext';
import { Empresa } from '../../api/empresasApi';
import {
  ContatoTrabalho,
  ParametrosTrabalho,
  Reuniao,
  ROTULO_STATUS_NEGOCIO,
  ROTULO_STATUS_TRABALHO,
  ROTULO_TIPO_CONTATO,
  StatusNegocio,
  StatusReuniao,
  StatusTrabalho,
  Trabalho,
  TipoContato,
  adicionarContato,
  agendarReuniao,
  atualizarDadosEmpresa,
  atualizarStatusReuniao,
  atualizarTrabalho,
  criarTrabalho,
  listarContatos,
  listarEmpresasExecutivo,
  listarReunioesPorEmpresa,
  listarTrabalhos,
  obterParametros,
  salvarParametros,
} from '../../api/executivoApi';
import { formatarCEP, formatarCNPJ, formatarDataBR, formatarTelefone } from '../../utils/formatters';

type Aba = 'dados' | 'trabalhos' | 'reunioes';
type AbaTrabalho = 'contatos' | 'parametros';

const STATUS_CORES: Record<StatusTrabalho, string> = {
  em_aberto: '#888',
  em_andamento: '#4a9e4f',
  proposta_enviada: '#1976d2',
  proposta_aceita: '#388e3c',
  fechado: '#555',
  cancelado: '#cf3c4f',
};

function dataHoje() {
  return new Date().toISOString().substring(0, 10);
}

function formatarDataHora(iso: string) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' });
}

const PainelExecutivo: React.FC = () => {
  const { usuario } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');

  // Modal de ações
  const [showModal, setShowModal] = useState(false);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [abaAtiva, setAbaAtiva] = useState<Aba>('dados');
  const [erro, setErro] = useState('');

  // Aba Dados
  const [dadosEmpresa, setDadosEmpresa] = useState<Partial<Empresa>>({});
  const [salvandoDados, setSalvandoDados] = useState(false);

  // Aba Trabalhos
  const [trabalhos, setTrabalhos] = useState<Trabalho[]>([]);
  const [trabalhoExpandido, setTrabalhoExpandido] = useState<number | null>(null);
  const [abaTrabalho, setAbaTrabalho] = useState<AbaTrabalho>('contatos');
  const [novoTituloTrabalho, setNovoTituloTrabalho] = useState('');
  const [mostrarFormTrabalho, setMostrarFormTrabalho] = useState(false);

  // Contatos do trabalho
  const [contatos, setContatos] = useState<ContatoTrabalho[]>([]);
  const [novoContato, setNovoContato] = useState({ tipo: '' as TipoContato | '', dataContato: '', observacoes: '', statusNegocio: '' as StatusNegocio | '' });
  const [alertaNegocioFechado, setAlertaNegocioFechado] = useState(false);

  // Parâmetros do trabalho
  const [parametros, setParametros] = useState<ParametrosTrabalho>({});
  const [salvandoParam, setSalvandoParam] = useState(false);

  // Aba Reuniões
  const [reunioes, setReunioes] = useState<Reuniao[]>([]);
  const [novaReuniao, setNovaReuniao] = useState({ titulo: '', dataHora: '', localReuniao: '', observacoes: '', trabalhoId: '' });
  const [mostrarFormReuniao, setMostrarFormReuniao] = useState(false);

  const carregarEmpresas = async () => {
    setCarregando(true);
    setErroCarregamento('');
    try {
      const lista = await listarEmpresasExecutivo();
      setEmpresas(lista);
    } catch (e) {
      setErroCarregamento(e instanceof Error ? e.message : 'Erro ao carregar empresas.');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarEmpresas();
  }, []);

  // ── Abrir modal ──────────────────────────────────────────────────────────────
  const abrirAcoes = async (empresa: Empresa) => {
    setEmpresaSelecionada(empresa);
    setAbaAtiva('dados');
    setErro('');
    setDadosEmpresa({ ...empresa });
    setTrabalhos([]);
    setTrabalhoExpandido(null);
    setMostrarFormTrabalho(false);
    setMostrarFormReuniao(false);
    setShowModal(true);

    const [ts, rs] = await Promise.all([
      listarTrabalhos(empresa.id).catch(() => []),
      listarReunioesPorEmpresa(empresa.id).catch(() => []),
    ]);
    setTrabalhos(ts);
    setReunioes(rs);
  };

  // ── Aba Dados ────────────────────────────────────────────────────────────────
  const handleSalvarDados = async () => {
    if (!empresaSelecionada) return;
    setSalvandoDados(true);
    setErro('');
    try {
      const atualizada = await atualizarDadosEmpresa(empresaSelecionada.id, dadosEmpresa);
      setEmpresaSelecionada(atualizada);
      setEmpresas((prev) => prev.map((e) => (e.id === atualizada.id ? atualizada : e)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar dados.');
    } finally {
      setSalvandoDados(false);
    }
  };

  // ── Aba Trabalhos ────────────────────────────────────────────────────────────
  const handleCriarTrabalho = async () => {
    if (!empresaSelecionada || !novoTituloTrabalho.trim()) return;
    try {
      await criarTrabalho(empresaSelecionada.id, novoTituloTrabalho.trim());
      const lista = await listarTrabalhos(empresaSelecionada.id);
      setTrabalhos(lista);
      setNovoTituloTrabalho('');
      setMostrarFormTrabalho(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar trabalho.');
    }
  };

  const expandirTrabalho = async (trabalho: Trabalho) => {
    if (trabalhoExpandido === trabalho.id) {
      setTrabalhoExpandido(null);
      return;
    }
    setTrabalhoExpandido(trabalho.id);
    setAbaTrabalho('contatos');
    const [cs, ps] = await Promise.all([
      listarContatos(trabalho.id).catch(() => []),
      obterParametros(trabalho.id).catch(() => ({})),
    ]);
    setContatos(cs);
    setParametros(ps);
    setNovoContato({ tipo: '', dataContato: '', observacoes: '', statusNegocio: '' });
  };

  const handleAlterarStatusTrabalho = async (trabalho: Trabalho, status: StatusTrabalho) => {
    try {
      await atualizarTrabalho(trabalho.id, { status });
      setTrabalhos((prev) => prev.map((t) => (t.id === trabalho.id ? { ...t, status } : t)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar status.');
    }
  };

  const handleAdicionarContato = async (trabalhoId: number) => {
    if (!novoContato.tipo || !novoContato.dataContato || !novoContato.observacoes) {
      setErro('Preencha tipo, data e observações do contato.');
      return;
    }
    try {
      const resultado = await adicionarContato(trabalhoId, {
        tipo: novoContato.tipo as TipoContato,
        dataContato: novoContato.dataContato,
        observacoes: novoContato.observacoes,
        statusNegocio: (novoContato.statusNegocio as StatusNegocio) || undefined,
      });
      const cs = await listarContatos(trabalhoId);
      setContatos(cs);
      setNovoContato({ tipo: '', dataContato: '', observacoes: '', statusNegocio: '' });
      setErro('');

      if (resultado.negocioFechado) {
        // Atualizar status do trabalho na lista local
        setTrabalhos((prev) => prev.map((t) => t.id === trabalhoId ? { ...t, status: 'fechado' } : t));
        setAbaTrabalho('parametros');
        setAlertaNegocioFechado(true);
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar contato.');
    }
  };

  const handleSalvarParametros = async (trabalhoId: number) => {
    setSalvandoParam(true);
    try {
      await salvarParametros(trabalhoId, parametros);
      setSalvandoParam(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar parâmetros.');
      setSalvandoParam(false);
    }
  };

  // ── Aba Reuniões ─────────────────────────────────────────────────────────────
  const handleAgendarReuniao = async () => {
    if (!empresaSelecionada || !novaReuniao.titulo || !novaReuniao.dataHora) {
      setErro('Informe o título e a data/hora da reunião.');
      return;
    }
    try {
      await agendarReuniao({
        empresaId: empresaSelecionada.id,
        titulo: novaReuniao.titulo,
        dataHora: novaReuniao.dataHora,
        localReuniao: novaReuniao.localReuniao || undefined,
        observacoes: novaReuniao.observacoes || undefined,
        trabalhoId: novaReuniao.trabalhoId ? Number(novaReuniao.trabalhoId) : undefined,
      });
      const rs = await listarReunioesPorEmpresa(empresaSelecionada.id);
      setReunioes(rs);
      setNovaReuniao({ titulo: '', dataHora: '', localReuniao: '', observacoes: '', trabalhoId: '' });
      setMostrarFormReuniao(false);
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao agendar reunião.');
    }
  };

  const handleAlterarStatusReuniao = async (id: number, status: StatusReuniao) => {
    try {
      await atualizarStatusReuniao(id, status);
      setReunioes((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao atualizar reunião.');
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Meus Clientes</h1>
          <p className="painel-subtitle">Empresas atribuídas a {usuario?.nome}</p>
        </div>
        <IonButton className="btn-acao" shape="round" color="secondary" onClick={carregarEmpresas}>
          Atualizar
        </IonButton>
      </div>

      {erroCarregamento && (
        <div className="painel-vazio">
          {erroCarregamento}
          <div style={{ marginTop: 12 }}>
            <IonButton size="small" fill="outline" onClick={carregarEmpresas}>Tentar novamente</IonButton>
          </div>
        </div>
      )}

      {!erroCarregamento && (
        <div className="painel-lista">
          {!carregando && empresas.length === 0 && (
            <div className="painel-vazio">Nenhuma empresa atribuída a você ainda.</div>
          )}
          {empresas.map((empresa) => (
            <div key={empresa.id} className="painel-card">
              <div className="painel-card-info">
                <div className="painel-card-titulo">
                  <h3>{empresa.nome_empresa}</h3>
                  {empresa.regiao_nome && <span className="painel-tag">{empresa.regiao_nome}</span>}
                  <span className="painel-tag" style={{ background: '#e8f0fe', color: '#1976d2' }}>{empresa.status}</span>
                  {empresa.tem_alerta && (
                    <span title="Negócio frustrado há mais de 2 meses — hora de retomar o contato" style={{ background: '#fff3e0', color: '#e65100', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 12, border: '1px solid #ffb74d' }}>
                      ⚠ Retomar contato
                    </span>
                  )}
                </div>
                <p className="painel-detalhe">Consultor: {empresa.consultor_nome || '-'}</p>
                <p className="painel-detalhe">Telefone: {empresa.telefone_empresa}</p>
                <p className="painel-detalhe">E-mail: {empresa.email_empresa}</p>
                {empresa.data_primeiro_contato && (
                  <p className="painel-detalhe">1º Contato: {formatarDataBR(empresa.data_primeiro_contato)}</p>
                )}
              </div>
              <div className="painel-card-acoes">
                <button className="btn-secundario" onClick={() => abrirAcoes(empresa)}>Ações</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal de Ações ── */}
      <IonModal className="modal-grande" isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <div className="modal-form" style={{ padding: '24px 28px' }}>
          <h2 style={{ marginBottom: 4 }}>{empresaSelecionada?.nome_empresa}</h2>
          <p className="painel-subtitle" style={{ marginBottom: 16 }}>{empresaSelecionada?.status}</p>

          {/* Abas */}
          <div className="exec-abas">
            {(['dados', 'trabalhos', 'reunioes'] as Aba[]).map((aba) => (
              <button
                key={aba}
                className={`exec-aba${abaAtiva === aba ? ' exec-aba-ativa' : ''}`}
                onClick={() => { setAbaAtiva(aba); setErro(''); }}
              >
                {aba === 'dados' ? 'Dados' : aba === 'trabalhos' ? 'Trabalhos' : 'Reuniões'}
              </button>
            ))}
          </div>

          {erro && <p className="form-erro" style={{ marginTop: 8 }}>{erro}</p>}

          {/* ── Aba Dados ── */}
          {abaAtiva === 'dados' && (
            <div style={{ marginTop: 16 }}>
              <div className="form-row">
                <div className="form-field">
                  <label>Nome da empresa *</label>
                  <input className="form-input" value={dadosEmpresa.nome_empresa ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, nome_empresa: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Telefone *</label>
                  <input className="form-input" value={dadosEmpresa.telefone_empresa ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, telefone_empresa: formatarTelefone(e.target.value) }))} />
                </div>
                <div className="form-field">
                  <label>E-mail *</label>
                  <input className="form-input" type="email" value={dadosEmpresa.email_empresa ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, email_empresa: e.target.value }))} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>CNPJ</label>
                  <input className="form-input" value={dadosEmpresa.cnpj ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, cnpj: formatarCNPJ(e.target.value) }))} />
                </div>
                <div className="form-field">
                  <label>Representante</label>
                  <input className="form-input" value={dadosEmpresa.representante ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, representante: e.target.value }))} />
                </div>
              </div>
              <div className="form-section-title">Endereço</div>
              <div className="form-row">
                <div className="form-field form-field-small">
                  <label>CEP</label>
                  <input className="form-input" value={dadosEmpresa.cep ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, cep: formatarCEP(e.target.value) }))} />
                </div>
                <div className="form-field"><label>Rua</label><input className="form-input" value={dadosEmpresa.rua ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, rua: e.target.value }))} /></div>
                <div className="form-field form-field-small"><label>Número</label><input className="form-input" value={dadosEmpresa.numero ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, numero: e.target.value }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field"><label>Bairro</label><input className="form-input" value={dadosEmpresa.bairro ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, bairro: e.target.value }))} /></div>
                <div className="form-field"><label>Cidade</label><input className="form-input" value={dadosEmpresa.cidade ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, cidade: e.target.value }))} /></div>
                <div className="form-field form-field-small"><label>UF</label><input className="form-input" maxLength={2} value={dadosEmpresa.uf ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, uf: e.target.value.toUpperCase() }))} /></div>
              </div>
              <div className="form-row">
                <div className="form-field">
                  <label>Status</label>
                  <select className="form-input" value={dadosEmpresa.status ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, status: e.target.value }))}>
                    {['Primeiro Contato', 'Em negociação', 'Proposta enviada', 'Cliente ativo', 'Inativo'].map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Data 1º Contato</label>
                  <input className="form-input" type="date" max={dataHoje()} value={dadosEmpresa.data_primeiro_contato?.substring(0, 10) ?? ''} onChange={(e) => setDadosEmpresa((p) => ({ ...p, data_primeiro_contato: e.target.value }))} />
                </div>
              </div>
              <div className="modal-acoes">
                <IonButton fill="outline" shape="round" onClick={() => setShowModal(false)}>Fechar</IonButton>
                <IonButton shape="round" color="secondary" onClick={handleSalvarDados} disabled={salvandoDados}>
                  {salvandoDados ? 'Salvando...' : 'Salvar dados'}
                </IonButton>
              </div>
            </div>
          )}

          {/* ── Aba Trabalhos ── */}
          {abaAtiva === 'trabalhos' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Jobs / Processos</span>
                <button className="btn-secundario" onClick={() => setMostrarFormTrabalho((v) => !v)}>+ Novo</button>
              </div>

              {mostrarFormTrabalho && (
                <div className="form-alerta" style={{ marginBottom: 12 }}>
                  <div className="form-field" style={{ marginBottom: 8 }}>
                    <label>Título do trabalho</label>
                    <input className="form-input" value={novoTituloTrabalho} onChange={(e) => setNovoTituloTrabalho(e.target.value)} placeholder="Ex: Contratação de 5 cooperados — Produção" />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <IonButton size="small" shape="round" color="secondary" onClick={handleCriarTrabalho}>Criar</IonButton>
                    <IonButton size="small" shape="round" fill="outline" onClick={() => setMostrarFormTrabalho(false)}>Cancelar</IonButton>
                  </div>
                </div>
              )}

              {trabalhos.length === 0 && <p className="painel-vazio">Nenhum trabalho ainda.</p>}

              {trabalhos.map((trabalho) => (
                <div key={trabalho.id} className="exec-trabalho-card">
                  <div className="exec-trabalho-header" onClick={() => expandirTrabalho(trabalho)}>
                    <div>
                      <strong>{trabalho.titulo}</strong>
                      <span className="exec-status-badge" style={{ background: STATUS_CORES[trabalho.status] + '22', color: STATUS_CORES[trabalho.status], border: `1px solid ${STATUS_CORES[trabalho.status]}` }}>
                        {ROTULO_STATUS_TRABALHO[trabalho.status]}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <select
                        className="form-input"
                        style={{ width: 'auto', height: 32, fontSize: 12, padding: '0 8px' }}
                        value={trabalho.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleAlterarStatusTrabalho(trabalho, e.target.value as StatusTrabalho)}
                      >
                        {(Object.keys(ROTULO_STATUS_TRABALHO) as StatusTrabalho[]).map((s) => (
                          <option key={s} value={s}>{ROTULO_STATUS_TRABALHO[s]}</option>
                        ))}
                      </select>
                      <span style={{ color: '#4a9e4f', fontSize: 18 }}>{trabalhoExpandido === trabalho.id ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  {trabalhoExpandido === trabalho.id && (
                    <div className="exec-trabalho-body">
                      <div className="exec-abas" style={{ marginBottom: 12 }}>
                        <button className={`exec-aba${abaTrabalho === 'contatos' ? ' exec-aba-ativa' : ''}`} onClick={() => setAbaTrabalho('contatos')}>Contatos</button>
                        <button className={`exec-aba${abaTrabalho === 'parametros' ? ' exec-aba-ativa' : ''}`} onClick={() => setAbaTrabalho('parametros')}>Parâmetros</button>
                      </div>

                      {/* Contatos do trabalho */}
                      {abaTrabalho === 'contatos' && (
                        <div>
                          <div className="form-row">
                            <div className="form-field">
                              <label>Tipo</label>
                              <select className="form-input" value={novoContato.tipo} onChange={(e) => setNovoContato((p) => ({ ...p, tipo: e.target.value as TipoContato }))}>
                                <option value="">Selecione</option>
                                {(Object.keys(ROTULO_TIPO_CONTATO) as TipoContato[]).map((t) => (
                                  <option key={t} value={t}>{ROTULO_TIPO_CONTATO[t]}</option>
                                ))}
                              </select>
                            </div>
                            <div className="form-field">
                              <label>Data</label>
                              <input className="form-input" type="date" max={dataHoje()} value={novoContato.dataContato} onChange={(e) => setNovoContato((p) => ({ ...p, dataContato: e.target.value }))} />
                            </div>
                            <div className="form-field">
                              <label>Status do negócio</label>
                              <select className="form-input" value={novoContato.statusNegocio} onChange={(e) => setNovoContato((p) => ({ ...p, statusNegocio: e.target.value as StatusNegocio | '' }))}>
                                <option value="">Selecione</option>
                                {(Object.keys(ROTULO_STATUS_NEGOCIO) as StatusNegocio[]).map((s) => (
                                  <option key={s} value={s}>{ROTULO_STATUS_NEGOCIO[s]}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="form-field">
                            <label>Observações</label>
                            <textarea className="form-input form-textarea" rows={2} value={novoContato.observacoes} onChange={(e) => setNovoContato((p) => ({ ...p, observacoes: e.target.value }))} />
                          </div>
                          <IonButton size="small" shape="round" color="secondary" onClick={() => handleAdicionarContato(trabalho.id)}>Registrar</IonButton>

                          {alertaNegocioFechado && (
                            <div style={{ background: '#e8f5e9', border: '1px solid #4a9e4f', borderRadius: 8, padding: '10px 14px', marginTop: 10, fontSize: 13, color: '#2e7d32' }}>
                              ✅ <strong>Negócio fechado!</strong> O trabalho foi marcado como fechado. Acesse a aba <strong>Parâmetros</strong> para revisar e completar os dados do processo.
                              <button style={{ marginLeft: 12, fontSize: 11, color: '#4a9e4f', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }} onClick={() => setAlertaNegocioFechado(false)}>✕</button>
                            </div>
                          )}

                          <div className="historico-lista" style={{ marginTop: 12 }}>
                            {contatos.length === 0 && <p style={{ color: '#999', fontSize: 13 }}>Nenhum contato registrado.</p>}
                            {contatos.map((c) => (
                              <div key={c.id} className="historico-item">
                                <span className="historico-data">{ROTULO_TIPO_CONTATO[c.tipo]} — {formatarDataBR(c.data_contato)}</span>
                                {c.status_negocio && (
                                  <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 8, padding: '1px 8px', borderRadius: 8, background: c.status_negocio === 'negocio_fechado' ? '#e8f5e9' : c.status_negocio === 'negocio_frustrado' ? '#fff3e0' : '#e8f0fe', color: c.status_negocio === 'negocio_fechado' ? '#2e7d32' : c.status_negocio === 'negocio_frustrado' ? '#e65100' : '#1565c0' }}>
                                    {ROTULO_STATUS_NEGOCIO[c.status_negocio] ?? c.status_negocio}
                                  </span>
                                )}
                                {c.alerta_em && <span style={{ fontSize: 11, color: '#999', marginLeft: 6 }}>Alerta: {formatarDataBR(c.alerta_em)}</span>}
                                <p>{c.observacoes}</p>
                                <p className="historico-autor">Registrado por: {c.registrado_por_nome}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Parâmetros do trabalho */}
                      {abaTrabalho === 'parametros' && (
                        <div>
                          <div className="form-row">
                            <div className="form-field">
                              <label>Cargo / Função</label>
                              <input className="form-input" value={parametros.cargo ?? ''} onChange={(e) => setParametros((p) => ({ ...p, cargo: e.target.value }))} />
                            </div>
                            <div className="form-field form-field-small">
                              <label>Quantidade de vagas</label>
                              <input className="form-input" type="number" min={1} value={parametros.quantidade ?? ''} onChange={(e) => setParametros((p) => ({ ...p, quantidade: Number(e.target.value) || undefined }))} />
                            </div>
                          </div>
                          <div className="form-row">
                            <div className="form-field">
                              <label>Salário (R$)</label>
                              <input className="form-input" type="number" step="0.01" value={parametros.salario ?? ''} onChange={(e) => setParametros((p) => ({ ...p, salario: Number(e.target.value) || undefined }))} />
                            </div>
                            <div className="form-field">
                              <label>Local de trabalho</label>
                              <input className="form-input" value={parametros.local_trabalho ?? ''} onChange={(e) => setParametros((p) => ({ ...p, local_trabalho: e.target.value }))} />
                            </div>
                            <div className="form-field">
                              <label>Horário</label>
                              <input className="form-input" value={parametros.horario ?? ''} placeholder="Ex: 08:00-17:00" onChange={(e) => setParametros((p) => ({ ...p, horario: e.target.value }))} />
                            </div>
                          </div>
                          <div className="form-field">
                            <label>Descrição do cargo</label>
                            <textarea className="form-input form-textarea" rows={3} value={parametros.descricao_cargo ?? ''} onChange={(e) => setParametros((p) => ({ ...p, descricao_cargo: e.target.value }))} />
                          </div>
                          <div className="form-field">
                            <label>Requisitos</label>
                            <textarea className="form-input form-textarea" rows={2} value={parametros.requisitos ?? ''} onChange={(e) => setParametros((p) => ({ ...p, requisitos: e.target.value }))} />
                          </div>
                          <div className="form-field">
                            <label>Benefícios</label>
                            <textarea className="form-input form-textarea" rows={2} value={parametros.beneficios ?? ''} onChange={(e) => setParametros((p) => ({ ...p, beneficios: e.target.value }))} />
                          </div>
                          <div className="form-field">
                            <label>Observações internas</label>
                            <textarea className="form-input form-textarea" rows={2} value={parametros.observacoes ?? ''} onChange={(e) => setParametros((p) => ({ ...p, observacoes: e.target.value }))} />
                          </div>
                          <IonButton size="small" shape="round" color="secondary" onClick={() => handleSalvarParametros(trabalho.id)} disabled={salvandoParam}>
                            {salvandoParam ? 'Salvando...' : 'Salvar parâmetros'}
                          </IonButton>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}

              <div className="modal-acoes">
                <IonButton fill="outline" shape="round" onClick={() => setShowModal(false)}>Fechar</IonButton>
              </div>
            </div>
          )}

          {/* ── Aba Reuniões ── */}
          {abaAtiva === 'reunioes' && (
            <div style={{ marginTop: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span className="form-section-title" style={{ margin: 0, border: 'none', padding: 0 }}>Reuniões agendadas</span>
                <button className="btn-secundario" onClick={() => setMostrarFormReuniao((v) => !v)}>+ Agendar</button>
              </div>

              {mostrarFormReuniao && (
                <div className="form-alerta" style={{ marginBottom: 16 }}>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Título *</label>
                      <input className="form-input" value={novaReuniao.titulo} onChange={(e) => setNovaReuniao((p) => ({ ...p, titulo: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label>Data e hora *</label>
                      <input className="form-input" type="datetime-local" value={novaReuniao.dataHora} onChange={(e) => setNovaReuniao((p) => ({ ...p, dataHora: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-field">
                      <label>Local</label>
                      <input className="form-input" value={novaReuniao.localReuniao} onChange={(e) => setNovaReuniao((p) => ({ ...p, localReuniao: e.target.value }))} />
                    </div>
                    <div className="form-field">
                      <label>Trabalho relacionado</label>
                      <select className="form-input" value={novaReuniao.trabalhoId} onChange={(e) => setNovaReuniao((p) => ({ ...p, trabalhoId: e.target.value }))}>
                        <option value="">Nenhum</option>
                        {trabalhos.map((t) => <option key={t.id} value={t.id}>{t.titulo}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="form-field">
                    <label>Observações</label>
                    <textarea className="form-input form-textarea" rows={2} value={novaReuniao.observacoes} onChange={(e) => setNovaReuniao((p) => ({ ...p, observacoes: e.target.value }))} />
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <IonButton size="small" shape="round" color="secondary" onClick={handleAgendarReuniao}>Agendar</IonButton>
                    <IonButton size="small" shape="round" fill="outline" onClick={() => setMostrarFormReuniao(false)}>Cancelar</IonButton>
                  </div>
                </div>
              )}

              {reunioes.length === 0 && <p className="painel-vazio">Nenhuma reunião agendada.</p>}
              {reunioes.map((r) => (
                <div key={r.id} className="historico-item" style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span className="historico-data">{r.titulo}</span>
                      <p style={{ margin: '4px 0 2px', fontSize: 13, color: '#555' }}>{formatarDataHora(r.data_hora)}{r.local_reuniao ? ` — ${r.local_reuniao}` : ''}</p>
                      {r.observacoes && <p style={{ margin: 0, fontSize: 13 }}>{r.observacoes}</p>}
                    </div>
                    <select
                      className="form-input"
                      style={{ width: 'auto', height: 30, fontSize: 12, padding: '0 6px' }}
                      value={r.status}
                      onChange={(e) => handleAlterarStatusReuniao(r.id, e.target.value as StatusReuniao)}
                    >
                      <option value="agendada">Agendada</option>
                      <option value="realizada">Realizada</option>
                      <option value="cancelada">Cancelada</option>
                    </select>
                  </div>
                </div>
              ))}

              <div className="modal-acoes">
                <IonButton fill="outline" shape="round" onClick={() => setShowModal(false)}>Fechar</IonButton>
              </div>
            </div>
          )}
        </div>
      </IonModal>
    </div>
  );
};

export default PainelExecutivo;
