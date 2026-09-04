import React, { useEffect, useState, useRef } from 'react';
import { IonButton, IonModal, useIonViewWillEnter } from '@ionic/react';
import {
  EdicaoUsuario,
  NovoUsuario,
  TIPOS_USUARIO,
  TipoUsuario,
  Usuario,
  criarUsuario,
  editarUsuario,
  forcarTrocaSenha,
  excluirUsuario,
  listarUsuarios,
  rotuloTipoUsuario,
} from '../../api/usuariosApi';
import { Regiao, listarRegioes } from '../../api/regioesApi';
import { formatarCPF, formatarTelefone, validarCPF } from '../../utils/formatters';
import { getAppName } from '../../theme/applyTheme';
import { useToast } from '../../components/ToastContext';
import { useAuth } from '../../auth/AuthContext';
import { usePermissoes } from '../../auth/PermissoesContext';
import { IconEye, IconEyeOff } from '../../components/Icons';

const TIPOS_COM_EXECUTIVO: TipoUsuario[] = ['consultor', 'executivo_contas'];

const ESTADO_INICIAL_FORM = {
  nome: '',
  email: '',
  cpf: '',
  telefone: '',
  senha: 'Atesa@2026',
  tipoUsuario: '' as TipoUsuario | '',
  ehExecutivo: false,
  regiaoId: '' as number | '',
};

const ESTADO_INICIAL_EDICAO = {
  nome: '',
  email: '',
  telefone: '',
  tipoUsuario: '' as TipoUsuario | '',
  ehExecutivo: false,
  regiaoId: '' as number | '',
  ativo: true,
};

const AdminUsuarios: React.FC = () => {
  const { showToast } = useToast();
  const { usuario: usuarioLogado } = useAuth();
  const { temPermissao } = usePermissoes();
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<TipoUsuario | ''>('');
  const [filtroNome, setFiltroNome] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [usuarioExcluindo, setUsuarioExcluindo] = useState<Usuario | null>(null);
  const [excluindo, setExcluindo] = useState(false);
  const [form, setForm] = useState(ESTADO_INICIAL_FORM);
  const [edicao, setEdicao] = useState(ESTADO_INICIAL_EDICAO);
  const [erro, setErro] = useState('');
  const [erroEdicao, setErroEdicao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  // Verificação de duplicatas no formulário de novo usuário
  const [nomesParecidosUser, setNomesParecidosUser] = useState<{ id: number; nome: string }[]>([]);
  const [cpfDuplicadoUser, setCpfDuplicadoUser] = useState<string | null>(null); // nome do existente
  const [cpfInvalidoUser, setCpfInvalidoUser] = useState(false);
  const [emailDuplicadoUser, setEmailDuplicadoUser] = useState<string | null>(null);
  const nomeUserTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregarDados = async () => {
    setCarregando(true);
    setErroCarregamento('');
    try {
      const [listaUsuarios, listaRegioes] = await Promise.all([listarUsuarios(), listarRegioes()]);
      setUsuarios(listaUsuarios);
      setRegioes(listaRegioes);
    } catch (e) {
      setErroCarregamento(
        e instanceof Error ? e.message : 'Não foi possível conectar à API. Verifique se o backend está rodando.'
      );
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => { carregarDados(); }, []);
  useIonViewWillEnter(() => { carregarDados(); });

  const atualizarCampo = <K extends keyof typeof ESTADO_INICIAL_FORM>(campo: K, valor: typeof ESTADO_INICIAL_FORM[K]) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  const atualizarEdicao = <K extends keyof typeof ESTADO_INICIAL_EDICAO>(campo: K, valor: typeof ESTADO_INICIAL_EDICAO[K]) =>
    setEdicao((prev) => ({ ...prev, [campo]: valor }));

  const limparAvisosUser = () => {
    setNomesParecidosUser([]);
    setCpfDuplicadoUser(null);
    setCpfInvalidoUser(false);
    setEmailDuplicadoUser(null);
  };

  const abrirNovoFormulario = () => {
    setForm(ESTADO_INICIAL_FORM);
    setErro('');
    limparAvisosUser();
    setShowModal(true);
  };

  const handleNomeUserChange = (valor: string) => {
    atualizarCampo('nome', valor);
    if (nomeUserTimerRef.current) clearTimeout(nomeUserTimerRef.current);
    if (valor.trim().length < 3) { setNomesParecidosUser([]); return; }
    nomeUserTimerRef.current = setTimeout(() => {
      const termo = valor.trim().toLowerCase();
      const parecidos = usuarios.filter((u) =>
        u.nome.toLowerCase().includes(termo) ||
        termo.split(' ').some((p) => p.length > 2 && u.nome.toLowerCase().includes(p))
      ).slice(0, 3);
      setNomesParecidosUser(parecidos);
    }, 300);
  };

  const handleCpfUserChange = (valor: string) => {
    const formatado = formatarCPF(valor);
    atualizarCampo('cpf', formatado);
    setCpfDuplicadoUser(null);
    setCpfInvalidoUser(false);
    const limpo = formatado.replace(/\D/g, '');
    if (limpo.length !== 11) return;
    if (!validarCPF(formatado)) { setCpfInvalidoUser(true); return; }
    const existente = usuarios.find((u) => u.cpf.replace(/\D/g, '') === limpo);
    if (existente) setCpfDuplicadoUser(existente.nome);
  };

  const handleEmailUserChange = (valor: string) => {
    atualizarCampo('email', valor);
    const existente = usuarios.find((u) => u.email.toLowerCase() === valor.trim().toLowerCase());
    setEmailDuplicadoUser(existente ? existente.nome : null);
  };

  const abrirEdicao = (usuario: Usuario) => {
    setUsuarioEditando(usuario);
    setEdicao({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone ?? '',
      tipoUsuario: usuario.tipo_usuario,
      ehExecutivo: Boolean(usuario.eh_executivo),
      regiaoId: usuario.regiao_id,
      ativo: Boolean(usuario.ativo),
    });
    setErroEdicao('');
    setShowEditModal(true);
  };

  const handleSalvar = async () => {
    if (!form.nome || !form.email || !form.cpf || !form.senha || !form.tipoUsuario || !form.regiaoId) {
      setErro('Preencha nome, e-mail, CPF, senha provisória, tipo de usuário e região.');
      return;
    }
    if (cpfInvalidoUser) { setErro('CPF inválido. Verifique os dígitos.'); return; }
    if (cpfDuplicadoUser) { setErro(`Já existe um usuário com este CPF: ${cpfDuplicadoUser}.`); return; }
    if (emailDuplicadoUser) { setErro(`Já existe um usuário com este e-mail: ${emailDuplicadoUser}.`); return; }
    if (!validarCPF(form.cpf)) { setErro('CPF inválido. Verifique os dígitos.'); return; }
    if (form.senha.length < 6) {
      setErro('A senha deve ter pelo menos 6 caracteres.');
      return;
    }
    const novoUsuario: NovoUsuario = {
      nome: form.nome,
      email: form.email,
      cpf: form.cpf,
      telefone: form.telefone,
      senha: form.senha,
      tipoUsuario: form.tipoUsuario as TipoUsuario,
      ehExecutivo: TIPOS_COM_EXECUTIVO.includes(form.tipoUsuario as TipoUsuario) ? form.ehExecutivo : false,
      regiaoId: Number(form.regiaoId),
    };
    setSalvando(true);
    setErro('');
    try {
      await criarUsuario(novoUsuario);
      setShowModal(false);
      await carregarDados();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cadastrar usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEdicao = async () => {
    if (!usuarioEditando) return;
    if (!edicao.nome || !edicao.email || !edicao.tipoUsuario || !edicao.regiaoId) {
      setErroEdicao('Preencha nome, e-mail, tipo de usuário e região.');
      return;
    }
    const dados: EdicaoUsuario = {
      nome: edicao.nome,
      email: edicao.email,
      telefone: edicao.telefone,
      tipoUsuario: edicao.tipoUsuario as TipoUsuario,
      ehExecutivo: TIPOS_COM_EXECUTIVO.includes(edicao.tipoUsuario as TipoUsuario) ? edicao.ehExecutivo : false,
      regiaoId: Number(edicao.regiaoId),
      ativo: edicao.ativo,
    };
    setSalvando(true);
    setErroEdicao('');
    try {
      await editarUsuario(usuarioEditando.id, dados);
      setShowEditModal(false);
      await carregarDados();
    } catch (e) {
      setErroEdicao(e instanceof Error ? e.message : 'Erro ao atualizar usuário.');
    } finally {
      setSalvando(false);
    }
  };

  const handleForcarTroca = async (usuario: Usuario) => {
    if (!confirm(`Pedir troca de senha para ${usuario.nome}?`)) return;
    try {
      await forcarTrocaSenha(usuario.id);
      setUsuarios((prev) => prev.map((u) => u.id === usuario.id ? { ...u, trocar_senha: true } : u));
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao pedir troca de senha.', 'error');
    }
  };

  const handleConfirmarExcluir = async () => {
    if (!usuarioExcluindo) return;
    setExcluindo(true);
    try {
      await excluirUsuario(usuarioExcluindo.id);
      showToast(`Usuário ${usuarioExcluindo.nome} excluído permanentemente do banco de dados.`, 'success');
      setUsuarioExcluindo(null);
      await carregarDados();
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Erro ao excluir usuário.', 'error');
    } finally {
      setExcluindo(false);
    }
  };

  const usuariosFiltrados = usuarios.filter((u) => {
    if (filtroTipo && u.tipo_usuario !== filtroTipo) return false;
    if (filtroNome && !u.nome.toLowerCase().includes(filtroNome.toLowerCase())) return false;
    return true;
  });

  const nomeRegiao = (id: number) => regioes.find((r) => r.id === id)?.nome ?? '-';

  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Cadastro de Usuários</h1>
          <p className="painel-subtitle">Usuários internos do sistema {getAppName()}</p>
        </div>
        {temPermissao('usuarios.criar') && (
          <IonButton className="btn-acao" shape="round" color="secondary" onClick={abrirNovoFormulario}>
            + Novo Usuário
          </IonButton>
        )}
      </div>

      {/* Filtros */}
      <div className="form-row" style={{ marginBottom: 16, gap: 12 }}>
        <div className="form-field" style={{ flex: 2 }}>
          <input
            className="form-input"
            placeholder="Buscar por nome..."
            value={filtroNome}
            onChange={(e) => setFiltroNome(e.target.value)}
          />
        </div>
        <div className="form-field" style={{ flex: 1 }}>
          <select className="form-input" value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value as TipoUsuario | '')}>
            <option value="">Todos os tipos</option>
            {TIPOS_USUARIO.map((t) => (
              <option key={t.valor} value={t.valor}>{t.rotulo}</option>
            ))}
          </select>
        </div>
      </div>

      {erroCarregamento && (
        <div className="painel-vazio">
          {erroCarregamento}
          <div style={{ marginTop: 12 }}>
            <IonButton size="small" fill="outline" onClick={carregarDados}>Tentar novamente</IonButton>
          </div>
        </div>
      )}

      {!erroCarregamento && (
        <div className="painel-lista">
          {!carregando && usuariosFiltrados.length === 0 && (
            <div className="painel-vazio">Nenhum usuário encontrado.</div>
          )}

          {usuariosFiltrados.map((usuario) => (
            <div key={usuario.id} className="painel-card" style={{ opacity: usuario.ativo ? 1 : 0.55 }}>
              <div className="painel-card-info">
                <div className="painel-card-titulo">
                  <h3>{usuario.nome}</h3>
                  <span className="painel-tag">{rotuloTipoUsuario(usuario.tipo_usuario)}</span>
                  {!!usuario.eh_executivo && <span className="painel-tag">Executivo</span>}
                  {!usuario.ativo && <span className="painel-tag-inativo">Inativo</span>}
                  {!!usuario.trocar_senha && (
                    <span style={{ fontSize: 11, background: '#fff3e0', color: '#e65100', padding: '2px 8px', borderRadius: 8, border: '1px solid #ffb74d', fontWeight: 600 }}>
                      Troca de senha pendente
                    </span>
                  )}
                </div>
                <p className="painel-detalhe">E-mail: {usuario.email}</p>
                <p className="painel-detalhe">CPF: {formatarCPF(usuario.cpf)}</p>
                {usuario.telefone && <p className="painel-detalhe">Telefone: {formatarTelefone(usuario.telefone)}</p>}
                <p className="painel-detalhe">Região: {nomeRegiao(usuario.regiao_id)}</p>
              </div>
              <div className="painel-card-acoes" style={{ flexDirection: 'column', gap: 6, alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {temPermissao('usuarios.editar') && (
                    <button className="btn-secundario" onClick={() => abrirEdicao(usuario)}>Editar</button>
                  )}
                  {temPermissao('usuarios.inativar') && usuarioLogado?.perfil === 'administrador' && usuario.id !== usuarioLogado?.id && (
                    <button
                      className="btn-secundario"
                      style={{ fontSize: 12, color: '#c62828', borderColor: '#ef9a9a' }}
                      onClick={() => setUsuarioExcluindo(usuario)}
                      title="Excluir usuário e histórico do banco"
                    >
                      🗑️ Excluir
                    </button>
                  )}
                </div>
                {temPermissao('usuarios.resetar_senha') && !usuario.trocar_senha && (
                  <button
                    className="btn-secundario"
                    style={{ fontSize: 12, color: '#e65100', borderColor: '#ffb74d' }}
                    onClick={() => handleForcarTroca(usuario)}
                  >
                    Pedir troca de senha
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de cadastro */}
      <IonModal className="modal-grande" isOpen={showModal} onDidDismiss={() => setShowModal(false)}>
        <div className="modal-form">
          <h2>Cadastrar Usuário</h2>

          <div className="form-field">
            <label>Nome *</label>
            <input className="form-input" value={form.nome} onChange={(e) => handleNomeUserChange(e.target.value)} />
            {nomesParecidosUser.length > 0 && (
              <div className="form-alerta">
                Atenção: já existe(m) usuário(s) com nome parecido:
                <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
                  {nomesParecidosUser.map((u) => <li key={u.id}>{u.nome}</li>)}
                </ul>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>E-mail *</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={(e) => handleEmailUserChange(e.target.value)}
                style={emailDuplicadoUser ? { borderColor: '#e53935' } : undefined}
              />
              {emailDuplicadoUser && (
                <div className="form-alerta">
                  Já existe um usuário com este e-mail: <strong>{emailDuplicadoUser}</strong>.
                </div>
              )}
            </div>
            <div className="form-field">
              <label>CPF *</label>
              <input
                className="form-input"
                value={form.cpf}
                placeholder="000.000.000-00"
                onChange={(e) => handleCpfUserChange(e.target.value)}
                style={(cpfInvalidoUser || cpfDuplicadoUser) ? { borderColor: '#e53935' } : undefined}
              />
              {cpfInvalidoUser && (
                <div className="form-alerta" style={{ color: '#c62828' }}>CPF inválido. Verifique os dígitos.</div>
              )}
              {cpfDuplicadoUser && !cpfInvalidoUser && (
                <div className="form-alerta">Já existe um usuário com este CPF: <strong>{cpfDuplicadoUser}</strong>.</div>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Telefone</label>
              <input className="form-input" value={form.telefone} placeholder="(00) 00000-0000" onChange={(e) => atualizarCampo('telefone', formatarTelefone(e.target.value))} />
            </div>
            <div className="form-field">
              <label>Senha provisória *</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  className="form-input"
                  type={mostrarSenha ? 'text' : 'password'}
                  value={form.senha}
                  placeholder="Mínimo 6 caracteres"
                  onChange={(e) => atualizarCampo('senha', e.target.value)}
                  style={{ paddingRight: 40, width: '100%' }}
                />
                <button
                  type="button"
                  onClick={() => setMostrarSenha((v) => !v)}
                  style={{ position: 'absolute', right: 10, background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 0, display: 'flex', alignItems: 'center' }}
                  title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrarSenha ? <IconEyeOff size={18} /> : <IconEye size={18} />}
                </button>
              </div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Tipo de usuário *</label>
              <select className="form-input" value={form.tipoUsuario} onChange={(e) => atualizarCampo('tipoUsuario', e.target.value as TipoUsuario | '')}>
                <option value="">Selecione</option>
                {TIPOS_USUARIO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Região *</label>
              <select className="form-input" value={form.regiaoId} onChange={(e) => atualizarCampo('regiaoId', e.target.value ? Number(e.target.value) : '')}>
                <option value="">Selecione</option>
                {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          </div>

          {TIPOS_COM_EXECUTIVO.includes(form.tipoUsuario as TipoUsuario) && (
            <div className="form-checkbox-row">
              <input id="eh-executivo" type="checkbox" checked={form.ehExecutivo} onChange={(e) => atualizarCampo('ehExecutivo', e.target.checked)} />
              <label htmlFor="eh-executivo">Também atua como Executivo de Contas (participa do rodízio)</label>
            </div>
          )}

          <p style={{ fontSize: 11, color: '#888', marginTop: 8 }}>O usuário receberá uma senha provisória e será solicitado a trocar no primeiro acesso.</p>

          {erro && <p className="form-erro">{erro}</p>}

          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowModal(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar usuário'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* Modal de edição */}
      <IonModal className="modal-grande" isOpen={showEditModal} onDidDismiss={() => setShowEditModal(false)}>
        <div className="modal-form">
          <h2>Editar Usuário</h2>
          <p className="painel-subtitle">{usuarioEditando?.nome}</p>

          <div className="form-field">
            <label>Nome *</label>
            <input className="form-input" value={edicao.nome} onChange={(e) => atualizarEdicao('nome', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>E-mail *</label>
              <input className="form-input" type="email" value={edicao.email} onChange={(e) => atualizarEdicao('email', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Telefone</label>
              <input className="form-input" value={edicao.telefone} placeholder="(00) 00000-0000" onChange={(e) => atualizarEdicao('telefone', formatarTelefone(e.target.value))} />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Tipo de usuário *</label>
              <select className="form-input" value={edicao.tipoUsuario} onChange={(e) => atualizarEdicao('tipoUsuario', e.target.value as TipoUsuario | '')}>
                <option value="">Selecione</option>
                {TIPOS_USUARIO.map((t) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}
              </select>
            </div>
            <div className="form-field">
              <label>Região *</label>
              <select className="form-input" value={edicao.regiaoId} onChange={(e) => atualizarEdicao('regiaoId', e.target.value ? Number(e.target.value) : '')}>
                <option value="">Selecione</option>
                {regioes.map((r) => <option key={r.id} value={r.id}>{r.nome}</option>)}
              </select>
            </div>
          </div>

          {TIPOS_COM_EXECUTIVO.includes(edicao.tipoUsuario as TipoUsuario) && (
            <div className="form-checkbox-row">
              <input id="edit-eh-executivo" type="checkbox" checked={edicao.ehExecutivo} onChange={(e) => atualizarEdicao('ehExecutivo', e.target.checked)} />
              <label htmlFor="edit-eh-executivo">Também atua como Executivo de Contas (participa do rodízio)</label>
            </div>
          )}

          <div className="form-checkbox-row" style={{ marginTop: 8 }}>
            <input id="usuario-ativo" type="checkbox" checked={edicao.ativo} onChange={(e) => atualizarEdicao('ativo', e.target.checked)} />
            <label htmlFor="usuario-ativo">Usuário ativo</label>
          </div>

          {erroEdicao && <p className="form-erro">{erroEdicao}</p>}

          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowEditModal(false)}>Cancelar</IonButton>
            <IonButton shape="round" color="secondary" onClick={handleSalvarEdicao} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* Modal de Confirmação de Exclusão Definitiva (Admin) */}
      <IonModal className="modal-pequeno" isOpen={!!usuarioExcluindo} onDidDismiss={() => setUsuarioExcluindo(null)}>
        <div className="modal-form" style={{ padding: '24px 28px' }}>
          <h2 style={{ color: '#c62828', fontSize: 18, margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            🗑️ Excluir Usuário Definitivamente
          </h2>
          <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: 8, padding: '12px 14px', marginBottom: 16, fontSize: 13, color: '#b71c1c', lineHeight: 1.5 }}>
            <strong>Atenção Administrador:</strong> Esta ação é irreversível e apagará permanentemente o usuário <strong>{usuarioExcluindo?.nome}</strong> ({usuarioExcluindo?.email}), removendo todos os vínculos, permissões e histórico do banco de dados.
          </div>
          <p style={{ fontSize: 13, color: '#555', margin: '0 0 20px' }}>
            Tem certeza absoluta de que deseja prosseguir com a exclusão completa deste usuário?
          </p>
          <div className="modal-acoes" style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <IonButton fill="outline" shape="round" onClick={() => setUsuarioExcluindo(null)} disabled={excluindo}>
              Cancelar
            </IonButton>
            <IonButton shape="round" color="danger" onClick={handleConfirmarExcluir} disabled={excluindo}>
              {excluindo ? 'Excluindo...' : 'Sim, Excluir do Banco'}
            </IonButton>
          </div>
        </div>
      </IonModal>
    </div>
  );
};

export default AdminUsuarios;
