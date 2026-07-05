import React, { useEffect, useState } from 'react';
import { IonButton, IonModal } from '@ionic/react';
import {
  NovoUsuario,
  TIPOS_USUARIO,
  TipoUsuario,
  Usuario,
  criarUsuario,
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

const AdminUsuarios: React.FC = () => {
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(ESTADO_INICIAL_FORM);
  const [erro, setErro] = useState('');
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

  const abrirNovoFormulario = () => {
    setForm(ESTADO_INICIAL_FORM);
    setErro('');
    setShowModal(true);
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
            <div key={usuario.id} className="painel-card">
              <div className="painel-card-info">
                <div className="painel-card-titulo">
                  <h3>{usuario.nome}</h3>
                  <span className="painel-tag">{rotuloTipoUsuario(usuario.tipo_usuario)}</span>
                  {usuario.eh_executivo && <span className="painel-tag">Também é Executivo</span>}
                </div>
                <p className="painel-detalhe">E-mail: {usuario.email}</p>
                <p className="painel-detalhe">CPF: {formatarCPF(usuario.cpf)}</p>
                <p className="painel-detalhe">Telefone: {usuario.telefone || '-'}</p>
                <p className="painel-detalhe">
                  Região: {regioes.find((r) => r.id === usuario.regiao_id)?.nome ?? '-'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
};

export default AdminUsuarios;
