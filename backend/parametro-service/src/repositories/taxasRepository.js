import { pool } from '../config/database.js';

// ── Parâmetros numéricos ──────────────────────────────────────────────────────

export async function listarParametros() {
  const [rows] = await pool.query(
    `SELECT chave, valor, grupo, descricao FROM parametros_sistema ORDER BY grupo, id`
  );
  // Retorna objeto { chave: valor }
  const mapa = {};
  for (const r of rows) mapa[r.chave] = Number(r.valor);
  return mapa;
}

export async function atualizarParametros(atualizacoes) {
  // atualizacoes: { chave: novoValor, ... }
  if (!atualizacoes || Object.keys(atualizacoes).length === 0) return;
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    for (const [chave, valor] of Object.entries(atualizacoes)) {
      await conexao.query(
        `UPDATE parametros_sistema SET valor = ? WHERE chave = ?`,
        [Number(valor), chave]
      );
    }
    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Listas de cargos ──────────────────────────────────────────────────────────

export async function listarCargosPorCooperativa(cooperativa) {
  const [rows] = await pool.query(
    `SELECT id, cargo, ordem FROM cargos_referencia
     WHERE cooperativa = ? ORDER BY ordem ASC, cargo ASC`,
    [cooperativa]
  );
  return rows;
}

export async function listarTodasCargos() {
  const [rows] = await pool.query(
    `SELECT id, cooperativa, cargo, ordem FROM cargos_referencia ORDER BY cooperativa, ordem ASC, cargo ASC`
  );
  // Retorna { COOPERATIVA: [{ id, cargo, ordem }] }
  const mapa = {};
  for (const r of rows) {
    if (!mapa[r.cooperativa]) mapa[r.cooperativa] = [];
    mapa[r.cooperativa].push({ id: r.id, cargo: r.cargo, ordem: r.ordem });
  }
  return mapa;
}

export async function substituirCargosDaCooperativa(cooperativa, cargos) {
  // cargos: string[]
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    await conexao.query(`DELETE FROM cargos_referencia WHERE cooperativa = ?`, [cooperativa]);
    if (cargos.length > 0) {
      const valores = cargos.map((c, i) => [cooperativa, c.trim(), i + 1]);
      await conexao.query(
        `INSERT INTO cargos_referencia (cooperativa, cargo, ordem) VALUES ?`,
        [valores]
      );
    }
    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}
