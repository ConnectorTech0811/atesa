/**
 * Acesso às Escalas de plantão — mesma regra do servidor (supervisao-service/src/routes/acesso.js):
 *  - Perfil Escalista: liberado por padrão; só bloqueia se "monitoramento.escalas" for desativado.
 *    É o único acesso do perfil (demais rotas bloqueadas no servidor em shared/restricoesPerfil.js).
 *  - Demais perfis: precisam do módulo "monitoramento" (padrão para Supervisão e Suporte; outros só se
 *    liberados em Permissões e Grupos) e do item "monitoramento.escalas" não bloqueado.
 *  - Administrador tem acesso total.
 */
const PADRAO_MONITORAMENTO = ['administrador', 'supervisao', 'suporte'];

export function calcularAcessoEscalas(perfil: string | undefined, p: Record<string, boolean>): boolean {
  if (perfil === 'administrador') return true;
  if (perfil === 'escalista') return p['monitoramento.escalas'] !== false;
  const modulo = PADRAO_MONITORAMENTO.includes(perfil ?? '') ? p.monitoramento !== false : p.monitoramento === true;
  return modulo && p['monitoramento.escalas'] !== false;
}
