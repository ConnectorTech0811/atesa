// Adicional noturno do Parâmetro de Projeto, pela mesma regra do simulador de
// custo por função (CustoPorFuncaoSimulator — "planilha oficial ATESA"):
//   base = remuneração + insalubridade (ou periculosidade)
//   valor = base ÷ horas da escala × 8 h noturnas × 20%
// A insalubridade incide sobre o menor valor entre a remuneração e o salário mínimo;
// periculosidade só entra quando não há insalubridade.

export const PERCENTUAL_ADICIONAL_NOTURNO = 0.2;
export const HORAS_NOTURNAS = 8;
const SALARIO_MINIMO_PADRAO = 1621;

const PERCENTUAL_INSALUBRIDADE: Record<string, number> = {
  pre: 0.2, medio: 0.2, alto: 0.4,
};
const PERCENTUAL_PERICULOSIDADE = 0.3;

export interface VagaAdicionalNoturno {
  salario_base: number | string | null;
  tipo_escala: string;
  adicional_noturno: boolean | number | null;
  insalubridade?: string | null;
  periculosidade?: boolean | number | null;
}

/** Horas que dividem a base: plantão/12x36/procedimento = 12 h por plantão; mensal = 220 h × 21 dias (5x2). */
function fatorEscala(tipoEscala: string): number {
  if (tipoEscala === 'mensal') return (HORAS_NOTURNAS * 21) / 220;
  return HORAS_NOTURNAS / 12;
}

/** Valor do adicional noturno na mesma unidade da remuneração (por plantão ou por mês). 0 se não se aplica. */
export function calcularAdicionalNoturno(v: VagaAdicionalNoturno, salarioMinimo = SALARIO_MINIMO_PADRAO): number {
  const remuneracao = Number(v.salario_base) || 0;
  if (!Number(v.adicional_noturno) && v.adicional_noturno !== true) return 0;
  if (remuneracao <= 0) return 0;

  const pctInsal = PERCENTUAL_INSALUBRIDADE[v.insalubridade ?? ''] ?? 0;
  const insalubridade = Math.min(remuneracao, salarioMinimo) * pctInsal;
  const periculosidade = insalubridade === 0 && Number(v.periculosidade) ? remuneracao * PERCENTUAL_PERICULOSIDADE : 0;

  const base = remuneracao + insalubridade + periculosidade;
  const valor = base * fatorEscala(v.tipo_escala) * PERCENTUAL_ADICIONAL_NOTURNO;
  return Math.round(valor * 100) / 100;
}
