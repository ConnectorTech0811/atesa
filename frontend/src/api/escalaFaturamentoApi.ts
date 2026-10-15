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
  data?: string;
  datas?: string[];
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
  pl_diurno: number;
  pl_noturno: number;
  hora_excedente: number;
  ad_noturno: number;
  bonificacao: number;
  desc_refeicao: number;
  desc_estacionamento: number;
  desc_farmacia: number;
  reembolso: number;
}

export interface PlanilhaFaturamento {
  empresa: { id: number; nome: string };
  competencia: string;
  periodo: { inicio: string; fim: string };
  linhas: LinhaFaturamento[];
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

export function gerarPlanilhaFaturamento(filtros: { empresaId: number; competencia: string }): Promise<PlanilhaFaturamento> {
  return apiGet<PlanilhaFaturamento>(`/supervisao/faturamento/planilha${buildQuery(filtros)}`);
}
