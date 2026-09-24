import { pool } from '../config/database.js';

/** Retorna os executivos da região, em ordem de cadastro (mais antigo primeiro). */
export async function listarExecutivosPorRegiao(regiaoId) {
  if (!regiaoId) return [];
  const [linhas] = await pool.query(
    `SELECT id, nome
     FROM usuarios
     WHERE ativo = TRUE
       AND regiao_id = ?
       AND (tipo_usuario = 'executivo_contas' OR (tipo_usuario = 'consultor' AND eh_executivo = TRUE))
     ORDER BY criado_em ASC`,
    [regiaoId]
  );
  return linhas;
}

