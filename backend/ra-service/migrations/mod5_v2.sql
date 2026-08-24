-- ============================================================
-- Módulo 5 Benefícios — Migração v2
-- Executa contra o banco de produção
-- ============================================================

-- ── Log de Auditoria ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ra_auditoria (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  candidato_id INT          NOT NULL,
  tabela       VARCHAR(60)  NOT NULL,
  campo        VARCHAR(100) DEFAULT NULL,
  acao         ENUM('criacao','edicao','exclusao','validacao','rejeicao',
                    'upload','whatsapp','notificacao') NOT NULL,
  valor_anterior TEXT DEFAULT NULL,
  valor_novo     TEXT DEFAULT NULL,
  observacao     TEXT DEFAULT NULL,
  usuario_id     INT          DEFAULT NULL,
  usuario_nome   VARCHAR(200) DEFAULT NULL,
  criado_em  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_aud_candidato (candidato_id),
  INDEX idx_aud_criado    (criado_em)
);

-- ── Catálogo de Qualificações ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ra_qualificacoes_catalogo (
  id        INT AUTO_INCREMENT PRIMARY KEY,
  nome      VARCHAR(200) NOT NULL,
  categoria VARCHAR(100) DEFAULT NULL,
  ativo     TINYINT      DEFAULT 1,
  UNIQUE KEY uk_qual_nome (nome)
);

-- Sementes básicas
INSERT IGNORE INTO ra_qualificacoes_catalogo (nome, categoria) VALUES
  ('Enfermagem UTI',             'Enfermagem'),
  ('Enfermagem Pediatria',       'Enfermagem'),
  ('Enfermagem Neonatal',        'Enfermagem'),
  ('Enfermagem Centro Cirúrgico','Enfermagem'),
  ('Enfermagem PSF',             'Enfermagem'),
  ('Técnico de Enfermagem UTI',  'Técnico'),
  ('Técnico de Enfermagem Clínica Médica','Técnico'),
  ('Técnico de Enfermagem Cirúrgico','Técnico'),
  ('Auxiliar de Enfermagem',     'Auxiliar'),
  ('Fisioterapia Hospitalar',    'Reabilitação'),
  ('Fisioterapia Respiratória',  'Reabilitação'),
  ('Nutrição Clínica',           'Nutrição'),
  ('Nutrição Hospitalar',        'Nutrição'),
  ('Farmácia Clínica',           'Farmácia'),
  ('Médico Clínico Geral',       'Médico'),
  ('Médico Plantonista',         'Médico'),
  ('PCD — Pessoa com Deficiência','Especial'),
  ('Idoso (60+)',                 'Especial'),
  ('Criança (Pediátrico)',        'Especial');

-- ── Qualificações por Candidato ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ra_candidato_qualificacoes (
  candidato_id     INT NOT NULL,
  qualificacao_id  INT NOT NULL,
  PRIMARY KEY (candidato_id, qualificacao_id),
  INDEX idx_cq_qual (qualificacao_id)
);

-- ── Cotas Mensais ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ra_cotas_mensais (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  candidato_id   INT          NOT NULL,
  descricao      VARCHAR(200) NOT NULL,
  tipo           ENUM('seguro_vida','quota_parte','inss','outro') NOT NULL DEFAULT 'outro',
  valor          DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_parcelas INT           DEFAULT NULL,   -- NULL = recorrente ilimitado
  parcelas_pagas INT           NOT NULL DEFAULT 0,
  recorrente     TINYINT       NOT NULL DEFAULT 0,
  ativa          TINYINT       NOT NULL DEFAULT 1,
  observacao     TEXT          DEFAULT NULL,
  criado_em      DATETIME DEFAULT CURRENT_TIMESTAMP,
  atualizado_em  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_cota_candidato (candidato_id)
);

-- ── Colunas de rejeição em ra_documentos ────────────────────────────────────
-- Compatível com MySQL 5.7 (sem IF NOT EXISTS no ALTER TABLE)
-- Execute cada bloco separadamente se alguma coluna já existir.
ALTER TABLE ra_documentos
  ADD COLUMN rejeitado          TINYINT      NOT NULL DEFAULT 0,
  ADD COLUMN motivo_rejeicao    TEXT         DEFAULT NULL,
  ADD COLUMN rejeitado_por_nome VARCHAR(200) DEFAULT NULL,
  ADD COLUMN rejeitado_em       DATETIME     DEFAULT NULL;
