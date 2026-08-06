import { pool } from '../config/database.js';

// ── Feriados nacionais brasileiros (2025-2026) ─────────────────────────────────
// Pré-calculados; atualizar conforme necessidade.
const FERIADOS = new Set([
  // 2025
  '2025-01-01','2025-04-18','2025-04-19','2025-04-20','2025-04-21',
  '2025-05-01','2025-06-19','2025-09-07','2025-10-12',
  '2025-11-02','2025-11-15','2025-11-20','2025-12-25',
  // 2026
  '2026-01-01','2026-04-03','2026-04-04','2026-04-21',
  '2026-05-01','2026-06-04','2026-09-07','2026-10-12',
  '2026-11-02','2026-11-15','2026-11-20','2026-12-25',
]);

/**
 * Gera datas de operação (Plantão 12x36) para os próximos 3 meses a partir de dataInicio.
 * Lógica: dias alternados (trabalha / folga), marcando feriados nacionais como 'feriado'.
 */
function gerarDatasAgenda(tipoEscala, dataInicio) {
  const inicio = new Date(dataInicio + 'T00:00:00');
  const fim = new Date(inicio);
  fim.setMonth(fim.getMonth() + 3);

  const datas = [];
  const cur = new Date(inicio);

  // Plantão 12x36: dias alternados (trabalha no dia 0, folga no dia 1, ...)
  let turno = 0; // 0 = trabalha, 1 = folga
  while (cur <= fim) {
    const iso = cur.toISOString().substring(0, 10);
    if (turno === 0) {
      datas.push({ data: iso, status: FERIADOS.has(iso) ? 'feriado' : 'previsto' });
    }
    turno = 1 - turno;
    cur.setDate(cur.getDate() + 1);
  }

  return datas;
}

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

    const tipoEscala = dados.tipoEscala ?? 'plantao';
    const [res] = await conexao.query(
      `INSERT INTO parametro_vagas
         (unidade_id, cargo, quantidade, salario_base, tipo_escala,
          adicional_noturno, periculosidade, insalubridade, premio_incentivo,
          valor_vr_dia, valor_vt_dia, dsr_percentual, periodicidade,
          tempo_pausa, tempo_refeicao, desconta_pausa, desconta_refeicao, recebe_por, data_inicio)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        unidadeId,
        dados.cargo,
        dados.quantidade ?? 1,
        dados.salarioBase ?? null,
        tipoEscala,
        dados.adicionalNoturno ? 1 : 0,
        dados.periculosidade ? 1 : 0,
        dados.insalubridade ?? 'sem_risco',
        dados.premioIncentivo ?? 0,
        dados.valorVrDia ?? 0,
        dados.valorVtDia ?? 0,
        dados.dsrPercentual ?? 16.67,
        dados.periodicidade ?? 'mensal',
        dados.tempoPausa ?? null,
        dados.tempoRefeicao ?? null,
        dados.descontaPausa ? 1 : 0,
        dados.descontaRefeicao ? 1 : 0,
        dados.recebePor ?? 'mes',
        dados.dataInicio ?? null,
      ]
    );

    const vagaId = res.insertId;

    // Gera agenda automática se houver data de início
    if (dados.dataInicio) {
      const datasAgenda = gerarDatasAgenda(tipoEscala, dados.dataInicio);
      if (datasAgenda.length > 0) {
        const valores = datasAgenda.map((d) => [vagaId, unidadeId, empresaId, d.data, d.status]);
        await conexao.query(
          `INSERT INTO parametro_agenda (vaga_id, unidade_id, empresa_id, data_operacao, status) VALUES ?`,
          [valores]
        );
      }
    }

    await registrarLog(conexao, {
      empresaId, unidadeId, vagaId, usuarioId, usuarioNome,
      acao: 'criar_vaga',
      descricao: `Criou a vaga "${dados.cargo}" (${dados.quantidade ?? 1} vaga${(dados.quantidade ?? 1) > 1 ? 's' : ''})`,
      dadosNovos: dados,
    });

    await conexao.commit();
    return vagaId;
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
           dsr_percentual = ?, periodicidade = ?,
           tempo_pausa = ?, tempo_refeicao = ?, desconta_pausa = ?, desconta_refeicao = ?, recebe_por = ?
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
        dados.tempoPausa ?? null,
        dados.tempoRefeicao ?? null,
        dados.descontaPausa ? 1 : 0,
        dados.descontaRefeicao ? 1 : 0,
        dados.recebePor ?? 'mes',
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

// ── Agenda de operação ────────────────────────────────────────────────────────

export async function listarAgendaVaga(vagaId) {
  const [linhas] = await pool.query(
    `SELECT * FROM parametro_agenda WHERE vaga_id = ? ORDER BY data_operacao ASC`,
    [vagaId]
  );
  return linhas;
}

export async function atualizarStatusAgenda(agendaId, status, observacoes, usuarioId, usuarioNome) {
  await pool.query(
    `UPDATE parametro_agenda
     SET status = ?, observacoes = ?, validado_por_id = ?, validado_por_nome = ?, validado_em = NOW()
     WHERE id = ?`,
    [status, observacoes ?? null, usuarioId, usuarioNome, agendaId]
  );
}

export async function regerarAgendaVaga(vagaId, unidadeId, empresaId, tipoEscala, dataInicio, usuarioId, usuarioNome) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // Remove agenda existente (apenas 'previsto' — mantém confirmados/cancelados)
    await conexao.query(
      `DELETE FROM parametro_agenda WHERE vaga_id = ? AND status = 'previsto'`,
      [vagaId]
    );

    const datasAgenda = gerarDatasAgenda(tipoEscala, dataInicio);
    if (datasAgenda.length > 0) {
      const valores = datasAgenda.map((d) => [vagaId, unidadeId, empresaId, d.data, d.status]);
      await conexao.query(
        `INSERT INTO parametro_agenda (vaga_id, unidade_id, empresa_id, data_operacao, status) VALUES ?`,
        [valores]
      );
    }

    await conexao.commit();
    return datasAgenda.length;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

// ── Cadastro primário (atividades da proposta) ────────────────────────────────

export async function listarAtividadesPrimarias(empresaId) {
  const [linhas] = await pool.query(
    `SELECT pa.id, pa.cargo, pa.quantidade, pa.salario_base, pa.tipo_escala,
            pa.adicional_noturno, pa.periculosidade, pa.insalubridade,
            pa.premio_incentivo, pa.vr_dias, pa.vt_dias,
            t.id AS trabalho_id, t.titulo AS trabalho_titulo
     FROM proposta_atividades pa
     JOIN trabalhos t ON t.id = pa.trabalho_id
     WHERE t.empresa_id = ?
     ORDER BY t.criado_em DESC, pa.ordem ASC`,
    [empresaId]
  );
  return linhas;
}
