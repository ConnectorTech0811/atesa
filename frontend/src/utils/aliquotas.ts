// Alíquotas de parametros_sistema chegam em dois formatos: fração (seed: 0,0065 = 0,65%) e
// percentual (o que a tela Taxas e Impostos grava ao salvar: 0,65 = 0,65%). Nenhuma alíquota real
// em percentual fica abaixo de 0,5, então abaixo disso é fração. Antes o Painel Executivo usava
// "abaixo de 1" e o PIS salvo como 0,65 virava 65%.
export function aliquotaEmPercentual(valor: unknown, padrao: number): number {
  if (valor === undefined || valor === null || valor === '') return padrao;
  const n = Number(valor);
  if (!Number.isFinite(n)) return padrao;
  if (n > 0 && n < 0.5) return Number((n * 100).toFixed(4));
  return n;
}

/** Propostas salvas com o erro acima ficaram com PIS 65 (%); PIS nunca passa de 10%, então volta para 0,65. */
export function corrigirPisGravadoErrado<T extends { pis_percentual?: number | null }>(p: T): T {
  const pis = Number(p?.pis_percentual);
  if (p && Number.isFinite(pis) && pis >= 10) return { ...p, pis_percentual: Number((pis / 100).toFixed(4)) };
  return p;
}

// Insalubridade por grau (sobre o salário mínimo): Pré 10%, Média 20%, Máxima 40% (Taxas e Impostos).
// A coluna parametros_trabalho.insalubridade_*_pct nasceu com padrão 8/9/11 (valores errados) e as
// propostas antigas ficaram com eles gravados: 1.621 × 8% = 129,68 em vez de 162,10.
export const INSALUBRIDADE_PADRAO = { pre: 10, media: 20, maxima: 40 } as const;
const INSALUBRIDADE_LEGADA = { pre: 8, media: 9, maxima: 11 } as const;

interface PctInsalubridade {
  insalubridade_pre_pct?: number | string | null;
  insalubridade_media_pct?: number | string | null;
  insalubridade_maxima_pct?: number | string | null;
}

/** Troca os percentuais legados (8/9/11) ou vazios pelos de Taxas e Impostos (ou 10/20/40). */
export function corrigirInsalubridadeLegada<T extends PctInsalubridade>(p: T, padroes: PctInsalubridade = {}): T {
  if (!p) return p;
  const corrigir = (atual: unknown, legado: number, padrao: unknown, fixo: number) => {
    const n = Number(atual);
    const usarPadrao = atual === null || atual === undefined || atual === '' || !Number.isFinite(n) || n <= 0 || n === legado;
    if (!usarPadrao) return n;
    const pd = Number(padrao);
    return Number.isFinite(pd) && pd > 0 ? pd : fixo;
  };
  return {
    ...p,
    insalubridade_pre_pct: corrigir(p.insalubridade_pre_pct, INSALUBRIDADE_LEGADA.pre, padroes.insalubridade_pre_pct, INSALUBRIDADE_PADRAO.pre),
    insalubridade_media_pct: corrigir(p.insalubridade_media_pct, INSALUBRIDADE_LEGADA.media, padroes.insalubridade_media_pct, INSALUBRIDADE_PADRAO.media),
    insalubridade_maxima_pct: corrigir(p.insalubridade_maxima_pct, INSALUBRIDADE_LEGADA.maxima, padroes.insalubridade_maxima_pct, INSALUBRIDADE_PADRAO.maxima),
  };
}
