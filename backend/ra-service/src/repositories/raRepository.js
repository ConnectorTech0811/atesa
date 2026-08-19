import { pool } from '../config/database.js';

// ── Geração de matrícula ─────────────────────────────────────────────────────

/** Gera próxima matrícula no formato RA<ANO><SEQUENCIAL 4 dígitos>. */
async function gerarMatricula(conexao) {
  const ano = new Date().getFullYear();
  const prefixo = `RA${ano}`;
  const [[{ ultimo }]] = await conexao.query(
    `SELECT COUNT(*) AS ultimo FROM ra_candidatos WHERE matricula LIKE ?`,
    [`${prefixo}%`]
  );
  return `${prefixo}${String(Number(ultimo) + 1).padStart(4, '0')}`;
}

// ── Candidatos ───────────────────────────────────────────────────────────────

export async function listarCandidatos({ status, cooperativa, busca } = {}) {
  let sql = `
    SELECT c.*,
           COUNT(a.id) AS total_alocacoes,
           COUNT(CASE WHEN a.status = 'ativa' THEN 1 END) AS alocacoes_ativas
    FROM ra_candidatos c
    LEFT JOIN ra_alocacoes a ON a.candidato_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (status !== undefined && status !== '') {
    sql += ' AND c.status = ?';
    params.push(Number(status));
  }
  if (cooperativa) {
    sql += ' AND c.cooperativa = ?';
    params.push(cooperativa);
  }
  if (busca) {
    sql += ' AND (c.nome LIKE ? OR c.cpf LIKE ? OR c.matricula LIKE ?)';
    const like = `%${busca}%`;
    params.push(like, like, like);
  }

  sql += ' GROUP BY c.id ORDER BY c.nome ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function buscarCandidatoPorId(id) {
  const [[row]] = await pool.query(
    `SELECT c.*,
            COUNT(a.id) AS total_alocacoes,
            COUNT(CASE WHEN a.status = 'ativa' THEN 1 END) AS alocacoes_ativas
     FROM ra_candidatos c
     LEFT JOIN ra_alocacoes a ON a.candidato_id = c.id
     WHERE c.id = ?
     GROUP BY c.id`,
    [id]
  );
  return row ?? null;
}

export async function buscarCandidatosParecidos(nome, excludeId = null) {
  const like = `%${nome.trim()}%`;
  const params = [like, like];
  let sql = `
    SELECT id, nome, cpf, matricula, status
    FROM ra_candidatos
    WHERE (nome LIKE ? OR SOUNDEX(nome) = SOUNDEX(?))
  `;
  if (excludeId) {
    sql += ' AND id != ?';
    params.push(excludeId);
  }
  sql += ' ORDER BY nome ASC LIMIT 5';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function buscarCandidatoPorCpf(cpf) {
  const [[row]] = await pool.query(
    `SELECT id, nome, cpf, matricula, status FROM ra_candidatos WHERE cpf = ? LIMIT 1`,
    [cpf.replace(/\D/g, '')]
  );
  return row ?? null;
}

export async function buscarCandidatosPorTexto(texto) {
  const like = `%${texto}%`;
  const [rows] = await pool.query(
    `SELECT id, nome, cpf, matricula, cooperativa, status
     FROM ra_candidatos
     WHERE status = 1 AND (nome LIKE ? OR cpf LIKE ? OR matricula LIKE ?)
     ORDER BY nome ASC
     LIMIT 20`,
    [like, like, like]
  );
  return rows;
}

export async function inserirCandidato({ nome, cpf, email, telefone, whatsapp, cooperativa, observacoes }) {
  const [res] = await pool.query(
    `INSERT INTO ra_candidatos (nome, cpf, email, telefone, whatsapp, cooperativa, observacoes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
    [nome, cpf, email ?? null, telefone ?? null, whatsapp ?? null, cooperativa, observacoes ?? null]
  );
  return res.insertId;
}

export async function atualizarCandidato(id, { nome, email, telefone, whatsapp, cooperativa, observacoes }) {
  await pool.query(
    `UPDATE ra_candidatos
     SET nome = ?, email = ?, telefone = ?, whatsapp = ?, cooperativa = ?, observacoes = ?
     WHERE id = ?`,
    [nome, email ?? null, telefone ?? null, whatsapp ?? null, cooperativa, observacoes ?? null, id]
  );
}

export async function aprovarCandidato(id, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const matricula = await gerarMatricula(conexao);
    await conexao.query(
      `UPDATE ra_candidatos
       SET status = 1, matricula = ?, aprovado_em = NOW(), aprovado_por_id = ?, aprovado_por_nome = ?
       WHERE id = ? AND status = 0`,
      [matricula, usuarioId, usuarioNome, id]
    );
    await conexao.commit();
    return matricula;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function reprovarCandidato(id) {
  await pool.query(`DELETE FROM ra_candidatos WHERE id = ? AND status = 0`, [id]);
}

// ── Alocações ────────────────────────────────────────────────────────────────

export async function listarAlocacoesPorVaga(vagaId) {
  const [rows] = await pool.query(
    `SELECT a.*,
            c.nome AS candidato_nome, c.cpf AS candidato_cpf, c.matricula AS candidato_matricula
     FROM ra_alocacoes a
     JOIN ra_candidatos c ON c.id = a.candidato_id
     WHERE a.vaga_id = ?
     ORDER BY a.criado_em DESC`,
    [vagaId]
  );
  return rows;
}

export async function listarAlocacoesPorCandidato(candidatoId) {
  const [rows] = await pool.query(
    `SELECT a.*,
            e.nome_empresa, pu.nome_unidade, pv.cargo
     FROM ra_alocacoes a
     JOIN empresas e ON e.id = a.empresa_id
     JOIN parametro_unidades pu ON pu.id = a.unidade_id
     JOIN parametro_vagas pv ON pv.id = a.vaga_id
     WHERE a.candidato_id = ?
     ORDER BY a.criado_em DESC`,
    [candidatoId]
  );
  return rows;
}

export async function inserirAlocacao({ candidatoId, vagaId, unidadeId, empresaId, dataInicio, observacoes, usuarioId, usuarioNome }) {
  const [res] = await pool.query(
    `INSERT INTO ra_alocacoes
       (candidato_id, vaga_id, unidade_id, empresa_id, data_inicio, observacoes, status, criado_por_id, criado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, 'ativa', ?, ?)`,
    [candidatoId, vagaId, unidadeId, empresaId, dataInicio, observacoes ?? null, usuarioId, usuarioNome]
  );
  return res.insertId;
}

export async function encerrarAlocacao(id, { usuarioId, usuarioNome, dataFim, observacoes }) {
  await pool.query(
    `UPDATE ra_alocacoes
     SET status = 'encerrada', data_fim = ?, encerrado_em = NOW(), encerrado_por_id = ?, encerrado_por_nome = ?,
         observacoes = COALESCE(?, observacoes)
     WHERE id = ?`,
    [dataFim ?? new Date().toISOString().substring(0, 10), usuarioId, usuarioNome, observacoes ?? null, id]
  );
}

// ── Dashboard / métricas ─────────────────────────────────────────────────────

export async function obterMetricasRA() {
  const [[totais]] = await pool.query(`
    SELECT
      COUNT(*) AS total_candidatos,
      SUM(CASE WHEN status = 0 THEN 1 ELSE 0 END) AS pre_cadastro,
      SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS ativos
    FROM ra_candidatos
  `);

  const [[alocacoes]] = await pool.query(`
    SELECT
      COUNT(*) AS total_alocacoes,
      COUNT(CASE WHEN status = 'ativa' THEN 1 END) AS ativas,
      COUNT(DISTINCT candidato_id) AS candidatos_alocados
    FROM ra_alocacoes
  `);

  const [vagasOcupacao] = await pool.query(`
    SELECT pv.id, pv.cargo, pv.quantidade AS total_vagas,
           pu.nome_unidade, e.nome_empresa,
           COUNT(CASE WHEN a.status = 'ativa' THEN 1 END) AS ocupadas
    FROM parametro_vagas pv
    JOIN parametro_unidades pu ON pu.id = pv.unidade_id
    JOIN empresas e ON e.id = pu.empresa_id
    LEFT JOIN ra_alocacoes a ON a.vaga_id = pv.id
    WHERE pv.ativa = 1
    GROUP BY pv.id
    ORDER BY (COUNT(CASE WHEN a.status = 'ativa' THEN 1 END) / pv.quantidade) DESC
    LIMIT 10
  `);

  return { ...totais, ...alocacoes, vagas_top: vagasOcupacao };
}

// ── Vagas (leitura do módulo Parâmetro) ─────────────────────────────────────

export async function listarVagasDisponiveis({ empresaId, cargo, cooperativa } = {}) {
  let sql = `
    SELECT pv.id, pv.cargo, pv.quantidade AS total_vagas, pv.tipo_escala, pv.periodicidade,
           pv.salario_base, pv.ativa,
           pu.id AS unidade_id, pu.nome_unidade,
           e.id AS empresa_id, e.nome_empresa, e.cooperativa,
           COUNT(CASE WHEN a.status = 'ativa' THEN 1 END) AS ocupadas,
           (pv.quantidade - COUNT(CASE WHEN a.status = 'ativa' THEN 1 END)) AS vagas_livres
    FROM parametro_vagas pv
    JOIN parametro_unidades pu ON pu.id = pv.unidade_id
    JOIN empresas e ON e.id = pu.empresa_id
    LEFT JOIN ra_alocacoes a ON a.vaga_id = pv.id
    WHERE pv.ativa = 1
  `;
  const params = [];

  if (empresaId) { sql += ' AND e.id = ?'; params.push(empresaId); }
  if (cargo)     { sql += ' AND pv.cargo LIKE ?'; params.push(`%${cargo}%`); }
  if (cooperativa) { sql += ' AND e.cooperativa = ?'; params.push(cooperativa); }

  sql += ' GROUP BY pv.id ORDER BY e.nome_empresa ASC, pu.nome_unidade ASC, pv.cargo ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}
