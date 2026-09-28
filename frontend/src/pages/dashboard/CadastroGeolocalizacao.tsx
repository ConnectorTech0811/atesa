import React, { useEffect, useState, useMemo } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ToastContext';
import {
  Geolocalizacao,
  HierarquiaGeolocalizacao,
  ClienteHierarquia,
  UnidadeHierarquia,
  CooperadoHierarquia,
  listarHierarquiaGeolocalizacao,
  listarGeolocalizacoes,
  criarGeolocalizacao,
  atualizarGeolocalizacao,
  excluirGeolocalizacao,
  alternarExcecaoGeolocalizacao,
} from '../../api/geolocalizacaoApi';
import './CadastroGeolocalizacao.css';

// ── ÍCONES SVG MODERNOS ───────────────────────────────────────────────────────

const IconLocationMain: React.FC<{ size?: number }> = ({ size = 26 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" fill="#ffffff" stroke="none" />
  </svg>
);

const IconUser: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconBuilding: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M8 10h.01" />
    <path d="M16 10h.01" />
    <path d="M8 14h.01" />
    <path d="M16 14h.01" />
  </svg>
);

const IconTarget: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="6" />
    <line x1="12" y1="2" x2="12" y2="6" />
    <line x1="12" y1="18" x2="12" y2="22" />
    <line x1="2" y1="12" x2="6" y2="12" />
    <line x1="18" y1="12" x2="22" y2="12" />
  </svg>
);

const IconPin: React.FC<{ size?: number }> = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconRuler: React.FC<{ size?: number }> = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.3 15.3l-6.6 6.6a2.4 2.4 0 0 1-3.4 0L2.7 13.3a2.4 2.4 0 0 1 0-3.4L9.3 3.3a2.4 2.4 0 0 1 3.4 0l8.6 8.6a2.4 2.4 0 0 1 0 3.4z" />
    <line x1="14" y1="6" x2="16" y2="8" />
    <line x1="10" y1="10" x2="12" y2="12" />
    <line x1="6" y1="14" x2="8" y2="16" />
  </svg>
);

const IconProhibited: React.FC<{ size?: number }> = ({ size = 17 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const IconSend: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

const IconPlus: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const IconPencil: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconTrash: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconEmptyWatermark: React.FC<{ size?: number }> = ({ size = 48 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// ── COMPONENTE PRINCIPAL ──────────────────────────────────────────────────────

const CadastroGeolocalizacao: React.FC = () => {
  const history = useHistory();
  const { usuario } = useAuth();
  const { showToast } = useToast();

  // Dados da Hierarquia
  const [hierarquia, setHierarquia] = useState<HierarquiaGeolocalizacao>({
    empresas: [],
    unidades: [],
    cooperados: [],
  });

  // Lista de Georreferenciamentos Cadastrados
  const [locais, setLocais] = useState<Geolocalizacao[]>([]);
  const [carregando, setCarregando] = useState<boolean>(true);
  const [salvando, setSalvando] = useState<boolean>(false);

  // Seleções do Card 1 (Hierarquia: Cliente → Unidade → Cooperado)
  const [clienteSelecionadoId, setClienteSelecionadoId] = useState<number | ''>('');
  const [localSelecionadoId, setLocalSelecionadoId] = useState<number | ''>('');
  const [cooperadoSelecionadoId, setCooperadoSelecionadoId] = useState<number | ''>('');

  // Formulário do Card 2 (Dados da Localização)
  const [editandoId, setEditandoId] = useState<number | null>(null);
  const [nomeLocal, setNomeLocal] = useState<string>('');
  const [latitude, setLatitude] = useState<string>('');
  const [longitude, setLongitude] = useState<string>('');
  const [distanciaMetros, setDistanciaMetros] = useState<string>('1000');
  const [excecao, setExcecao] = useState<string>('0'); // '0' = Não, '1' = Sim

  // Linha selecionada na tabela para destaque e edição
  const [linhaSelecionadaId, setLinhaSelecionadaId] = useState<number | null>(null);

  // Modal de confirmação de exclusão
  const [itemParaExcluir, setItemParaExcluir] = useState<Geolocalizacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Carregar dados iniciais
  const carregarDados = async () => {
    try {
      setCarregando(true);
      const [hier, listaLocais] = await Promise.all([
        listarHierarquiaGeolocalizacao().catch(() => ({ empresas: [], unidades: [], cooperados: [] })),
        listarGeolocalizacoes().catch(() => []),
      ]);
      setHierarquia(hier);
      setLocais(listaLocais);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao carregar dados de geolocalização.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // ── FILTROS DA HIERARQUIA ──────────────────────────────────────────────────

  // Unidades filtradas conforme o cliente selecionado
  const unidadesFiltradas = useMemo(() => {
    if (!clienteSelecionadoId) return hierarquia.unidades;
    return hierarquia.unidades.filter((u) => u.empresa_id === Number(clienteSelecionadoId));
  }, [hierarquia.unidades, clienteSelecionadoId]);

  // Cooperados filtrados conforme o cliente e unidade selecionados
  const cooperadosFiltrados = useMemo(() => {
    let list = hierarquia.cooperados;
    if (localSelecionadoId) {
      list = list.filter((c) => c.unidade_id === Number(localSelecionadoId) || c.id === Number(cooperadoSelecionadoId));
    } else if (clienteSelecionadoId) {
      list = list.filter((c) => c.empresa_id === Number(clienteSelecionadoId) || c.id === Number(cooperadoSelecionadoId));
    }
    return list;
  }, [hierarquia.cooperados, clienteSelecionadoId, localSelecionadoId, cooperadoSelecionadoId]);

  // Registros de geolocalização filtrados para a tabela (Card 2)
  const registrosFiltrados = useMemo(() => {
    let res = locais;
    if (cooperadoSelecionadoId) {
      res = res.filter((l) => l.candidato_id === Number(cooperadoSelecionadoId));
    } else if (localSelecionadoId) {
      res = res.filter((l) => l.unidade_id === Number(localSelecionadoId));
    } else if (clienteSelecionadoId) {
      res = res.filter((l) => l.empresa_id === Number(clienteSelecionadoId));
    }
    return res;
  }, [locais, clienteSelecionadoId, localSelecionadoId, cooperadoSelecionadoId]);

  // ── REGRAS DE HIERARQUIA E HERANÇA DE COORDENADAS ──────────────────────────

  // Ao trocar de Cliente
  const handleSelecionarCliente = (empresaIdStr: string) => {
    const empId = empresaIdStr ? Number(empresaIdStr) : '';
    setClienteSelecionadoId(empId);
    setLocalSelecionadoId('');
    setCooperadoSelecionadoId('');
    setEditandoId(null);
    setLinhaSelecionadaId(null);

    const emp = hierarquia.empresas.find((e) => e.id === empId);
    if (emp) {
      setNomeLocal(emp.nome_empresa);
    }
  };

  // Ao trocar de Local / Unidade
  const handleSelecionarLocal = (unidadeIdStr: string) => {
    const unidId = unidadeIdStr ? Number(unidadeIdStr) : '';
    setLocalSelecionadoId(unidId);
    setCooperadoSelecionadoId('');
    setEditandoId(null);
    setLinhaSelecionadaId(null);

    const unid = hierarquia.unidades.find((u) => u.id === unidId);
    if (unid) {
      setNomeLocal(unid.nome_unidade);
      // Se a unidade já tem coordenadas cadastradas, preenche
      if (unid.latitude && unid.longitude) {
        setLatitude(String(unid.latitude));
        setLongitude(String(unid.longitude));
      }
      // Se não tiver cliente selecionado, auto-seleciona
      if (!clienteSelecionadoId && unid.empresa_id) {
        setClienteSelecionadoId(unid.empresa_id);
      }
    }
  };

  // Ao trocar de Cooperado
  const handleSelecionarCooperado = (cooperadoIdStr: string) => {
    const coopId = cooperadoIdStr ? Number(cooperadoIdStr) : '';
    setCooperadoSelecionadoId(coopId);
    setEditandoId(null);
    setLinhaSelecionadaId(null);

    if (coopId) {
      const coop = hierarquia.cooperados.find((c) => c.id === coopId);
      if (coop) {
        // Verifica se já existe geolocalização cadastrada especificamente para este cooperado
        const geoExistente = locais.find((l) => l.candidato_id === coopId);
        if (geoExistente) {
          setNomeLocal(geoExistente.nome_local);
          setLatitude(String(geoExistente.latitude));
          setLongitude(String(geoExistente.longitude));
          setDistanciaMetros(String(geoExistente.raio_metros || 1000));
          setExcecao(geoExistente.excecao ? '1' : '0');
          setEditandoId(geoExistente.id);
          setLinhaSelecionadaId(geoExistente.id);
        } else {
          // Regra de Herança: Se o cooperado não tiver coordenada própria, vale a coordenada da unidade!
          const unid = hierarquia.unidades.find((u) => u.id === coop.unidade_id);
          setNomeLocal(unid ? `${unid.nome_unidade} — ${coop.nome}` : coop.nome);
          if (coop.latitude && coop.longitude) {
            setLatitude(String(coop.latitude));
            setLongitude(String(coop.longitude));
          } else if (unid?.latitude && unid?.longitude) {
            setLatitude(String(unid.latitude));
            setLongitude(String(unid.longitude));
          }
          setExcecao('0');
        }

        // Garante que cliente e unidade fiquem selecionados
        if (coop.empresa_id && !clienteSelecionadoId) {
          setClienteSelecionadoId(coop.empresa_id);
        }
        if (coop.unidade_id && !localSelecionadoId) {
          setLocalSelecionadoId(coop.unidade_id);
        }
      }
    }
  };

  // ── GRAVAÇÃO DOS DADOS (CRIAR / EDITAR) ──────────────────────────────────────

  const handleGravarDados = async (e: React.FormEvent) => {
    e.preventDefault();

    const isExcecaoAtiva = excecao === '1';

    // Validações
    if (!isExcecaoAtiva && (!latitude || !longitude)) {
      showToast('Por favor, informe a Latitude e a Longitude ou marque como Exceção.', 'warning');
      return;
    }

    const latNum = Number(latitude) || 0;
    const lngNum = Number(longitude) || 0;
    const distNum = Number(distanciaMetros) || 1000;

    // Obtém dados do Cliente, Unidade e Cooperado selecionados
    const emp = hierarquia.empresas.find((e) => e.id === Number(clienteSelecionadoId));
    const unid = hierarquia.unidades.find((u) => u.id === Number(localSelecionadoId));
    const coop = hierarquia.cooperados.find((c) => c.id === Number(cooperadoSelecionadoId));

    let nomeLocalFinal = nomeLocal.trim();
    if (!nomeLocalFinal) {
      if (unid && coop) nomeLocalFinal = `${unid.nome_unidade} - ${coop.nome}`;
      else if (unid) nomeLocalFinal = unid.nome_unidade;
      else if (emp) nomeLocalFinal = emp.nome_empresa;
      else if (coop) nomeLocalFinal = coop.nome;
      else nomeLocalFinal = 'Localização Padrão';
    }

    setSalvando(true);
    try {
      if (editandoId) {
        // Atualizar
        await atualizarGeolocalizacao(editandoId, {
          empresa_id: emp ? emp.id : null,
          empresa_nome: emp ? emp.nome_empresa : undefined,
          unidade_id: unid ? unid.id : null,
          nome_local: nomeLocalFinal,
          candidato_id: coop ? coop.id : null,
          candidato_nome: coop ? coop.nome : null,
          candidato_matricula: coop ? coop.matricula : null,
          latitude: latNum,
          longitude: lngNum,
          raio_metros: distNum,
          excecao: isExcecaoAtiva,
          bloqueio_ativo: true,
        });
        showToast('Localização atualizada com sucesso!', 'success');
      } else {
        // Criar Novo
        await criarGeolocalizacao({
          empresa_id: emp ? emp.id : null,
          empresa_nome: emp ? emp.nome_empresa : undefined,
          unidade_id: unid ? unid.id : null,
          nome_local: nomeLocalFinal,
          candidato_id: coop ? coop.id : null,
          candidato_nome: coop ? coop.nome : null,
          candidato_matricula: coop ? coop.matricula : null,
          latitude: latNum,
          longitude: lngNum,
          raio_metros: distNum,
          excecao: isExcecaoAtiva,
          bloqueio_ativo: true,
        });
        showToast('Localização e perímetro gravados com sucesso!', 'success');
      }

      // Recarrega lista
      const listaAtualizada = await listarGeolocalizacoes();
      setLocais(listaAtualizada);

      // Limpa edição
      setEditandoId(null);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao gravar dados de geolocalização.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  // ── AÇÕES DA TABELA ─────────────────────────────────────────────────────────

  const handleEditarLinha = (item: Geolocalizacao) => {
    setEditandoId(item.id);
    setLinhaSelecionadaId(item.id);
    setNomeLocal(item.nome_local || '');
    setLatitude(String(item.latitude));
    setLongitude(String(item.longitude));
    setDistanciaMetros(String(item.raio_metros || 1000));
    setExcecao(item.excecao ? '1' : '0');

    if (item.empresa_id) setClienteSelecionadoId(item.empresa_id);
    if (item.unidade_id) setLocalSelecionadoId(item.unidade_id);
    if (item.candidato_id) setCooperadoSelecionadoId(item.candidato_id);

    showToast(`Editando localização: ${item.nome_local}`, 'info');
  };

  const handleCadastrarNovaLocalizacao = () => {
    setEditandoId(null);
    setLinhaSelecionadaId(null);
    setNomeLocal('');
    setLatitude('');
    setLongitude('');
    setDistanciaMetros('1000');
    setExcecao('0');
    showToast('Pronto para cadastrar nova localização.', 'info');
  };

  const handleConfirmarExclusao = async () => {
    if (!itemParaExcluir) return;
    setExcluindo(true);
    try {
      await excluirGeolocalizacao(itemParaExcluir.id);
      showToast('Localização removida com sucesso.', 'success');
      setItemParaExcluir(null);
      if (editandoId === itemParaExcluir.id) {
        handleCadastrarNovaLocalizacao();
      }
      const lista = await listarGeolocalizacoes();
      setLocais(lista);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir localização.', 'error');
    } finally {
      setExcluindo(false);
    }
  };

  const handleAlternarExcecao = async (item: Geolocalizacao) => {
    const novoStatus = !Boolean(item.excecao);
    try {
      await alternarExcecaoGeolocalizacao(item.id, novoStatus);
      showToast(
        novoStatus
          ? `Status de Exceção ATIVADO: ${item.candidato_nome || item.nome_local} liberado de qualquer lugar.`
          : `Status de Exceção DESATIVADO para ${item.candidato_nome || item.nome_local}.`,
        'success'
      );
      const lista = await listarGeolocalizacoes();
      setLocais(lista);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao alterar exceção.', 'error');
    }
  };

  // Capturar GPS atual pelo navegador
  const handleCapturarGpsAtual = () => {
    if (!navigator.geolocation) {
      showToast('Seu navegador não possui suporte para capturar coordenadas GPS.', 'warning');
      return;
    }
    showToast('Obtendo coordenadas do dispositivo...', 'info');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatitude(String(Number(pos.coords.latitude.toFixed(6))));
        setLongitude(String(Number(pos.coords.longitude.toFixed(6))));
        showToast(`Coordenadas capturadas! Precisão ~${Math.round(pos.coords.accuracy)}m`, 'success');
      },
      (err) => {
        showToast(`Falha ao obter GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="geo-bloqueio-page">
      {/* ── CABEÇALHO PRINCIPAL ────────────────────────────────────────── */}
      <div className="geo-bloqueio-header">
        <div className="geo-bloqueio-header-left">
          <div className="geo-bloqueio-pin-icon">
            <IconLocationMain size={28} />
          </div>
          <div>
            <h1 className="geo-bloqueio-header-title">Bloqueio Geolocalização</h1>
            <p className="geo-bloqueio-header-subtitle">
              Gerencie e controle os locais permitidos para operação dos cooperados.
            </p>
          </div>
        </div>

        <div className="geo-bloqueio-header-right">
          <div className="geo-bloqueio-badge-info">
            <div className="geo-bloqueio-badge-info-title">Localização segura.</div>
            <div className="geo-bloqueio-badge-info-desc">Operação confiável.</div>
          </div>
          <button
            type="button"
            className="geo-bloqueio-close-btn"
            onClick={() => history.push('/dashboard/usuarios')}
            title="Fechar / Voltar"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── GRID SUPERIOR: CARD 1 (SELECIONAR DADOS) + CARD 2 (DADOS DA LOCALIZAÇÃO) ─ */}
      <div className="geo-top-grid">
        {/* CARD 1: SELECIONAR DADOS */}
        <div className="geo-card">
          <div className="geo-card-header">
            <div className="geo-step-circle">1</div>
            <h2 className="geo-card-title">Selecionar dados</h2>
          </div>

          <div className="geo-select-row">
            {/* Selecione o Cliente */}
            <div className="geo-field-group">
              <label className="geo-field-label">Selecione o Cliente</label>
              <div className="geo-input-with-icon">
                <span className="geo-input-icon">
                  <IconBuilding size={18} />
                </span>
                <select
                  className="geo-select"
                  value={clienteSelecionadoId}
                  onChange={(e) => handleSelecionarCliente(e.target.value)}
                >
                  <option value="">Selecione o Cliente (Opcional)...</option>
                  {hierarquia.empresas.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.nome_empresa}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Selecione o Local (ATESA / Unidade) */}
            <div className="geo-field-group">
              <label className="geo-field-label">Selecione o Local (ATESA)</label>
              <div className="geo-input-with-icon">
                <span className="geo-input-icon">
                  <IconBuilding size={18} />
                </span>
                <select
                  className="geo-select"
                  value={localSelecionadoId}
                  onChange={(e) => handleSelecionarLocal(e.target.value)}
                >
                  <option value="">
                    {unidadesFiltradas.length === 0 ? 'Nenhuma unidade encontrada' : 'Selecione o Local / Unidade (Opcional)...'}
                  </option>
                  {unidadesFiltradas.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome_unidade}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Selecione o Cooperado (Opcional - Hierarquia) */}
          <div className="geo-field-group" style={{ marginTop: 4 }}>
            <label className="geo-field-label">
              Cooperado Específico (Opcional — se não selecionado, vale para toda a unidade)
            </label>
            <div className="geo-input-with-icon">
              <span className="geo-input-icon">
                <IconUser size={18} />
              </span>
              <select
                className="geo-select"
                value={cooperadoSelecionadoId}
                onChange={(e) => handleSelecionarCooperado(e.target.value)}
              >
                <option value="">Todos os Cooperados da Unidade / Projeto (Vale para toda a unidade)</option>
                {cooperadosFiltrados.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.matricula ? `[#${c.matricula}] ` : ''}{c.nome} {c.cargo ? `— ${c.cargo}` : ''} {c.nome_unidade ? `(${c.nome_unidade})` : ''} (Adesão 100% Homologado)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Badge Informativo do Cooperado Selecionado */}
          {cooperadoSelecionadoId && (() => {
            const coopSel = hierarquia.cooperados.find((c) => c.id === Number(cooperadoSelecionadoId));
            if (!coopSel) return null;
            const geoExist = locais.find((l) => l.candidato_id === coopSel.id);
            return (
              <div
                style={{
                  marginTop: 8,
                  padding: '8px 12px',
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 8,
                  fontSize: 12.5,
                  color: '#15803d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 6,
                }}
              >
                <div>
                  <strong>Cooperado Selecionado:</strong> {coopSel.matricula ? `[#${coopSel.matricula}] ` : ''}{coopSel.nome} {coopSel.nome_unidade ? `• ${coopSel.nome_unidade}` : ''}
                </div>
                <div style={{ fontWeight: 600, fontSize: 11.5 }}>
                  {geoExist ? '✓ Coordenada Personalizada do Cooperado' : 'ℹ️ Coordenada herdada da Unidade / Projeto'}
                </div>
              </div>
            );
          })()}

          {/* Box de Informações de Regras */}
          <div className="geo-info-box">
            <span style={{ fontSize: 16 }}>💡</span>
            <div>
              <strong>Regra de Hierarquia:</strong> Cliente → Unidades → Cooperados. Se o cooperado não possuir coordenada própria personalizada, valerá automaticamente a coordenada da unidade. Cooperados com status de <strong>Exceção</strong> podem realizar marcações de qualquer lugar.
            </div>
          </div>
        </div>

        {/* CARD 2: DADOS DA LOCALIZAÇÃO */}
        <div className="geo-card geo-card-dados-loc">
          <div className="geo-dados-loc-header">
            <IconTarget size={22} />
            <h3>Dados da Localização</h3>
          </div>

          <form onSubmit={handleGravarDados} className="geo-dados-loc-form">
            {/* Latitude */}
            <div className="geo-field-group">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label className="geo-field-label">Latitude</label>
                <button
                  type="button"
                  onClick={handleCapturarGpsAtual}
                  style={{ background: 'none', border: 'none', color: '#1b5e20', fontSize: 11.5, cursor: 'pointer', fontWeight: 700, padding: 0 }}
                  title="Capturar coordenadas do GPS atual do navegador"
                >
                  📡 GPS Atual
                </button>
              </div>
              <div className="geo-input-with-icon">
                <span className="geo-input-icon">
                  <IconPin size={16} />
                </span>
                <input
                  type="text"
                  className="geo-input"
                  placeholder="Ex.: -23.5505"
                  value={latitude}
                  onChange={(e) => setLatitude(e.target.value)}
                />
              </div>
            </div>

            {/* Longitude */}
            <div className="geo-field-group">
              <label className="geo-field-label">Longitude</label>
              <div className="geo-input-with-icon">
                <span className="geo-input-icon">
                  <IconPin size={16} />
                </span>
                <input
                  type="text"
                  className="geo-input"
                  placeholder="Ex.: -46.6333"
                  value={longitude}
                  onChange={(e) => setLongitude(e.target.value)}
                />
              </div>
            </div>

            {/* Distância (em metros) */}
            <div className="geo-field-group">
              <label className="geo-field-label">Distância (em metros)</label>
              <div className="geo-input-with-icon">
                <span className="geo-input-icon">
                  <IconRuler size={16} />
                </span>
                <input
                  type="number"
                  min={10}
                  max={50000}
                  step={10}
                  className="geo-input"
                  placeholder="Ex.: 1000"
                  value={distanciaMetros}
                  onChange={(e) => setDistanciaMetros(e.target.value)}
                />
              </div>
            </div>

            {/* Exceção Geolocalização */}
            <div className="geo-field-group">
              <label className="geo-field-label">Exceção Geolocalização</label>
              <div className="geo-input-with-icon">
                <span className="geo-input-icon">
                  <IconProhibited size={16} />
                </span>
                <select
                  className="geo-select"
                  value={excecao}
                  onChange={(e) => setExcecao(e.target.value)}
                >
                  <option value="0">Não (Validação Ativa no Raio)</option>
                  <option value="1">Sim (Liberado de Qualquer Local)</option>
                </select>
              </div>
            </div>

            {/* Botão Gravar Dados */}
            <button
              type="submit"
              className="geo-btn-gravar"
              disabled={salvando}
            >
              <IconSend size={18} />
              <span>{salvando ? 'Gravando...' : editandoId ? 'Atualizar Dados' : 'Gravar Dados'}</span>
            </button>
          </form>
        </div>
      </div>

      {/* ── CARD INFERIOR: CONTROLE DE GEOLOCALIZAÇÃO ─────────────────────── */}
      <div className="geo-bottom-card">
        <div className="geo-bottom-header">
          <div className="geo-bottom-header-left">
            <div className="geo-step-circle">2</div>
            <h2 className="geo-card-title">Controle de Geolocalização</h2>
          </div>
          <div className="geo-badge-counter">
            {registrosFiltrados.length} {registrosFiltrados.length === 1 ? 'registro' : 'registros'}
          </div>
        </div>

        {/* Tabela de Registros */}
        <div className="geo-table-container">
          <table className="geo-table">
            <thead>
              <tr>
                <th>
                  <span className="geo-th-content">
                    <IconPin size={15} /> Local
                  </span>
                </th>
                <th>
                  <span className="geo-th-content">
                    # MAT
                  </span>
                </th>
                <th>
                  <span className="geo-th-content">
                    <IconUser size={15} /> Nome Cooperado
                  </span>
                </th>
                <th>
                  <span className="geo-th-content">
                    <IconPin size={15} /> Latitude
                  </span>
                </th>
                <th>
                  <span className="geo-th-content">
                    <IconPin size={15} /> Longitude
                  </span>
                </th>
                <th>
                  <span className="geo-th-content">
                    <IconRuler size={15} /> Distância
                  </span>
                </th>
                <th>
                  <span className="geo-th-content">
                    <IconProhibited size={15} /> Exceção
                  </span>
                </th>
                <th style={{ textAlign: 'right' }}>
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {carregando ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    Carregando configurações de geolocalização...
                  </td>
                </tr>
              ) : registrosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <div className="geo-empty-state">
                      <div className="geo-empty-icon">
                        <IconEmptyWatermark size={52} />
                      </div>
                      <h4 className="geo-empty-title">Nenhuma localização cadastrada.</h4>
                      <p className="geo-empty-desc">Cadastre uma nova localização para começar.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                registrosFiltrados.map((item) => {
                  const isSelected = linhaSelecionadaId === item.id || editandoId === item.id;
                  const isExcecaoItem = Boolean(item.excecao);
                  return (
                    <tr
                      key={item.id}
                      className={`geo-table-row ${isSelected ? 'geo-table-row-selected' : ''}`}
                      onClick={() => setLinhaSelecionadaId(item.id)}
                    >
                      {/* Local */}
                      <td style={{ fontWeight: 600, color: '#0f172a' }}>
                        <div>{item.nome_local}</div>
                        {item.empresa_nome && (
                          <div style={{ fontSize: 11.5, color: '#64748b', fontWeight: 400 }}>
                            {item.empresa_nome}
                          </div>
                        )}
                      </td>

                      {/* MAT */}
                      <td>
                        {item.candidato_matricula ? (
                          <span style={{ background: '#e8f5e9', color: '#1b5e20', padding: '2px 8px', borderRadius: 6, fontSize: 11.5, fontWeight: 700 }}>
                            #{item.candidato_matricula}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>— Geral</span>
                        )}
                      </td>

                      {/* Nome Cooperado */}
                      <td>
                        {item.candidato_nome ? (
                          <div style={{ fontWeight: 600, color: '#1e293b' }}>{item.candidato_nome}</div>
                        ) : (
                          <div style={{ color: '#64748b', fontStyle: 'italic', fontSize: 12.5 }}>
                            Todos da Unidade
                          </div>
                        )}
                      </td>

                      {/* Latitude */}
                      <td>
                        {item.latitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="geo-link-coords"
                            title="Ver no Google Maps"
                          >
                            {Number(item.latitude).toFixed(5)} ↗
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Longitude */}
                      <td>
                        {item.longitude ? (
                          <a
                            href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="geo-link-coords"
                            title="Ver no Google Maps"
                          >
                            {Number(item.longitude).toFixed(5)} ↗
                          </a>
                        ) : (
                          <span style={{ color: '#94a3b8' }}>—</span>
                        )}
                      </td>

                      {/* Distância */}
                      <td>
                        <span style={{ fontWeight: 600, color: '#334155' }}>
                          {item.raio_metros ? `${item.raio_metros.toLocaleString('pt-BR')} m` : '1.000 m'}
                        </span>
                      </td>

                      {/* Exceção */}
                      <td>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAlternarExcecao(item);
                          }}
                          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                          title="Clique para alternar o status de exceção"
                        >
                          {isExcecaoItem ? (
                            <span className="geo-badge-sim">
                              ✓ Sim (Isento)
                            </span>
                          ) : (
                            <span className="geo-badge-nao">
                              ✕ Não
                            </span>
                          )}
                        </button>
                      </td>

                      {/* Ações */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditarLinha(item);
                            }}
                            title="Editar este ponto de geolocalização"
                            style={{
                              background: '#e8f5e9',
                              border: '1px solid #c8e6c9',
                              color: '#1b5e20',
                              padding: '5px 9px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            <IconPencil size={13} />
                            <span>Editar</span>
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setItemParaExcluir(item);
                            }}
                            title="Excluir este ponto"
                            style={{
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              color: '#b91c1c',
                              padding: '5px 7px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Botões de Ação Inferiores */}
        <div className="geo-bottom-actions">
          <button
            type="button"
            className="geo-btn-cadastrar-novo"
            onClick={handleCadastrarNovaLocalizacao}
          >
            <IconPlus size={16} />
            <span>Cadastrar Nova Localização</span>
          </button>

          <button
            type="button"
            className="geo-btn-editar-sel"
            disabled={!linhaSelecionadaId}
            onClick={() => {
              const sel = locais.find((l) => l.id === linhaSelecionadaId);
              if (sel) handleEditarLinha(sel);
            }}
          >
            <IconPencil size={15} />
            <span>Editar Localização</span>
          </button>
        </div>
      </div>

      {/* ── MODAL DE CONFIRMAÇÃO DE EXCLUSÃO ──────────────────────────────── */}
      {itemParaExcluir && (
        <div className="geo-modal-overlay">
          <div className="geo-modal-box">
            <h3 style={{ margin: '0 0 10px 0', fontSize: 17, fontWeight: 700, color: '#991b1b' }}>
              Confirmar Exclusão de Localização
            </h3>
            <p style={{ margin: '0 0 20px 0', fontSize: 13.5, color: '#475569', lineHeight: 1.5 }}>
              Tem certeza de que deseja remover o ponto de geolocalização <strong>"{itemParaExcluir.nome_local}"</strong>? Os cooperados vinculados passarão a utilizar a coordenada padrão da unidade ou cliente.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setItemParaExcluir(null)}
                disabled={excluindo}
                style={{
                  padding: '9px 16px',
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  color: '#475569',
                  cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmarExclusao}
                disabled={excluindo}
                style={{
                  padding: '9px 18px',
                  background: '#dc2626',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                {excluindo ? 'Removendo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroGeolocalizacao;
