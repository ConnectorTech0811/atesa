-- ============================================================
-- Prefeitura emissora da NFS-e (prestador ATESA) — 2026-10-21
-- Aplicada automaticamente no primeiro uso pelo supervisao-service (garantirEstruturaFinanceira).
-- Altera somente a tabela nova fiscal_municipios (criada em 2026-10-20).
-- ============================================================

ALTER TABLE fiscal_municipios ADD COLUMN prefeitura_emissora TINYINT(1) NOT NULL DEFAULT 0;
