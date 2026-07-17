import { apiPatch, apiPost } from './httpClient';
import type { TipoUsuario } from './usuariosApi';

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  tipoUsuario: TipoUsuario;
  regiaoId: number;
}

export interface RespostaLogin {
  token: string;
  trocarSenha?: boolean;
  usuario: UsuarioAutenticado;
}

export function login(email: string, senha: string): Promise<RespostaLogin> {
  return apiPost<RespostaLogin>('/auth/login', { email, senha });
}

export function alterarSenha(usuarioId: number, novaSenha: string): Promise<{ ok: boolean }> {
  return apiPatch<{ ok: boolean }>(`/usuarios/${usuarioId}/senha`, { novaSenha });
}
