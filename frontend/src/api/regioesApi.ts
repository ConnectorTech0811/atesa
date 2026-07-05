import { apiGet } from './httpClient';

export interface Regiao {
  id: number;
  nome: string;
}

export function listarRegioes(): Promise<Regiao[]> {
  return apiGet<Regiao[]>('/regioes');
}
