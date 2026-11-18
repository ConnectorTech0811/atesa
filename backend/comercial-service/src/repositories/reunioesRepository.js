import { pool } from '../config/database.js';

const STATUS_VALIDOS_REUNIAO = ['agendada', 'realizada', 'cancelada', 'pos_venda', 'alinhamento', 'fechamento'];
const STATUS_VALIDOS_SQL = STATUS_VALIDOS_REUNIAO.map((s) => `'${s}'`).join(',');

// Status nulo, vazio ou fora da lista (legado) é sempre tratado como 'agendada'
const STATUS_NORMALIZADO_SQL = `CASE WHEN LOWER(TRIM(r.status)) IN (${STATUS_VALIDOS_SQL}) THEN LOWER(TRIM(r.status)) ELSE 'agendada' END`;

function normalizarStatusReuniao(status) {
  const st = typeof status === 'string' ? status.trim().toLowerCase() : '';
  return STATUS_VALIDOS_REUNIAO.includes(st) ? st : 'agendada';
}

async function inicializarColunasReunioes() {
  // Supervisor do pós-venda (definido no Parâmetro): a agenda do supervisor traz as reuniões dos clientes dele
  try {
    await pool.query(`ALTER TABLE empresas ADD COLUMN supervisor_id INT NULL`);
  } catch {}
  try {
    await pool.query(`ALTER TABLE reunioes ADD COLUMN feedback TEXT NULL`);
  } catch {}
  try {
    await pool.query(`UPDATE reunioes SET status = LOWER(TRIM(status)) WHERE LOWER(TRIM(status)) IN (${STATUS_VALIDOS_SQL}) AND status <> LOWER(TRIM(status))`);
    await pool.query(`UPDATE reunioes SET status = 'agendada' WHERE status IS NULL OR status NOT IN (${STATUS_VALIDOS_SQL})`);
  } catch (e) {
    console.error('Erro ao normalizar status das reuniões:', e);
  }
}
inicializarColunasReunioes().catch(() => {});

export async function listarReunioesPorExecutivo(executivoId) {
  const [linhas] = await pool.query(
    `SELECT r.id, r.empresa_id, r.trabalho_id, r.titulo, r.data_hora, r.local_reuniao, r.observacoes, r.feedback,
            ${STATUS_NORMALIZADO_SQL} AS status,
            r.agendado_por_id, r.agendado_por_nome, r.criado_em,
            e.nome_empresa, e.supervisor_id, e.supervisor AS supervisor_nome
     FROM reunioes r
     JOIN empresas e ON e.id = r.empresa_id
     WHERE r.agendado_por_id = ?
     ORDER BY r.data_hora ASC`,
    [executivoId]
  );
  return linhas;
}

export async function listarTodasReunioes() {
  const [linhas] = await pool.query(
    `SELECT r.id, r.empresa_id, r.trabalho_id, r.titulo, r.data_hora, r.local_reuniao, r.observacoes, r.feedback,
            ${STATUS_NORMALIZADO_SQL} AS status,
            r.agendado_por_id, r.agendado_por_nome, r.criado_em,
            e.nome_empresa, e.supervisor_id, e.supervisor AS supervisor_nome
     FROM reunioes r
     JOIN empresas e ON e.id = r.empresa_id
     ORDER BY r.data_hora ASC`
  );
  return linhas;
}

/**
 * Agenda do supervisor: reuniões dos clientes em que ele é o supervisor do pós-venda (Parâmetro)
 * e as que ele mesmo agendou. `aPartirDe` (YYYY-MM-DD) limita às próximas.
 */
export async function listarReunioesPorSupervisor(supervisorId, { aPartirDe } = {}) {
  const [linhas] = await pool.query(
    `SELECT r.id, r.empresa_id, r.trabalho_id, r.titulo, r.data_hora, r.local_reuniao, r.observacoes, r.feedback,
            ${STATUS_NORMALIZADO_SQL} AS status,
            r.agendado_por_id, r.agendado_por_nome, r.criado_em,
            e.nome_empresa, e.supervisor_id, e.supervisor AS supervisor_nome
     FROM reunioes r
     JOIN empresas e ON e.id = r.empresa_id
     WHERE (e.supervisor_id = ? OR r.agendado_por_id = ?)
       ${aPartirDe ? 'AND r.data_hora >= ?' : ''}
     ORDER BY r.data_hora ASC`,
    aPartirDe ? [supervisorId, supervisorId, aPartirDe] : [supervisorId, supervisorId]
  );
  return linhas;
}

export async function listarReunioesPorEmpresa(empresaId) {
  const [linhas] = await pool.query(
    `SELECT r.id, r.empresa_id, r.trabalho_id, r.titulo, r.data_hora, r.local_reuniao, r.observacoes, r.feedback,
            ${STATUS_NORMALIZADO_SQL} AS status,
            r.agendado_por_id, r.agendado_por_nome, r.criado_em,
            e.nome_empresa, e.supervisor_id, e.supervisor AS supervisor_nome
     FROM reunioes r 
     LEFT JOIN empresas e ON e.id = r.empresa_id 
     WHERE r.empresa_id = ? 
     ORDER BY r.data_hora ASC`,
    [empresaId]
  );
  return linhas;
}

export async function buscarReuniaoPorId(id) {
  const [linhas] = await pool.query(
    `SELECT r.*, ${STATUS_NORMALIZADO_SQL} AS status FROM reunioes r WHERE r.id = ?`,
    [id]
  );
  return linhas[0] ?? null;
}

export async function inserirReuniao({ empresaId, trabalhoId, titulo, dataHora, localReuniao, observacoes, agendadoPorId, agendadoPorNome, status }) {
  const [resultado] = await pool.query(
    `INSERT INTO reunioes (empresa_id, trabalho_id, titulo, data_hora, local_reuniao, observacoes, agendado_por_id, agendado_por_nome, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [empresaId, trabalhoId ?? null, titulo, dataHora, localReuniao ?? null, observacoes ?? null, agendadoPorId, agendadoPorNome, normalizarStatusReuniao(status)]
  );
  return resultado.insertId;
}

export async function atualizarStatusReuniao(id, status) {
  await pool.query('UPDATE reunioes SET status = ? WHERE id = ?', [normalizarStatusReuniao(status), id]);
}

export async function salvarFeedbackReuniao(id, feedback) {
  await pool.query('UPDATE reunioes SET feedback = ? WHERE id = ?', [feedback ?? null, id]);
}

export async function atualizarReuniao(id, { empresaId, titulo, dataHora, localReuniao, observacoes, status }) {
  await pool.query(
    `UPDATE reunioes
     SET empresa_id = COALESCE(?, empresa_id),
         titulo = COALESCE(?, titulo),
         data_hora = COALESCE(?, data_hora),
         local_reuniao = COALESCE(?, local_reuniao),
         observacoes = COALESCE(?, observacoes),
         status = COALESCE(?, status)
     WHERE id = ?`,
    [empresaId ?? null, titulo ?? null, dataHora ?? null, localReuniao ?? null, observacoes ?? null, status ? normalizarStatusReuniao(status) : null, id]
  );
}

export async function excluirReuniao(id) {
  await pool.query('DELETE FROM reunioes WHERE id = ?', [id]);
}
