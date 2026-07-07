import { pool } from '../config/database.js';

export async function listarTrabalhosPorEmpresa(empresaId) {
  const [linhas] = await pool.query(
    `SELECT id, titulo, status, executivo_id, executivo_nome, observacoes, criado_em, atualizado_em
     FROM trabalhos WHERE empresa_id = ? ORDER BY criado_em DESC`,
    [empresaId]
  );
  return linhas;
}

export async function buscarTrabalhoPorId(id) {
  const [linhas] = await pool.query('SELECT * FROM trabalhos WHERE id = ?', [id]);
  return linhas[0] ?? null;
}

export async function inserirTrabalho({ empresaId, titulo, executivoId, executivoNome, observacoes }) {
  const [resultado] = await pool.query(
    `INSERT INTO trabalhos (empresa_id, titulo, executivo_id, executivo_nome, observacoes)
     VALUES (?, ?, ?, ?, ?)`,
    [empresaId, titulo, executivoId, executivoNome, observacoes ?? null]
  );
  return resultado.insertId;
}

export async function atualizarTrabalho(id, { titulo, status, observacoes }) {
  await pool.query(
    `UPDATE trabalhos SET titulo = ?, status = ?, observacoes = ?, atualizado_em = NOW() WHERE id = ?`,
    [titulo, status, observacoes ?? null, id]
  );
}
