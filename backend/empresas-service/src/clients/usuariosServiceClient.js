import { env } from '../config/env.js';

/** Retorna os executivos da região, em ordem de cadastro (mais antigo primeiro). */
export async function listarExecutivosPorRegiao(regiaoId) {
  const resposta = await fetch(`${env.servicos.usuarios}/usuarios/executivos?regiaoId=${regiaoId}`);
  if (!resposta.ok) throw new Error('Falha ao consultar usuarios-service.');
  return resposta.json();
}
