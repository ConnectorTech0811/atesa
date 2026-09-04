-- ============================================================
-- Modulo 5: Beneficios — tabelas de dados sensiveis, bancarios,
-- documentos, descontos e alertas de candidatos
-- Executar no schema conn0686_atesa
-- ============================================================

-- Dados pessoais sensiveis do candidato (1:1 com ra_candidatos)
CREATE TABLE IF NOT EXISTS ra_dados_sensiveis (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  candidato_id      INT NOT NULL UNIQUE,
  data_nascimento   DATE NULL,
  rg                VARCHAR(20) NULL,
  orgao_emissor     VARCHAR(30) NULL,
  uf_rg             CHAR(2) NULL,
  nome_mae          VARCHAR(200) NULL,
  nome_pai          VARCHAR(200) NULL,
  estado_civil      ENUM('solteiro','casado','divorciado','viuvo','uniao_estavel') NULL,
  naturalidade      VARCHAR(100) NULL,
  nacionalidade     VARCHAR(100) DEFAULT 'Brasileiro(a)',
  cep               VARCHAR(9) NULL,
  logradouro        VARCHAR(200) NULL,
  numero            VARCHAR(20) NULL,
  complemento       VARCHAR(100) NULL,
  bairro            VARCHAR(100) NULL,
  cidade            VARCHAR(100) NULL,
  uf                CHAR(2) NULL,
  pis_pasep         VARCHAR(20) NULL,
  titulo_eleitor    VARCHAR(30) NULL,
  cnh               VARCHAR(20) NULL,
  categoria_cnh     VARCHAR(5) NULL,
  cbo               VARCHAR(20) NULL,
  qualificacoes     TEXT NULL,
  atualizado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidato_id) REFERENCES ra_candidatos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Dados bancarios do candidato (1:1 com ra_candidatos)
CREATE TABLE IF NOT EXISTS ra_dados_bancarios (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidato_id  INT NOT NULL UNIQUE,
  banco         VARCHAR(100) NULL,
  codigo_banco  VARCHAR(10) NULL,
  agencia       VARCHAR(20) NULL,
  conta         VARCHAR(30) NULL,
  digito        VARCHAR(5) NULL,
  tipo_conta    ENUM('corrente','poupanca') DEFAULT 'corrente',
  chave_pix     VARCHAR(150) NULL,
  tipo_pix      ENUM('cpf','email','telefone','aleatoria') NULL,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidato_id) REFERENCES ra_candidatos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Documentos do candidato (1:N — varios documentos por candidato)
CREATE TABLE IF NOT EXISTS ra_documentos (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  candidato_id        INT NOT NULL,
  tipo                ENUM('foto_3x4','rg_frente','rg_verso','cpf','comprovante_residencia',
                           'comprovante_bancario','cnh','certificado','contrato','outro') NOT NULL,
  nome_original       VARCHAR(255) NOT NULL,
  nome_arquivo        VARCHAR(255) NOT NULL,
  mime_type           VARCHAR(100) NOT NULL,
  tamanho_bytes       INT NOT NULL,
  validado            TINYINT(1) NOT NULL DEFAULT 0,
  validado_por_nome   VARCHAR(200) NULL,
  validado_em         TIMESTAMP NULL,
  observacao          VARCHAR(500) NULL,
  enviado_em          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  enviado_por_nome    VARCHAR(200) NULL,
  FOREIGN KEY (candidato_id) REFERENCES ra_candidatos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Descontos do cooperado por alocacao
CREATE TABLE IF NOT EXISTS ra_descontos (
  id                      INT AUTO_INCREMENT PRIMARY KEY,
  candidato_id            INT NOT NULL UNIQUE,
  inss_percentual         DECIMAL(8,4) NOT NULL DEFAULT 0,
  seguro_vida_percentual  DECIMAL(8,4) NOT NULL DEFAULT 0,
  quota_parte_valor       DECIMAL(12,2) NOT NULL DEFAULT 0,
  quota_parcelada         TINYINT(1) NOT NULL DEFAULT 0,
  quota_total_cotas       INT NULL,
  quota_cotas_pagas       INT NOT NULL DEFAULT 0,
  rateio_percentual       DECIMAL(8,4) NOT NULL DEFAULT 0,
  outras_descricao        VARCHAR(200) NULL,
  outras_valor            DECIMAL(12,2) NOT NULL DEFAULT 0,
  atualizado_em           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (candidato_id) REFERENCES ra_candidatos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Alertas gerados automaticamente ao alterar documentos / dados
CREATE TABLE IF NOT EXISTS ra_alertas (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  candidato_id  INT NOT NULL,
  tipo          VARCHAR(80) NOT NULL,
  mensagem      TEXT NOT NULL,
  lido          TINYINT(1) NOT NULL DEFAULT 0,
  criado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (candidato_id) REFERENCES ra_candidatos(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SELECT 'beneficios_schema executado com sucesso.' AS resultado;
