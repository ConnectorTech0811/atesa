import { pool } from '../config/database.js';

// ── Geração de matrícula ─────────────────────────────────────────────────────

/** Gera próxima matrícula sequencial numérica (padrão 34638, 34639...). */
export async function gerarProximaMatricula(conexao = pool) {
  const [[row]] = await conexao.query(
    `SELECT MAX(CAST(matricula AS UNSIGNED)) AS maxMatricula FROM ra_candidatos WHERE matricula REGEXP '^[0-9]+$'`
  );
  const base = 34638;
  const maior = Number(row?.maxMatricula) || 0;
  if (maior < base) {
    return String(base);
  }
  return String(maior + 1);
}

// ── Candidatos ───────────────────────────────────────────────────────────────

export async function listarCandidatos({ status, cooperativa, busca, tipo_contratacao } = {}) {
  let sql = `
    SELECT c.*,
           COUNT(a.id) AS total_alocacoes,
           COUNT(CASE WHEN a.status = 'ativa' THEN 1 END) AS alocacoes_ativas,
           (SELECT hd.matricula FROM ra_historico_desligamentos hd WHERE hd.candidato_id = c.id AND (hd.matricula_sucessora = c.matricula OR (hd.matricula IS NOT NULL AND hd.matricula != c.matricula)) ORDER BY hd.id DESC LIMIT 1) AS matricula_anterior,
           (SELECT COUNT(*) FROM ra_historico_desligamentos hd WHERE hd.candidato_id = c.id) AS total_desligamentos
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
            COUNT(CASE WHEN a.status = 'ativa' THEN 1 END) AS alocacoes_ativas,
            (SELECT hd.matricula FROM ra_historico_desligamentos hd WHERE hd.candidato_id = c.id AND (hd.matricula_sucessora = c.matricula OR (hd.matricula IS NOT NULL AND hd.matricula != c.matricula)) ORDER BY hd.id DESC LIMIT 1) AS matricula_anterior,
            (SELECT COUNT(*) FROM ra_historico_desligamentos hd WHERE hd.candidato_id = c.id) AS total_desligamentos
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
    `SELECT c.id, c.nome, c.cpf, c.matricula, c.cooperativa, c.tipo_contratacao, c.status, c.nota_avaliacao,
            GROUP_CONCAT(DISTINCT q.nome ORDER BY q.nome SEPARATOR ', ') AS qualificacoes
     FROM ra_candidatos c
     LEFT JOIN ra_candidato_qualificacoes cq ON cq.candidato_id = c.id
     LEFT JOIN ra_qualificacoes_catalogo q ON q.id = cq.qualificacao_id
     WHERE c.status = 1 AND (c.nome LIKE ? OR c.cpf LIKE ? OR c.matricula LIKE ? OR q.nome LIKE ?)
     GROUP BY c.id, c.nome, c.cpf, c.matricula, c.cooperativa, c.tipo_contratacao, c.status, c.nota_avaliacao
     ORDER BY c.nome ASC
     LIMIT 20`,
    [like, like, like, like]
  );
  return rows;
}

// ── Geolocalização e Tabelas de Histórico ─────────────────────────────────────
async function garantirEstruturaBanco() {
  try {
    const [cols] = await pool.query(`SHOW COLUMNS FROM ra_candidatos LIKE 'latitude'`);
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE ra_candidatos ADD COLUMN latitude VARCHAR(50) NULL AFTER observacoes`);
    }
    const [colsLong] = await pool.query(`SHOW COLUMNS FROM ra_candidatos LIKE 'longitude'`);
    if (colsLong.length === 0) {
      await pool.query(`ALTER TABLE ra_candidatos ADD COLUMN longitude VARCHAR(50) NULL AFTER latitude`);
    }

    // Tabela de histórico de notas e pareceres
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_historico_notas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        nota_anterior DECIMAL(4,2) NULL,
        nota_nova DECIMAL(4,2) NOT NULL,
        observacao_anterior TEXT NULL,
        observacao_nova TEXT NULL,
        usuario_id INT NULL,
        usuario_nome VARCHAR(255) NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cand (candidato_id),
        INDEX idx_criado (criado_em)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Tabela de histórico de desligamentos e recontratações
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_historico_desligamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        matricula VARCHAR(50) NULL,
        data_desligamento DATE NULL,
        motivo_desligamento TEXT NULL,
        desligado_por_id INT NULL,
        desligado_por_nome VARCHAR(255) NULL,
        data_recontratacao DATETIME NULL,
        recontratado_por_id INT NULL,
        recontratado_por_nome VARCHAR(255) NULL,
        matricula_sucessora VARCHAR(50) NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cand (candidato_id),
        INDEX idx_matricula (matricula),
        INDEX idx_sucessora (matricula_sucessora)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (e) {
    console.error('[RA] Erro ao verificar/criar estrutura de banco:', e?.message);
  }
}
garantirEstruturaBanco();

export async function listarHistoricoNotas(candidatoId) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM ra_historico_notas WHERE candidato_id = ? ORDER BY id DESC`,
      [candidatoId]
    );
    return rows;
  } catch (err) {
    console.error('[RA] Erro ao listar histórico de notas:', err?.message);
    return [];
  }
}

export async function listarHistoricoDesligamentos(candidatoId) {
  try {
    const [rows] = await pool.query(
      `SELECT * FROM ra_historico_desligamentos WHERE candidato_id = ? ORDER BY id DESC`,
      [candidatoId]
    );
    return rows;
  } catch (err) {
    console.error('[RA] Erro ao listar histórico de desligamentos:', err?.message);
    return [];
  }
}

export async function inserirCandidato({ nome, cpf, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes, latitude, longitude }) {
  const tipo = tipo_contratacao === 'interno' ? 'interno' : 'externo';
  const [res] = await pool.query(
    `INSERT INTO ra_candidatos (nome, cpf, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes, latitude, longitude, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [nome, cpf, email ?? null, telefone ?? null, whatsapp ?? null, cooperativa, tipo, observacoes ?? null, latitude ?? null, longitude ?? null]
  );
  return res.insertId;
}

export async function atualizarCandidato(id, { nome, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes, latitude, longitude }) {
  const tipo = tipo_contratacao === 'interno' ? 'interno' : 'externo';
  await pool.query(
    `UPDATE ra_candidatos
     SET nome = ?, email = ?, telefone = ?, whatsapp = ?, cooperativa = ?,
         tipo_contratacao = ?, observacoes = ?, latitude = ?, longitude = ?
     WHERE id = ?`,
    [nome, email ?? null, telefone ?? null, whatsapp ?? null, cooperativa, tipo, observacoes ?? null, latitude ?? null, longitude ?? null, id]
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
    const [[cand]] = await conexao.query(`SELECT id, status, matricula, nota_avaliacao, observacao_avaliacao FROM ra_candidatos WHERE id = ?`, [id]);
    if (!cand) throw new Error('Candidato não encontrado.');

    const aprovado = notaNum >= 7.0;
    const novoStatus = aprovado ? 1 : 3; // 1 = Aprovado/Ativo, 3 = Reprovado

    let matricula = null;
    if (aprovado) {
      // Se já tem matrícula numérica válida >= 34635, mantém. Caso contrário (ex: RA2026..., nula, ou reprovado), gera próxima da sequência.
      if (cand.matricula && /^\d+$/.test(String(cand.matricula).trim()) && Number(cand.matricula) >= 34635) {
        matricula = String(cand.matricula).trim();
      } else {
        matricula = await gerarProximaMatricula(conexao);
      }
    } else {
      // Se reprovado, a matrícula fica em branco (null)
      matricula = null;
    }

    await conexao.query(
      `UPDATE ra_candidatos
       SET status = ?,
           matricula = ?,
           nota_avaliacao = ?,
           avaliado_em = NOW(),
           avaliado_por_id = ?,
           avaliado_por_nome = ?,
           observacao_avaliacao = ?,
           aprovado_em = CASE WHEN ? = 1 THEN NOW() ELSE aprovado_em END,
           aprovado_por_id = CASE WHEN ? = 1 THEN ? ELSE aprovado_por_id END,
           aprovado_por_nome = CASE WHEN ? = 1 THEN ? ELSE aprovado_por_nome END
       WHERE id = ?`,
      [
        novoStatus,
        matricula,
        notaNum,
        usuarioId ?? null,
        usuarioNome ?? null,
        observacao ?? null,
        novoStatus,
        novoStatus, usuarioId ?? null,
        novoStatus, usuarioNome ?? null,
        id,
      ]
    );

    // Gravação no Histórico de Notas
    try {
      await conexao.query(
        `INSERT INTO ra_historico_notas (candidato_id, nota_anterior, nota_nova, observacao_anterior, observacao_nova, usuario_id, usuario_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          cand.nota_avaliacao !== null && cand.nota_avaliacao !== undefined ? Number(cand.nota_avaliacao) : null,
          notaNum,
          cand.observacao_avaliacao ?? null,
          observacao ?? null,
          usuarioId ?? null,
          usuarioNome ?? null,
        ]
      );
    } catch (errHist) {
      console.error('[RA] Erro ao registrar histórico de nota:', errHist?.message);
    }

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

    // Notifica inativação
    try {
      const [[c]] = await conexao.query(`SELECT nome, matricula FROM ra_candidatos WHERE id = ?`, [id]);
      const nomeCand = c?.nome || 'Cooperado';
      const matCand = c?.matricula ? ` · Matrícula: #${c.matricula}` : '';
      await conexao.query(
        `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'inativacao', ?)`,
        [id, `ℹ️ Cooperado ${nomeCand}${matCand} foi inativado (pausado) por ${usuarioNome || 'Supervisão'}. Motivo: ${motivo || 'Sem motivo informado'}.`]
      );
    } catch (err) {
      console.error('Erro ao registrar alerta de inativação:', err);
    }

    try {
      await conexao.query(
        `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
         VALUES (?, 'ra_candidatos', 'status', 'inativacao', '1', '2', ?, ?, ?)`,
        [id, motivo ? `Inativação temporária de cooperado. Motivo: ${motivo}` : 'Inativação temporária de cooperado.', usuarioId ?? null, usuarioNome ?? null]
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

export async function desligarCandidato(id, { usuarioId, usuarioNome, motivo, dataDesligamento, tipoDesligamento = 'total' } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    const [[cand]] = await conexao.query(`SELECT id, nome, matricula, status FROM ra_candidatos WHERE id = ?`, [id]);
    if (!cand) throw new Error('Candidato não encontrado.');

    const dataDesl = dataDesligamento || new Date().toISOString().slice(0, 10);
    const isRealocacao = tipoDesligamento === 'realocacao';

    if (isRealocacao) {
      // ── TIPO 2: Desligamento de Posto para Realocação / Troca de Função ───────
      // O cooperado permanece com status = 1 (Ativo) e MANTÉM seu número de matrícula intacto.
      // Apenas suas alocações ativas são encerradas para liberar o profissional para nova função.
      await conexao.query(
        `UPDATE ra_alocacoes
         SET status = 'encerrada', data_fim = COALESCE(?, CURDATE()), encerrado_em = NOW(),
             encerrado_por_id = ?, encerrado_por_nome = ?,
             observacoes = CONCAT(COALESCE(observacoes, ''), ' [Remanejamento/Troca de função: ', COALESCE(?, 'Sem motivo informado'), ']')
         WHERE candidato_id = ? AND status = 'ativa'`,
        [dataDesligamento ?? null, usuarioId ?? null, usuarioNome ?? null, motivo ?? null, id]
      );

      // Histórico de remanejamento/desligamento de posto
      try {
        await conexao.query(
          `INSERT INTO ra_historico_desligamentos (candidato_id, matricula, data_desligamento, motivo_desligamento, desligado_por_id, desligado_por_nome)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            cand.matricula ?? null,
            dataDesl,
            `[Realocação/Troca de Função] ${motivo || 'Disponibilizado para novo posto'}`,
            usuarioId ?? null,
            usuarioNome ?? null,
          ]
        );
      } catch (errHist) {
        console.error('[RA] Erro ao gravar histórico de realocação:', errHist?.message);
      }

      // Alerta de remanejamento
      try {
        const nomeCand = cand.nome || 'Cooperado';
        const matCand = cand.matricula ? ` · Matrícula #${cand.matricula}` : '';
        await conexao.query(
          `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'alocacao', ?)`,
          [id, `ℹ️ Remanejamento: Cooperado ${nomeCand}${matCand} foi desvinculado do posto atual e está disponível para nova alocação em outra função. Cadastro e matrícula mantidos ativos.`]
        );
      } catch {}

      try {
        await conexao.query(
          `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
           VALUES (?, 'ra_alocacoes', 'status', 'realocacao', 'ativa', 'encerrada', ?, ?, ?)`,
          [id, `Desligado do posto para realocação em outra função. Motivo: ${motivo || 'Remanejamento interno'}`, usuarioId ?? null, usuarioNome ?? null]
        );
      } catch {}

      await conexao.commit();
      return { ok: true, tipo: 'realocacao', matriculaMantida: cand.matricula };
    } else {
      // ── TIPO 1: Desligamento Total da Cooperativa (Cancelamento de Cadastro) ────
      // O cooperado perde a matrícula ativa (arquivada no histórico).
      // Se retornar no futuro, precisará iniciar uma nova adesão do status 0.
      await conexao.query(
        `UPDATE ra_candidatos
         SET status = 4,
             matricula = NULL,
             inativado_em = NOW(),
             inativado_por_id = ?,
             inativado_por_nome = ?,
             motivo_inativacao = ?
         WHERE id = ?`,
        [usuarioId ?? null, usuarioNome ?? null, motivo ?? null, id]
      );

      // Reseta a proposta de adesão para que se for reaberto inicie do status 0
      try {
        await conexao.query(
          `UPDATE ra_propostas_adesao
           SET status_adesao = 'desligado', atualizado_em = NOW()
           WHERE candidato_id = ?`,
          [id]
        );
      } catch {}

      // Gravação no Histórico de Desligamentos
      try {
        await conexao.query(
          `INSERT INTO ra_historico_desligamentos (candidato_id, matricula, data_desligamento, motivo_desligamento, desligado_por_id, desligado_por_nome)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            id,
            cand.matricula ?? null,
            dataDesl,
            motivo ?? null,
            usuarioId ?? null,
            usuarioNome ?? null,
          ]
        );
      } catch (errHist) {
        console.error('[RA] Erro ao gravar histórico de desligamento:', errHist?.message);
      }

      // Encerra alocações ativas do cooperado
      await conexao.query(
        `UPDATE ra_alocacoes
         SET status = 'encerrada', data_fim = COALESCE(?, CURDATE()), encerrado_em = NOW(),
             encerrado_por_id = ?, encerrado_por_nome = ?,
             observacoes = CONCAT(COALESCE(observacoes, ''), ' [Desligamento total: ', COALESCE(?, 'Sem motivo informado'), ']')
         WHERE candidato_id = ? AND status = 'ativa'`,
        [dataDesligamento ?? null, usuarioId ?? null, usuarioNome ?? null, motivo ?? null, id]
      );

      // Desativa cotas mensais ativas
      try {
        await conexao.query(`UPDATE ra_cotas_mensais SET ativa = 0 WHERE candidato_id = ?`, [id]);
      } catch {}

      // Notifica o Módulo de Benefícios para cancelamento automático
      try {
        const nomeCand = cand.nome || 'Cooperado';
        const matCand = cand.matricula ? ` · Matrícula anterior: #${cand.matricula}` : '';
        const dataStr = dataDesligamento ? ` em ${dataDesligamento}` : '';
        await conexao.query(
          `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'desligamento', ?)`,
          [id, `⚠️ Cancelamento de Benefícios: Cooperado ${nomeCand}${matCand} teve desligamento total da cooperativa${dataStr} por ${usuarioNome || 'Supervisão'}. Motivo: ${motivo || 'Sem motivo informado'}. Cadastro cancelado e benefícios revogados.`]
        );
      } catch (err) {
        console.error('Erro ao registrar alerta de desligamento em Benefícios:', err);
      }

      try {
        await conexao.query(
          `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
           VALUES (?, 'ra_candidatos', 'status', 'desligamento_total', ?, '4', ?, ?, ?)`,
          [id, String(cand.matricula || 'ativo'), motivo ? `Desligamento total da cooperativa. Motivo: ${motivo}` : 'Desligamento total da cooperativa.', usuarioId ?? null, usuarioNome ?? null]
        );
      } catch {}

      await conexao.commit();
      return { ok: true, tipo: 'total', matriculaArquivada: cand.matricula };
    }
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
    const [[cand]] = await conexao.query(`SELECT id, status, matricula, nome FROM ra_candidatos WHERE id = ?`, [id]);
    if (!cand) throw new Error('Candidato não encontrado.');

    const eraDesligado = cand.status === 4;
    let novaMatricula = cand.matricula;

    if (eraDesligado) {
      // Recontratação: gera uma nova matrícula sequencial automática mantendo todo o histórico anterior
      novaMatricula = await gerarProximaMatricula(conexao);

      // Atualiza o histórico de desligamento anterior com os dados da recontratação
      try {
        await conexao.query(
          `UPDATE ra_historico_desligamentos
           SET data_recontratacao = NOW(),
               recontratado_por_id = ?,
               recontratado_por_nome = ?,
               matricula_sucessora = ?
           WHERE candidato_id = ? AND data_recontratacao IS NULL
           ORDER BY id DESC LIMIT 1`,
          [usuarioId ?? null, usuarioNome ?? null, novaMatricula, id]
        );
      } catch (errHist) {
        console.error('[RA] Erro ao atualizar histórico de recontratação:', errHist?.message);
      }

      await conexao.query(
        `UPDATE ra_candidatos
         SET status = 1,
             matricula = ?,
             inativado_em = NULL,
             inativado_por_id = NULL,
             inativado_por_nome = NULL,
             motivo_inativacao = NULL
         WHERE id = ?`,
        [novaMatricula, id]
      );

      // Alerta de recontratação
      try {
        const matAntiga = cand.matricula ? ` · Matrícula anterior: #${cand.matricula}` : '';
        await conexao.query(
          `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'recontratacao', ?)`,
          [
            id,
            `🔄 Cooperado ${cand.nome} foi recontratado por ${usuarioNome || 'Supervisão'}. Nova matrícula gerada: #${novaMatricula}${matAntiga}. Histórico anterior preservado.`
          ]
        );
      } catch (err) {
        console.error('Erro ao registrar alerta de recontratação:', err);
      }

      try {
        await conexao.query(
          `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
           VALUES (?, 'ra_candidatos', 'matricula', 'recontratacao', ?, ?, ?, ?, ?)`,
          [
            id,
            String(cand.matricula || 'sem matrícula'),
            String(novaMatricula),
            `Recontratação de cooperado pós-desligamento. Nova matrícula gerada: #${novaMatricula}. Matrícula anterior: #${cand.matricula || '—'}.`,
            usuarioId ?? null,
            usuarioNome ?? null,
          ]
        );
      } catch { /* auditoria opcional */ }
    } else {
      // Reativação de inativação simples (status = 2)
      await conexao.query(
        `UPDATE ra_candidatos
         SET status = 1, inativado_em = NULL, inativado_por_id = NULL, inativado_por_nome = NULL, motivo_inativacao = NULL
         WHERE id = ?`,
        [id]
      );

      try {
        await conexao.query(
          `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
           VALUES (?, 'ra_candidatos', 'status', 'edicao', '2', '1', 'Reativação de cooperado inativo.', ?, ?)`,
          [id, usuarioId ?? null, usuarioNome ?? null]
        );
      } catch { /* auditoria opcional */ }
    }

    await conexao.commit();
    return {
      ok: true,
      recontratado: eraDesligado,
      novaMatricula,
      matriculaAnterior: eraDesligado ? cand.matricula : undefined,
    };
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function excluirCandidato(id, { usuarioId, usuarioNome } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // Remove referências em tabelas filhas/dependentes
    try { await conexao.query(`DELETE FROM ra_alertas WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_auditoria WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_cotas_mensais WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_candidato_qualificacoes WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_candidatos_qualificacoes WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_descontos WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_documentos WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_dados_bancarios WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_dados_sensiveis WHERE candidato_id = ?`, [id]); } catch {}
    try { await conexao.query(`DELETE FROM ra_alocacoes WHERE candidato_id = ?`, [id]); } catch {}

    // Exclui o cooperado/candidato
    const [result] = await conexao.query(`DELETE FROM ra_candidatos WHERE id = ?`, [id]);

    await conexao.commit();
    return result.affectedRows > 0;
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
            COALESCE(c.nome, 'Cooperado') AS candidato_nome,
            c.cpf AS candidato_cpf,
            c.matricula AS candidato_matricula,
            c.tipo_contratacao
     FROM ra_alocacoes a
     LEFT JOIN ra_candidatos c ON c.id = a.candidato_id
     WHERE a.vaga_id = ?
     ORDER BY a.criado_em DESC`,
    [vagaId]
  );
  return rows;
}

export async function listarAlocacoesPorCandidato(candidatoId) {
  const [rows] = await pool.query(
    `SELECT a.*,
            e.nome_empresa, pu.nome_unidade, pv.cargo, pv.cbo
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

  const alocacaoId = res.insertId;

  // 1. Inicializa descontos padrão da cooperativa caso não existam
  try {
    await pool.query(
      `INSERT IGNORE INTO ra_descontos 
       (candidato_id, inss_percentual, seguro_vida_percentual, quota_parte_valor, quota_parcelada, quota_total_cotas, quota_cotas_pagas, rateio_percentual)
       VALUES (?, 20.00, 4.15, 1000.00, 1, 10, 0, 5.00)`,
      [candidatoId]
    );
  } catch (err) {
    console.error('Erro ao inicializar descontos padrão:', err);
  }

  // 2. Disparo automático de WhatsApp com link para o Portal do Cooperado
  try {
    const [[cand]] = await pool.query(`SELECT nome, telefone FROM ra_candidatos WHERE id = ?`, [candidatoId]);
    const [[vaga]] = await pool.query(`SELECT cargo, cbo FROM parametro_vagas WHERE id = ?`, [vagaId]);
    const [[emp]] = await pool.query(`SELECT nome_empresa FROM empresas WHERE id = ?`, [empresaId]);
    const [[unid]] = await pool.query(`SELECT nome_unidade FROM parametro_unidades WHERE id = ?`, [unidadeId]);

    if (cand && cand.telefone) {
      const baseUrl = (
        process.env.PORTAL_COOPERADO_URL ||
        process.env.APP_URL ||
        process.env.FRONTEND_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
        (process.env.NODE_ENV === 'production' ? 'https://atesa.connectortech.com.br' : 'http://localhost:8100')
      ).replace(/\/+$/, '');
      const token = Buffer.from(String(candidatoId)).toString('base64');
      const link = `${baseUrl}/cooperado/cadastro?token=${token}`;
      const cargoNome = vaga?.cargo || 'Vaga';
      const cboTexto = vaga?.cbo ? ` (CBO: ${vaga.cbo})` : '';
      const empNome = emp?.nome_empresa || '';
      const unidNome = unid?.nome_unidade || '';
      const mensagem = `Olá, ${cand.nome.split(' ')[0]}! 🌟\n\nVocê foi selecionado(a) para a vaga de *${cargoNome}*${cboTexto} na unidade ${unidNome} - ${empNome}!\n\nAcesse o link abaixo para visualizar os detalhes, completar seu cadastro com fotos/documentos, aceitar a vaga e baixar o aplicativo:\n\n${link}\n\nBem-vindo(a) à ATESA! 💙`;

      const zapiId = process.env.ZAPI_INSTANCE_ID;
      const zapiTok = process.env.ZAPI_TOKEN;
      if (zapiId && zapiTok && telefone) {
        try {
          const numero = telefone.startsWith('55') ? telefone : `55${telefone}`;
          await fetch(`https://api.z-api.io/instances/${zapiId}/token/${zapiTok}/send-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
            },
            body: JSON.stringify({ phone: numero, message: mensagem }),
          });
        } catch (err) {
          console.error('Erro ao chamar Z-API na alocação:', err);
        }
      }

      await pool.query(
        `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'whatsapp', ?)`,
        [candidatoId, `WhatsApp de aceite de vaga e cadastro enviado para ${cand.nome} (${cargoNome}).`]
      );

      await pool.query(
        `INSERT INTO ra_auditoria (candidato_id, tabela, acao, observacao, usuario_id, usuario_nome)
         VALUES (?, 'ra_alocacoes', 'whatsapp', ?, ?, ?)`,
        [candidatoId, `Notificação de vaga "${cargoNome}" enviada via WhatsApp para ${cand.nome}. Tel: ${telefone}`, usuarioId || null, usuarioNome || null]
      );
    }
  } catch (err) {
    console.error('Erro ao processar WhatsApp automático na alocação:', err);
  }

  return alocacaoId;
}

export async function encerrarAlocacao(id, { usuarioId, usuarioNome, dataFim, observacoes } = {}) {
  const [[aloc]] = await pool.query(
    `SELECT a.candidato_id, c.nome, pv.cargo, pu.nome_unidade, e.nome_empresa
     FROM ra_alocacoes a
     JOIN ra_candidatos c ON c.id = a.candidato_id
     JOIN parametro_vagas pv ON pv.id = a.vaga_id
     JOIN parametro_unidades pu ON pu.id = a.unidade_id
     JOIN empresas e ON e.id = a.empresa_id
     WHERE a.id = ?`,
    [id]
  );

  await pool.query(
    `UPDATE ra_alocacoes
     SET status = 'encerrada', data_fim = ?, encerrado_em = NOW(), encerrado_por_id = ?, encerrado_por_nome = ?,
         observacoes = COALESCE(?, observacoes)
     WHERE id = ?`,
    [dataFim ?? new Date().toISOString().substring(0, 10), usuarioId ?? null, usuarioNome ?? null, observacoes ?? null, id]
  );

  if (aloc) {
    try {
      await pool.query(
        `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'desligamento', ?)`,
        [
          aloc.candidato_id,
          `⚠️ Alocação de ${aloc.nome} na vaga ${aloc.cargo} (${aloc.nome_empresa} - ${aloc.nome_unidade}) foi encerrada por ${usuarioNome || 'Supervisão'}. Motivo/Obs: ${observacoes || 'Sem observações'}. Benefícios vinculados ao posto devem ser cancelados.`
        ]
      );
      await pool.query(
        `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
         VALUES (?, 'ra_alocacoes', 'status', 'encerramento', 'ativa', 'encerrada', ?, ?, ?)`,
        [
          aloc.candidato_id,
          `Encerramento da alocação na vaga ${aloc.cargo} (${aloc.nome_empresa} - ${aloc.nome_unidade}). Obs: ${observacoes || '-'}`,
          usuarioId || null,
          usuarioNome || null
        ]
      );
    } catch (err) {
      console.error('Erro ao gerar alerta de encerramento de alocação:', err);
    }
  }
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
      SUM(CASE WHEN status = 4 THEN 1 ELSE 0 END) AS desligados,
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
    SELECT pv.id, pv.cargo, pv.cbo, pv.quantidade AS total_vagas,
           pu.nome_unidade, e.nome_empresa,
           COALESCE(aloc.ocupadas, 0) AS ocupadas
    FROM parametro_vagas pv
    JOIN parametro_unidades pu ON pu.id = pv.unidade_id
    JOIN empresas e ON e.id = pu.empresa_id
    LEFT JOIN (
      SELECT vaga_id, COUNT(*) AS ocupadas
      FROM ra_alocacoes
      WHERE status = 'ativa'
      GROUP BY vaga_id
    ) aloc ON aloc.vaga_id = pv.id
    WHERE pv.ativa = 1
    ORDER BY (COALESCE(aloc.ocupadas, 0) / pv.quantidade) DESC
    LIMIT 10
  `);

  return {
    total_candidatos: Number(totais.total_candidatos || 0),
    pre_cadastro: Number(totais.pre_cadastro || 0),
    ativos: Number(totais.ativos || 0),
    inativos: Number(totais.inativos || 0),
    reprovados: Number(totais.reprovados || 0),
    desligados: Number(totais.desligados || 0),
    internos: Number(totais.internos || 0),
    externos: Number(totais.externos || 0),
    total_alocacoes: Number(alocacoes.total_alocacoes || 0),
    ativas: Number(alocacoes.ativas || 0),
    candidatos_alocados: Number(alocacoes.candidatos_alocados || 0),
    vagas_top: vagasOcupacao
  };
}

// ── Vagas (leitura do módulo Parâmetro com filtro de Tomador e Status) ─────────

export async function listarVagasDisponiveis({ empresaId, tomador, cargo, cooperativa, status } = {}) {
  let sql = `
    SELECT pv.id, pv.cargo, pv.cbo, pv.quantidade AS total_vagas, pv.tipo_escala, pv.periodicidade,
           pv.salario_base, pv.ativa,
           pu.id AS unidade_id, pu.nome_unidade,
           e.id AS empresa_id, e.nome_empresa, e.cooperativa,
           COALESCE(aloc.ocupadas, 0) AS ocupadas,
           (pv.quantidade - COALESCE(aloc.ocupadas, 0)) AS vagas_livres
    FROM parametro_vagas pv
    JOIN parametro_unidades pu ON pu.id = pv.unidade_id
    JOIN empresas e ON e.id = pu.empresa_id
    LEFT JOIN (
      SELECT vaga_id, COUNT(*) AS ocupadas
      FROM ra_alocacoes
      WHERE status = 'ativa'
      GROUP BY vaga_id
    ) aloc ON aloc.vaga_id = pv.id
    WHERE 1=1
  `;
  const params = [];

  if (status === 'abertas') {
    sql += ' AND pv.ativa = 1';
  } else if (status === 'fechadas') {
    sql += ' AND pv.ativa = 0';
  } else if (status === 'todas') {
    // não restringe por ativa
  } else {
    // Padrão: vagas abertas
    sql += ' AND pv.ativa = 1';
  }

  if (empresaId) { sql += ' AND e.id = ?'; params.push(empresaId); }
  if (tomador)   { sql += ' AND (e.nome_empresa LIKE ? OR pu.nome_unidade LIKE ?)'; params.push(`%${tomador}%`, `%${tomador}%`); }
  if (cargo)     { sql += ' AND pv.cargo LIKE ?'; params.push(`%${cargo}%`); }
  if (cooperativa) { sql += ' AND e.cooperativa = ?'; params.push(cooperativa); }

  sql += ' ORDER BY e.nome_empresa ASC, pu.nome_unidade ASC, pv.cargo ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function alternarAtivacaoVagaRA(vagaId, ativa, { usuarioId, usuarioNome, motivo } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[vaga]] = await conexao.query(`
      SELECT pv.cargo, pv.unidade_id, pu.empresa_id, pu.nome_unidade, e.nome_empresa
      FROM parametro_vagas pv
      JOIN parametro_unidades pu ON pu.id = pv.unidade_id
      JOIN empresas e ON e.id = pu.empresa_id
      WHERE pv.id = ?
    `, [vagaId]);

    if (!vaga) throw new Error('Vaga não encontrada.');

    await conexao.query('UPDATE parametro_vagas SET ativa = ? WHERE id = ?', [ativa ? 1 : 0, vagaId]);

    // Registro de log
    try {
      await conexao.query(`
        INSERT INTO parametro_logs (empresa_id, unidade_id, vaga_id, usuario_id, usuario_nome, acao, descricao)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        vaga.empresa_id,
        vaga.unidade_id,
        vagaId,
        usuarioId || null,
        usuarioNome || 'RA',
        ativa ? 'reabrir_vaga' : 'fechar_vaga',
        `${ativa ? 'Reabriu' : 'Fechou'} a vaga "${vaga.cargo}" (${vaga.nome_empresa} - ${vaga.nome_unidade})${motivo ? `. Motivo: ${motivo}` : ''}`
      ]);
    } catch {
      // silencioso se tabela parametro_logs não existir
    }

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Suporte e Acompanhamento de Adesões ─────────────────────────────────────

export async function listarSuporteCooperados({ busca, cooperativa, statusAdesao } = {}) {
  let sql = `
    SELECT c.id,
           c.nome,
           c.cpf,
           c.email,
           c.telefone,
           c.whatsapp,
           c.cooperativa,
           c.matricula,
           c.status,
           c.latitude,
           c.longitude,
           c.criado_em AS data_inicio,
           c.inativado_em,
           c.motivo_inativacao,
           p.id AS proposta_id,
           COALESCE(p.status_adesao, 'pendente') AS status_adesao,
           p.ip_registro,
           p.user_agent,
           p.video_assistido_em,
           p.declaracao_enviada_em,
           p.homologado_em,
           p.homologado_por_nome,
           p.dados_json,
           p.atualizado_em AS adesao_atualizado_em,
           (SELECT COUNT(*) FROM ra_documentos d WHERE d.candidato_id = c.id) AS total_documentos,
           (SELECT COUNT(*) FROM ra_documentos d WHERE d.candidato_id = c.id AND d.validado = 1) AS docs_validados,
           (SELECT COUNT(*) FROM ra_documentos d WHERE d.candidato_id = c.id AND d.rejeitado = 1) AS docs_rejeitados,
           (SELECT COUNT(*) FROM ra_documentos d WHERE d.candidato_id = c.id AND d.validado = 0 AND d.rejeitado = 0) AS docs_pendentes,
           (SELECT d.ip_envio FROM ra_documentos d WHERE d.candidato_id = c.id AND d.ip_envio IS NOT NULL ORDER BY d.id DESC LIMIT 1) AS ultimo_ip_doc
    FROM ra_candidatos c
    LEFT JOIN ra_proposta_adesao p ON p.candidato_id = c.id
    WHERE 1=1
  `;
  const params = [];

  if (cooperativa) {
    sql += ' AND c.cooperativa = ?';
    params.push(cooperativa);
  }
  if (statusAdesao) {
    if (statusAdesao === 'pendente') {
      sql += ' AND (p.status_adesao = "pendente" OR p.status_adesao IS NULL)';
    } else {
      sql += ' AND p.status_adesao = ?';
      params.push(statusAdesao);
    }
  }
  if (busca) {
    sql += ' AND (c.nome LIKE ? OR c.cpf LIKE ? OR c.matricula LIKE ? OR c.email LIKE ? OR p.ip_registro LIKE ?)';
    const like = `%${busca}%`;
    params.push(like, like, like, like, like);
  }

  sql += ' ORDER BY c.criado_em DESC, c.nome ASC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function buscarSuporteCooperadoDetalhe(id) {
  const [[c]] = await pool.query(
    `SELECT c.*,
            p.id AS proposta_id,
            COALESCE(p.status_adesao, 'pendente') AS status_adesao,
            p.ip_registro,
            p.user_agent,
            p.video_assistido_em,
            p.declaracao_enviada_em,
            p.homologado_em,
            p.homologado_por_nome,
            p.dados_json,
            p.atualizado_em AS adesao_atualizado_em
     FROM ra_candidatos c
     LEFT JOIN ra_proposta_adesao p ON p.candidato_id = c.id
     WHERE c.id = ?`,
    [id]
  );
  if (!c) return null;

  // Documentos com IP e status
  const [documentos] = await pool.query(
    `SELECT id, tipo, nome_original, mime_type, tamanho_bytes, validado, rejeitado, motivo_rejeicao, enviado_em, ip_envio, user_agent
     FROM ra_documentos
     WHERE candidato_id = ?
     ORDER BY id ASC`,
    [id]
  );

  // Dados sensíveis
  let dadosSensiveis = null;
  try {
    const [[ds]] = await pool.query(
      `SELECT * FROM ra_dados_sensiveis WHERE candidato_id = ?`,
      [id]
    );
    dadosSensiveis = ds || null;
  } catch {}

  // Dados bancários
  let dadosBancarios = null;
  try {
    const [[db]] = await pool.query(
      `SELECT * FROM ra_dados_bancarios WHERE candidato_id = ?`,
      [id]
    );
    dadosBancarios = db || null;
  } catch {}

  // Contatos de emergência
  let contatosEmergencia = [];
  try {
    const [ce] = await pool.query(
      `SELECT * FROM ra_contatos_emergencia WHERE candidato_id = ? ORDER BY id ASC`,
      [id]
    );
    contatosEmergencia = ce || [];
  } catch {}

  return {
    ...c,
    documentos: documentos || [],
    dadosSensiveis,
    dadosBancarios,
    contatosEmergencia,
  };
}
