-- ============================================================
-- Módulo RA: Suporte a Cooperados Inativos e Tipo de Contratação
-- ============================================================

ALTER TABLE ra_candidatos
  ADD COLUMN tipo_contratacao ENUM('externo', 'interno') NOT NULL DEFAULT 'externo' AFTER cooperativa,
  ADD COLUMN inativado_em DATETIME DEFAULT NULL AFTER aprovado_por_nome,
  ADD COLUMN inativado_por_id INT DEFAULT NULL AFTER inativado_em,
  ADD COLUMN inativado_por_nome VARCHAR(200) DEFAULT NULL AFTER inativado_por_id,
  ADD COLUMN motivo_inativacao TEXT DEFAULT NULL AFTER inativado_por_nome;
