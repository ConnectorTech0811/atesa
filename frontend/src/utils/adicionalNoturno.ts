// Valores unitários de insalubridade e adicional noturno de uma vaga do Parâmetro.
// Usados no PDF do Parâmetro e na planilha de faturamento com valores, para os dois baterem.
//
// Insalubridade: sobre o salário mínimo (Pré/Médio 20%, Alto 40%), na unidade da remuneração:
//   mensal = valor do mês; plantão/12x36 = ÷ 15 plantões; procedimento = ÷ 30 dias.
//   (1.621 × 20% ÷ 15 = 21,61 por plantão, como nas planilhas da ATESA.)
// Adicional noturno (expectativa do PDF), pela regra do simulador de custo por função:
//   base = remuneração + insalubridade (ou periculosidade 30%, só sem insalubridade)
//   valor = base ÷ 12 h × 8 h noturnas × 20% (mensal: base ÷ 220 h × 8 h × 21 dias × 20%)

export const PERCENTUAL_ADICIONAL_NOTURNO = 0.2;
export const HORAS_NOTURNAS = 8;
export const SALARIO_MINIMO_PADRAO = 1621;
export const PLANTOES_MES = 15;
export const DIAS_MES = 30;

export const PERCENTUAL_INSALUBRIDADE: Record<string, number> = { pre: 20, medio: 20, alto: 40 };
const PERCENTUAL_PERICULOSIDADE = 0.3;

export interface VagaAdicionalNoturno {
  salario_base: number | string | null;
  tipo_escala: string;
  adicional_noturno: boolean | number | null;
  insalubridade?: string | null;
  periculosidade?: boolean | number | null;
}

/** Insalubridade (R$) na unidade da remuneração da vaga: por plantão, por dia ou por mês. */
export function valorInsalubridadeUnitario(tipoEscala: string, insalubridade: string | null | undefined, salarioMinimo = SALARIO_MINIMO_PADRAO): number {
  const pct = (PERCENTUAL_INSALUBRIDADE[insalubridade ?? ''] ?? 0) / 100;
  const mensal = salarioMinimo * pct;
  if (tipoEscala === 'mensal') return mensal;
  if (tipoEscala === 'por_procedimento') return mensal / DIAS_MES;
  return mensal / PLANTOES_MES;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Valor do adicional noturno na mesma unidade da remuneração (por plantão ou por mês). 0 se não se aplica. */
export function calcularAdicionalNoturno(v: VagaAdicionalNoturno, salarioMinimo = SALARIO_MINIMO_PADRAO): number {
  const remuneracao = Number(v.salario_base) || 0;
  if (!Number(v.adicional_noturno) && v.adicional_noturno !== true) return 0;
  if (remuneracao <= 0) return 0;

  const insalubridade = valorInsalubridadeUnitario(v.tipo_escala, v.insalubridade, salarioMinimo);
  const periculosidade = insalubridade === 0 && Number(v.periculosidade) ? remuneracao * PERCENTUAL_PERICULOSIDADE : 0;

  const base = remuneracao + insalubridade + periculosidade;
  const fator = v.tipo_escala === 'mensal' ? (HORAS_NOTURNAS * 21) / 220 : HORAS_NOTURNAS / 12;
  return r2(base * fator * PERCENTUAL_ADICIONAL_NOTURNO);
}
