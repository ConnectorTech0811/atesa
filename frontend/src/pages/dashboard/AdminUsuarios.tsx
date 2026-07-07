import React, { useEffect, useState } from 'react';
import { IonButton, IonModal } from '@ionic/react';
import {
  EdicaoUsuario,
  NovoUsuario,
  TIPOS_USUARIO,
  TipoUsuario,
  Usuario,
  criarUsuario,
  editarUsuario,
  listarUsuarios,
  rotuloTipoUsuario,
} from '../../api/usuariosApi';
import { Regiao, listarRegioes } from '../../api/regioesApi';
import { formatarCPF, formatarTelefone } from '../../utils/formatters';
import { getAppName } from '../../theme/applyTheme';

const ESTADO_INICIAL_FORM = {
  nome: '',
  email: '',
  cpf: '',
  telefone: '',
  senha: '',
  tipoUsuario: '' as TipoUsuario | '',
  ehExecutivo: false,
  regiaoId: '' as number | '',
};

const ESTADO_INICIAL_EDICAO = {
  nome: '',
  email: '',
  telefone: '',
  tipoUsuario: '' as TipoUsuario | '',
  regiaoId: '' as number | '',
  ativo: true,
};

const AdminUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [usuarioEditando, setUsuarioEditando] = useState<Usuario | null>(null);
  const [form, setForm] = useState(ESTADO_INICIAL_FORM);
  const [edicao, setEdicao] = useState(ESTADO_INICIAL_EDICAO);
  const [erro, setErro] = useState('');
  const [erroEdicao, setErroEdicao] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');

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

  useEffect(() => {
    carregarDados();
  }, []);

  const atualizarCampo = <K extends keyof typeof ESTADO_INICIAL_FORM>(
    campo: K,
    valor: typeof ESTADO_INICIAL_FORM[K]
  ) => {
    setForm((prev) => ({ ...prev, [campo]: valor }));
  };

  const atualizarEdicao = <K extends keyof typeof ESTADO_INICIAL_EDICAO>(
    campo: K,
    valor: typeof ESTADO_INICIAL_EDICAO[K]
  ) => {
    setEdicao((prev) => ({ ...prev, [campo]: valor }));
  };

  const abrirNovoFormulario = () => {
    setForm(ESTADO_INICIAL_FORM);
    setErro('');
    setShowModal(true);
  };

  const abrirEdicao = (usuario: Usuario) => {
    setUsuarioEditando(usuario);
    setEdicao({
      nome: usuario.nome,
      email: usuario.email,
      telefone: usuario.telefone ?? '',
      tipoUsuario: usuario.tipo_usuario,
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
      tipoUsuario: form.tipoUsuario,
      ehExecutivo: form.tipoUsuario === 'consultor' ? form.ehExecutivo : false,
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

  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Cadastro de Usuários</h1>
          <p className="painel-subtitle">Usuários internos do sistema {getAppName()}</p>
        </div>
        <IonButton className="btn-acao" shape="round" color="secondary" onClick={abrirNovoFormulario}>
          + Novo Usuário
        </IonButton>
      </div>

      {erroCarregamento && (
        <div className="painel-vazio">
          {erroCarregamento}
          <div style={{ marginTop: 12 }}>
            <IonButton size="small" fill="outline" onClick={carregarDados}>
              Tentar novamente
            </IonButton>
          </div>
        </div>
      )}

      {!erroCarregamento && (
        <div className="painel-lista">
          {!carregando && usuarios.length === 0 && (
            <div className="painel-vazio">Nenhum usuário cadastrado ainda.</div>
          )}

          {usuarios.map((usuario) => (
            <div key={usuario.id} className="painel-card" style={{ opacity: usuario.ativo ? 1 : 0.6 }}>
              <div className="painel-card-info">
                <div className="painel-card-titulo">
                  <h3>{usuario.nome}</h3>
                  <span className="painel-tag">{rotuloTipoUsuario(usuario.tipo_usuario)}</span>
                  {!!usuario.eh_executivo && <span className="painel-tag">Executivo</span>}
                  {!usuario.ativo && <span className="painel-tag-inativo">Inativo</span>}
                </div>
                <p className="painel-detalhe">E-mail: {usuario.email}</p>
                <p className="painel-detalhe">CPF: {formatarCPF(usuario.cpf)}</p>
                <p className="painel-detalhe">Telefone: {usuario.telefone || '-'}</p>
                <p className="painel-detalhe">
                  Região: {regioes.find((r) => r.id === usuario.regiao_id)?.nome ?? '-'}
                </p>
              </div>
              <div className="painel-card-acoes">
                <button className="btn-secundario" onClick={() => abrirEdicao(usuario)}>
                  Editar
                </button>
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
            <input className="form-input" value={form.nome} onChange={(e) => atualizarCampo('nome', e.target.value)} />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>E-mail *</label>
              <input
                className="form-input"
                type="email"
                value={form.email}
                onChange={(e) => atualizarCampo('email', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>CPF *</label>
              <input
                className="form-input"
                value={form.cpf}
                placeholder="000.000.000-00"
                onChange={(e) => atualizarCampo('cpf', formatarCPF(e.target.value))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Telefone</label>
              <input
                className="form-input"
                value={form.telefone}
                placeholder="(00) 00000-0000"
                onChange={(e) => atualizarCampo('telefone', formatarTelefone(e.target.value))}
              />
            </div>
            <div className="form-field">
              <label>Senha provisória *</label>
              <input
                className="form-input"
                type="password"
                value={form.senha}
                placeholder="Mínimo 6 caracteres"
                onChange={(e) => atualizarCampo('senha', e.target.value)}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Região *</label>
              <select
                className="form-input"
                value={form.regiaoId}
                onChange={(e) => atualizarCampo('regiaoId', e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Selecione</option>
                {regioes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-field">
            <label>Tipo de usuário *</label>
            <select
              className="form-input"
              value={form.tipoUsuario}
              onChange={(e) => atualizarCampo('tipoUsuario', e.target.value as TipoUsuario | '')}
            >
              <option value="">Selecione</option>
              {TIPOS_USUARIO.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </select>
          </div>

          {form.tipoUsuario === 'consultor' && (
            <div className="form-checkbox-row">
              <input
                id="eh-executivo"
                type="checkbox"
                checked={form.ehExecutivo}
                onChange={(e) => atualizarCampo('ehExecutivo', e.target.checked)}
              />
              <label htmlFor="eh-executivo">Também atua como Executivo de Contas</label>
            </div>
          )}

          {erro && <p className="form-erro">{erro}</p>}

          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowModal(false)}>
              Cancelar
            </IonButton>
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
            <input
              className="form-input"
              value={edicao.nome}
              onChange={(e) => atualizarEdicao('nome', e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>E-mail *</label>
              <input
                className="form-input"
                type="email"
                value={edicao.email}
                onChange={(e) => atualizarEdicao('email', e.target.value)}
              />
            </div>
            <div className="form-field">
              <label>Telefone</label>
              <input
                className="form-input"
                value={edicao.telefone}
                placeholder="(00) 00000-0000"
                onChange={(e) => atualizarEdicao('telefone', formatarTelefone(e.target.value))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Região *</label>
              <select
                className="form-input"
                value={edicao.regiaoId}
                onChange={(e) => atualizarEdicao('regiaoId', e.target.value ? Number(e.target.value) : '')}
              >
                <option value="">Selecione</option>
                {regioes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label>Cargo (tipo de usuário) *</label>
              <select
                className="form-input"
                value={edicao.tipoUsuario}
                onChange={(e) => atualizarEdicao('tipoUsuario', e.target.value as TipoUsuario | '')}
              >
                <option value="">Selecione</option>
                {TIPOS_USUARIO.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.rotulo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-checkbox-row" style={{ marginTop: 8 }}>
            <input
              id="usuario-ativo"
              type="checkbox"
              checked={edicao.ativo}
              onChange={(e) => atualizarEdicao('ativo', e.target.checked)}
            />
            <label htmlFor="usuario-ativo">Usuário ativo</label>
          </div>

          {erroEdicao && <p className="form-erro">{erroEdicao}</p>}

          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowEditModal(false)}>
              Cancelar
            </IonButton>
            <IonButton shape="round" color="secondary" onClick={handleSalvarEdicao} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar alterações'}
            </IonButton>
          </div>
        </div>
      </IonModal>
    </div>
  );
};

export default AdminUsuarios;
