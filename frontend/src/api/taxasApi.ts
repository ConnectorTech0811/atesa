import { apiGet, apiPut } from './httpClient';

export interface TaxasData {
  parametros: Record<string, number>;
  cargos: Record<string, { id: number; cargo: string; ordem: number }[]>;
}

export async function carregarTaxas(): Promise<TaxasData> {
  return apiGet<TaxasData>('/taxas');
}

export async function salvarParametros(atualizacoes: Record<string, number>): Promise<void> {
  await apiPut('/taxas/parametros', atualizacoes);
}

export async function salvarCargos(cooperativa: string, cargos: string[]): Promise<void> {
  await apiPut(`/taxas/cargos/${encodeURIComponent(cooperativa)}`, { cargos });
}
