import { pool } from '../config/database.js';

export async function listarReunioesPorExecutivo(executivoId) {
  const [linhas] = await pool.query(
    `SELECT r.*, e.nome_empresa
     FROM reunioes r
     JOIN empresas e ON e.id = r.empresa_id
     WHERE r.agendado_por_id = ?
     ORDER BY r.data_hora ASC`,
    [executivoId]
  );
  return linhas;
}

export async function listarReunioesPorEmpresa(empresaId) {
  const [linhas] = await pool.query(
    `SELECT * FROM reunioes WHERE empresa_id = ? ORDER BY data_hora ASC`,
    [empresaId]
  );
  return linhas;
}

export async function buscarReuniaoPorId(id) {
  const [linhas] = await pool.query('SELECT * FROM reunioes WHERE id = ?', [id]);
  return linhas[0] ?? null;
}

export async function inserirReuniao({ empresaId, trabalhoId, titulo, dataHora, localReuniao, observacoes, agendadoPorId, agendadoPorNome }) {
  const [resultado] = await pool.query(
    `INSERT INTO reunioes (empresa_id, trabalho_id, titulo, data_hora, local_reuniao, observacoes, agendado_por_id, agendado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [empresaId, trabalhoId ?? null, titulo, dataHora, localReuniao ?? null, observacoes ?? null, agendadoPorId, agendadoPorNome]
  );
  return resultado.insertId;
}

export async function atualizarStatusReuniao(id, status) {
  await pool.query('UPDATE reunioes SET status = ? WHERE id = ?', [status, id]);
}
