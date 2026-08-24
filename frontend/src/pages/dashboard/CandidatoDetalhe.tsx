/**
 * CandidatoDetalhe — Visualização e edição completa do candidato/cooperado.
 * Abas: Dados Pessoais | Endereço | Dados Bancários | Documentos | Descontos | Histórico
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { IonButton } from '@ionic/react';
import { useToast } from '../../components/ToastContext';
import { useAuth } from '../../auth/AuthContext';
import { Candidato, Alocacao } from '../../api/raApi';
import {
  DadosSensiveis, DadosBancarios, Documento, Descontos, RegistroAuditoria, QualificacaoCatalogo, CotaMensal,
  ROTULO_TIPO_DOC, TipoDocumento,
  obterDadosSensiveis, salvarDadosSensiveis,
  obterDadosBancarios, salvarDadosBancarios,
  listarDocumentos, enviarDocumento, validarDocumento, rejeitarDocumento, removerDocumento, urlDownloadDocumento,
  obterDescontos, salvarDescontos,
  listarAuditoria,
  listarQualificacoesCatalogo, obterQualificacoesCandidato, salvarQualificacoesCandidato, criarQualificacaoCatalogo,
  listarCotasMensais, criarCotaMensal, atualizarCotaMensal, removerCotaMensal,
  enviarWhatsApp,
} from '../../api/beneficiosApi';
import { buscarEnderecoPorCep, formatarCEP, formatarDataBR, formatarMoeda } from '../../utils/formatters';
import {
  IconFile, IconImage, IconTrash, IconCheck, IconX, IconBell, IconLock,
  IconUpload, IconCheckCircle, IconEdit, IconRefresh, IconPhone2, IconMail, IconPhone,
} from '../../components/Icons';

// ── Estilos compartilhados ─────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: '#fff', border: '1px solid #e0e0e0', borderRadius: 10,
  padding: '20px 22px', marginBottom: 16,
};
const sTitle: React.CSSProperties = {
  fontSize: 13, fontWeight: 700, color: '#4a9e4f',
  borderBottom: '2px solid #c8e6c9', paddingBottom: 5, marginBottom: 14, marginTop: 0,
};
const grid2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const grid3: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 };
const field: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3 };
const label: React.CSSProperties = { fontSize: 11, color: '#888', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' };
const input: React.CSSProperties = { border: '1px solid #ccc', borderRadius: 5, padding: '6px 10px', fontSize: 13, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' };
const select: React.CSSProperties = { ...input };
const badge = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 20,
  fontSize: 11, fontWeight: 700, background: bg, color,
});

type Aba = 'pessoal' | 'endereco' | 'bancario' | 'documentos' | 'descontos' | 'cotas' | 'historico' | 'auditoria';

const ABAS: { id: Aba; label: string }[] = [
  { id: 'pessoal',    label: 'Dados Pessoais' },
  { id: 'endereco',   label: 'Endereço' },
  { id: 'bancario',   label: 'Dados Bancários' },
  { id: 'documentos', label: 'Documentos' },
  { id: 'descontos',  label: 'Descontos' },
  { id: 'cotas',      label: 'Cotas Mensais' },
  { id: 'historico',  label: 'Alocações' },
  { id: 'auditoria',  label: 'Auditoria' },
];

const DS_VAZIO: DadosSensiveis = {
  data_nascimento: '', rg: '', orgao_emissor: '', uf_rg: '', nome_mae: '', nome_pai: '',
  estado_civil: undefined, naturalidade: '', nacionalidade: 'Brasileiro(a)',
  cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', uf: '',
  pis_pasep: '', titulo_eleitor: '', cnh: '', categoria_cnh: '', qualificacoes: '',
};

const DB_VAZIO: DadosBancarios = {
  banco: '', codigo_banco: '', agencia: '', conta: '', digito: '',
  tipo_conta: 'corrente', chave_pix: '', tipo_pix: undefined,
};

const DESC_VAZIO: Descontos = {
  inss_percentual: 0, seguro_vida_percentual: 0,
  quota_parte_valor: 0, quota_parcelada: false,
  quota_total_cotas: undefined, quota_cotas_pagas: 0,
  rateio_percentual: 0, outras_descricao: '', outras_valor: 0,
};

// ── Componentes auxiliares ────────────────────────────────────────────────────

function Campo({ label: lbl, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={field}>
      <span style={label}>{lbl}</span>
      {children}
    </div>
  );
}

function ValorLeitura({ valor }: { valor?: string | number | null }) {
  return <span style={{ fontSize: 13, color: valor ? '#222' : '#bbb' }}>{valor || '—'}</span>;
}

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  candidato: Candidato;
  alocacoes: Alocacao[];
  onVoltar: () => void;
  onAtualizado?: () => void;
}

const CandidatoDetalhe: React.FC<Props> = ({ candidato, alocacoes, onVoltar, onAtualizado }) => {
  const { showToast } = useToast();
  const { usuario } = useAuth();
  const [aba, setAba] = useState<Aba>('pessoal');

  const [ds, setDs] = useState<DadosSensiveis>(DS_VAZIO);
  const [db, setDb] = useState<DadosBancarios>(DB_VAZIO);
  const [desc, setDesc] = useState<Descontos>(DESC_VAZIO);
  const [docs, setDocs] = useState<Documento[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tipoUpload, setTipoUpload] = useState<TipoDocumento>('outro');
  const [enviandoDoc, setEnviandoDoc] = useState(false);

  // Auditoria
  const [auditoria, setAuditoria] = useState<RegistroAuditoria[]>([]);
  const [carregandoAuditoria, setCarregandoAuditoria] = useState(false);

  // Qualificações
  const [catalogo, setCatalogo] = useState<QualificacaoCatalogo[]>([]);
  const [qualSelecionadas, setQualSelecionadas] = useState<number[]>([]);
  const [salvandoQual, setSalvandoQual] = useState(false);
  const [novaQual, setNovaQual] = useState('');

  // Cotas Mensais
  const [cotas, setCotas] = useState<CotaMensal[]>([]);
  const [carregandoCotas, setCarregandoCotas] = useState(false);
  const [novaCota, setNovaCota] = useState({ descricao: '', tipo: 'outro', valor: '', totalParcelas: '', recorrente: false, observacao: '' });
  const [adicionandoCota, setAdicionandoCota] = useState(false);
  const [showFormCota, setShowFormCota] = useState(false);

  // Rejeição de documentos
  const [rejeitandoDoc, setRejeitandoDoc] = useState<number | null>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');

  // WhatsApp
  const [enviandoWpp, setEnviandoWpp] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const [dadosS, dadosB, dadosD, dadosDocs, qual, catCatalogo] = await Promise.all([
        obterDadosSensiveis(candidato.id).catch(() => ({})),
        obterDadosBancarios(candidato.id).catch(() => ({})),
        obterDescontos(candidato.id).catch(() => ({})),
        listarDocumentos(candidato.id).catch(() => []),
        obterQualificacoesCandidato(candidato.id).catch(() => []),
        listarQualificacoesCatalogo().catch(() => []),
      ]);
      setDs({ ...DS_VAZIO, ...dadosS });
      setDb({ ...DB_VAZIO, ...dadosB });
      setDesc({ ...DESC_VAZIO, ...dadosD });
      setDocs(dadosDocs);
      setQualSelecionadas((qual as QualificacaoCatalogo[]).map((q) => q.id));
      setCatalogo(catCatalogo as QualificacaoCatalogo[]);
    } finally {
      setCarregando(false);
    }
  }, [candidato.id]);

  const carregarAuditoria = useCallback(async () => {
    setCarregandoAuditoria(true);
    try { setAuditoria(await listarAuditoria(candidato.id)); }
    catch { /* silencioso */ } finally { setCarregandoAuditoria(false); }
  }, [candidato.id]);

  const carregarCotas = useCallback(async () => {
    setCarregandoCotas(true);
    try { setCotas(await listarCotasMensais(candidato.id)); }
    catch { /* silencioso */ } finally { setCarregandoCotas(false); }
  }, [candidato.id]);

  useEffect(() => { carregar(); }, [carregar]);

  // Lazy-load de dados pesados ao trocar de aba
  useEffect(() => {
    if (aba === 'auditoria' && auditoria.length === 0 && !carregandoAuditoria) carregarAuditoria();
    if (aba === 'cotas' && cotas.length === 0 && !carregandoCotas) carregarCotas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aba]);

  const updDs = (k: keyof DadosSensiveis, v: string) => setDs((p) => ({ ...p, [k]: v }));
  const updDb = (k: keyof DadosBancarios, v: string) => setDb((p) => ({ ...p, [k]: v }));
  const updDesc = (k: keyof Descontos, v: unknown) => setDesc((p) => ({ ...p, [k]: v }));

  // Busca CEP
  const handleCep = async (cep: string) => {
    updDs('cep', formatarCEP(cep));
    const digits = cep.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const end = await buscarEnderecoPorCep(digits);
      if (end) {
        setDs((p) => ({
          ...p,
          logradouro: end.rua ?? p.logradouro,
          bairro: end.bairro ?? p.bairro,
          cidade: end.cidade ?? p.cidade,
          uf: end.uf ?? p.uf,
        }));
      }
    } catch { /* silencioso */ } finally { setBuscandoCep(false); }
  };

  // Salvar dados sensíveis (pessoal + endereço juntos)
  const salvarPessoal = async () => {
    setSalvando(true);
    try {
      await salvarDadosSensiveis(candidato.id, ds);
      showToast('Dados pessoais salvos!', 'success');
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSalvando(false); }
  };

  const salvarBancario = async () => {
    setSalvando(true);
    try {
      await salvarDadosBancarios(candidato.id, db);
      showToast('Dados bancários salvos!', 'success');
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSalvando(false); }
  };

  const salvarDescontosHandler = async () => {
    setSalvando(true);
    try {
      await salvarDescontos(candidato.id, desc);
      showToast('Descontos salvos!', 'success');
    } catch { showToast('Erro ao salvar.', 'error'); }
    finally { setSalvando(false); }
  };

  // WhatsApp
  const handleWhatsApp = async () => {
    setEnviandoWpp(true);
    try {
      const resp = await enviarWhatsApp(candidato.id);
      if (resp.enviado) {
        showToast('WhatsApp enviado com sucesso!', 'success');
      } else {
        showToast(`Link gerado (API WhatsApp não configurada): ${resp.link}`, 'warning');
      }
    } catch { showToast('Erro ao enviar WhatsApp.', 'error'); }
    finally { setEnviandoWpp(false); }
  };

  // Qualificações
  const toggleQual = (id: number) =>
    setQualSelecionadas((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSalvarQual = async () => {
    setSalvandoQual(true);
    try {
      await salvarQualificacoesCandidato(candidato.id, qualSelecionadas);
      showToast('Qualificações salvas!', 'success');
    } catch { showToast('Erro ao salvar qualificações.', 'error'); }
    finally { setSalvandoQual(false); }
  };

  const handleNovaQual = async () => {
    const nome = novaQual.trim();
    if (!nome) return;
    try {
      const r = await criarQualificacaoCatalogo(nome);
      const novaCat: QualificacaoCatalogo = { id: r.id, nome, categoria: null, ativo: 1 };
      setCatalogo((prev) => [...prev, novaCat]);
      setQualSelecionadas((prev) => [...prev, r.id]);
      setNovaQual('');
      showToast('Qualificação criada e selecionada!', 'success');
    } catch { showToast('Essa qualificação já existe ou houve um erro.', 'error'); }
  };

  // Rejeição de documentos
  const handleRejeitar = async (docId: number) => {
    if (!motivoRejeicao.trim()) { showToast('Informe o motivo da rejeição.', 'warning'); return; }
    try {
      await rejeitarDocumento(docId, motivoRejeicao);
      showToast('Documento rejeitado. Cooperado notificado.', 'success');
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, rejeitado: 1, motivo_rejeicao: motivoRejeicao, validado: 0 } : d));
      setRejeitandoDoc(null);
      setMotivoRejeicao('');
    } catch { showToast('Erro ao rejeitar documento.', 'error'); }
  };

  // Cotas Mensais
  const handleAdicionarCota = async () => {
    if (!novaCota.descricao || !novaCota.valor) { showToast('Preencha descrição e valor.', 'warning'); return; }
    setAdicionandoCota(true);
    try {
      await criarCotaMensal(candidato.id, {
        descricao: novaCota.descricao,
        tipo: novaCota.tipo as CotaMensal['tipo'],
        valor: parseFloat(novaCota.valor),
        total_parcelas: novaCota.totalParcelas ? parseInt(novaCota.totalParcelas) : undefined,
        recorrente: novaCota.recorrente ? 1 : 0,
        observacao: novaCota.observacao || undefined,
      } as Partial<CotaMensal>);
      showToast('Cota cadastrada!', 'success');
      setNovaCota({ descricao: '', tipo: 'outro', valor: '', totalParcelas: '', recorrente: false, observacao: '' });
      setShowFormCota(false);
      await carregarCotas();
    } catch { showToast('Erro ao cadastrar cota.', 'error'); }
    finally { setAdicionandoCota(false); }
  };

  const handleRemoverCota = async (cotaId: number) => {
    if (!confirm('Remover esta cota?')) return;
    try {
      await removerCotaMensal(cotaId);
      setCotas((prev) => prev.filter((c) => c.id !== cotaId));
      showToast('Cota removida.', 'success');
    } catch { showToast('Erro ao remover cota.', 'error'); }
  };

  const handleToggleAtivaCota = async (cota: CotaMensal) => {
    try {
      await atualizarCotaMensal(cota.id, { ...cota, ativa: cota.ativa ? 0 : 1 });
      setCotas((prev) => prev.map((c) => c.id === cota.id ? { ...c, ativa: c.ativa ? 0 : 1 } : c));
    } catch { showToast('Erro ao atualizar cota.', 'error'); }
  };

  // Upload de documento
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const token = localStorage.getItem('atesa_token') ?? '';
    setEnviandoDoc(true);
    try {
      await enviarDocumento(candidato.id, tipoUpload, file, token);
      showToast('Documento enviado!', 'success');
      const updated = await listarDocumentos(candidato.id);
      setDocs(updated);
    } catch (err: unknown) {
      showToast((err as Error).message ?? 'Erro ao enviar.', 'error');
    } finally {
      setEnviandoDoc(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleValidar = async (docId: number) => {
    try {
      await validarDocumento(docId);
      showToast('Documento validado!', 'success');
      setDocs((prev) => prev.map((d) => d.id === docId ? { ...d, validado: 1 } : d));
    } catch { showToast('Erro ao validar.', 'error'); }
  };

  const handleRemoverDoc = async (docId: number) => {
    if (!confirm('Remover este documento?')) return;
    try {
      await removerDocumento(docId);
      showToast('Documento removido.', 'success');
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch { showToast('Erro ao remover.', 'error'); }
  };

  // ── Cabeçalho do candidato ──────────────────────────────────────────────────

  const statusLabel = candidato.status === 1 ? 'Ativo' : 'Pré-cadastro';
  const statusBg = candidato.status === 1 ? '#e8f5e9' : '#fff8e1';
  const statusCor = candidato.status === 1 ? '#2e7d32' : '#e65100';

  if (carregando) return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: 48,
      textAlign: 'center', color: '#888', fontSize: 14,
      boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    }}>
      Carregando dados do candidato…
    </div>
  );

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        background: '#fff',
        borderBottom: '3px solid #4a9e4f',
        padding: '18px 20px 16px',
        display: 'flex', alignItems: 'center', gap: 16,
      }}>
        {/* Avatar */}
        <div style={{
          width: 58, height: 58, borderRadius: '50%', flexShrink: 0,
          background: '#4a9e4f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 24, fontWeight: 800, color: '#fff',
          boxShadow: '0 2px 8px rgba(74,158,79,0.25)',
        }}>
          {candidato.nome.charAt(0).toUpperCase()}
        </div>

        {/* Infos — ocupa todo o espaço disponível */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 5 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: '#1a1a1a', lineHeight: 1.2 }}>
              {candidato.nome}
            </h2>
            <span style={{
              display: 'inline-block', padding: '3px 11px', borderRadius: 20,
              fontSize: 12, fontWeight: 700,
              background: statusBg, color: statusCor,
              border: `1px solid ${statusCor}33`,
            }}>{statusLabel}</span>
            {candidato.matricula && (
              <span style={{ fontSize: 12, color: '#4a9e4f', fontWeight: 700, fontFamily: 'monospace' }}>
                #{candidato.matricula}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>CPF</span>
              <span style={{ fontWeight: 600, color: '#222' }}>{candidato.cpf}</span>
            </span>
            <span style={{ fontSize: 13, color: '#444', display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: 0.5 }}>Cooperativa</span>
              <span style={{ fontWeight: 600, color: '#222' }}>{candidato.cooperativa}</span>
            </span>
            {candidato.email && (
              <span style={{ fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconMail size={12} />{candidato.email}
              </span>
            )}
            {candidato.telefone && (
              <span style={{ fontSize: 13, color: '#555', display: 'flex', alignItems: 'center', gap: 4 }}>
                <IconPhone size={12} />{candidato.telefone}
              </span>
            )}
          </div>
        </div>

        {/* Coluna direita: X no topo, WhatsApp abaixo — sem sobreposição */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0, alignSelf: 'stretch', justifyContent: 'space-between' }}>
          {/* Fechar */}
          <button
            onClick={onVoltar}
            title="Fechar ficha"
            style={{
              background: '#f0f0f0', border: '1.5px solid #d0d0d0',
              borderRadius: '50%', width: 32, height: 32, cursor: 'pointer',
              color: '#444', fontSize: 18, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0, lineHeight: 1, flexShrink: 0,
            }}
          >×</button>

          {/* WhatsApp */}
          <button
            onClick={handleWhatsApp}
            disabled={enviandoWpp}
            title="Enviar link de cadastro via WhatsApp"
            style={{
              background: enviandoWpp ? '#ccc' : '#25D366',
              border: 'none', borderRadius: 8, padding: '8px 14px',
              cursor: enviandoWpp ? 'default' : 'pointer',
              color: '#fff', fontSize: 13, fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 6px rgba(37,211,102,0.28)',
              flexShrink: 0,
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.121 1.528 5.853L.057 23.432a.5.5 0 0 0 .611.611l5.579-1.471A11.943 11.943 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.895 0-3.668-.525-5.176-1.437l-.37-.221-3.843 1.013 1.013-3.843-.22-.37A9.963 9.963 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/></svg>
            {enviandoWpp ? 'Enviando…' : 'WhatsApp'}
          </button>
        </div>
      </div>

      {/* ── Abas ─────────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #e8edf4', background: '#f5f8fc', overflowX: 'auto' }}>
        {ABAS.map((a) => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            style={{
              padding: '11px 18px', border: 'none', cursor: 'pointer',
              fontSize: 13, fontWeight: aba === a.id ? 700 : 400,
              color: aba === a.id ? '#4a9e4f' : '#666',
              background: aba === a.id ? '#fff' : 'transparent',
              borderBottom: aba === a.id ? '3px solid #4a9e4f' : '3px solid transparent',
              whiteSpace: 'nowrap', transition: 'color 0.15s',
            }}
          >{a.label}</button>
        ))}
      </div>

      {/* ── Conteúdo das abas ────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 28px 32px' }}>

      {/* ── ABA: Dados Pessoais ──────────────────────────────────────────── */}
      {aba === 'pessoal' && (
        <>
          <div style={card}>
            <p style={sTitle}>Informações Pessoais</p>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label="Data de Nascimento">
                <input style={input} type="date" value={ds.data_nascimento ?? ''} onChange={(e) => updDs('data_nascimento', e.target.value)} />
              </Campo>
              <Campo label="Estado Civil">
                <select style={select} value={ds.estado_civil ?? ''} onChange={(e) => updDs('estado_civil', e.target.value)}>
                  <option value="">—</option>
                  <option value="solteiro">Solteiro(a)</option>
                  <option value="casado">Casado(a)</option>
                  <option value="divorciado">Divorciado(a)</option>
                  <option value="viuvo">Viúvo(a)</option>
                  <option value="uniao_estavel">União Estável</option>
                </select>
              </Campo>
              <Campo label="Nacionalidade">
                <input style={input} value={ds.nacionalidade ?? 'Brasileiro(a)'} onChange={(e) => updDs('nacionalidade', e.target.value)} />
              </Campo>
            </div>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label="Naturalidade">
                <input style={input} value={ds.naturalidade ?? ''} onChange={(e) => updDs('naturalidade', e.target.value)} />
              </Campo>
              <Campo label="Nome da Mãe">
                <input style={input} value={ds.nome_mae ?? ''} onChange={(e) => updDs('nome_mae', e.target.value)} />
              </Campo>
              <Campo label="Nome do Pai">
                <input style={input} value={ds.nome_pai ?? ''} onChange={(e) => updDs('nome_pai', e.target.value)} />
              </Campo>
            </div>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label="RG">
                <input style={input} value={ds.rg ?? ''} onChange={(e) => updDs('rg', e.target.value)} />
              </Campo>
              <Campo label="Órgão Emissor">
                <input style={input} value={ds.orgao_emissor ?? ''} onChange={(e) => updDs('orgao_emissor', e.target.value)} placeholder="SSP/SP" />
              </Campo>
              <Campo label="UF do RG">
                <input style={input} maxLength={2} value={ds.uf_rg ?? ''} onChange={(e) => updDs('uf_rg', e.target.value.toUpperCase())} />
              </Campo>
            </div>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label="PIS / NIS / PASEP">
                <input style={input} value={ds.pis_pasep ?? ''} onChange={(e) => updDs('pis_pasep', e.target.value)} />
              </Campo>
              <Campo label="Título de Eleitor">
                <input style={input} value={ds.titulo_eleitor ?? ''} onChange={(e) => updDs('titulo_eleitor', e.target.value)} />
              </Campo>
              <Campo label="CNH — Categoria">
                <div style={{ display: 'flex', gap: 6 }}>
                  <input style={{ ...input, flex: 2 }} placeholder="Número" value={ds.cnh ?? ''} onChange={(e) => updDs('cnh', e.target.value)} />
                  <input style={{ ...input, flex: 1 }} placeholder="Cat." maxLength={3} value={ds.categoria_cnh ?? ''} onChange={(e) => updDs('categoria_cnh', e.target.value.toUpperCase())} />
                </div>
              </Campo>
            </div>
            <div style={field}>
              <span style={label}>Qualificações / Aptidões</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {catalogo.map((q) => {
                  const sel = qualSelecionadas.includes(q.id);
                  return (
                    <button
                      key={q.id}
                      type="button"
                      onClick={() => toggleQual(q.id)}
                      style={{
                        padding: '4px 12px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                        border: sel ? '1.5px solid #4a9e4f' : '1.5px solid #ccc',
                        background: sel ? '#4a9e4f' : '#f5f5f5',
                        color: sel ? '#fff' : '#555', fontWeight: sel ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >{q.nome}</button>
                  );
                })}
              </div>
              {/* Criar nova qualificação inline */}
              <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                <input
                  style={{ ...input, flex: 1 }}
                  placeholder="Nova qualificação…"
                  value={novaQual}
                  onChange={(e) => setNovaQual(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleNovaQual(); } }}
                />
                <IonButton size="small" color="medium" onClick={handleNovaQual}>+ Criar</IonButton>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
                <IonButton size="small" color="primary" disabled={salvandoQual} onClick={handleSalvarQual}>
                  {salvandoQual ? 'Salvando…' : 'Salvar Qualificações'}
                </IonButton>
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IonButton size="small" color="primary" disabled={salvando} onClick={salvarPessoal}>
              {salvando ? 'Salvando…' : 'Salvar Dados Pessoais'}
            </IonButton>
          </div>
        </>
      )}

      {/* ── ABA: Endereço ──────────────────────────────────────────────────── */}
      {aba === 'endereco' && (
        <>
          <div style={card}>
            <p style={sTitle}>Endereço Residencial</p>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label={buscandoCep ? 'CEP (buscando…)' : 'CEP'}>
                <input
                  style={input}
                  value={ds.cep ?? ''}
                  onChange={(e) => handleCep(e.target.value)}
                  placeholder="00000-000"
                />
              </Campo>
              <Campo label="Logradouro">
                <input style={input} value={ds.logradouro ?? ''} onChange={(e) => updDs('logradouro', e.target.value)} />
              </Campo>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <Campo label="Número">
                  <input style={input} value={ds.numero ?? ''} onChange={(e) => updDs('numero', e.target.value)} />
                </Campo>
                <Campo label="Complemento">
                  <input style={input} value={ds.complemento ?? ''} onChange={(e) => updDs('complemento', e.target.value)} />
                </Campo>
              </div>
            </div>
            <div style={grid3}>
              <Campo label="Bairro">
                <input style={input} value={ds.bairro ?? ''} onChange={(e) => updDs('bairro', e.target.value)} />
              </Campo>
              <Campo label="Cidade">
                <input style={input} value={ds.cidade ?? ''} onChange={(e) => updDs('cidade', e.target.value)} />
              </Campo>
              <Campo label="UF">
                <input style={input} maxLength={2} value={ds.uf ?? ''} onChange={(e) => updDs('uf', e.target.value.toUpperCase())} />
              </Campo>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IonButton size="small" color="primary" disabled={salvando} onClick={salvarPessoal}>
              {salvando ? 'Salvando…' : 'Salvar Endereço'}
            </IonButton>
          </div>
        </>
      )}

      {/* ── ABA: Dados Bancários ───────────────────────────────────────────── */}
      {aba === 'bancario' && (
        <>
          <div style={card}>
            <p style={sTitle}>Conta Bancária</p>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label="Banco">
                <input style={input} value={db.banco ?? ''} onChange={(e) => updDb('banco', e.target.value)} placeholder="Ex: Bradesco" />
              </Campo>
              <Campo label="Código do Banco">
                <input style={input} value={db.codigo_banco ?? ''} onChange={(e) => updDb('codigo_banco', e.target.value)} placeholder="237" />
              </Campo>
              <Campo label="Tipo de Conta">
                <select style={select} value={db.tipo_conta ?? 'corrente'} onChange={(e) => updDb('tipo_conta', e.target.value)}>
                  <option value="corrente">Corrente</option>
                  <option value="poupanca">Poupança</option>
                </select>
              </Campo>
            </div>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label="Agência">
                <input style={input} value={db.agencia ?? ''} onChange={(e) => updDb('agencia', e.target.value)} />
              </Campo>
              <Campo label="Conta">
                <input style={input} value={db.conta ?? ''} onChange={(e) => updDb('conta', e.target.value)} />
              </Campo>
              <Campo label="Dígito">
                <input style={input} maxLength={3} value={db.digito ?? ''} onChange={(e) => updDb('digito', e.target.value)} />
              </Campo>
            </div>
          </div>

          <div style={card}>
            <p style={sTitle}>PIX</p>
            <div style={grid2}>
              <Campo label="Tipo da Chave PIX">
                <select style={select} value={db.tipo_pix ?? ''} onChange={(e) => updDb('tipo_pix', e.target.value)}>
                  <option value="">— Selecione —</option>
                  <option value="cpf">CPF</option>
                  <option value="email">E-mail</option>
                  <option value="telefone">Telefone</option>
                  <option value="aleatoria">Chave Aleatória</option>
                </select>
              </Campo>
              <Campo label="Chave PIX">
                <input style={input} value={db.chave_pix ?? ''} onChange={(e) => updDb('chave_pix', e.target.value)} />
              </Campo>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IonButton size="small" color="primary" disabled={salvando} onClick={salvarBancario}>
              {salvando ? 'Salvando…' : 'Salvar Dados Bancários'}
            </IonButton>
          </div>
        </>
      )}

      {/* ── ABA: Documentos ───────────────────────────────────────────────── */}
      {aba === 'documentos' && (
        <>
          {/* Upload */}
          <div style={card}>
            <p style={sTitle}>Enviar Documento</p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <Campo label="Tipo do documento">
                  <select style={select} value={tipoUpload} onChange={(e) => setTipoUpload(e.target.value as TipoDocumento)}>
                    {(Object.entries(ROTULO_TIPO_DOC) as [TipoDocumento, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </Campo>
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  style={{ display: 'none' }}
                  onChange={handleUpload}
                />
                <IonButton size="small" color="primary" disabled={enviandoDoc} onClick={() => fileRef.current?.click()}>
                  {enviandoDoc ? 'Enviando…' : '+ Enviar Arquivo'}
                </IonButton>
              </div>
            </div>
            <p style={{ fontSize: 11, color: '#999', marginTop: 8 }}>Formatos aceitos: JPG, PNG, WEBP, PDF — máx. 10 MB</p>
          </div>

          {/* Lista de documentos */}
          <div style={card}>
            <p style={sTitle}>Documentos Enviados ({docs.length})</p>
            {docs.length === 0 && <p style={{ fontSize: 13, color: '#aaa' }}>Nenhum documento enviado ainda.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {docs.map((doc) => (
                <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }}>
                  <span style={{ color: doc.mime_type.startsWith('image') ? '#6a1b9a' : '#1565c0', flexShrink: 0 }}>
                    {doc.mime_type.startsWith('image') ? <IconImage size={22} /> : <IconFile size={22} />}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ROTULO_TIPO_DOC[doc.tipo] ?? doc.tipo}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>
                      {doc.nome_original} · {(doc.tamanho_bytes / 1024).toFixed(0)} KB
                    </div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                      Enviado por {doc.enviado_por_nome ?? '—'} em {formatarDataBR(doc.enviado_em)}
                    </div>
                    {doc.rejeitado ? (
                      <div style={{ fontSize: 11, color: '#c62828', marginTop: 3, display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                        <span>⚠</span>
                        <span>Rejeitado por {doc.rejeitado_por_nome ?? '—'}: {doc.motivo_rejeicao ?? ''}</span>
                      </div>
                    ) : null}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {doc.validado
                      ? <span style={badge('#e8f5e9', '#2e7d32')}>✓ Validado</span>
                      : <span style={badge('#fff8e1', '#e65100')}>Pendente</span>
                    }
                    <a
                      href={urlDownloadDocumento(doc.id)}
                      target="_blank"
                      rel="noreferrer"
                      style={{ fontSize: 12, color: '#4a9e4f' }}
                    >
                      Ver
                    </a>
                    {!doc.validado && !doc.rejeitado && (
                      <>
                        <button
                          onClick={() => handleValidar(doc.id)}
                          style={{ fontSize: 12, color: '#2e7d32', background: 'none', border: 'none', cursor: 'pointer' }}
                        >✓ Validar</button>
                        <button
                          onClick={() => { setRejeitandoDoc(doc.id); setMotivoRejeicao(''); }}
                          style={{ fontSize: 12, color: '#e65100', background: 'none', border: 'none', cursor: 'pointer' }}
                        >✕ Rejeitar</button>
                      </>
                    )}
                    {doc.rejeitado ? (
                      <span style={badge('#fce4ec', '#c62828')}>✕ Rejeitado</span>
                    ) : null}
                    <button
                      onClick={() => handleRemoverDoc(doc.id)}
                      title="Remover documento"
                      style={{ color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                    ><IconTrash size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* ── ABA: Descontos ────────────────────────────────────────────────── */}
      {aba === 'descontos' && (
        <>
          <div style={card}>
            <p style={sTitle}>Descontos Obrigatórios do Contrato</p>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
              Estes valores são aplicados automaticamente no cálculo do contrato do cooperado.
            </p>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label="INSS (%)">
                <input style={input} type="number" step="0.01" min="0" max="100"
                  value={desc.inss_percentual ?? 0}
                  onChange={(e) => updDesc('inss_percentual', parseFloat(e.target.value) || 0)} />
              </Campo>
              <Campo label="Seguro de Vida (%)">
                <input style={input} type="number" step="0.01" min="0" max="100"
                  value={desc.seguro_vida_percentual ?? 0}
                  onChange={(e) => updDesc('seguro_vida_percentual', parseFloat(e.target.value) || 0)} />
              </Campo>
              <Campo label="Rateio (%)">
                <input style={input} type="number" step="0.01" min="0" max="100"
                  value={desc.rateio_percentual ?? 0}
                  onChange={(e) => updDesc('rateio_percentual', parseFloat(e.target.value) || 0)} />
              </Campo>
            </div>
          </div>

          <div style={card}>
            <p style={sTitle}>Quota Parte</p>
            <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
              Pagas enquanto o contrato estiver vigente. Se parcelada, o cooperado continua pagando após desligamento até quitar.
            </p>
            <div style={{ ...grid3, marginBottom: 12 }}>
              <Campo label="Valor da Quota Parte (R$)">
                <input style={input} type="number" step="0.01" min="0"
                  value={desc.quota_parte_valor ?? 0}
                  onChange={(e) => updDesc('quota_parte_valor', parseFloat(e.target.value) || 0)} />
              </Campo>
              <Campo label="Parcelada?">
                <select style={select}
                  value={desc.quota_parcelada ? '1' : '0'}
                  onChange={(e) => updDesc('quota_parcelada', e.target.value === '1')}>
                  <option value="0">Não (única vez)</option>
                  <option value="1">Sim (parcelada)</option>
                </select>
              </Campo>
              {desc.quota_parcelada && (
                <>
                  <Campo label="Total de Cotas">
                    <input style={input} type="number" min="1"
                      value={desc.quota_total_cotas ?? ''}
                      onChange={(e) => updDesc('quota_total_cotas', parseInt(e.target.value) || null)} />
                  </Campo>
                  <Campo label="Cotas Pagas">
                    <input style={input} type="number" min="0"
                      value={desc.quota_cotas_pagas ?? 0}
                      onChange={(e) => updDesc('quota_cotas_pagas', parseInt(e.target.value) || 0)} />
                  </Campo>
                </>
              )}
            </div>
          </div>

          <div style={card}>
            <p style={sTitle}>Outros Descontos</p>
            <div style={grid2}>
              <Campo label="Descrição">
                <input style={input} value={desc.outras_descricao ?? ''}
                  onChange={(e) => updDesc('outras_descricao', e.target.value)}
                  placeholder="Ex: Uniforme, crachá…" />
              </Campo>
              <Campo label="Valor (R$)">
                <input style={input} type="number" step="0.01" min="0"
                  value={desc.outras_valor ?? 0}
                  onChange={(e) => updDesc('outras_valor', parseFloat(e.target.value) || 0)} />
              </Campo>
            </div>
          </div>

          {/* Resumo dos descontos */}
          <div style={{ ...card, background: '#f5f8fb' }}>
            <p style={sTitle}>Resumo de Descontos</p>
            <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>INSS</span><span>{desc.inss_percentual ?? 0}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Seguro de Vida</span><span>{desc.seguro_vida_percentual ?? 0}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Rateio</span><span>{desc.rateio_percentual ?? 0}%</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Quota Parte</span>
                <span>{formatarMoeda(Number(desc.quota_parte_valor ?? 0))}
                  {desc.quota_parcelada ? ` (${desc.quota_cotas_pagas ?? 0}/${desc.quota_total_cotas ?? '?'} pagas)` : ''}
                </span>
              </div>
              {(desc.outras_valor ?? 0) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{desc.outras_descricao || 'Outros'}</span>
                  <span>{formatarMoeda(Number(desc.outras_valor ?? 0))}</span>
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <IonButton size="small" color="primary" disabled={salvando} onClick={salvarDescontosHandler}>
              {salvando ? 'Salvando…' : 'Salvar Descontos'}
            </IonButton>
          </div>
        </>
      )}

      {/* ── Modal: Rejeição de documento ─────────────────────────────────── */}
      {rejeitandoDoc !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: '#c62828' }}>Rejeitar documento</h3>
            <p style={{ fontSize: 13, color: '#666', margin: '0 0 14px' }}>Informe o motivo. O cooperado será notificado para enviar uma nova versão.</p>
            <textarea
              style={{ ...input, minHeight: 80, resize: 'vertical', marginBottom: 14 }}
              placeholder="Ex: Documento ilegível, fora de prazo, tipo incorreto…"
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <IonButton size="small" color="medium" onClick={() => setRejeitandoDoc(null)}>Cancelar</IonButton>
              <IonButton size="small" color="danger" onClick={() => handleRejeitar(rejeitandoDoc)}>Confirmar Rejeição</IonButton>
            </div>
          </div>
        </div>
      )}

      {/* ── ABA: Cotas Mensais ────────────────────────────────────────────── */}
      {aba === 'cotas' && (
        <>
          <div style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <p style={{ ...sTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Cotas e Descontos Recorrentes</p>
              <IonButton size="small" color="primary" onClick={() => setShowFormCota((v) => !v)}>
                {showFormCota ? 'Cancelar' : '+ Adicionar Cota'}
              </IonButton>
            </div>
            <p style={{ fontSize: 12, color: '#666', margin: '0 0 16px' }}>
              Descontos mensais cadastrados na vaga do cooperado: seguro de vida, quota parte, INSS e outros encargos recorrentes.
            </p>

            {showFormCota && (
              <div style={{ background: '#f5f8fc', borderRadius: 8, padding: 16, marginBottom: 16, border: '1px solid #e0eaf5' }}>
                <p style={{ ...sTitle, marginTop: 0 }}>Nova Cota</p>
                <div style={{ ...grid3, marginBottom: 10 }}>
                  <Campo label="Descrição">
                    <input style={input} value={novaCota.descricao} onChange={(e) => setNovaCota((p) => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Seguro Allianz" />
                  </Campo>
                  <Campo label="Tipo">
                    <select style={select} value={novaCota.tipo} onChange={(e) => setNovaCota((p) => ({ ...p, tipo: e.target.value }))}>
                      <option value="seguro_vida">Seguro de Vida</option>
                      <option value="quota_parte">Quota Parte</option>
                      <option value="inss">INSS</option>
                      <option value="outro">Outro</option>
                    </select>
                  </Campo>
                  <Campo label="Valor Mensal (R$)">
                    <input style={input} type="number" step="0.01" value={novaCota.valor} onChange={(e) => setNovaCota((p) => ({ ...p, valor: e.target.value }))} />
                  </Campo>
                </div>
                <div style={{ ...grid3, marginBottom: 10 }}>
                  <Campo label="Total de Parcelas (vazio = ilimitado)">
                    <input style={input} type="number" min="1" value={novaCota.totalParcelas} onChange={(e) => setNovaCota((p) => ({ ...p, totalParcelas: e.target.value }))} />
                  </Campo>
                  <Campo label="Recorrente após vencimento?">
                    <select style={select} value={novaCota.recorrente ? '1' : '0'} onChange={(e) => setNovaCota((p) => ({ ...p, recorrente: e.target.value === '1' }))}>
                      <option value="0">Não</option>
                      <option value="1">Sim</option>
                    </select>
                  </Campo>
                  <Campo label="Observação">
                    <input style={input} value={novaCota.observacao} onChange={(e) => setNovaCota((p) => ({ ...p, observacao: e.target.value }))} />
                  </Campo>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <IonButton size="small" color="primary" disabled={adicionandoCota} onClick={handleAdicionarCota}>
                    {adicionandoCota ? 'Salvando…' : 'Salvar Cota'}
                  </IonButton>
                </div>
              </div>
            )}

            {carregandoCotas && <p style={{ fontSize: 13, color: '#aaa' }}>Carregando cotas…</p>}
            {!carregandoCotas && cotas.length === 0 && <p style={{ fontSize: 13, color: '#aaa' }}>Nenhuma cota cadastrada.</p>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {cotas.map((c) => (
                <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid #eee', borderRadius: 8, background: c.ativa ? '#fff' : '#fafafa', opacity: c.ativa ? 1 : 0.65 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{c.descricao}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>
                      R$ {Number(c.valor).toFixed(2)} / mês
                      {c.total_parcelas ? ` · ${c.parcelas_pagas}/${c.total_parcelas} parcelas` : ''}
                      {c.recorrente ? ' · Recorrente' : ''}
                    </div>
                    {c.observacao && <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{c.observacao}</div>}
                  </div>
                  <span style={badge(
                    c.tipo === 'seguro_vida' ? '#e3f2fd' : c.tipo === 'quota_parte' ? '#e8f5e9' : c.tipo === 'inss' ? '#fff8e1' : '#f5f5f5',
                    c.tipo === 'seguro_vida' ? '#1565c0' : c.tipo === 'quota_parte' ? '#2e7d32' : c.tipo === 'inss' ? '#e65100' : '#555',
                  )}>
                    {c.tipo === 'seguro_vida' ? 'Seguro Vida' : c.tipo === 'quota_parte' ? 'Quota Parte' : c.tipo === 'inss' ? 'INSS' : 'Outro'}
                  </span>
                  <button onClick={() => handleToggleAtivaCota(c)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: c.ativa ? '#c62828' : '#2e7d32' }}>
                    {c.ativa ? 'Desativar' : 'Ativar'}
                  </button>
                  <button onClick={() => handleRemoverCota(c.id)} style={{ fontSize: 12, color: '#999', background: 'none', border: 'none', cursor: 'pointer' }}>🗑</button>
                </div>
              ))}
            </div>
          </div>

          {/* Resumo financeiro */}
          {cotas.filter((c) => c.ativa).length > 0 && (
            <div style={{ ...card, background: '#f0f4fa' }}>
              <p style={sTitle}>Resumo Mensal</p>
              <div style={{ fontSize: 13, display: 'flex', flexDirection: 'column', gap: 5 }}>
                {cotas.filter((c) => c.ativa).map((c) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.descricao}</span>
                    <span style={{ fontFamily: 'monospace' }}>R$ {Number(c.valor).toFixed(2)}</span>
                  </div>
                ))}
                <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #ccd', paddingTop: 6, fontWeight: 700 }}>
                  <span>Total descontos/mês</span>
                  <span style={{ fontFamily: 'monospace' }}>
                    R$ {cotas.filter((c) => c.ativa).reduce((s, c) => s + Number(c.valor), 0).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── ABA: Auditoria ───────────────────────────────────────────────── */}
      {aba === 'auditoria' && (
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <p style={{ ...sTitle, marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>Log de Auditoria</p>
            <button onClick={carregarAuditoria} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#4a9e4f', background: 'none', border: 'none', cursor: 'pointer' }}>
              <IconRefresh size={13} /> Atualizar
            </button>
          </div>
          {carregandoAuditoria && <p style={{ fontSize: 13, color: '#aaa' }}>Carregando…</p>}
          {!carregandoAuditoria && auditoria.length === 0 && <p style={{ fontSize: 13, color: '#aaa' }}>Nenhum registro de auditoria encontrado.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {auditoria.map((reg) => {
              const acaoIconComp: Record<string, React.ReactNode> = {
                criacao:    <IconCheckCircle size={16} />,
                edicao:     <IconEdit size={16} />,
                exclusao:   <IconTrash size={16} />,
                validacao:  <IconCheck size={16} />,
                rejeicao:   <IconX size={16} />,
                upload:     <IconUpload size={16} />,
                whatsapp:   <IconPhone2 size={16} />,
                notificacao:<IconBell size={16} />,
              };
              const acaoCor: Record<string, string> = {
                criacao: '#1565c0', edicao: '#e65100', exclusao: '#c62828',
                validacao: '#2e7d32', rejeicao: '#c62828', upload: '#6a1b9a',
                whatsapp: '#25D366', notificacao: '#f57c00',
              };
              return (
                <div key={reg.id} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ flexShrink: 0, marginTop: 2, color: acaoCor[reg.acao] ?? '#888' }}>
                    {acaoIconComp[reg.acao] ?? <IconLock size={16} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: acaoCor[reg.acao] ?? '#333', textTransform: 'capitalize' }}>{reg.acao}</div>
                    <div style={{ fontSize: 12, color: '#555', marginTop: 2 }}>
                      {reg.observacao ?? `${reg.tabela}${reg.campo ? ` › ${reg.campo}` : ''}`}
                    </div>
                    {(reg.valor_anterior || reg.valor_novo) && (
                      <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>
                        {reg.valor_anterior && <span style={{ textDecoration: 'line-through', marginRight: 6 }}>{reg.valor_anterior}</span>}
                        {reg.valor_novo && <span style={{ color: '#2e7d32' }}>→ {reg.valor_novo}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 11, color: '#4a9e4f', fontWeight: 600 }}>{reg.usuario_nome ?? '—'}</div>
                    <div style={{ fontSize: 10, color: '#aaa', marginTop: 2 }}>
                      {new Date(reg.criado_em).toLocaleDateString('pt-BR')} {new Date(reg.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── ABA: Histórico de Alocações ────────────────────────────────────── */}
      {aba === 'historico' && (
        <div style={card}>
          <p style={sTitle}>Histórico de Alocações ({alocacoes.length})</p>
          {alocacoes.length === 0 && <p style={{ fontSize: 13, color: '#aaa' }}>Nenhuma alocação registrada.</p>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {alocacoes.map((a) => (
              <div key={a.id} style={{ padding: '12px 14px', border: '1px solid #eee', borderRadius: 8, background: '#fafafa' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{a.cargo ?? '—'}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{a.nome_empresa ?? '—'} · {a.nome_unidade ?? '—'}</div>
                    <div style={{ fontSize: 11, color: '#999', marginTop: 3 }}>
                      Início: {formatarDataBR(a.data_inicio)}
                      {a.data_fim ? ` · Fim: ${formatarDataBR(a.data_fim)}` : ''}
                    </div>
                  </div>
                  <span style={badge(
                    a.status === 'ativa' ? '#e8f5e9' : a.status === 'encerrada' ? '#f5f5f5' : '#fce4ec',
                    a.status === 'ativa' ? '#2e7d32' : a.status === 'encerrada' ? '#757575' : '#c62828',
                  )}>
                    {a.status === 'ativa' ? 'Ativa' : a.status === 'encerrada' ? 'Encerrada' : 'Cancelada'}
                  </span>
                </div>
                {a.observacoes && <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>{a.observacoes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      </div>{/* fim do div de conteúdo das abas */}
    </div>
  );
};

export default CandidatoDetalhe;
