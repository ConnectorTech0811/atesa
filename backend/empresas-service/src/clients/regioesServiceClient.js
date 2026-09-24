import { pool } from '../config/database.js';

export async function buscarRegiao(regiaoId, conexao = pool) {
  if (!regiaoId) return null;
  const [linhas] = await conexao.query('SELECT * FROM regioes WHERE id = ?', [regiaoId]);
  return linhas[0] ?? null;
}


