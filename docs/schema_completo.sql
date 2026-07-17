-- ============================================================
-- ATESA — Schema completo do banco de dados
-- Cada serviço tem seu próprio banco; não há FK entre bancos.
-- ============================================================


-- ============================================================
-- BANCO: usuarios_db  (usuarios-service, porta 3002)
-- ============================================================

CREATE TABLE IF NOT EXISTS usuarios (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  nome              VARCHAR(150) NOT NULL,
  email             VARCHAR(150) NOT NULL UNIQUE,
  cpf               VARCHAR(11)  NOT NULL UNIQUE,
  telefone          VARCHAR(20),
  senha_hash        VARCHAR(255) NOT NULL,
  tipo_usuario      ENUM(
                      'administrador',
                      'consultor',
                      'executivo_contas',
                      'parametro',
                      'ra',
                      'beneficios',
                      'supervisao',
                      'faturamento',
                      'financeiro'
                    ) NOT NULL,
  eh_executivo      BOOLEAN   NOT NULL DEFAULT FALSE,
  regiao_id         INT       NOT NULL,          -- referência lógica ao regioes-service
  ativo             BOOLEAN   NOT NULL DEFAULT TRUE,
  trocar_senha      BOOLEAN   NOT NULL DEFAULT FALSE,  -- força troca na 1ª entrada
  criado_em         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX uk_usuarios_nome ON usuarios (nome);


-- ============================================================
-- BANCO: regioes_db  (regioes-service, porta 3001)
-- ============================================================

CREATE TABLE IF NOT EXISTS regioes (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(100) NOT NULL UNIQUE,
  uf        VARCHAR(2),
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================================
-- BANCO: empresas_db  (empresas-service, porta 3003)
-- ============================================================

-- regiao_id / executivo_id são referências lógicas a outros serviços.
-- A validação é feita via chamada HTTP — sem FK entre bancos.

CREATE TABLE IF NOT EXISTS empresas (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  cooperativa               VARCHAR(150) NOT NULL,
  consultor_nome            VARCHAR(150),
  nome_empresa              VARCHAR(200) NOT NULL,
  nome_empresa_normalizado  VARCHAR(200) NOT NULL,
  cnpj                      VARCHAR(14)  NULL UNIQUE,
  cep                       VARCHAR(9),
  rua                       VARCHAR(200),
  numero                    VARCHAR(20),
  complemento               VARCHAR(100),
  bairro                    VARCHAR(100),
  cidade                    VARCHAR(100),
  uf                        VARCHAR(2),
  email_empresa             VARCHAR(150) NOT NULL,
  telefone_empresa          VARCHAR(20)  NOT NULL,
  representante             VARCHAR(150),
  regiao_id                 INT NULL,
  regiao_nome               VARCHAR(100) NULL,
  data_primeiro_contato     DATE NULL,
  executivo_id              INT NULL,
  executivo_nome            VARCHAR(150) NULL,
  supervisor                VARCHAR(150),
  status                    VARCHAR(50)  NOT NULL DEFAULT 'Primeiro Contato',
  aprovada                  BOOLEAN      NOT NULL DEFAULT FALSE,
  criado_em                 TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nome_normalizado (nome_empresa_normalizado)
);

-- Histórico de contatos/visitas registrados pelo consultor para uma empresa.
-- registrado_por_* vem do token JWT — o usuário não pode alterar esse log.
CREATE TABLE IF NOT EXISTS historico_empresa (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id          INT         NOT NULL,
  tipo                VARCHAR(50) NOT NULL,  -- apresentacao_enviada | ligacao | visita_agendada | visita_cancelada
  data_registro       DATE        NOT NULL,
  observacoes         TEXT        NOT NULL,
  registrado_por_id   INT         NOT NULL,
  registrado_por_nome VARCHAR(150) NOT NULL,
  criado_em           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historico_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Ponteiro do rodízio de executivos por região.
CREATE TABLE IF NOT EXISTS rodizio_regiao (
  regiao_id      INT PRIMARY KEY,
  proximo_indice INT NOT NULL DEFAULT 0
);

-- Trabalhos (jobs) abertos pelo Executivo de Contas para uma empresa.
CREATE TABLE IF NOT EXISTS trabalhos (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id     INT          NOT NULL,
  titulo         VARCHAR(200) NOT NULL,
  status         ENUM('em_aberto','em_andamento','proposta_enviada','proposta_aceita','fechado','cancelado')
                              NOT NULL DEFAULT 'em_aberto',
  executivo_id   INT          NOT NULL,
  executivo_nome VARCHAR(150) NOT NULL,
  observacoes    TEXT,
  criado_em      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trabalho_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Contatos registrados durante o processo de um trabalho (pipeline comercial).
CREATE TABLE IF NOT EXISTS contatos_trabalho (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  trabalho_id         INT  NOT NULL,
  tipo                ENUM('ligacao','email','reuniao','visita','whatsapp') NOT NULL,
  data_contato        DATE NOT NULL,
  observacoes         TEXT NOT NULL,
  status_negocio      VARCHAR(50),  -- negocio_fechado | negociacao | negocio_frustrado | visita_agendada | visita_cancelada
  alerta_em           DATE NULL,    -- preenchido automaticamente em negocio_frustrado (+2 meses)
  registrado_por_id   INT  NOT NULL,
  registrado_por_nome VARCHAR(150) NOT NULL,
  criado_em           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contato_trabalho FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id)
);

-- Parâmetros do trabalho: vaga, textos da proposta e taxas da planilha.
-- Um trabalho tem no máximo um registro (UNIQUE em trabalho_id).
CREATE TABLE IF NOT EXISTS parametros_trabalho (
  id                        INT AUTO_INCREMENT PRIMARY KEY,
  trabalho_id               INT NOT NULL UNIQUE,

  -- Vaga
  cargo                     VARCHAR(200),
  quantidade                INT,
  descricao_cargo           TEXT,
  salario                   DECIMAL(10,2),
  beneficios                TEXT,
  local_trabalho            VARCHAR(200),
  horario                   VARCHAR(100),
  requisitos                TEXT,
  observacoes               TEXT,

  -- Textos institucionais da proposta comercial
  quem_somos                TEXT,
  cooperativismo            TEXT,
  nossos_valores            TEXT,
  cobranca                  TEXT,  -- condições de cobrança (campo livre)

  -- Taxas básicas
  taxa_administrativa       DECIMAL(5,2)  NULL DEFAULT 5.00,
  encargos_sociais          DECIMAL(5,2)  NULL DEFAULT 35.00,
  margem_lucro              DECIMAL(5,2)  NULL DEFAULT 10.00,
  taxa_risco                DECIMAL(5,2)  NULL DEFAULT 2.00,

  -- Taxas detalhadas (planilha Excel ATESA)
  dar_percentual            DECIMAL(5,2)  NULL DEFAULT 10.00,
  seguro_vida_percentual    DECIMAL(5,2)  NULL DEFAULT 1.50,
  inss_percentual           DECIMAL(5,2)  NULL DEFAULT 20.00,
  pis_percentual            DECIMAL(5,2)  NULL DEFAULT 0.65,
  cofins_percentual         DECIMAL(5,2)  NULL DEFAULT 1.65,
  iss_percentual            DECIMAL(5,2)  NULL DEFAULT 2.50,
  valor_vr_dia              DECIMAL(8,2)  NULL DEFAULT 0.00,
  valor_vt_dia              DECIMAL(8,2)  NULL DEFAULT 0.00,
  insalubridade_pre_pct     DECIMAL(5,2)  NULL DEFAULT 8.00,
  insalubridade_media_pct   DECIMAL(5,2)  NULL DEFAULT 9.00,
  insalubridade_maxima_pct  DECIMAL(5,2)  NULL DEFAULT 11.00,

  atualizado_em             TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_param_trabalho FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id)
);

-- Atividades/cargos da proposta comercial de um trabalho.
-- O executivo adiciona de 1 a 6 por vez; sem limite total.
CREATE TABLE IF NOT EXISTS proposta_atividades (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  trabalho_id       INT          NOT NULL,
  cargo             VARCHAR(200) NOT NULL,
  descricao         TEXT,
  quantidade        INT          NOT NULL DEFAULT 1,
  salario_base      DECIMAL(10,2),
  ordem             INT          NOT NULL DEFAULT 0,

  -- Escala de trabalho
  tipo_escala       ENUM('mensal','plantao') NOT NULL DEFAULT 'mensal',

  -- Benefícios e adicionais por atividade
  vr_dias           DECIMAL(5,2)  NULL DEFAULT 0,
  vt_dias           DECIMAL(5,2)  NULL DEFAULT 0,
  adicional_noturno BOOLEAN       NOT NULL DEFAULT FALSE,
  periculosidade    BOOLEAN       NOT NULL DEFAULT FALSE,
  insalubridade     ENUM('sem_risco','pre','media','maxima') NOT NULL DEFAULT 'sem_risco',
  premio_incentivo  DECIMAL(10,2) NULL DEFAULT 0,

  criado_em         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_atividade_proposta FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id)
);

-- Reuniões agendadas com clientes (pode ou não estar vinculada a um trabalho).
CREATE TABLE IF NOT EXISTS reunioes (
  id                  INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id          INT          NOT NULL,
  trabalho_id         INT          NULL,
  titulo              VARCHAR(200) NOT NULL,
  data_hora           DATETIME     NOT NULL,
  local_reuniao       VARCHAR(200),
  observacoes         TEXT,
  status              ENUM('agendada','realizada','cancelada') NOT NULL DEFAULT 'agendada',
  agendado_por_id     INT          NOT NULL,
  agendado_por_nome   VARCHAR(150) NOT NULL,
  criado_em           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reuniao_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);
