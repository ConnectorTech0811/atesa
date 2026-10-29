// ── Modelo da planilha de faturamento de cada cliente ───────────────────────
// Cada cliente tem um serviço diferente e recebe a planilha no seu modelo (Horista, PL, Mensal...).
// O modelo fica vinculado ao cliente; sem vínculo, a tela sugere pelo tipo de escala das vagas.
import { pool } from '../config/database.js';

export const MODELOS_PLANILHA = ['horista', 'pl', 'mensal'];

let inicializado = null;
function inicializar() {
  if (!inicializado) {
    inicializado = pool.query(`
      CREATE TABLE IF NOT EXISTS faturamento_modelo_planilha_cliente (
        empresa_id INT PRIMARY KEY,
        modelo VARCHAR(30) NOT NULL,
        atualizado_por_id INT NULL,
        atualizado_por_nome VARCHAR(150) NULL,
        atualizado_por_perfil VARCHAR(50) NULL,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((e) => { inicializado = null; throw e; });
  }
  return inicializado;
}

const erro400 = (msg) => Object.assign(new Error(msg), { status: 400 });

/** Modelo vinculado ao cliente (ou null, se ainda não foi definido). */
export async function obterModeloPlanilha(empresaId) {
  await inicializar();
  const emp = Number(empresaId);
  if (!emp) throw erro400('Selecione o cliente.');
  const [[row]] = await pool.query(
    `SELECT modelo, atualizado_por_nome, atualizado_por_perfil, atualizado_em
       FROM faturamento_modelo_planilha_cliente WHERE empresa_id = ?`,
    [emp]
  );
  return { empresa_id: emp, modelo: row?.modelo ?? null, atualizado_por_nome: row?.atualizado_por_nome ?? null,
    atualizado_por_perfil: row?.atualizado_por_perfil ?? null, atualizado_em: row?.atualizado_em ?? null };
}

export async function salvarModeloPlanilha(empresaId, modelo, usuario) {
  await inicializar();
  const emp = Number(empresaId);
  if (!emp) throw erro400('Selecione o cliente.');
  if (!MODELOS_PLANILHA.includes(modelo)) throw erro400('Modelo de planilha inválido.');
  const [[e]] = await pool.query(`SELECT id FROM empresas WHERE id = ?`, [emp]);
  if (!e) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
  await pool.query(
    `INSERT INTO faturamento_modelo_planilha_cliente (empresa_id, modelo, atualizado_por_id, atualizado_por_nome, atualizado_por_perfil)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE modelo = VALUES(modelo), atualizado_por_id = VALUES(atualizado_por_id),
       atualizado_por_nome = VALUES(atualizado_por_nome), atualizado_por_perfil = VALUES(atualizado_por_perfil)`,
    [emp, modelo, usuario?.id ?? null, usuario?.nome ?? null, usuario?.tipoUsuario ?? null]
  );
  return obterModeloPlanilha(emp);
}
