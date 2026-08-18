import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './httpClient';

// ── Tipos ────────────────────────────────────────────────────────────────────

export interface Candidato {
  id: number;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cooperativa: string;
  status: 0 | 1; // 0 = pré-cadastro, 1 = ativo
  matricula: string | null;
  observacoes: string | null;
  criado_em: string;
  aprovado_em: string | null;
  aprovado_por_nome: string | null;
  total_alocacoes: number;
  alocacoes_ativas: number;
}

export interface VagaRA {
  id: number;
  cargo: string;
  total_vagas: number;
  tipo_escala: string;
  periodicidade: string;
  salario_base: number | null;
  ativa: boolean;
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
  nome_empresa?: string;
  nome_unidade?: string;
  cargo?: string;
}

export interface MetricasRA {
  total_candidatos: number;
  pre_cadastro: number;
  ativos: number;
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
  observacoes?: string;
}

// ── API ──────────────────────────────────────────────────────────────────────

export function obterMetricasRA(): Promise<MetricasRA> {
  return apiGet<MetricasRA>('/ra/metricas');
}

// Candidatos
export function listarCandidatos(params?: { status?: string; cooperativa?: string; busca?: string }): Promise<Candidato[]> {
  const query = new URLSearchParams();
  if (params?.status !== undefined && params.status !== '') query.set('status', params.status);
  if (params?.cooperativa) query.set('cooperativa', params.cooperativa);
  if (params?.busca) query.set('busca', params.busca);
  const qs = query.toString();
  return apiGet<Candidato[]>(`/ra/candidatos${qs ? `?${qs}` : ''}`);
}

export function buscarCandidatos(q: string): Promise<Pick<Candidato, 'id' | 'nome' | 'cpf' | 'matricula' | 'cooperativa' | 'status'>[]> {
  return apiGet(`/ra/candidatos/buscar?q=${encodeURIComponent(q)}`);
}

export function verificarNomeCandidato(nome: string, excludeId?: number): Promise<Pick<Candidato, 'id' | 'nome' | 'cpf' | 'matricula' | 'status'>[]> {
  const qs = new URLSearchParams({ nome });
  if (excludeId) qs.set('excludeId', String(excludeId));
  return apiGet(`/ra/candidatos/verificar-nome?${qs}`);
}

export function verificarCpfCandidato(cpf: string): Promise<{ existe: boolean; candidato: Pick<Candidato, 'id' | 'nome' | 'matricula' | 'status'> | null }> {
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

export function aprovarCandidato(id: number): Promise<{ ok: boolean; matricula: string }> {
  return apiPatch(`/ra/candidatos/${id}/aprovar`, {});
}

export function removerCandidato(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/ra/candidatos/${id}`);
}

// Vagas
export function listarVagasRA(params?: { empresaId?: number; cargo?: string; cooperativa?: string }): Promise<VagaRA[]> {
  const query = new URLSearchParams();
  if (params?.empresaId) query.set('empresaId', String(params.empresaId));
  if (params?.cargo) query.set('cargo', params.cargo);
  if (params?.cooperativa) query.set('cooperativa', params.cooperativa);
  const qs = query.toString();
  return apiGet<VagaRA[]>(`/ra/vagas${qs ? `?${qs}` : ''}`);
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
