import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './httpClient';

export interface Geolocalizacao {
  id: number;
  empresa_id?: number | null;
  empresa_nome?: string | null;
  unidade_id?: number | null;
  nome_local: string;
  candidato_id?: number | null;
  candidato_nome?: string | null;
  candidato_matricula?: string | null;
  endereco?: string | null;
  latitude: number;
  longitude: number;
  raio_metros: number;
  excecao: boolean | number;
  bloqueio_ativo: boolean | number;
  mensagem_bloqueio?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface ClienteHierarquia {
  id: number;
  nome_empresa: string;
  razao_social?: string | null;
  cnpj?: string | null;
  status?: string;
}

export interface UnidadeHierarquia {
  id: number;
  empresa_id: number;
  nome_unidade: string;
  endereco?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  nome_empresa?: string;
}

export interface CooperadoHierarquia {
  id: number;
  nome: string;
  cpf?: string | null;
  matricula?: string | null;
  latitude?: string | number | null;
  longitude?: string | number | null;
  empresa_id?: number | null;
  unidade_id?: number | null;
  alocacao_id?: number | null;
  cargo?: string | null;
  nome_empresa?: string | null;
  nome_unidade?: string | null;
}

export interface HierarquiaGeolocalizacao {
  empresas: ClienteHierarquia[];
  unidades: UnidadeHierarquia[];
  cooperados: CooperadoHierarquia[];
}

export interface FiltrosGeolocalizacao {
  busca?: string;
  empresaId?: number | string;
  unidadeId?: number | string;
  candidatoId?: number | string;
  bloqueio?: 'todos' | 'ativos' | 'inativos';
}

export interface PayloadCriarGeolocalizacao {
  empresa_id?: number | null;
  empresa_nome?: string | null;
  unidade_id?: number | null;
  nome_local: string;
  candidato_id?: number | null;
  candidato_nome?: string | null;
  candidato_matricula?: string | null;
  endereco?: string | null;
  latitude: number;
  longitude: number;
  raio_metros?: number;
  excecao?: boolean | number;
  bloqueio_ativo?: boolean;
  mensagem_bloqueio?: string | null;
}

export interface PayloadAtualizarGeolocalizacao extends Partial<PayloadCriarGeolocalizacao> {}

export async function listarHierarquiaGeolocalizacao(): Promise<HierarquiaGeolocalizacao> {
  return apiGet<HierarquiaGeolocalizacao>('/ra/geolocalizacoes/hierarquia');
}

export async function listarGeolocalizacoes(filtros?: FiltrosGeolocalizacao): Promise<Geolocalizacao[]> {
  const params = new URLSearchParams();
  if (filtros?.busca) params.append('busca', filtros.busca);
  if (filtros?.empresaId) params.append('empresaId', String(filtros.empresaId));
  if (filtros?.unidadeId) params.append('unidadeId', String(filtros.unidadeId));
  if (filtros?.candidatoId) params.append('candidatoId', String(filtros.candidatoId));
  if (filtros?.bloqueio && filtros.bloqueio !== 'todos') params.append('bloqueio', filtros.bloqueio);
  const qs = params.toString();
  return apiGet<Geolocalizacao[]>(`/ra/geolocalizacoes${qs ? `?${qs}` : ''}`);
}

export async function criarGeolocalizacao(dados: PayloadCriarGeolocalizacao): Promise<{ id: number }> {
  return apiPost<{ id: number }>('/ra/geolocalizacoes', dados);
}

export async function atualizarGeolocalizacao(id: number, dados: PayloadAtualizarGeolocalizacao): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/ra/geolocalizacoes/${id}`, dados);
}

export async function alternarBloqueioGeolocalizacao(id: number, bloqueio_ativo: boolean): Promise<{ ok: boolean; bloqueio_ativo: boolean }> {
  return apiPatch<{ ok: boolean; bloqueio_ativo: boolean }>(`/ra/geolocalizacoes/${id}/bloqueio`, { bloqueio_ativo });
}

export async function alternarExcecaoGeolocalizacao(id: number, excecao: boolean): Promise<{ ok: boolean; excecao: boolean }> {
  return apiPatch<{ ok: boolean; excecao: boolean }>(`/ra/geolocalizacoes/${id}/excecao`, { excecao });
}

export async function excluirGeolocalizacao(id: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/ra/geolocalizacoes/${id}`);
}
