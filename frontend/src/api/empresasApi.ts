import { apiGet, apiPatch, apiPost } from './httpClient';

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
  tem_alerta?: boolean;
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

export type StatusHistoricoConsultor = 'apresentacao_enviada' | 'ligacao' | 'visita_agendada' | 'visita_cancelada';

export const ROTULO_STATUS_HISTORICO: Record<StatusHistoricoConsultor, string> = {
  apresentacao_enviada: 'Apresentação Enviada',
  ligacao: 'Ligação',
  visita_agendada: 'Visita Agendada',
  visita_cancelada: 'Visita Cancelada',
};

export interface HistoricoItem {
  id: number;
  status: string;
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

export function atualizarTelefoneEmpresa(id: number, telefoneEmpresa: string): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/empresas/${id}`, { telefoneEmpresa });
}

export function registrarHistorico(
  empresaId: number,
  status: StatusHistoricoConsultor,
  dataRegistro: string,
  observacoes: string
): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/empresas/${empresaId}/historico`, { status, dataRegistro, observacoes });
}
