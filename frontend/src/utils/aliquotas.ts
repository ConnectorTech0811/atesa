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
