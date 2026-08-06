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
  whatsapp VARCHAR(20) NULL,
  cpf VARCHAR(11) NULL UNIQUE,
  status VARCHAR(50) NOT NULL DEFAULT 'Cadastrado',
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
  status ENUM('agendada','realizada','cancelada','pos_venda','alinhamento','fechamento') NOT NULL DEFAULT 'agendada',
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
ALTER TABLE parametros_trabalho ADD COLUMN rateio_percentual DECIMAL(5,2) NULL DEFAULT 3.00;
ALTER TABLE proposta_atividades ADD COLUMN vr_dias DECIMAL(5,2) NULL DEFAULT 0;
ALTER TABLE proposta_atividades ADD COLUMN vt_dias DECIMAL(5,2) NULL DEFAULT 0;
ALTER TABLE proposta_atividades ADD COLUMN adicional_noturno BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE proposta_atividades ADD COLUMN periculosidade BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE proposta_atividades ADD COLUMN insalubridade ENUM('sem_risco','pre','media','maxima') NOT NULL DEFAULT 'sem_risco';
ALTER TABLE proposta_atividades ADD COLUMN premio_incentivo DECIMAL(10,2) NULL DEFAULT 0;
ALTER TABLE proposta_atividades ADD COLUMN tipo_escala ENUM('mensal','plantao') NOT NULL DEFAULT 'mensal';
ALTER TABLE reunioes MODIFY COLUMN status ENUM('agendada','realizada','cancelada','pos_venda','alinhamento','fechamento') NOT NULL DEFAULT 'agendada';
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS whatsapp VARCHAR(20) NULL;
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cpf VARCHAR(11) NULL;
ALTER TABLE empresas MODIFY COLUMN telefone_empresa VARCHAR(20) NULL;
ALTER TABLE empresas MODIFY COLUMN status VARCHAR(50) NOT NULL DEFAULT 'Cadastrado';

-- ══════════════════════════════════════════════════════════════
-- MÓDULO 3 — PARÂMETRO (Área)
-- Fichas de serviço por unidade do cliente, vagas, incrementos e log.
-- ══════════════════════════════════════════════════════════════

-- Ficha/Unidade de serviço: cada empresa pode ter N fichas (unidades).
CREATE TABLE IF NOT EXISTS parametro_unidades (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  nome_unidade VARCHAR(200) NOT NULL,
  endereco VARCHAR(300) NULL,
  contato_responsavel VARCHAR(150) NULL,
  observacoes TEXT NULL,
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_por_id INT NOT NULL,
  criado_por_nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pu_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Vagas por unidade de serviço com todos os parâmetros operacionais.
CREATE TABLE IF NOT EXISTS parametro_vagas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  unidade_id INT NOT NULL,
  cargo VARCHAR(200) NOT NULL,
  quantidade INT NOT NULL DEFAULT 1,
  salario_base DECIMAL(10,2) NULL,
  tipo_escala ENUM('mensal','plantao') NOT NULL DEFAULT 'plantao',
  adicional_noturno BOOLEAN NOT NULL DEFAULT FALSE,
  periculosidade BOOLEAN NOT NULL DEFAULT FALSE,
  insalubridade ENUM('sem_risco','pre','media','maxima') NOT NULL DEFAULT 'sem_risco',
  premio_incentivo DECIMAL(10,2) NULL DEFAULT 0,
  valor_vr_dia DECIMAL(8,2) NULL DEFAULT 0,
  valor_vt_dia DECIMAL(8,2) NULL DEFAULT 0,
  dsr_percentual DECIMAL(5,2) NULL DEFAULT 16.67,
  periodicidade ENUM('diario','semanal','quinzenal','mensal') NOT NULL DEFAULT 'mensal',
  ativa BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_pv_unidade FOREIGN KEY (unidade_id) REFERENCES parametro_unidades(id)
);

-- Histórico de incrementos (alterações de quantidade) de cada vaga.
CREATE TABLE IF NOT EXISTS parametro_incrementos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vaga_id INT NOT NULL,
  quantidade_anterior INT NOT NULL,
  quantidade_nova INT NOT NULL,
  motivo TEXT NULL,
  registrado_por_id INT NOT NULL,
  registrado_por_nome VARCHAR(150) NOT NULL,
  data_incremento DATE NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pi_vaga FOREIGN KEY (vaga_id) REFERENCES parametro_vagas(id)
);

-- Log de todas as ações do módulo Parâmetro (especialmente edições pós-fechamento).
CREATE TABLE IF NOT EXISTS parametro_log_acoes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  unidade_id INT NULL,
  vaga_id INT NULL,
  usuario_id INT NOT NULL,
  usuario_nome VARCHAR(150) NOT NULL,
  acao VARCHAR(50) NOT NULL,
  descricao TEXT NOT NULL,
  dados_anteriores JSON NULL,
  dados_novos JSON NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pla_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- Campos adicionais nas vagas (cooperado / ficha de trabalho)
ALTER TABLE parametro_vagas ADD COLUMN IF NOT EXISTS tempo_pausa INT NULL COMMENT 'Minutos de pausa por turno';
ALTER TABLE parametro_vagas ADD COLUMN IF NOT EXISTS tempo_refeicao INT NULL COMMENT 'Minutos de refeição por turno';
ALTER TABLE parametro_vagas ADD COLUMN IF NOT EXISTS desconta_pausa TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Desconta pausa na hora trabalhada';
ALTER TABLE parametro_vagas ADD COLUMN IF NOT EXISTS desconta_refeicao TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Desconta refeição na hora trabalhada';
ALTER TABLE parametro_vagas ADD COLUMN IF NOT EXISTS recebe_por ENUM('dia','mes') NOT NULL DEFAULT 'mes' COMMENT 'Base de cálculo do cooperado';
ALTER TABLE parametro_vagas ADD COLUMN IF NOT EXISTS data_inicio DATE NULL COMMENT 'Data de início da operação (base para agenda)';

-- Agenda de datas de operação gerada automaticamente ao criar vaga.
-- O status 'previsto' é gerado pelo sistema; 'confirmado'/'cancelado' são validados pela área.
CREATE TABLE IF NOT EXISTS parametro_agenda (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vaga_id INT NOT NULL,
  unidade_id INT NOT NULL,
  empresa_id INT NOT NULL,
  data_operacao DATE NOT NULL,
  status ENUM('previsto','confirmado','cancelado','feriado') NOT NULL DEFAULT 'previsto',
  observacoes VARCHAR(300) NULL,
  validado_por_id INT NULL,
  validado_por_nome VARCHAR(150) NULL,
  validado_em TIMESTAMP NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_pagenda_vaga FOREIGN KEY (vaga_id) REFERENCES parametro_vagas(id),
  CONSTRAINT fk_pagenda_unidade FOREIGN KEY (unidade_id) REFERENCES parametro_unidades(id)
);

-- Histórico de propostas enviadas por e-mail para as empresas
CREATE TABLE IF NOT EXISTS propostas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  destinatario VARCHAR(150) NOT NULL,
  assunto VARCHAR(300) NOT NULL,
  corpo LONGTEXT NOT NULL,
  observacao VARCHAR(500) NULL,
  enviada_por_id INT NOT NULL,
  enviada_por_nome VARCHAR(150) NOT NULL,
  status ENUM('enviada','erro') NOT NULL DEFAULT 'enviada',
  erro_envio TEXT NULL,
  enviada_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_proposta_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);

-- CPF como chave única nas empresas (além do CNPJ que já era UNIQUE)
ALTER TABLE empresas ADD COLUMN IF NOT EXISTS cpf VARCHAR(11) NULL UNIQUE;

-- Módulo de Ocorrências do Cooperado
CREATE TABLE IF NOT EXISTS ocorrencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  empresa_id INT NOT NULL,
  cooperado_id INT NULL COMMENT 'ID do cooperado no sistema de cooperados',
  cooperado_nome VARCHAR(150) NULL,
  tipo ENUM('falta','atraso','acidente','disciplinar','elogio','reclamacao','outro') NOT NULL,
  descricao TEXT NOT NULL,
  gravidade ENUM('baixa','normal','alta','critica') NOT NULL DEFAULT 'normal',
  data_ocorrencia DATE NOT NULL,
  status ENUM('aberta','em_analise','resolvida','arquivada') NOT NULL DEFAULT 'aberta',
  resolucao TEXT NULL,
  resolvida_em TIMESTAMP NULL,
  registrada_por_id INT NOT NULL,
  registrada_por_nome VARCHAR(150) NOT NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ocorrencia_empresa FOREIGN KEY (empresa_id) REFERENCES empresas(id)
);
