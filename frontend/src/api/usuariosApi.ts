import { apiGet, apiPost, apiPut } from './httpClient';

export type TipoUsuario =
  | 'administrador'
  | 'consultor'
  | 'executivo_contas'
  | 'parametro'
  | 'ra'
  | 'beneficios'
  | 'supervisao'
  | 'faturamento'
  | 'financeiro';

export const TIPOS_USUARIO: { valor: TipoUsuario; rotulo: string }[] = [
  { valor: 'administrador', rotulo: 'Administrador' },
  { valor: 'consultor', rotulo: 'Consultor' },
  { valor: 'executivo_contas', rotulo: 'Executivo de Contas' },
  { valor: 'parametro', rotulo: 'Parâmetro' },
  { valor: 'ra', rotulo: 'RA' },
  { valor: 'beneficios', rotulo: 'Benefícios' },
  { valor: 'supervisao', rotulo: 'Supervisão' },
  { valor: 'faturamento', rotulo: 'Faturamento' },
  { valor: 'financeiro', rotulo: 'Financeiro' },
];

export function rotuloTipoUsuario(tipo: TipoUsuario): string {
  return TIPOS_USUARIO.find((t) => t.valor === tipo)?.rotulo ?? tipo;
}

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  cpf: string;
  telefone: string | null;
  tipo_usuario: TipoUsuario;
  eh_executivo: boolean;
  ativo: boolean;
  regiao_id: number;
  criado_em: string;
}

export interface NovoUsuario {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  senha: string;
  tipoUsuario: TipoUsuario;
  ehExecutivo: boolean;
  regiaoId: number;
}

export function listarUsuarios(): Promise<Usuario[]> {
  return apiGet<Usuario[]>('/usuarios');
}

export interface EdicaoUsuario {
  nome: string;
  email: string;
  telefone: string;
  tipoUsuario: TipoUsuario;
  regiaoId: number;
  ativo: boolean;
}

export function criarUsuario(dados: NovoUsuario): Promise<{ id: number }> {
  return apiPost<{ id: number }>('/usuarios', dados);
}

export function editarUsuario(id: number, dados: EdicaoUsuario): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/usuarios/${id}`, dados);
}
