import { pool } from '../config/database.js';

export async function listarContatosPorTrabalho(trabalhoId) {
  const [linhas] = await pool.query(
    `SELECT id, tipo, data_contato, observacoes, status_negocio, alerta_em, registrado_por_nome, criado_em
     FROM contatos_trabalho WHERE trabalho_id = ? ORDER BY data_contato DESC, criado_em DESC`,
    [trabalhoId]
  );
  return linhas;
}

export async function inserirContatoTrabalho(trabalhoId, { tipo, dataContato, observacoes, statusNegocio, alertaEm, registradoPorId, registradoPorNome }) {
  const [resultado] = await pool.query(
    `INSERT INTO contatos_trabalho (trabalho_id, tipo, data_contato, observacoes, status_negocio, alerta_em, registrado_por_id, registrado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [trabalhoId, tipo, dataContato, observacoes, statusNegocio ?? null, alertaEm ?? null, registradoPorId, registradoPorNome]
  );
  return resultado.insertId;
}

/** Retorna as empresas do executivo que têm alerta de retomar contato vencido. */
export async function listarAlertas(executivoId) {
  const [linhas] = await pool.query(
    `SELECT DISTINCT t.empresa_id
     FROM contatos_trabalho ct
     JOIN trabalhos t ON t.id = ct.trabalho_id
     WHERE ct.status_negocio = 'negocio_frustrado'
       AND ct.alerta_em <= CURDATE()
       AND t.executivo_id = ?
       AND t.status NOT IN ('fechado', 'cancelado')`,
    [executivoId]
  );
  return new Set(linhas.map((l) => l.empresa_id));
}
