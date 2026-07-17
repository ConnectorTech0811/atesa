-- regiao_id e executivo_id são referências lógicas a outros serviços
-- (regioes-service e usuarios-service, cada um com seu próprio banco).
-- Não há FOREIGN KEY entre bancos de serviços diferentes.
--
-- Campos obrigatórios no cadastro feito pelo Consultor: nome_empresa,
-- telefone_empresa, email_empresa. Todo o resto (CNPJ, região, data do
-- primeiro contato, endereço, representante, supervisor) é opcional e
-- pode ser completado depois por outras áreas (ex.: Parâmetro).

CREATE TABLE IF NOT EXISTS empresas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  cooperativa VARCHAR(150) NOT NULL,
  consultor_nome VARCHAR(150),
  nome_empresa VARCHAR(200) NOT NULL,
  nome_empresa_normalizado VARCHAR(200) NOT NULL,
  cnpj VARCHAR(14) NULL UNIQUE,
  cep VARCHAR(9),
  rua VARCHAR(200),
  numero VARCHAR(20),
  complemento VARCHAR(100),
  bairro VARCHAR(100),
  cidade VARCHAR(100),
  uf VARCHAR(2),
  email_empresa VARCHAR(150) NOT NULL,
  telefone_empresa VARCHAR(20) NOT NULL,
  representante VARCHAR(150),
  regiao_id INT NULL,
  regiao_nome VARCHAR(100) NULL,
  data_primeiro_contato DATE NULL,
  executivo_id INT NULL,
  executivo_nome VARCHAR(150) NULL,
  supervisor VARCHAR(150),
  status VARCHAR(50) NOT NULL DEFAULT 'Primeiro Contato',
  aprovada BOOLEAN NOT NULL DEFAULT FALSE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_nome_normalizado (nome_empresa_normalizado)
);

-- Histórico de contatos/visitas com a empresa. registrado_por_* vem do
-- token JWT (via cabeçalho confiável injetado pelo gateway), nunca do
-- corpo da requisição — por isso o usuário não consegue alterar esse log.
CREATE TABLE IF NOT EXISTS historico_empresa (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  tipo VARCHAR(50) NOT NULL,
  data_registro DATE NOT NULL,
  observacoes TEXT NOT NULL,
  registrado_por_id INT NOT NULL,
  registrado_por_nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historico_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Ponteiro do rodízio de executivos por região (a lista de executivos
-- em si vive no usuarios-service; aqui guardamos apenas a posição atual).
CREATE TABLE IF NOT EXISTS rodizio_regiao (
  regiao_id INT PRIMARY KEY,
  proximo_indice INT NOT NULL DEFAULT 0
);

-- Trabalhos (jobs) abertos pelo Executivo de Contas para uma empresa.
-- Cada trabalho representa um processo de alocação/contratação.
CREATE TABLE IF NOT EXISTS trabalhos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  titulo VARCHAR(200) NOT NULL,
  status ENUM('em_aberto','em_andamento','proposta_enviada','proposta_aceita','fechado','cancelado') NOT NULL DEFAULT 'em_aberto',
  executivo_id INT NOT NULL,
  executivo_nome VARCHAR(150) NOT NULL,
  observacoes TEXT,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_trabalho_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Histórico de contatos específicos de um trabalho.
-- Complementa o histórico geral da empresa com contexto do job.
CREATE TABLE IF NOT EXISTS contatos_trabalho (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trabalho_id INT NOT NULL,
  tipo ENUM('ligacao','email','reuniao','visita','whatsapp') NOT NULL,
  data_contato DATE NOT NULL,
  observacoes TEXT NOT NULL,
  status_negocio VARCHAR(50),
  alerta_em DATE NULL,
  registrado_por_id INT NOT NULL,
  registrado_por_nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_contato_trabalho FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id)
);

-- Parâmetros do trabalho: vagas, descrições, requisitos.
-- Um trabalho tem no máximo um registro de parâmetros (UNIQUE em trabalho_id).
CREATE TABLE IF NOT EXISTS parametros_trabalho (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trabalho_id INT NOT NULL UNIQUE,
  cargo VARCHAR(200),
  quantidade INT,
  descricao_cargo TEXT,
  salario DECIMAL(10,2),
  beneficios TEXT,
  local_trabalho VARCHAR(200),
  horario VARCHAR(100),
  requisitos TEXT,
  observacoes TEXT,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_param_trabalho FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id)
);

-- Atividades da proposta comercial por trabalho.
CREATE TABLE IF NOT EXISTS proposta_atividades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  trabalho_id INT NOT NULL,
  cargo VARCHAR(200) NOT NULL,
  descricao TEXT,
  quantidade INT NOT NULL DEFAULT 1,
  salario_base DECIMAL(10,2),
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_atividade_proposta FOREIGN KEY (trabalho_id) REFERENCES trabalhos(id)
);

-- Reuniões agendadas com clientes.
CREATE TABLE IF NOT EXISTS reunioes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  trabalho_id INT NULL,
  titulo VARCHAR(200) NOT NULL,
  data_hora DATETIME NOT NULL,
  local_reuniao VARCHAR(200),
  observacoes TEXT,
  status ENUM('agendada','realizada','cancelada') NOT NULL DEFAULT 'agendada',
  agendado_por_id INT NOT NULL,
  agendado_por_nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_reuniao_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Alterações em tabelas existentes (ignoradas se coluna já existe)
ALTER TABLE historico_empresa ADD COLUMN tipo VARCHAR(50) NOT NULL DEFAULT 'ligacao';
ALTER TABLE historico_empresa MODIFY COLUMN tipo VARCHAR(50) NOT NULL DEFAULT 'ligacao';
ALTER TABLE contatos_trabalho ADD COLUMN alerta_em DATE NULL;
ALTER TABLE parametros_trabalho ADD COLUMN quem_somos TEXT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN cooperativismo TEXT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN nossos_valores TEXT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN cobranca TEXT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN taxa_administrativa DECIMAL(5,2) NULL DEFAULT 5.00;
ALTER TABLE parametros_trabalho ADD COLUMN encargos_sociais DECIMAL(5,2) NULL DEFAULT 35.00;
ALTER TABLE parametros_trabalho ADD COLUMN margem_lucro DECIMAL(5,2) NULL DEFAULT 10.00;
ALTER TABLE parametros_trabalho ADD COLUMN taxa_risco DECIMAL(5,2) NULL DEFAULT 2.00;
ALTER TABLE parametros_trabalho ADD COLUMN dar_percentual DECIMAL(5,2) NULL DEFAULT 10.00;
ALTER TABLE parametros_trabalho ADD COLUMN seguro_vida_percentual DECIMAL(5,2) NULL DEFAULT 1.50;
ALTER TABLE parametros_trabalho ADD COLUMN inss_percentual DECIMAL(5,2) NULL DEFAULT 20.00;
ALTER TABLE parametros_trabalho ADD COLUMN pis_percentual DECIMAL(5,2) NULL DEFAULT 0.65;
ALTER TABLE parametros_trabalho ADD COLUMN cofins_percentual DECIMAL(5,2) NULL DEFAULT 1.65;
ALTER TABLE parametros_trabalho ADD COLUMN iss_percentual DECIMAL(5,2) NULL DEFAULT 2.50;
ALTER TABLE parametros_trabalho ADD COLUMN valor_vr_dia DECIMAL(8,2) NULL DEFAULT 0.00;
ALTER TABLE parametros_trabalho ADD COLUMN valor_vt_dia DECIMAL(8,2) NULL DEFAULT 0.00;
ALTER TABLE parametros_trabalho ADD COLUMN insalubridade_pre_pct DECIMAL(5,2) NULL DEFAULT 8.00;
ALTER TABLE parametros_trabalho ADD COLUMN insalubridade_media_pct DECIMAL(5,2) NULL DEFAULT 9.00;
ALTER TABLE parametros_trabalho ADD COLUMN insalubridade_maxima_pct DECIMAL(5,2) NULL DEFAULT 11.00;
ALTER TABLE proposta_atividades ADD COLUMN vr_dias DECIMAL(5,2) NULL DEFAULT 0;
ALTER TABLE proposta_atividades ADD COLUMN vt_dias DECIMAL(5,2) NULL DEFAULT 0;
ALTER TABLE proposta_atividades ADD COLUMN adicional_noturno BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE proposta_atividades ADD COLUMN periculosidade BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE proposta_atividades ADD COLUMN insalubridade ENUM('sem_risco','pre','media','maxima') NOT NULL DEFAULT 'sem_risco';
ALTER TABLE proposta_atividades ADD COLUMN premio_incentivo DECIMAL(10,2) NULL DEFAULT 0;
ALTER TABLE proposta_atividades ADD COLUMN tipo_escala ENUM('mensal','plantao') NOT NULL DEFAULT 'mensal';
