import { pool } from '../config/database.js';

// ── Grupos ────────────────────────────────────────────────────────────────────

export async function listarGrupos() {
  const [linhas] = await pool.query(
    `SELECT g.*, COUNT(ug.usuario_id) AS total_membros
     FROM grupos g
     LEFT JOIN usuarios_grupos ug ON ug.grupo_id = g.id
     GROUP BY g.id
     ORDER BY g.nome ASC`
  );
  return linhas;
}

export async function buscarGrupoPorId(id) {
  const [linhas] = await pool.query('SELECT * FROM grupos WHERE id = ?', [id]);
  return linhas[0] ?? null;
}

export async function criarGrupo({ nome, descricao }) {
  const [resultado] = await pool.query(
    'INSERT INTO grupos (nome, descricao) VALUES (?, ?)',
    [nome, descricao ?? null]
  );
  return resultado.insertId;
}

export async function atualizarGrupo(id, { nome, descricao }) {
  await pool.query(
    'UPDATE grupos SET nome = ?, descricao = ? WHERE id = ?',
    [nome, descricao ?? null, id]
  );
}

export async function excluirGrupo(id) {
  await pool.query('DELETE FROM grupos WHERE id = ?', [id]);
}

// ── Membros ───────────────────────────────────────────────────────────────────

export async function listarMembrosPorGrupo(grupoId) {
  const [linhas] = await pool.query(
    `SELECT u.id, u.nome, u.email, u.tipo_usuario, u.ativo
     FROM usuarios u
     JOIN usuarios_grupos ug ON ug.usuario_id = u.id
     WHERE ug.grupo_id = ?
     ORDER BY u.nome ASC`,
    [grupoId]
  );
  return linhas;
}

export async function adicionarMembro(grupoId, usuarioId) {
  await pool.query(
    'INSERT IGNORE INTO usuarios_grupos (usuario_id, grupo_id) VALUES (?, ?)',
    [usuarioId, grupoId]
  );
}

export async function removerMembro(grupoId, usuarioId) {
  await pool.query(
    'DELETE FROM usuarios_grupos WHERE usuario_id = ? AND grupo_id = ?',
    [usuarioId, grupoId]
  );
}

// ── Permissões por grupo ──────────────────────────────────────────────────────

export async function listarPermissoesGrupo(grupoId) {
  const [linhas] = await pool.query(
    'SELECT funcionalidade, ativo FROM permissoes_grupo WHERE grupo_id = ?',
    [grupoId]
  );
  return Object.fromEntries(linhas.map((r) => [r.funcionalidade, Boolean(r.ativo)]));
}

export async function salvarPermissoesGrupo(grupoId, permissoes) {
  if (!Object.keys(permissoes).length) return;
  const valores = Object.entries(permissoes).map(([f, ativo]) => [grupoId, f, ativo ? 1 : 0]);
  await pool.query(
    `INSERT INTO permissoes_grupo (grupo_id, funcionalidade, ativo) VALUES ?
     ON DUPLICATE KEY UPDATE ativo = VALUES(ativo)`,
    [valores]
  );
}

// ── Permissões por usuário (override individual) ──────────────────────────────

export async function listarPermissoesUsuario(usuarioId) {
  const [linhas] = await pool.query(
    'SELECT funcionalidade, ativo FROM permissoes_usuario WHERE usuario_id = ?',
    [usuarioId]
  );
  return Object.fromEntries(linhas.map((r) => [r.funcionalidade, Boolean(r.ativo)]));
}

export async function salvarPermissoesUsuario(usuarioId, permissoes) {
  if (!Object.keys(permissoes).length) return;
  const valores = Object.entries(permissoes).map(([f, ativo]) => [usuarioId, f, ativo ? 1 : 0]);
  await pool.query(
    `INSERT INTO permissoes_usuario (usuario_id, funcionalidade, ativo) VALUES ?
     ON DUPLICATE KEY UPDATE ativo = VALUES(ativo)`,
    [valores]
  );
}

export async function limparPermissoesUsuario(usuarioId) {
  await pool.query('DELETE FROM permissoes_usuario WHERE usuario_id = ?', [usuarioId]);
}

// ── Permissões efetivas de um usuário ────────────────────────────────────────
// Resolução: permissão de usuário > permissão de grupo > padrão (true)

export async function permissoesEfetivasUsuario(usuarioId) {
  // Permissões de todos os grupos do usuário (OR entre grupos: basta um grupo ter ativo=1)
  const [grupoLinhas] = await pool.query(
    `SELECT pg.funcionalidade, MAX(pg.ativo) AS ativo
     FROM permissoes_grupo pg
     JOIN usuarios_grupos ug ON ug.grupo_id = pg.grupo_id
     WHERE ug.usuario_id = ?
     GROUP BY pg.funcionalidade`,
    [usuarioId]
  );
  const porGrupo = Object.fromEntries(grupoLinhas.map((r) => [r.funcionalidade, Boolean(r.ativo)]));

  // Override individual
  const porUsuario = await listarPermissoesUsuario(usuarioId);

  return { ...porGrupo, ...porUsuario };
}
