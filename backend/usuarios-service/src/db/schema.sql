CREATE TABLE IF NOT EXISTS usuarios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  cpf VARCHAR(11) NOT NULL UNIQUE,
  telefone VARCHAR(20),
  senha_hash VARCHAR(255) NOT NULL,
  tipo_usuario ENUM(
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
  eh_executivo BOOLEAN NOT NULL DEFAULT FALSE,
  regiao_id INT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Observação: regiao_id é uma referência lógica ao regioes-service
-- (outro banco de dados, outro serviço). Não há FOREIGN KEY entre
-- bancos de serviços diferentes — a validação é feita via chamada
-- HTTP ao regioes-service no momento do cadastro.

CREATE UNIQUE INDEX IF NOT EXISTS uk_usuarios_nome ON usuarios(nome);
