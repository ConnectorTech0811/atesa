/**
 * Leitura mínima de empresas necessária pelo módulo Comercial.
 * Para operações completas de empresas, use o empresas-service.
 */
import { pool } from '../config/database.js';

export async function buscarEmpresaPorId(id) {
  const [linhas] = await pool.query('SELECT id, nome_empresa, executivo_nome FROM empresas WHERE id = ?', [id]);
  return linhas[0] ?? null;
}
