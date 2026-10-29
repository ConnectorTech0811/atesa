import { apiGet, apiPost } from './httpClient';

export type TipoSolicitacaoVaga = 'aumento_quadro' | 'reabertura';
export type StatusSolicitacaoVaga = 'pendente' | 'aprovada' | 'recusada' | 'cancelada';
export type StatusPosicaoVaga = 'aberta' | 'preenchida' | 'cancelada';

export const ROTULO_TIPO_SOLICITACAO: Record<TipoSolicitacaoVaga, string> = {
  aumento_quadro: 'Aumento de quadro',
  reabertura: 'Reabertura (reposição)',
};

export interface SituacaoVaga {
  vaga_id: number;
  cargo: string;
  quantidade: number;
  ativa: boolean;
  unidade_id: number;
  nome_unidade: string;
  empresa_id: number;
  nome_empresa: string;
  ocupadas: number;
  abertas: number;
  pendentes: number;
  sem_cooperado: number;
}

export interface PosicaoVaga {
  id: number;
  solicitacao_id: number;
  vaga_id: number;
  numero: number;
  status: StatusPosicaoVaga;
  candidato_id: number | null;
  cooperado_nome: string | null;
  matricula: string | null;
  observacao: string | null;
  alterado_por_nome: string | null;
  alterado_por_perfil_rotulo: string | null;
  alterado_em: string | null;
}

export interface HistoricoSolicitacaoVaga {
  id: number;
  acao: string;
  acao_rotulo: string;
  descricao: string | null;
  autor_nome: string | null;
  autor_perfil_rotulo: string | null;
  criado_em: string;
}

export interface SolicitacaoVaga {
  id: number;
  empresa_id: number;
  nome_empresa: string;
  unidade_id: number;
  nome_unidade: string | null;
  vaga_id: number;
  cargo: string | null;
  quantidade_atual: number | null;
  tipo: TipoSolicitacaoVaga;
  tipo_rotulo: string;
  quantidade: number;
  motivo: string;
  solicitante_cliente: string | null;
  data_solicitacao: string;
  data_inicio_prevista: string | null;
  status: StatusSolicitacaoVaga;
  quantidade_anterior: number | null;
  quantidade_nova: number | null;
  criado_por_nome: string | null;
  criado_por_perfil_rotulo: string | null;
  criado_em: string;
  decidido_por_nome: string | null;
  decidido_por_perfil_rotulo: string | null;
  decidido_em: string | null;
  observacao_decisao: string | null;
  posicoes: PosicaoVaga[];
  historico: HistoricoSolicitacaoVaga[];
}

export interface CooperadoDaVaga {
  id: number;
  nome: string;
  matricula: string | null;
  data_inicio: string;
}

const qs = (p: Record<string, string | number | undefined>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => { if (v !== undefined && v !== '') s.set(k, String(v)); });
  const t = s.toString();
  return t ? `?${t}` : '';
};

export function listarSituacaoVagas(empresaId?: number): Promise<SituacaoVaga[]> {
  return apiGet<SituacaoVaga[]>(`/supervisao/vagas-solicitacoes/situacao${qs({ empresaId })}`);
}

export function listarSolicitacoesVaga(filtros: { status?: StatusSolicitacaoVaga; empresaId?: number } = {}): Promise<SolicitacaoVaga[]> {
  return apiGet<SolicitacaoVaga[]>(`/supervisao/vagas-solicitacoes${qs(filtros)}`);
}

export function criarSolicitacaoVaga(dados: {
  vagaId: number;
  tipo: TipoSolicitacaoVaga;
  quantidade: number;
  motivo: string;
  solicitanteCliente?: string;
  dataSolicitacao?: string;
  dataInicioPrevista?: string;
}): Promise<{ id: number }> {
  return apiPost<{ id: number }>('/supervisao/vagas-solicitacoes', dados);
}

export function aprovarSolicitacaoVaga(id: number, observacao?: string) {
  return apiPost<{ id: number; quantidadeAnterior: number; quantidadeNova: number }>(`/supervisao/vagas-solicitacoes/${id}/aprovar`, { observacao });
}

export function recusarSolicitacaoVaga(id: number, observacao: string) {
  return apiPost<{ id: number }>(`/supervisao/vagas-solicitacoes/${id}/recusar`, { observacao });
}

export function cancelarSolicitacaoVaga(id: number, observacao: string) {
  return apiPost<{ id: number }>(`/supervisao/vagas-solicitacoes/${id}/cancelar`, { observacao });
}

export function listarCooperadosDaPosicao(posicaoId: number): Promise<CooperadoDaVaga[]> {
  return apiGet<CooperadoDaVaga[]>(`/supervisao/vagas-solicitacoes/posicoes/${posicaoId}/candidatos`);
}

export function alterarPosicaoVaga(posicaoId: number, acao: 'preencher' | 'cancelar' | 'reabrir', dados: { candidatoId?: number; observacao?: string } = {}) {
  return apiPost<{ id: number }>(`/supervisao/vagas-solicitacoes/posicoes/${posicaoId}/${acao}`, dados);
}
