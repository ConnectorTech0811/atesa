import { apiDelete, apiGet, apiPost, apiPut } from './httpClient';

// ── Escalistas × clientes (Cadastro de Usuários → Escalistas) ───────────────
export interface ClienteLiberado {
  empresa_id: number;
  nome_empresa: string;
  regiao_id: number | null;
  regiao_nome: string | null;
  liberado_por_nome?: string | null;
  liberado_por_perfil?: string | null;
  criado_em?: string;
}

export interface Escalista {
  id: number;
  nome: string;
  email: string;
  ativo: boolean;
  regiao_id: number | null;
  regiao_nome: string | null;
  /** Acesso a todos os clientes, independentemente da região. */
  todos_clientes: boolean;
  /** Quantidade de clientes da região da escalista (acesso automático). */
  clientes_regiao: number;
  clientes_liberados: ClienteLiberado[];
}

export interface HistoricoEscalista {
  id: number;
  acao: 'cliente_liberado' | 'cliente_removido' | 'todos_liberado' | 'todos_removido';
  empresa_id: number | null;
  nome_empresa: string | null;
  autor_nome: string | null;
  autor_perfil: string | null;
  criado_em: string;
}

export interface DetalheEscalista extends Omit<Escalista, 'clientes_regiao'> {
  clientes_regiao: { empresa_id: number; nome_empresa: string }[];
  clientes_disponiveis: ClienteLiberado[];
  historico: HistoricoEscalista[];
}

export function listarEscalistas(): Promise<Escalista[]> {
  return apiGet<Escalista[]>('/supervisao/escalistas');
}

export function detalharEscalista(id: number): Promise<DetalheEscalista> {
  return apiGet<DetalheEscalista>(`/supervisao/escalistas/${id}`);
}

export function liberarClienteEscalista(id: number, empresaId: number): Promise<DetalheEscalista> {
  return apiPost<DetalheEscalista>(`/supervisao/escalistas/${id}/clientes`, { empresaId });
}

export function removerClienteEscalista(id: number, empresaId: number): Promise<DetalheEscalista> {
  return apiDelete<DetalheEscalista>(`/supervisao/escalistas/${id}/clientes/${empresaId}`);
}

export function definirTodosClientesEscalista(id: number, todos: boolean): Promise<DetalheEscalista> {
  return apiPut<DetalheEscalista>(`/supervisao/escalistas/${id}/todos-clientes`, { todos });
}
