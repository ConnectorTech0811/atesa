import React, { useEffect, useState, useRef } from 'react';
import { IonPage, IonContent, IonButton } from '@ionic/react';
import {
  obterPortalCooperado,
  aceitarVagaPortal,
  salvarDadosPortal,
  enviarDocumentoPortal,
  urlDownloadDocumento,
  DadosPortalCooperado,
  DadosSensiveis,
  DadosBancarios,
  TipoDocumento,
  ROTULO_TIPO_DOC,
} from '../api/beneficiosApi';
import { buscarEnderecoPorCep, formatarCEP, formatarCPF, formatarDataBR, formatarMoeda } from '../utils/formatters';
import {
  IconCheckCircle, IconX, IconUpload, IconEye,
  IconCheck,
} from '../components/Icons';

// ── Tipos de documentos principais requeridos ─────────────────────────────────
const DOCS_OBRIGATORIOS: { tipo: TipoDocumento; titulo: string; desc: string; icon: 'foto' | 'doc' }[] = [
  { tipo: 'foto_3x4', titulo: 'Foto 3x4', desc: 'Foto nítida de rosto com fundo claro', icon: 'foto' },
  { tipo: 'rg_frente', titulo: 'RG / CNH (Frente)', desc: 'Documento de identificação frente', icon: 'doc' },
  { tipo: 'rg_verso', titulo: 'RG (Verso)', desc: 'Verso do documento com CPF/Órgão', icon: 'doc' },
  { tipo: 'cpf', titulo: 'CPF', desc: 'Comprovante ou cartão de CPF', icon: 'doc' },
  { tipo: 'comprovante_residencia', titulo: 'Comprovante de Residência', desc: 'Conta de água/luz recente (máx. 90 dias)', icon: 'doc' },
  { tipo: 'comprovante_bancario', titulo: 'Comprovante Bancário', desc: 'Extrato ou print do app com conta e agência', icon: 'doc' },
  { tipo: 'cnh', titulo: 'CNH (se aplicável)', desc: 'Carteira Nacional de Habilitação', icon: 'doc' },
  { tipo: 'certificado', titulo: 'Certificado / Diploma', desc: 'Comprovante de formação profissional', icon: 'doc' },
];

export const PortalCooperado: React.FC = () => {
  const [token, setToken] = useState<string>('');
  const [dados, setDados] = useState<DadosPortalCooperado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const [mensagemSucesso, setMensagemSucesso] = useState('');

  // Abas do portal
  type AbaPortal = 'vaga' | 'cadastro' | 'documentos' | 'app';
  const [aba, setAba] = useState<AbaPortal>('vaga');

  // Formulário de dados
  const [ds, setDs] = useState<DadosSensiveis>({});
  const [db, setDb] = useState<DadosBancarios>({});
  const [salvandoDados, setSalvandoDados] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  // Aceite da vaga
  const [aceitandoVaga, setAceitandoVaga] = useState(false);
  const [vagaAceita, setVagaAceita] = useState(false);

  // Upload
  const [uploadingTipo, setUploadingTipo] = useState<TipoDocumento | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [tipoSelecionadoUpload, setTipoSelecionadoUpload] = useState<TipoDocumento>('foto_3x4');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get('token');
    if (!t) {
      setErro('Token de acesso não informado. Utilize o link enviado por WhatsApp ou E-mail.');
      setCarregando(false);
      return;
    }
    setToken(t);
    carregarDados(t);
  }, []);

  const carregarDados = async (tokenAcesso: string) => {
    setCarregando(true);
    setErro('');
    try {
      const res = await obterPortalCooperado(tokenAcesso);
      setDados(res);
      setDs(res.dadosSensiveis ?? {});
      setDb(res.dadosBancarios ?? {});
      if (res.candidato.status === 1 || res.alocacaoAtual) {
        setVagaAceita(true);
      }
    } catch (e: any) {
      setErro(e.message || 'Erro ao carregar dados do cooperado.');
    } finally {
      setCarregando(false);
    }
  };

  const handleCep = async (valor: string) => {
    const limpo = valor.replace(/\D/g, '').slice(0, 8);
    const cepFormatado = formatarCEP(limpo);
    setDs((p) => ({ ...p, cep: cepFormatado }));
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCep(limpo);
      if (end) {
        setDs((p) => ({
          ...p,
          logradouro: end.rua || p.logradouro,
          bairro: end.bairro || p.bairro,
          cidade: end.cidade ?? p.cidade,
          uf: end.uf ?? p.uf,
        }));
      }
    } catch {}
    finally { setBuscandoCep(false); }
  };

  const handleSalvarCadastro = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoDados(true);
    setMensagemSucesso('');
    try {
      await salvarDadosPortal(token, { dadosSensiveis: ds, dadosBancarios: db });
      setMensagemSucesso('Dados cadastrais e bancários salvos com sucesso!');
      await carregarDados(token);
      setAba('documentos');
    } catch (e: any) {
      setErro(e.message || 'Erro ao salvar dados.');
    } finally {
      setSalvandoDados(false);
    }
  };

  const handleAceitarVaga = async () => {
    setAceitandoVaga(true);
    setMensagemSucesso('');
    try {
      await aceitarVagaPortal(token);
      setVagaAceita(true);
      setMensagemSucesso('Vaga aceita com sucesso! Parabéns!');
      await carregarDados(token);
    } catch (e: any) {
      setErro(e.message || 'Erro ao aceitar a vaga.');
    } finally {
      setAceitandoVaga(false);
    }
  };

  const triggerUpload = (tipo: TipoDocumento) => {
    setTipoSelecionadoUpload(tipo);
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingTipo(tipoSelecionadoUpload);
    setMensagemSucesso('');
    try {
      await enviarDocumentoPortal(token, tipoSelecionadoUpload, file);
      setMensagemSucesso(`Documento "${ROTULO_TIPO_DOC[tipoSelecionadoUpload]}" enviado com sucesso!`);
      await carregarDados(token);
    } catch (e: any) {
      setErro(e.message || 'Erro ao enviar documento.');
    } finally {
      setUploadingTipo(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── Detecção de Sistema Operacional e Dispositivo ─────────────────────────
  const detectarPlataforma = () => {
    const ua = navigator.userAgent || '';
    const isAndroid = /android/i.test(ua);
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isMac = /Macintosh|Mac OS X/i.test(ua) && !isIOS;
    const isWindows = /Windows/i.test(ua);
    return {
      isAndroid,
      isIOS,
      isMac,
      isApple: isIOS || isMac,
      isWindows,
      nome: isAndroid ? 'Android' : isIOS ? 'iPhone / iOS' : isMac ? 'Mac (macOS)' : isWindows ? 'Windows' : 'Computador',
    };
  };

  const abrirGooglePlay = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isAndroid) {
      window.location.href = 'market://search?q=ATESA+Cooperativa';
      setTimeout(() => {
        window.open('https://play.google.com/store/search?q=ATESA+Cooperativa&c=apps', '_blank');
      }, 500);
    } else {
      window.open('https://play.google.com/store/search?q=ATESA+Cooperativa&c=apps', '_blank', 'noopener,noreferrer');
    }
  };

  const abrirAppStore = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isMac = /Macintosh|Mac OS X/i.test(navigator.userAgent) && !isIOS;
    if (isIOS) {
      window.location.href = 'itms-apps://itunes.apple.com/search?term=ATESA+Cooperativa';
      setTimeout(() => {
        window.open('https://apps.apple.com/br/search?term=ATESA+Cooperativa', '_blank');
      }, 500);
    } else if (isMac) {
      window.location.href = 'macappstore://apps.apple.com/search?q=ATESA';
      setTimeout(() => {
        window.open('https://apps.apple.com/br/search?term=ATESA+Cooperativa', '_blank');
      }, 500);
    } else {
      window.open('https://apps.apple.com/br/search?term=ATESA+Cooperativa', '_blank', 'noopener,noreferrer');
    }
  };

  const abrirLojaRecomendada = (e: React.MouseEvent) => {
    const { isApple } = detectarPlataforma();
    if (isApple) {
      abrirAppStore(e);
    } else {
      abrirGooglePlay(e);
    }
  };

  if (carregando) {
    return (
      <IonPage>
        <IonContent scrollY={false} style={{ '--background': '#f4f6fa' }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ textAlign: 'center', color: '#1b5e20' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>Carregando Portal do Cooperado...</div>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (erro && !dados) {
    return (
      <IonPage>
        <IonContent scrollY={true} style={{ '--background': '#f4f6fa' }}>
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: 'system-ui, sans-serif' }}>
            <div style={{ background: '#fff', borderRadius: 12, padding: 32, maxWidth: 460, width: '100%', textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 40, color: '#c62828', marginBottom: 12 }}>⚠️</div>
              <h2 style={{ fontSize: 18, color: '#222', margin: '0 0 10px' }}>Acesso ao Portal</h2>
              <p style={{ fontSize: 14, color: '#666', margin: '0 0 20px', lineHeight: 1.5 }}>{erro}</p>
              <IonButton color="secondary" shape="round" onClick={() => window.location.reload()}>Tentar novamente</IonButton>
            </div>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  const { candidato, alocacaoAtual, documentos = [] } = dados!;

  return (
    <IonPage>
      <IonContent
        scrollY={true}
        style={{
          '--background': '#f4f7fb',
          height: '100%',
        }}
      >
        <div style={{ minHeight: '100%', paddingBottom: 60, fontFamily: 'system-ui, -apple-system, sans-serif', color: '#222' }}>
          
          {/* Input de arquivo invisível */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />

          {/* Top Header */}
          <header style={{ background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)', color: '#fff', padding: '24px 20px 28px', boxShadow: '0 2px 10px rgba(0,0,0,0.1)' }}>
            <div style={{ maxWidth: 880, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div>
                <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700 }}>
                  Cooperativa {candidato.cooperativa} · Portal do Cooperado
                </div>
                <h1 style={{ fontSize: 24, margin: '4px 0 2px', fontWeight: 800 }}>
                  Olá, {candidato.nome.split(' ')[0]}! 👋
                </h1>
                <div style={{ fontSize: 13, opacity: 0.9 }}>
                  CPF: {formatarCPF(candidato.cpf)} {candidato.matricula && `· Matrícula: #${candidato.matricula}`}
                </div>
              </div>
              {alocacaoAtual && (
                <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 10, padding: '10px 16px', backdropFilter: 'blur(4px)', border: '1px solid rgba(255,255,255,0.2)' }}>
                  <div style={{ fontSize: 11, textTransform: 'uppercase', opacity: 0.85, fontWeight: 700 }}>Vaga Selecionada</div>
                  <div style={{ fontSize: 15, fontWeight: 800 }}>{alocacaoAtual.cargo}</div>
                  {alocacaoAtual.cbo && <div style={{ fontSize: 11, opacity: 0.85 }}>CBO: {alocacaoAtual.cbo}</div>}
                </div>
              )}
            </div>
          </header>

          {/* Container principal */}
          <main style={{ maxWidth: 880, margin: '-16px auto 40px', padding: '0 16px' }}>

            {/* Mensagens de Sucesso e Erro */}
            {mensagemSucesso && (
              <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 8, padding: '12px 16px', color: '#2e7d32', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <IconCheckCircle size={18} /> {mensagemSucesso}
              </div>
            )}
            {erro && (
              <div style={{ background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 8, padding: '12px 16px', color: '#c62828', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600 }}>
                <IconX size={18} /> {erro}
              </div>
            )}

            {/* Navegação por Abas */}
            <div style={{ display: 'flex', background: '#fff', borderRadius: 12, padding: 6, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.06)', gap: 6, overflowX: 'auto' }}>
              {[
                { id: 'vaga', label: '1. Vaga Ofertada', icon: '📋' },
                { id: 'cadastro', label: '2. Meus Dados', icon: '👤' },
                { id: 'documentos', label: '3. Enviar Documentos', icon: '📁' },
                { id: 'app', label: '4. Baixar Aplicativo', icon: '📱' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setAba(tab.id as AbaPortal)}
                  style={{
                    flex: 1, minWidth: 140, padding: '10px 14px', borderRadius: 8, border: 'none', cursor: 'pointer',
                    fontSize: 13, fontWeight: aba === tab.id ? 700 : 500,
                    background: aba === tab.id ? '#2e7d32' : 'transparent',
                    color: aba === tab.id ? '#fff' : '#555',
                    transition: 'all 0.2s', whiteSpace: 'nowrap',
                  }}
                >
                  <span style={{ marginRight: 6 }}>{tab.icon}</span>{tab.label}
                </button>
              ))}
            </div>

            {/* ── ABA 1: VAGA OFERTADA ─────────────────────────────────────────── */}
            {aba === 'vaga' && (
              <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <h2 style={{ fontSize: 17, fontWeight: 800, margin: '0 0 16px', color: '#1b5e20', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>📋</span> Detalhes da Vaga
                </h2>

                {alocacaoAtual ? (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 20 }}>
                      <div style={{ background: '#f9fbfd', padding: 14, borderRadius: 8, border: '1px solid #e2eaf4' }}>
                        <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', fontWeight: 700 }}>Cargo / Função</div>
                        <div style={{ fontSize: 16, fontWeight: 800, color: '#222', marginTop: 3 }}>{alocacaoAtual.cargo}</div>
                        {alocacaoAtual.cbo && <div style={{ fontSize: 12, color: '#1565c0', marginTop: 2, fontWeight: 600 }}>CBO: {alocacaoAtual.cbo}</div>}
                      </div>

                      <div style={{ background: '#f9fbfd', padding: 14, borderRadius: 8, border: '1px solid #e2eaf4' }}>
                        <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', fontWeight: 700 }}>Tomador / Empresa</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#222', marginTop: 3 }}>{alocacaoAtual.nome_empresa}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{alocacaoAtual.nome_unidade}</div>
                      </div>

                      <div style={{ background: '#f9fbfd', padding: 14, borderRadius: 8, border: '1px solid #e2eaf4' }}>
                        <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', fontWeight: 700 }}>Data de Início</div>
                        <div style={{ fontSize: 15, fontWeight: 700, color: '#222', marginTop: 3 }}>{formatarDataBR(alocacaoAtual.data_inicio)}</div>
                        <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>Escala: {alocacaoAtual.tipo_escala || 'Plantão'}</div>
                      </div>

                      {alocacaoAtual.salario_base ? (
                        <div style={{ background: '#f9fbfd', padding: 14, borderRadius: 8, border: '1px solid #e2eaf4' }}>
                          <div style={{ fontSize: 11, color: '#777', textTransform: 'uppercase', fontWeight: 700 }}>Remuneração Base Estimada</div>
                          <div style={{ fontSize: 16, fontWeight: 800, color: '#2e7d32', marginTop: 3 }}>
                            {formatarMoeda(Number(alocacaoAtual.salario_base))}
                          </div>
                          <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>Por {alocacaoAtual.periodicidade || 'mês'}</div>
                        </div>
                      ) : null}
                    </div>

                    {/* Termo de Aceite */}
                    <div style={{ background: vagaAceita ? '#e8f5e9' : '#fff8e1', border: `1px solid ${vagaAceita ? '#a5d6a7' : '#ffe082'}`, borderRadius: 10, padding: '18px 20px', marginBottom: 20 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <span style={{ fontSize: 24 }}>{vagaAceita ? '✅' : '🔔'}</span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 700, color: vagaAceita ? '#2e7d32' : '#e65100' }}>
                            {vagaAceita ? 'Vaga aceita e confirmada!' : 'Confirmação de Aceite da Vaga'}
                          </div>
                          <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                            {vagaAceita
                              ? 'Você já confirmou seu aceite para esta oportunidade. Agora, complete seus dados e envie seus documentos.'
                              : 'Ao aceitar, você confirma sua disponibilidade para iniciar na data prevista com a Cooperativa ATESA.'}
                          </div>
                        </div>
                      </div>
                    </div>

                    {!vagaAceita ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={handleAceitarVaga}
                          disabled={aceitandoVaga}
                          style={{
                            background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8,
                            padding: '12px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 2px 8px rgba(46,125,50,0.3)',
                          }}
                        >
                          <IconCheck size={16} /> {aceitandoVaga ? 'Confirmando...' : 'Aceitar Vaga e Continuar'}
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setAba('cadastro')}
                          style={{
                            background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8,
                            padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          }}
                        >
                          Próximo: Preencher Dados Cadastrais →
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ padding: 24, textAlign: 'center', color: '#777' }}>
                    <p>Nenhuma alocação pendente no momento. Complete seus dados cadastrais e documentos para futuras oportunidades!</p>
                    <IonButton shape="round" color="secondary" onClick={() => setAba('cadastro')}>Preencher Dados Cadastrais</IonButton>
                  </div>
                )}
              </div>
            )}

            {/* ── ABA 2: MEUS DADOS ────────────────────────────────────────────── */}
            {aba === 'cadastro' && (
              <form onSubmit={handleSalvarCadastro} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Topo do Formulário */}
                <div style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1b5e20' }}>Preencha seus dados cadastrais</h3>
                  <p style={{ margin: '4px 0 0', fontSize: 13, color: '#666' }}>Informe seus dados pessoais, endereço e dados bancários para repasse.</p>
                </div>

                {/* Dados Pessoais */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', color: '#1b5e20' }}>Dados Pessoais</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Data de Nascimento</label>
                      <input style={inputStyle} type="date" value={ds.data_nascimento || ''} onChange={(e) => setDs((p) => ({ ...p, data_nascimento: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Estado Civil</label>
                      <select style={inputStyle} value={ds.estado_civil || ''} onChange={(e) => setDs((p) => ({ ...p, estado_civil: e.target.value as any }))}>
                        <option value="">Selecione...</option>
                        <option value="solteiro">Solteiro(a)</option>
                        <option value="casado">Casado(a)</option>
                        <option value="divorciado">Divorciado(a)</option>
                        <option value="viuvo">Viúvo(a)</option>
                        <option value="uniao_estavel">União Estável</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Naturalidade</label>
                      <input style={inputStyle} placeholder="Cidade/UF de nascimento" value={ds.naturalidade || ''} onChange={(e) => setDs((p) => ({ ...p, naturalidade: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Nome da Mãe</label>
                      <input style={inputStyle} value={ds.nome_mae || ''} onChange={(e) => setDs((p) => ({ ...p, nome_mae: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Nome do Pai</label>
                      <input style={inputStyle} value={ds.nome_pai || ''} onChange={(e) => setDs((p) => ({ ...p, nome_pai: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>RG</label>
                      <input style={inputStyle} value={ds.rg || ''} onChange={(e) => setDs((p) => ({ ...p, rg: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Órgão Emissor / UF</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input style={{ ...inputStyle, flex: 2 }} placeholder="SSP" value={ds.orgao_emissor || ''} onChange={(e) => setDs((p) => ({ ...p, orgao_emissor: e.target.value }))} />
                        <input style={{ ...inputStyle, flex: 1 }} maxLength={2} placeholder="SP" value={ds.uf_rg || ''} onChange={(e) => setDs((p) => ({ ...p, uf_rg: e.target.value.toUpperCase() }))} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>PIS / PASEP / NIS</label>
                      <input style={inputStyle} value={ds.pis_pasep || ''} onChange={(e) => setDs((p) => ({ ...p, pis_pasep: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>CNH (Número / Categoria)</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input style={{ ...inputStyle, flex: 2 }} placeholder="Nº CNH" value={ds.cnh || ''} onChange={(e) => setDs((p) => ({ ...p, cnh: e.target.value }))} />
                        <input style={{ ...inputStyle, flex: 1 }} maxLength={3} placeholder="B" value={ds.categoria_cnh || ''} onChange={(e) => setDs((p) => ({ ...p, categoria_cnh: e.target.value.toUpperCase() }))} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Endereço */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', color: '#1b5e20' }}>Endereço Residencial</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>{buscandoCep ? 'Buscando CEP...' : 'CEP'}</label>
                      <input style={inputStyle} placeholder="00000-000" value={ds.cep || ''} onChange={(e) => handleCep(e.target.value)} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={labelStyle}>Logradouro (Rua/Avenida)</label>
                      <input style={inputStyle} value={ds.logradouro || ''} onChange={(e) => setDs((p) => ({ ...p, logradouro: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Número</label>
                      <input style={inputStyle} value={ds.numero || ''} onChange={(e) => setDs((p) => ({ ...p, numero: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Complemento</label>
                      <input style={inputStyle} placeholder="Apto, Bloco..." value={ds.complemento || ''} onChange={(e) => setDs((p) => ({ ...p, complemento: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Bairro</label>
                      <input style={inputStyle} value={ds.bairro || ''} onChange={(e) => setDs((p) => ({ ...p, bairro: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Cidade / UF</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input style={{ ...inputStyle, flex: 2 }} value={ds.cidade || ''} onChange={(e) => setDs((p) => ({ ...p, cidade: e.target.value }))} />
                        <input style={{ ...inputStyle, flex: 1 }} maxLength={2} value={ds.uf || ''} onChange={(e) => setDs((p) => ({ ...p, uf: e.target.value.toUpperCase() }))} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dados Bancários */}
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 16px', color: '#1b5e20' }}>Dados Bancários para Repasse</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Banco (Nome ou Código)</label>
                      <input style={inputStyle} placeholder="Ex: Bradesco, Itaú, Nubank..." value={db.banco || ''} onChange={(e) => setDb((p) => ({ ...p, banco: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo de Conta</label>
                      <select style={inputStyle} value={db.tipo_conta || 'corrente'} onChange={(e) => setDb((p) => ({ ...p, tipo_conta: e.target.value as any }))}>
                        <option value="corrente">Conta Corrente</option>
                        <option value="poupanca">Poupança</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Agência</label>
                      <input style={inputStyle} placeholder="0000" value={db.agencia || ''} onChange={(e) => setDb((p) => ({ ...p, agencia: e.target.value }))} />
                    </div>
                    <div>
                      <label style={labelStyle}>Conta e Dígito</label>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <input style={{ ...inputStyle, flex: 2 }} placeholder="000000" value={db.conta || ''} onChange={(e) => setDb((p) => ({ ...p, conta: e.target.value }))} />
                        <input style={{ ...inputStyle, flex: 1 }} maxLength={3} placeholder="0" value={db.digito || ''} onChange={(e) => setDb((p) => ({ ...p, digito: e.target.value }))} />
                      </div>
                    </div>
                    <div>
                      <label style={labelStyle}>Tipo de Chave PIX</label>
                      <select style={inputStyle} value={db.tipo_pix || ''} onChange={(e) => setDb((p) => ({ ...p, tipo_pix: e.target.value as any }))}>
                        <option value="">Selecione...</option>
                        <option value="cpf">CPF</option>
                        <option value="email">E-mail</option>
                        <option value="telefone">Telefone</option>
                        <option value="aleatoria">Chave Aleatória</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Chave PIX</label>
                      <input style={inputStyle} placeholder="Chave para recebimento" value={db.chave_pix || ''} onChange={(e) => setDb((p) => ({ ...p, chave_pix: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Ação de Enviar Dados */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <button
                    type="submit"
                    disabled={salvandoDados}
                    style={{
                      background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 8,
                      padding: '14px 32px', fontSize: 15, fontWeight: 800, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 14px rgba(46,125,50,0.3)',
                    }}
                  >
                    <IconCheck size={18} /> {salvandoDados ? 'Salvando Dados...' : 'Salvar Meus Dados e Avançar →'}
                  </button>
                </div>
              </form>
            )}

            {/* ── ABA 3: ENVIAR DOCUMENTOS ─────────────────────────────────────── */}
            {aba === 'documentos' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                  <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 8px', color: '#1b5e20' }}>Envio de Documentos e Foto 3x4</h2>
                  <p style={{ fontSize: 13, color: '#666', margin: '0 0 20px' }}>
                    Envie fotos legíveis ou PDFs de cada um dos documentos solicitados abaixo. Formatos aceitos: JPG, PNG, WEBP e PDF (máx. 10MB).
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                    {DOCS_OBRIGATORIOS.map((item) => {
                      const docEnviado = documentos.find((d) => d.tipo === item.tipo);
                      const isUploading = uploadingTipo === item.tipo;
                      const isRejeitado = docEnviado?.rejeitado === 1;
                      const isValidado = docEnviado?.validado === 1;

                      return (
                        <div
                          key={item.tipo}
                          style={{
                            border: isRejeitado ? '2px solid #ef5350' : isValidado ? '1.5px solid #81c784' : docEnviado ? '1.5px solid #a5d6a7' : '1.5px dashed #ccc',
                            background: isRejeitado ? '#fff8f8' : isValidado ? '#f9fff9' : docEnviado ? '#f9fff9' : '#fafafa',
                            borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                          }}
                        >
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <span style={{ fontSize: 14, fontWeight: 700, color: '#222' }}>{item.titulo}</span>
                              {isValidado ? (
                                <span style={{ fontSize: 11, background: '#e8f5e9', color: '#2e7d32', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>✓ Validado</span>
                              ) : isRejeitado ? (
                                <span style={{ fontSize: 11, background: '#ffebee', color: '#c62828', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>✕ Rejeitado</span>
                              ) : docEnviado ? (
                                <span style={{ fontSize: 11, background: '#fff8e1', color: '#e65100', padding: '2px 8px', borderRadius: 12, fontWeight: 700 }}>Em análise</span>
                              ) : (
                                <span style={{ fontSize: 11, background: '#eee', color: '#777', padding: '2px 8px', borderRadius: 12 }}>Pendente</span>
                              )}
                            </div>
                            <p style={{ fontSize: 12, color: '#666', margin: '0 0 10px' }}>{item.desc}</p>

                            {/* Motivo da Rejeição */}
                            {isRejeitado && docEnviado.motivo_rejeicao && (
                              <div style={{ background: '#ffebee', border: '1px solid #ffcdd2', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: '#c62828', marginBottom: 10 }}>
                                <strong>Motivo da rejeição:</strong> {docEnviado.motivo_rejeicao}
                              </div>
                            )}

                            {docEnviado && (
                              <div style={{ fontSize: 11, color: '#555', marginBottom: 10, background: '#f5f5f5', padding: '6px 8px', borderRadius: 6 }}>
                                📄 <strong>{docEnviado.nome_original}</strong> <span style={{ color: '#888' }}>({formatarDataBR(docEnviado.enviado_em)})</span>
                              </div>
                            )}
                          </div>

                          <div style={{ display: 'flex', gap: 8 }}>
                            {docEnviado && (
                              <a
                                href={urlDownloadDocumento(docEnviado.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                  flex: 1,
                                  background: '#f1f8e9',
                                  color: '#2e7d32',
                                  border: '1px solid #a5d6a7',
                                  borderRadius: 6,
                                  padding: '8px 10px',
                                  fontSize: 12,
                                  fontWeight: 700,
                                  textDecoration: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  gap: 5,
                                }}
                                title="Abrir e visualizar documento"
                              >
                                <IconEye size={14} /> Visualizar
                              </a>
                            )}

                            <button
                              onClick={() => triggerUpload(item.tipo)}
                              disabled={isUploading}
                              style={{
                                flex: docEnviado ? 1 : undefined,
                                width: docEnviado ? undefined : '100%',
                                background: isRejeitado ? '#c62828' : docEnviado ? '#fff' : '#2e7d32',
                                color: isRejeitado ? '#fff' : docEnviado ? '#2e7d32' : '#fff',
                                border: docEnviado && !isRejeitado ? '1px solid #2e7d32' : 'none',
                                borderRadius: 6, padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                              }}
                            >
                              <IconUpload size={14} />
                              {isUploading ? 'Enviando...' : isRejeitado ? 'Enviar Novo' : docEnviado ? 'Substituir' : 'Enviar Arquivo'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* ── ABA 4: BAIXAR APLICATIVO ─────────────────────────────────────── */}
            {aba === 'app' && (
              <div style={{ background: '#fff', borderRadius: 12, padding: '36px 24px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📱</div>
                <h2 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', color: '#1b5e20' }}>
                  Baixe o Aplicativo da Cooperativa ATESA
                </h2>
                <p style={{ fontSize: 14, color: '#666', maxWidth: 540, margin: '0 auto 20px', lineHeight: 1.6 }}>
                  Acompanhe sua escala de plantões, holerites, informes de rendimento, benefícios e novidades diretamente no seu dispositivo!
                </p>

                {/* Tag de detecção do dispositivo */}
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 20, padding: '6px 16px', fontSize: 13, color: '#2e7d32', fontWeight: 600, marginBottom: 24 }}>
                  <span>⚡</span> Dispositivo detectado: <strong>{detectarPlataforma().nome}</strong>
                </div>

                {/* Botão Principal Inteligente */}
                <div style={{ marginBottom: 24 }}>
                  <button
                    onClick={abrirLojaRecomendada}
                    style={{
                      background: 'linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)',
                      color: '#fff', border: 'none', borderRadius: 10, padding: '14px 28px',
                      fontSize: 15, fontWeight: 800, cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(46,125,50,0.35)',
                      display: 'inline-flex', alignItems: 'center', gap: 10,
                    }}
                  >
                    {detectarPlataforma().isApple ? '🍎 Abrir na App Store' : '🤖 Abrir na Google Play Store'}
                  </button>
                </div>

                {/* Links para Todas as Lojas */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 28 }}>
                  <button
                    onClick={abrirGooglePlay}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: '#000', color: '#fff',
                      borderRadius: 8, padding: '10px 18px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <span>🤖</span> Google Play Store (Android)
                  </button>
                  <button
                    onClick={abrirAppStore}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: '#000', color: '#fff',
                      borderRadius: 8, padding: '10px 18px', border: 'none', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    }}
                  >
                    <span>🍎</span> Apple App Store (iOS / Mac)
                  </button>
                  <a
                    href="/login"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, background: '#2e7d32', color: '#fff',
                      borderRadius: 8, padding: '10px 18px', textDecoration: 'none', fontSize: 13, fontWeight: 600,
                    }}
                  >
                    <span>🌐</span> Acessar Web App
                  </a>
                </div>

                <div style={{ background: '#f8fbfd', border: '1px solid #e0ebf5', borderRadius: 8, padding: 16, maxWidth: 480, margin: '0 auto', fontSize: 12, color: '#555' }}>
                  💡 <strong>Dica:</strong> Salve esta página nos favoritos para acompanhar o andamento da validação dos seus documentos.
                </div>
              </div>
            )}
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 700,
  color: '#555',
  textTransform: 'uppercase',
  letterSpacing: 0.5,
  marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '8px 12px',
  borderRadius: 6,
  border: '1.5px solid #ccc',
  fontSize: 13,
  background: '#fff',
  color: '#222',
  outline: 'none',
};

export default PortalCooperado;
