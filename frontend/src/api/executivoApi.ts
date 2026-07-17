import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './httpClient';
import { Empresa } from './empresasApi';

export type StatusTrabalho = 'em_aberto' | 'em_andamento' | 'proposta_enviada' | 'proposta_aceita' | 'fechado' | 'cancelado';
export type TipoContato = 'ligacao' | 'email' | 'reuniao' | 'visita' | 'whatsapp';
export type StatusNegocio = 'negocio_fechado' | 'negociacao' | 'negocio_frustrado' | 'visita_agendada' | 'visita_cancelada';
export type StatusReuniao = 'agendada' | 'realizada' | 'cancelada';

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
}

export type TipoInsalubridade = 'sem_risco' | 'pre' | 'media' | 'maxima';
export type TipoEscala = 'mensal' | 'plantao';

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

export function atualizarDadosEmpresa(id: number, dados: Partial<Empresa>): Promise<Empresa> {
  return apiPut<Empresa>(`/empresas/${id}`, dados);
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
