import React, { createContext, useContext, useState } from 'react';
import { login as loginApi, type UsuarioAutenticado } from '../api/authApi';
import { limparToken, salvarToken } from '../api/httpClient';
import type { TipoUsuario } from '../api/usuariosApi';

export interface Usuario {
  id: number;
  nome: string;
  email: string;
  perfil: TipoUsuario;
}

interface AuthContextType {
  usuario: Usuario | null;
  login: (email: string, senha: string) => Promise<{ sucesso: boolean; erro?: string }>;
  logout: () => void;
}

const STORAGE_KEY = 'atesa_usuario_logado';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function converterUsuario(usuarioApi: UsuarioAutenticado): Usuario {
  return {
    id: usuarioApi.id,
    nome: usuarioApi.nome,
    email: usuarioApi.email,
    perfil: usuarioApi.tipoUsuario,
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [usuario, setUsuario] = useState<Usuario | null>(() => {
    const salvo = localStorage.getItem(STORAGE_KEY);
    return salvo ? JSON.parse(salvo) : null;
  });

  const login = async (email: string, senha: string) => {
    try {
      const resposta = await loginApi(email, senha);
      const usuarioConvertido = converterUsuario(resposta.usuario);
      salvarToken(resposta.token);
      setUsuario(usuarioConvertido);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(usuarioConvertido));
      return { sucesso: true };
    } catch (erro) {
      return { sucesso: false, erro: erro instanceof Error ? erro.message : 'Erro ao entrar.' };
    }
  };

  const logout = () => {
    setUsuario(null);
    localStorage.removeItem(STORAGE_KEY);
    limparToken();
  };

  return <AuthContext.Provider value={{ usuario, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};
