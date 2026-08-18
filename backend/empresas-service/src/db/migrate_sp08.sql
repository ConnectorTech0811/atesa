-- ============================================================
-- Migrações SP08 — compatível com MySQL 5.7+
-- 1. No MySQL Workbench, clique duas vezes no schema conn0686_atesa
--    para selecioná-lo (negrito no painel esquerdo)
-- 2. Abra este arquivo e clique no raio ⚡ (Execute All)
-- ============================================================

-- ── parametro_vagas: colunas operacionais ────────────────────
ALTER TABLE parametro_vagas ADD COLUMN tempo_pausa INT NULL;
ALTER TABLE parametro_vagas ADD COLUMN tempo_refeicao INT NULL;
ALTER TABLE parametro_vagas ADD COLUMN desconta_pausa TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE parametro_vagas ADD COLUMN desconta_refeicao TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE parametro_vagas ADD COLUMN recebe_por ENUM('dia','mes') NOT NULL DEFAULT 'mes';
ALTER TABLE parametro_vagas ADD COLUMN data_inicio DATE NULL;

-- ── parametro_vagas: ampliar ENUM tipo_escala ────────────────
ALTER TABLE parametro_vagas MODIFY COLUMN tipo_escala ENUM('12x36','plantao','mensal','por_procedimento') NOT NULL DEFAULT 'plantao';
ALTER TABLE proposta_atividades MODIFY COLUMN tipo_escala ENUM('12x36','plantao','mensal','por_procedimento') NOT NULL DEFAULT '12x36';

-- ── empresas: WhatsApp e CPF ─────────────────────────────────
ALTER TABLE empresas ADD COLUMN whatsapp VARCHAR(20) NULL;
ALTER TABLE empresas ADD COLUMN cpf VARCHAR(11) NULL;
ALTER TABLE empresas MODIFY COLUMN telefone_empresa VARCHAR(20) NULL;

-- ── ra_candidatos: WhatsApp ──────────────────────────────────
ALTER TABLE ra_candidatos ADD COLUMN whatsapp VARCHAR(20) NULL AFTER telefone;

-- ── parametros_trabalho: faturamento estruturado ─────────────
ALTER TABLE parametros_trabalho ADD COLUMN fat_taxa_servico DECIMAL(5,2) NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_impostos TINYINT(1) NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_apresentacao_cliente INT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_periodo_apuracao INT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_data_envio_boleto INT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_apresentacao_faturamento INT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_vencimento INT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_repasse_cooperado INT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_tera_adiantamento TINYINT(1) NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_vencimento_adiantamento INT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_repasse_adiantamento INT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_obs_faturamento TEXT NULL;
ALTER TABLE parametros_trabalho ADD COLUMN fat_obs_financeiro TEXT NULL;

SELECT 'Migrações SP08 concluídas.' AS resultado;
