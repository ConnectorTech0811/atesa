import { env } from '../config/env.js';
import { pool } from '../config/database.js';

export async function buscarRegiao(regiaoId) {
  try {
    const resposta = await fetch(`${env.servicos.regioes}/regioes/${regiaoId}`);
    if (resposta.status === 404) return null;
    if (resposta.ok) return await resposta.json();
  } catch (_err) {
    // Fallback para consulta direta ao banco (Vercel Serverless / Monolito)
  }

  const [linhas] = await pool.query('SELECT * FROM regioes WHERE id = ?', [regiaoId]);
  return linhas[0] ?? null;
}
