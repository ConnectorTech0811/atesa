import { apiGet, apiPut, apiPost, apiDelete } from './httpClient';

export interface ResumoCards {
  totalCooperadosAtivos: number;
  cooperadosEmAtividade: number;
  cooperadosSemAtividade: number;
  totalApontamentos: number;
  apontamentosAjustados: number;
  apontamentosDivergentes: number;
  apontamentosPendentes: number;
  horasTrabalhadasHoje: string;
  horasTrabalhadasMinutos: number;
  horasAdicionais?: string;
  adicionalNoturno?: string;
  descontoHoras?: string;
  bonificacoesTotal?: number;
}

export interface ResumoDashboard {
  periodo: { dataInicio: string; dataFim: string };
  cards: ResumoCards;
}

export interface CooperadoAlocacao {
  id: number;
  empresaId: number;
  empresaNome: string;
  unidadeId?: number;
  unidadeNome?: string;
  vagaId?: number;
  vagaCargo?: string;
  vagaEscala?: string;
  salarioBase?: number;
  dataInicio: string;
  dataFim?: string | null;
  status: string;
}

export interface ApontamentoResumo {
  id: number;
  data_referencia: string;
  tipo_evento: string;
  timestamp_dispositivo: string;
  observacao?: string | null;
  status?: string;
  ajustado?: number;
}

export interface CooperadoMonitoramento {
  id: number;
  nome: string;
  cpf: string;
  email?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  matricula?: string | null;
  statusCandidato: number;
  cooperativa: string;
  alocacao: CooperadoAlocacao | null;
  ultimoApontamento: ApontamentoResumo | null;
  totalApontamentosPeriodo: number;
  totalAjustesPeriodo: number;
  situacao: 'em_atividade' | 'ativo' | 'inativo';
}

export interface ApontamentoDetalhado {
  id: number;
  candidato_id: number;
  candidato_nome?: string;
  candidato_cpf?: string;
  candidato_matricula?: string;
  alocacao_id?: number | null;
  vaga_id?: number | null;
  vaga_cargo?: string | null;
  empresa_nome?: string | null;
  unidade_nome?: string | null;
  data_referencia: string;
  tipo_evento: string;
  timestamp_dispositivo: string;
  timestamp_servidor: string;
  latitude?: number | null;
  longitude?: number | null;
  precisao_metros?: number | null;
  endereco_aproximado?: string | null;
  par_indice?: number;
  observacao?: string | null;
  observacao_original?: string | null;
  observacao_ajuste?: string | null;
  status: 'normal' | 'em_andamento' | 'ajustado' | 'divergente' | 'pendente' | string;
  ajustado: number;
  ajustado_por_id?: number | null;
  ajustado_por_nome?: string | null;
  ajustado_em?: string | null;
  motivo_ajuste?: string | null;
  data_original?: string | null;
  timestamp_original?: string | null;
  tipo_evento_original?: string | null;
  origem?: string;
  atividade?: string | null;
  sincronizado_em?: string;
}

export interface HoraComplementar {
  id: number;
  candidato_id: number;
  alocacao_id?: number | null;
  data_referencia: string;
  tipo: 'hora_adicional' | 'hora_extra' | 'adicional_noturno' | 'desconto' | 'bonificacao';
  quantidade_horas?: number | null;
  quantidade_minutos?: number | null;
  valor?: number | null;
  motivo: string;
  observacao?: string | null;
  criado_por_id: number;
  criado_por_nome: string;
  criado_em: string;
  atualizado_em?: string;
}

export interface HistoricoOperacao {
  id: number;
  candidato_id: number;
  alocacao_id: number;
  tipo_alteracao: 'vaga' | 'atividade' | 'turno' | 'tempo' | 'operacao';
  vaga_anterior_id?: number | null;
  vaga_anterior_nome?: string | null;
  vaga_nova_id?: number | null;
  vaga_nova_nome?: string | null;
  turno_anterior?: string | null;
  turno_novo?: string | null;
  atividade_anterior?: string | null;
  atividade_nova?: string | null;
  motivo: string;
  usuario_id: number;
  usuario_nome: string;
  criado_em: string;
}

export interface VagaDisponivel {
  vaga_id: number;
  vaga_cargo: string;
  tipo_escala: string;
  salario_base?: number | null;
  unidade_id: number;
  nome_unidade: string;
  empresa_id: number;
  empresa_nome: string;
}

export interface LogAuditoria {
  id: number;
  apontamento_id: number;
  candidato_id: number;
  candidato_nome: string;
  candidato_cpf?: string;
  candidato_matricula?: string;
  usuario_id: number;
  usuario_nome: string;
  usuario_perfil: string;
  acao: 'criacao' | 'edicao' | 'inclusao_observacao' | 'ajuste';
  campo?: string | null;
  valor_anterior?: string | null;
  valor_novo?: string | null;
  motivo?: string | null;
  ip?: string | null;
  origem?: string;
  criado_em: string;
  apontamento_data?: string;
  apontamento_tipo_evento?: string;
}

export interface DetalhesCooperadoMonitoramento {
  cooperado: {
    id: number;
    nome: string;
    cpf: string;
    email?: string | null;
    telefone?: string | null;
    whatsapp?: string | null;
    matricula?: string | null;
    status: number;
    cooperativa: string;
    alocacao: CooperadoAlocacao | null;
  };
  resumo: {
    totalApontamentos: number;
    totalHoras: string;
    totalMinutos: number;
    totalAjustes: number;
    horasAdicionais: string;
    adicionalNoturno: string;
    descontoHoras: string;
    bonificacoesTotal: number;
    ultimoApontamento: ApontamentoDetalhado | null;
  };
  apontamentos: ApontamentoDetalhado[];
  complementos: HoraComplementar[];
  historicoOperacao: HistoricoOperacao[];
  logsAuditoria: LogAuditoria[];
}

export interface RelatorioPorVagaItem {
  vaga_id: number;
  vaga_cargo: string;
  tipo_escala: string;
  empresa_id: number;
  empresa_nome: string;
  candidato_id: number;
  candidato_nome: string;
  candidato_cpf: string;
  candidato_matricula?: string;
  total_apontamentos: number;
  total_ajustes: number;
}

export interface RelatorioGeralSupervisao {
  periodo: { dataInicio: string; dataFim: string };
  resumo: ResumoDashboard;
  totalCooperadosListados: number;
  cooperados: CooperadoMonitoramento[];
}

export interface FiltrosDashboard {
  periodo?: string;
  dataInicio?: string;
  dataFim?: string;
  candidatoId?: number;
  empresaId?: number;
  status?: string;
}

export interface FiltrosCooperados {
  busca?: string;
  status?: string | number;
  empresaId?: number;
  vagaId?: number;
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
  pagina?: number;
}

export interface FiltrosApontamentos {
  busca?: string;
  candidatoId?: number;
  empresaId?: number;
  vagaId?: number;
  tipoEvento?: string;
  status?: string;
  apenasAjustados?: boolean;
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
  pagina?: number;
}

export interface FiltrosLogs {
  busca?: string;
  candidatoId?: number;
  usuarioId?: number;
  acao?: string;
  dataInicio?: string;
  dataFim?: string;
  limite?: number;
  pagina?: number;
}

export interface DadosEdicaoApontamento {
  dataReferencia?: string;
  timestampDispositivo?: string;
  tipoEvento?: string;
  atividade?: string;
  observacao?: string;
  motivo: string;
  status?: string;
}

export interface DadosLancamentoComplemento {
  dataReferencia: string;
  tipo: 'hora_adicional' | 'hora_extra' | 'adicional_noturno' | 'desconto' | 'bonificacao';
  quantidadeHoras?: number;
  quantidadeMinutos?: number;
  valor?: number;
  motivo: string;
  observacao?: string;
  alocacaoId?: number;
}

export interface DadosAlteracaoOperacao {
  novaVagaId?: number;
  novaAtividade?: string;
  novoTurno?: string;
  motivo: string;
}

function buildQuery(params: Record<string, any>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') {
      q.append(k, String(v));
    }
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

// ── Funções de API ───────────────────────────────────────────────────────────

export function obterResumoDashboard(filtros: FiltrosDashboard = {}): Promise<ResumoDashboard> {
  return apiGet<ResumoDashboard>(`/supervisao/dashboard${buildQuery(filtros)}`);
}

export function listarCooperadosMonitoramento(filtros: FiltrosCooperados = {}): Promise<CooperadoMonitoramento[]> {
  return apiGet<CooperadoMonitoramento[]>(`/supervisao/cooperados${buildQuery(filtros)}`);
}

export function obterDetalhesCooperadoMonitoramento(id: number, filtros: { dataInicio?: string; dataFim?: string } = {}): Promise<DetalhesCooperadoMonitoramento> {
  return apiGet<DetalhesCooperadoMonitoramento>(`/supervisao/cooperados/${id}${buildQuery(filtros)}`);
}

export function listarTodosApontamentos(filtros: FiltrosApontamentos = {}): Promise<ApontamentoDetalhado[]> {
  return apiGet<ApontamentoDetalhado[]>(`/supervisao/apontamentos${buildQuery(filtros)}`);
}

export function obterApontamentoPorId(id: number): Promise<ApontamentoDetalhado> {
  return apiGet<ApontamentoDetalhado>(`/supervisao/apontamentos/${id}`);
}

export function editarApontamentoMonitoramento(id: number, dados: DadosEdicaoApontamento): Promise<{ ok: boolean; id: number; mensagem: string }> {
  return apiPut<{ ok: boolean; id: number; mensagem: string }>(`/supervisao/apontamentos/${id}`, dados);
}

export function adicionarObservacaoApontamento(id: number, dados: { observacao: string; motivo?: string; ehAjuste?: boolean }): Promise<{ ok: boolean; id: number }> {
  return apiPost<{ ok: boolean; id: number }>(`/supervisao/apontamentos/${id}/observacao`, dados);
}

export function criarComplementoCooperado(candidatoId: number, dados: DadosLancamentoComplemento): Promise<{ ok: boolean; id: number }> {
  return apiPost<{ ok: boolean; id: number }>(`/supervisao/cooperados/${candidatoId}/complementos`, dados);
}

export function excluirComplemento(id: number, motivo: string): Promise<{ ok: boolean; id: number }> {
  return apiDelete<{ ok: boolean; id: number }>(`/supervisao/complementos/${id}`);
}

export function listarVagasDisponiveis(): Promise<VagaDisponivel[]> {
  return apiGet<VagaDisponivel[]>('/supervisao/vagas-disponiveis');
}

export function alterarOperacaoCooperado(candidatoId: number, dados: DadosAlteracaoOperacao): Promise<{ ok: boolean; mensagem: string }> {
  return apiPost<{ ok: boolean; mensagem: string }>(`/supervisao/cooperados/${candidatoId}/alterar-operacao`, dados);
}

export function solicitarResetSenhaCooperado(candidatoId: number): Promise<{ ok: boolean; mensagem: string }> {
  return apiPost<{ ok: boolean; mensagem: string }>(`/supervisao/cooperados/${candidatoId}/solicitar-reset-senha`, {});
}

export function confirmarResetSenhaCooperado(dados: { candidatoId: number; codigo: string; novaSenha: string }): Promise<{ ok: boolean; mensagem: string }> {
  return apiPost<{ ok: boolean; mensagem: string }>('/supervisao/cooperados/confirmar-reset-senha', dados);
}

export function obterRelatorioIndividual(candidatoId: number, filtros: { dataInicio?: string; dataFim?: string } = {}): Promise<DetalhesCooperadoMonitoramento> {
  return apiGet<DetalhesCooperadoMonitoramento>(`/supervisao/relatorios/individual/${candidatoId}${buildQuery(filtros)}`);
}

export function obterRelatorioPorVaga(filtros: { vagaId?: number; empresaId?: number; dataInicio?: string; dataFim?: string } = {}): Promise<RelatorioPorVagaItem[]> {
  return apiGet<RelatorioPorVagaItem[]>(`/supervisao/relatorios/por-vaga${buildQuery(filtros)}`);
}

export function obterRelatorioGeralSupervisao(filtros: { empresaId?: number; vagaId?: number; dataInicio?: string; dataFim?: string } = {}): Promise<RelatorioGeralSupervisao> {
  return apiGet<RelatorioGeralSupervisao>(`/supervisao/relatorios/geral${buildQuery(filtros)}`);
}

export function listarLogsAuditoriaMonitoramento(filtros: FiltrosLogs = {}): Promise<LogAuditoria[]> {
  return apiGet<LogAuditoria[]>(`/supervisao/logs${buildQuery(filtros)}`);
}
