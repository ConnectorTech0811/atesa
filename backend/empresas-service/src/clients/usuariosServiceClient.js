import { env } from '../config/env.js';
import { pool } from '../config/database.js';

/** Retorna os executivos da região, em ordem de cadastro (mais antigo primeiro). */
export async function listarExecutivosPorRegiao(regiaoId) {
  try {
    const resposta = await fetch(`${env.servicos.usuarios}/usuarios/executivos?regiaoId=${regiaoId}`);
    if (resposta.ok) return await resposta.json();
  } catch (_err) {
    // Fallback para consulta direta ao banco (Vercel Serverless / Monolito)
  }

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
