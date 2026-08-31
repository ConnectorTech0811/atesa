import { pool } from '../config/database.js';

// ── Geração de matrícula ─────────────────────────────────────────────────────

/** Gera próxima matrícula no formato RA<ANO><SEQUENCIAL 4 dígitos>. Mantém padrão unificado. */
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

export async function listarCandidatos({ status, cooperativa, busca, tipo_contratacao } = {}) {
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
  if (tipo_contratacao) {
    sql += ' AND c.tipo_contratacao = ?';
    params.push(tipo_contratacao);
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
    SELECT id, nome, cpf, matricula, tipo_contratacao, status, nota_avaliacao
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
    `SELECT id, nome, cpf, matricula, tipo_contratacao, status, nota_avaliacao FROM ra_candidatos WHERE cpf = ? LIMIT 1`,
    [cpf.replace(/\D/g, '')]
  );
  return row ?? null;
}

export async function buscarCandidatosPorTexto(texto) {
  const like = `%${texto}%`;
  const [rows] = await pool.query(
    `SELECT id, nome, cpf, matricula, cooperativa, tipo_contratacao, status, nota_avaliacao
     FROM ra_candidatos
     WHERE status = 1 AND (nome LIKE ? OR cpf LIKE ? OR matricula LIKE ?)
     ORDER BY nome ASC
     LIMIT 20`,
    [like, like, like]
  );
  return rows;
}

export async function inserirCandidato({ nome, cpf, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes }) {
  const tipo = tipo_contratacao === 'interno' ? 'interno' : 'externo';
  const [res] = await pool.query(
    `INSERT INTO ra_candidatos (nome, cpf, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [nome, cpf, email ?? null, telefone ?? null, whatsapp ?? null, cooperativa, tipo, observacoes ?? null]
  );
  return res.insertId;
}

export async function atualizarCandidato(id, { nome, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes }) {
  const tipo = tipo_contratacao === 'interno' ? 'interno' : 'externo';
  await pool.query(
    `UPDATE ra_candidatos
     SET nome = ?, email = ?, telefone = ?, whatsapp = ?, cooperativa = ?,
         tipo_contratacao = ?, observacoes = ?
     WHERE id = ?`,
    [nome, email ?? null, telefone ?? null, whatsapp ?? null, cooperativa, tipo, observacoes ?? null, id]
  );
}

export async function avaliarCandidato(id, { nota, observacao, usuarioId, usuarioNome }) {
  const notaNum = Number(nota);
  if (isNaN(notaNum) || notaNum < 0 || notaNum > 10) {
    throw new Error('A nota deve ser um valor numérico entre 0.0 e 10.0.');
  }
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const [[cand]] = await conexao.query(`SELECT id, matricula, status FROM ra_candidatos WHERE id = ?`, [id]);
    if (!cand) throw new Error('Candidato não encontrado.');

    const aprovado = notaNum >= 7.0;
    const novoStatus = aprovado ? 1 : 3; // 1 = Aprovado/Ativo, 3 = Reprovado
    let matricula = cand.matricula;

    // Se aprovado e ainda não tem matrícula, gera
    if (aprovado && !matricula) {
      matricula = await gerarMatricula(conexao);
    }

    await conexao.query(
      `UPDATE ra_candidatos
       SET status = ?,
           nota_avaliacao = ?,
           avaliado_em = NOW(),
           avaliado_por_id = ?,
           avaliado_por_nome = ?,
           observacao_avaliacao = ?,
           matricula = COALESCE(?, matricula),
           aprovado_em = CASE WHEN ? = 1 THEN NOW() ELSE aprovado_em END,
           aprovado_por_id = CASE WHEN ? = 1 THEN ? ELSE aprovado_por_id END,
           aprovado_por_nome = CASE WHEN ? = 1 THEN ? ELSE aprovado_por_nome END
       WHERE id = ?`,
      [
        novoStatus,
        notaNum,
        usuarioId ?? null,
        usuarioNome ?? null,
        observacao ?? null,
        matricula ?? null,
        novoStatus,
        novoStatus, usuarioId ?? null,
        novoStatus, usuarioNome ?? null,
        id,
      ]
    );

    try {
      await conexao.query(
        `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
         VALUES (?, 'ra_candidatos', 'status', 'edicao', ?, ?, ?, ?, ?)`,
        [
          id,
          String(cand.status),
          String(novoStatus),
          `Avaliação/Prova registrada. Nota: ${notaNum.toFixed(1)} (${aprovado ? 'Aprovado' : 'Reprovado'}). ${observacao ? `Obs: ${observacao}` : ''}`,
          usuarioId ?? null,
          usuarioNome ?? null,
        ]
      );
    } catch { /* auditoria opcional */ }

    await conexao.commit();
    return { status: novoStatus, nota: notaNum, matricula, aprovado };
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function aprovarCandidato(id, usuarioId, usuarioNome) {
  // Chamada de fallback: aprova com nota padrão 10.0
  return avaliarCandidato(id, { nota: 10.0, usuarioId, usuarioNome });
}

export async function reprovarCandidato(id, usuarioId, usuarioNome, observacao) {
  // Chamada de fallback: reprova com nota padrão 5.0
  return avaliarCandidato(id, { nota: 5.0, observacao, usuarioId, usuarioNome });
}

export async function inativarCandidato(id, { usuarioId, usuarioNome, motivo } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    await conexao.query(
      `UPDATE ra_candidatos
       SET status = 2, inativado_em = NOW(), inativado_por_id = ?, inativado_por_nome = ?, motivo_inativacao = ?
       WHERE id = ?`,
      [usuarioId ?? null, usuarioNome ?? null, motivo ?? null, id]
    );
    try {
      await conexao.query(
        `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
         VALUES (?, 'ra_candidatos', 'status', 'edicao', '1', '2', ?, ?, ?)`,
        [id, motivo ? `Inativação de cooperado. Motivo: ${motivo}` : 'Inativação de cooperado.', usuarioId ?? null, usuarioNome ?? null]
      );
    } catch { /* auditoria opcional */ }

    await conexao.commit();
    return true;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function reativarCandidato(id, { usuarioId, usuarioNome } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    await conexao.query(
      `UPDATE ra_candidatos
       SET status = 1, inativado_em = NULL, inativado_por_id = NULL, inativado_por_nome = NULL, motivo_inativacao = NULL
       WHERE id = ?`,
      [id]
    );
    try {
      await conexao.query(
        `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
         VALUES (?, 'ra_candidatos', 'status', 'edicao', '2', '1', 'Reativação de cooperado.', ?, ?)`,
        [id, usuarioId ?? null, usuarioNome ?? null]
      );
    } catch { /* auditoria opcional */ }

    await conexao.commit();
    return true;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Alocações ────────────────────────────────────────────────────────────────

export async function listarAlocacoesPorVaga(vagaId) {
  const [rows] = await pool.query(
    `SELECT a.*,
            c.nome AS candidato_nome, c.cpf AS candidato_cpf, c.matricula AS candidato_matricula, c.tipo_contratacao
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
      SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS ativos,
      SUM(CASE WHEN status = 2 THEN 1 ELSE 0 END) AS inativos,
      SUM(CASE WHEN status = 3 THEN 1 ELSE 0 END) AS reprovados,
      SUM(CASE WHEN tipo_contratacao = 'interno' THEN 1 ELSE 0 END) AS internos,
      SUM(CASE WHEN tipo_contratacao = 'externo' THEN 1 ELSE 0 END) AS externos
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

  return {
    total_candidatos: Number(totais.total_candidatos || 0),
    pre_cadastro: Number(totais.pre_cadastro || 0),
    ativos: Number(totais.ativos || 0),
    inativos: Number(totais.inativos || 0),
    reprovados: Number(totais.reprovados || 0),
    internos: Number(totais.internos || 0),
    externos: Number(totais.externos || 0),
    total_alocacoes: Number(alocacoes.total_alocacoes || 0),
    ativas: Number(alocacoes.ativas || 0),
    candidatos_alocados: Number(alocacoes.candidatos_alocados || 0),
    vagas_top: vagasOcupacao
  };
}

// ── Vagas (leitura do módulo Parâmetro com filtro de Tomador) ───────────────

export async function listarVagasDisponiveis({ empresaId, tomador, cargo, cooperativa } = {}) {
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
  if (tomador)   { sql += ' AND (e.nome_empresa LIKE ? OR pu.nome_unidade LIKE ?)'; params.push(`%${tomador}%`, `%${tomador}%`); }
  if (cargo)     { sql += ' AND pv.cargo LIKE ?'; params.push(`%${cargo}%`); }
  if (cooperativa) { sql += ' AND e.cooperativa = ?'; params.push(cooperativa); }

  sql += ' GROUP BY pv.id ORDER BY e.nome_empresa ASC, pu.nome_unidade ASC, pv.cargo ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}
