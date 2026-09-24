import { pool } from '../config/database.js';

export async function buscarRegiao(regiaoId) {
  if (!regiaoId) return null;
  const [linhas] = await pool.query('SELECT * FROM regioes WHERE id = ?', [regiaoId]);
  return linhas[0] ?? null;
}

