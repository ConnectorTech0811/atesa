import { pool } from '../config/database.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function registrarLog(conexao, { empresaId, unidadeId = null, vagaId = null, usuarioId, usuarioNome, acao, descricao, dadosAnteriores = null, dadosNovos = null }) {
  await conexao.query(
    `INSERT INTO parametro_log_acoes
       (empresa_id, unidade_id, vaga_id, usuario_id, usuario_nome, acao, descricao, dados_anteriores, dados_novos)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      empresaId,
      unidadeId,
      vagaId,
      usuarioId,
      usuarioNome,
      acao,
      descricao,
      dadosAnteriores ? JSON.stringify(dadosAnteriores) : null,
      dadosNovos ? JSON.stringify(dadosNovos) : null,
    ]
  );
}

// ── Empresas (listagem para o módulo parâmetro) ───────────────────────────────

export async function listarEmpresasParametro() {
  const [linhas] = await pool.query(
    `SELECT e.id, e.nome_empresa, e.cnpj, e.cpf, e.status, e.executivo_nome,
            e.regiao_nome, e.criado_em,
            COUNT(DISTINCT pu.id) AS total_unidades,
            SUM(CASE WHEN pu.ativa = 1 THEN 1 ELSE 0 END) AS unidades_ativas
     FROM empresas e
     LEFT JOIN parametro_unidades pu ON pu.empresa_id = e.id
     GROUP BY e.id
     ORDER BY e.nome_empresa ASC`
  );
  return linhas;
}

// ── Unidades ──────────────────────────────────────────────────────────────────

export async function listarUnidadesPorEmpresa(empresaId) {
  const [unidades] = await pool.query(
    `SELECT * FROM parametro_unidades WHERE empresa_id = ? ORDER BY criado_em ASC`,
    [empresaId]
  );

  if (unidades.length === 0) return [];

  const ids = unidades.map((u) => u.id);
  const [vagas] = await pool.query(
    `SELECT * FROM parametro_vagas WHERE unidade_id IN (?) ORDER BY criado_em ASC`,
    [ids]
  );

  const vagasPorUnidade = {};
  for (const v of vagas) {
    if (!vagasPorUnidade[v.unidade_id]) vagasPorUnidade[v.unidade_id] = [];
    vagasPorUnidade[v.unidade_id].push(v);
  }

  return unidades.map((u) => ({ ...u, vagas: vagasPorUnidade[u.id] ?? [] }));
}

export async function criarUnidade(empresaId, dados, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [res] = await conexao.query(
      `INSERT INTO parametro_unidades
         (empresa_id, nome_unidade, endereco, contato_responsavel, observacoes, criado_por_id, criado_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        empresaId,
        dados.nomeUnidade,
        dados.endereco ?? null,
        dados.contatoResponsavel ?? null,
        dados.observacoes ?? null,
        usuarioId,
        usuarioNome,
      ]
    );

    await registrarLog(conexao, {
      empresaId, unidadeId: res.insertId, usuarioId, usuarioNome,
      acao: 'criar_unidade',
      descricao: `Criou a unidade "${dados.nomeUnidade}"`,
      dadosNovos: dados,
    });

    await conexao.commit();
    return res.insertId;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function atualizarUnidade(unidadeId, dados, empresaId, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[anterior]] = await conexao.query('SELECT * FROM parametro_unidades WHERE id = ?', [unidadeId]);

    await conexao.query(
      `UPDATE parametro_unidades
       SET nome_unidade = ?, endereco = ?, contato_responsavel = ?, observacoes = ?
       WHERE id = ?`,
      [dados.nomeUnidade, dados.endereco ?? null, dados.contatoResponsavel ?? null, dados.observacoes ?? null, unidadeId]
    );

    await registrarLog(conexao, {
      empresaId, unidadeId, usuarioId, usuarioNome,
      acao: 'editar_unidade',
      descricao: `Editou a unidade "${dados.nomeUnidade}"`,
      dadosAnteriores: anterior,
      dadosNovos: dados,
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function alternarAtivacaoUnidade(unidadeId, ativa, empresaId, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[unidade]] = await conexao.query('SELECT nome_unidade FROM parametro_unidades WHERE id = ?', [unidadeId]);

    await conexao.query('UPDATE parametro_unidades SET ativa = ? WHERE id = ?', [ativa, unidadeId]);

    await registrarLog(conexao, {
      empresaId, unidadeId, usuarioId, usuarioNome,
      acao: ativa ? 'ativar_unidade' : 'inativar_unidade',
      descricao: `${ativa ? 'Ativou' : 'Inativou'} a unidade "${unidade.nome_unidade}"`,
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Vagas ─────────────────────────────────────────────────────────────────────

export async function criarVaga(unidadeId, empresaId, dados, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [res] = await conexao.query(
      `INSERT INTO parametro_vagas
         (unidade_id, cargo, quantidade, salario_base, tipo_escala,
          adicional_noturno, periculosidade, insalubridade, premio_incentivo,
          valor_vr_dia, valor_vt_dia, dsr_percentual, periodicidade)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unidadeId,
        dados.cargo,
        dados.quantidade ?? 1,
        dados.salarioBase ?? null,
        dados.tipoEscala ?? 'plantao',
        dados.adicionalNoturno ? 1 : 0,
        dados.periculosidade ? 1 : 0,
        dados.insalubridade ?? 'sem_risco',
        dados.premioIncentivo ?? 0,
        dados.valorVrDia ?? 0,
        dados.valorVtDia ?? 0,
        dados.dsrPercentual ?? 16.67,
        dados.periodicidade ?? 'mensal',
      ]
    );

    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId: res.insertId, usuarioId, usuarioNome,
      acao: 'criar_vaga',
      descricao: `Criou a vaga "${dados.cargo}" (${dados.quantidade ?? 1} vaga${(dados.quantidade ?? 1) > 1 ? 's' : ''})`,
      dadosNovos: dados,
    });

    await conexao.commit();
    return res.insertId;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function atualizarVaga(vagaId, unidadeId, empresaId, dados, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[anterior]] = await conexao.query('SELECT * FROM parametro_vagas WHERE id = ?', [vagaId]);

    await conexao.query(
      `UPDATE parametro_vagas
       SET cargo = ?, quantidade = ?, salario_base = ?, tipo_escala = ?,
           adicional_noturno = ?, periculosidade = ?, insalubridade = ?,
           premio_incentivo = ?, valor_vr_dia = ?, valor_vt_dia = ?,
           dsr_percentual = ?, periodicidade = ?
       WHERE id = ?`,
      [
        dados.cargo,
        dados.quantidade ?? 1,
        dados.salarioBase ?? null,
        dados.tipoEscala ?? 'plantao',
        dados.adicionalNoturno ? 1 : 0,
        dados.periculosidade ? 1 : 0,
        dados.insalubridade ?? 'sem_risco',
        dados.premioIncentivo ?? 0,
        dados.valorVrDia ?? 0,
        dados.valorVtDia ?? 0,
        dados.dsrPercentual ?? 16.67,
        dados.periodicidade ?? 'mensal',
        vagaId,
      ]
    );

    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId, usuarioId, usuarioNome,
      acao: 'editar_vaga',
      descricao: `Editou a vaga "${dados.cargo}"`,
      dadosAnteriores: anterior,
      dadosNovos: dados,
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function registrarIncremento(vagaId, unidadeId, empresaId, dados, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[vaga]] = await conexao.query('SELECT cargo, quantidade FROM parametro_vagas WHERE id = ?', [vagaId]);
    const qtdAnterior = vaga.quantidade;
    const qtdNova = qtdAnterior + dados.delta;

    if (qtdNova < 0) throw new Error('Quantidade não pode ser negativa.');

    await conexao.query('UPDATE parametro_vagas SET quantidade = ? WHERE id = ?', [qtdNova, vagaId]);

    await conexao.query(
      `INSERT INTO parametro_incrementos
         (vaga_id, quantidade_anterior, quantidade_nova, motivo, registrado_por_id, registrado_por_nome, data_incremento)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [vagaId, qtdAnterior, qtdNova, dados.motivo ?? null, usuarioId, usuarioNome, dados.dataIncremento]
    );

    const sinal = dados.delta >= 0 ? `+${dados.delta}` : String(dados.delta);
    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId, usuarioId, usuarioNome,
      acao: 'incremento_vaga',
      descricao: `Alterou quantidade da vaga "${vaga.cargo}": ${qtdAnterior} → ${qtdNova} (${sinal})`,
      dadosNovos: { delta: dados.delta, motivo: dados.motivo, dataIncremento: dados.dataIncremento },
    });

    await conexao.commit();
    return { quantidadeAnterior: qtdAnterior, quantidadeNova: qtdNova };
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function alternarAtivacaoVaga(vagaId, ativa, unidadeId, empresaId, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[vaga]] = await conexao.query('SELECT cargo FROM parametro_vagas WHERE id = ?', [vagaId]);
    await conexao.query('UPDATE parametro_vagas SET ativa = ? WHERE id = ?', [ativa, vagaId]);

    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId, usuarioId, usuarioNome,
      acao: ativa ? 'ativar_vaga' : 'inativar_vaga',
      descricao: `${ativa ? 'Ativou' : 'Inativou'} a vaga "${vaga.cargo}"`,
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function listarIncrementosPorVaga(vagaId) {
  const [linhas] = await pool.query(
    `SELECT * FROM parametro_incrementos WHERE vaga_id = ? ORDER BY criado_em DESC`,
    [vagaId]
  );
  return linhas;
}

// ── Status empresa ─────────────────────────────────────────────────────────────

export async function alterarStatusEmpresa(empresaId, novoStatus, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[empresa]] = await conexao.query('SELECT nome_empresa, status FROM empresas WHERE id = ?', [empresaId]);
    const statusAnterior = empresa.status;

    await conexao.query('UPDATE empresas SET status = ? WHERE id = ?', [novoStatus, empresaId]);

    await registrarLog(conexao, {
      empresaId, usuarioId, usuarioNome,
      acao: 'alterar_status_empresa',
      descricao: `Alterou status de "${statusAnterior}" para "${novoStatus}" — empresa "${empresa.nome_empresa}"`,
      dadosAnteriores: { status: statusAnterior },
      dadosNovos: { status: novoStatus },
    });

    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Log ───────────────────────────────────────────────────────────────────────

export async function listarLog(empresaId, limit = 100) {
  const [linhas] = await pool.query(
    `SELECT * FROM parametro_log_acoes
     WHERE empresa_id = ?
     ORDER BY criado_em DESC
     LIMIT ?`,
    [empresaId, limit]
  );
  return linhas;
}
