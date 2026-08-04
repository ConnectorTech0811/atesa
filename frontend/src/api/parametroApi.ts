import { apiGet, apiPatch, apiPost, apiPut } from './httpClient';

export type StatusEmpresaParametro = 'Cadastrado' | 'Ativo' | 'Inativo' | 'Suspenso';
export type TipoEscalaParam = 'mensal' | 'plantao';
export type TipoInsalubridadeParam = 'sem_risco' | 'pre' | 'media' | 'maxima';
export type PeriodicidadeParam = 'diario' | 'semanal' | 'quinzenal' | 'mensal';

export const ROTULO_PERIODICIDADE: Record<PeriodicidadeParam, string> = {
  diario: 'Diário',
  semanal: 'Semanal',
  quinzenal: 'Quinzenal',
  mensal: 'Mensal',
};

export const ROTULO_INSALUBRIDADE_PARAM: Record<TipoInsalubridadeParam, string> = {
  sem_risco: 'Sem risco',
  pre: 'Pré (8%)',
  media: 'Média (9%)',
  maxima: 'Máxima (11%)',
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
  ativa: boolean;
  criado_em: string;
  atualizado_em: string;
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
