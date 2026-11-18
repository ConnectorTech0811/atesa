import { apiGet } from './httpClient';

export interface ClienteCarteira {
  id: number;
  nome_empresa: string;
  cnpj: string | null;
  cpf: string | null;
  status: string | null;
  cidade: string | null;
  uf: string | null;
  regiao_nome: string | null;
  telefone_empresa: string | null;
  representante: string | null;
  executivo_nome: string | null;
  supervisor_id: number | null;
  proxima_visita: string | null;
  ultima_visita: string | null;
}

export interface SupervisorCarteira {
  id: number;
  nome: string;
  email: string | null;
  telefone: string | null;
  regiao_id: number | null;
  regiao_nome: string | null;
  ativo: boolean;
  clientes: ClienteCarteira[];
}

export interface CarteiraSupervisores {
  supervisores: SupervisorCarteira[];
  /** Clientes com Negócio Fechado ainda sem supervisor do pós-venda. */
  semSupervisor: ClienteCarteira[];
}

/** Clientes que cada supervisor atende (supervisor do pós-venda definido no Parâmetro). */
export const obterCarteiraSupervisores = () => apiGet<CarteiraSupervisores>('/supervisao/carteira-supervisores');
