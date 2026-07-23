import { apiDelete, apiGet, apiPost, apiPut } from './httpClient';

export interface Grupo {
  id: number;
  nome: string;
  descricao: string | null;
  total_membros: number;
  criado_em: string;
}

export interface MembroGrupo {
  id: number;
  nome: string;
  email: string;
  tipo_usuario: string;
  ativo: boolean;
}

export type MapaPermissoes = Record<string, boolean>;

export function listarGrupos(): Promise<Grupo[]> {
  return apiGet<Grupo[]>('/grupos');
}

export function criarGrupo(dados: { nome: string; descricao?: string }): Promise<{ id: number }> {
  return apiPost<{ id: number }>('/grupos', dados);
}

export function atualizarGrupo(id: number, dados: { nome: string; descricao?: string }): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/grupos/${id}`, dados);
}

export function excluirGrupo(id: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/grupos/${id}`);
}

export function listarMembros(grupoId: number): Promise<MembroGrupo[]> {
  return apiGet<MembroGrupo[]>(`/grupos/${grupoId}/membros`);
}

export function adicionarMembro(grupoId: number, usuarioId: number): Promise<{ ok: boolean }> {
  return apiPost<{ ok: boolean }>(`/grupos/${grupoId}/membros`, { usuarioId });
}

export function removerMembro(grupoId: number, usuarioId: number): Promise<{ ok: boolean }> {
  return apiDelete<{ ok: boolean }>(`/grupos/${grupoId}/membros/${usuarioId}`);
}

export function obterPermissoesGrupo(grupoId: number): Promise<MapaPermissoes> {
  return apiGet<MapaPermissoes>(`/grupos/${grupoId}/permissoes`);
}

export function salvarPermissoesGrupo(grupoId: number, permissoes: MapaPermissoes): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/grupos/${grupoId}/permissoes`, permissoes);
}

export function obterPermissoesUsuario(usuarioId: number): Promise<MapaPermissoes> {
  return apiGet<MapaPermissoes>(`/usuarios/${usuarioId}/permissoes`);
}

export function salvarPermissoesUsuario(usuarioId: number, permissoes: MapaPermissoes): Promise<{ ok: boolean }> {
  return apiPut<{ ok: boolean }>(`/usuarios/${usuarioId}/permissoes`, permissoes);
}

export function obterPermissoesEfetivas(usuarioId: number): Promise<MapaPermissoes> {
  return apiGet<MapaPermissoes>(`/usuarios/${usuarioId}/permissoes-efetivas`);
}
