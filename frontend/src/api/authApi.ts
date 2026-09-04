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

export function esqueciSenha(email: string): Promise<{ ok: boolean; mensagem: string }> {
  return apiPost<{ ok: boolean; mensagem: string }>('/auth/esqueci-senha', { email });
}

export function validarTokenReset(token: string): Promise<{ valido: boolean; usuario?: { id: number; nome: string; email: string }; erro?: string }> {
  return apiPost<{ valido: boolean; usuario?: { id: number; nome: string; email: string }; erro?: string }>('/auth/validar-token-reset', { token });
}

export function redefinirSenhaComToken(token: string, novaSenha: string): Promise<{ ok: boolean; mensagem: string }> {
  return apiPost<{ ok: boolean; mensagem: string }>('/auth/redefinir-senha', { token, novaSenha });
}

export function testarEmailSMTP(email?: string): Promise<{ ok: boolean; mensagem: string }> {
  return apiPost<{ ok: boolean; mensagem: string }>('/auth/testar-email', { email });
}
