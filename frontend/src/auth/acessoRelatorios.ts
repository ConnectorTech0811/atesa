import { calcularAcessoFaturamento } from './acessoFaturamento';
import { calcularAcessoFinanceiro } from './acessoFinanceiro';

/** Relatórios financeiros permitidos — mesma regra do servidor (routes/financeiro.js, PERMISSAO_RELATORIO). */
export function relatoriosPermitidos(perfil: string | undefined, p: Record<string, boolean>): string[] {
  const fat = calcularAcessoFaturamento(perfil, p);
  const rec = calcularAcessoFinanceiro(perfil, p, 'financeiro.recebimentos');
  const regras: Record<string, boolean> = {
    faturamento: fat || rec,
    notas: fat || rec,
    cobrancas: fat || rec,
    inadimplencia: fat || rec,
    recebimentos: rec,
    conciliacao: rec,
    pagamentos_cooperados: calcularAcessoFinanceiro(perfil, p, 'financeiro.pagamentos'),
    contas_pagar: calcularAcessoFinanceiro(perfil, p, 'financeiro.contas_pagar'),
    consolidacao: calcularAcessoFinanceiro(perfil, p, 'financeiro.consolidacao'),
  };
  return Object.keys(regras).filter((k) => regras[k]);
}
