import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './httpClient';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type StatusCandidato = 0 | 1 | 2 | 3 | 4; // 0 = pré-cadastro, 1 = aprovado/ativo, 2 = inativo, 3 = reprovado, 4 = desligado
export type TipoContratacao = 'externo' | 'interno';

export interface Candidato {
  id: number;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cooperativa: string;
  tipo_contratacao: TipoContratacao;
  status: StatusCandidato;
  nota_avaliacao?: number | null;
  avaliado_em?: string | null;
  avaliado_por_nome?: string | null;
  observacao_avaliacao?: string | null;
  matricula: string | null;
  observacoes: string | null;
  criado_em: string;
  aprovado_em: string | null;
  aprovado_por_nome: string | null;
  inativado_em?: string | null;
  inativado_por_nome?: string | null;
  motivo_inativacao?: string | null;
  data_desligamento?: string | null;
  motivo_desligamento?: string | null;
  total_alocacoes: number;
  alocacoes_ativas: number;
  qualificacoes?: string | null;
}

export interface VagaRA {
  id: number;
  cargo: string;
  cbo?: string | null;
  total_vagas: number;
  tipo_escala: string;
  periodicidade: string;
  salario_base: number | null;
  ativa: boolean | number;
  unidade_id: number;
  nome_unidade: string;
  empresa_id: number;
  nome_empresa: string;
  cooperativa: string;
  ocupadas: number;
  vagas_livres: number;
}

export interface Alocacao {
  id: number;
  candidato_id: number;
  vaga_id: number;
  unidade_id: number;
  empresa_id: number;
  data_inicio: string;
  data_fim: string | null;
  status: 'ativa' | 'encerrada' | 'cancelada';
  observacoes: string | null;
  criado_em: string;
  criado_por_nome: string | null;
  candidato_nome?: string;
  candidato_cpf?: string;
  candidato_matricula?: string;
  candidato_tipo?: TipoContratacao;
  nome_empresa?: string;
  nome_unidade?: string;
  cargo?: string;
  cbo?: string | null;
}

export interface MetricasRA {
  total_candidatos: number;
  pre_cadastro: number;
  ativos: number;
  inativos: number;
  desligados?: number;
  reprovados?: number;
  internos?: number;
  externos?: number;
  total_alocacoes: number;
  ativas: number;
  candidatos_alocados: number;
  vagas_top: Array<{
    id: number;
    cargo: string;
    total_vagas: number;
    nome_unidade: string;
    nome_empresa: string;
    ocupadas: number;
  }>;
}

export interface NovoCandidato {
  nome: string;
  cpf: string;
  email?: string;
  telefone?: string;
  whatsapp?: string;
  cooperativa: string;
  tipo_contratacao?: TipoContratacao;
  observacoes?: string;
}

// ── API ──────────────────────────────────────────────────────────────────────

export function obterMetricasRA(): Promise<MetricasRA> {
  return apiGet<MetricasRA>('/ra/metricas');
}

// Candidatos
export function listarCandidatos(params?: {
  status?: string;
  tipo_contratacao?: string;
  cooperativa?: string;
  busca?: string;
}): Promise<Candidato[]> {
  const query = new URLSearchParams();
  if (params?.status !== undefined && params.status !== '') query.set('status', params.status);
  if (params?.tipo_contratacao) query.set('tipo_contratacao', params.tipo_contratacao);
  if (params?.cooperativa) query.set('cooperativa', params.cooperativa);
  if (params?.busca) query.set('busca', params.busca);
  const qs = query.toString();
  return apiGet<Candidato[]>(`/ra/candidatos${qs ? `?${qs}` : ''}`);
}

export function buscarCandidatos(q: string): Promise<Pick<Candidato, 'id' | 'nome' | 'cpf' | 'matricula' | 'cooperativa' | 'tipo_contratacao' | 'status' | 'nota_avaliacao' | 'qualificacoes'>[]> {
  return apiGet(`/ra/candidatos/buscar?q=${encodeURIComponent(q)}`);
}

export function verificarNomeCandidato(nome: string, excludeId?: number): Promise<Pick<Candidato, 'id' | 'nome' | 'cpf' | 'matricula' | 'tipo_contratacao' | 'status' | 'nota_avaliacao'>[]> {
  const qs = new URLSearchParams({ nome });
  if (excludeId) qs.set('excludeId', String(excludeId));
  return apiGet(`/ra/candidatos/verificar-nome?${qs}`);
}

export function verificarCpfCandidato(cpf: string): Promise<{ existe: boolean; candidato: Pick<Candidato, 'id' | 'nome' | 'matricula' | 'tipo_contratacao' | 'status'> | null }> {
  return apiGet(`/ra/candidatos/verificar-cpf?cpf=${encodeURIComponent(cpf)}`);
}

export function obterCandidato(id: number): Promise<Candidato & { alocacoes: Alocacao[] }> {
  return apiGet(`/ra/candidatos/${id}`);
}

export function cadastrarCandidato(dados: NovoCandidato): Promise<{ id: number }> {
  return apiPost('/ra/candidatos', dados);
}

export function atualizarCandidato(id: number, dados: Omit<NovoCandidato, 'cpf'>): Promise<{ ok: boolean }> {
  return apiPut(`/ra/candidatos/${id}`, dados);
}

export function avaliarCandidato(id: number, dados: { nota: number; observacao?: string }): Promise<{ ok: boolean; status: StatusCandidato; nota: number; matricula?: string; aprovado: boolean }> {
  return apiPost(`/ra/candidatos/${id}/avaliar`, dados);
}

export function aprovarCandidato(id: number, nota: number = 10): Promise<{ ok: boolean; matricula: string }> {
  return apiPatch(`/ra/candidatos/${id}/aprovar`, { nota });
}

export function reprovarCandidato(id: number, nota: number = 5): Promise<{ ok: boolean }> {
  return apiPatch(`/ra/candidatos/${id}/reprovar`, { nota });
}

export function inativarCandidato(id: number, motivo?: string): Promise<{ ok: boolean }> {
  return apiPatch(`/ra/candidatos/${id}/inativar`, { motivo });
}

export function desligarCandidato(id: number, motivo?: string, dataDesligamento?: string): Promise<{ ok: boolean }> {
  return apiPatch(`/ra/candidatos/${id}/desligar`, { motivo, data_desligamento: dataDesligamento });
}

export function reativarCandidato(id: number): Promise<{ ok: boolean }> {
  return apiPatch(`/ra/candidatos/${id}/reativar`, {});
}

export function removerCandidato(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/ra/candidatos/${id}`);
}

export const excluirCandidato = removerCandidato;

// Vagas
export function listarVagasRA(params?: {
  empresaId?: number;
  tomador?: string;
  cargo?: string;
  cooperativa?: string;
  status?: string;
}): Promise<VagaRA[]> {
  const query = new URLSearchParams();
  if (params?.empresaId) query.set('empresaId', String(params.empresaId));
  if (params?.tomador) query.set('tomador', params.tomador);
  if (params?.cargo) query.set('cargo', params.cargo);
  if (params?.cooperativa) query.set('cooperativa', params.cooperativa);
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return apiGet<VagaRA[]>(`/ra/vagas${qs ? `?${qs}` : ''}`);
}

export function fecharVagaRA(vagaId: number, ativa: boolean, motivo?: string): Promise<{ ok: boolean }> {
  return apiPatch(`/ra/vagas/${vagaId}/ativacao`, { ativa, motivo });
}

export function listarAlocacoesPorVaga(vagaId: number): Promise<Alocacao[]> {
  return apiGet<Alocacao[]>(`/ra/vagas/${vagaId}/alocacoes`);
}

// Alocações
export function alocarCandidato(vagaId: number, dados: {
  candidatoId: number;
  unidadeId: number;
  empresaId: number;
  dataInicio: string;
  observacoes?: string;
}): Promise<{ id: number }> {
  return apiPost(`/ra/vagas/${vagaId}/alocar`, dados);
}

export function encerrarAlocacao(alocacaoId: number, dados: { dataFim?: string; observacoes?: string }): Promise<{ ok: boolean }> {
  return apiPatch(`/ra/alocacoes/${alocacaoId}/encerrar`, dados);
}
