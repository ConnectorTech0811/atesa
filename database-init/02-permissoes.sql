-- Migration: grupos e permissões
-- Para banco único (HostGator/produção): sem USE statement
-- Para Docker local:
--   Get-Content database-init/02-permissoes.sql | docker exec -i atesa-database mysql -u atesa -patesa usuarios_db

CREATE TABLE IF NOT EXISTS grupos (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  nome        VARCHAR(100) NOT NULL,
  descricao   TEXT,
  criado_em   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT uk_grupos_nome UNIQUE (nome)
);

CREATE TABLE IF NOT EXISTS usuarios_grupos (
  usuario_id  INT NOT NULL,
  grupo_id    INT NOT NULL,
  PRIMARY KEY (usuario_id, grupo_id),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
  FOREIGN KEY (grupo_id)   REFERENCES grupos(id)   ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permissoes_grupo (
  grupo_id        INT          NOT NULL,
  funcionalidade  VARCHAR(100) NOT NULL,
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (grupo_id, funcionalidade),
  FOREIGN KEY (grupo_id) REFERENCES grupos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS permissoes_usuario (
  usuario_id      INT          NOT NULL,
  funcionalidade  VARCHAR(100) NOT NULL,
  ativo           TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (usuario_id, funcionalidade),
  FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
);
