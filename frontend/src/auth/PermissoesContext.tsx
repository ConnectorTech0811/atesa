import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { obterPermissoesEfetivas, MapaPermissoes } from '../api/gruposApi';
import { useAuth } from './AuthContext';

// Funcionalidades e sub-itens existentes no sistema
export const FUNCIONALIDADES = [
  {
    id: 'usuarios',
    label: 'Cadastro de Usuários',
    itens: [
      { id: 'usuarios.criar', label: 'Cadastrar novos usuários' },
      { id: 'usuarios.editar', label: 'Editar dados e perfis de usuários' },
      { id: 'usuarios.inativar', label: 'Inativar e reativar usuários' },
      { id: 'usuarios.resetar_senha', label: 'Forçar troca e resetar senha' },
    ],
  },
  {
    id: 'empresas',
    label: 'Cadastro de Empresas',
    itens: [
      { id: 'empresas.criar', label: 'Cadastrar nova empresa / tomador' },
      { id: 'empresas.editar', label: 'Editar dados e filiais da empresa' },
      { id: 'empresas.historico', label: 'Registrar histórico de contato' },
      { id: 'empresas.inativar', label: 'Inativar e reativar empresas' },
    ],
  },
  {
    id: 'executivo',
    label: 'Painel Executivo / Comercial',
    itens: [
      { id: 'executivo.trabalhos', label: 'Criar e editar oportunidades/trabalhos' },
      { id: 'executivo.contatos', label: 'Registrar contatos e histórico comercial' },
      { id: 'executivo.proposta', label: 'Gerar, pré-visualizar e enviar proposta (E-mail / PDF)' },
      { id: 'executivo.parametros', label: 'Editar parâmetros e margens de cálculo' },
      { id: 'executivo.editar_empresa', label: 'Editar dados da empresa no painel comercial' },
    ],
  },
  {
    id: 'agenda',
    label: 'Agenda de Reuniões',
    itens: [
      { id: 'agenda.criar', label: 'Agendar novas reuniões e compromissos' },
      { id: 'agenda.status', label: 'Alterar status e concluir reunião' },
      { id: 'agenda.cancelar', label: 'Cancelar e remover reuniões' },
    ],
  },
  {
    id: 'permissoes',
    label: 'Permissões e Grupos',
    itens: [
      { id: 'permissoes.grupos_criar', label: 'Criar e excluir grupos de acesso' },
      { id: 'permissoes.grupos_editar', label: 'Editar membros e permissões de grupos' },
      { id: 'permissoes.usuarios_editar', label: 'Configurar permissões individuais de usuários' },
    ],
  },
  {
    id: 'parametro',
    label: 'Módulo Parâmetro (Vagas & Postos)',
    itens: [
      { id: 'parametro.unidades', label: 'Cadastrar e gerenciar postos e unidades' },
      { id: 'parametro.vagas', label: 'Criar, editar e ativar/inativar vagas' },
      { id: 'parametro.escalas', label: 'Gerenciar escalas, plantões e periodicidades' },
      { id: 'parametro.exportar', label: 'Exportar dados de vagas em CSV' },
    ],
  },
  {
    id: 'ra',
    label: 'Módulo R&A (Recrutamento & Admissão)',
    itens: [
      { id: 'ra.candidatos_criar', label: 'Cadastrar novo candidato / cooperado' },
      { id: 'ra.candidatos_avaliar', label: 'Avaliar, aprovar ou reprovar candidatos' },
      { id: 'ra.candidatos_inativar', label: 'Inativar e reativar cooperados' },
      { id: 'ra.vagas_visualizar', label: 'Visualizar vagas e fichas de alocação' },
    ],
  },
  {
    id: 'beneficios',
    label: 'Módulo Benefícios',
    itens: [
      { id: 'beneficios.cooperados', label: 'Visualizar lista e ficha completa de cooperados' },
      { id: 'beneficios.alocar', label: 'Alocar cooperados em vagas disponíveis' },
      { id: 'beneficios.encerrar_alocacao', label: 'Encerrar alocações ativas de cooperados' },
      { id: 'beneficios.descontos', label: 'Configurar descontos fixos e cotas mensais' },
      { id: 'beneficios.documentos', label: 'Validar, rejeitar e visualizar documentos' },
      { id: 'beneficios.whatsapp', label: 'Gerar link e reenviar WhatsApp do Portal do Cooperado' },
      { id: 'beneficios.alertas', label: 'Gerenciar e marcar alertas do sistema' },
    ],
  },
  {
    id: 'taxas',
    label: 'Taxas e Impostos',
    itens: [
      { id: 'taxas.visualizar', label: 'Visualizar taxas e tributos configurados' },
      { id: 'taxas.editar', label: 'Editar alíquotas de INSS, ISS, PIS, COFINS e CSLL' },
    ],
  },
] satisfies { id: string; label: string; itens: { id: string; label: string }[] }[];

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

    // Se for sub-item (ex: 'parametro.unidades'), verifica se o módulo pai está desabilitado
    if (funcionalidade.includes('.')) {
      const [moduloPai] = funcionalidade.split('.');
      if (moduloPai in permissoes && !permissoes[moduloPai]) {
        return false;
      }
    }

    if (funcionalidade in permissoes) {
      return Boolean(permissoes[funcionalidade]);
    }

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
