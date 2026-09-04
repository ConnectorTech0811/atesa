-- ============================================================
-- Tabelas de Taxas, Impostos e Lista de Cargos ATESA
-- Executar no schema conn0686_atesa
-- MySQL Workbench: selecione o schema e clique no raio (Execute All)
-- ============================================================

CREATE TABLE IF NOT EXISTS parametros_sistema (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  chave         VARCHAR(100) NOT NULL UNIQUE,
  valor         DECIMAL(18,8) NOT NULL DEFAULT 0,
  grupo         VARCHAR(60)  NOT NULL,
  descricao     VARCHAR(200) NULL,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cargos_referencia (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  cooperativa VARCHAR(100) NOT NULL,
  cargo       VARCHAR(200) NOT NULL,
  cbo         VARCHAR(20)  NULL,
  ordem       INT NOT NULL DEFAULT 0,
  UNIQUE KEY uk_coop_cargo (cooperativa, cargo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- Seed: parametros_sistema
-- ON DUPLICATE KEY UPDATE garante idempotencia (pode re-executar)
-- ============================================================

INSERT INTO parametros_sistema (chave, valor, grupo, descricao) VALUES

-- PIS / COFINS
('pis_rnc',    0.0165, 'pis_cofins', 'PIS - Regime Normal Cumulativo'),
('pis_rc',     0.0065, 'pis_cofins', 'PIS - Regime Cumulativo'),
('pis_esfl',   0.0065, 'pis_cofins', 'PIS - ESFL'),
('cofins_rnc', 0.0760, 'pis_cofins', 'COFINS - Regime Normal Cumulativo'),
('cofins_rc',  0.0300, 'pis_cofins', 'COFINS - Regime Cumulativo'),
('cofins_esfl',0.0400, 'pis_cofins', 'COFINS - ESFL'),

-- Impostos gerais
('iss_geral',     0.0200, 'impostos', 'ISS - aliquota padrao'),
('irrf_geral',    0.0150, 'impostos', 'IRRF - aliquota padrao'),
('inss_patronal', 0.2000, 'impostos', 'INSS Patronal'),

-- ISS por estado
('iss_emissao_prestacao_sp',    0.0250, 'iss_estado', 'ISS - Emissao e Prestacao SP'),
('iss_emissao_prestacao_ce',    0.0300, 'iss_estado', 'ISS - Emissao e Prestacao CE'),
('iss_emissao_prestacao_pe',    0.0400, 'iss_estado', 'ISS - Emissao e Prestacao PE'),
('iss_emissao_sp_prestacao_ce', 0.0500, 'iss_estado', 'ISS - Emissao SP / Prestacao CE'),

-- INSS funcionario por faixa salarial
('inss_func_faixa1_teto', 1659.38, 'inss_funcionario', 'INSS Funcionario - teto faixa 1'),
('inss_func_faixa1_aliq', 0.0800,  'inss_funcionario', 'INSS Funcionario - aliquota faixa 1'),
('inss_func_faixa2_teto', 2765.66, 'inss_funcionario', 'INSS Funcionario - teto faixa 2'),
('inss_func_faixa2_aliq', 0.0900,  'inss_funcionario', 'INSS Funcionario - aliquota faixa 2'),
('inss_func_faixa3_teto', 5531.31, 'inss_funcionario', 'INSS Funcionario - teto faixa 3'),
('inss_func_faixa3_aliq', 0.1100,  'inss_funcionario', 'INSS Funcionario - aliquota faixa 3'),

-- IRRF tabela progressiva 2025
('irrf_f1_teto',           2428.00, 'irrf_tabela', 'IRRF - teto faixa 1 (isento)'),
('irrf_f1_aliq',           0.0000,  'irrf_tabela', 'IRRF - aliquota faixa 1'),
('irrf_f1_parcela',        0.0000,  'irrf_tabela', 'IRRF - parcela a deduzir faixa 1'),
('irrf_f2_teto',           2826.65, 'irrf_tabela', 'IRRF - teto faixa 2'),
('irrf_f2_aliq',           0.0750,  'irrf_tabela', 'IRRF - aliquota faixa 2'),
('irrf_f2_parcela',        182.16,  'irrf_tabela', 'IRRF - parcela a deduzir faixa 2'),
('irrf_f3_teto',           3751.05, 'irrf_tabela', 'IRRF - teto faixa 3'),
('irrf_f3_aliq',           0.1500,  'irrf_tabela', 'IRRF - aliquota faixa 3'),
('irrf_f3_parcela',        394.16,  'irrf_tabela', 'IRRF - parcela a deduzir faixa 3'),
('irrf_f4_teto',           4664.68, 'irrf_tabela', 'IRRF - teto faixa 4'),
('irrf_f4_aliq',           0.2250,  'irrf_tabela', 'IRRF - aliquota faixa 4'),
('irrf_f4_parcela',        675.49,  'irrf_tabela', 'IRRF - parcela a deduzir faixa 4'),
('irrf_f5_aliq',           0.2750,  'irrf_tabela', 'IRRF - aliquota faixa 5 (acima do teto f4)'),
('irrf_f5_parcela',        908.73,  'irrf_tabela', 'IRRF - parcela a deduzir faixa 5'),
('irrf_dependente',        189.59,  'irrf_tabela', 'IRRF - deducao por dependente'),
('irrf_desc_simplificado', 607.20,  'irrf_tabela', 'IRRF - desconto simplificado'),

-- VR/VT - fracao do mes por escala
('vrvt_procedimento',  1.00,  'vrvt', 'VR/VT - Procedimento'),
('vrvt_plantao_12x36', 1.00,  'vrvt', 'VR/VT - Plantao 12x36'),
('vrvt_plantao_5x2',   1.00,  'vrvt', 'VR/VT - Plantao 5x2'),
('vrvt_mensal_6x1',   25.98,  'vrvt', 'VR/VT - Mensal 6x1'),
('vrvt_mensal_12x36', 15.00,  'vrvt', 'VR/VT - Mensal 12x36'),
('vrvt_mensal_5x2',   21.65,  'vrvt', 'VR/VT - Mensal 5x2'),
('vrvt_plantao_6x1',   1.00,  'vrvt', 'VR/VT - Plantao 6x1'),
('vrvt_plantao_24x48', 1.00,  'vrvt', 'VR/VT - Plantao 24x48'),

-- Escala - fracao do mes para calculo de pagamento
('escala_procedimento',   1.00,  'escala', 'Escala - Procedimento'),
('escala_plantao_12x36', 15.00,  'escala', 'Escala - Plantao 12x36'),
('escala_plantao_5x2',   21.65,  'escala', 'Escala - Plantao 5x2'),
('escala_mensal_6x1',     1.00,  'escala', 'Escala - Mensal 6x1'),
('escala_plantao_6x1',   25.98,  'escala', 'Escala - Plantao 6x1'),
('escala_mensal_5x2',     1.00,  'escala', 'Escala - Mensal 5x2'),
('escala_plantao_24x48', 10.00,  'escala', 'Escala - Plantao 24x48'),
('escala_mensal_12x36',   1.00,  'escala', 'Escala - Mensal 12x36'),

-- Adicional Noturno - aliquota (h ou R$) e base (h/mes) por escala
('adnoturno_procedimento_aliq',    1.00, 'adnoturno', 'Ad. Noturno - Procedimento aliquota'),
('adnoturno_procedimento_base',    1.00, 'adnoturno', 'Ad. Noturno - Procedimento base'),
('adnoturno_plantao_12x36_aliq',   8.00, 'adnoturno', 'Ad. Noturno - Plantao 12x36 aliquota (h)'),
('adnoturno_plantao_12x36_base',  12.00, 'adnoturno', 'Ad. Noturno - Plantao 12x36 base (h)'),
('adnoturno_plantao_5x2_aliq',     8.00, 'adnoturno', 'Ad. Noturno - Plantao 5x2 aliquota (h)'),
('adnoturno_plantao_5x2_base',     8.00, 'adnoturno', 'Ad. Noturno - Plantao 5x2 base (h)'),
('adnoturno_mensal_6x1_aliq',    207.84, 'adnoturno', 'Ad. Noturno - Mensal 6x1 aliquota (R$)'),
('adnoturno_mensal_6x1_base',    220.00, 'adnoturno', 'Ad. Noturno - Mensal 6x1 base (h)'),
('adnoturno_plantao_6x1_aliq',     8.00, 'adnoturno', 'Ad. Noturno - Plantao 6x1 aliquota (h)'),
('adnoturno_plantao_6x1_base',     8.00, 'adnoturno', 'Ad. Noturno - Plantao 6x1 base (h)'),
('adnoturno_mensal_5x2_aliq',    173.20, 'adnoturno', 'Ad. Noturno - Mensal 5x2 aliquota (R$)'),
('adnoturno_mensal_5x2_base',    220.00, 'adnoturno', 'Ad. Noturno - Mensal 5x2 base (h)'),
('adnoturno_plantao_24x48_aliq',   8.00, 'adnoturno', 'Ad. Noturno - Plantao 24x48 aliquota (h)'),
('adnoturno_plantao_24x48_base',  24.00, 'adnoturno', 'Ad. Noturno - Plantao 24x48 base (h)'),
('adnoturno_mensal_12x36_aliq',    8.00, 'adnoturno', 'Ad. Noturno - Mensal 12x36 aliquota (h)'),
('adnoturno_mensal_12x36_base',  220.00, 'adnoturno', 'Ad. Noturno - Mensal 12x36 base (h)'),

-- Insalubridade
('insalubridade_baixo', 10.00, 'insalubridade', 'Insalubridade Baixo/Pre (%)'),
('insalubridade_medio', 20.00, 'insalubridade', 'Insalubridade Medio (%)'),
('insalubridade_alto',  40.00, 'insalubridade', 'Insalubridade Alto/Maxima (%)'),

-- Periculosidade
('periculosidade_sim', 30.00, 'periculosidade', 'Periculosidade - Sim (%)'),

-- D.A.R.
('dar_pre', 8.33333333, 'dar', 'D.A.R. - Pre (%)'),
('dar_pos', 0.00,       'dar', 'D.A.R. - Pos (%)'),

-- Abono Natalino
('abono_natalino_sim', 8.33333333, 'abono_natalino', 'Abono Natalino - Sim (%)'),
('abono_natalino_nao', 0.00,       'abono_natalino', 'Abono Natalino - Nao (%)')

ON DUPLICATE KEY UPDATE valor = VALUES(valor);

-- ============================================================
-- Seed: cargos_referencia - apenas ATESA com CBOs oficiais
-- ============================================================

INSERT INTO cargos_referencia (cooperativa, cargo, cbo, ordem) VALUES
('ATESA', 'AUXILIAR DE ENFERMAGEM',        '3222-30', 1),
('ATESA', 'AUXILIAR DE FARMACIA',          '5211-30', 2),
('ATESA', 'CLINICO GERAL',                 '2251-25', 3),
('ATESA', 'CUIDADOR',                      '5162-10', 4),
('ATESA', 'CUIDADOR DE IDOSOS',            '5162-10', 5),
('ATESA', 'ENFERMEIRO(A)',                  '2235-05', 6),
('ATESA', 'ENFERMEIRO(A) ADMINSTRATIVO',   '2235-05', 7),
('ATESA', 'ENFERMEIRO VISITADOR',          '2235-05', 8),
('ATESA', 'FISIOTERAPEUTA',                '2236-05', 9),
('ATESA', 'FONOAUDIOLOGO',                '2238-10', 10),
('ATESA', 'INSTRUMENTADOR CIRURGICO',     '3222-25', 11),
('ATESA', 'MAQUEIRO',                     '5152-25', 12),
('ATESA', 'NUTRICIONISTA',                '2237-10', 13),
('ATESA', 'PSICOLOGO',                    '2515-10', 14),
('ATESA', 'TECNICO DE ENFERMAGEM',        '3222-05', 15),
('ATESA', 'TECNICO NUTRICAO',             '3252-10', 16),
('ATESA', 'TERAPEUTA OCUPACIONAL',        '2239-05', 17),
('ATESA', 'AUXILIAR DE METODOS GRAFICOS', '3241-15', 18),
('ATESA', 'TECNOLOGO OFTALMICO',          '3223-05', 19),
('ATESA', 'TECNICO DE ENFERMAGEM - NOTURNO', '3222-05', 20)

ON DUPLICATE KEY UPDATE cbo = VALUES(cbo), ordem = VALUES(ordem);

SELECT 'taxas_schema executado com sucesso.' AS resultado;
