// ── Escalistas × clientes ────────────────────────────────────────────────────
// A escalista enxerga nas Escalas os clientes da região dela (usuarios.regiao_id = empresas.regiao_id)
// e os clientes de outras regiões liberados para ela (ex.: escalista de SP atendendo o RJ).
// Também pode receber acesso a todos os clientes. Toda liberação/remoção fica no histórico com autor.
import { pool } from '../config/database.js';

let inicializado = null;
function inicializar() {
  if (!inicializado) {
    inicializado = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_escalista_clientes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          empresa_id INT NOT NULL,
          liberado_por_id INT NULL,
          liberado_por_nome VARCHAR(150) NULL,
          liberado_por_perfil VARCHAR(50) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_sec_usuario_empresa (usuario_id, empresa_id),
          INDEX idx_sec_empresa (empresa_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_escalista_config (
          usuario_id INT PRIMARY KEY,
          todos_clientes TINYINT(1) NOT NULL DEFAULT 0,
          atualizado_por_nome VARCHAR(150) NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_escalista_historico (
          id INT AUTO_INCREMENT PRIMARY KEY,
          usuario_id INT NOT NULL,
          empresa_id INT NULL,
          acao ENUM('cliente_liberado', 'cliente_removido', 'todos_liberado', 'todos_removido') NOT NULL,
          autor_id INT NULL,
          autor_nome VARCHAR(150) NULL,
          autor_perfil VARCHAR(50) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_seh_usuario (usuario_id, criado_em)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((e) => { inicializado = null; throw e; });
  }
  return inicializado;
}

const erro = (status, msg) => Object.assign(new Error(msg), { status });

async function obterEscalista(usuarioId) {
  const [[u]] = await pool.query(
    `SELECT u.id, u.nome, u.email, u.ativo, u.regiao_id, r.nome AS regiao_nome
       FROM usuarios u LEFT JOIN regioes r ON r.id = u.regiao_id
      WHERE u.id = ? AND u.tipo_usuario = 'escalista'`,
    [Number(usuarioId)]
  );
  if (!u) throw erro(404, 'Escalista não encontrada.');
  return u;
}

async function registrar(usuarioId, empresaId, acao, autor) {
  await pool.query(
    `INSERT INTO supervisao_escalista_historico (usuario_id, empresa_id, acao, autor_id, autor_nome, autor_perfil)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [usuarioId, empresaId, acao, autor?.id ?? null, autor?.nome ?? null, autor?.tipoUsuario ?? null]
  );
}

/** Tabela de escalistas: região, quantos clientes a região dá e os clientes liberados de fora. */
export async function listarEscalistas() {
  await inicializar();
  const [escalistas] = await pool.query(
    `SELECT u.id, u.nome, u.email, u.ativo, u.regiao_id, r.nome AS regiao_nome,
            COALESCE(cfg.todos_clientes, 0) AS todos_clientes,
            (SELECT COUNT(*) FROM empresas e WHERE e.regiao_id = u.regiao_id) AS clientes_regiao
       FROM usuarios u
       LEFT JOIN regioes r ON r.id = u.regiao_id
       LEFT JOIN supervisao_escalista_config cfg ON cfg.usuario_id = u.id
      WHERE u.tipo_usuario = 'escalista'
      ORDER BY u.ativo DESC, u.nome`
  );
  const [extras] = await pool.query(
    `SELECT ec.usuario_id, ec.empresa_id, e.nome_empresa, e.regiao_id, r.nome AS regiao_nome
       FROM supervisao_escalista_clientes ec
       JOIN empresas e ON e.id = ec.empresa_id
       LEFT JOIN regioes r ON r.id = e.regiao_id
      ORDER BY e.nome_empresa`
  );
  return escalistas.map((u) => ({
    ...u,
    ativo: !!u.ativo,
    todos_clientes: !!u.todos_clientes,
    clientes_liberados: extras.filter((x) => x.usuario_id === u.id),
  }));
}

/** Detalhe de uma escalista: clientes da região (automáticos), liberados e histórico. */
export async function detalharEscalista(usuarioId) {
  await inicializar();
  const u = await obterEscalista(usuarioId);
  const [[cfg]] = await pool.query(`SELECT todos_clientes FROM supervisao_escalista_config WHERE usuario_id = ?`, [u.id]);
  const [daRegiao] = await pool.query(
    `SELECT id AS empresa_id, nome_empresa FROM empresas WHERE regiao_id = ? ORDER BY nome_empresa`,
    [u.regiao_id ?? 0]
  );
  const [liberados] = await pool.query(
    `SELECT ec.empresa_id, e.nome_empresa, e.regiao_id, r.nome AS regiao_nome,
            ec.liberado_por_nome, ec.liberado_por_perfil, ec.criado_em
       FROM supervisao_escalista_clientes ec
       JOIN empresas e ON e.id = ec.empresa_id
       LEFT JOIN regioes r ON r.id = e.regiao_id
      WHERE ec.usuario_id = ?
      ORDER BY e.nome_empresa`,
    [u.id]
  );
  const [historico] = await pool.query(
    `SELECT h.id, h.acao, h.empresa_id, e.nome_empresa, h.autor_nome, h.autor_perfil, h.criado_em
       FROM supervisao_escalista_historico h
       LEFT JOIN empresas e ON e.id = h.empresa_id
      WHERE h.usuario_id = ?
      ORDER BY h.criado_em DESC, h.id DESC
      LIMIT 200`,
    [u.id]
  );
  // Clientes que podem ser liberados: de outras regiões (ou sem região) e ainda não liberados
  const [outros] = await pool.query(
    `SELECT e.id AS empresa_id, e.nome_empresa, e.regiao_id, r.nome AS regiao_nome
       FROM empresas e LEFT JOIN regioes r ON r.id = e.regiao_id
      WHERE (e.regiao_id IS NULL OR e.regiao_id <> ?)
        AND e.id NOT IN (SELECT empresa_id FROM supervisao_escalista_clientes WHERE usuario_id = ?)
      ORDER BY r.nome IS NULL, r.nome, e.nome_empresa`,
    [u.regiao_id ?? 0, u.id]
  );
  return {
    ...u, ativo: !!u.ativo, todos_clientes: !!cfg?.todos_clientes,
    clientes_regiao: daRegiao, clientes_liberados: liberados, clientes_disponiveis: outros, historico,
  };
}

/** Libera um cliente (de outra região) para a escalista. */
export async function liberarCliente(usuarioId, empresaId, autor) {
  await inicializar();
  const u = await obterEscalista(usuarioId);
  const [[e]] = await pool.query(`SELECT id, nome_empresa, regiao_id FROM empresas WHERE id = ?`, [Number(empresaId)]);
  if (!e) throw erro(404, 'Cliente não encontrado.');
  if (u.regiao_id && Number(e.regiao_id) === Number(u.regiao_id)) {
    throw erro(400, `${e.nome_empresa} já é da região da escalista (${u.regiao_nome}); o acesso é automático.`);
  }
  const [res] = await pool.query(
    `INSERT IGNORE INTO supervisao_escalista_clientes (usuario_id, empresa_id, liberado_por_id, liberado_por_nome, liberado_por_perfil)
     VALUES (?, ?, ?, ?, ?)`,
    [u.id, e.id, autor?.id ?? null, autor?.nome ?? null, autor?.tipoUsuario ?? null]
  );
  if (res.affectedRows) await registrar(u.id, e.id, 'cliente_liberado', autor);
  return detalharEscalista(u.id);
}

export async function removerCliente(usuarioId, empresaId, autor) {
  await inicializar();
  const u = await obterEscalista(usuarioId);
  const [res] = await pool.query(
    `DELETE FROM supervisao_escalista_clientes WHERE usuario_id = ? AND empresa_id = ?`,
    [u.id, Number(empresaId)]
  );
  if (res.affectedRows) await registrar(u.id, Number(empresaId), 'cliente_removido', autor);
  return detalharEscalista(u.id);
}

/** Acesso a todos os clientes, independentemente da região. */
export async function definirTodosClientes(usuarioId, todos, autor) {
  await inicializar();
  const u = await obterEscalista(usuarioId);
  const [[cfg]] = await pool.query(`SELECT todos_clientes FROM supervisao_escalista_config WHERE usuario_id = ?`, [u.id]);
  if (!!cfg?.todos_clientes === !!todos) return detalharEscalista(u.id);
  await pool.query(
    `INSERT INTO supervisao_escalista_config (usuario_id, todos_clientes, atualizado_por_nome) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE todos_clientes = VALUES(todos_clientes), atualizado_por_nome = VALUES(atualizado_por_nome)`,
    [u.id, todos ? 1 : 0, autor?.nome ?? null]
  );
  await registrar(u.id, null, todos ? 'todos_liberado' : 'todos_removido', autor);
  return detalharEscalista(u.id);
}

/**
 * Clientes que o usuário pode ver nas Escalas. null = sem restrição (todos os perfis, exceto escalista
 * sem acesso total). Para a escalista: clientes da região dela + liberados.
 */
export async function clientesPermitidos(usuarioId, tipoUsuario) {
  if (tipoUsuario !== 'escalista') return null;
  await inicializar();
  const [[cfg]] = await pool.query(`SELECT todos_clientes FROM supervisao_escalista_config WHERE usuario_id = ?`, [Number(usuarioId)]);
  if (cfg?.todos_clientes) return null;
  const [rows] = await pool.query(
    `SELECT e.id FROM empresas e JOIN usuarios u ON u.id = ? WHERE e.regiao_id = u.regiao_id
     UNION
     SELECT empresa_id FROM supervisao_escalista_clientes WHERE usuario_id = ?`,
    [Number(usuarioId), Number(usuarioId)]
  );
  return new Set(rows.map((r) => Number(r.id)));
}
