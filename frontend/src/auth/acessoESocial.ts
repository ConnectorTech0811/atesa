import { useAuth } from './AuthContext';
import { usePermissoes } from './PermissoesContext';

/**
 * Acesso ao eSocial — mesma regra do servidor (beneficios-service/src/routes/esocial.js):
 *  - Módulo "esocial": padrão para Benefícios; outros perfis só se liberados em Permissões e Grupos.
 *    Itens "esocial.enviar", "esocial.importar" e "esocial.configurar" podem ser bloqueados.
 *  - Módulo "esocial_fechamento": padrão para Faturamento; outros perfis só se liberados.
 *    Item "esocial_fechamento.reabrir" controla a reabertura.
 *  - Administrador e Suporte têm acesso total.
 */
export function calcularAcessoESocial(perfil: string | undefined, p: Record<string, boolean>) {
  const total = perfil === 'administrador' || perfil === 'suporte';
  const modulo = total || (perfil === 'beneficios' ? p.esocial !== false : p.esocial === true);
  const item = (id: string) => total || (modulo && p[id] !== false);
  const fechamento = total || (perfil === 'faturamento' ? p.esocial_fechamento !== false : p.esocial_fechamento === true);
  return {
    podeVer: modulo,
    podeEnviar: item('esocial.enviar'),
    podeImportar: item('esocial.importar'),
    podeConfigurar: item('esocial.configurar'),
    podeFechar: fechamento,
    podeReabrir: total || (fechamento && p['esocial_fechamento.reabrir'] !== false),
  };
}

export function useAcessoESocial() {
  const { usuario } = useAuth();
  const { permissoes } = usePermissoes();
  return calcularAcessoESocial(usuario?.perfil, permissoes);
}
