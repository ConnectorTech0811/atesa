import { env } from '../config/env.js';

export async function buscarRegiao(regiaoId) {
  const resposta = await fetch(`${env.servicos.regioes}/regioes/${regiaoId}`);
  if (resposta.status === 404) return null;
  if (!resposta.ok) throw new Error('Falha ao consultar regioes-service.');
  return resposta.json();
}
