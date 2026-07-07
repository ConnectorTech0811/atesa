import { apiGet, apiPatch, apiPost, apiPut } from './httpClient';
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

export function salvarParametros(trabalhoId: number, dados: ParametrosTrabalho): Promise<{ ok: boolean }> {
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
