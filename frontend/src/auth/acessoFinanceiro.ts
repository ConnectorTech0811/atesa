/**
 * Acesso ao módulo Financeiro — mesma regra do servidor (supervisao-service/src/routes/acesso.js):
 *  - Perfil Financeiro: liberado por padrão; itens podem ser bloqueados em Permissões e Grupos.
 *  - Demais perfis: só se o módulo "financeiro" for liberado em Permissões e Grupos.
 *  - Administrador e Suporte têm acesso total, exceto aos itens restritos, que exigem concessão
 *    explícita para qualquer perfil diferente de Administrador.
 */
export const ITENS_FINANCEIRO = [
  'financeiro.recebimentos',
  'financeiro.baixa_manual',
  'financeiro.lancamentos',
  'financeiro.pagamentos',
  'financeiro.excecao_pagamento',
  'financeiro.contas_pagar',
  'financeiro.contas_aprovar',
  'financeiro.consolidacao',
] as const;
export const ITENS_FINANCEIRO_RESTRITOS = ['financeiro.excecao_pagamento'];

export function calcularAcessoFinanceiro(perfil: string | undefined, p: Record<string, boolean>, item = 'financeiro.recebimentos'): boolean {
  if (perfil === 'escalista') return false; // perfil restrito às Escalas
  const modulo = perfil === 'financeiro' ? p.financeiro !== false : p.financeiro === true;
  if (ITENS_FINANCEIRO_RESTRITOS.includes(item)) return perfil === 'administrador' || (modulo && p[item] === true);
  if (perfil === 'administrador' || perfil === 'suporte') return true;
  return modulo && p[item] !== false;
}

/** Vê a tela Financeiro se tiver acesso a pelo menos um item. */
export function podeVerFinanceiro(perfil: string | undefined, p: Record<string, boolean>): boolean {
  return ITENS_FINANCEIRO.some((i) => calcularAcessoFinanceiro(perfil, p, i));
}
