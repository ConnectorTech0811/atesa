import { pool } from '../config/database.js';

export async function listarRegioes() {
  const [linhas] = await pool.query('SELECT id, nome FROM regioes ORDER BY nome');
  return linhas;
}

export async function buscarRegiaoPorId(id) {
  const [linhas] = await pool.query('SELECT id, nome FROM regioes WHERE id = ?', [id]);
  return linhas[0] ?? null;
}
