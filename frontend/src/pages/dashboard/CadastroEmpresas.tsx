import React, { useEffect, useRef, useState } from 'react';
import { IonButton, IonModal } from '@ionic/react';
import { useAuth } from '../../auth/AuthContext';
import {
  Empresa,
  EmpresaParecida,
  HistoricoItem,
  NovaEmpresa,
  TipoHistorico,
  buscarEmpresasParecidas,
  criarEmpresa,
  listarEmpresas,
  listarHistorico,
  registrarHistorico,
} from '../../api/empresasApi';
import { Regiao, listarRegioes } from '../../api/regioesApi';
import { buscarEnderecoPorCep, formatarCEP, formatarCNPJ, formatarDataBR, formatarTelefone } from '../../utils/formatters';
import { getAppName } from '../../theme/applyTheme';

const ESTADO_INICIAL_FORM = {
  consultorNome: '',
  nomeEmpresa: '',
  cnpj: '',
  cep: '',
  rua: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  uf: '',
  emailEmpresa: '',
  telefoneEmpresa: '',
  representante: '',
  regiaoId: '' as number | '',
  dataPrimeiroContato: '',
};

const ROTULO_TIPO_HISTORICO: Record<TipoHistorico, string> = {
  visita: 'Visita',
  contato: 'Contato',
};

const CadastroEmpresas: React.FC = () => {
  const { usuario } = useAuth();
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [regioes, setRegioes] = useState<Regiao[]>([]);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [form, setForm] = useState(ESTADO_INICIAL_FORM);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [empresasParecidas, setEmpresasParecidas] = useState<EmpresaParecida[]>([]);
  const [novoTipoHistorico, setNovoTipoHistorico] = useState<TipoHistorico | ''>('');
  const [novaDataRegistro, setNovaDataRegistro] = useState('');
  const [novaObservacao, setNovaObservacao] = useState('');
  const [erro, setErro] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregamento, setErroCarregamento] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');
  const buscaTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const carregarDados = async () => {
    setCarregando(true);
    setErroCarregamento('');
    try {
      const [listaEmpresas, listaRegioes] = await Promise.all([listarEmpresas(), listarRegioes()]);
      setEmpresas(listaEmpresas);
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

  const handleNomeEmpresaChange = (valor: string) => {
    atualizarCampo('nomeEmpresa', valor);

    if (buscaTimeoutRef.current) clearTimeout(buscaTimeoutRef.current);
    if (valor.trim().length < 3) {
      setEmpresasParecidas([]);
      return;
    }
    buscaTimeoutRef.current = setTimeout(async () => {
      try {
        const parecidas = await buscarEmpresasParecidas(valor);
        setEmpresasParecidas(parecidas);
      } catch {
        setEmpresasParecidas([]);
      }
    }, 400);
  };

  const handleCepBlur = async () => {
    if (!form.cep) return;
    setBuscandoCep(true);
    const endereco = await buscarEnderecoPorCep(form.cep);
    setBuscandoCep(false);
    if (endereco) {
      setForm((prev) => ({
        ...prev,
        rua: endereco.rua || prev.rua,
        bairro: endereco.bairro || prev.bairro,
        cidade: endereco.cidade || prev.cidade,
        uf: endereco.uf || prev.uf,
      }));
    }
  };

  const abrirNovoFormulario = () => {
    setForm({ ...ESTADO_INICIAL_FORM, consultorNome: usuario?.nome ?? '' });
    setEmpresasParecidas([]);
    setErro('');
    setMensagemSucesso('');
    setShowFormModal(true);
  };

  const handleSalvar = async () => {
    if (!form.nomeEmpresa || !form.telefoneEmpresa || !form.emailEmpresa) {
      setErro('Preencha os campos obrigatórios: nome da empresa, telefone e e-mail.');
      return;
    }

    const novaEmpresa: NovaEmpresa = {
      cooperativa: getAppName(),
      consultorNome: form.consultorNome,
      nomeEmpresa: form.nomeEmpresa,
      cnpj: form.cnpj,
      cep: form.cep,
      rua: form.rua,
      numero: form.numero,
      complemento: form.complemento,
      bairro: form.bairro,
      cidade: form.cidade,
      uf: form.uf,
      emailEmpresa: form.emailEmpresa,
      telefoneEmpresa: form.telefoneEmpresa,
      representante: form.representante,
      regiaoId: form.regiaoId,
      dataPrimeiroContato: form.dataPrimeiroContato,
    };

    setSalvando(true);
    setErro('');
    try {
      const resultado = await criarEmpresa(novaEmpresa);
      setShowFormModal(false);
      setMensagemSucesso(
        resultado.executivoNome
          ? `Empresa cadastrada! Executivo de contas atribuído pelo rodízio: ${resultado.executivoNome}.`
          : 'Empresa cadastrada!'
      );
      await carregarDados();
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao cadastrar empresa.');
    } finally {
      setSalvando(false);
    }
  };

  const abrirHistorico = async (empresa: Empresa) => {
    setEmpresaSelecionada(empresa);
    setNovoTipoHistorico('');
    setNovaDataRegistro('');
    setNovaObservacao('');
    setShowHistoricoModal(true);
    try {
      const lista = await listarHistorico(empresa.id);
      setHistorico(lista);
    } catch {
      setHistorico([]);
    }
  };

  const handleRegistrarHistorico = async () => {
    if (!empresaSelecionada || !novoTipoHistorico || !novaDataRegistro || !novaObservacao) {
      setErro('Selecione o tipo, a data e descreva as observações.');
      return;
    }
    try {
      await registrarHistorico(empresaSelecionada.id, novoTipoHistorico, novaDataRegistro, novaObservacao);
      const lista = await listarHistorico(empresaSelecionada.id);
      setHistorico(lista);
      setNovoTipoHistorico('');
      setNovaDataRegistro('');
      setNovaObservacao('');
      setErro('');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao registrar histórico.');
    }
  };

  return (
    <div className="painel-page">
      <div className="painel-header">
        <div>
          <h1>Cadastro de Empresas</h1>
          <p className="painel-subtitle">Gerencie os clientes prospectados pela {getAppName()}</p>
        </div>
        <IonButton className="btn-acao" shape="round" color="secondary" onClick={abrirNovoFormulario}>
          + Nova Empresa
        </IonButton>
      </div>

      {mensagemSucesso && <div className="form-hint" style={{ marginBottom: 16 }}>{mensagemSucesso}</div>}

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
          {!carregando && empresas.length === 0 && <div className="painel-vazio">Nenhuma empresa cadastrada ainda.</div>}

          {empresas.map((empresa) => (
            <div key={empresa.id} className="painel-card">
              <div className="painel-card-info">
                <div className="painel-card-titulo">
                  <h3>{empresa.nome_empresa}</h3>
                  {empresa.regiao_nome && <span className="painel-tag">{empresa.regiao_nome}</span>}
                </div>
                <p className="painel-detalhe">CNPJ: {empresa.cnpj ? formatarCNPJ(empresa.cnpj) : 'Não informado'}</p>
                <p className="painel-detalhe">Telefone: {empresa.telefone_empresa}</p>
                <p className="painel-detalhe">E-mail: {empresa.email_empresa}</p>
                <p className="painel-detalhe">Representante: {empresa.representante || '-'}</p>
                <p className="painel-detalhe">
                  Executivo de contas: <strong>{empresa.executivo_nome ?? 'Não atribuído'}</strong>
                </p>
                <p className="painel-detalhe">Status: {empresa.status}</p>
              </div>
              <div className="painel-card-acoes">
                <button className="btn-secundario" onClick={() => abrirHistorico(empresa)}>
                  Histórico
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de cadastro de empresa */}
      <IonModal className="modal-grande" isOpen={showFormModal} onDidDismiss={() => setShowFormModal(false)}>
        <div className="modal-form">
          <h2>Cadastrar Empresa</h2>

          <div className="form-row">
            <div className="form-field">
              <label>Cooperativa</label>
              <input className="form-input" value={getAppName()} disabled />
            </div>
            <div className="form-field">
              <label>Consultor da cooperativa</label>
              <input
                className="form-input"
                value={form.consultorNome}
                onChange={(e) => atualizarCampo('consultorNome', e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label>Nome da empresa *</label>
            <input
              className="form-input"
              value={form.nomeEmpresa}
              onChange={(e) => handleNomeEmpresaChange(e.target.value)}
            />
            {empresasParecidas.length > 0 && (
              <div className="form-alerta">
                Atenção: já existe(m) empresa(s) com nome parecido cadastrada(s):
                <ul>
                  {empresasParecidas.map((p) => (
                    <li key={p.id}>
                      {p.nome_empresa} {p.cnpj ? `(CNPJ: ${formatarCNPJ(p.cnpj)})` : ''} — {p.status}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Telefone *</label>
              <input
                className="form-input"
                value={form.telefoneEmpresa}
                placeholder="(00) 00000-0000"
                onChange={(e) => atualizarCampo('telefoneEmpresa', formatarTelefone(e.target.value))}
              />
            </div>
            <div className="form-field">
              <label>E-mail *</label>
              <input
                className="form-input"
                type="email"
                value={form.emailEmpresa}
                onChange={(e) => atualizarCampo('emailEmpresa', e.target.value)}
              />
            </div>
          </div>

          <div className="form-field">
            <label>CNPJ</label>
            <input
              className="form-input"
              value={form.cnpj}
              placeholder="00.000.000/0000-00 (opcional)"
              onChange={(e) => atualizarCampo('cnpj', formatarCNPJ(e.target.value))}
            />
          </div>

          <div className="form-section-title">Endereço (opcional)</div>
          <div className="form-row">
            <div className="form-field form-field-small">
              <label>CEP</label>
              <input
                className="form-input"
                value={form.cep}
                placeholder="00000-000"
                onChange={(e) => atualizarCampo('cep', formatarCEP(e.target.value))}
                onBlur={handleCepBlur}
              />
              {buscandoCep && <span className="form-hint">Buscando endereço...</span>}
            </div>
            <div className="form-field">
              <label>Rua</label>
              <input className="form-input" value={form.rua} onChange={(e) => atualizarCampo('rua', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field form-field-small">
              <label>Número</label>
              <input className="form-input" value={form.numero} onChange={(e) => atualizarCampo('numero', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Complemento</label>
              <input
                className="form-input"
                value={form.complemento}
                onChange={(e) => atualizarCampo('complemento', e.target.value)}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-field">
              <label>Bairro</label>
              <input className="form-input" value={form.bairro} onChange={(e) => atualizarCampo('bairro', e.target.value)} />
            </div>
            <div className="form-field">
              <label>Cidade</label>
              <input className="form-input" value={form.cidade} onChange={(e) => atualizarCampo('cidade', e.target.value)} />
            </div>
            <div className="form-field form-field-small">
              <label>UF</label>
              <input
                className="form-input"
                value={form.uf}
                maxLength={2}
                onChange={(e) => atualizarCampo('uf', e.target.value.toUpperCase())}
              />
            </div>
          </div>

          <div className="form-section-title">Contato e Comercial (opcional)</div>

          <div className="form-field">
            <label>Representante da empresa</label>
            <input
              className="form-input"
              value={form.representante}
              onChange={(e) => atualizarCampo('representante', e.target.value)}
            />
          </div>

          <div className="form-row">
            <div className="form-field">
              <label>Região</label>
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
              <span className="form-hint">O executivo de contas só é atribuído quando a região é informada.</span>
            </div>
            <div className="form-field">
              <label>Data do primeiro contato</label>
              <input
                className="form-input"
                type="date"
                value={form.dataPrimeiroContato}
                onChange={(e) => atualizarCampo('dataPrimeiroContato', e.target.value)}
              />
            </div>
          </div>

          {erro && <p className="form-erro">{erro}</p>}

          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowFormModal(false)}>
              Cancelar
            </IonButton>
            <IonButton shape="round" color="secondary" onClick={handleSalvar} disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar empresa'}
            </IonButton>
          </div>
        </div>
      </IonModal>

      {/* Modal de histórico */}
      <IonModal className="modal-grande" isOpen={showHistoricoModal} onDidDismiss={() => setShowHistoricoModal(false)}>
        <div className="modal-form">
          <h2>Histórico</h2>
          <p className="painel-subtitle">{empresaSelecionada?.nome_empresa}</p>

          <div className="form-row">
            <div className="form-field">
              <label>Tipo</label>
              <select
                className="form-input"
                value={novoTipoHistorico}
                onChange={(e) => setNovoTipoHistorico(e.target.value as TipoHistorico | '')}
              >
                <option value="">Selecione</option>
                <option value="visita">Visita</option>
                <option value="contato">Contato</option>
              </select>
            </div>
            <div className="form-field">
              <label>Data</label>
              <input
                className="form-input"
                type="date"
                value={novaDataRegistro}
                onChange={(e) => setNovaDataRegistro(e.target.value)}
              />
            </div>
          </div>
          <div className="form-field">
            <label>Observações</label>
            <textarea
              className="form-input form-textarea"
              value={novaObservacao}
              onChange={(e) => setNovaObservacao(e.target.value)}
              rows={3}
            />
          </div>

          {erro && <p className="form-erro">{erro}</p>}

          <div className="modal-acoes modal-acoes-right">
            <IonButton shape="round" color="secondary" onClick={handleRegistrarHistorico}>
              Registrar
            </IonButton>
          </div>

          <div className="form-section-title">Registros anteriores</div>
          <div className="historico-lista">
            {historico.length === 0 && <p className="painel-vazio">Nenhum registro ainda.</p>}
            {historico.map((item) => (
              <div key={item.id} className="historico-item">
                <span className="historico-data">
                  {ROTULO_TIPO_HISTORICO[item.tipo]} — {formatarDataBR(item.data_registro)}
                </span>
                <p>{item.observacoes}</p>
                <p className="historico-autor">Registrado por: {item.registrado_por_nome}</p>
              </div>
            ))}
          </div>

          <div className="modal-acoes">
            <IonButton fill="outline" shape="round" onClick={() => setShowHistoricoModal(false)}>
              Fechar
            </IonButton>
          </div>
        </div>
      </IonModal>
    </div>
  );
};

export default CadastroEmpresas;
