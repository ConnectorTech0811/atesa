import { pool } from '../config/database.js';

export async function listarUsuarios() {
  const [linhas] = await pool.query(`
    SELECT id, nome, email, cpf, telefone, tipo_usuario, eh_executivo, regiao_id, ativo, criado_em
    FROM usuarios
    ORDER BY criado_em DESC
  `);
  return linhas;
}

export async function buscarUsuarioPorEmail(email) {
  const [linhas] = await pool.query('SELECT * FROM usuarios WHERE email = ?', [email]);
  return linhas[0] ?? null;
}

export async function criarUsuario({ nome, email, cpf, telefone, senhaHash, tipoUsuario, ehExecutivo, regiaoId }) {
  const [resultado] = await pool.query(
    `INSERT INTO usuarios (nome, email, cpf, telefone, senha_hash, tipo_usuario, eh_executivo, regiao_id, trocar_senha)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [nome, email, cpf, telefone ?? null, senhaHash, tipoUsuario, ehExecutivo ? 1 : 0, regiaoId]
  );
  return resultado.insertId;
}

/**
 * Lista, em ordem de cadastro, os usuários aptos a atuar como Executivo de
 * Contas em uma região: quem tem tipo_usuario = 'executivo_contas' ou é
 * consultor com a flag eh_executivo marcada. Usado pelo empresas-service
 * para montar a fila do rodízio.
 */
export async function buscarUsuarioPorId(id) {
  const [linhas] = await pool.query(
    'SELECT id, nome, email, cpf, telefone, tipo_usuario, eh_executivo, regiao_id, ativo FROM usuarios WHERE id = ?',
    [id]
  );
  return linhas[0] ?? null;
}

export async function atualizarUsuario(id, { nome, email, telefone, tipoUsuario, regiaoId, ativo }) {
  await pool.query(
    `UPDATE usuarios SET nome = ?, email = ?, telefone = ?, tipo_usuario = ?, regiao_id = ?, ativo = ?, atualizado_em = NOW() WHERE id = ?`,
    [nome, email, telefone ?? null, tipoUsuario, regiaoId, ativo ? 1 : 0, id]
  );
}

export async function atualizarSenha(id, senhaHash) {
  await pool.query(
    'UPDATE usuarios SET senha_hash = ?, trocar_senha = 0, atualizado_em = NOW() WHERE id = ?',
    [senhaHash, id]
  );
}

export async function listarExecutivosPorRegiao(regiaoId) {
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
