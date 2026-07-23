import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { obterPermissoesEfetivas, MapaPermissoes } from '../api/gruposApi';
import { useAuth } from './AuthContext';

// Funcionalidades e sub-itens existentes no sistema
export const FUNCIONALIDADES = [
  {
    id: 'empresas',
    label: 'Cadastro de Empresas',
    itens: [
      { id: 'empresas.criar', label: 'Criar empresa' },
      { id: 'empresas.editar', label: 'Editar dados da empresa' },
      { id: 'empresas.historico', label: 'Registrar histórico de contato' },
    ],
  },
  {
    id: 'executivo',
    label: 'Painel Executivo',
    itens: [
      { id: 'executivo.trabalhos', label: 'Criar/editar trabalhos' },
      { id: 'executivo.contatos', label: 'Registrar contatos de negócio' },
      { id: 'executivo.proposta', label: 'Gerar proposta comercial (PDF)' },
      { id: 'executivo.parametros', label: 'Editar parâmetros de cálculo' },
      { id: 'executivo.editar_empresa', label: 'Editar dados da empresa no painel' },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda de Reuniões',
    itens: [
      { id: 'agenda.criar', label: 'Agendar reunião' },
      { id: 'agenda.status', label: 'Alterar status de reunião' },
    ],
  },
] as const;

type FuncionalidadeId = string;

interface PermissoesContextType {
  permissoes: MapaPermissoes;
  temPermissao: (funcionalidade: FuncionalidadeId) => boolean;
  recarregar: () => void;
}

const PermissoesContext = createContext<PermissoesContextType | undefined>(undefined);

export const PermissoesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { usuario } = useAuth();
  const [permissoes, setPermissoes] = useState<MapaPermissoes>({});

  const recarregar = useCallback(async () => {
    if (!usuario || usuario.perfil === 'administrador') { setPermissoes({}); return; }
    try {
      const efetivas = await obterPermissoesEfetivas(usuario.id);
      setPermissoes(efetivas);
    } catch {
      setPermissoes({});
    }
  }, [usuario]);

  useEffect(() => { recarregar(); }, [recarregar]);

  // Admin sempre tem tudo; demais: se não há entrada → padrão é true (permitido)
  const temPermissao = (funcionalidade: FuncionalidadeId): boolean => {
    if (usuario?.perfil === 'administrador') return true;
    if (funcionalidade in permissoes) return permissoes[funcionalidade];
    return true;
  };

  return (
    <PermissoesContext.Provider value={{ permissoes, temPermissao, recarregar }}>
      {children}
    </PermissoesContext.Provider>
  );
};

export const usePermissoes = (): PermissoesContextType => {
  const ctx = useContext(PermissoesContext);
  if (!ctx) throw new Error('usePermissoes deve ser usado dentro de PermissoesProvider');
  return ctx;
};
