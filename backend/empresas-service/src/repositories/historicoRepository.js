import { pool } from '../config/database.js';

export async function listarHistoricoPorEmpresa(empresaId) {
  const [linhas] = await pool.query(
    `SELECT id,
            tipo AS status,
            data_registro, observacoes, registrado_por_id, registrado_por_nome, criado_em
     FROM historico_empresa
     WHERE empresa_id = ?
     ORDER BY data_registro DESC, criado_em DESC`,
    [empresaId]
  );
  return linhas;
}

/**
 * registradoPorId/registradoPorNome vêm do token JWT verificado pelo
 * gateway (cabeçalhos internos), nunca do corpo da requisição.
 */
export async function adicionarHistorico(empresaId, { status, dataRegistro, observacoes, registradoPorId, registradoPorNome }) {
  const [resultado] = await pool.query(
    `INSERT INTO historico_empresa (empresa_id, tipo, data_registro, observacoes, registrado_por_id, registrado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [empresaId, status, dataRegistro, observacoes, registradoPorId, registradoPorNome]
  );
  return resultado.insertId;
}
