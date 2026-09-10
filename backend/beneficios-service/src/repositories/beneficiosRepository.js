import { pool } from '../config/database.js';

// Garante colunas e tabelas de adesão e taxas atualizadas no banco
async function inicializarColunas() {
  try { await pool.query(`ALTER TABLE ra_dados_sensiveis ADD COLUMN cbo VARCHAR(20) NULL`); } catch {}

  // Criação da tabela de Contatos de Emergência
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_contatos_emergencia (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        nome_1 VARCHAR(255) NULL,
        parentesco_1 VARCHAR(100) NULL,
        telefone_1 VARCHAR(50) NULL,
        nome_2 VARCHAR(255) NULL,
        parentesco_2 VARCHAR(100) NULL,
        telefone_2 VARCHAR(50) NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unq_cand_emerg (candidato_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.error('Erro ao criar ra_contatos_emergencia:', err?.message);
  }

  // Criação da tabela de Proposta de Adesão Completa com rastreamento de IP
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_proposta_adesao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        video_assistido_em DATETIME NULL,
        declaracao_enviada_em DATETIME NULL,
        ip_registro VARCHAR(100) NULL,
        user_agent TEXT NULL,
        dados_json LONGTEXT NULL,
        status_adesao VARCHAR(50) DEFAULT 'pendente',
        homologado_em DATETIME NULL,
        homologado_por_id INT NULL,
        homologado_por_nome VARCHAR(255) NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unq_cand_prop (candidato_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.error('Erro ao criar ra_proposta_adesao:', err?.message);
  }

  // Adiciona colunas de IP e User-Agent em documentos caso não existam
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN ip_envio VARCHAR(100) NULL`); } catch {}
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN user_agent TEXT NULL`); } catch {}

  // Adiciona colunas complementares em ra_dados_sensiveis
  const colunasSensiveis = [
    `ADD COLUMN nome_social VARCHAR(255) NULL`,
    `ADD COLUMN genero VARCHAR(50) NULL`,
    `ADD COLUMN nit VARCHAR(50) NULL`,
    `ADD COLUMN data_expedicao_rg VARCHAR(50) NULL`,
    `ADD COLUMN estado_emissor_rg VARCHAR(50) NULL`,
    `ADD COLUMN uf_cnh VARCHAR(10) NULL`,
    `ADD COLUMN validade_cnh VARCHAR(50) NULL`,
    `ADD COLUMN cor_etnia VARCHAR(50) NULL`,
    `ADD COLUMN recebe_beneficio_previdencia TINYINT(1) DEFAULT 0`,
    `ADD COLUMN orgaos_classe VARCHAR(255) NULL`,
    `ADD COLUMN numero_classe VARCHAR(100) NULL`,
    `ADD COLUMN disponibilidade_escala TEXT NULL`,
    `ADD COLUMN zona VARCHAR(50) NULL`,
    `ADD COLUMN telefone_residencial VARCHAR(50) NULL`,
    `ADD COLUMN telefone_recado VARCHAR(50) NULL`,
    `ADD COLUMN receber_informacoes_projetos TINYINT(1) DEFAULT 1`,
    `ADD COLUMN deficiencia_fisica TINYINT(1) DEFAULT 0`,
    `ADD COLUMN tipo_deficiencia VARCHAR(100) NULL`,
    `ADD COLUMN nome_conjuge VARCHAR(255) NULL`,
    `ADD COLUMN nacionalidade_pai VARCHAR(100) NULL`,
    `ADD COLUMN nacionalidade_mae VARCHAR(100) NULL`,
    `ADD COLUMN nacionalidade_conjuge VARCHAR(100) NULL`,
    `ADD COLUMN tem_filhos TINYINT(1) DEFAULT 0`,
    `ADD COLUMN tem_dependentes TINYINT(1) DEFAULT 0`,
    `ADD COLUMN declara_dependente_irrf TINYINT(1) DEFAULT 0`,
    `ADD COLUMN dependentes_json LONGTEXT NULL`,
    `ADD COLUMN grau_instrucao VARCHAR(100) NULL`,
    `ADD COLUMN informatica_json LONGTEXT NULL`,
    `ADD COLUMN idiomas_json LONGTEXT NULL`,
    `ADD COLUMN especializacao_curso VARCHAR(255) NULL`,
    `ADD COLUMN especializacao_ano VARCHAR(20) NULL`,
    `ADD COLUMN experiencias_json LONGTEXT NULL`,
    `ADD COLUMN estrangeiro_json LONGTEXT NULL`,
  ];
  for (const col of colunasSensiveis) {
    try { await pool.query(`ALTER TABLE ra_dados_sensiveis ${col}`); } catch {}
  }

  try {
    // Atualiza registros antigos que possuíam os defaults legados (1.50% de seguro ou 0% de rateio)
    await pool.query(`
      UPDATE ra_descontos
      SET seguro_vida_percentual = 4.15
      WHERE seguro_vida_percentual = 1.50 OR seguro_vida_percentual = 0 OR seguro_vida_percentual IS NULL
    `);
    await pool.query(`
      UPDATE ra_descontos
      SET rateio_percentual = 5.00
      WHERE rateio_percentual = 0 OR rateio_percentual IS NULL
    `);
    await pool.query(`
      UPDATE ra_descontos
      SET inss_percentual = 20.00
      WHERE inss_percentual = 0 OR inss_percentual IS NULL
    `);
  } catch {}
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
    nome_social, genero, nit, data_expedicao_rg, estado_emissor_rg,
    uf_cnh, validade_cnh, cor_etnia, recebe_beneficio_previdencia,
    orgaos_classe, numero_classe, disponibilidade_escala, zona,
    telefone_residencial, telefone_recado, receber_informacoes_projetos,
    deficiencia_fisica, tipo_deficiencia, nome_conjuge,
    nacionalidade_pai, nacionalidade_mae, nacionalidade_conjuge,
    tem_filhos, tem_dependentes, declara_dependente_irrf, dependentes_json,
    grau_instrucao, informatica_json, idiomas_json,
    especializacao_curso, especializacao_ano, experiencias_json, estrangeiro_json,
  } = dados;

  await pool.query(
    `INSERT INTO ra_dados_sensiveis
       (candidato_id, data_nascimento, rg, orgao_emissor, uf_rg, nome_mae, nome_pai,
        estado_civil, naturalidade, nacionalidade, cep, logradouro, numero, complemento,
        bairro, cidade, uf, pis_pasep, titulo_eleitor, cnh, categoria_cnh, cbo, qualificacoes,
        nome_social, genero, nit, data_expedicao_rg, estado_emissor_rg,
        uf_cnh, validade_cnh, cor_etnia, recebe_beneficio_previdencia,
        orgaos_classe, numero_classe, disponibilidade_escala, zona,
        telefone_residencial, telefone_recado, receber_informacoes_projetos,
        deficiencia_fisica, tipo_deficiencia, nome_conjuge,
        nacionalidade_pai, nacionalidade_mae, nacionalidade_conjuge,
        tem_filhos, tem_dependentes, declara_dependente_irrf, dependentes_json,
        grau_instrucao, informatica_json, idiomas_json,
        especializacao_curso, especializacao_ano, experiencias_json, estrangeiro_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
             ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       nome_social = VALUES(nome_social), genero = VALUES(genero), nit = VALUES(nit),
       data_expedicao_rg = VALUES(data_expedicao_rg), estado_emissor_rg = VALUES(estado_emissor_rg),
       uf_cnh = VALUES(uf_cnh), validade_cnh = VALUES(validade_cnh), cor_etnia = VALUES(cor_etnia),
       recebe_beneficio_previdencia = VALUES(recebe_beneficio_previdencia),
       orgaos_classe = VALUES(orgaos_classe), numero_classe = VALUES(numero_classe),
       disponibilidade_escala = VALUES(disponibilidade_escala), zona = VALUES(zona),
       telefone_residencial = VALUES(telefone_residencial), telefone_recado = VALUES(telefone_recado),
       receber_informacoes_projetos = VALUES(receber_informacoes_projetos),
       deficiencia_fisica = VALUES(deficiencia_fisica), tipo_deficiencia = VALUES(tipo_deficiencia),
       nome_conjuge = VALUES(nome_conjuge), nacionalidade_pai = VALUES(nacionalidade_pai),
       nacionalidade_mae = VALUES(nacionalidade_mae), nacionalidade_conjuge = VALUES(nacionalidade_conjuge),
       tem_filhos = VALUES(tem_filhos), tem_dependentes = VALUES(tem_dependentes),
       declara_dependente_irrf = VALUES(declara_dependente_irrf), dependentes_json = VALUES(dependentes_json),
       grau_instrucao = VALUES(grau_instrucao), informatica_json = VALUES(informatica_json),
       idiomas_json = VALUES(idiomas_json), especializacao_curso = VALUES(especializacao_curso),
       especializacao_ano = VALUES(especializacao_ano), experiencias_json = VALUES(experiencias_json),
       estrangeiro_json = VALUES(estrangeiro_json), atualizado_em = NOW()`,
    [
      candidatoId,
      data_nascimento || null, rg || null, orgao_emissor || null, uf_rg || null,
      nome_mae || null, nome_pai || null, estado_civil || null,
      naturalidade || null, nacionalidade || 'Brasileiro(a)',
      cep || null, logradouro || null, numero || null, complemento || null,
      bairro || null, cidade || null, uf || null,
      pis_pasep || null, titulo_eleitor || null, cnh || null,
      categoria_cnh || null, cbo || null, qualificacoes || null,
      nome_social || null, genero || null, nit || null,
      data_expedicao_rg || null, estado_emissor_rg || null,
      uf_cnh || null, validade_cnh || null, cor_etnia || null,
      recebe_beneficio_previdencia ? 1 : 0,
      orgaos_classe ? (Array.isArray(orgaos_classe) ? orgaos_classe.join(', ') : orgaos_classe) : null,
      numero_classe || null,
      disponibilidade_escala ? (Array.isArray(disponibilidade_escala) ? disponibilidade_escala.join(', ') : disponibilidade_escala) : null,
      zona || null,
      telefone_residencial || null, telefone_recado || null,
      receber_informacoes_projetos !== false ? 1 : 0,
      deficiencia_fisica ? 1 : 0, tipo_deficiencia || null, nome_conjuge || null,
      nacionalidade_pai || null, nacionalidade_mae || null, nacionalidade_conjuge || null,
      tem_filhos ? 1 : 0, tem_dependentes ? 1 : 0, declara_dependente_irrf ? 1 : 0,
      dependentes_json ? (typeof dependentes_json === 'string' ? dependentes_json : JSON.stringify(dependentes_json)) : null,
      grau_instrucao || null,
      informatica_json ? (typeof informatica_json === 'string' ? informatica_json : JSON.stringify(informatica_json)) : null,
      idiomas_json ? (typeof idiomas_json === 'string' ? idiomas_json : JSON.stringify(idiomas_json)) : null,
      especializacao_curso || null, especializacao_ano || null,
      experiencias_json ? (typeof experiencias_json === 'string' ? experiencias_json : JSON.stringify(experiencias_json)) : null,
      estrangeiro_json ? (typeof estrangeiro_json === 'string' ? estrangeiro_json : JSON.stringify(estrangeiro_json)) : null,
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

export async function obterContatosEmergencia(candidatoId) {
  const [[row]] = await pool.query(
    `SELECT * FROM ra_contatos_emergencia WHERE candidato_id = ?`,
    [candidatoId]
  );
  return row ?? null;
}

export async function salvarContatosEmergencia(candidatoId, dados = {}) {
  const { nome_1, parentesco_1, telefone_1, nome_2, parentesco_2, telefone_2 } = dados;
  await pool.query(
    `INSERT INTO ra_contatos_emergencia (candidato_id, nome_1, parentesco_1, telefone_1, nome_2, parentesco_2, telefone_2)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       nome_1 = VALUES(nome_1), parentesco_1 = VALUES(parentesco_1), telefone_1 = VALUES(telefone_1),
       nome_2 = VALUES(nome_2), parentesco_2 = VALUES(parentesco_2), telefone_2 = VALUES(telefone_2),
       atualizado_em = NOW()`,
    [candidatoId, nome_1 || null, parentesco_1 || null, telefone_1 || null, nome_2 || null, parentesco_2 || null, telefone_2 || null]
  );
}

export async function obterPropostaAdesao(candidatoId) {
  const [[row]] = await pool.query(
    `SELECT * FROM ra_proposta_adesao WHERE candidato_id = ?`,
    [candidatoId]
  );
  if (!row) return null;
  let dadosJsonParsed = null;
  if (row.dados_json) {
    try {
      dadosJsonParsed = JSON.parse(row.dados_json);
    } catch {}
  }
  return {
    ...row,
    dados_json_parsed: dadosJsonParsed
  };
}

export async function salvarVideoAssistido(candidatoId, { ip, userAgent } = {}) {
  await pool.query(
    `INSERT INTO ra_proposta_adesao (candidato_id, video_assistido_em, ip_registro, user_agent, status_adesao)
     VALUES (?, NOW(), ?, ?, 'video_concluido')
     ON DUPLICATE KEY UPDATE
       video_assistido_em = COALESCE(video_assistido_em, NOW()),
       ip_registro = COALESCE(VALUES(ip_registro), ip_registro),
       user_agent = COALESCE(VALUES(user_agent), user_agent),
       atualizado_em = NOW()`,
    [candidatoId, ip || null, userAgent || null]
  );
}

export async function salvarDeclaracaoEnviada(candidatoId, { ip, userAgent } = {}) {
  await pool.query(
    `INSERT INTO ra_proposta_adesao (candidato_id, declaracao_enviada_em, ip_registro, user_agent, status_adesao)
     VALUES (?, NOW(), ?, ?, 'declaracao_enviada')
     ON DUPLICATE KEY UPDATE
       declaracao_enviada_em = NOW(),
       ip_registro = COALESCE(VALUES(ip_registro), ip_registro),
       user_agent = COALESCE(VALUES(user_agent), user_agent),
       atualizado_em = NOW()`,
    [candidatoId, ip || null, userAgent || null]
  );
}

export async function salvarAdesaoCompleta(candidatoId, { dadosJson, contatosEmergencia, dadosSensiveis, dadosBancarios, ip, userAgent } = {}) {
  if (dadosSensiveis) {
    await salvarDadosSensiveis(candidatoId, dadosSensiveis);
  }
  if (dadosBancarios) {
    await salvarDadosBancarios(candidatoId, dadosBancarios);
  }
  if (contatosEmergencia) {
    await salvarContatosEmergencia(candidatoId, contatosEmergencia);
  }
  const jsonStr = dadosJson ? (typeof dadosJson === 'string' ? dadosJson : JSON.stringify(dadosJson)) : null;
  await pool.query(
    `INSERT INTO ra_proposta_adesao (candidato_id, dados_json, ip_registro, user_agent, status_adesao)
     VALUES (?, ?, ?, ?, 'adesao_preenchida')
     ON DUPLICATE KEY UPDATE
       dados_json = VALUES(dados_json),
       ip_registro = COALESCE(VALUES(ip_registro), ip_registro),
       user_agent = COALESCE(VALUES(user_agent), user_agent),
       status_adesao = IF(status_adesao = 'homologado_100', 'homologado_100', 'adesao_preenchida'),
       atualizado_em = NOW()`,
    [candidatoId, jsonStr, ip || null, userAgent || null]
  );

  await registrarAuditoria({
    candidatoId,
    tabela: 'ra_proposta_adesao',
    campo: 'dados_json',
    acao: 'criacao',
    observacao: `Adesão completa enviada pelo cooperado via Portal Web. IP: ${ip || 'N/A'}.`,
    usuarioNome: 'Portal do Cooperado',
  });

  await criarAlerta(
    candidatoId,
    'adesao_completa',
    `📄 Cooperado completou e submeteu a Proposta de Adesão Completa (12 seções) pelo Portal Web.`
  );

  return { ok: true };
}

export async function homologarAdesao100(candidatoId, { usuarioId, usuarioNome } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // Gerar matrícula oficial de benefícios
    const matricula = await garantirMatriculaCooperado(candidatoId, conexao);

    // Atualizar status do cooperado para 1 (Ativo/Aprovado)
    await conexao.query(
      `UPDATE ra_candidatos
       SET status = 1, aprovado_em = COALESCE(aprovado_em, NOW()), matricula = ?
       WHERE id = ?`,
      [matricula, candidatoId]
    );

    // Atualizar proposta de adesão para homologada 100%
    await conexao.query(
      `UPDATE ra_proposta_adesao
       SET status_adesao = 'homologado_100', homologado_em = NOW(), homologado_por_id = ?, homologado_por_nome = ?
       WHERE candidato_id = ?`,
      [usuarioId || null, usuarioNome || 'Administrador', candidatoId]
    );

    // Auditoria
    await conexao.query(
      `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
       VALUES (?, 'ra_proposta_adesao', 'status_adesao', 'homologacao', 'pendente', 'homologado_100', ?, ?, ?)`,
      [
        candidatoId,
        `Adesão homologada 100% com sucesso por ${usuarioNome || 'Administrador'}. Matrícula gerada: #${matricula}. Portal de adesão bloqueado para edições.`,
        usuarioId || null,
        usuarioNome || null,
      ]
    );

    // Alerta
    await conexao.query(
      `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'homologacao_100', ?)`,
      [
        candidatoId,
        `🎉 Adesão 100% HOMOLOGADA! Cooperado ativado com Matrícula #${matricula} por ${usuarioNome || 'Supervisão'}.`
      ]
    );

    await conexao.commit();
    return { ok: true, matricula };
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}

// ── Documentos ────────────────────────────────────────────────────────────────

export async function listarDocumentos(candidatoId) {
  const [rows] = await pool.query(
    `SELECT id, candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes,
            validado, validado_por_nome, validado_em, observacao, enviado_em, enviado_por_nome,
            rejeitado, motivo_rejeicao, rejeitado_por_nome, rejeitado_em, ip_envio, user_agent
     FROM ra_documentos WHERE candidato_id = ? ORDER BY enviado_em DESC`,
    [candidatoId]
  );
  return rows;
}

export async function inserirDocumento({ candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, conteudoBlob, enviadoPorNome, ipEnvio, userAgent }) {
  // Verificar se já existia documento do mesmo tipo para o candidato
  const [docsAnteriores] = await pool.query(
    `SELECT id, validado, rejeitado, nome_original FROM ra_documentos WHERE candidato_id = ? AND tipo = ?`,
    [candidatoId, tipo]
  );
  const eraSubstituicao = docsAnteriores.length > 0;
  const tinhaValidado = docsAnteriores.some((d) => d.validado === 1);

  // Se for substituição/atualização, reseta validações anteriores desse tipo para evitar status inconsistente
  if (eraSubstituicao) {
    await pool.query(
      `UPDATE ra_documentos 
       SET validado = 0, rejeitado = 0, validado_em = NULL, validado_por_nome = NULL, motivo_rejeicao = NULL 
       WHERE candidato_id = ? AND tipo = ?`,
      [candidatoId, tipo]
    );
  }

  const [result] = await pool.query(
    `INSERT INTO ra_documentos
       (candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes, conteudo_blob, enviado_por_nome, validado, rejeitado, ip_envio, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
    [candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, conteudoBlob ?? null, enviadoPorNome || null, ipEnvio || null, userAgent || null]
  );
  return { docId: result.insertId, id: result.insertId, eraSubstituicao, tinhaValidado };
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
            rejeitado, motivo_rejeicao, rejeitado_por_nome, rejeitado_em, ip_envio, user_agent
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
  if (!row) {
    return {
      candidato_id: Number(candidatoId),
      inss_percentual: 20.00,
      seguro_vida_percentual: 4.15,
      rateio_percentual: 5.00,
      quota_parte_valor: 0,
      quota_parcelada: 0,
      quota_total_cotas: null,
      quota_cotas_pagas: 0,
      outras_descricao: null,
      outras_valor: 0,
    };
  }

  const seguro = (Number(row.seguro_vida_percentual) === 1.5 || Number(row.seguro_vida_percentual) === 0 || row.seguro_vida_percentual === null)
    ? 4.15
    : Number(row.seguro_vida_percentual);
  const rateio = (Number(row.rateio_percentual) === 0 || row.rateio_percentual === null)
    ? 5.00
    : Number(row.rateio_percentual);
  const inss = (Number(row.inss_percentual) === 0 || row.inss_percentual === null)
    ? 20.00
    : Number(row.inss_percentual);

  return {
    ...row,
    inss_percentual: inss,
    seguro_vida_percentual: seguro,
    rateio_percentual: rateio,
  };
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

// ── Geração de Matrícula Sequencial de Benefícios (Base: 34638) ───────────────

export async function gerarProximaMatriculaBeneficios(conexao = pool) {
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

export async function garantirMatriculaCooperado(candidatoId, conexao = pool) {
  const [[c]] = await conexao.query(`SELECT id, matricula, status FROM ra_candidatos WHERE id = ?`, [candidatoId]);
  if (!c) return null;
  // Apenas cooperados aprovados, ativos, inativos ou desligados (status 1, 2, 4) possuem matrícula
  if (c.status === 0 || c.status === 3) {
    if (c.matricula) {
      await conexao.query(`UPDATE ra_candidatos SET matricula = NULL WHERE id = ?`, [candidatoId]);
    }
    return null;
  }
  if (c.matricula && /^\d+$/.test(String(c.matricula).trim()) && Number(c.matricula) >= 34635) {
    return String(c.matricula).trim();
  }

  const novaMatricula = await gerarProximaMatriculaBeneficios(conexao);
  await conexao.query(`UPDATE ra_candidatos SET matricula = ? WHERE id = ?`, [novaMatricula, candidatoId]);
  return novaMatricula;
}

// ── Portal do Cooperado (Web) ─────────────────────────────────────────────────

export async function obterDadosCompletosPortal(candidatoId) {
  const [[candidato]] = await pool.query(
    `SELECT id, nome, cpf, email, telefone, whatsapp, cooperativa, matricula, status, tipo_contratacao, criado_em
     FROM ra_candidatos WHERE id = ?`,
    [candidatoId]
  );
  if (!candidato) return null;

  const [[sensiveis]] = await pool.query(
    `SELECT * FROM ra_dados_sensiveis WHERE candidato_id = ?`,
    [candidatoId]
  );

  const [[bancarios]] = await pool.query(
    `SELECT * FROM ra_dados_bancarios WHERE candidato_id = ?`,
    [candidatoId]
  );

  const [[contatosEmergencia]] = await pool.query(
    `SELECT * FROM ra_contatos_emergencia WHERE candidato_id = ?`,
    [candidatoId]
  );

  const [[proposta]] = await pool.query(
    `SELECT * FROM ra_proposta_adesao WHERE candidato_id = ?`,
    [candidatoId]
  );

  let propostaJsonParsed = null;
  if (proposta?.dados_json) {
    try {
      propostaJsonParsed = JSON.parse(proposta.dados_json);
    } catch {}
  }

  const [documentos] = await pool.query(
    `SELECT id, tipo, nome_original, mime_type, tamanho_bytes, validado, rejeitado, motivo_rejeicao, enviado_em, ip_envio
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

  // Tipos de documentos obrigatórios: 6 itens (foto_3x4, rg_frente, rg_verso, cpf, comprovante_residencia, comprovante_bancario)
  const docsObrigatorios = ['foto_3x4', 'rg_frente', 'rg_verso', 'cpf', 'comprovante_residencia', 'comprovante_bancario'];
  const docsTiposEnviados = new Set(documentos.map(d => d.tipo));
  const todosObrigatoriosEnviados = docsObrigatorios.every(t => docsTiposEnviados.has(t));
  const todosObrigatoriosValidados = docsObrigatorios.every(t => documentos.some(d => d.tipo === t && d.validado === 1));

  const videoAssistido = Boolean(proposta?.video_assistido_em);
  const declaracaoEnviada = Boolean(videoAssistido && (proposta?.declaracao_enviada_em || docsTiposEnviados.has('declaracao_adesao')));
  const adesaoPreenchida = Boolean(declaracaoEnviada && (proposta?.dados_json || proposta?.status_adesao === 'adesao_preenchida' || proposta?.status_adesao === 'homologado_100'));

  // Homologado 100%
  const homologado100 = Boolean(proposta?.homologado_em || (proposta?.status_adesao === 'homologado_100' && candidato.status === 1));

  // Cálculo de percentual de progresso
  let progresso = 0;
  if (alocacoes.length > 0) progresso += 10;
  if (videoAssistido) progresso += 20;
  if (declaracaoEnviada) progresso += 20;
  if (adesaoPreenchida) progresso += 25;
  if (adesaoPreenchida && todosObrigatoriosEnviados) progresso += 15;
  if (homologado100) progresso = 100;
  else if (todosObrigatoriosValidados && progresso >= 90) progresso = 95;

  return {
    candidato,
    dadosSensiveis: sensiveis ?? null,
    dadosBancarios: bancarios ?? null,
    contatosEmergencia: contatosEmergencia ?? null,
    propostaAdesao: proposta ? { ...proposta, dados_json_parsed: propostaJsonParsed } : null,
    documentos,
    alocacaoAtual: alocacoes[0] ?? null,
    alocacoes,
    statusGeral: {
      videoAssistido,
      declaracaoEnviada,
      adesaoPreenchida,
      todosObrigatoriosEnviados,
      todosObrigatoriosValidados,
      homologado100,
      progressoPercentual: progresso,
    }
  };
}

export async function aceitarVagaPortal(candidatoId, { observacoes } = {}) {
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
      `UPDATE ra_alocacoes SET observacoes = CONCAT(COALESCE(observacoes, ''), '\n[Aceite confirmado pelo cooperado via Portal]') WHERE id = ?`,
      [alocacao.id]
    );
  }

  await criarAlerta(
    candidatoId,
    'aceite_vaga',
    `🎉 Cooperado confirmou e aceitou a vaga ${alocacao ? `"${alocacao.cargo}" na ${alocacao.nome_unidade}` : ''} via Portal Web!`
  );

  await registrarAuditoria({
    candidatoId,
    tabela: 'ra_alocacoes',
    acao: 'validacao',
    observacao: `Vaga aceita pelo cooperado através do Portal Web. ${observacoes || ''}`,
    usuarioNome: 'Portal do Cooperado',
  });

  return { ok: true, alocacaoId: alocacao?.id ?? null };
}

export async function desligarCooperado(candidatoId, { usuarioId, usuarioNome, motivo, dataDesligamento } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    await conexao.query(
      `UPDATE ra_candidatos
       SET status = 4, inativado_em = NOW(), inativado_por_id = ?, inativado_por_nome = ?, motivo_inativacao = ?
       WHERE id = ?`,
      [usuarioId ?? null, usuarioNome ?? null, motivo ?? null, candidatoId]
    );

    await conexao.query(
      `UPDATE ra_alocacoes
       SET status = 'encerrada', data_fim = COALESCE(?, CURDATE()), encerrado_em = NOW(),
           encerrado_por_id = ?, encerrado_por_nome = ?,
           observacoes = CONCAT(COALESCE(observacoes, ''), ' [Desligamento do cooperado: ', COALESCE(?, 'Sem motivo informado'), ']')
       WHERE candidato_id = ? AND status = 'ativa'`,
      [dataDesligamento ?? null, usuarioId ?? null, usuarioNome ?? null, motivo ?? null, candidatoId]
    );

    try {
      await conexao.query(
        `UPDATE ra_cotas_mensais SET ativa = 0 WHERE candidato_id = ?`,
        [candidatoId]
      );
    } catch {}

    const [[c]] = await conexao.query(`SELECT nome, matricula FROM ra_candidatos WHERE id = ?`, [candidatoId]);
    const nome = c?.nome || 'Cooperado';
    const mat = c?.matricula ? ` · Matrícula: #${c.matricula}` : '';
    const dataStr = dataDesligamento ? ` em ${dataDesligamento}` : '';
    const motStr = motivo ? `. Motivo: ${motivo}` : '';

    await conexao.query(
      `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'desligamento', ?)`,
      [
        candidatoId,
        `⚠️ Cancelamento de Benefícios: Cooperado ${nome}${mat} foi desligado${dataStr} por ${usuarioNome || 'Supervisão'}${motStr}. Todos os benefícios foram cancelados automaticamente.`
      ]
    );

    try {
      await conexao.query(
        `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome)
         VALUES (?, 'ra_candidatos', 'status', 'desligamento', '1', '2', ?, ?, ?)`,
        [
          candidatoId,
          `Desligamento de cooperado e cancelamento automático de benefícios.${motStr}`,
          usuarioId ?? null,
          usuarioNome ?? null
        ]
      );
    } catch {}

    await conexao.commit();
    return true;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

