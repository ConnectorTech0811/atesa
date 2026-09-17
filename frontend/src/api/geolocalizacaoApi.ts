import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from './httpClient';

export interface Geolocalizacao {
  id: number;
  nome_local: string;
  empresa_nome?: string | null;
  endereco?: string | null;
  latitude: number;
  longitude: number;
  raio_metros: number;
  bloqueio_ativo: boolean | number;
  mensagem_bloqueio?: string | null;
  criado_em?: string;
  atualizado_em?: string;
}

export interface FiltrosGeolocalizacao {
  busca?: string;
  bloqueio?: 'todos' | 'ativos' | 'inativos';
}

export interface PayloadCriarGeolocalizacao {
  nome_local: string;
  empresa_nome?: string;
  endereco?: string;
  latitude: number;
  longitude: number;
  raio_metros?: number;
  bloqueio_ativo?: boolean;
  mensagem_bloqueio?: string;
}

export interface PayloadAtualizarGeolocalizacao extends Partial<PayloadCriarGeolocalizacao> {}

export async function listarGeolocalizacoes(filtros?: FiltrosGeolocalizacao): Promise<Geolocalizacao[]> {
  const params = new URLSearchParams();
  if (filtros?.busca) params.append('busca', filtros.busca);
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

export async function excluirGeolocalizacao(id: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/ra/geolocalizacoes/${id}`);
}
