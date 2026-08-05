import { apiGet, apiPatch, apiPost, apiPut } from './httpClient';
import {
  TipoEscala,
  TipoInsalubridade,
  ROTULO_INSALUBRIDADE,
  ROTULO_ESCALA,
} from './executivoApi';

// Re-exporta tipos unificados para uso no módulo Parâmetro
export type { TipoEscala, TipoInsalubridade };
export { ROTULO_INSALUBRIDADE, ROTULO_ESCALA };

// Alias para backward-compat nos componentes existentes
export type TipoEscalaParam = TipoEscala;
export type TipoInsalubridadeParam = TipoInsalubridade;
/** @deprecated use ROTULO_INSALUBRIDADE */
export const ROTULO_INSALUBRIDADE_PARAM = ROTULO_INSALUBRIDADE;

export type StatusEmpresaParametro = 'Cadastrado' | 'Ativo' | 'Inativo' | 'Suspenso';
export type PeriodicidadeParam = 'diario' | 'semanal' | 'quinzenal' | 'mensal';
export type RecebePorParam = 'dia' | 'mes';
export type StatusAgendaParam = 'previsto' | 'confirmado' | 'cancelado' | 'feriado';

export const ROTULO_PERIODICIDADE: Record<PeriodicidadeParam, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};

export interface EmpresaResumoParametro {
  id: number;
  nome_empresa: string;
  cnpj: string | null;
  cpf: string | null;
  status: string;
  executivo_nome: string | null;
  regiao_nome: string | null;
  criado_em: string;
  total_unidades: number;
  unidades_ativas: number;
}

export interface VagaParametro {
  id: number;
  unidade_id: number;
  cargo: string;
  quantidade: number;
  salario_base: number | null;
  tipo_escala: TipoEscalaParam;
  adicional_noturno: boolean;
  periculosidade: boolean;
  insalubridade: TipoInsalubridadeParam;
  premio_incentivo: number;
  valor_vr_dia: number;
  valor_vt_dia: number;
  dsr_percentual: number;
  periodicidade: PeriodicidadeParam;
  tempo_pausa: number | null;
  tempo_refeicao: number | null;
  desconta_pausa: boolean;
  desconta_refeicao: boolean;
  recebe_por: RecebePorParam;
  data_inicio: string | null;
  ativa: boolean;
  criado_em: string;
  atualizado_em: string;
}

export interface AgendaItem {
  id: number;
  vaga_id: number;
  data_operacao: string;
  status: StatusAgendaParam;
  observacoes: string | null;
  validado_por_nome: string | null;
  validado_em: string | null;
}

export interface AtividadePrimaria {
  id: number;
  cargo: string;
  quantidade: number;
  salario_base: number | null;
  tipo_escala: TipoEscalaParam;
  adicional_noturno: boolean;
  periculosidade: boolean;
  insalubridade: TipoInsalubridadeParam;
  premio_incentivo: number | null;
  vr_dias: number | null;
  vt_dias: number | null;
  trabalho_id: number;
  trabalho_titulo: string;
}

export interface UnidadeParametro {
  id: number;
  empresa_id: number;
  nome_unidade: string;
  endereco: string | null;
  contato_responsavel: string | null;
  observacoes: string | null;
  ativa: boolean;
  criado_por_nome: string;
  criado_em: string;
  atualizado_em: string;
  vagas: VagaParametro[];
}

export interface EmpresaDetalheParametro {
  id: number;
  nome_empresa: string;
  cnpj: string | null;
  cpf: string | null;
  status: string;
  executivo_nome: string | null;
  regiao_nome: string | null;
  email_empresa: string;
  telefone_empresa: string | null;
  whatsapp: string | null;
  representante: string | null;
  criado_em: string;
  unidades: UnidadeParametro[];
}

export interface LogAcao {
  id: number;
  empresa_id: number;
  unidade_id: number | null;
  vaga_id: number | null;
  usuario_id: number;
  usuario_nome: string;
  acao: string;
  descricao: string;
  dados_anteriores: Record<string, unknown> | null;
  dados_novos: Record<string, unknown> | null;
  criado_em: string;
}

export interface NovaVaga {
  cargo: string;
  quantidade: number;
  salarioBase?: number;
  tipoEscala: TipoEscalaParam;
  adicionalNoturno: boolean;
  periculosidade: boolean;
  insalubridade: TipoInsalubridadeParam;
  premioIncentivo?: number;
  valorVrDia?: number;
  valorVtDia?: number;
  dsrPercentual?: number;
  periodicidade: PeriodicidadeParam;
  tempoPausa?: number;
  tempoRefeicao?: number;
  descontaPausa?: boolean;
  descontaRefeicao?: boolean;
  recebePor?: RecebePorParam;
  dataInicio?: string;
}

export interface Incremento {
  id: number;
  vaga_id: number;
  quantidade_anterior: number;
  quantidade_nova: number;
  motivo: string | null;
  registrado_por_nome: string;
  data_incremento: string;
  criado_em: string;
}

// ── Empresas ──────────────────────────────────────────────────────────────────

export function listarEmpresasParametro(): Promise<EmpresaResumoParametro[]> {
  return apiGet<EmpresaResumoParametro[]>('/parametro/empresas');
}

export function obterEmpresaParametro(id: number): Promise<EmpresaDetalheParametro> {
  return apiGet<EmpresaDetalheParametro>(`/parametro/empresas/${id}`);
}

export function alterarStatusEmpresaParametro(id: number, status: string): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/parametro/empresas/${id}/status`, { status });
}

export function listarLogEmpresa(id: number): Promise<LogAcao[]> {
  return apiGet<LogAcao[]>(`/parametro/empresas/${id}/log`);
}

// ── Unidades ──────────────────────────────────────────────────────────────────

export function criarUnidade(
  empresaId: number,
  dados: { nomeUnidade: string; endereco?: string; contatoResponsavel?: string; observacoes?: string }
): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/parametro/empresas/${empresaId}/unidades`, dados);
}

export function atualizarUnidade(
  unidadeId: number,
  empresaId: number,
  dados: { nomeUnidade: string; endereco?: string; contatoResponsavel?: string; observacoes?: string }
): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/parametro/unidades/${unidadeId}`, { ...dados, empresaId });
}

export function alternarAtivacaoUnidade(unidadeId: number, empresaId: number, ativa: boolean): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/parametro/unidades/${unidadeId}/ativacao`, { ativa, empresaId });
}

// ── Vagas ─────────────────────────────────────────────────────────────────────

export function criarVaga(unidadeId: number, empresaId: number, dados: NovaVaga): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/parametro/unidades/${unidadeId}/vagas`, { ...dados, empresaId });
}

export function atualizarVaga(vagaId: number, unidadeId: number, empresaId: number, dados: NovaVaga): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/parametro/vagas/${vagaId}`, { ...dados, empresaId, unidadeId });
}

export function registrarIncremento(
  vagaId: number,
  unidadeId: number,
  empresaId: number,
  dados: { delta: number; motivo?: string; dataIncremento: string }
): Promise<{ quantidadeAnterior: number; quantidadeNova: number }> {
  return apiPost(`/parametro/vagas/${vagaId}/incremento`, { ...dados, empresaId, unidadeId });
}

export function listarIncrementos(vagaId: number): Promise<Incremento[]> {
  return apiGet<Incremento[]>(`/parametro/vagas/${vagaId}/incrementos`);
}

export function alternarAtivacaoVaga(vagaId: number, unidadeId: number, empresaId: number, ativa: boolean): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/parametro/vagas/${vagaId}/ativacao`, { ativa, empresaId, unidadeId });
}

// ── Agenda ────────────────────────────────────────────────────────────────────

export function listarAgendaVaga(vagaId: number): Promise<AgendaItem[]> {
  return apiGet<AgendaItem[]>(`/parametro/vagas/${vagaId}/agenda`);
}

export function atualizarStatusAgenda(agendaId: number, status: StatusAgendaParam, observacoes?: string): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/parametro/agenda/${agendaId}/status`, { status, observacoes });
}

export function regerarAgendaVaga(vagaId: number, unidadeId: number, empresaId: number, tipoEscala: TipoEscalaParam, dataInicio: string): Promise<{ ok: boolean; total: number }> {
  return apiPost(`/parametro/vagas/${vagaId}/agenda/regerar`, { unidadeId, empresaId, tipoEscala, dataInicio });
}

// ── Cadastro primário ─────────────────────────────────────────────────────────

export function listarAtividadesPrimarias(empresaId: number): Promise<AtividadePrimaria[]> {
  return apiGet<AtividadePrimaria[]>(`/parametro/empresas/${empresaId}/atividades-primarias`);
}
