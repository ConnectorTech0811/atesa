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
  tipo ENUM('visita', 'contato') NOT NULL,
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
