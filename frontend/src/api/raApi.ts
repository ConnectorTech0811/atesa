import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './httpClient';

// ── Tipos ────────────────────────────────────────────────────────────────────

export type StatusCandidato = 0 | 1 | 2 | 3 | 4; // 0 = pré-cadastro, 1 = aprovado/ativo, 2 = inativo, 3 = reprovado, 4 = desligado
export type TipoContratacao = 'externo' | 'interno';

export interface HistoricoNota {
  id: number;
  candidato_id: number;
  nota_anterior: number | null;
  nota_nova: number;
  observacao_anterior: string | null;
  observacao_nova: string | null;
  usuario_id: number | null;
  usuario_nome: string | null;
  criado_em: string;
}

export interface HistoricoDesligamento {
  id: number;
  candidato_id: number;
  matricula: string | null;
  data_desligamento: string | null;
  motivo_desligamento: string | null;
  desligado_por_id: number | null;
  desligado_por_nome: string | null;
  data_recontratacao: string | null;
  recontratado_por_id: number | null;
  recontratado_por_nome: string | null;
  matricula_sucessora: string | null;
  criado_em: string;
}

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
  matricula_anterior?: string | null;
  total_desligamentos?: number;
  historico_notas?: HistoricoNota[];
  historico_desligamentos?: HistoricoDesligamento[];
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
  latitude?: string | null;
  longitude?: string | null;
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
  latitude?: string;
  longitude?: string;
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

export function verificarCpfCandidato(
  cpf: string,
  excludeId?: number
): Promise<{
  existe: boolean;
  candidato: Pick<Candidato, 'id' | 'nome' | 'matricula' | 'tipo_contratacao' | 'status'> | null;
  usuario?: { id: number; nome: string; email: string; tipo_usuario: string } | null;
}> {
  const qs = new URLSearchParams({ cpf });
  if (excludeId) qs.set('excludeId', String(excludeId));
  return apiGet(`/ra/candidatos/verificar-cpf?${qs}`);
}

export function verificarEmailCandidato(
  email: string,
  excludeId?: number
): Promise<{
  existe: boolean;
  cooperado: Pick<Candidato, 'id' | 'nome' | 'matricula' | 'tipo_contratacao' | 'status'> | null;
  usuario?: { id: number; nome: string; email: string; tipo_usuario: string } | null;
}> {
  const qs = new URLSearchParams({ email });
  if (excludeId) qs.set('excludeId', String(excludeId));
  return apiGet(`/ra/candidatos/verificar-email?${qs}`);
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

export function desligarCandidato(id: number, motivo?: string, dataDesligamento?: string, tipoDesligamento: 'total' | 'realocacao' = 'total'): Promise<{ ok: boolean; tipo?: string; matriculaMantida?: string; matriculaArquivada?: string }> {
  return apiPatch(`/ra/candidatos/${id}/desligar`, { motivo, data_desligamento: dataDesligamento, tipo_desligamento: tipoDesligamento });
}

export function reativarCandidato(id: number): Promise<{ ok: boolean; recontratado?: boolean; novaMatricula?: string; matriculaAnterior?: string }> {
  return apiPatch(`/ra/candidatos/${id}/reativar`, {});
}

export function listarHistoricoNotas(candidatoId: number): Promise<HistoricoNota[]> {
  return apiGet<HistoricoNota[]>(`/ra/candidatos/${candidatoId}/historico-notas`);
}

export function listarHistoricoDesligamentos(candidatoId: number): Promise<HistoricoDesligamento[]> {
  return apiGet<HistoricoDesligamento[]>(`/ra/candidatos/${candidatoId}/historico-desligamentos`);
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

// ── Suporte e Acompanhamento de Adesões ─────────────────────────────────────

export interface SuporteCooperadoItem {
  id: number;
  nome: string;
  cpf: string;
  email: string | null;
  telefone: string | null;
  whatsapp: string | null;
  cooperativa: string;
  matricula: string | null;
  status: number;
  latitude: string | null;
  longitude: string | null;
  data_inicio: string;
  inativado_em?: string | null;
  motivo_inativacao?: string | null;
  proposta_id?: number | null;
  status_adesao: 'pendente' | 'em_andamento' | 'enviado' | 'homologado' | 'reprovado' | string;
  ip_registro?: string | null;
  user_agent?: string | null;
  video_assistido_em?: string | null;
  declaracao_enviada_em?: string | null;
  homologado_em?: string | null;
  homologado_por_nome?: string | null;
  dados_json?: string | null;
  adesao_atualizado_em?: string | null;
  total_documentos: number;
  docs_validados: number;
  docs_rejeitados: number;
  docs_pendentes: number;
  ultimo_ip_doc?: string | null;
}

export interface SuporteCooperadoDetalhe extends SuporteCooperadoItem {
  documentos: Array<{
    id: number;
    tipo: string;
    nome_original: string;
    mime_type?: string;
    tamanho_bytes?: number;
    validado: boolean | number;
    rejeitado: boolean | number;
    motivo_rejeicao?: string | null;
    enviado_em?: string | null;
    ip_envio?: string | null;
    user_agent?: string | null;
  }>;
  dadosSensiveis?: Record<string, any> | null;
  dadosBancarios?: Record<string, any> | null;
  contatosEmergencia?: Array<Record<string, any>>;
}

export function listarSuporteCooperados(params?: {
  busca?: string;
  cooperativa?: string;
  statusAdesao?: string;
}): Promise<SuporteCooperadoItem[]> {
  const query = new URLSearchParams();
  if (params?.busca) query.set('busca', params.busca);
  if (params?.cooperativa) query.set('cooperativa', params.cooperativa);
  if (params?.statusAdesao) query.set('statusAdesao', params.statusAdesao);
  const qs = query.toString();
  return apiGet<SuporteCooperadoItem[]>(`/ra/suporte/cooperados${qs ? `?${qs}` : ''}`);
}

export function buscarSuporteCooperadoDetalhe(id: number): Promise<SuporteCooperadoDetalhe> {
  return apiGet<SuporteCooperadoDetalhe>(`/ra/suporte/cooperados/${id}`);
}

