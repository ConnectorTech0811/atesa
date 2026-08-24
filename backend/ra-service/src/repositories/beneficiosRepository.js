import { pool } from '../config/database.js';

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
    cnh, categoria_cnh, qualificacoes,
  } = dados;

  await pool.query(
    `INSERT INTO ra_dados_sensiveis
       (candidato_id, data_nascimento, rg, orgao_emissor, uf_rg, nome_mae, nome_pai,
        estado_civil, naturalidade, nacionalidade, cep, logradouro, numero, complemento,
        bairro, cidade, uf, pis_pasep, titulo_eleitor, cnh, categoria_cnh, qualificacoes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       categoria_cnh = VALUES(categoria_cnh), qualificacoes = VALUES(qualificacoes),
       atualizado_em = NOW()`,
    [
      candidatoId,
      data_nascimento || null, rg || null, orgao_emissor || null, uf_rg || null,
      nome_mae || null, nome_pai || null, estado_civil || null,
      naturalidade || null, nacionalidade || 'Brasileiro(a)',
      cep || null, logradouro || null, numero || null, complemento || null,
      bairro || null, cidade || null, uf || null,
      pis_pasep || null, titulo_eleitor || null, cnh || null,
      categoria_cnh || null, qualificacoes || null,
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
    `SELECT * FROM ra_documentos WHERE candidato_id = ? ORDER BY enviado_em DESC`,
    [candidatoId]
  );
  return rows;
}

export async function inserirDocumento({ candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, enviadoPorNome }) {
  const [result] = await pool.query(
    `INSERT INTO ra_documentos
       (candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes, enviado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, enviadoPorNome || null]
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
    `SELECT * FROM ra_documentos WHERE id = ?`,
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

export async function listarAlertas({ lido } = {}) {
  let sql = `
    SELECT a.*, c.nome AS candidato_nome, c.matricula
    FROM ra_alertas a
    JOIN ra_candidatos c ON c.id = a.candidato_id
    WHERE 1=1
  `;
  const params = [];
  if (lido !== undefined) { sql += ' AND a.lido = ?'; params.push(lido ? 1 : 0); }
  sql += ' ORDER BY a.criado_em DESC LIMIT 100';
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
