import { pool } from '../config/database.js';
import { dataLocalISO } from '../../../shared/src/datas.js';
import { enviarEmailRecuperacaoSenha, enviarEmail } from '../../../shared/src/email.js';

// Garante colunas e tabelas de adesão e taxas atualizadas no banco
async function inicializarColunas() {
  // Criação da tabela de Dados Sensíveis
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_dados_sensiveis (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        data_nascimento VARCHAR(50) NULL,
        rg VARCHAR(50) NULL,
        orgao_emissor VARCHAR(50) NULL,
        uf_rg VARCHAR(10) NULL,
        nome_mae VARCHAR(255) NULL,
        nome_pai VARCHAR(255) NULL,
        estado_civil VARCHAR(50) NULL,
        naturalidade VARCHAR(150) NULL,
        nacionalidade VARCHAR(100) DEFAULT 'Brasileiro(a)',
        cep VARCHAR(20) NULL,
        logradouro VARCHAR(255) NULL,
        numero VARCHAR(50) NULL,
        complemento VARCHAR(100) NULL,
        bairro VARCHAR(150) NULL,
        cidade VARCHAR(150) NULL,
        uf VARCHAR(10) NULL,
        pis_pasep VARCHAR(50) NULL,
        titulo_eleitor VARCHAR(50) NULL,
        cnh VARCHAR(50) NULL,
        categoria_cnh VARCHAR(20) NULL,
        cbo VARCHAR(50) NULL,
        qualificacoes TEXT NULL,
        nome_social VARCHAR(255) NULL,
        genero VARCHAR(50) NULL,
        nit VARCHAR(50) NULL,
        data_expedicao_rg VARCHAR(50) NULL,
        estado_emissor_rg VARCHAR(50) NULL,
        uf_cnh VARCHAR(10) NULL,
        validade_cnh VARCHAR(50) NULL,
        cor_etnia VARCHAR(50) NULL,
        recebe_beneficio_previdencia TINYINT(1) DEFAULT 0,
        orgaos_classe VARCHAR(255) NULL,
        numero_classe VARCHAR(100) NULL,
        disponibilidade_escala TEXT NULL,
        zona VARCHAR(50) NULL,
        telefone_residencial VARCHAR(50) NULL,
        telefone_recado VARCHAR(50) NULL,
        receber_informacoes_projetos TINYINT(1) DEFAULT 1,
        deficiencia_fisica TINYINT(1) DEFAULT 0,
        tipo_deficiencia VARCHAR(100) NULL,
        nome_conjuge VARCHAR(255) NULL,
        nacionalidade_pai VARCHAR(100) NULL,
        nacionalidade_mae VARCHAR(100) NULL,
        nacionalidade_conjuge VARCHAR(100) NULL,
        tem_filhos TINYINT(1) DEFAULT 0,
        tem_dependentes TINYINT(1) DEFAULT 0,
        declara_dependente_irrf TINYINT(1) DEFAULT 0,
        dependentes_json LONGTEXT NULL,
        grau_instrucao VARCHAR(100) NULL,
        informatica_json LONGTEXT NULL,
        idiomas_json LONGTEXT NULL,
        especializacao_curso VARCHAR(255) NULL,
        especializacao_ano VARCHAR(20) NULL,
        experiencias_json LONGTEXT NULL,
        estrangeiro_json LONGTEXT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unq_cand_sens (candidato_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try { await pool.query(`ALTER TABLE ra_dados_sensiveis ADD COLUMN cbo VARCHAR(20) NULL`); } catch { }
  } catch (err) {
    console.error('Erro ao criar ra_dados_sensiveis:', err?.message);
  }

  // Criação da tabela de Dados Bancários
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_dados_bancarios (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        banco VARCHAR(150) NULL,
        codigo_banco VARCHAR(20) NULL,
        agencia VARCHAR(50) NULL,
        conta VARCHAR(50) NULL,
        digito VARCHAR(10) NULL,
        tipo_conta VARCHAR(50) DEFAULT 'corrente',
        chave_pix VARCHAR(255) NULL,
        tipo_pix VARCHAR(50) NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unq_cand_banc (candidato_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try { await pool.query(`ALTER TABLE ra_dados_bancarios ADD COLUMN codigo_banco VARCHAR(20) NULL AFTER banco`); } catch { }
    try { await pool.query(`ALTER TABLE ra_dados_bancarios ADD COLUMN digito VARCHAR(10) NULL AFTER conta`); } catch { }
    try { await pool.query(`ALTER TABLE ra_dados_bancarios ADD COLUMN tipo_conta VARCHAR(50) DEFAULT 'corrente' AFTER digito`); } catch { }
    try { await pool.query(`ALTER TABLE ra_dados_bancarios ADD COLUMN chave_pix VARCHAR(255) NULL AFTER tipo_conta`); } catch { }
    try { await pool.query(`ALTER TABLE ra_dados_bancarios ADD COLUMN tipo_pix VARCHAR(50) NULL AFTER chave_pix`); } catch { }
  } catch (err) {
    console.error('Erro ao criar ra_dados_bancarios:', err?.message);
  }

  // Criação da tabela de Descontos
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_descontos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        inss_percentual DECIMAL(6,2) DEFAULT 0,
        seguro_vida_percentual DECIMAL(6,2) DEFAULT 4.15,
        quota_parte_valor DECIMAL(10,2) DEFAULT 0,
        quota_parcelada TINYINT(1) DEFAULT 1,
        quota_total_cotas INT DEFAULT 1,
        quota_cotas_pagas INT DEFAULT 0,
        rateio_percentual DECIMAL(6,2) DEFAULT 0,
        outras_descricao VARCHAR(255) NULL,
        outras_valor DECIMAL(10,2) DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY unq_cand_desc (candidato_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try { await pool.query(`ALTER TABLE ra_descontos ADD COLUMN quota_parcelada TINYINT(1) DEFAULT 1`); } catch { }
    try { await pool.query(`ALTER TABLE ra_descontos ADD COLUMN quota_total_cotas INT DEFAULT 1`); } catch { }
    try { await pool.query(`ALTER TABLE ra_descontos ADD COLUMN quota_cotas_pagas INT DEFAULT 0`); } catch { }
    try { await pool.query(`ALTER TABLE ra_descontos ADD COLUMN outras_descricao VARCHAR(255) NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_descontos ADD COLUMN outras_valor DECIMAL(10,2) DEFAULT 0`); } catch { }
    try { await pool.query(`ALTER TABLE ra_descontos ADD COLUMN outros_descontos TEXT NULL`); } catch { }
  } catch (err) {
    console.error('Erro ao criar ra_descontos:', err?.message);
  }

  // Criação da tabela de Auditoria e Alertas
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_auditoria (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        tabela VARCHAR(100) NULL,
        campo VARCHAR(100) NULL,
        acao VARCHAR(100) NOT NULL,
        valor_anterior TEXT NULL,
        valor_novo TEXT NULL,
        observacao TEXT NULL,
        usuario_id INT NULL,
        usuario_nome VARCHAR(255) NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cand_aud (candidato_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_alertas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        tipo VARCHAR(100) NOT NULL,
        mensagem TEXT NOT NULL,
        lido TINYINT(1) DEFAULT 0,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cand_alerta (candidato_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch (err) {
    console.error('Erro ao criar ra_auditoria/ra_alertas:', err?.message);
  }

  // Criação e sincronização da tabela de Qualificações por Categorias Oficiais
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_qualificacoes_catalogo (
        id INT AUTO_INCREMENT PRIMARY KEY,
        nome VARCHAR(255) NOT NULL,
        categoria VARCHAR(100) NULL,
        ativo TINYINT(1) DEFAULT 1,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unq_qual_nome (nome)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_candidato_qualificacoes (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        qualificacao_id INT NOT NULL,
        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unq_cand_qual (candidato_id, qualificacao_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Sincroniza as 4 categorias oficiais (PERFIL, COMPLEXIDADE, EXPERIÊNCIA, DISPOSITIVOS)
    const QUALIFICACOES_OFICIAIS = [
      // 1. PERFIL
      { nome: 'ADULTO', categoria: 'PERFIL' },
      { nome: 'RN (ATÉ 28 DIAS)', categoria: 'PERFIL' },
      { nome: 'INFANTIL 1 (DE 1 MÊS A 1 ANO)', categoria: 'PERFIL' },
      { nome: 'INFANTIL 2 (ACIMA DE 1 ANO)', categoria: 'PERFIL' },
      { nome: 'GERIATRIA', categoria: 'PERFIL' },

      // 2. COMPLEXIDADE
      { nome: 'ALTA (TQT COM E SEM VM)', categoria: 'COMPLEXIDADE' },
      { nome: 'MÉDIA (SEM TQT)', categoria: 'COMPLEXIDADE' },
      { nome: 'BAIXA (SEM DISPOSITIVOS)', categoria: 'COMPLEXIDADE' },

      // 3. EXPERIÊNCIA
      { nome: 'ATENDIMENTO PRÉ-HOSPITALAR (APH)', categoria: 'EXPERIÊNCIA' },
      { nome: 'CCIH', categoria: 'EXPERIÊNCIA' },
      { nome: 'CME', categoria: 'EXPERIÊNCIA' },
      { nome: 'CENTRO CIRÚRGICO', categoria: 'EXPERIÊNCIA' },
      { nome: 'CLÍNICA MÉDICA/CIRÚRGICA', categoria: 'EXPERIÊNCIA' },
      { nome: 'CLÍNICAS ESTÉTICA', categoria: 'EXPERIÊNCIA' },
      { nome: 'CLÍNICAS DE TRANSIÇÃO', categoria: 'EXPERIÊNCIA' },
      { nome: 'CUIDADOS PALIATIVOS', categoria: 'EXPERIÊNCIA' },
      { nome: 'EDUCAÇÃO CONTINUADA', categoria: 'EXPERIÊNCIA' },
      { nome: 'GINECOLOGIA E OBSTETRÍCIA', categoria: 'EXPERIÊNCIA' },
      { nome: 'HOME CARE', categoria: 'EXPERIÊNCIA' },
      { nome: 'HOSPITAIS', categoria: 'EXPERIÊNCIA' },
      { nome: 'LABORATÓRIO', categoria: 'EXPERIÊNCIA' },
      { nome: 'NEONATOLOGIA', categoria: 'EXPERIÊNCIA' },
      { nome: 'ONCOLOGIA', categoria: 'EXPERIÊNCIA' },
      { nome: 'PEDIATRIA', categoria: 'EXPERIÊNCIA' },
      { nome: 'PESQUISA CLÍNICA', categoria: 'EXPERIÊNCIA' },
      { nome: 'PSIQUIATRIA', categoria: 'EXPERIÊNCIA' },
      { nome: 'POSTO DE SAÚDE/PSF/UBS/UPA', categoria: 'EXPERIÊNCIA' },
      { nome: 'PRONTO SOCORRO ADULTO', categoria: 'EXPERIÊNCIA' },
      { nome: 'PRONTO SOCORRO INFANTIL', categoria: 'EXPERIÊNCIA' },
      { nome: 'REMOÇÃO', categoria: 'EXPERIÊNCIA' },
      { nome: 'UTI ADULTO', categoria: 'EXPERIÊNCIA' },
      { nome: 'UTI INFANTIL', categoria: 'EXPERIÊNCIA' },

      // 4. DISPOSITIVOS
      { nome: 'TQT', categoria: 'DISPOSITIVOS' },
      { nome: 'SNE/SNG', categoria: 'DISPOSITIVOS' },
      { nome: 'GTT', categoria: 'DISPOSITIVOS' },
      { nome: 'SVA', categoria: 'DISPOSITIVOS' },
      { nome: 'SVD', categoria: 'DISPOSITIVOS' },
      { nome: 'PICC', categoria: 'DISPOSITIVOS' },
      { nome: 'PORT-A-CATH', categoria: 'DISPOSITIVOS' },
      { nome: 'AVF', categoria: 'DISPOSITIVOS' },
      { nome: 'AVP', categoria: 'DISPOSITIVOS' },
      { nome: 'HIPODERMÓCLISE', categoria: 'DISPOSITIVOS' },
      { nome: 'CURATIVO À VÁCUO', categoria: 'DISPOSITIVOS' },
      { nome: 'BOMBA DE INFUSÃO', categoria: 'DISPOSITIVOS' },
      { nome: 'BOLSA DE COLOSTOMIA', categoria: 'DISPOSITIVOS' },
      { nome: 'TQT SISTEMA ABERTO', categoria: 'DISPOSITIVOS' },
      { nome: 'TQT FECHADO VM', categoria: 'DISPOSITIVOS' },
      { nome: 'BIPAP', categoria: 'DISPOSITIVOS' },
    ];

    const nomesOficiais = QUALIFICACOES_OFICIAIS.map(q => q.nome);
    // Remove qualificações antigas não pertencentes ao novo catálogo
    await pool.query(`DELETE FROM ra_qualificacoes_catalogo WHERE nome NOT IN (?)`, [nomesOficiais]);

    for (const q of QUALIFICACOES_OFICIAIS) {
      await pool.query(`
        INSERT INTO ra_qualificacoes_catalogo (nome, categoria, ativo)
        VALUES (?, ?, 1)
        ON DUPLICATE KEY UPDATE categoria = VALUES(categoria), ativo = 1
      `, [q.nome, q.categoria]);
    }
  } catch (err) {
    console.error('Erro ao sincronizar qualificações:', err?.message);
  }

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

  // Criação da tabela de Proposta de Adesão Completa com rastreamento de IP e GPS
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_proposta_adesao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        vaga_aceita_em DATETIME NULL,
        video_assistido_em DATETIME NULL,
        declaracao_enviada_em DATETIME NULL,
        adesao_iniciada_em DATETIME NULL,
        adesao_concluida_em DATETIME NULL,
        secao_atual INT NULL,
        secao_nome VARCHAR(150) NULL,
        latitude VARCHAR(50) NULL,
        longitude VARCHAR(50) NULL,
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
    try { await pool.query(`ALTER TABLE ra_proposta_adesao ADD COLUMN vaga_aceita_em DATETIME NULL AFTER candidato_id`); } catch { }
    try { await pool.query(`ALTER TABLE ra_proposta_adesao ADD COLUMN adesao_iniciada_em DATETIME NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_proposta_adesao ADD COLUMN adesao_concluida_em DATETIME NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_proposta_adesao ADD COLUMN secao_atual INT NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_proposta_adesao ADD COLUMN secao_nome VARCHAR(150) NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_proposta_adesao ADD COLUMN latitude VARCHAR(50) NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_proposta_adesao ADD COLUMN longitude VARCHAR(50) NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_candidatos ADD COLUMN latitude VARCHAR(50) NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_candidatos ADD COLUMN longitude VARCHAR(50) NULL`); } catch { }
  } catch (err) {
    console.error('Erro ao criar ra_proposta_adesao:', err?.message);
  }

  // Criação da tabela de Apontamentos Diários (Ponto Eletrônico)
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ra_apontamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        alocacao_id INT NULL,
        vaga_id INT NULL,
        data_referencia DATE NOT NULL,
        tipo_evento VARCHAR(50) NOT NULL,
        timestamp_dispositivo DATETIME NOT NULL,
        timestamp_servidor TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        latitude DECIMAL(10, 8) NULL,
        longitude DECIMAL(11, 8) NULL,
        precisao_metros DECIMAL(8, 2) NULL,
        endereco_aproximado VARCHAR(255) NULL,
        par_indice INT NOT NULL DEFAULT 1,
        observacao VARCHAR(255) NULL,
        sincronizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ip_sincronizacao VARCHAR(45) NULL,
        INDEX idx_cand_data (candidato_id, data_referencia)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    try {
      await pool.query(`ALTER TABLE ra_apontamentos MODIFY COLUMN tipo_evento VARCHAR(50) NOT NULL`);
    } catch { }
  } catch (err) {
    console.error('Erro ao criar ra_apontamentos:', err?.message);
  }

  // Adiciona senha_hash em ra_candidatos caso não exista
  try { await pool.query(`ALTER TABLE ra_candidatos ADD COLUMN senha_hash VARCHAR(255) NULL`); } catch { }

  // Garantir colunas completas da tabela ra_documentos
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN conteudo_blob LONGBLOB NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos MODIFY COLUMN tipo VARCHAR(100) NOT NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN validado TINYINT(1) NOT NULL DEFAULT 0`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN validado_por_nome VARCHAR(200) NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN validado_em TIMESTAMP NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN rejeitado TINYINT(1) NOT NULL DEFAULT 0`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN motivo_rejeicao TEXT NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN rejeitado_por_nome VARCHAR(200) NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN rejeitado_em TIMESTAMP NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN ip_envio VARCHAR(100) NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN user_agent TEXT NULL`); } catch { }
  try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN observacao VARCHAR(500) NULL`); } catch { }

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
    try { await pool.query(`ALTER TABLE ra_dados_sensiveis ${col}`); } catch { }
  }

  try {
    // Atualiza registros antigos que possuíam os defaults legados (1.50% de seguro ou 5% de rateio)
    await pool.query(`
      UPDATE ra_descontos
      SET seguro_vida_percentual = 4.15
      WHERE seguro_vida_percentual = 1.50 OR seguro_vida_percentual = 0 OR seguro_vida_percentual IS NULL
    `);
    await pool.query(`
      UPDATE ra_descontos
      SET rateio_percentual = 3.00
      WHERE rateio_percentual = 5.00 OR rateio_percentual = 0 OR rateio_percentual IS NULL
    `);
    await pool.query(`
      UPDATE ra_descontos
      SET inss_percentual = 20.00
      WHERE inss_percentual = 0 OR inss_percentual IS NULL
    `);
    await pool.query(`
      UPDATE ra_descontos
      SET quota_parte_valor = 10.00, quota_parcelada = 1, quota_total_cotas = 5
      WHERE quota_parte_valor = 0 OR quota_parte_valor IS NULL OR quota_total_cotas IS NULL OR quota_total_cotas = 10 OR quota_parte_valor = 1000.00
    `);
  } catch { }
}
inicializarColunas().catch(() => { });

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
    } catch { }
  }
  return {
    ...row,
    dados_json_parsed: dadosJsonParsed
  };
}

export async function registrarInicioELocalizacaoAdesao(candidatoId, { latitude, longitude, ip, userAgent } = {}) {
  const lat = latitude ? String(latitude) : null;
  const lng = longitude ? String(longitude) : null;

  await pool.query(
    `INSERT INTO ra_proposta_adesao (candidato_id, adesao_iniciada_em, latitude, longitude, ip_registro, user_agent, status_adesao)
     VALUES (?, NOW(), ?, ?, ?, ?, 'em_andamento')
     ON DUPLICATE KEY UPDATE
       adesao_iniciada_em = COALESCE(adesao_iniciada_em, NOW()),
       latitude = COALESCE(?, latitude),
       longitude = COALESCE(?, longitude),
       ip_registro = COALESCE(VALUES(ip_registro), ip_registro),
       user_agent = COALESCE(VALUES(user_agent), user_agent),
       status_adesao = IF(status_adesao IN ('adesao_preenchida', 'homologado_100'), status_adesao, 'em_andamento'),
       atualizado_em = NOW()`,
    [candidatoId, lat, lng, ip || null, userAgent || null, lat, lng]
  );

  if (lat && lng) {
    try {
      await pool.query(
        `UPDATE ra_candidatos SET latitude = ?, longitude = ? WHERE id = ?`,
        [lat, lng, candidatoId]
      );
    } catch { }
  }

  return { ok: true, latitude: lat, longitude: lng };
}

export async function registrarProgressoSecao(candidatoId, { secaoAtual, secaoNome, ip, userAgent } = {}) {
  const secaoNum = typeof secaoAtual === 'number' ? secaoAtual : Number(secaoAtual || 1);
  const secaoTxt = secaoNome ? String(secaoNome) : `Seção ${secaoNum}`;

  await pool.query(
    `INSERT INTO ra_proposta_adesao (candidato_id, adesao_iniciada_em, secao_atual, secao_nome, ip_registro, user_agent, status_adesao)
     VALUES (?, NOW(), ?, ?, ?, ?, 'em_andamento')
     ON DUPLICATE KEY UPDATE
       adesao_iniciada_em = COALESCE(adesao_iniciada_em, NOW()),
       secao_atual = ?,
       secao_nome = ?,
       ip_registro = COALESCE(VALUES(ip_registro), ip_registro),
       user_agent = COALESCE(VALUES(user_agent), user_agent),
       status_adesao = IF(status_adesao IN ('adesao_preenchida', 'homologado_100'), status_adesao, 'em_andamento'),
       atualizado_em = NOW()`,
    [candidatoId, secaoNum, secaoTxt, ip || null, userAgent || null, secaoNum, secaoTxt]
  );

  return { ok: true, secaoAtual: secaoNum, secaoNome: secaoTxt };
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

export async function salvarAdesaoCompleta(candidatoId, { dadosJson, contatosEmergencia, dadosSensiveis, dadosBancarios, latitude, longitude, ip, userAgent } = {}) {
  if (dadosSensiveis) {
    await salvarDadosSensiveis(candidatoId, dadosSensiveis);
  }
  if (dadosBancarios) {
    await salvarDadosBancarios(candidatoId, dadosBancarios);
  }
  if (contatosEmergencia) {
    await salvarContatosEmergencia(candidatoId, contatosEmergencia);
  }
  const lat = latitude ? String(latitude) : null;
  const lng = longitude ? String(longitude) : null;
  const jsonStr = dadosJson ? (typeof dadosJson === 'string' ? dadosJson : JSON.stringify(dadosJson)) : null;

  await pool.query(
    `INSERT INTO ra_proposta_adesao (candidato_id, adesao_iniciada_em, adesao_concluida_em, secao_atual, secao_nome, latitude, longitude, dados_json, ip_registro, user_agent, status_adesao)
     VALUES (?, NOW(), NOW(), 12, '12. Beneficiários do Seguro MetLife (Concluído)', ?, ?, ?, ?, ?, 'adesao_preenchida')
     ON DUPLICATE KEY UPDATE
       adesao_iniciada_em = COALESCE(adesao_iniciada_em, NOW()),
       adesao_concluida_em = NOW(),
       secao_atual = 12,
       secao_nome = '12. Beneficiários do Seguro MetLife (Concluído)',
       latitude = COALESCE(?, latitude),
       longitude = COALESCE(?, longitude),
       dados_json = VALUES(dados_json),
       ip_registro = COALESCE(VALUES(ip_registro), ip_registro),
       user_agent = COALESCE(VALUES(user_agent), user_agent),
       status_adesao = IF(status_adesao = 'homologado_100', 'homologado_100', 'adesao_preenchida'),
       atualizado_em = NOW()`,
    [candidatoId, lat, lng, jsonStr, ip || null, userAgent || null, lat, lng]
  );

  if (lat && lng) {
    try {
      await pool.query(
        `UPDATE ra_candidatos SET latitude = ?, longitude = ? WHERE id = ?`,
        [lat, lng, candidatoId]
      );
    } catch { }
  }

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

  let result;
  try {
    [result] = await pool.query(
      `INSERT INTO ra_documentos
         (candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes, conteudo_blob, enviado_por_nome, validado, rejeitado, ip_envio, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
      [candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, conteudoBlob ?? null, enviadoPorNome || null, ipEnvio || null, userAgent || null]
    );
  } catch (errBlob) {
    console.error('[inserirDocumento] Falha ao inserir com blob/colunas extras, garantindo colunas e tentando novamente:', errBlob?.message);
    try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN conteudo_blob LONGBLOB NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_documentos MODIFY COLUMN tipo VARCHAR(100) NOT NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN ip_envio VARCHAR(100) NULL`); } catch { }
    try { await pool.query(`ALTER TABLE ra_documentos ADD COLUMN user_agent TEXT NULL`); } catch { }

    try {
      [result] = await pool.query(
        `INSERT INTO ra_documentos
           (candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes, conteudo_blob, enviado_por_nome, validado, rejeitado, ip_envio, user_agent)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?)`,
        [candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, conteudoBlob ?? null, enviadoPorNome || null, ipEnvio || null, userAgent || null]
      );
    } catch (errFallback) {
      console.error('[inserirDocumento] Tentativa alternativa de insert básico:', errFallback?.message);
      [result] = await pool.query(
        `INSERT INTO ra_documentos
           (candidato_id, tipo, nome_original, nome_arquivo, mime_type, tamanho_bytes, enviado_por_nome, validado)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
        [candidatoId, tipo, nomeOriginal, nomeArquivo, mimeType, tamanhoBytes, enviadoPorNome || null]
      );
    }
  }
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
      rateio_percentual: 3.00,
      quota_parte_valor: 10.00,
      quota_parcelada: 1,
      quota_total_cotas: 5,
      quota_cotas_pagas: 0,
      outras_descricao: null,
      outras_valor: 0,
      outros_descontos: [],
    };
  }

  const seguro = (Number(row.seguro_vida_percentual) === 1.5 || Number(row.seguro_vida_percentual) === 0 || row.seguro_vida_percentual === null)
    ? 4.15
    : Number(row.seguro_vida_percentual);
  const rateio = (Number(row.rateio_percentual) === 0 || Number(row.rateio_percentual) === 5.00 || row.rateio_percentual === null)
    ? 3.00
    : Number(row.rateio_percentual);
  const inss = (Number(row.inss_percentual) === 0 || row.inss_percentual === null)
    ? 20.00
    : Number(row.inss_percentual);
  const quotaTotal = (row.quota_total_cotas === null || Number(row.quota_total_cotas) === 10) ? 5 : Number(row.quota_total_cotas);
  const quotaValor = (Number(row.quota_parte_valor) === 0 || Number(row.quota_parte_valor) === 1000) ? 10.00 : Number(row.quota_parte_valor);

  return {
    ...row,
    inss_percentual: inss,
    seguro_vida_percentual: seguro,
    rateio_percentual: rateio,
    quota_parte_valor: quotaValor,
    quota_parcelada: 1,
    quota_total_cotas: quotaTotal,
    outros_descontos: lerOutrosDescontos(row),
  };
}

// Lista de "Outros Descontos" (JSON). Registros antigos só têm o par
// outras_descricao/outras_valor — nesse caso vira um item único.
function lerOutrosDescontos(row) {
  if (row.outros_descontos) {
    try {
      const lista = JSON.parse(row.outros_descontos);
      if (Array.isArray(lista)) return lista;
    } catch { }
  }
  if (Number(row.outras_valor) > 0 || row.outras_descricao) {
    return [{ descricao: row.outras_descricao ?? '', valor: Number(row.outras_valor ?? 0) }];
  }
  return [];
}

function normalizarOutrosDescontos(lista) {
  if (!Array.isArray(lista)) return [];
  return lista
    .map((i) => ({ descricao: String(i?.descricao ?? '').trim(), valor: Number(i?.valor ?? 0) || 0 }))
    .filter((i) => i.descricao || i.valor > 0);
}

export async function salvarDescontos(candidatoId, dados) {
  const {
    inss_percentual, seguro_vida_percentual, quota_parte_valor,
    quota_parcelada, quota_total_cotas, quota_cotas_pagas,
    rateio_percentual,
  } = dados;

  // Mantém outras_descricao/outras_valor como resumo (descrições + soma) para compatibilidade
  const outros = dados.outros_descontos !== undefined
    ? normalizarOutrosDescontos(dados.outros_descontos)
    : normalizarOutrosDescontos([{ descricao: dados.outras_descricao, valor: dados.outras_valor }]);
  const outrasDescricao = outros.map((i) => i.descricao).filter(Boolean).join(', ').slice(0, 255) || null;
  const outrasValor = outros.reduce((acc, i) => acc + i.valor, 0);

  await pool.query(
    `INSERT INTO ra_descontos
       (candidato_id, inss_percentual, seguro_vida_percentual, quota_parte_valor,
        quota_parcelada, quota_total_cotas, quota_cotas_pagas,
        rateio_percentual, outras_descricao, outras_valor, outros_descontos)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
       outros_descontos = VALUES(outros_descontos),
       atualizado_em = NOW()`,
    [
      candidatoId,
      Number(inss_percentual ?? 0), Number(seguro_vida_percentual ?? 0),
      Number(quota_parte_valor ?? 0),
      quota_parcelada ? 1 : 0,
      quota_total_cotas ?? null, Number(quota_cotas_pagas ?? 0),
      Number(rateio_percentual ?? 0),
      outrasDescricao, outrasValor, JSON.stringify(outros),
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
  try {
    await pool.query(
      `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, ?, ?)`,
      [candidatoId, tipo, mensagem]
    );
  } catch (e) {
    console.error('Erro ao criar alerta de auditoria:', e?.message);
  }
}

export async function marcarAlertaLido(alertaId) {
  await pool.query(`UPDATE ra_alertas SET lido = 1 WHERE id = ?`, [alertaId]);
}

export async function marcarTodosLidos() {
  await pool.query(`UPDATE ra_alertas SET lido = 1 WHERE lido = 0`);
}

// ── Auditoria ─────────────────────────────────────────────────────────────────

export async function registrarAuditoria({ candidatoId, tabela, campo, acao, valorAnterior, valorNovo, observacao, usuarioId, usuarioNome }) {
  try {
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
  } catch (e) {
    console.error('Erro ao registrar auditoria:', e?.message);
  }
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
    `SELECT * FROM ra_qualificacoes_catalogo
     WHERE ativo = 1
     ORDER BY
       CASE categoria
         WHEN 'PERFIL' THEN 1
         WHEN 'COMPLEXIDADE' THEN 2
         WHEN 'EXPERIÊNCIA' THEN 3
         WHEN 'DISPOSITIVOS' THEN 4
         ELSE 5
       END,
       id ASC`
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

  let sensiveis = null;
  try {
    const [[s]] = await pool.query(`SELECT * FROM ra_dados_sensiveis WHERE candidato_id = ?`, [candidatoId]);
    sensiveis = s || null;
  } catch { }

  let bancarios = null;
  try {
    const [[b]] = await pool.query(`SELECT * FROM ra_dados_bancarios WHERE candidato_id = ?`, [candidatoId]);
    bancarios = b || null;
  } catch { }

  let contatosEmergencia = null;
  try {
    const [[e]] = await pool.query(`SELECT * FROM ra_contatos_emergencia WHERE candidato_id = ?`, [candidatoId]);
    contatosEmergencia = e || null;
  } catch { }

  let proposta = null;
  try {
    const [[p]] = await pool.query(`SELECT * FROM ra_proposta_adesao WHERE candidato_id = ?`, [candidatoId]);
    proposta = p || null;
  } catch { }

  let propostaJsonParsed = null;
  if (proposta?.dados_json) {
    try {
      propostaJsonParsed = JSON.parse(proposta.dados_json);
    } catch { }
  }

  let documentos = [];
  try {
    const [d] = await pool.query(
      `SELECT id, tipo, nome_original, mime_type, tamanho_bytes, validado, rejeitado, motivo_rejeicao, enviado_em, ip_envio
       FROM ra_documentos WHERE candidato_id = ? ORDER BY enviado_em DESC`,
      [candidatoId]
    );
    documentos = d || [];
  } catch { }

  let alocacoes = [];
  try {
    const [a] = await pool.query(
      `SELECT a.*, e.nome_empresa, pu.nome_unidade,
              pv.cargo, pv.salario_base, pv.tipo_escala, pv.periodicidade
       FROM ra_alocacoes a
       LEFT JOIN empresas e ON e.id = a.empresa_id
       LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
       LEFT JOIN parametro_vagas pv ON pv.id = a.vaga_id
       WHERE a.candidato_id = ?
       ORDER BY a.criado_em DESC`,
      [candidatoId]
    );
    alocacoes = a || [];
  } catch (errAloc) {
    try {
      const [a] = await pool.query(
        `SELECT a.* FROM ra_alocacoes a WHERE a.candidato_id = ? ORDER BY a.criado_em DESC`,
        [candidatoId]
      );
      alocacoes = a || [];
    } catch { }
  }

  // Regras de Geolocalização (Perímetros de Ponto e Exceção)
  let geolocalizacoes = [];
  try {
    const unidIds = alocacoes.map(a => a.unidade_id).filter(Boolean);
    const empIds = alocacoes.map(a => a.empresa_id).filter(Boolean);

    let queryGeo = `SELECT * FROM ra_geolocalizacoes WHERE ativo = 1 AND (candidato_id = ?`;
    const paramsGeo = [candidatoId];

    if (unidIds.length > 0) {
      queryGeo += ` OR (candidato_id IS NULL AND unidade_id IN (?))`;
      paramsGeo.push(unidIds);
    }
    if (empIds.length > 0) {
      queryGeo += ` OR (candidato_id IS NULL AND unidade_id IS NULL AND empresa_id IN (?))`;
      paramsGeo.push(empIds);
    }
    queryGeo += `) ORDER BY id DESC`;

    const [geoRows] = await pool.query(queryGeo, paramsGeo);
    geolocalizacoes = geoRows || [];
  } catch (err) {
    console.error('Aviso ao consultar ra_geolocalizacoes no portal:', err?.message);
  }

  // Documentos obrigatórios da adesão (mesma lista do frontend: DOCS_OBRIGATORIOS_ADESAO)
  const docsObrigatorios = ['foto_3x4', 'rg_frente', 'rg_verso', 'cpf', 'pis', 'comprovante_residencia', 'comprovante_bancario'];
  const docsTiposEnviados = new Set(documentos.map(d => d.tipo));
  const todosObrigatoriosEnviados = docsObrigatorios.every(t => docsTiposEnviados.has(t));
  const todosObrigatoriosValidados = docsObrigatorios.every(t => documentos.some(d => d.tipo === t && d.validado === 1));

  // Declínio de Vaga
  const vagaDeclinada = Boolean(
    proposta?.status_adesao === 'declinada' ||
    (alocacoes[0] && (alocacoes[0].status === 'encerrada' || alocacoes[0].status === 'recusada' || alocacoes[0].status === 'declinada') && String(alocacoes[0].observacoes || '').includes('Vaga Recusada'))
  );

  const vagaAceita = Boolean(
    !vagaDeclinada && (
      proposta?.vaga_aceita_em ||
      proposta?.video_assistido_em ||
      proposta?.declaracao_enviada_em ||
      (proposta?.status_adesao && !['pendente', 'declinada'].includes(proposta.status_adesao))
    )
  );

  const videoAssistido = Boolean(!vagaDeclinada && vagaAceita && proposta?.video_assistido_em);
  const declaracaoEnviada = Boolean(!vagaDeclinada && videoAssistido && (proposta?.declaracao_enviada_em || docsTiposEnviados.has('declaracao_adesao')));
  const adesaoPreenchida = Boolean(!vagaDeclinada && declaracaoEnviada && (proposta?.dados_json || proposta?.status_adesao === 'adesao_preenchida' || proposta?.status_adesao === 'homologado_100'));

  // Homologado 100%
  const homologado100 = Boolean(!vagaDeclinada && (proposta?.homologado_em || (proposta?.status_adesao === 'homologado_100' && candidato.status === 1)));

  // Cálculo de percentual de progresso
  let progresso = 0;
  if (alocacoes.length > 0 && vagaAceita) progresso += 10;
  if (videoAssistido) progresso += 20;
  if (declaracaoEnviada) progresso += 20;
  if (adesaoPreenchida) progresso += 25;
  if (adesaoPreenchida && todosObrigatoriosEnviados) progresso += 15;
  if (homologado100) progresso = 100;
  else if (todosObrigatoriosValidados && progresso >= 90) progresso = 95;

  return {
    candidato: {
      ...candidato,
      matricula: homologado100 ? candidato.matricula : null,
    },
    dadosSensiveis: sensiveis ?? null,
    dadosBancarios: bancarios ?? null,
    contatosEmergencia: contatosEmergencia ?? null,
    propostaAdesao: proposta ? { ...proposta, dados_json_parsed: propostaJsonParsed } : null,
    documentos,
    alocacaoAtual: alocacoes[0] ?? null,
    alocacoes,
    geolocalizacoes,
    statusGeral: {
      vagaAceita,
      videoAssistido,
      declaracaoEnviada,
      adesaoPreenchida,
      todosObrigatoriosEnviados,
      todosObrigatoriosValidados,
      homologado100,
      vagaDeclinada,
      progressoPercentual: vagaDeclinada ? 0 : progresso,
    }
  };
}

export async function aceitarVagaPortal(candidatoId, { observacoes, ip, userAgent } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[alocacao]] = await conexao.query(
      `SELECT a.*, pv.cargo, pv.cbo, e.nome_empresa, pu.nome_unidade, c.nome as candidato_nome
       FROM ra_alocacoes a
       LEFT JOIN parametro_vagas pv ON pv.id = a.vaga_id
       LEFT JOIN empresas e ON e.id = a.empresa_id
       LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
       LEFT JOIN ra_candidatos c ON c.id = a.candidato_id
       WHERE a.candidato_id = ? AND a.status = 'ativa'
       ORDER BY a.criado_em DESC LIMIT 1`,
      [candidatoId]
    );

    if (alocacao) {
      await conexao.query(
        `UPDATE ra_alocacoes SET observacoes = CONCAT(COALESCE(observacoes, ''), '\n[Aceite confirmado pelo cooperado via Portal em ', DATE_FORMAT(NOW(), '%d/%m/%Y %H:%i'), ']') WHERE id = ?`,
        [alocacao.id]
      );
    }

    // Registra o aceite da vaga na tabela ra_proposta_adesao
    await conexao.query(
      `INSERT INTO ra_proposta_adesao (candidato_id, vaga_aceita_em, ip_registro, user_agent, status_adesao)
       VALUES (?, NOW(), ?, ?, 'vaga_aceita')
       ON DUPLICATE KEY UPDATE 
         vaga_aceita_em = NOW(),
         status_adesao = IF(status_adesao IN ('pendente', 'declinada'), 'vaga_aceita', status_adesao)`,
      [candidatoId, ip || null, userAgent || null]
    );

    const candNome = alocacao?.candidato_nome || 'Cooperado';
    const cargoNome = alocacao?.cargo || 'Vaga';
    const unidNome = alocacao?.nome_unidade || 'Unidade';

    await conexao.query(
      `INSERT INTO ra_alertas (candidato_id, tipo, mensagem)
       VALUES (?, 'aceite_vaga', ?)`,
      [
        candidatoId,
        `🎉 VAGA CONFIRMADA: O cooperado ${candNome} aceitou a vaga "${cargoNome}" na unidade "${unidNome}" e iniciou a visualização da Palestra Institucional.`
      ]
    );

    await conexao.query(
      `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_nome)
       VALUES (?, 'ra_alocacoes', 'status', 'validacao', 'pendente_aceite', 'aceita', ?, 'Cooperado (Portal / App)')`,
      [
        candidatoId,
        `Vaga "${cargoNome}" aceita pelo cooperado através do Portal Web. IP: ${ip || 'N/A'}. ${observacoes || ''}`
      ]
    );

    await conexao.commit();
    return { ok: true, alocacaoId: alocacao?.id ?? null };
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
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
    } catch { }

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
    } catch { }

    await conexao.commit();
    return true;
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
}

export async function declinarVagaPortal(candidatoId, { motivo, alocacaoId } = {}) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    let queryAloc = `SELECT a.*, pv.cargo, e.nome_empresa, pu.nome_unidade, c.nome as candidato_nome
       FROM ra_alocacoes a
       LEFT JOIN parametro_vagas pv ON pv.id = a.vaga_id
       LEFT JOIN empresas e ON e.id = a.empresa_id
       LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
       LEFT JOIN ra_candidatos c ON c.id = a.candidato_id
       WHERE a.candidato_id = ?`;
    const params = [candidatoId];
    if (alocacaoId) {
      queryAloc += ` AND a.id = ?`;
      params.push(alocacaoId);
    } else {
      queryAloc += ` AND a.status = 'ativa' ORDER BY a.criado_em DESC LIMIT 1`;
    }

    const [[alocacao]] = await conexao.query(queryAloc, params);

    if (alocacao) {
      const obsRecusa = `[Vaga Recusada pelo Cooperado em ${new Date().toLocaleString('pt-BR')}]${motivo ? ` Motivo: ${motivo}` : ''}`;
      await conexao.query(
        `UPDATE ra_alocacoes 
         SET status = 'encerrada', 
             observacoes = CONCAT(COALESCE(observacoes, ''), '\n', ?),
             encerrado_em = NOW(),
             encerrado_por_nome = 'Cooperado (Portal / App)'
         WHERE id = ?`,
        [obsRecusa, alocacao.id]
      );
    }

    const candNome = alocacao?.candidato_nome || 'Cooperado';
    const cargoNome = alocacao?.cargo || 'Vaga';
    const unidNome = alocacao?.nome_unidade || 'Unidade';

    // Atualiza status da proposta e candidato
    await conexao.query(
      `INSERT INTO ra_proposta_adesao (candidato_id, status_adesao, atualizado_em)
       VALUES (?, 'declinada', NOW())
       ON DUPLICATE KEY UPDATE status_adesao = 'declinada', atualizado_em = NOW()`,
      [candidatoId]
    );

    // Alerta de ALTA prioridade para o módulo RA para que nova seleção de candidato seja efetuada
    await conexao.query(
      `INSERT INTO ra_alertas (candidato_id, tipo, mensagem)
       VALUES (?, 'vaga_recusada', ?)`,
      [
        candidatoId,
        `⚠️ VAGA RECUSADA: O cooperado ${candNome} declinou a oportunidade da vaga "${cargoNome}" na unidade "${unidNome}". A vaga retornou para status ABERTA — favor realizar nova seleção no RA.${motivo ? ` Motivo: "${motivo}".` : ''}`
      ]
    );

    // Registro de Auditoria
    await conexao.query(
      `INSERT INTO ra_auditoria (candidato_id, tabela, acao, valor_anterior, valor_novo, observacao, usuario_nome)
       VALUES (?, 'ra_alocacoes', 'edicao', 'ativa', 'recusada', ?, 'Cooperado (Portal / App)')`,
      [
        candidatoId,
        `Cooperado recusou a oportunidade para a vaga "${cargoNome}". ${motivo ? `Motivo: ${motivo}` : ''}`
      ]
    );

    await conexao.commit();
    return { ok: true, mensagem: 'Vaga declinada com sucesso. A equipe do RA foi notificada para nova seleção.' };
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}

export async function sincronizarApontamentosEmMassa(candidatoId, batidas = [], ip = null) {
  if (!Array.isArray(batidas) || batidas.length === 0) {
    return { ok: true, inseridos: 0 };
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[cand]] = await conexao.query(`SELECT id, nome, matricula FROM ra_candidatos WHERE id = ?`, [candidatoId]);
    const candNome = cand?.nome || 'Cooperado';

    let inseridos = 0;
    for (const b of batidas) {
      const tsDisp = b.timestampDispositivo ? new Date(b.timestampDispositivo) : new Date();

      // Checa se já existe apontamento idêntico registrado nos últimos 3 segundos para evitar duplicatas
      const [[existente]] = await conexao.query(
        `SELECT id FROM ra_apontamentos 
         WHERE candidato_id = ? AND tipo_evento = ? AND ABS(TIMESTAMPDIFF(SECOND, timestamp_dispositivo, ?)) <= 3
         LIMIT 1`,
        [candidatoId, b.tipoEvento, tsDisp]
      );

      if (!existente) {
        const [insertRes] = await conexao.query(
          `INSERT INTO ra_apontamentos 
            (candidato_id, alocacao_id, vaga_id, data_referencia, tipo_evento, timestamp_dispositivo, latitude, longitude, precisao_metros, endereco_aproximado, par_indice, observacao, ip_sincronizacao)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            candidatoId,
            b.alocacaoId || null,
            b.vagaId || null,
            b.dataReferencia || dataLocalISO(b.timestampDispositivo ? new Date(b.timestampDispositivo) : new Date()),
            b.tipoEvento,
            tsDisp,
            b.latitude || null,
            b.longitude || null,
            b.precisaoMetros || null,
            b.enderecoAproximado || null,
            b.parIndice || 1,
            b.observacao || null,
            ip || b.ip || null
          ]
        );
        const novoApontamentoId = insertRes.insertId;

        // Gravação do log de auditoria do evento registrado pelo App
        try {
          await conexao.query(
            `INSERT INTO supervisao_auditoria_apontamentos
               (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, ip, origem, criado_em)
             VALUES (?, ?, ?, ?, ?, 'cooperado', 'criacao', 'apontamento_ponto', NULL, ?, ?, ?, 'app_cooperado', ?)`,
            [
              novoApontamentoId,
              candidatoId,
              candNome,
              candidatoId,
              candNome,
              b.tipoEvento,
              b.observacao || `Registro de ponto efetuado no App do Cooperado (${b.tipoEvento})`,
              ip || b.ip || null,
              tsDisp
            ]
          );
        } catch (errAud) {
          console.warn('[sincronizarApontamentos] Erro ao gravar log de auditoria:', errAud?.message);
        }

        inseridos++;
      }
    }

    await conexao.commit();
    return { ok: true, inseridos };
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}

export async function obterHistoricoApontamentos(candidatoId, { dataInicio, dataFim, limite = 100 } = {}) {
  let query = `SELECT * FROM ra_apontamentos WHERE candidato_id = ?`;
  const params = [candidatoId];
  if (dataInicio) {
    query += ` AND data_referencia >= ?`;
    params.push(dataInicio);
  }
  if (dataFim) {
    query += ` AND data_referencia <= ?`;
    params.push(dataFim);
  }
  query += ` ORDER BY timestamp_dispositivo DESC LIMIT ?`;
  params.push(Number(limite));

  const [rows] = await pool.query(query, params);
  return rows;
}

export async function definirSenhaCooperado(candidatoId, senha) {
  if (!senha || senha.length < 6) {
    throw new Error('A senha deve conter no mínimo 6 caracteres.');
  }

  // Verifica se a senha contém a data de nascimento do cooperado
  const [[ds]] = await pool.query(
    `SELECT data_nascimento FROM ra_dados_sensiveis WHERE candidato_id = ?`,
    [candidatoId]
  );
  if (ds && ds.data_nascimento) {
    const limpo = String(ds.data_nascimento).replace(/[T\s].*$/, '').replace(/\D/g, '');
    let ano = '', mes = '', dia = '';
    if (limpo.length === 8) {
      if (Number(limpo.slice(0, 4)) > 1900 && Number(limpo.slice(0, 4)) < 2100) {
        ano = limpo.slice(0, 4); mes = limpo.slice(4, 6); dia = limpo.slice(6, 8);
      } else {
        dia = limpo.slice(0, 2); mes = limpo.slice(2, 4); ano = limpo.slice(4, 8);
      }
    } else if (String(ds.data_nascimento).includes('-')) {
      const parts = String(ds.data_nascimento).split('-');
      if (parts.length === 3) {
        ano = parts[0]; mes = parts[1].padStart(2, '0'); dia = parts[2].slice(0, 2).padStart(2, '0');
      }
    }
    if (ano && mes && dia) {
      const padroes = [
        `${dia}${mes}${ano}`, `${ano}${mes}${dia}`, `${dia}${mes}${ano.slice(-2)}`,
        `${dia}/${mes}/${ano}`, `${dia}-${mes}-${ano}`, `${dia}.${mes}.${ano}`,
        `${ano}-${mes}-${dia}`, `${dia}${mes}`, `${mes}${dia}`, ano
      ];
      const strSenha = String(senha).toLowerCase();
      const senhaDigitos = strSenha.replace(/\D/g, '');
      for (const p of padroes) {
        if (strSenha.includes(p.toLowerCase()) || (p.replace(/\D/g, '').length >= 4 && senhaDigitos.includes(p.replace(/\D/g, '')))) {
          throw new Error('Por motivos de segurança, a sua senha não pode conter a sua data de nascimento.');
        }
      }
    }
  }

  const bcrypt = await import('bcryptjs');
  const hash = await bcrypt.default.hash(senha, 10);

  try {
    await pool.query(`ALTER TABLE ra_candidatos ADD COLUMN senha_hash VARCHAR(255) NULL`);
  } catch { }
  await pool.query(`UPDATE ra_candidatos SET senha_hash = ? WHERE id = ?`, [hash, candidatoId]);

  // Disparo automático de WhatsApp informando o acesso ao App
  try {
    const [[cand]] = await pool.query(`SELECT id, nome, email, cpf, telefone FROM ra_candidatos WHERE id = ?`, [candidatoId]);
    if (cand && (cand.telefone || cand.cpf)) {
      const baseUrl = (
        process.env.PORTAL_COOPERADO_URL ||
        process.env.APP_URL ||
        process.env.FRONTEND_URL ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '') ||
        (process.env.NODE_ENV === 'production' ? 'https://atesa.connectortech.com.br' : 'http://localhost:8100')
      ).replace(/\/+$/, '');
      const linkApp = `${baseUrl}/cooperado/app`;
      const tel = cand.telefone ? String(cand.telefone).replace(/\D/g, '') : '';
      const mensagem = `Olá, ${cand.nome.split(' ')[0]}! 🔐\n\nSua senha de acesso ao *App do Cooperado ATESA* foi cadastrada com sucesso!\n\n📱 *Para acessar o App e seus apontamentos de ponto:*\n• Usuário / Login: Seu CPF (*${cand.cpf || cand.email}*)\n• Link direto do App: ${linkApp}\n\nSeja bem-vindo(a) à ATESA! 💙`;

      const zapiId = process.env.ZAPI_INSTANCE_ID;
      const zapiTok = process.env.ZAPI_TOKEN;
      if (zapiId && zapiTok && tel) {
        try {
          const numero = tel.startsWith('55') ? tel : `55${tel}`;
          await fetch(`https://api.z-api.io/instances/${zapiId}/token/${zapiTok}/send-text`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(process.env.ZAPI_CLIENT_TOKEN ? { 'Client-Token': process.env.ZAPI_CLIENT_TOKEN } : {}),
            },
            body: JSON.stringify({ phone: numero, message: mensagem }),
          });
        } catch (err) {
          console.error('Erro ao enviar WhatsApp de credenciais via Z-API:', err?.message);
        }
      }

      await pool.query(
        `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'whatsapp', ?)`,
        [candidatoId, `WhatsApp de confirmação de senha e link do App enviado para ${cand.nome}.`]
      );
    }
  } catch (err) {
    console.error('Erro ao processar notificação WhatsApp de senha:', err?.message);
  }

  return { ok: true, mensagem: 'Senha definida com sucesso.' };
}

export async function solicitarCorrecaoDados(candidatoId, { dadosSensiveis, dadosBancarios, contatosEmergencia, motivo, ip } = {}) {
  if (dadosSensiveis) await salvarDadosSensiveis(candidatoId, dadosSensiveis);
  if (dadosBancarios) await salvarDadosBancarios(candidatoId, dadosBancarios);
  if (contatosEmergencia) await salvarContatosEmergencia(candidatoId, contatosEmergencia);

  const [[cand]] = await pool.query(`SELECT nome, matricula FROM ra_candidatos WHERE id = ?`, [candidatoId]);
  const nomeC = cand?.nome || 'Cooperado';

  await criarAlerta(
    candidatoId,
    'solicitacao_correcao_dados',
    `✏️ SOLICITAÇÃO DE CORREÇÃO CADASTRAL: O cooperado ${nomeC} atualizou seus dados via App para conferência da equipe.${motivo ? ` Motivo: "${motivo}".` : ''}`
  );

  await registrarAuditoria({
    candidatoId,
    tabela: 'ra_candidatos',
    acao: 'edicao',
    observacao: `Solicitação de correção cadastral via App do Cooperado. IP: ${ip || 'N/A'}.${motivo ? ` Motivo: ${motivo}` : ''}`,
    usuarioNome: `Cooperado (${nomeC})`,
  });

  return { ok: true, mensagem: 'Solicitação de correção enviada para conferência com sucesso.' };
}

export async function obterOuGerarSenhaTemporaria(candidatoId) {
  try {
    await pool.query(`ALTER TABLE ra_candidatos ADD COLUMN senha_temporaria VARCHAR(50) NULL`);
  } catch { }

  const [[c]] = await pool.query(
    `SELECT id, senha_temporaria, cpf, email FROM ra_candidatos WHERE id = ?`,
    [candidatoId]
  );
  if (!c) return null;

  if (c.senha_temporaria && String(c.senha_temporaria).trim().length >= 4) {
    return String(c.senha_temporaria).trim();
  }

  const aleatorio = Math.floor(1000 + Math.random() * 9000);
  const novaSenha = `Atesa${aleatorio}`;
  await pool.query(`UPDATE ra_candidatos SET senha_temporaria = ? WHERE id = ?`, [novaSenha, candidatoId]);
  return novaSenha;
}

export async function validarAcessoPortalCooperado(candidatoId, { login, senha }) {
  if (!login || !senha) {
    throw new Error('Informe seu CPF ou E-mail cadastrado e sua senha temporária.');
  }

  try {
    await pool.query(`ALTER TABLE ra_candidatos ADD COLUMN senha_temporaria VARCHAR(50) NULL`);
  } catch { }

  const [[candidato]] = await pool.query(
    `SELECT id, nome, cpf, email, telefone, cooperativa, matricula, status, senha_temporaria, senha_hash
     FROM ra_candidatos WHERE id = ?`,
    [candidatoId]
  );

  if (!candidato) {
    throw new Error('Cooperado não encontrado para este link de adesão.');
  }

  const loginLimpo = String(login).trim().toLowerCase();
  const cpfLimpo = String(login).replace(/\D/g, '');
  const candCpfLimpo = String(candidato.cpf || '').replace(/\D/g, '');
  const candEmailLimpo = String(candidato.email || '').trim().toLowerCase();

  const matchCpf = cpfLimpo.length >= 11 && candCpfLimpo === cpfLimpo;
  const matchEmail = Boolean(candEmailLimpo && candEmailLimpo === loginLimpo);

  if (!matchCpf && !matchEmail) {
    throw new Error('O CPF ou E-mail informado não corresponde a este convite de adesão. Por favor, utilize o link enviado para o seu número/e-mail cadastrado.');
  }

  const senhaTrim = String(senha).trim();
  let senhaValida = false;

  if (candidato.senha_temporaria && candidato.senha_temporaria.trim() === senhaTrim) {
    senhaValida = true;
  } else if (candidato.senha_hash) {
    const bcrypt = await import('bcryptjs');
    senhaValida = await bcrypt.default.compare(senhaTrim, candidato.senha_hash).catch(() => false);
  }

  if (!senhaValida) {
    throw new Error('Senha temporária ou CPF incorretos. Verifique a senha temporária recebida na mensagem de WhatsApp/E-mail.');
  }

  return {
    ok: true,
    candidato: {
      id: candidato.id,
      nome: candidato.nome,
      cpf: candidato.cpf,
      email: candidato.email,
      cooperativa: candidato.cooperativa,
    }
  };
}

export async function autenticarCooperadoApp({ login, senha }) {
  if (!login || !senha) {
    throw new Error('Informe seu CPF ou E-mail e sua senha.');
  }

  const loginLimpo = String(login).trim().toLowerCase();
  const cpfLimpo = String(login).replace(/\D/g, '');

  // 1. Busca exclusivamente na tabela ra_candidatos
  const [candidatos] = await pool.query(
    `SELECT id, nome, cpf, email, telefone, whatsapp, cooperativa, matricula, status, senha_temporaria, senha_hash
     FROM ra_candidatos
     WHERE LOWER(email) = ? OR (LENGTH(?) >= 11 AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?)
     LIMIT 1`,
    [loginLimpo, cpfLimpo, cpfLimpo]
  );

  const candidato = candidatos[0];

  // Se não encontrar na tabela de cooperados, verifica se é um colaborador interno (Executivo, Admin, etc.)
  if (!candidato) {
    try {
      const [usuarios] = await pool.query(
        `SELECT id, nome, tipo_usuario FROM usuarios 
         WHERE LOWER(email) = ? OR (LENGTH(?) >= 11 AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?)
         LIMIT 1`,
        [loginLimpo, cpfLimpo, cpfLimpo]
      );
      if (usuarios && usuarios.length > 0) {
        const u = usuarios[0];
        if (u.tipo_usuario !== 'cooperado') {
          throw new Error('Acesso restrito: Este aplicativo é exclusivo para Cooperados ATESA. Colaboradores e Executivos devem acessar o Portal Web.');
        }
      }
    } catch (e) {
      if (e.message && e.message.includes('Acesso restrito')) throw e;
    }

    throw new Error('Cooperado não cadastrado no sistema ATESA.');
  }

  const token = Buffer.from(String(candidato.id)).toString('base64');

  // Verifica status de homologação da proposta
  const [[prop]] = await pool.query(
    `SELECT status_adesao, homologado_em FROM ra_proposta_adesao WHERE candidato_id = ?`,
    [candidato.id]
  );

  const homologado100 = Boolean(
    (candidato.status === 1 || candidato.status === 2) &&
    (prop?.status_adesao === 'homologado_100' || prop?.homologado_em || (candidato.matricula && Number(candidato.matricula) >= 34638))
  );

  const senhaTrim = String(senha).trim();
  let senhaValida = false;

  const matchSenhaTemp = Boolean(candidato.senha_temporaria && candidato.senha_temporaria.trim() === senhaTrim);
  if (matchSenhaTemp) {
    senhaValida = true;
  } else if (candidato.senha_hash) {
    const bcrypt = await import('bcryptjs');
    senhaValida = await bcrypt.default.compare(senhaTrim, candidato.senha_hash).catch(() => false);
  }

  if (!senhaValida) {
    throw new Error('CPF/E-mail ou senha incorretos.');
  }

  // Se o cooperado ainda não foi homologado 100%, libera o acesso para a adesão
  if (!homologado100) {
    return {
      ok: true,
      token,
      redirecionarParaAdesao: true,
      homologado100: false,
      candidato: {
        id: candidato.id,
        nome: candidato.nome,
        cpf: candidato.cpf,
        email: candidato.email,
        cooperativa: candidato.cooperativa,
      }
    };
  }

  // Se já foi homologado 100%
  return {
    ok: true,
    token,
    redirecionarParaAdesao: false,
    homologado100: true,
    candidato: {
      id: candidato.id,
      nome: candidato.nome,
      cpf: candidato.cpf,
      email: candidato.email,
      matricula: candidato.matricula,
      cooperativa: candidato.cooperativa,
      telefone: candidato.telefone,
    }
  };
}

// ── Verificação de Status de Senha do Cooperado (Esqueci Minha Senha no App) ──
export async function verificarStatusSenhaCooperado(identificador) {
  if (!identificador || !String(identificador).trim()) {
    throw new Error('Informe seu CPF ou E-mail cadastrado.');
  }

  const loginLimpo = String(identificador).trim().toLowerCase();
  const cpfLimpo = String(identificador).replace(/\D/g, '');

  const [candidatos] = await pool.query(
    `SELECT id, nome, cpf, email, telefone, whatsapp, cooperativa, matricula, status, senha_temporaria, senha_hash
     FROM ra_candidatos
     WHERE LOWER(email) = ? OR (LENGTH(?) >= 11 AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?)
     LIMIT 1`,
    [loginLimpo, cpfLimpo, cpfLimpo]
  );

  const cand = candidatos[0];
  if (!cand) {
    return {
      ok: false,
      status: 'nao_encontrado',
      mensagem: 'Cooperado não encontrado. Verifique o E-mail digitado.',
    };
  }

  // Verifica status da proposta de adesão
  const [[prop]] = await pool.query(
    `SELECT status_adesao, homologado_em FROM ra_proposta_adesao WHERE candidato_id = ?`,
    [cand.id]
  );

  const homologado100 = Boolean(
    (cand.status === 1 || cand.status === 2) &&
    (prop?.status_adesao === 'homologado_100' || prop?.homologado_em || (cand.matricula && Number(cand.matricula) >= 34638))
  );

  const token = Buffer.from(String(cand.id)).toString('base64');
  const temSenhaDefinida = Boolean(cand.senha_hash && String(cand.senha_hash).length > 10);

  // Mascaramento de e-mail e telefone para exibição segura
  const emailMascarado = cand.email
    ? cand.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => `${a}${'*'.repeat(Math.min(b.length, 5))}${c}`)
    : 'E-mail não cadastrado';

  const telLimpo = cand.telefone ? String(cand.telefone).replace(/\D/g, '') : '';
  const telMascarado = telLimpo.length >= 10
    ? `(${telLimpo.slice(0, 2)}) *****-${telLimpo.slice(-4)}`
    : 'Telefone não cadastrado';

  if (!homologado100) {
    return {
      ok: true,
      status: 'adesao_em_andamento',
      candidatoId: cand.id,
      nome: cand.nome,
      primeiroNome: cand.nome.split(' ')[0],
      mensagem: 'Seu processo de adesão ainda não foi 100% homologado pela Cooperativa ATESA. O acesso ao aplicativo e a criação de senha são liberados automaticamente assim que sua adesão for homologada pela equipe.',
    };
  }

  if (!temSenhaDefinida) {
    return {
      ok: true,
      status: 'aguardando_senha_portal',
      candidatoId: cand.id,
      nome: cand.nome,
      primeiroNome: cand.nome.split(' ')[0],
      token,
      linkPortal: `/cooperado/cadastro?token=${token}&aba=5`,
      mensagem: 'Sua adesão foi 100% homologada com sucesso! Para seu primeiro acesso, é necessário criar sua senha de acesso ao App na etapa de Finalização (Aba 5) do Portal do Cooperado.',
    };
  }

  return {
    ok: true,
    status: 'senha_atualizada',
    candidatoId: cand.id,
    nome: cand.nome,
    primeiroNome: cand.nome.split(' ')[0],
    emailMascarado,
    telMascarado,
    mensagem: 'Cooperado ativo com senha cadastrada. Você pode receber um código de 6 dígitos para redefinir sua senha.',
  };
}

// ── Solicitar Código e Link de Verificação para Redefinição no App ───────────
export async function solicitarCodigoResetApp(identificador, ip = null) {
  const statusRes = await verificarStatusSenhaCooperado(identificador);
  if (!statusRes.ok) {
    throw new Error(statusRes.mensagem || 'Cooperado não encontrado.');
  }

  if (statusRes.status !== 'senha_atualizada') {
    return statusRes;
  }

  const candidatoId = statusRes.candidatoId;

  // Garante existência da tabela de reset e coluna token_reset
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supervisao_reset_senhas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        codigo VARCHAR(10) NOT NULL,
        token_reset VARCHAR(64) NULL,
        expira_em DATETIME NOT NULL,
        tentativas INT NOT NULL DEFAULT 0,
        utilizado TINYINT(1) NOT NULL DEFAULT 0,
        utilizado_em DATETIME NULL,
        solicitado_por_id INT NULL,
        solicitado_por_nome VARCHAR(255) NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_cand (candidato_id),
        INDEX idx_codigo (codigo),
        INDEX idx_token_reset (token_reset)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  } catch { }

  try {
    await pool.query(`ALTER TABLE supervisao_reset_senhas ADD COLUMN token_reset VARCHAR(64) NULL`);
  } catch { }

  const crypto = await import('crypto');
  const tokenReset = crypto.default.randomBytes(32).toString('hex');
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expiraEm = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas

  // Invalida solicitações anteriores não utilizadas
  await pool.query(
    `UPDATE supervisao_reset_senhas SET utilizado = 1 WHERE candidato_id = ? AND utilizado = 0`,
    [candidatoId]
  );

  // Insere nova solicitação de reset
  await pool.query(
    `INSERT INTO supervisao_reset_senhas
       (candidato_id, codigo, token_reset, expira_em, solicitado_por_nome)
     VALUES (?, ?, ?, ?, 'App do Cooperado (Autoatendimento)')`,
    [candidatoId, codigo, tokenReset, expiraEm]
  );

  const [[cand]] = await pool.query(`SELECT id, nome, email, cpf, telefone FROM ra_candidatos WHERE id = ?`, [candidatoId]);

  const baseUrl = (
    process.env.APP_URL ||
    process.env.PORTAL_COOPERADO_URL ||
    process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://atesa.connectortech.com.br' : 'http://localhost:8100')
  ).replace(/\/+$/, '');

  const linkReset = `${baseUrl}/cooperado/app?token=${tokenReset}`;

  // Envia e-mail via SMTP institucional da ATESA (Zimbra)
  if (cand?.email) {
    try {
      console.log(`[solicitarCodigoResetApp] Enviando e-mail de recuperação para: ${cand.email} com código: ${codigo}`);
      await enviarEmailRecuperacaoSenha({
        email: cand.email,
        nome: cand.nome,
        token: tokenReset,
        codigo,
        linkSistema: baseUrl,
        destino: 'app',
      });
      console.log(`[solicitarCodigoResetApp] E-mail de recuperação com código 2FA enviado com sucesso para ${cand.email}`);
    } catch (errEmail) {
      console.error('[solicitarCodigoResetApp] Erro ao enviar e-mail institucional via SMTP:', errEmail);
      try {
        await enviarEmail({
          para: cand.email,
          assunto: '🔐 Redefinição de Senha — App do Cooperado ATESA',
          html: `
            <div style="font-family: -apple-system, sans-serif; padding: 24px; background: #f4f6fa;">
              <h2 style="color: #2e7d32;">Olá, ${cand.nome}!</h2>
              <p>Recebemos uma solicitação de redefinição de senha para a sua conta no App do Cooperado ATESA.</p>
              <p><a href="${linkReset}" style="display: inline-block; background: #2e7d32; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Redefinir Minha Senha →</a></p>
              <p style="font-size: 12px; color: #777;">Link válido por 2 horas: ${linkReset}</p>
            </div>
          `,
          texto: `Olá ${cand.nome}, para redefinir sua senha no App do Cooperado ATESA, acesse o link: ${linkReset} (válido por 2 horas).`,
        });
        console.log(`[solicitarCodigoResetApp] E-mail simples enviado com sucesso para ${cand.email}`);
      } catch (errFallback) {
        console.error('[solicitarCodigoResetApp] Erro no fallback de envio de e-mail:', errFallback);
      }
    }
  }

  return {
    ok: true,
    status: 'codigo_enviado',
    tokenReset,
    linkReset,
    emailMascarado: statusRes.emailMascarado,
    mensagem: `E-mail de recuperação enviado com sucesso para ${cand.email || statusRes.emailMascarado}! Verifique sua caixa de entrada.`,
  };
}

// ── Validar Token de Reset no App ───────────────────────────────────────────
export async function validarTokenResetApp(token) {
  if (!token || !String(token).trim()) {
    return { valido: false, erro: 'Token não informado.' };
  }

  const tokenLimpo = String(token).trim();

  try {
    const [[solic]] = await pool.query(
      `SELECT s.*, c.nome, c.email, c.cpf 
       FROM supervisao_reset_senhas s
       JOIN ra_candidatos c ON c.id = s.candidato_id
       WHERE (s.token_reset = ? OR s.codigo = ?) AND s.utilizado = 0 AND s.expira_em > NOW()
       ORDER BY s.id DESC LIMIT 1`,
      [tokenLimpo, tokenLimpo]
    );

    if (!solic) {
      return { valido: false, erro: 'Link de recuperação inválido ou expirado. Solicite uma nova recuperação.' };
    }

    let dataNascimento = null;
    try {
      const [[ds]] = await pool.query(
        `SELECT data_nascimento FROM ra_dados_sensiveis WHERE candidato_id = ? LIMIT 1`,
        [solic.candidato_id]
      );
      if (ds?.data_nascimento) {
        dataNascimento = ds.data_nascimento;
      }
    } catch { }

    return {
      valido: true,
      usuario: {
        id: solic.candidato_id,
        nome: solic.nome,
        email: solic.email,
        cpf: solic.cpf,
        dataNascimento,
      },
    };
  } catch (err) {
    console.error('Erro ao validar token de reset app:', err);
    return { valido: false, erro: 'Erro ao validar link de recuperação.' };
  }
}

// ── Confirmar Redefinição de Senha do App ─────────────────────────────────────
export async function redefinirSenhaApp({ identificador, codigo, tokenReset, novaSenha }) {
  if (!novaSenha || novaSenha.length < 6) {
    throw new Error('A nova senha deve conter no mínimo 6 caracteres.');
  }

  const tokenOuCodigo = String(tokenReset || codigo || '').trim();
  if (!tokenOuCodigo) {
    throw new Error('Informe o código ou token de verificação.');
  }

  let cand = null;
  let solic = null;

  if (tokenReset || tokenOuCodigo) {
    const [[s]] = await pool.query(
      `SELECT * FROM supervisao_reset_senhas 
       WHERE (token_reset = ? OR codigo = ?) AND utilizado = 0 AND expira_em > NOW()
       ORDER BY id DESC LIMIT 1`,
      [tokenOuCodigo, tokenOuCodigo]
    );
    if (s) {
      solic = s;
      const [[c]] = await pool.query(`SELECT id, nome, cpf, email, telefone FROM ra_candidatos WHERE id = ?`, [s.candidato_id]);
      cand = c;
    }
  }

  if (!solic && identificador) {
    const loginLimpo = String(identificador).trim().toLowerCase();
    const cpfLimpo = String(identificador).replace(/\D/g, '');

    const [candidatos] = await pool.query(
      `SELECT id, nome, cpf, email, telefone FROM ra_candidatos
       WHERE LOWER(email) = ? OR (LENGTH(?) >= 11 AND REPLACE(REPLACE(REPLACE(cpf, '.', ''), '-', ''), ' ', '') = ?)
       LIMIT 1`,
      [loginLimpo, cpfLimpo, cpfLimpo]
    );
    cand = candidatos[0];

    if (cand) {
      const [[s]] = await pool.query(
        `SELECT * FROM supervisao_reset_senhas 
         WHERE candidato_id = ? AND utilizado = 0 AND expira_em > NOW()
         ORDER BY id DESC LIMIT 1`,
        [cand.id]
      );
      solic = s;
    }
  }

  if (!cand || !solic) {
    throw new Error('Link ou código de verificação inválido ou expirado. Solicite um novo link.');
  }

  if (solic.tentativas >= 5) {
    await pool.query(`UPDATE supervisao_reset_senhas SET utilizado = 1 WHERE id = ?`, [solic.id]);
    throw new Error('Limite de tentativas excedido. Solicite um novo link de verificação.');
  }

  const codigoValido = (solic.token_reset && solic.token_reset === tokenOuCodigo) || (String(solic.codigo).trim() === tokenOuCodigo);
  if (!codigoValido) {
    await pool.query(`UPDATE supervisao_reset_senhas SET tentativas = tentativas + 1 WHERE id = ?`, [solic.id]);
    throw new Error('Código ou link de verificação incorreto. Verifique os dados digitados.');
  }

  // Validação e gravação da nova senha no banco
  await definirSenhaCooperado(cand.id, novaSenha);

  // Marca token/código como utilizado
  await pool.query(
    `UPDATE supervisao_reset_senhas SET utilizado = 1, utilizado_em = NOW() WHERE id = ?`,
    [solic.id]
  );

  return {
    ok: true,
    mensagem: 'Sua senha foi redefinida com sucesso! Você já pode entrar no aplicativo.',
  };
}



