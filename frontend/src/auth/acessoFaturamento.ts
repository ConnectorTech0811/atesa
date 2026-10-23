/**
 * Acesso à tela de Faturamento — mesma regra do servidor (supervisao-service/src/routes/supervisao.js):
 *  - Perfil Faturamento: liberado por padrão; só bloqueia se "monitoramento.faturamento" for desativado.
 *  - Demais perfis: precisam do módulo "monitoramento" (padrão para Supervisão e Suporte; outros só se
 *    liberados em Permissões e Grupos) e do item "monitoramento.faturamento" não bloqueado.
 *  - Administrador tem acesso total.
 */
const PADRAO_MONITORAMENTO = ['administrador', 'supervisao', 'suporte'];

export function calcularAcessoFaturamento(perfil: string | undefined, p: Record<string, boolean>): boolean {
  if (perfil === 'administrador') return true;
  if (perfil === 'escalista') return false; // perfil restrito às Escalas
  if (perfil === 'faturamento') return p['monitoramento.faturamento'] !== false;
  const modulo = PADRAO_MONITORAMENTO.includes(perfil ?? '') ? p.monitoramento !== false : p.monitoramento === true;
  return modulo && p['monitoramento.faturamento'] !== false;
}
