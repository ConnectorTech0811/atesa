import { apiGet, apiPost, apiPut, apiDelete } from './httpClient';

// ── Tipos ────────────────────────────────────────────────────────────────────
export type TurnoPlantao = 'diurno' | 'noturno';
export type StatusEscala = 'prevista' | 'realizada' | 'cancelada';

export interface OpcoesEscala {
  cooperados: { id: number; nome: string; matricula: string }[];
  empresas: { id: number; nome_empresa: string }[];
  alocacoes: {
    id: number;
    candidato_id: number;
    empresa_id: number;
    status: string;
    data_inicio: string | null;
    data_fim: string | null;
    cargo: string | null;
    nome_unidade: string | null;
    nome_empresa: string | null;
  }[];
  /** Vagas parametrizadas (tela Parâmetro): local, atividade e horário de cada cliente */
  vagas: VagaParametrizada[];
}

export interface VagaParametrizada {
  id: number;
  unidade_id: number;
  empresa_id: number;
  nome_unidade: string;
  unidade_endereco: string | null;
  cargo: string;
  tipo_atividade: string | null;
  horario: string | null;
  intervalo: string | null;
  tipo_escala: string | null;
}

export interface Paciente {
  id: number;
  nome: string;
  tipo: 'paciente' | 'local';
  empresa_id: number | null;
  nome_empresa?: string | null;
  endereco: string | null;
  patologia: string | null;
  cuidados: string | null;
  observacoes: string | null;
  ativo: number;
}

export interface DadosPaciente {
  nome: string;
  tipo: 'paciente' | 'local';
  empresaId?: number | null;
  endereco?: string;
  patologia?: string;
  cuidados?: string;
  observacoes?: string;
  ativo?: boolean;
}

export interface Escala {
  id: number;
  candidato_id: number;
  cooperado_nome: string;
  matricula: string;
  paciente_id: number | null;
  paciente_nome: string | null;
  paciente_tipo: 'paciente' | 'local' | null;
  paciente_endereco: string | null;
  paciente_patologia: string | null;
  paciente_cuidados: string | null;
  alocacao_id: number | null;
  empresa_id: number | null;
  empresa_id_efetiva: number | null;
  nome_empresa: string | null;
  unidade_id: number | null;
  nome_unidade: string | null;
  vaga_id: number | null;
  atividade: string | null;
  data: string;
  hora_inicio: string;
  hora_fim: string;
  duracao_minutos: number;
  turno: TurnoPlantao;
  status: StatusEscala;
  observacao: string | null;
  criado_por_nome: string | null;
}

export interface DadosEscala {
  candidatoId: number;
  pacienteId?: number | null;
  alocacaoId?: number | null;
  empresaId?: number | null;
  unidadeId?: number | null;
  vagaId?: number | null;
  atividade?: string;
  data?: string;
  datas?: string[];
  /** Plantões com data e horário próprios (ex.: dois plantões seguidos no mesmo dia) */
  plantoes?: { data: string; horaInicio: string; horaFim: string }[];
  horaInicio: string;
  horaFim: string;
  status?: StatusEscala;
  observacao?: string;
}

export interface FiltrosEscala {
  dataInicio?: string;
  dataFim?: string;
  candidatoId?: number;
  pacienteId?: number;
  empresaId?: number;
  turno?: TurnoPlantao | '';
  status?: StatusEscala | '';
}

export interface ConferenciaPlantao {
  candidato_id: number;
  cooperado_nome: string;
  matricula: string;
  plantoes_diurnos: number;
  minutos_diurnos: number;
  plantoes_noturnos: number;
  minutos_noturnos: number;
  plantoes_realizados: number;
  plantoes_previstos: number;
  minutos_escala: number;
  minutos_apontados: number;
  diferenca_minutos: number;
}

export interface LinhaValoresCliente {
  linha: number;
  nome: string;
  matricula: string;
  desc_refeicao: number | string;
  bonificacao: number | string;
  desc_estacionamento: number | string;
  desc_farmacia: number | string;
  reembolso: number | string;
}

export interface ResultadoImportacao {
  ok: boolean;
  importados: number;
  erros: { linha: number; matricula: string; nome: string; motivo: string }[];
  avisos: { linha: number; matricula: string; nome: string; motivo: string }[];
}

export interface ValorClienteSalvo {
  id: number;
  competencia: string;
  candidato_id: number;
  cooperado_nome: string;
  matricula: string;
  desc_refeicao: string;
  bonificacao: string;
  desc_estacionamento: string;
  desc_farmacia: string;
  reembolso: string;
  importado_por_nome: string | null;
  atualizado_em: string;
}

export interface LinhaFaturamento {
  alocacao_id: number | null;
  candidato_id: number;
  cooperado: string;
  matricula: string;
  data_inicio: string | null;
  desligamento: string | null;
  atividade: string;
  tipo_escala: string | null;
  competencia: string;
  local: string;
  dias_mes_total: number;
  dias_mes_fechado: number;
  dias_trabalhados: number;
  total_horas: number;
  horas_apontadas: number;
  horas_escala: number;
  horas_previstas: number;
  horas_falta: number;
  horas_noturnas: number;
  pl_diurno: number;
  pl_noturno: number;
  hora_excedente: number;
  ad_noturno: number;
  /** Problemas de jornada que impedem conferir o item (viram divergência no processo) */
  inconsistencias: OcorrenciaJornada[];
  /** Informações da apuração que não bloqueiam (ex.: refeição não registrada) */
  avisos: OcorrenciaJornada[];
  bonificacao: number;
  desc_refeicao: number;
  desc_estacionamento: number;
  desc_farmacia: number;
  reembolso: number;
}

export interface OcorrenciaJornada {
  tipo: string;
  data: string;
  descricao: string;
}

export interface RegrasApuracao {
  tolerancia_minutos: number;
  noturno_inicio: string;
  noturno_fim: string;
  hora_noturna_reduzida: boolean;
  refeicao_nao_registrada: 'descontar_parametro' | 'nao_descontar';
  extras_automaticos: boolean;
  jornada_maxima_horas: number;
  janela_escala_horas: number;
  personalizadas?: boolean;
  atualizado_por_nome?: string | null;
  atualizado_em?: string | null;
}

export interface PlanilhaFaturamento {
  empresa: { id: number; nome: string };
  competencia: string;
  periodo: { inicio: string; fim: string };
  linhas: LinhaFaturamento[];
  regras: RegrasApuracao;
  tipos_inconsistencia: Record<string, string>;
  total_inconsistencias: number;
  avisos: string[];
}

function buildQuery(params: Record<string, any>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.append(k, String(v));
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

// ── Escalas & Pacientes ──────────────────────────────────────────────────────
export function obterOpcoesEscala(): Promise<OpcoesEscala> {
  return apiGet<OpcoesEscala>('/supervisao/escalas/opcoes');
}

export function listarPacientes(filtros: { busca?: string; empresaId?: number; incluirInativos?: boolean } = {}): Promise<Paciente[]> {
  return apiGet<Paciente[]>(`/supervisao/escalas/pacientes${buildQuery(filtros)}`);
}

export function criarPaciente(dados: DadosPaciente): Promise<{ ok: boolean; id: number }> {
  return apiPost('/supervisao/escalas/pacientes', dados);
}

export function atualizarPaciente(id: number, dados: DadosPaciente): Promise<{ ok: boolean; id: number }> {
  return apiPut(`/supervisao/escalas/pacientes/${id}`, dados);
}

export function listarEscalas(filtros: FiltrosEscala = {}): Promise<Escala[]> {
  return apiGet<Escala[]>(`/supervisao/escalas${buildQuery(filtros)}`);
}

export function criarEscala(dados: DadosEscala): Promise<{ ok: boolean; ids: number[] }> {
  return apiPost('/supervisao/escalas', dados);
}

export function atualizarEscala(id: number, dados: DadosEscala): Promise<{ ok: boolean; id: number }> {
  return apiPut(`/supervisao/escalas/${id}`, dados);
}

export function excluirEscala(id: number): Promise<{ ok: boolean }> {
  return apiDelete(`/supervisao/escalas/${id}`);
}

export function obterConferenciaPlantoes(filtros: { dataInicio: string; dataFim: string; empresaId?: number; candidatoId?: number }): Promise<ConferenciaPlantao[]> {
  return apiGet<ConferenciaPlantao[]>(`/supervisao/escalas/conferencia${buildQuery(filtros)}`);
}

// ── Faturamento ──────────────────────────────────────────────────────────────
export function importarValoresCliente(dados: { competencia: string; empresaId?: number; linhas: LinhaValoresCliente[] }): Promise<ResultadoImportacao> {
  return apiPost<ResultadoImportacao>('/supervisao/faturamento/valores-cliente/importar', dados);
}

export function listarValoresCliente(filtros: { competencia: string; empresaId?: number }): Promise<ValorClienteSalvo[]> {
  return apiGet<ValorClienteSalvo[]>(`/supervisao/faturamento/valores-cliente${buildQuery(filtros)}`);
}

export function excluirValoresCliente(filtros: { competencia: string; empresaId?: number }): Promise<{ ok: boolean; removidos: number }> {
  return apiDelete(`/supervisao/faturamento/valores-cliente${buildQuery(filtros)}`);
}

export function obterRegrasApuracao(): Promise<RegrasApuracao> {
  return apiGet<RegrasApuracao>('/supervisao/faturamento/regras-apuracao');
}

export function salvarRegrasApuracao(dados: Partial<RegrasApuracao>): Promise<RegrasApuracao> {
  return apiPut<RegrasApuracao>('/supervisao/faturamento/regras-apuracao', dados);
}

export function gerarPlanilhaFaturamento(filtros: { empresaId: number; competencia: string }): Promise<PlanilhaFaturamento> {
  return apiGet<PlanilhaFaturamento>(`/supervisao/faturamento/planilha${buildQuery(filtros)}`);
}

// ── Processo de Faturamento (apuração, conferência, aprovação) ───────────────
export type StatusProcessoFaturamento = 'aberto' | 'apurado' | 'aprovado' | 'rejeitado' | 'cancelado';
export type StatusItemFaturamento = 'pendente' | 'conferido' | 'divergente';

export const CAMPOS_AJUSTAVEIS_FATURAMENTO = [
  'dias_mes_fechado', 'dias_trabalhados', 'total_horas', 'horas_falta', 'pl_diurno', 'pl_noturno', 'hora_excedente', 'ad_noturno',
  'bonificacao', 'desc_refeicao', 'desc_estacionamento', 'desc_farmacia', 'reembolso',
] as const;
export type CampoAjustavelFaturamento = (typeof CAMPOS_AJUSTAVEIS_FATURAMENTO)[number];
export type CampoApuracao = CampoAjustavelFaturamento | 'horas_apontadas' | 'horas_escala' | 'horas_previstas' | 'horas_noturnas';

export interface UnidadeFaturamento {
  id: number;
  empresa_id: number;
  nome_unidade: string;
  ativa: number;
  periodo_apuracao: string | null;
  apresentacao_faturamento: string | null;
  vencimento: string | null;
}

export interface ProcessoFaturamento {
  id: number;
  codigo: string;
  competencia: string;
  empresa_id: number;
  nome_empresa: string;
  unidade_id: number | null;
  nome_unidade: string | null;
  cooperativa: string | null;
  centro_custo: string | null;
  periodo_inicio: string;
  periodo_fim: string;
  status: StatusProcessoFaturamento;
  versao_apuracao: number;
  observacao: string | null;
  motivo_status: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  apurado_por_nome: string | null;
  apurado_em: string | null;
  aprovado_por_nome: string | null;
  aprovado_em: string | null;
  total_itens?: number;
  itens_conferidos?: number;
  divergencias_abertas?: number;
  periodo_apuracao?: string | null;
  apresentacao_faturamento?: string | null;
  vencimento?: string | null;
}

export interface AjusteFaturamento {
  id: number;
  chave_item: string;
  campo: CampoAjustavelFaturamento;
  valor: string;
  motivo: string;
  criado_por_nome: string | null;
  criado_em: string;
}

export interface ItemFaturamento extends Record<CampoApuracao, string> {
  id: number;
  chave_item: string;
  alocacao_id: number | null;
  candidato_id: number;
  unidade_id: number | null;
  vaga_id: number | null;
  cooperado_nome: string;
  matricula: string | null;
  atividade: string | null;
  local: string | null;
  tipo_escala: string | null;
  data_inicio: string | null;
  desligamento: string | null;
  dias_mes_total: number;
  parametros_vaga: Record<string, string | number | null> | null;
  /** Avisos da apuração por jornada (não bloqueiam a conferência) */
  avisos: OcorrenciaJornada[];
  status: StatusItemFaturamento;
  conferido_por_nome: string | null;
  conferido_em: string | null;
  ajustes: AjusteFaturamento[];
  valores_finais: Record<CampoApuracao, number>;
}

export interface DivergenciaFaturamento {
  id: number;
  chave_item: string | null;
  origem: 'automatica' | 'manual';
  tipo: string;
  descricao: string;
  status: 'aberta' | 'resolvida' | 'descartada';
  resolucao: string | null;
  criado_por_nome: string | null;
  criado_em: string;
  resolvido_por_nome: string | null;
  resolvido_em: string | null;
}

export interface DetalheProcessoFaturamento {
  processo: ProcessoFaturamento;
  itens: ItemFaturamento[];
  divergencias: DivergenciaFaturamento[];
  totais: Record<CampoApuracao, number>;
  impedimentos_aprovacao: string[];
  regras_pendentes: string[];
}

export interface AuditoriaFaturamento {
  id: number;
  chave_item: string | null;
  acao: string;
  campo: string | null;
  valor_anterior: string | null;
  valor_novo: string | null;
  motivo: string | null;
  usuario_nome: string | null;
  usuario_perfil: string | null;
  criado_em: string;
}

const URL_PROCESSOS = '/supervisao/faturamento/processos';

export function listarUnidadesFaturamento(empresaId: number): Promise<UnidadeFaturamento[]> {
  return apiGet<UnidadeFaturamento[]>(`/supervisao/faturamento/unidades${buildQuery({ empresaId })}`);
}

export function listarProcessosFaturamento(filtros: { competencia?: string; empresaId?: number; status?: string } = {}): Promise<ProcessoFaturamento[]> {
  return apiGet<ProcessoFaturamento[]>(`${URL_PROCESSOS}${buildQuery(filtros)}`);
}

export function criarProcessoFaturamento(dados: { competencia: string; empresaId: number; unidadeId?: number; centroCusto?: string; observacao?: string }): Promise<{ ok: boolean; id: number; codigo: string }> {
  return apiPost(URL_PROCESSOS, dados);
}

export function atualizarProcessoFaturamento(id: number, dados: { centroCusto?: string; observacao?: string }): Promise<{ ok: boolean }> {
  return apiPut(`${URL_PROCESSOS}/${id}`, dados);
}

export function obterProcessoFaturamento(id: number): Promise<DetalheProcessoFaturamento> {
  return apiGet<DetalheProcessoFaturamento>(`${URL_PROCESSOS}/${id}`);
}

export function listarAuditoriaFaturamento(id: number): Promise<AuditoriaFaturamento[]> {
  return apiGet<AuditoriaFaturamento[]>(`${URL_PROCESSOS}/${id}/auditoria`);
}

export function apurarProcessoFaturamento(id: number): Promise<{ ok: boolean; versao: number; itens: number; divergencias: number; avisos: string[] }> {
  return apiPost(`${URL_PROCESSOS}/${id}/apurar`, {});
}

export function conferirItensFaturamento(id: number, itemIds: number[]): Promise<{ ok: boolean; conferidos: number; bloqueados_por_divergencia: number }> {
  return apiPost(`${URL_PROCESSOS}/${id}/conferir`, { itemIds });
}

export function registrarAjusteFaturamento(id: number, itemId: number, dados: { campo: CampoAjustavelFaturamento; valor: string; motivo: string }): Promise<{ ok: boolean }> {
  return apiPost(`${URL_PROCESSOS}/${id}/itens/${itemId}/ajustes`, dados);
}

export function removerAjusteFaturamento(id: number, ajusteId: number, motivo: string): Promise<{ ok: boolean }> {
  return apiDelete(`${URL_PROCESSOS}/${id}/ajustes/${ajusteId}${buildQuery({ motivo })}`);
}

export function registrarDivergenciaFaturamento(id: number, dados: { itemId?: number; descricao: string }): Promise<{ ok: boolean; id: number }> {
  return apiPost(`${URL_PROCESSOS}/${id}/divergencias`, dados);
}

export function resolverDivergenciaFaturamento(id: number, divergenciaId: number, dados: { status: 'resolvida' | 'descartada'; resolucao: string }): Promise<{ ok: boolean }> {
  return apiPost(`${URL_PROCESSOS}/${id}/divergencias/${divergenciaId}/resolver`, dados);
}

export function aprovarProcessoFaturamento(id: number): Promise<{ ok: boolean }> {
  return apiPost(`${URL_PROCESSOS}/${id}/aprovar`, {});
}

export function rejeitarProcessoFaturamento(id: number, motivo: string): Promise<{ ok: boolean }> {
  return apiPost(`${URL_PROCESSOS}/${id}/rejeitar`, { motivo });
}

export function cancelarProcessoFaturamento(id: number, motivo: string): Promise<{ ok: boolean }> {
  return apiPost(`${URL_PROCESSOS}/${id}/cancelar`, { motivo });
}
