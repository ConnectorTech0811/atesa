import React, { useEffect, useState } from 'react';
import {
  IonButton,
  IonSpinner,
} from '@ionic/react';
import { useToast } from '../../components/ToastContext';
import {
  listarSuporteCooperados,
  buscarSuporteCooperadoDetalhe,
  SuporteCooperadoItem,
  SuporteCooperadoDetalhe,
} from '../../api/raApi';
import { urlDownloadDocumento } from '../../api/beneficiosApi';
import {
  IconSearch,
  IconPin,
  IconCheck,
  IconX,
  IconAlert,
  IconEye,
  IconRefresh,
} from '../../components/Icons';

// Ícone de Suporte/Headset
const IconHeadset: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);

// Ícone de Rede / IP
const IconNetwork: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const SECOES_FORMULARIO: { id: number; num: string; titulo: string; icon: string }[] = [
  { id: 1, num: '01', titulo: 'Identificação & Dados Cadastrais', icon: '👤' },
  { id: 2, num: '02', titulo: 'Contatos de Emergência & Histórico', icon: '🚨' },
  { id: 3, num: '03', titulo: 'Cota-Parte & Dados Bancários', icon: '🏦' },
  { id: 4, num: '04', titulo: 'Ata de Palestra Cooperativista', icon: '🎓' },
  { id: 5, num: '05', titulo: 'Declaração Estatutária (10 Itens)', icon: '📜' },
  { id: 6, num: '06', titulo: 'Questionário aos Associados (12 Q)', icon: '❓' },
  { id: 7, num: '07', titulo: 'Autorização de Descontos & Convênios', icon: '💳' },
  { id: 8, num: '08', titulo: 'Termo de Adesão a Contrato', icon: '🤝' },
  { id: 9, num: '09', titulo: 'Termo de Confidencialidade e Sigilo', icon: '🔒' },
  { id: 10, num: '10', titulo: 'Consentimento de Dados LGPD', icon: '🛡️' },
  { id: 11, num: '11', titulo: 'Geolocalização & Apontamento no App', icon: '📍' },
  { id: 12, num: '12', titulo: 'Beneficiários do Seguro MetLife', icon: '👥' },
];

function formatarDataHoraBR(dataStr?: string | null): string {
  if (!dataStr) return '—';
  try {
    const d = new Date(dataStr);
    if (isNaN(d.getTime())) return dataStr;
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dataStr;
  }
}

function formatarCPF(cpf?: string | null): string {
  if (!cpf) return '—';
  const c = cpf.replace(/\D/g, '');
  if (c.length !== 11) return cpf;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

function formatarIp(ip?: string | null): string {
  if (!ip) return '—';
  const clean = ip.trim();
  if (clean === '::1' || clean === '::ffff:127.0.0.1' || clean === '127.0.0.1') {
    return '127.0.0.1 (Localhost / Dev)';
  }
  if (clean.startsWith('::ffff:')) {
    return clean.substring(7);
  }
  return clean;
}

const SuporteAdesao: React.FC = () => {
  const { showToast } = useToast();

  const [cooperados, setCooperados] = useState<SuporteCooperadoItem[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');

  // Filtros
  const [busca, setBusca] = useState('');
  const [filtroCooperativa, setFiltroCooperativa] = useState('');
  const [filtroStatusAdesao, setFiltroStatusAdesao] = useState('');

  // Modal de visualização detalhada da adesão
  const [cooperadoSelecionadoId, setCooperadoSelecionadoId] = useState<number | null>(null);
  const [detalheCooperado, setDetalheCooperado] = useState<SuporteCooperadoDetalhe | null>(null);
  const [carregandoDetalhe, setCarregandoDetalhe] = useState(false);
  const [abaModal, setAbaModal] = useState<'formulario' | 'documentos'>('formulario');
  const [secaoAtivaModal, setSecaoAtivaModal] = useState<number>(1);

  const carregarDados = async () => {
    setCarregando(true);
    setErro('');
    try {
      const lista = await listarSuporteCooperados({
        busca: busca.trim() || undefined,
        cooperativa: filtroCooperativa || undefined,
        statusAdesao: filtroStatusAdesao || undefined,
      });
      setCooperados(lista);
    } catch (e: any) {
      const msg = e?.message || 'Erro ao carregar lista de cooperados no suporte.';
      setErro(msg);
      showToast(msg, 'error');
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    carregarDados();
  }, [filtroCooperativa, filtroStatusAdesao]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    carregarDados();
  };

  const handleAbrirAdesao = async (id: number) => {
    setCooperadoSelecionadoId(id);
    setCarregandoDetalhe(true);
    setAbaModal('formulario');
    setSecaoAtivaModal(1);
    try {
      const det = await buscarSuporteCooperadoDetalhe(id);
      setDetalheCooperado(det);
    } catch (e: any) {
      showToast(e?.message || 'Erro ao carregar auditoria da adesão.', 'error');
      setCooperadoSelecionadoId(null);
    } finally {
      setCarregandoDetalhe(false);
    }
  };

  const parseDadosJson = (dadosStr?: string | null): Record<string, any> => {
    if (!dadosStr) return {};
    try {
      return typeof dadosStr === 'string' ? JSON.parse(dadosStr) : dadosStr;
    } catch {
      return {};
    }
  };

  const renderBadgeStatusAdesao = (status: string) => {
    const s = String(status).toLowerCase();
    if (s === 'homologado' || s === 'homologado_100') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e8f5e9', color: '#2e7d32', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          <IconCheck size={13} /> Concluída / Homologada
        </span>
      );
    }
    if (s === 'enviado' || s === 'documentos_enviados' || s === 'declaracao_enviada') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e0f2fe', color: '#0369a1', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          <IconEye size={13} /> Documentos Enviados
        </span>
      );
    }
    if (s === 'em_andamento' || s === 'video_concluido' || s === 'adesao_preenchida') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fff8e1', color: '#f57f17', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          <IconAlert size={13} /> Em Preenchimento
        </span>
      );
    }
    if (s === 'reprovado') {
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#ffebee', color: '#c62828', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
          <IconX size={13} /> Pendente de Correção
        </span>
      );
    }
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f5f5f5', color: '#616161', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
        ⏳ Adesão Pendente
      </span>
    );
  };

  // Helper para renderizar campo de formulário no modal
  const renderCampo = (rotulo: string, valor?: any, options?: { fullWidth?: boolean; highlight?: boolean }) => {
    const isVazio = valor === null || valor === undefined || valor === '' || (Array.isArray(valor) && valor.length === 0);
    return (
      <div style={{ gridColumn: options?.fullWidth ? '1 / -1' : 'span 1', background: options?.highlight ? '#f0fdf4' : '#ffffff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 14px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.4 }}>
          {rotulo}
        </div>
        <div style={{ fontSize: 13, fontWeight: isVazio ? 400 : 600, color: isVazio ? '#9ca3af' : '#111827', marginTop: 3, wordBreak: 'break-word' }}>
          {isVazio ? '— Não informado / Pendente —' : String(valor)}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '24px 30px', maxWidth: 1400, margin: '0 auto' }}>
      {/* ── Cabeçalho Principal ────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <IconHeadset size={24} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: '#1f2937' }}>
              Suporte — Acompanhamento
            </h1>
            <p style={{ margin: '3px 0 0', fontSize: 13, color: '#6b7280' }}>
              Auditoria de ponta a ponta dos formulários, rastreamento de IP, GPS e visualização de documentos.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <IonButton shape="round" fill="outline" color="secondary" onClick={carregarDados} disabled={carregando}>
            <IconRefresh size={15} style={{ marginRight: 6 }} /> Atualizar
          </IonButton>
        </div>
      </div>

      {/* ── Barra de Filtros e Busca ───────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '16px 20px', marginBottom: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <form onSubmit={handleBuscar} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: '1 1 260px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Buscar por Nome, CPF, Matrícula ou IP..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px 9px 36px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <span style={{ position: 'absolute', left: 11, top: 11, color: '#9ca3af' }}>
              <IconSearch size={16} />
            </span>
          </div>

          <div style={{ width: 160 }}>
            <select
              value={filtroCooperativa}
              onChange={(e) => setFiltroCooperativa(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                background: '#fff',
                outline: 'none',
              }}
            >
              <option value="">Todas Cooperativas</option>
              <option value="ATESA">ATESA</option>
              <option value="COOP1">COOP1</option>
              <option value="COOP2">COOP2</option>
            </select>
          </div>

          <div style={{ width: 180 }}>
            <select
              value={filtroStatusAdesao}
              onChange={(e) => setFiltroStatusAdesao(e.target.value)}
              style={{
                width: '100%',
                padding: '9px 12px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                fontSize: 13,
                background: '#fff',
                outline: 'none',
              }}
            >
              <option value="">Todos os Status</option>
              <option value="pendente">Adesão Pendente</option>
              <option value="em_andamento">Em Preenchimento</option>
              <option value="enviado">Documentos Enviados</option>
              <option value="homologado">Concluída / Homologada</option>
            </select>
          </div>

          <IonButton type="submit" shape="round" color="secondary" size="small" style={{ height: 38 }}>
            Filtrar
          </IonButton>

          {(busca || filtroCooperativa || filtroStatusAdesao) && (
            <button
              type="button"
              onClick={() => { setBusca(''); setFiltroCooperativa(''); setFiltroStatusAdesao(''); }}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}
            >
              Limpar filtros
            </button>
          )}
        </form>
      </div>

      {/* ── Tabela de Cooperados ────────────────────────────────────────── */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        {carregando ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#6b7280' }}>
            <IonSpinner name="crescent" color="secondary" />
            <p style={{ margin: '12px 0 0', fontSize: 14 }}>Carregando dados dos cooperados...</p>
          </div>
        ) : erro ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#c62828' }}>
            <IconAlert size={28} />
            <p style={{ margin: '8px 0 0', fontSize: 14 }}>{erro}</p>
            <IonButton size="small" shape="round" fill="outline" color="danger" onClick={carregarDados} style={{ marginTop: 12 }}>
              Tentar novamente
            </IonButton>
          </div>
        ) : cooperados.length === 0 ? (
          <div style={{ padding: '50px 20px', textAlign: 'center', color: '#9ca3af' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Nenhum cooperado encontrado com os filtros selecionados.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb', color: '#4b5563', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <th style={{ padding: '14px 18px' }}>Cooperado</th>
                  <th style={{ padding: '14px 18px' }}>Data de Início</th>
                  <th style={{ padding: '14px 18px' }}>Status da Adesão</th>
                  <th style={{ padding: '14px 18px' }}>Endereço IP</th>
                  <th style={{ padding: '14px 18px' }}>Geolocalização (GPS)</th>
                  <th style={{ padding: '14px 18px', textAlign: 'right' }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {cooperados.map((c, idx) => {
                  const ipBruto = c.ip_registro || c.ultimo_ip_doc;
                  const ipExibir = formatarIp(ipBruto);
                  const temGeo = !!(c.latitude && c.longitude);
                  return (
                    <tr
                      key={c.id}
                      style={{
                        borderBottom: '1px solid #f3f4f6',
                        background: idx % 2 === 0 ? '#fff' : '#fafafa',
                        transition: 'background 0.15s',
                      }}
                    >
                      {/* Cooperado */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#111827', fontSize: 14 }}>
                          {c.nome}
                        </div>
                        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2, display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span>CPF: <strong>{formatarCPF(c.cpf)}</strong></span>
                          {c.matricula && (
                            <span style={{ background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>
                              Matrícula #{c.matricula}
                            </span>
                          )}
                          <span style={{ color: '#9ca3af' }}>· {c.cooperativa}</span>
                        </div>
                      </td>

                      {/* Data de Início */}
                      <td style={{ padding: '14px 18px', color: '#374151' }}>
                        <div style={{ fontWeight: 600 }}>{formatarDataHoraBR(c.data_inicio)}</div>
                        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Início do cadastro</div>
                      </td>

                      {/* Status da Adesão */}
                      <td style={{ padding: '14px 18px' }}>
                        {renderBadgeStatusAdesao(c.status_adesao)}
                        {c.total_documentos > 0 && (
                          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                            Docs: <strong>{c.docs_validados}</strong>/{c.total_documentos} validados
                          </div>
                        )}
                      </td>

                      {/* IP do Cooperado */}
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#f3f4f6', border: '1px solid #e5e7eb', padding: '4px 10px', borderRadius: 8, fontSize: 12, color: '#374151', fontFamily: 'monospace' }}>
                          <IconNetwork size={13} />
                          <span>{ipExibir}</span>
                        </div>
                      </td>

                      {/* Geolocalização */}
                      <td style={{ padding: '14px 18px' }}>
                        {temGeo ? (
                          <a
                            href={`https://www.google.com/maps?q=${c.latitude},${c.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 6,
                              background: '#ecfdf5',
                              border: '1px solid #a7f3d0',
                              color: '#047857',
                              padding: '4px 10px',
                              borderRadius: 8,
                              fontSize: 12,
                              fontWeight: 600,
                              textDecoration: 'none',
                              transition: 'all 0.2s',
                            }}
                            title="Abrir coordenadas no Google Maps"
                          >
                            <IconPin size={13} />
                            <span>{c.latitude?.slice(0, 8)}, {c.longitude?.slice(0, 8)} ↗</span>
                          </a>
                        ) : (
                          <span style={{ color: '#9ca3af', fontSize: 12 }}>GPS não capturado</span>
                        )}
                      </td>

                      {/* Ações */}
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <IonButton
                          size="small"
                          shape="round"
                          color="secondary"
                          onClick={() => handleAbrirAdesao(c.id)}
                          style={{ fontWeight: 600 }}
                        >
                          <IconEye size={14} style={{ marginRight: 6 }} /> Ver Adesão
                        </IonButton>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Modal de Visualização Detalhada da Adesão ─────────────────────── */}
      {cooperadoSelecionadoId !== null && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: 16,
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              width: 1050,
              maxWidth: '98vw',
              height: '92vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
              overflow: 'hidden',
            }}
          >
            {/* Header do Modal */}
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: '#f8fafc',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: '#e8f5e9', color: '#2e7d32', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <IconHeadset size={22} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#111827' }}>
                    Formulário de Adesão & Documentos — {detalheCooperado?.nome || 'Carregando...'}
                  </h3>
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    Visualização integral das 12 seções, valores preenchidos/pendentes, IP de auditoria e arquivos anexados
                  </span>
                </div>
              </div>

              <button
                onClick={() => { setCooperadoSelecionadoId(null); setDetalheCooperado(null); }}
                style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            {/* Conteúdo do Modal */}
            {carregandoDetalhe || !detalheCooperado ? (
              <div style={{ padding: '60px 20px', textAlign: 'center', color: '#6b7280', margin: 'auto' }}>
                <IonSpinner name="crescent" color="secondary" />
                <p style={{ margin: '12px 0 0', fontSize: 14 }}>Carregando dados completos do formulário...</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                {/* Cartão de Resumo do Cooperado, IP e GPS */}
                <div style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', padding: '12px 24px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, fontSize: 13 }}>
                    <div>
                      <span style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Cooperado</span>
                      <div style={{ fontWeight: 700, color: '#111827', marginTop: 2 }}>{detalheCooperado.nome}</div>
                      <div style={{ color: '#6b7280', fontSize: 12 }}>CPF: {formatarCPF(detalheCooperado.cpf)} · {detalheCooperado.cooperativa}</div>
                    </div>

                    <div>
                      <span style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Status da Adesão</span>
                      <div style={{ marginTop: 2 }}>{renderBadgeStatusAdesao(detalheCooperado.status_adesao)}</div>
                      <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Iniciado em: {formatarDataHoraBR(detalheCooperado.data_inicio)}</div>
                    </div>

                    <div>
                      <span style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Endereço IP Registrado</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, fontFamily: 'monospace', fontWeight: 700, color: '#0369a1' }}>
                        <IconNetwork size={14} />
                        {formatarIp(detalheCooperado.ip_registro || detalheCooperado.ultimo_ip_doc)}
                      </div>
                      <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={detalheCooperado.user_agent || ''}>
                        {detalheCooperado.user_agent ? detalheCooperado.user_agent.slice(0, 35) + '...' : ''}
                      </div>
                    </div>

                    <div>
                      <span style={{ color: '#6b7280', fontSize: 11, textTransform: 'uppercase', fontWeight: 600 }}>Geolocalização GPS</span>
                      {detalheCooperado.latitude && detalheCooperado.longitude ? (
                        <div style={{ marginTop: 2 }}>
                          <a
                            href={`https://www.google.com/maps?q=${detalheCooperado.latitude},${detalheCooperado.longitude}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#047857', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                          >
                            <IconPin size={13} /> {detalheCooperado.latitude}, {detalheCooperado.longitude} ↗
                          </a>
                        </div>
                      ) : (
                        <div style={{ color: '#9ca3af', marginTop: 2 }}>Não capturada</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Seletor Principal de Abas */}
                <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#fff', padding: '0 24px' }}>
                  <button
                    onClick={() => setAbaModal('formulario')}
                    style={{
                      padding: '12px 20px',
                      background: 'none',
                      border: 'none',
                      borderBottom: `3px solid ${abaModal === 'formulario' ? '#2e7d32' : 'transparent'}`,
                      color: abaModal === 'formulario' ? '#2e7d32' : '#6b7280',
                      fontWeight: abaModal === 'formulario' ? 700 : 500,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>📄</span>
                    Formulário de Adesão (12 Seções Detalhadas)
                  </button>

                  <button
                    onClick={() => setAbaModal('documentos')}
                    style={{
                      padding: '12px 20px',
                      background: 'none',
                      border: 'none',
                      borderBottom: `3px solid ${abaModal === 'documentos' ? '#2e7d32' : 'transparent'}`,
                      color: abaModal === 'documentos' ? '#2e7d32' : '#6b7280',
                      fontWeight: abaModal === 'documentos' ? 700 : 500,
                      fontSize: 14,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span>📁</span>
                    Documentos Anexados ({detalheCooperado.documentos.length})
                  </button>
                </div>

                {/* ── ABA 1: FORMULÁRIO COMPLETO (12 SEÇÕES) ────────────────────── */}
                {abaModal === 'formulario' && (() => {
                  const ds = detalheCooperado.dadosSensiveis || {};
                  const db = detalheCooperado.dadosBancarios || {};
                  const contatos = detalheCooperado.contatosEmergencia || [];
                  const json = parseDadosJson(detalheCooperado.dados_json);

                  const ata = json.palestraAta || {};
                  const estatutario = json.estatutario || {};
                  const questionario = json.questionario || {};
                  const autorizacoes = json.autorizacoes || {};
                  const termoAdesao = json.termoAdesaoContrato || {};
                  const termoConf = json.termoConfidencialidade || {};
                  const termoLgpd = json.termoLgpd || {};
                  const termoGeo = json.termoGeolocalizacao || {};
                  const beneficiarios = json.beneficiariosSeguro || [];

                  return (
                    <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                      {/* Menu Lateral de Seções */}
                      <div style={{ width: 260, borderRight: '1px solid #e5e7eb', background: '#f9fafb', overflowY: 'auto', padding: '12px 8px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', padding: '6px 12px', letterSpacing: 0.5 }}>
                          Seções do Formulário
                        </div>
                        {SECOES_FORMULARIO.map((s) => {
                          const isAtiva = secaoAtivaModal === s.id;
                          return (
                            <button
                              key={s.id}
                              onClick={() => setSecaoAtivaModal(s.id)}
                              style={{
                                width: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '9px 12px',
                                borderRadius: 8,
                                border: 'none',
                                background: isAtiva ? '#e8f5e9' : 'transparent',
                                color: isAtiva ? '#1e7025' : '#4b5563',
                                fontWeight: isAtiva ? 700 : 500,
                                fontSize: 13,
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                marginBottom: 2,
                              }}
                            >
                              <span style={{ fontSize: 15 }}>{s.icon}</span>
                              <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                <span style={{ fontSize: 11, opacity: 0.75, marginRight: 4 }}>{s.num}.</span>
                                {s.titulo}
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Painel de Conteúdo da Seção Ativa */}
                      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#ffffff' }}>
                        {/* Seção 01: Identificação & Dados Cadastrais */}
                        {secaoAtivaModal === 1 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>👤</span> Seção 01 — Identificação & Dados Cadastrais
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                              {renderCampo('Nome Completo', detalheCooperado.nome)}
                              {renderCampo('Nome Social', ds.nome_social)}
                              {renderCampo('CPF', formatarCPF(detalheCooperado.cpf))}
                              {renderCampo('RG', ds.rg)}
                              {renderCampo('Órgão Emissor / UF', ds.orgao_emissor ? `${ds.orgao_emissor} / ${ds.estado_emissor_rg || '—'}` : null)}
                              {renderCampo('Data de Expedição RG', ds.data_expedicao_rg || ds.data_emissao_rg)}
                              {renderCampo('Título de Eleitor', ds.titulo_eleitor)}
                              {renderCampo('Zona / Seção Eleitoral', ds.zona ? `Zona ${ds.zona} / Seção ${ds.secao || '—'}` : null)}
                              {renderCampo('NIT / PIS / PASEP', ds.nit || ds.pis_pasep)}
                              {renderCampo('CTPS (Carteira de Trabalho)', ds.ctps ? `Nº ${ds.ctps} · Série ${ds.serie_ctps || '—'} · UF ${ds.uf_ctps || '—'}` : null)}
                              {renderCampo('CNH', ds.cnh ? `Nº ${ds.cnh} · Cat: ${ds.categoria_cnh || '—'} · Validade: ${ds.validade_cnh || '—'}` : null)}
                              {renderCampo('Estado Civil', ds.estado_civil)}
                              {renderCampo('Nome do Cônjuge', ds.nome_conjuge)}
                              {renderCampo('Gênero', ds.genero)}
                              {renderCampo('Raça / Cor / Etnia', ds.cor_etnia || ds.raca_cor)}
                              {renderCampo('Grau de Instrução', ds.grau_instrucao)}
                              {renderCampo('Nacionalidade', ds.nacionalidade || 'Brasileira')}
                              {renderCampo('Naturalidade', ds.naturalidade)}
                              {renderCampo('Nome da Mãe', ds.nome_mae)}
                              {renderCampo('Nome do Pai', ds.nome_pai)}
                              {renderCampo('CEP', ds.cep)}
                              {renderCampo('Endereço (Logradouro)', ds.logradouro ? `${ds.logradouro}, Nº ${ds.numero || 'S/N'} ${ds.complemento ? `(${ds.complemento})` : ''}` : null, { fullWidth: true })}
                              {renderCampo('Bairro', ds.bairro)}
                              {renderCampo('Cidade / UF', ds.cidade ? `${ds.cidade} - ${ds.uf}` : null)}
                              {renderCampo('Telefone Celular', detalheCooperado.telefone)}
                              {renderCampo('WhatsApp', detalheCooperado.whatsapp)}
                              {renderCampo('Telefone Residencial / Recado', ds.telefone_residencial || ds.telefone_recado)}
                              {renderCampo('E-mail', detalheCooperado.email)}
                              {renderCampo('Disponibilidade de Escalas', ds.disponibilidade_escala)}
                              {renderCampo('Órgão de Classe / Registro', ds.orgaos_classe ? `${ds.orgaos_classe} Nº ${ds.numero_classe || '—'}` : null)}
                            </div>
                          </div>
                        )}

                        {/* Seção 02: Contatos de Emergência & Histórico */}
                        {secaoAtivaModal === 2 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>🚨</span> Seção 02 — Contatos de Emergência & Histórico
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 14 }}>
                              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32', marginBottom: 10 }}>Contato Principal (1)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {renderCampo('Nome do Contato', contatos[0]?.nome_1 || contatos[0]?.nome_contato)}
                                  {renderCampo('Grau de Parentesco', contatos[0]?.parentesco_1 || contatos[0]?.parentesco)}
                                  {renderCampo('Telefone com DDD', contatos[0]?.telefone_1 || contatos[0]?.telefone)}
                                </div>
                              </div>

                              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32', marginBottom: 10 }}>Contato Secundário (2)</div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {renderCampo('Nome do Contato', contatos[0]?.nome_2 || contatos[1]?.nome_contato)}
                                  {renderCampo('Grau de Parentesco', contatos[0]?.parentesco_2 || contatos[1]?.parentesco)}
                                  {renderCampo('Telefone com DDD', contatos[0]?.telefone_2 || contatos[1]?.telefone)}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Seção 03: Cota-Parte & Dados Bancários */}
                        {secaoAtivaModal === 3 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>🏦</span> Seção 03 — Cota-Parte & Dados Bancários
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
                              {renderCampo('Banco / Instituição', db.banco ? `${db.banco} ${db.codigo_banco ? `(Cód: ${db.codigo_banco})` : ''}` : null)}
                              {renderCampo('Agência', db.agencia)}
                              {renderCampo('Número da Conta', db.conta ? `${db.conta}${db.digito ? `-${db.digito}` : ''}` : null)}
                              {renderCampo('Tipo de Conta', db.tipo_conta ? (db.tipo_conta === 'corrente' ? 'Conta Corrente' : 'Conta Poupança') : null)}
                              {renderCampo('Tipo de Chave PIX', db.tipo_pix)}
                              {renderCampo('Chave PIX', db.chave_pix)}
                              {renderCampo('Valor da Cota-Parte Subscrita', 'R$ 100,00 (Conforme Estatuto Social)', { highlight: true })}
                            </div>
                          </div>
                        )}

                        {/* Seção 04: Ata de Palestra Cooperativista */}
                        {secaoAtivaModal === 4 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>🎓</span> Seção 04 — Ata de Palestra Cooperativista
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                              {renderCampo('Formato da Palestra', ata.formato ? (ata.formato === 'presencial' ? 'Presencial' : 'Online / Vídeo') : null)}
                              {renderCampo('Vídeo Institucional Assistido', detalheCooperado.video_assistido_em ? `✓ Concluído em ${formatarDataHoraBR(detalheCooperado.video_assistido_em)}` : null, { highlight: !!detalheCooperado.video_assistido_em })}
                              {renderCampo('Declaração de Participação e Ciência', ata.concorda ? '✓ Declarou ter assistido e compreendido os princípios cooperativistas (Lei 5.764/71 e Lei 12.690/12)' : null, { fullWidth: true, highlight: ata.concorda })}
                            </div>
                          </div>
                        )}

                        {/* Seção 05: Declaração Estatutária */}
                        {secaoAtivaModal === 5 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>📜</span> Seção 05 — Declaração Estatutária (10 Itens)
                            </h4>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              {[
                                '01. Inexistência de vínculo empregatício e autonomia no exercício das atividades cooperadas.',
                                '02. Ciência dos direitos, deveres, cota-parte e regime societário previstos no Estatuto Social.',
                                '03. Retenção e recolhimento de tributos legais incidentes (IRRF, INSS como contribuinte individual).',
                                '04. Participação e voto nas Assembleias Gerais Ordinárias e Extraordinárias da Cooperativa.',
                                '05. Rateio proporcional de despesas operacionais e distribuição de sobras conforme a produção.',
                                '06. Disponibilidade e compromisso ético na prestação dos serviços contratados por tomadores.',
                                '07. Ausência de exclusividade na prestação de serviços com total independência funcional.',
                                '08. Cumprimento rigoroso das normas técnicas, biossegurança e conselho profissional competente.',
                                '09. Atualização cadastral periódica e fornecimento de documentos comprobatórios verídicos.',
                                '10. Aceite formal das deliberações da Diretoria e do Conselho de Administração da Cooperativa.',
                              ].map((itemText, i) => {
                                const key = `item${i + 1}`;
                                const respondido = estatutario[key] || estatutario.concorda_declaracao;
                                return (
                                  <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: respondido ? '#f0fdf4' : '#fff', border: `1px solid ${respondido ? '#bbf7d0' : '#e5e7eb'}`, borderRadius: 8 }}>
                                    <span style={{ fontSize: 13, color: '#374151' }}>{itemText}</span>
                                    <span style={{ fontSize: 12, fontWeight: 700, color: respondido ? '#166534' : '#9ca3af' }}>
                                      {respondido ? '✓ De Acordo' : '⏳ Pendente'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Seção 06: Questionário aos Associados */}
                        {secaoAtivaModal === 6 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>❓</span> Seção 06 — Questionário aos Associados (12 Perguntas)
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
                              {[
                                '01. Já atuou anteriormente como cooperado em alguma sociedade cooperativa?',
                                '02. Possui disponibilidade para escalas flexíveis e plantões aos finais de semana?',
                                '03. Compreende a diferença jurídica entre relação cooperativa e regime CLT?',
                                '04. Exerce outra atividade profissional com registro em carteira ou vínculo público?',
                                '05. Possui inscrição ativa e regular junto ao respectivo conselho de classe profissional?',
                                '06. Possui capacitação técnica e treinamentos em dia para a área de atuação pretendida?',
                                '07. Está ciente de que a remuneração é proporcional à sua produção cooperativa?',
                                '08. Já participou de assembleias gerais cooperativistas em outras entidades?',
                                '09. Teve acesso prévio ao Estatuto Social e ao Regimento Interno da Cooperativa?',
                                '10. Concorda com a utilização dos canais digitais para convocações e comunicados?',
                                '11. Possui meios de transporte e locomoção adequados para as escalas assumidas?',
                                '12. Declara que todas as informações prestadas são verídicas sob as penas da lei?',
                              ].map((perg, idx) => {
                                const resp = questionario[`q${idx + 1}`];
                                return (
                                  <div key={idx} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '10px 12px' }}>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>{perg}</div>
                                    <div style={{ fontSize: 13, fontWeight: 700, color: resp ? '#166534' : '#9ca3af', marginTop: 4 }}>
                                      Resposta: {resp ? String(resp).toUpperCase() : '— Não respondida —'}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Seção 07: Autorização de Descontos & Convênios */}
                        {secaoAtivaModal === 7 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>💳</span> Seção 07 — Autorização de Descontos & Convênios
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                              {renderCampo('Desconto da Cota-Parte', autorizacoes.desconto_quota ? '✓ Autorizado em produção' : null)}
                              {renderCampo('Taxa de Rateio Administrativo', autorizacoes.desconto_rateio ? '✓ Autorizado conforme Estatuto' : null)}
                              {renderCampo('Retenção Previdenciária INSS', autorizacoes.desconto_inss ? '✓ Autorizado como Contribuinte Individual' : null)}
                              {renderCampo('Convênios Opcionais', autorizacoes.convenios_opcionais?.length ? autorizacoes.convenios_opcionais.join(', ') : 'Nenhum convênio adicional selecionado')}
                              {renderCampo('Declaração Geral de Autorização', autorizacoes.concorda_descontos ? '✓ Aceite e confirmação formal registrados' : null, { fullWidth: true, highlight: autorizacoes.concorda_descontos })}
                            </div>
                          </div>
                        )}

                        {/* Seção 08: Termo de Adesão a Contrato */}
                        {secaoAtivaModal === 8 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>🤝</span> Seção 08 — Termo de Adesão a Contrato
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                              {renderCampo('Concordância com o Termo de Prestação de Serviços', termoAdesao.concorda ? '✓ Aceito formalmente pelo cooperado via Portal Web' : null, { highlight: termoAdesao.concorda })}
                            </div>
                          </div>
                        )}

                        {/* Seção 09: Termo de Confidencialidade e Sigilo */}
                        {secaoAtivaModal === 9 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>🔒</span> Seção 09 — Termo de Confidencialidade e Sigilo
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                              {renderCampo('Compromisso de Sigilo e Proteção de Informações', termoConf.concorda ? '✓ Termo de confidencialidade assinado digitalmente' : null, { highlight: termoConf.concorda })}
                            </div>
                          </div>
                        )}

                        {/* Seção 10: Consentimento de Dados LGPD */}
                        {secaoAtivaModal === 10 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>🛡️</span> Seção 10 — Consentimento de Dados LGPD
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 12 }}>
                              {renderCampo('Autorização de Tratamento de Dados (Lei 13.709/2018)', termoLgpd.concorda ? '✓ Consentimento expresso fornecido para finalidades societárias e de escala' : null, { highlight: termoLgpd.concorda })}
                            </div>
                          </div>
                        )}

                        {/* Seção 11: Geolocalização & Apontamento no App */}
                        {secaoAtivaModal === 11 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>📍</span> Seção 11 — Geolocalização & Apontamento no App
                            </h4>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
                              {renderCampo('Termo de Geolocalização e Ponto Eletrônico', termoGeo.concorda ? '✓ Aceite confirmado para apontamento no aplicativo' : null, { highlight: termoGeo.concorda })}
                              {renderCampo('Coordenadas GPS de Cadastro', detalheCooperado.latitude && detalheCooperado.longitude ? `${detalheCooperado.latitude}, ${detalheCooperado.longitude}` : null)}
                            </div>
                          </div>
                        )}

                        {/* Seção 12: Beneficiários do Seguro MetLife */}
                        {secaoAtivaModal === 12 && (
                          <div>
                            <h4 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: '#111827', display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>👥</span> Seção 12 — Beneficiários do Seguro MetLife
                            </h4>
                            {beneficiarios.length === 0 ? (
                              <p style={{ color: '#9ca3af', fontStyle: 'italic' }}>
                                Nenhum beneficiário indicado. (Serão aplicadas as regras de herdeiros legais).
                              </p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {beneficiarios.map((b: any, idx: number) => (
                                  <div key={idx} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1.5fr 1fr 1fr', gap: 10, alignItems: 'center', padding: '10px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                                    <div><strong>{b.nome || '—'}</strong></div>
                                    <div style={{ color: '#6b7280', fontSize: 12 }}>{b.parentesco || '—'}</div>
                                    <div style={{ color: '#6b7280', fontSize: 12 }}>CPF: {formatarCPF(b.cpf)}</div>
                                    <div style={{ color: '#6b7280', fontSize: 12 }}>Nasc: {b.data_nascimento || '—'}</div>
                                    <div style={{ fontWeight: 700, color: '#2e7d32', textAlign: 'right' }}>{b.percentual || '100'}%</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* ── ABA 2: DOCUMENTOS ANEXADOS & VISUALIZAÇÃO ────────────────── */}
                {abaModal === 'documentos' && (
                  <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', background: '#ffffff' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#111827' }}>
                          Documentos Anexados pelo Cooperado
                        </h4>
                        <p style={{ margin: '2px 0 0', fontSize: 13, color: '#6b7280' }}>
                          Visualize e baixe os arquivos enviados durante o processo de adesão com registro de IP e rastreabilidade.
                        </p>
                      </div>
                    </div>

                    {detalheCooperado.documentos.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
                        <p style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Nenhum documento anexado por este cooperado até o momento.</p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {detalheCooperado.documentos.map((d) => {
                          const urlDoc = urlDownloadDocumento(d.id);
                          return (
                            <div
                              key={d.id}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 12,
                                padding: '14px 18px',
                                borderRadius: 10,
                                border: '1px solid #e5e7eb',
                                background: '#f9fafb',
                                transition: 'all 0.15s',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                <div style={{ width: 40, height: 40, borderRadius: 8, background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                                  📄
                                </div>
                                <div>
                                  <strong style={{ fontSize: 14, color: '#111827' }}>
                                    {d.tipo.toUpperCase()}
                                  </strong>
                                  <div style={{ fontSize: 12, color: '#4b5563', marginTop: 2 }}>
                                    {d.nome_original} {d.tamanho_bytes ? `(${Math.round(d.tamanho_bytes / 1024)} KB)` : ''}
                                  </div>
                                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
                                    Enviado em: <strong>{formatarDataHoraBR(d.enviado_em)}</strong> · IP: <span style={{ fontFamily: 'monospace', fontWeight: 600, color: '#0369a1' }}>{formatarIp(d.ip_envio)}</span>
                                  </div>
                                </div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                {d.validado ? (
                                  <span style={{ background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                                    ✓ Validado
                                  </span>
                                ) : d.rejeitado ? (
                                  <span style={{ background: '#fee2e2', color: '#991b1b', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                                    ✕ Rejeitado ({d.motivo_rejeicao || '—'})
                                  </span>
                                ) : (
                                  <span style={{ background: '#f3f4f6', color: '#4b5563', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                    ⏳ Pendente de Análise
                                  </span>
                                )}

                                <a
                                  href={urlDoc}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: '#2e7d32',
                                    color: '#ffffff',
                                    padding: '7px 14px',
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    textDecoration: 'none',
                                    boxShadow: '0 1px 3px rgba(46,125,50,0.2)',
                                  }}
                                >
                                  <IconEye size={14} /> Ver / Baixar Arquivo
                                </a>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rodapé do Modal */}
            <div style={{ padding: '12px 24px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', background: '#f8fafc' }}>
              <IonButton shape="round" fill="outline" color="medium" onClick={() => { setCooperadoSelecionadoId(null); setDetalheCooperado(null); }}>
                Fechar
              </IonButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SuporteAdesao;
