import { apiGet, apiPost } from './httpClient';

export interface Empresa {
  id: number;
  cooperativa: string;
  consultor_nome: string | null;
  nome_empresa: string;
  cnpj: string | null;
  cep: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  email_empresa: string;
  telefone_empresa: string;
  representante: string | null;
  regiao_id: number | null;
  regiao_nome: string | null;
  data_primeiro_contato: string | null;
  executivo_id: number | null;
  executivo_nome: string | null;
  status: string;
  aprovada: boolean;
  criado_em: string;
}

export interface NovaEmpresa {
  cooperativa: string;
  consultorNome: string;
  nomeEmpresa: string;
  cnpj: string;
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  emailEmpresa: string;
  telefoneEmpresa: string;
  representante: string;
  regiaoId: number | '';
  dataPrimeiroContato: string;
}

export interface EmpresaParecida {
  id: number;
  nome_empresa: string;
  cnpj: string | null;
  status: string;
}

export type TipoHistorico = 'visita' | 'contato';

export interface HistoricoItem {
  id: number;
  tipo: TipoHistorico;
  data_registro: string;
  observacoes: string;
  registrado_por_id: number;
  registrado_por_nome: string;
  criado_em: string;
}

export function listarEmpresas(): Promise<Empresa[]> {
  return apiGet<Empresa[]>('/empresas');
}

export function buscarEmpresasParecidas(nome: string): Promise<EmpresaParecida[]> {
  return apiGet<EmpresaParecida[]>(`/empresas/buscar?nome=${encodeURIComponent(nome)}`);
}

export function criarEmpresa(dados: NovaEmpresa): Promise<{ id: number; executivoNome: string | null }> {
  return apiPost<{ id: number; executivoNome: string | null }>('/empresas', dados);
}

export function listarHistorico(empresaId: number): Promise<HistoricoItem[]> {
  return apiGet<HistoricoItem[]>(`/empresas/${empresaId}/historico`);
}

export function registrarHistorico(
  empresaId: number,
  tipo: TipoHistorico,
  dataRegistro: string,
  observacoes: string
): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/empresas/${empresaId}/historico`, { tipo, dataRegistro, observacoes });
}
