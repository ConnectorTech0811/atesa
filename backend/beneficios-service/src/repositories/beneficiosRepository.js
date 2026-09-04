import { pool } from '../config/database.js';
// beneficios-service — cópia standalone sem dependência do ra-service

// Garante colunas no banco
async function inicializarColunas() {
  try { await pool.query(`ALTER TABLE ra_dados_sensiveis ADD COLUMN cbo VARCHAR(20) NULL`); } catch {}
}
inicializarColunas().catch(() => {});

// ── Dados Sensíveis ───────────────────────────────────────────────────────────

export async function obterDadosSensiveis(candidatoId) {
  const [[row]] = await pool.query(
    `SELECT * FROM ra_dados_sensiveis WHERE candidato_id = ?`,
    [candidatoId]
  );
  return row ?? null;
}

export async function salvarDadosSensiveis(candidatoId, dados) {
  const {
    data_nascimento, rg, orgao_emissor, uf_rg, nome_mae, nome_pai,
    estado_civil, naturalidade, nacionalidade, cep, logradouro, numero,
    complemento, bairro, cidade, uf, pis_pasep, titulo_eleitor,
    cnh, categoria_cnh, cbo, qualificacoes,
  } = dados;

  await pool.query(
    `INSERT INTO ra_dados_sensiveis
       (candidato_id, data_nascimento, rg, orgao_emissor, uf_rg, nome_mae, nome_pai,
        estado_civil, naturalidade, nacionalidade, cep, logradouro, numero, complemento,
        bairro, cidade, uf, pis_pasep, titulo_eleitor, cnh, categoria_cnh, cbo, qualificacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       data_nascimento = VALUES(data_nascimento), rg = VALUES(rg),
       orgao_emissor = VALUES(orgao_emissor), uf_rg = VALUES(uf_rg),
       nome_mae = VALUES(nome_mae), nome_pai = VALUES(nome_pai),
       estado_civil = VALUES(estado_civil), naturalidade = VALUES(naturalidade),
       nacionalidade = VALUES(nacionalidade), cep = VALUES(cep),
       logradouro = VALUES(logradouro), numero = VALUES(numero),
       complemento = VALUES(complemento), bairro = VALUES(bairro),
       cidade = VALUES(cidade), uf = VALUES(uf), pis_pasep = VALUES(pis_pasep),
       titulo_eleitor = VALUES(titulo_eleitor), cnh = VALUES(cnh),
       categoria_cnh = VALUES(categoria_cnh), cbo = VALUES(cbo), qualificacoes = VALUES(qualificacoes),
       atualizado_em = NOW()`,
    [
      candidatoId,
      data_nascimento || null, rg || null, orgao_emissor || null, uf_rg || null,
      nome_mae || null, nome_pai || null, estado_civil || null,
      naturalidade || null, nacionalidade || 'Brasileiro(a)',
      cep || null, logradouro || null, numero || null, complemento || null,
      bairro || null, cidade || null, uf || null,
      pis_pasep || null, titulo_eleitor || null, cnh || null,
      categoria_cnh || null, cbo || null, qualificacoes || null,
    ]
  );
}

// ── Dados Bancários ───────────────────────────────────────────────────────────

export async function obterDadosBancarios(candidatoId) {
  const [[row]] = await pool.query(
    `SELECT * FROM ra_dados_bancarios WHERE candidato_id = ?`,
    [candidatoId]
  );
  return row ?? null;
}

export async function salvarDadosBancarios(candidatoId, dados) {
  const { banco, codigo_banco, agencia, conta, digito, tipo_conta, chave_pix, tipo_pix } = dados;

  await pool.query(
    `INSERT INTO ra_dados_bancarios
       (candidato_id, banco, codigo_banco, agencia, conta, digito, tipo_conta, chave_pix, tipo_pix)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       banco = VALUES(banco), codigo_banco = VALUES(codigo_banco),
       agencia = VALUES(agencia), conta = VALUES(conta), digito = VALUES(digito),
       tipo_conta = VALUES(tipo_conta), chave_pix = VALUES(chave_pix),
       tipo_pix = VALUES(tipo_pix), atualizado_em = NOW()`,
    [
      candidatoId,
      banco || null, codigo_banco || null, agencia || null,
      conta || null, digito || null, tipo_conta || 'corrente',
      chave_pix || null, tipo_pix || null,
    ]
  );
}

// ── Documentos ────────────────────────────────────────────────────────────────

export async function listarDocumentos(candidatoId) {
  const [rows] = await pool.query(
    `SELECT id, candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes,
            validado, validado_por_nome, validado_em, observacao, enviado_em, enviado_por_nome,
            rejeitado, motivo_rejeicao, rejeitado_por_nome, rejeitado_em
     FROM ra_documentos WHERE candidato_id = ? ORDER BY enviado_em DESC`,
    [candidatoId]
  );
  return rows;
}

export async function inserirDocumento({ candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, conteudoBlob, enviadoPorNome }) {
  const [result] = await pool.query(
    `INSERT INTO ra_documentos
       (candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes, conteudo_blob, enviado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, conteudoBlob ?? null, enviadoPorNome || null]
  );
  return result.insertId;
}

export async function validarDocumento(docId, validadoPorNome) {
  await pool.query(
    `UPDATE ra_documentos SET validado = 1, rejeitado = 0,
       motivo_rejeicao = NULL, validado_por_nome = ?, validado_em = NOW() WHERE id = ?`,
    [validadoPorNome, docId]
  );
}

export async function rejeitarDocumento(docId, motivo, rejeitadoPorNome) {
  await pool.query(
    `UPDATE ra_documentos
     SET rejeitado = 1, validado = 0, motivo_rejeicao = ?,
         rejeitado_por_nome = ?, rejeitado_em = NOW()
     WHERE id = ?`,
    [motivo || null, rejeitadoPorNome, docId]
  );
}

export async function removerDocumento(docId) {
  const [[row]] = await pool.query(
    `SELECT nome_arquivo FROM ra_documentos WHERE id = ?`,
    [docId]
  );
  if (!row) return null;
  await pool.query(`DELETE FROM ra_documentos WHERE id = ?`, [docId]);
  return row.nome_arquivo;
}

export async function obterDocumento(docId) {
  const [[row]] = await pool.query(
    `SELECT id, candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes, conteudo_blob,
            validado, validado_por_nome, validado_em, observacao, enviado_em, enviado_por_nome,
            rejeitado, motivo_rejeicao, rejeitado_por_nome, rejeitado_em
     FROM ra_documentos WHERE id = ?`,
    [docId]
  );
  return row ?? null;
}

// ── Descontos ─────────────────────────────────────────────────────────────────

export async function obterDescontos(candidatoId) {
  const [[row]] = await pool.query(
    `SELECT * FROM ra_descontos WHERE candidato_id = ?`,
    [candidatoId]
  );
  return row ?? null;
}

export async function salvarDescontos(candidatoId, dados) {
  const {
    inss_percentual, seguro_vida_percentual, quota_parte_valor,
    quota_parcelada, quota_total_cotas, quota_cotas_pagas,
    rateio_percentual, outras_descricao, outras_valor,
  } = dados;

  await pool.query(
    `INSERT INTO ra_descontos
       (candidato_id, inss_percentual, seguro_vida_percentual, quota_parte_valor,
        quota_parcelada, quota_total_cotas, quota_cotas_pagas,
        rateio_percentual, outras_descricao, outras_valor)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       inss_percentual = VALUES(inss_percentual),
       seguro_vida_percentual = VALUES(seguro_vida_percentual),
       quota_parte_valor = VALUES(quota_parte_valor),
       quota_parcelada = VALUES(quota_parcelada),
       quota_total_cotas = VALUES(quota_total_cotas),
       quota_cotas_pagas = VALUES(quota_cotas_pagas),
       rateio_percentual = VALUES(rateio_percentual),
       outras_descricao = VALUES(outras_descricao),
       outras_valor = VALUES(outras_valor),
       atualizado_em = NOW()`,
    [
      candidatoId,
      Number(inss_percentual ?? 0), Number(seguro_vida_percentual ?? 0),
      Number(quota_parte_valor ?? 0),
      quota_parcelada ? 1 : 0,
      quota_total_cotas ?? null, Number(quota_cotas_pagas ?? 0),
      Number(rateio_percentual ?? 0),
      outras_descricao || null, Number(outras_valor ?? 0),
    ]
  );
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export async function listarAlertas({ lido, tipo, busca, limite = 500 } = {}) {
  let sql = `
    SELECT a.*, c.nome AS candidato_nome, c.cpf AS candidato_cpf, c.matricula
    FROM ra_alertas a
    JOIN ra_candidatos c ON c.id = a.candidato_id
    WHERE 1=1
  `;
  const params = [];
  if (lido !== undefined) { sql += ' AND a.lido = ?'; params.push(lido ? 1 : 0); }
  if (tipo && tipo !== 'Todos') { sql += ' AND a.tipo = ?'; params.push(tipo); }
  if (busca) {
    sql += ' AND (c.nome LIKE ? OR c.cpf LIKE ? OR c.matricula LIKE ? OR a.mensagem LIKE ?)';
    const like = `%${busca}%`;
    params.push(like, like, like, like);
  }
  sql += ' ORDER BY a.criado_em DESC LIMIT ?';
  params.push(Number(limite) || 500);
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function criarAlerta(candidatoId, tipo, mensagem) {
  await pool.query(
    `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, ?, ?)`,
    [candidatoId, tipo, mensagem]
  );
}

export async function marcarAlertaLido(alertaId) {
  await pool.query(`UPDATE ra_alertas SET lido = 1 WHERE id = ?`, [alertaId]);
}

export async function marcarTodosLidos() {
  await pool.query(`UPDATE ra_alertas SET lido = 1 WHERE lido = 0`);
}

// ── Auditoria ─────────────────────────────────────────────────────────────────

export async function registrarAuditoria({ candidatoId, tabela, campo, acao, valorAnterior, valorNovo, observacao, usuarioId, usuarioNome }) {
  await pool.query(
    `INSERT INTO ra_auditoria
       (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      candidatoId, tabela, campo || null, acao,
      valorAnterior ?? null, valorNovo ?? null, observacao || null,
      usuarioId || null, usuarioNome || null,
    ]
  );
}

export async function listarAuditoria(candidatoId, { limite = 100 } = {}) {
  const [rows] = await pool.query(
    `SELECT * FROM ra_auditoria WHERE candidato_id = ? ORDER BY criado_em DESC LIMIT ?`,
    [candidatoId, limite]
  );
  return rows;
}

// ── Qualificações — Catálogo ──────────────────────────────────────────────────

export async function listarQualificacoesCatalogo() {
  const [rows] = await pool.query(
    `SELECT * FROM ra_qualificacoes_catalogo WHERE ativo = 1 ORDER BY categoria, nome`
  );
  return rows;
}

export async function criarQualificacaoCatalogo(nome, categoria) {
  const [result] = await pool.query(
    `INSERT INTO ra_qualificacoes_catalogo (nome, categoria) VALUES (?, ?)`,
    [nome, categoria || null]
  );
  return result.insertId;
}

// ── Qualificações — Por Candidato ─────────────────────────────────────────────

export async function obterQualificacoesCandidato(candidatoId) {
  const [rows] = await pool.query(
    `SELECT q.id, q.nome, q.categoria
     FROM ra_candidato_qualificacoes cq
     JOIN ra_qualificacoes_catalogo q ON q.id = cq.qualificacao_id
     WHERE cq.candidato_id = ?
     ORDER BY q.categoria, q.nome`,
    [candidatoId]
  );
  return rows;
}

export async function salvarQualificacoesCandidato(candidatoId, qualificacaoIds) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(`DELETE FROM ra_candidato_qualificacoes WHERE candidato_id = ?`, [candidatoId]);
    if (qualificacaoIds.length > 0) {
      const values = qualificacaoIds.map((qid) => [candidatoId, qid]);
      await conn.query(
        `INSERT IGNORE INTO ra_candidato_qualificacoes (candidato_id, qualificacao_id) VALUES ?`,
        [values]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

// ── Cotas Mensais ─────────────────────────────────────────────────────────────

export async function listarCotasMensais(candidatoId) {
  const [rows] = await pool.query(
    `SELECT * FROM ra_cotas_mensais WHERE candidato_id = ? ORDER BY criado_em DESC`,
    [candidatoId]
  );
  return rows;
}

export async function criarCotaMensal({ candidatoId, descricao, tipo, valor, totalParcelas, recorrente, observacao }) {
  const [result] = await pool.query(
    `INSERT INTO ra_cotas_mensais
       (candidato_id, descricao, tipo, valor, total_parcelas, recorrente, observacao)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [candidatoId, descricao, tipo || 'outro', Number(valor), totalParcelas ?? null, recorrente ? 1 : 0, observacao || null]
  );
  return result.insertId;
}

export async function atualizarCotaMensal(cotaId, { descricao, tipo, valor, totalParcelas, parcelasPagas, recorrente, ativa, observacao }) {
  await pool.query(
    `UPDATE ra_cotas_mensais SET
       descricao = ?, tipo = ?, valor = ?, total_parcelas = ?,
       parcelas_pagas = ?, recorrente = ?, ativa = ?, observacao = ?
     WHERE id = ?`,
    [descricao, tipo, Number(valor), totalParcelas ?? null, Number(parcelasPagas ?? 0), recorrente ? 1 : 0, ativa ? 1 : 0, observacao || null, cotaId]
  );
}

export async function removerCotaMensal(cotaId) {
  await pool.query(`DELETE FROM ra_cotas_mensais WHERE id = ?`, [cotaId]);
}

// ── Fechamento Mensal de Quota Parte ──────────────────────────────────────────

export async function processarFechamentoMensal(candidatoId, usuarioId, usuarioNome) {
  const [[desc]] = await pool.query(
    `SELECT * FROM ra_descontos WHERE candidato_id = ?`,
    [candidatoId]
  );
  if (!desc) {
    throw new Error('Descontos não configurados para este cooperado.');
  }

  const cotasPagasAtuais = Number(desc.quota_cotas_pagas || 0);
  const totalCotas = desc.quota_total_cotas ? Number(desc.quota_total_cotas) : null;
  const parcelada = Boolean(desc.quota_parcelada);

  let novasCotasPagas = cotasPagasAtuais;
  let quitado = false;

  if (parcelada && totalCotas) {
    if (cotasPagasAtuais < totalCotas) {
      novasCotasPagas = cotasPagasAtuais + 1;
      quitado = novasCotasPagas >= totalCotas;
    } else {
      quitado = true;
    }
  } else {
    quitado = true;
  }

  await pool.query(
    `UPDATE ra_descontos SET quota_cotas_pagas = ?, atualizado_em = NOW() WHERE candidato_id = ?`,
    [novasCotasPagas, candidatoId]
  );

  // Também avança parcelas de cotas mensais ativas
  await pool.query(
    `UPDATE ra_cotas_mensais 
     SET parcelas_pagas = LEAST(COALESCE(total_parcelas, parcelas_pagas + 1), parcelas_pagas + 1)
     WHERE candidato_id = ? AND ativa = 1 AND total_parcelas IS NOT NULL AND parcelas_pagas < total_parcelas`,
    [candidatoId]
  );

  const observacao = `Fechamento mensal processado por ${usuarioNome || 'Sistema'}. Quota parte: ${novasCotasPagas}/${totalCotas || 'única'} cotas pagas.${quitado ? ' (Quitado)' : ''}`;

  await registrarAuditoria({
    candidatoId,
    tabela: 'ra_descontos',
    campo: 'quota_cotas_pagas',
    acao: 'edicao',
    valorAnterior: String(cotasPagasAtuais),
    valorNovo: String(novasCotasPagas),
    observacao,
    usuarioId,
    usuarioNome,
  });

  await criarAlerta(
    candidatoId,
    'fechamento_mensal',
    `Fechamento mensal processado. Quota parte: ${novasCotasPagas}/${totalCotas || 'única'} cotas pagas.`
  );

  return {
    candidatoId,
    cotasPagasAnteriores: cotasPagasAtuais,
    novasCotasPagas,
    totalCotas,
    quitado,
  };
}

// ── Geração de Matrícula Sequencial de Benefícios (Base: 34635) ───────────────

export async function gerarProximaMatriculaBeneficios(conexao = pool) {
  const [[row]] = await conexao.query(
    `SELECT MAX(CAST(matricula AS UNSIGNED)) AS maxMatricula FROM ra_candidatos WHERE matricula REGEXP '^[0-9]+$'`
  );
  const base = 34635;
  const maior = Number(row?.maxMatricula) || 0;
  if (maior < base) {
    return String(base);
  }
  return String(maior + 1);
}

export async function garantirMatriculaCooperado(candidatoId, conexao = pool) {
  const [[c]] = await conexao.query(`SELECT id, matricula FROM ra_candidatos WHERE id = ?`, [candidatoId]);
  if (!c) return null;
  if (c.matricula && /^\d+$/.test(String(c.matricula).trim()) && Number(c.matricula) >= 34635) {
    return String(c.matricula).trim();
  }

  const novaMatricula = await gerarProximaMatriculaBeneficios(conexao);
  await conexao.query(`UPDATE ra_candidatos SET matricula = ? WHERE id = ?`, [novaMatricula, candidatoId]);
  return novaMatricula;
}

// ── Portal do Cooperado (Web) ─────────────────────────────────────────────────

export async function obterDadosCompletosPortal(candidatoId) {
  // Garante matrícula numérica gerada em Benefícios
  const matricula = await garantirMatriculaCooperado(candidatoId);

  const [[candidato]] = await pool.query(
    `SELECT id, nome, cpf, email, telefone, whatsapp, cooperativa, matricula, status, tipo_contratacao, criado_em
     FROM ra_candidatos WHERE id = ?`,
    [candidatoId]
  );
  if (!candidato) return null;
  if (matricula) candidato.matricula = matricula;

  const [[sensiveis]] = await pool.query(
    `SELECT * FROM ra_dados_sensiveis WHERE candidato_id = ?`,
    [candidatoId]
  );

  const [[bancarios]] = await pool.query(
    `SELECT * FROM ra_dados_bancarios WHERE candidato_id = ?`,
    [candidatoId]
  );

  const [documentos] = await pool.query(
    `SELECT id, tipo, nome_original, mime_type, tamanho_bytes, validado, rejeitado, motivo_rejeicao, enviado_em
     FROM ra_documentos WHERE candidato_id = ? ORDER BY enviado_em DESC`,
    [candidatoId]
  );

  const [alocacoes] = await pool.query(
    `SELECT a.*, e.nome_empresa, pu.nome_unidade, pv.cargo, pv.cbo, pv.salario_base, pv.tipo_escala, pv.periodicidade
     FROM ra_alocacoes a
     LEFT JOIN empresas e ON e.id = a.empresa_id
     LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
     LEFT JOIN parametro_vagas pv ON pv.id = a.vaga_id
     WHERE a.candidato_id = ?
     ORDER BY a.criado_em DESC`,
    [candidatoId]
  );

  return {
    candidato,
    dadosSensiveis: sensiveis ?? null,
    dadosBancarios: bancarios ?? null,
    documentos,
    alocacaoAtual: alocacoes[0] ?? null,
    alocacoes,
  };
}

export async function aceitarVagaPortal(candidatoId, { observacoes } = {}) {
  const matricula = await garantirMatriculaCooperado(candidatoId);

  const [[alocacao]] = await pool.query(
    `SELECT a.*, pv.cargo, pv.cbo, e.nome_empresa, pu.nome_unidade
     FROM ra_alocacoes a
     LEFT JOIN parametro_vagas pv ON pv.id = a.vaga_id
     LEFT JOIN empresas e ON e.id = a.empresa_id
     LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
     WHERE a.candidato_id = ? AND a.status = 'ativa'
     ORDER BY a.criado_em DESC LIMIT 1`,
    [candidatoId]
  );

  if (alocacao) {
    await pool.query(
      `UPDATE ra_alocacoes SET observacoes = CONCAT(COALESCE(observacoes, ''), '\n[Aceite confirmado pelo cooperado — Matrícula: ', ?, ' via Portal]') WHERE id = ?`,
      [matricula || 'Homologada', alocacao.id]
    );
  }

  await pool.query(
    `UPDATE ra_candidatos SET status = 1, aprovado_em = COALESCE(aprovado_em, NOW()), matricula = COALESCE(matricula, ?) WHERE id = ? AND status = 0`,
    [matricula, candidatoId]
  );

  await criarAlerta(
    candidatoId,
    'aceite_vaga',
    `🎉 Cooperado confirmou e aceitou a vaga ${alocacao ? `"${alocacao.cargo}" na ${alocacao.nome_unidade}` : ''} (Matrícula: ${matricula}) via Portal Web!`
  );

  await registrarAuditoria({
    candidatoId,
    tabela: 'ra_alocacoes',
    acao: 'validacao',
    observacao: `Vaga aceita pelo cooperado através do Portal Web. Matrícula: ${matricula}. ${observacoes || ''}`,
    usuarioNome: 'Portal do Cooperado',
  });

  return { ok: true, matricula, alocacaoId: alocacao?.id ?? null };
}
