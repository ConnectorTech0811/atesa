import React, { useEffect, useState } from 'react';
import { IonButton, IonModal, useIonViewWillEnter } from '@ionic/react';
import {
  Grupo,
  MapaPermissoes,
  MembroGrupo,
  adicionarMembro,
  atualizarGrupo,
  criarGrupo,
  excluirGrupo,
  listarGrupos,
  listarMembros,
  obterPermissoesGrupo,
  obterPermissoesUsuario,
  removerMembro,
  salvarPermissoesGrupo,
  salvarPermissoesUsuario,
} from '../../api/gruposApi';
import { Usuario, listarUsuarios, rotuloTipoUsuario } from '../../api/usuariosApi';
import { FUNCIONALIDADES } from '../../auth/PermissoesContext';

type Aba = 'grupos' | 'usuarios';

// ── Toggle visual ─────────────────────────────────────────────────────────────
const Toggle: React.FC<{ ativo: boolean; onChange: (v: boolean) => void; disabled?: boolean }> = ({ ativo, onChange, disabled }) => (
  <button
    disabled={disabled}
    onClick={() => onChange(!ativo)}
    style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: disabled ? 'default' : 'pointer',
      background: ativo ? '#4a9e4f' : '#ccc', position: 'relative', transition: 'background 0.2s', flexShrink: 0,
    }}
  >
    <span style={{
      position: 'absolute', top: 3, left: ativo ? 23 : 3, width: 18, height: 18,
      borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
    }} />
  </button>
);

// ── Painel de permissões (reutilizado para grupo e para usuário) ──────────────
const PainelPermissoes: React.FC<{
  permissoes: MapaPermissoes;
  onChange: (p: MapaPermissoes) => void;
  salvando: boolean;
  onSalvar: () => void;
  titulo: string;
  mensagem?: { tipo: 'erro' | 'sucesso'; texto: string } | null;
}> = ({ permissoes, onChange, salvando, onSalvar, titulo, mensagem }) => {
  const toggle = (id: string, val: boolean) => {
    const novo = { ...permissoes, [id]: val };
    // Se pai desativado, desativa todos os filhos; se pai ativado, não força filhos
    const func = FUNCIONALIDADES.find((f) => f.id === id);
    if (func) {
      if (!val) func.itens.forEach((i) => { novo[i.id] = false; });
      else func.itens.forEach((i) => { if (!(i.id in novo)) novo[i.id] = true; });
    }
    // Se filho ativado, garante que pai está ativo
    const filho = FUNCIONALIDADES.flatMap((f) => f.itens).find((i) => i.id === id);
    if (filho && val) {
      const pai = FUNCIONALIDADES.find((f) => f.itens.some((i) => i.id === id));
      if (pai) novo[pai.id] = true;
    }
    onChange(novo);
  };

  const get = (id: string) => (id in permissoes ? permissoes[id] : false);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: mensagem ? 8 : 16 }}>
        <h3 style={{ fontSize: 14, color: '#2e6b32', margin: 0 }}>{titulo}</h3>
        <IonButton size="small" shape="round" color="secondary" onClick={onSalvar} disabled={salvando}>
          {salvando ? 'Salvando...' : 'Salvar'}
        </IonButton>
      </div>
      {mensagem && (
        <p style={{ fontSize: 12, marginBottom: 12, padding: '6px 10px', borderRadius: 6, background: mensagem.tipo === 'sucesso' ? '#e8f5e9' : '#fce4ec', color: mensagem.tipo === 'sucesso' ? '#2e6b32' : '#c62828', border: `1px solid ${mensagem.tipo === 'sucesso' ? '#a5d6a7' : '#ef9a9a'}` }}>
          {mensagem.texto}
        </p>
      )}
      {FUNCIONALIDADES.map((func) => {
        const paiAtivo = get(func.id);
        return (
          <div key={func.id} style={{ marginBottom: 16, border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: paiAtivo ? '#f0f7f0' : '#f5f5f5' }}>
              <span style={{ fontWeight: 600, fontSize: 13, color: paiAtivo ? '#2e6b32' : '#999' }}>{func.label}</span>
              <Toggle ativo={paiAtivo} onChange={(v) => toggle(func.id, v)} />
            </div>
            {func.itens.map((item) => {
              const itemAtivo = get(item.id);
              return (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px 8px 28px', borderTop: '1px solid #f0f0f0', background: '#fff', opacity: paiAtivo ? 1 : 0.4 }}>
                  <span style={{ fontSize: 12, color: itemAtivo && paiAtivo ? '#333' : '#aaa' }}>{item.label}</span>
                  <Toggle ativo={itemAtivo} onChange={(v) => toggle(item.id, v)} disabled={!paiAtivo} />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const GerenciamentoPermissoes: React.FC = () => {
  const [aba, setAba] = useState<Aba>('grupos');

  // ── estado grupos ────────────────────────────────────────────────────────────
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [grupoSelecionado, setGrupoSelecionado] = useState<Grupo | null>(null);
  const [membros, setMembros] = useState<MembroGrupo[]>([]);
  const [permissoesGrupo, setPermissoesGrupo] = useState<MapaPermissoes>({});
  const [subAba, setSubAba] = useState<'membros' | 'permissoes'>('membros');

  const [showModalGrupo, setShowModalGrupo] = useState(false);
  const [editandoGrupo, setEditandoGrupo] = useState<Grupo | null>(null);
  const [formGrupo, setFormGrupo] = useState({ nome: '', descricao: '' });
  const [erroGrupo, setErroGrupo] = useState('');
  const [salvandoGrupo, setSalvandoGrupo] = useState(false);

  const [todosUsuarios, setTodosUsuarios] = useState<Usuario[]>([]);
  const [addUsuarioId, setAddUsuarioId] = useState('');
  const [buscaMembro, setBuscaMembro] = useState('');
  const [salvandoPerm, setSalvandoPerm] = useState(false);
  const [msgPerm, setMsgPerm] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);

  // ── estado usuários ──────────────────────────────────────────────────────────
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState<Usuario | null>(null);
  const [permissoesUsuario, setPermissoesUsuario] = useState<MapaPermissoes>({});
  const [salvandoPermUsuario, setSalvandoPermUsuario] = useState(false);
  const [msgPermUsuario, setMsgPermUsuario] = useState<{ tipo: 'erro' | 'sucesso'; texto: string } | null>(null);
  const [filtroNome, setFiltroNome] = useState('');

  // ── carregamento inicial ─────────────────────────────────────────────────────
  const [erroCarregamento, setErroCarregamento] = useState('');

  const carregarDadosPermissoes = () => {
    Promise.all([listarGrupos(), listarUsuarios()])
      .then(([gs, us]) => {
        setGrupos(gs);
        setTodosUsuarios(us);
        setUsuarios(us);
      })
      .catch((e) => setErroCarregamento(e instanceof Error ? e.message : 'Erro ao carregar dados.'));
  };
  useEffect(() => { carregarDadosPermissoes(); }, []);
  useIonViewWillEnter(() => { carregarDadosPermissoes(); });

  const recarregarGrupos = async () => {
    const gs = await listarGrupos();
    setGrupos(gs);
  };

  const obterPermissoesPadraoPerfil = (perfil: string): MapaPermissoes => {
    const perms: MapaPermissoes = {};
    FUNCIONALIDADES.forEach((f) => {
      perms[f.id] = false;
      f.itens.forEach((i) => {
        perms[i.id] = false;
      });
    });

    if (perfil === 'administrador') {
      Object.keys(perms).forEach((k) => { perms[k] = true; });
    } else if (perfil === 'consultor' || perfil === 'supervisao') {
      perms['empresas'] = true;
      perms['empresas.criar'] = true;
      perms['empresas.editar'] = true;
      perms['empresas.historico'] = true;
    } else if (perfil === 'executivo_contas') {
      perms['executivo'] = true;
      perms['executivo.trabalhos'] = true;
      perms['executivo.contatos'] = true;
      perms['executivo.proposta'] = true;
      perms['executivo.parametros'] = true;
      perms['executivo.editar_empresa'] = true;

      perms['agenda'] = true;
      perms['agenda.criar'] = true;
      perms['agenda.status'] = true;
    }
    return perms;
  };

  const selecionarGrupo = async (g: Grupo) => {
    setGrupoSelecionado(g);
    const [ms, ps] = await Promise.all([listarMembros(g.id), obterPermissoesGrupo(g.id)]);
    setMembros(ms);

    const padrao: MapaPermissoes = {};
    FUNCIONALIDADES.forEach((f) => {
      padrao[f.id] = false;
      f.itens.forEach((i) => {
        padrao[i.id] = false;
      });
    });

    setPermissoesGrupo({ ...padrao, ...ps });
    setSubAba('membros');
  };

  const selecionarUsuario = async (u: Usuario) => {
    setUsuarioSelecionado(u);
    const ps = await obterPermissoesUsuario(u.id);
    const padrao = obterPermissoesPadraoPerfil(u.tipo_usuario);
    setPermissoesUsuario({ ...padrao, ...ps });
  };

  // ── CRUD grupos ──────────────────────────────────────────────────────────────
  const abrirNovoGrupo = () => {
    setEditandoGrupo(null);
    setFormGrupo({ nome: '', descricao: '' });
    setErroGrupo('');
    setShowModalGrupo(true);
  };

  const abrirEditarGrupo = (g: Grupo) => {
    setEditandoGrupo(g);
    setFormGrupo({ nome: g.nome, descricao: g.descricao ?? '' });
    setErroGrupo('');
    setShowModalGrupo(true);
  };

  const handleSalvarGrupo = async () => {
    if (!formGrupo.nome.trim()) { setErroGrupo('Informe o nome do grupo.'); return; }
    setSalvandoGrupo(true);
    try {
      if (editandoGrupo) {
        await atualizarGrupo(editandoGrupo.id, formGrupo);
        if (grupoSelecionado?.id === editandoGrupo.id) {
          setGrupoSelecionado({ ...grupoSelecionado, ...formGrupo });
        }
      } else {
        await criarGrupo(formGrupo);
      }
      await recarregarGrupos();
      setShowModalGrupo(false);
    } catch (e) {
      setErroGrupo(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSalvandoGrupo(false);
    }
  };

  const handleExcluirGrupo = async (g: Grupo) => {
    if (!confirm(`Excluir grupo "${g.nome}"? Todos os membros serão desvinculados.`)) return;
    await excluirGrupo(g.id);
    if (grupoSelecionado?.id === g.id) setGrupoSelecionado(null);
    await recarregarGrupos();
  };

  // ── membros ──────────────────────────────────────────────────────────────────
  const handleAddMembro = async (usuarioId: number) => {
    if (!grupoSelecionado) return;
    await adicionarMembro(grupoSelecionado.id, usuarioId);
    setAddUsuarioId('');
    setBuscaMembro('');
    const ms = await listarMembros(grupoSelecionado.id);
    setMembros(ms);
    await recarregarGrupos();
  };

  const handleRemoverMembro = async (usuarioId: number) => {
    if (!grupoSelecionado) return;
    await removerMembro(grupoSelecionado.id, usuarioId);
    setMembros((prev) => prev.filter((m) => m.id !== usuarioId));
    await recarregarGrupos();
  };

  // ── permissões grupo ─────────────────────────────────────────────────────────
  const handleSalvarPermGrupo = async () => {
    if (!grupoSelecionado) return;
    setSalvandoPerm(true);
    setMsgPerm(null);
    try {
      await salvarPermissoesGrupo(grupoSelecionado.id, permissoesGrupo);
      setMsgPerm({ tipo: 'sucesso', texto: 'Permissões salvas com sucesso!' });
    } catch (e) {
      setMsgPerm({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar permissões.' });
    } finally {
      setSalvandoPerm(false);
    }
  };

  // ── permissões usuário ───────────────────────────────────────────────────────
  const handleSalvarPermUsuario = async () => {
    if (!usuarioSelecionado) return;
    setSalvandoPermUsuario(true);
    setMsgPermUsuario(null);
    try {
      await salvarPermissoesUsuario(usuarioSelecionado.id, permissoesUsuario);
      setMsgPermUsuario({ tipo: 'sucesso', texto: 'Permissões salvas com sucesso!' });
    } catch (e) {
      setMsgPermUsuario({ tipo: 'erro', texto: e instanceof Error ? e.message : 'Erro ao salvar permissões.' });
    } finally {
      setSalvandoPermUsuario(false);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) =>
    !filtroNome || u.nome.toLowerCase().includes(filtroNome.toLowerCase())
  );

  const naoMembros = todosUsuarios.filter((u) => !membros.some((m) => m.id === u.id));

  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Permissões e Grupos</h1>
          <p className="painel-subtitle">Controle de acesso por grupo ou por usuário</p>
        </div>
      </div>

      {erroCarregamento && (
        <div className="painel-vazio" style={{ color: '#c62828', marginBottom: 16 }}>
          {erroCarregamento}
        </div>
      )}

      {/* Abas principais */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '2px solid #e0e0e0' }}>
        {(['grupos', 'usuarios'] as Aba[]).map((a) => (
          <button
            key={a}
            onClick={() => { setAba(a); setGrupoSelecionado(null); setUsuarioSelecionado(null); }}
            style={{
              padding: '10px 24px', border: 'none', background: 'none', cursor: 'pointer',
              fontWeight: aba === a ? 700 : 400, fontSize: 14,
              color: aba === a ? '#2e6b32' : '#666',
              borderBottom: aba === a ? '2px solid #2e6b32' : '2px solid transparent',
              marginBottom: -2,
            }}
          >
            {a === 'grupos' ? 'Grupos' : 'Usuários'}
          </button>
        ))}
      </div>

      {/* ── ABA GRUPOS ── */}
      {aba === 'grupos' && (
        <div style={{ display: 'grid', gridTemplateColumns: grupoSelecionado ? '280px 1fr' : '1fr', gap: 20 }}>
          {/* Lista de grupos */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#444' }}>Grupos ({grupos.length})</span>
              <IonButton size="small" shape="round" color="secondary" onClick={abrirNovoGrupo}>+ Novo</IonButton>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {grupos.length === 0 && <div className="painel-vazio">Nenhum grupo criado.</div>}
              {grupos.map((g) => (
                <div
                  key={g.id}
                  onClick={() => selecionarGrupo(g)}
                  style={{
                    border: `1px solid ${grupoSelecionado?.id === g.id ? '#4a9e4f' : '#e0e0e0'}`,
                    borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                    background: grupoSelecionado?.id === g.id ? '#f0f7f0' : '#fff',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{g.nome}</div>
                      {g.descricao && <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{g.descricao}</div>}
                      <div style={{ fontSize: 11, color: '#4a9e4f', marginTop: 4 }}>{g.total_membros} membro{g.total_membros !== 1 ? 's' : ''}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => abrirEditarGrupo(g)} style={{ background: 'none', border: '1px solid #ddd', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: '#555' }}>Editar</button>
                      <button onClick={() => handleExcluirGrupo(g)} style={{ background: 'none', border: '1px solid #ffcdd2', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', fontSize: 11, color: '#c62828' }}>Excluir</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detalhe do grupo selecionado */}
          {grupoSelecionado && (
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 20 }}>
              <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid #e0e0e0' }}>
                {(['membros', 'permissoes'] as const).map((s) => (
                  <button
                    key={s}
                    onClick={() => setSubAba(s)}
                    style={{
                      padding: '8px 20px', border: 'none', background: 'none', cursor: 'pointer',
                      fontWeight: subAba === s ? 700 : 400, fontSize: 13,
                      color: subAba === s ? '#2e6b32' : '#666',
                      borderBottom: subAba === s ? '2px solid #2e6b32' : '2px solid transparent',
                      marginBottom: -2,
                    }}
                  >
                    {s === 'membros' ? 'Membros' : 'Permissões'}
                  </button>
                ))}
              </div>

              {/* Sub-aba membros */}
              {subAba === 'membros' && (
                <div>
                  {/* Busca para adicionar membro */}
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontSize: 12, color: '#555', display: 'block', marginBottom: 4 }}>Adicionar usuário ao grupo</label>
                    <input
                      className="form-input"
                      placeholder="Pesquisar por nome ou tipo..."
                      value={buscaMembro}
                      onChange={(e) => { setBuscaMembro(e.target.value); setAddUsuarioId(''); }}
                      style={{ marginBottom: 6 }}
                    />
                    {buscaMembro.trim() && (
                      <div style={{ border: '1px solid #e0e0e0', borderRadius: 6, maxHeight: 180, overflowY: 'auto', background: '#fff' }}>
                        {naoMembros
                          .filter((u) =>
                            u.nome.toLowerCase().includes(buscaMembro.toLowerCase()) ||
                            rotuloTipoUsuario(u.tipo_usuario).toLowerCase().includes(buscaMembro.toLowerCase())
                          )
                          .map((u) => (
                            <div
                              key={u.id}
                              onClick={() => handleAddMembro(u.id)}
                              style={{
                                padding: '8px 12px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f7f0')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                            >
                              <div>
                                <span style={{ fontWeight: 600, fontSize: 13 }}>{u.nome}</span>
                                <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>{rotuloTipoUsuario(u.tipo_usuario)}</span>
                              </div>
                              <span style={{ fontSize: 11, color: '#4a9e4f', fontWeight: 600 }}>+ Adicionar</span>
                            </div>
                          ))
                        }
                        {naoMembros.filter((u) =>
                          u.nome.toLowerCase().includes(buscaMembro.toLowerCase()) ||
                          rotuloTipoUsuario(u.tipo_usuario).toLowerCase().includes(buscaMembro.toLowerCase())
                        ).length === 0 && (
                          <div style={{ padding: '10px 12px', fontSize: 12, color: '#999' }}>Nenhum usuário encontrado.</div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Lista de membros atuais */}
                  <div style={{ fontSize: 12, color: '#555', marginBottom: 8, fontWeight: 600 }}>
                    Membros atuais ({membros.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {membros.length === 0 && <div className="painel-vazio">Nenhum membro neste grupo.</div>}
                    {membros.map((m) => (
                      <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', border: '1px solid #eee', borderRadius: 6 }}>
                        <div>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>{m.nome}</span>
                          <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>{rotuloTipoUsuario(m.tipo_usuario as any)}</span>
                          {!m.ativo && <span style={{ fontSize: 10, color: '#c62828', marginLeft: 6 }}>inativo</span>}
                        </div>
                        <button
                          onClick={() => handleRemoverMembro(m.id)}
                          style={{ background: 'none', border: '1px solid #ffcdd2', borderRadius: 4, padding: '2px 10px', cursor: 'pointer', fontSize: 11, color: '#c62828' }}
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sub-aba permissões do grupo */}
              {subAba === 'permissoes' && (
                <PainelPermissoes
                  titulo={`Permissões — ${grupoSelecionado.nome}`}
                  permissoes={permissoesGrupo}
                  onChange={setPermissoesGrupo}
                  salvando={salvandoPerm}
                  onSalvar={handleSalvarPermGrupo}
                  mensagem={msgPerm}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* ── ABA USUÁRIOS ── */}
      {aba === 'usuarios' && (
        <div style={{ display: 'grid', gridTemplateColumns: usuarioSelecionado ? '280px 1fr' : '1fr', gap: 20 }}>
          {/* Lista de usuários */}
          <div>
            <input
              className="form-input"
              placeholder="Buscar usuário..."
              value={filtroNome}
              onChange={(e) => setFiltroNome(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {usuariosFiltrados.map((u) => (
                <div
                  key={u.id}
                  onClick={() => selecionarUsuario(u)}
                  style={{
                    border: `1px solid ${usuarioSelecionado?.id === u.id ? '#4a9e4f' : '#e0e0e0'}`,
                    borderRadius: 8, padding: '8px 14px', cursor: 'pointer',
                    background: usuarioSelecionado?.id === u.id ? '#f0f7f0' : '#fff',
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{u.nome}</div>
                  <div style={{ fontSize: 11, color: '#888' }}>{rotuloTipoUsuario(u.tipo_usuario)}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Permissões individuais do usuário selecionado */}
          {usuarioSelecionado && (
            <div style={{ border: '1px solid #e0e0e0', borderRadius: 8, padding: 20 }}>
              <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fff8e1', borderRadius: 6, fontSize: 12, color: '#795548' }}>
                As permissões definidas aqui sobrescrevem as do grupo para este usuário específico.
              </div>
              <PainelPermissoes
                titulo={`Permissões individuais — ${usuarioSelecionado.nome}`}
                permissoes={permissoesUsuario}
                onChange={setPermissoesUsuario}
                salvando={salvandoPermUsuario}
                onSalvar={handleSalvarPermUsuario}
                mensagem={msgPermUsuario}
              />
            </div>
          )}
        </div>
      )}

      {/* Modal criar/editar grupo */}
      <IonModal
        isOpen={showModalGrupo}
        onDidDismiss={() => setShowModalGrupo(false)}
        style={{ '--width': '420px', '--max-width': '95vw', '--height': 'auto', '--border-radius': '12px' }}
      >
        <div style={{ padding: '28px 28px 24px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 20px', color: '#1a1a1a' }}>
            {editandoGrupo ? 'Editar Grupo' : 'Novo Grupo'}
          </h2>
          <div className="form-field">
            <label>Nome *</label>
            <input
              className="form-input"
              value={formGrupo.nome}
              onChange={(e) => setFormGrupo((p) => ({ ...p, nome: e.target.value }))}
              autoFocus
            />
          </div>
          <div className="form-field">
            <label>Descrição</label>
            <input
              className="form-input"
              value={formGrupo.descricao}
              onChange={(e) => setFormGrupo((p) => ({ ...p, descricao: e.target.value }))}
              placeholder="Opcional"
            />
          </div>
          {erroGrupo && <p className="form-erro">{erroGrupo}</p>}
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <IonButton shape="round" color="secondary" onClick={handleSalvarGrupo} disabled={salvandoGrupo}>
              {salvandoGrupo ? 'Salvando...' : 'Salvar'}
            </IonButton>
            <IonButton shape="round" fill="outline" onClick={() => setShowModalGrupo(false)}>Cancelar</IonButton>
          </div>
        </div>
      </IonModal>
    </div>
  );
};

export default GerenciamentoPermissoes;
