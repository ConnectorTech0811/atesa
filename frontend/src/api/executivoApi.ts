import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './httpClient';
import { Empresa } from './empresasApi';

export type StatusTrabalho = 'em_aberto' | 'em_andamento' | 'proposta_enviada' | 'proposta_aceita' | 'fechado' | 'cancelado';
export type TipoContato = 'ligacao' | 'email' | 'reuniao' | 'visita' | 'whatsapp';
export type StatusNegocio = 'negocio_fechado' | 'negociacao' | 'negocio_frustrado' | 'visita_agendada' | 'visita_cancelada';
export type StatusReuniao = 'agendada' | 'realizada' | 'cancelada' | 'pos_venda' | 'alinhamento' | 'fechamento';

export const ROTULO_STATUS_NEGOCIO: Record<StatusNegocio, string> = {
  negocio_fechado: 'Negócio fechado',
  negociacao: 'Negociação',
  negocio_frustrado: 'Negócio frustrado',
  visita_agendada: 'Visita agendada',
  visita_cancelada: 'Visita cancelada',
};

export const ROTULO_STATUS_TRABALHO: Record<StatusTrabalho, string> = {
  em_aberto: 'Em aberto',
  em_andamento: 'Em andamento',
  proposta_enviada: 'Proposta enviada',
  proposta_aceita: 'Proposta aceita',
  fechado: 'Fechado',
  cancelado: 'Cancelado',
};

export const ROTULO_TIPO_CONTATO: Record<TipoContato, string> = {
  ligacao: 'Ligação',
  email: 'E-mail',
  reuniao: 'Reunião',
  visita: 'Visita',
  whatsapp: 'WhatsApp',
};

export interface Trabalho {
  id: number;
  empresa_id: number;
  titulo: string;
  status: StatusTrabalho;
  executivo_id: number;
  executivo_nome: string;
  observacoes: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface ContatoTrabalho {
  id: number;
  trabalho_id: number;
  tipo: TipoContato;
  data_contato: string;
  observacoes: string;
  status_negocio: StatusNegocio | null;
  alerta_em: string | null;
  registrado_por_nome: string;
  criado_em: string;
}

export interface ParametrosTrabalho {
  id?: number;
  trabalho_id?: number;
  cargo?: string;
  quantidade?: number;
  descricao_cargo?: string;
  salario?: number;
  beneficios?: string;
  local_trabalho?: string;
  horario?: string;
  requisitos?: string;
  observacoes?: string;
  // Proposta comercial - textos
  quem_somos?: string;
  cooperativismo?: string;
  nossos_valores?: string;
  cobranca?: string;
  // Taxas básicas
  taxa_administrativa?: number;
  encargos_sociais?: number;
  margem_lucro?: number;
  taxa_risco?: number;
  // Taxas detalhadas (planilha Excel)
  dar_percentual?: number;
  seguro_vida_percentual?: number;
  inss_percentual?: number;
  pis_percentual?: number;
  cofins_percentual?: number;
  iss_percentual?: number;
  valor_vr_dia?: number;
  valor_vt_dia?: number;
  insalubridade_pre_pct?: number;
  insalubridade_media_pct?: number;
  insalubridade_maxima_pct?: number;
  rateio_percentual?: number;
}

export interface MetricasExecutivo {
  total_empresas: number;
  total_alertas: number;
  reunioes_proximas: number;
  statusEmpresas: { status: string; total: number }[];
  statusTrabalhos: { status: string; total: number }[];
  funil: { status_negocio: string; total: number }[];
  reunioesEmpresaIds: number[];
  negocioFechadoEmpresaIds: number[];
  funilEmpresaIdsPorStatus: Record<string, number[]>;
  trabalhoEmpresaIdsPorStatus: Record<string, number[]>;
}

export type TipoInsalubridade = 'sem_risco' | 'pre' | 'media' | 'maxima';
export type TipoEscala = 'plantao';

/** Rótulos de insalubridade — use em todos os módulos. */
export const ROTULO_INSALUBRIDADE: Record<TipoInsalubridade, string> = {
  sem_risco: 'Sem risco',
  pre:    'Pré (8%)',
  media:  'Média (9%)',
  maxima: 'Máxima (11%)',
};

/** Rótulos de escala de trabalho — use em todos os módulos. */
export const ROTULO_ESCALA: Record<TipoEscala, string> = {
  plantao: 'Plantão 12x36',
};

/** Rótulos de status de reunião — use em todos os módulos. */
export const ROTULO_STATUS_REUNIAO: Record<StatusReuniao, string> = {
  agendada:    'Agendada',
  realizada:   'Realizada',
  cancelada:   'Cancelada',
  pos_venda:   'Pós-venda',
  alinhamento: 'Alinhamento',
  fechamento:  'Fechamento',
};

/** Cores de status de reunião — use em todos os módulos. */
export const STATUS_COR_REUNIAO: Record<StatusReuniao, { bg: string; color: string }> = {
  agendada:    { bg: '#e8f0fe', color: '#1976d2' },
  realizada:   { bg: '#e8f5e9', color: '#388e3c' },
  cancelada:   { bg: '#fce4ec', color: '#c62828' },
  pos_venda:   { bg: '#f3e5f5', color: '#7b1fa2' },
  alinhamento: { bg: '#fff8e1', color: '#f57f17' },
  fechamento:  { bg: '#e0f2f1', color: '#00695c' },
};

export interface AtividadeProposta {
  id: number;
  cargo: string;
  descricao?: string;
  quantidade: number;
  salario_base?: number;
  ordem: number;
  vr_dias?: number;
  vt_dias?: number;
  adicional_noturno?: boolean;
  periculosidade?: boolean;
  insalubridade?: TipoInsalubridade;
  premio_incentivo?: number;
  tipo_escala?: TipoEscala;
}

export interface NovaAtividadeProposta {
  cargo: string;
  descricao?: string;
  quantidade: number;
  salarioBase?: number;
  ordem?: number;
  vrDias?: number;
  vtDias?: number;
  adicionalNoturno?: boolean;
  periculosidade?: boolean;
  insalubridade?: TipoInsalubridade;
  premioIncentivo?: number;
  tipoEscala?: TipoEscala;
}

export interface Reuniao {
  id: number;
  empresa_id: number;
  trabalho_id: number | null;
  titulo: string;
  data_hora: string;
  local_reuniao: string | null;
  observacoes: string | null;
  status: StatusReuniao;
  agendado_por_nome: string;
  nome_empresa?: string;
  criado_em: string;
}

// ── Empresas do executivo ─────────────────────────────────────────────────────

export function listarEmpresasExecutivo(): Promise<Empresa[]> {
  return apiGet<Empresa[]>('/empresas/executivo');
}

export interface AtualizarEmpresaPayload {
  nomeEmpresa: string;
  emailEmpresa: string;
  telefoneEmpresa: string;
  cnpj?: string;
  cep?: string;
  rua?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  representante?: string;
  dataPrimeiroContato?: string;
  status?: string;
}

export function atualizarDadosEmpresa(id: number, dados: AtualizarEmpresaPayload): Promise<Empresa> {
  return apiPut<Empresa>(`/empresas/${id}`, dados);
}

export function obterMetricasExecutivo(): Promise<MetricasExecutivo> {
  return apiGet<MetricasExecutivo>('/empresas/metricas');
}

// ── Trabalhos ─────────────────────────────────────────────────────────────────

export function listarTrabalhos(empresaId: number): Promise<Trabalho[]> {
  return apiGet<Trabalho[]>(`/empresas/${empresaId}/trabalhos`);
}

export function criarTrabalho(empresaId: number, titulo: string, observacoes?: string): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/empresas/${empresaId}/trabalhos`, { titulo, observacoes });
}

export function atualizarTrabalho(id: number, dados: { titulo?: string; status?: StatusTrabalho; observacoes?: string }): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/trabalhos/${id}`, dados);
}

// ── Contatos do trabalho ──────────────────────────────────────────────────────

export function listarContatos(trabalhoId: number): Promise<ContatoTrabalho[]> {
  return apiGet<ContatoTrabalho[]>(`/trabalhos/${trabalhoId}/contatos`);
}

export function adicionarContato(
  trabalhoId: number,
  dados: { tipo: TipoContato; dataContato: string; observacoes: string; statusNegocio?: StatusNegocio }
): Promise<{ id: number; negocioFechado: boolean; negocioFrustrado: boolean; alertaEm: string | null }> {
  return apiPost(`/trabalhos/${trabalhoId}/contatos`, dados);
}

// ── Parâmetros do trabalho ────────────────────────────────────────────────────

export function obterParametros(trabalhoId: number): Promise<ParametrosTrabalho> {
  return apiGet<ParametrosTrabalho>(`/trabalhos/${trabalhoId}/parametros`);
}

export function salvarParametros(trabalhoId: number, dados: ParametrosTrabalho & Record<string, unknown>): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/trabalhos/${trabalhoId}/parametros`, dados);
}

// ── Reuniões ──────────────────────────────────────────────────────────────────

export function listarTodasReunioes(): Promise<Reuniao[]> {
  return apiGet<Reuniao[]>('/reunioes');
}

export function listarReunioesPorEmpresa(empresaId: number): Promise<Reuniao[]> {
  return apiGet<Reuniao[]>(`/empresas/${empresaId}/reunioes`);
}

export function agendarReuniao(dados: {
  empresaId: number;
  trabalhoId?: number;
  titulo: string;
  dataHora: string;
  localReuniao?: string;
  observacoes?: string;
}): Promise<{ id: number }> {
  return apiPost<{ id: number }>('/reunioes', dados);
}

export function atualizarStatusReuniao(id: number, status: StatusReuniao): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/reunioes/${id}`, { status });
}

// ── Atividades da proposta ────────────────────────────────────────────────────

export function listarAtividades(trabalhoId: number): Promise<AtividadeProposta[]> {
  return apiGet<AtividadeProposta[]>(`/trabalhos/${trabalhoId}/atividades`);
}

export function adicionarAtividades(trabalhoId: number, atividades: NovaAtividadeProposta[]): Promise<{ ids: number[] }> {
  return apiPost<{ ids: number[] }>(`/trabalhos/${trabalhoId}/atividades`, { atividades });
}

export function editarAtividade(trabalhoId: number, id: number, dados: Partial<NovaAtividadeProposta>): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/trabalhos/${trabalhoId}/atividades/${id}`, dados);
}

export function deletarAtividade(trabalhoId: number, id: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/trabalhos/${trabalhoId}/atividades/${id}`);
}

// ── Propostas por e-mail ──────────────────────────────────────────────────────

export interface PropostaEmail {
  id: number;
  assunto: string;
  destinatario: string;
  enviada_em: string;
  enviada_por_nome: string;
  status: 'enviada' | 'erro';
  observacao?: string;
}

export interface NovaPropostaEmail {
  destinatario: string;
  assunto: string;
  corpo: string;
  observacao?: string;
}

export function listarPropostas(empresaId: number): Promise<PropostaEmail[]> {
  return apiGet<PropostaEmail[]>(`/empresas/${empresaId}/propostas`);
}

export function enviarProposta(empresaId: number, dados: NovaPropostaEmail): Promise<{ id: number; status: string; aviso?: string }> {
  return apiPost<{ id: number; status: string; aviso?: string }>(`/empresas/${empresaId}/propostas`, dados);
}

// ── Ocorrências do Cooperado ──────────────────────────────────────────────────

export type TipoOcorrencia = 'falta' | 'atraso' | 'acidente' | 'disciplinar' | 'elogio' | 'reclamacao' | 'outro';
export type GravidadeOcorrencia = 'baixa' | 'normal' | 'alta' | 'critica';
export type StatusOcorrencia = 'aberta' | 'em_analise' | 'resolvida' | 'arquivada';

export const ROTULO_TIPO_OCORRENCIA: Record<TipoOcorrencia, string> = {
  falta: 'Falta',
  atraso: 'Atraso',
  acidente: 'Acidente',
  disciplinar: 'Disciplinar',
  elogio: 'Elogio',
  reclamacao: 'Reclamação',
  outro: 'Outro',
};

export const ROTULO_GRAVIDADE: Record<GravidadeOcorrencia, string> = {
  baixa: 'Baixa',
  normal: 'Normal',
  alta: 'Alta',
  critica: 'Crítica',
};

export const COR_GRAVIDADE: Record<GravidadeOcorrencia, { bg: string; color: string }> = {
  baixa: { bg: '#e8f5e9', color: '#2e7d32' },
  normal: { bg: '#e3f2fd', color: '#1565c0' },
  alta: { bg: '#fff3e0', color: '#e65100' },
  critica: { bg: '#ffebee', color: '#c62828' },
};

export interface Ocorrencia {
  id: number;
  empresa_id: number;
  nome_empresa: string;
  cooperado_id?: number;
  cooperado_nome?: string;
  tipo: TipoOcorrencia;
  descricao: string;
  status: StatusOcorrencia;
  gravidade: GravidadeOcorrencia;
  data_ocorrencia: string;
  registrada_por_nome: string;
  resolvida_em?: string;
  resolucao?: string;
  criado_em: string;
}

export interface NovaOcorrencia {
  empresa_id: number;
  cooperado_id?: number;
  cooperado_nome?: string;
  tipo: TipoOcorrencia;
  descricao: string;
  gravidade: GravidadeOcorrencia;
  data_ocorrencia: string;
}

export function listarOcorrencias(filtros?: { empresa_id?: number; tipo?: string; status?: string }): Promise<Ocorrencia[]> {
  const params = new URLSearchParams();
  if (filtros?.empresa_id) params.set('empresa_id', String(filtros.empresa_id));
  if (filtros?.tipo) params.set('tipo', filtros.tipo);
  if (filtros?.status) params.set('status', filtros.status);
  const qs = params.toString() ? `?${params}` : '';
  return apiGet<Ocorrencia[]>(`/ocorrencias${qs}`);
}

export function criarOcorrencia(dados: NovaOcorrencia): Promise<{ id: number }> {
  return apiPost<{ id: number }>('/ocorrencias', dados);
}

export function atualizarOcorrencia(id: number, dados: { status: StatusOcorrencia; resolucao?: string }): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/ocorrencias/${id}`, dados);
}
