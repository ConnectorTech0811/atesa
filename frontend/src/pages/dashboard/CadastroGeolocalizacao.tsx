import React, { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../components/ToastContext';
import {
  Geolocalizacao,
  PayloadCriarGeolocalizacao,
  PayloadAtualizarGeolocalizacao,
  listarGeolocalizacoes,
  criarGeolocalizacao,
  atualizarGeolocalizacao,
  alternarBloqueioGeolocalizacao,
  excluirGeolocalizacao,
} from '../../api/geolocalizacaoApi';
import {
  IconSearch,
  IconRefresh,
  IconAlert,
  IconCheck,
  IconBuilding,
} from '../../components/Icons';
import './CadastroGeolocalizacao.css';

// Ícones dedicados
const IconMapPin = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconRadar = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

const IconLock = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconUnlock = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

const IconPencil = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

const IconTrash = ({ size = 15 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

const IconCompass = ({ size = 16 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
);

const IconExternalLink = ({ size = 12 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const MENSAGEM_PADRAO_BLOQUEIO = 'Para realizar a marcação é preciso estar no local de serviço.';

const FORM_INICIAL: PayloadCriarGeolocalizacao = {
  nome_local: '',
  empresa_nome: '',
  endereco: '',
  latitude: 0,
  longitude: 0,
  raio_metros: 200,
  bloqueio_ativo: true,
  mensagem_bloqueio: MENSAGEM_PADRAO_BLOQUEIO,
};

const CadastroGeolocalizacao: React.FC = () => {
  const { usuario } = useAuth();
  const { showToast } = useToast();

  const [locais, setLocais] = useState<Geolocalizacao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState('');
  const [filtroBloqueio, setFiltroBloqueio] = useState<'todos' | 'ativos' | 'inativos'>('todos');

  // Modais
  const [modalAberto, setModalAberto] = useState(false);
  const [editandoItem, setEditandoItem] = useState<Geolocalizacao | null>(null);
  const [form, setForm] = useState<PayloadCriarGeolocalizacao>(FORM_INICIAL);
  const [salvando, setSalvando] = useState(false);
  const [capturandoGps, setCapturandoGps] = useState(false);

  // Modal de Exclusão
  const [itemExcluir, setItemExcluir] = useState<Geolocalizacao | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Acesso restrito
  const perfilAutorizado = usuario?.perfil === 'administrador' || usuario?.perfil === 'suporte';

  const carregarLocais = async () => {
    try {
      setCarregando(true);
      const data = await listarGeolocalizacoes({
        busca: busca.trim() || undefined,
        bloqueio: filtroBloqueio,
      });
      setLocais(data);
    } catch (err: any) {
      showToast(err.message || 'Erro ao carregar perímetros de geolocalização.', 'error');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (perfilAutorizado) {
      carregarLocais();
    }
  }, [busca, filtroBloqueio]);

  // Cálculos de KPI
  const kpis = useMemo(() => {
    const total = locais.length;
    const bloqueiosAtivos = locais.filter((l) => Boolean(l.bloqueio_ativo)).length;
    const raioMedio = total > 0 ? Math.round(locais.reduce((acc, l) => acc + (Number(l.raio_metros) || 0), 0) / total) : 0;
    const semBloqueio = total - bloqueiosAtivos;
    return { total, bloqueiosAtivos, raioMedio, semBloqueio };
  }, [locais]);

  const handleNovo = () => {
    setEditandoItem(null);
    setForm(FORM_INICIAL);
    setModalAberto(true);
  };

  const handleEditar = (item: Geolocalizacao) => {
    setEditandoItem(item);
    setForm({
      nome_local: item.nome_local,
      empresa_nome: item.empresa_nome || '',
      endereco: item.endereco || '',
      latitude: Number(item.latitude),
      longitude: Number(item.longitude),
      raio_metros: Number(item.raio_metros) || 200,
      bloqueio_ativo: Boolean(item.bloqueio_ativo),
      mensagem_bloqueio: item.mensagem_bloqueio || MENSAGEM_PADRAO_BLOQUEIO,
    });
    setModalAberto(true);
  };

  const handleCapturarGps = () => {
    if (!navigator.geolocation) {
      showToast('Geolocalização não é suportada pelo seu navegador.', 'warning');
      return;
    }
    setCapturandoGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCapturandoGps(false);
        const lat = Number(pos.coords.latitude.toFixed(6));
        const lng = Number(pos.coords.longitude.toFixed(6));
        setForm((prev) => ({
          ...prev,
          latitude: lat,
          longitude: lng,
        }));
        showToast(`Coordenadas GPS capturadas com sucesso! (Precisão ~${Math.round(pos.coords.accuracy)}m)`, 'success');
      },
      (err) => {
        setCapturandoGps(false);
        showToast(`Não foi possível obter a localização GPS: ${err.message}`, 'error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_local.trim()) {
      showToast('O nome do local / posto é obrigatório.', 'warning');
      return;
    }
    if (form.latitude === 0 && form.longitude === 0) {
      showToast('Informe coordenadas de Latitude e Longitude válidas.', 'warning');
      return;
    }

    try {
      setSalvando(true);
      if (editandoItem) {
        await atualizarGeolocalizacao(editandoItem.id, form as PayloadAtualizarGeolocalizacao);
        showToast('Perímetro de geolocalização atualizado com sucesso!', 'success');
      } else {
        await criarGeolocalizacao(form);
        showToast('Novo perímetro cadastrado com sucesso!', 'success');
      }
      setModalAberto(false);
      carregarLocais();
    } catch (err: any) {
      showToast(err.message || 'Erro ao salvar perímetro.', 'error');
    } finally {
      setSalvando(false);
    }
  };

  const handleAlternarBloqueio = async (item: Geolocalizacao) => {
    const novoStatus = !Boolean(item.bloqueio_ativo);
    try {
      await alternarBloqueioGeolocalizacao(item.id, novoStatus);
      showToast(
        novoStatus
          ? `Bloqueio ativado para "${item.nome_local}". Marcação restrita ao perímetro.`
          : `Bloqueio desativado para "${item.nome_local}".`,
        'success'
      );
      setLocais((prev) =>
        prev.map((l) => (l.id === item.id ? { ...l, bloqueio_ativo: novoStatus } : l))
      );
    } catch (err: any) {
      showToast(err.message || 'Erro ao alternar status do bloqueio.', 'error');
    }
  };

  const handleConfirmarExclusao = async () => {
    if (!itemExcluir) return;
    try {
      setExcluindo(true);
      await excluirGeolocalizacao(itemExcluir.id);
      showToast(`Perímetro "${itemExcluir.nome_local}" excluído com sucesso.`, 'success');
      setItemExcluir(null);
      carregarLocais();
    } catch (err: any) {
      showToast(err.message || 'Erro ao excluir perímetro.', 'error');
    } finally {
      setExcluindo(false);
    }
  };

  if (!perfilAutorizado) {
    return (
      <div className="geo-page">
        <div className="geo-empty-state" style={{ background: '#ffffff', borderRadius: 12, border: '1px solid #e2e8f0', marginTop: 40 }}>
          <div className="geo-empty-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <IconAlert size={28} />
          </div>
          <h2 className="geo-empty-title">Acesso Restrito</h2>
          <p className="geo-empty-desc">
            A tela de <strong>Cadastro de Geolocalização</strong> é restrita exclusivamente aos perfis de <strong>Suporte</strong> e <strong>Administrador</strong>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="geo-page">
      {/* ── Header ── */}
      <div className="geo-header">
        <div className="geo-title-wrapper">
          <div className="geo-header-icon">
            <IconMapPin size={24} />
          </div>
          <div>
            <h1 className="geo-title">Cadastro de Geolocalização</h1>
            <p className="geo-subtitle">
              Configure os perímetros geográficos autorizados e as regras de bloqueio de ponto para postos de serviço.
            </p>
          </div>
        </div>
        <button type="button" className="geo-btn-primary" onClick={handleNovo}>
          <IconRadar size={18} />
          <span>+ Novo Perímetro</span>
        </button>
      </div>

      {/* ── KPIs ── */}
      <div className="geo-kpi-grid">
        <div className="geo-kpi-card">
          <div className="geo-kpi-icon-wrap" style={{ background: '#f0fdf4', color: '#166534' }}>
            <IconMapPin size={24} />
          </div>
          <div className="geo-kpi-info">
            <span className="geo-kpi-label">Locais Mapeados</span>
            <span className="geo-kpi-value">{kpis.total}</span>
            <span className="geo-kpi-desc">Perímetros cadastrados no sistema</span>
          </div>
        </div>

        <div className="geo-kpi-card">
          <div className="geo-kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
            <IconLock size={24} />
          </div>
          <div className="geo-kpi-info">
            <span className="geo-kpi-label">Bloqueios Ativos</span>
            <span className="geo-kpi-value">{kpis.bloqueiosAtivos}</span>
            <span className="geo-kpi-desc">Exigem presença no local físico</span>
          </div>
        </div>

        <div className="geo-kpi-card">
          <div className="geo-kpi-icon-wrap" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <IconCompass size={24} />
          </div>
          <div className="geo-kpi-info">
            <span className="geo-kpi-label">Raio Médio</span>
            <span className="geo-kpi-value">{kpis.raioMedio}m</span>
            <span className="geo-kpi-desc">Tolerância média de distância</span>
          </div>
        </div>

        <div className="geo-kpi-card">
          <div className="geo-kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
            <IconUnlock size={24} />
          </div>
          <div className="geo-kpi-info">
            <span className="geo-kpi-label">Sem Bloqueio</span>
            <span className="geo-kpi-value">{kpis.semBloqueio}</span>
            <span className="geo-kpi-desc">Marcação livre de conferência</span>
          </div>
        </div>
      </div>

      {/* ── Controles de Busca e Filtros ── */}
      <div className="geo-controls-card">
        <div className="geo-search-group">
          <div className="geo-search-input-wrapper">
            <span className="geo-search-icon">
              <IconSearch size={16} />
            </span>
            <input
              type="text"
              className="geo-search-input"
              placeholder="Buscar por nome do local, empresa ou endereço..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
        </div>

        <div className="geo-filter-group">
          <select
            className="geo-select"
            value={filtroBloqueio}
            onChange={(e) => setFiltroBloqueio(e.target.value as any)}
          >
            <option value="todos">Todos os Bloqueios</option>
            <option value="ativos">Somente Bloqueio Ativo</option>
            <option value="inativos">Somente Sem Bloqueio</option>
          </select>

          <button
            type="button"
            className="geo-btn-refresh"
            onClick={carregarLocais}
            title="Recarregar Lista"
          >
            <IconRefresh size={16} />
          </button>
        </div>
      </div>

      {/* ── Tabela de Perímetros ── */}
      <div className="geo-table-card">
        {carregando ? (
          <div className="geo-empty-state">
            <div className="geo-empty-icon">
              <IconRefresh size={24} />
            </div>
            <p className="geo-empty-title">Carregando perímetros...</p>
          </div>
        ) : locais.length === 0 ? (
          <div className="geo-empty-state">
            <div className="geo-empty-icon">
              <IconMapPin size={24} />
            </div>
            <h3 className="geo-empty-title">Nenhum perímetro encontrado</h3>
            <p className="geo-empty-desc">
              {busca
                ? 'Nenhum local corresponde aos filtros pesquisados.'
                : 'Cadastre o primeiro perímetro de geolocalização clicando no botão acima.'}
            </p>
            <button type="button" className="geo-btn-primary" onClick={handleNovo}>
              + Cadastrar Perímetro
            </button>
          </div>
        ) : (
          <div className="geo-table-responsive">
            <table className="geo-table">
              <thead>
                <tr>
                  <th>Local / Posto</th>
                  <th>Empresa / Tomador</th>
                  <th>Coordenadas GPS</th>
                  <th>Raio de Tolerância</th>
                  <th>Bloqueio de Perímetro</th>
                  <th>Mensagem de Bloqueio</th>
                  <th style={{ textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {locais.map((item) => {
                  const bloqueioAtivo = Boolean(item.bloqueio_ativo);
                  const mapsUrl = `https://www.google.com/maps?q=${item.latitude},${item.longitude}`;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="geo-local-cell">
                          <span className="geo-local-name">{item.nome_local}</span>
                          {item.endereco && (
                            <span className="geo-address-text" title={item.endereco}>
                              📍 {item.endereco}
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        {item.empresa_nome ? (
                          <span className="geo-empresa-badge">
                            <IconBuilding size={12} />
                            {item.empresa_nome}
                          </span>
                        ) : (
                          <span style={{ color: '#94a3b8', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      <td>
                        <div>
                          <span className="geo-coords-badge">
                            {Number(item.latitude).toFixed(5)}, {Number(item.longitude).toFixed(5)}
                          </span>
                          <div>
                            <a
                              href={mapsUrl}
                              target="_blank"
                              rel="noreferrer noopener"
                              className="geo-map-link"
                              title="Abrir no Google Maps"
                            >
                              <span>Ver no Maps</span>
                              <IconExternalLink size={11} />
                            </a>
                          </div>
                        </div>
                      </td>

                      <td>
                        <span className="geo-radius-badge">
                          🎯 {item.raio_metros} metros
                        </span>
                      </td>

                      <td>
                        <span
                          className={`geo-status-badge ${
                            bloqueioAtivo ? 'geo-status-active' : 'geo-status-inactive'
                          }`}
                        >
                          {bloqueioAtivo ? (
                            <>
                              <IconLock size={13} />
                              <span>Bloqueio Ativo</span>
                            </>
                          ) : (
                            <>
                              <IconUnlock size={13} />
                              <span>Sem Bloqueio</span>
                            </>
                          )}
                        </span>
                      </td>

                      <td>
                        <div className="geo-lock-msg-cell" title={item.mensagem_bloqueio || MENSAGEM_PADRAO_BLOQUEIO}>
                          {item.mensagem_bloqueio || MENSAGEM_PADRAO_BLOQUEIO}
                        </div>
                      </td>

                      <td>
                        <div className="geo-actions-cell" style={{ justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            className="geo-btn-action geo-btn-action-edit"
                            onClick={() => handleEditar(item)}
                            title="Editar Perímetro"
                          >
                            <IconPencil size={15} />
                          </button>

                          <button
                            type="button"
                            className="geo-btn-action geo-btn-action-toggle"
                            onClick={() => handleAlternarBloqueio(item)}
                            title={bloqueioAtivo ? 'Desativar Bloqueio' : 'Ativar Bloqueio'}
                          >
                            {bloqueioAtivo ? <IconUnlock size={15} /> : <IconLock size={15} />}
                          </button>

                          <button
                            type="button"
                            className="geo-btn-action geo-btn-action-delete"
                            onClick={() => setItemExcluir(item)}
                            title="Excluir Perímetro"
                          >
                            <IconTrash size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de Cadastro / Edição ── */}
      {modalAberto && (
        <div className="geo-modal-backdrop" onClick={() => !salvando && setModalAberto(false)}>
          <div className="geo-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="geo-modal-header">
              <div className="geo-modal-header-title">
                <div className="geo-kpi-icon-wrap" style={{ width: 36, height: 36, background: '#f0fdf4', color: '#166534' }}>
                  <IconMapPin size={20} />
                </div>
                <h3 className="geo-modal-title">
                  {editandoItem ? 'Editar Perímetro de Geolocalização' : 'Novo Perímetro de Geolocalização'}
                </h3>
              </div>
              <button
                type="button"
                className="geo-modal-close-btn"
                onClick={() => !salvando && setModalAberto(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSalvar}>
              <div className="geo-modal-body">
                <div className="geo-form-group">
                  <label className="geo-form-label geo-form-label-required">
                    Nome do Local / Posto de Atendimento
                  </label>
                  <input
                    type="text"
                    required
                    className="geo-form-input"
                    placeholder="Ex: Hospital Municipal Central - Recepção Principal"
                    value={form.nome_local}
                    onChange={(e) => setForm({ ...form, nome_local: e.target.value })}
                  />
                </div>

                <div className="geo-form-row-2">
                  <div className="geo-form-group">
                    <label className="geo-form-label">Empresa / Posto Associado</label>
                    <input
                      type="text"
                      className="geo-form-input"
                      placeholder="Ex: Unimed Saúde"
                      value={form.empresa_nome || ''}
                      onChange={(e) => setForm({ ...form, empresa_nome: e.target.value })}
                    />
                  </div>

                  <div className="geo-form-group">
                    <label className="geo-form-label">Endereço Completo</label>
                    <input
                      type="text"
                      className="geo-form-input"
                      placeholder="Ex: Av. Paulista, 1000 - Bela Vista, SP"
                      value={form.endereco || ''}
                      onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                    />
                  </div>
                </div>

                {/* Box de Captura GPS */}
                <div className="geo-gps-capture-box">
                  <div className="geo-gps-capture-info">
                    <IconCompass size={20} />
                    <span>Capturar ponto GPS exato da sua posição atual:</span>
                  </div>
                  <button
                    type="button"
                    className="geo-gps-btn"
                    onClick={handleCapturarGps}
                    disabled={capturandoGps}
                  >
                    {capturandoGps ? 'Capturando GPS...' : '🎯 Usar Minha Localização'}
                  </button>
                </div>

                <div className="geo-form-row-2">
                  <div className="geo-form-group">
                    <label className="geo-form-label geo-form-label-required">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      className="geo-form-input"
                      placeholder="-23.550520"
                      value={form.latitude || ''}
                      onChange={(e) => setForm({ ...form, latitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>

                  <div className="geo-form-group">
                    <label className="geo-form-label geo-form-label-required">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      required
                      className="geo-form-input"
                      placeholder="-46.633308"
                      value={form.longitude || ''}
                      onChange={(e) => setForm({ ...form, longitude: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                </div>

                <div className="geo-form-group">
                  <label className="geo-form-label geo-form-label-required">
                    Raio de Tolerância em Metros (Geofence)
                  </label>
                  <input
                    type="number"
                    min="10"
                    max="10000"
                    required
                    className="geo-form-input"
                    value={form.raio_metros}
                    onChange={(e) => setForm({ ...form, raio_metros: parseInt(e.target.value, 10) || 200 })}
                  />
                  <div className="geo-preset-chips">
                    {[50, 100, 200, 500, 1000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`geo-preset-chip ${form.raio_metros === preset ? 'geo-preset-chip-active' : ''}`}
                        onClick={() => setForm({ ...form, raio_metros: preset })}
                      >
                        {preset} metros {preset === 200 ? '(Padrão)' : ''}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Card de Ativação do Bloqueio */}
                <div className="geo-toggle-card">
                  <div className="geo-toggle-info">
                    <span className="geo-toggle-title">Bloqueio de Perímetro Ativo</span>
                    <span className="geo-toggle-subtitle">
                      Se ativado, impede o cooperado de registrar ponto caso esteja fora do raio configurado.
                    </span>
                  </div>
                  <label className="geo-switch">
                    <input
                      type="checkbox"
                      checked={Boolean(form.bloqueio_ativo)}
                      onChange={(e) => setForm({ ...form, bloqueio_ativo: e.target.checked })}
                    />
                    <span className="geo-slider"></span>
                  </label>
                </div>

                <div className="geo-form-group">
                  <label className="geo-form-label">
                    Mensagem de Bloqueio Exibida ao Cooperado
                  </label>
                  <input
                    type="text"
                    className="geo-form-input"
                    value={form.mensagem_bloqueio || ''}
                    placeholder={MENSAGEM_PADRAO_BLOQUEIO}
                    onChange={(e) => setForm({ ...form, mensagem_bloqueio: e.target.value })}
                  />
                  <span style={{ fontSize: 11.5, color: '#94a3b8' }}>
                    Esta mensagem será exibida na tela do celular do cooperado quando ele tentar marcar ponto fora do local.
                  </span>
                </div>
              </div>

              <div className="geo-modal-footer">
                <button
                  type="button"
                  className="geo-btn-secondary"
                  onClick={() => setModalAberto(false)}
                  disabled={salvando}
                >
                  Cancelar
                </button>
                <button type="submit" className="geo-btn-primary" disabled={salvando}>
                  {salvando ? 'Salvando...' : editandoItem ? 'Atualizar Perímetro' : 'Salvar Perímetro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal de Confirmação de Exclusão ── */}
      {itemExcluir && (
        <div className="geo-modal-backdrop" onClick={() => !excluindo && setItemExcluir(null)}>
          <div className="geo-modal-card" style={{ maxWidth: 460 }} onClick={(e) => e.stopPropagation()}>
            <div className="geo-modal-header">
              <h3 className="geo-modal-title" style={{ color: '#dc2626' }}>
                Excluir Perímetro de Geolocalização
              </h3>
              <button
                type="button"
                className="geo-modal-close-btn"
                onClick={() => !excluindo && setItemExcluir(null)}
              >
                ✕
              </button>
            </div>
            <div className="geo-modal-body">
              <p style={{ margin: 0, fontSize: 14, color: '#334155', lineHeight: 1.5 }}>
                Tem certeza que deseja excluir o perímetro <strong>"{itemExcluir.nome_local}"</strong>?
              </p>
              <p style={{ margin: '8px 0 0 0', fontSize: 12.5, color: '#64748b' }}>
                Esta ação removerá as regras de bloqueio de ponto configuradas para este local de serviço.
              </p>
            </div>
            <div className="geo-modal-footer">
              <button
                type="button"
                className="geo-btn-secondary"
                onClick={() => setItemExcluir(null)}
                disabled={excluindo}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="geo-btn-danger"
                onClick={handleConfirmarExclusao}
                disabled={excluindo}
              >
                {excluindo ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CadastroGeolocalizacao;
