-- ============================================================
-- Dados de teste — SP08
-- Execute no MySQL Workbench ou via CLI:
--   mysql -u root atesa < seed_test.sql
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ── Tabelas do módulo RA (criadas aqui pois não estão no schema.sql principal) ──

CREATE TABLE IF NOT EXISTS ra_candidatos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  nome         VARCHAR(200)  NOT NULL,
  cpf          VARCHAR(11)   NOT NULL UNIQUE,
  email        VARCHAR(150)  NULL,
  telefone     VARCHAR(20)   NULL,
  whatsapp     VARCHAR(20)   NULL,
  cooperativa  VARCHAR(150)  NOT NULL,
  observacoes  TEXT          NULL,
  status       TINYINT(1)    NOT NULL DEFAULT 0 COMMENT '0=pré-cadastro 1=ativo',
  matricula    VARCHAR(20)   NULL UNIQUE,
  criado_em    TIMESTAMP     DEFAULT CURRENT_TIMESTAMP,
  aprovado_em  TIMESTAMP     NULL,
  aprovado_por_nome VARCHAR(150) NULL
);

CREATE TABLE IF NOT EXISTS ra_alocacoes (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  candidato_id     INT          NOT NULL,
  vaga_id          INT          NOT NULL,
  unidade_id       INT          NOT NULL,
  empresa_id       INT          NOT NULL,
  data_inicio      DATE         NOT NULL,
  data_fim         DATE         NULL,
  status           ENUM('ativa','encerrada') NOT NULL DEFAULT 'ativa',
  observacoes      TEXT         NULL,
  criado_por_id    INT          NOT NULL,
  criado_por_nome  VARCHAR(150) NOT NULL,
  encerrado_em     TIMESTAMP    NULL,
  encerrado_por_id INT          NULL,
  encerrado_por_nome VARCHAR(150) NULL,
  criado_em        TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_ra_aloc_cand     FOREIGN KEY (candidato_id) REFERENCES ra_candidatos(id),
  CONSTRAINT fk_ra_aloc_vaga     FOREIGN KEY (vaga_id)      REFERENCES parametro_vagas(id),
  CONSTRAINT fk_ra_aloc_unidade  FOREIGN KEY (unidade_id)   REFERENCES parametro_unidades(id),
  CONSTRAINT fk_ra_aloc_empresa  FOREIGN KEY (empresa_id)   REFERENCES empresas(id)
);

-- ── Cooperados (candidatos RA) ────────────────────────────────────────────────
INSERT INTO ra_candidatos
  (id, nome, cpf, email, telefone, whatsapp, cooperativa, observacoes, status, matricula)
VALUES
  (1, 'Ana Paula Ferreira',    '04587236519', 'ana.ferreira@email.com',    '(11) 91234-5678', '(11) 91234-5678', 'ATESA', 'Enfermeira com 5 anos de experiência em UTI',        1, 'RA20260001'),
  (2, 'Carlos Eduardo Lima',   '38274615902', 'carlos.lima@email.com',     '(21) 98765-4321', NULL,              'ATESA', 'Técnico de enfermagem — especialidade cirúrgica',    1, 'RA20260002'),
  (3, 'Fernanda Costa Souza',  '72145893604', 'fernanda.souza@email.com',  '(31) 97654-3210', '(31) 97654-3210', 'ATESA', 'Fisioterapeuta, pós-graduação em ortopedia',         1, 'RA20260003'),
  (4, 'João Marcos Oliveira',  '59318274650', NULL,                        '(41) 96543-2109', NULL,              'ATESA', 'Médico residente — clínica geral',                   0, NULL),
  (5, 'Maria Clara Rodrigues', '83645027193', 'maria.rodrigues@email.com', '(51) 95432-1098', '(51) 95432-1098', 'ATESA', 'Farmacêutica, disponível para escalas diurnas',      1, 'RA20260004'),
  (6, 'Pedro Henrique Alves',  '12748365091', 'pedro.alves@email.com',     '(61) 94321-0987', NULL,              'ATESA', 'Técnico de radiologia — 3 anos de experiência',      0, NULL)
ON DUPLICATE KEY UPDATE nome = VALUES(nome), email = VALUES(email), whatsapp = VALUES(whatsapp);

-- ── Empresas cliente ─────────────────────────────────────────────────────────
-- As empresas aqui são as mesmas que aparecem na aba "Empresas" do sistema.
-- regiao_id pode ser NULL se não houver regiões cadastradas.
INSERT INTO empresas
  (id, cooperativa, nome_empresa, nome_empresa_normalizado, cnpj,
   email_empresa, telefone_empresa, whatsapp, representante,
   rua, numero, bairro, cidade, uf, cep, status)
VALUES
  (1, 'ATESA', 'Hospital Santa Cruz',       'hospital santa cruz',       '11222333000181',
   'contato@santacruz.com.br',  '(11) 3234-5678',  '(11) 93234-5678', 'Dr. Roberto Maia',
   'Av. Paulista',        '1000', 'Bela Vista',    'São Paulo',      'SP', '01310100', 'ativo'),
  (2, 'ATESA', 'Clínica Bem Estar',         'clinica bem estar',         '22333444000192',
   'admin@bemestar.com.br',      '(21) 2500-1234',  '(21) 92500-1234', 'Dra. Lúcia Faria',
   'Rua das Flores',      '200',  'Ipanema',        'Rio de Janeiro', 'RJ', '22420040', 'ativo'),
  (3, 'ATESA', 'UPA Centro-Oeste',          'upa centro-oeste',          '33444555000103',
   'upa@centrooeste.gov.br',     '(61) 3300-9900',  NULL,              'Gerência de RH',
   'SQS 308 Bloco A',     's/n',  'Asa Sul',        'Brasília',       'DF', '70362080', 'em_andamento'),
  (4, 'ATESA', 'Instituto de Cardiologia',  'instituto de cardiologia',  '44555666000114',
   'rh@institutocard.com.br',    '(51) 3300-5678',  '(51) 93300-5678', 'Adriana Torres',
   'Av. Princesa Isabel', '370',  'Santana',        'Porto Alegre',   'RS', '90620001', 'ativo'),
  (5, 'ATESA', 'Laboratório Vida Nova',     'laboratorio vida nova',     '55666777000125',
   'contato@vidanova.com.br',    '(41) 3200-4321',  NULL,              'Marcos Henrique',
   'Rua XV de Novembro',  '800',  'Centro',         'Curitiba',       'PR', '80020310', 'negociacao')
ON DUPLICATE KEY UPDATE nome_empresa = VALUES(nome_empresa), status = VALUES(status);

-- ── Trabalhos (contratos) ─────────────────────────────────────────────────────
-- Ajuste executivo_id para o ID real do seu usuário admin (padrão: 1).
INSERT INTO trabalhos
  (id, empresa_id, titulo, status, executivo_id, executivo_nome)
VALUES
  (1, 1, 'Contrato Enfermagem UTI — Hospital Santa Cruz',  'em_andamento', 1, 'Admin'),
  (2, 2, 'Suporte Técnico Enfermagem — Clínica Bem Estar', 'em_andamento', 1, 'Admin'),
  (3, 3, 'Urgência e Emergência — UPA Centro-Oeste',       'em_aberto',    1, 'Admin'),
  (4, 4, 'Cardiologia — Instituto de Cardiologia',         'em_andamento', 1, 'Admin'),
  (5, 5, 'Análises Clínicas — Laboratório Vida Nova',      'em_aberto',    1, 'Admin')
ON DUPLICATE KEY UPDATE titulo = VALUES(titulo);

-- ── Parâmetros dos trabalhos ─────────────────────────────────────────────────
INSERT INTO parametros_trabalho
  (trabalho_id, taxa_administrativa, margem_lucro, dar_percentual,
   seguro_vida_percentual, inss_percentual, pis_percentual,
   cofins_percentual, iss_percentual, valor_vr_dia, valor_vt_dia,
   rateio_percentual, quem_somos, cooperativismo, nossos_valores)
VALUES
  (1, 5.00, 10.00, 10.00, 1.50, 20.00, 0.65, 3.00, 2.50, 18.00, 8.00, 3.00,
   'Fundada em 2007, a Atesa é uma Cooperativa de Trabalho formada por profissionais da área da saúde.',
   'Modelo socioeconômico baseado na cooperação e autogestão.',
   'Ética, Responsabilidade, Comprometimento, Transparência e Cooperação.'),
  (2, 5.00, 10.00, 10.00, 1.50, 20.00, 0.65, 3.00, 2.50, 18.00, 8.00, 3.00,
   'Fundada em 2007, a Atesa é uma Cooperativa de Trabalho formada por profissionais da área da saúde.',
   'Modelo socioeconômico baseado na cooperação e autogestão.',
   'Ética, Responsabilidade, Comprometimento, Transparência e Cooperação.'),
  (3, 5.00, 10.00, 10.00, 1.50, 20.00, 0.65, 3.00, 2.50, 18.00, 8.00, 3.00,
   'Fundada em 2007, a Atesa é uma Cooperativa de Trabalho formada por profissionais da área da saúde.',
   'Modelo socioeconômico baseado na cooperação e autogestão.',
   'Ética, Responsabilidade, Comprometimento, Transparência e Cooperação.'),
  (4, 5.00, 10.00, 10.00, 1.50, 20.00, 0.65, 3.00, 2.50, 18.00, 8.00, 3.00,
   'Fundada em 2007, a Atesa é uma Cooperativa de Trabalho formada por profissionais da área da saúde.',
   'Modelo socioeconômico baseado na cooperação e autogestão.',
   'Ética, Responsabilidade, Comprometimento, Transparência e Cooperação.'),
  (5, 5.00, 10.00, 10.00, 1.50, 20.00, 0.65, 3.00, 2.50, 18.00, 8.00, 3.00,
   'Fundada em 2007, a Atesa é uma Cooperativa de Trabalho formada por profissionais da área da saúde.',
   'Modelo socioeconômico baseado na cooperação e autogestão.',
   'Ética, Responsabilidade, Comprometimento, Transparência e Cooperação.')
ON DUPLICATE KEY UPDATE taxa_administrativa = VALUES(taxa_administrativa);

-- ── Unidades de serviço (Módulo Parâmetro) ───────────────────────────────────
-- Vinculadas às empresas acima — aparecem na aba Parâmetro de cada empresa.
INSERT INTO parametro_unidades
  (id, empresa_id, nome_unidade, ativa)
VALUES
  (1, 1, 'UTI Adulto',        TRUE),
  (2, 1, 'Pronto-Socorro',    TRUE),
  (3, 2, 'Ambulatório',       TRUE),
  (4, 3, 'Urgência 24h',      TRUE),
  (5, 4, 'Hemodinâmica',      TRUE),
  (6, 5, 'Laboratório Geral', TRUE)
ON DUPLICATE KEY UPDATE nome_unidade = VALUES(nome_unidade);

-- ── Vagas (Módulo Parâmetro → visíveis no RA) ────────────────────────────────
-- Estas são as vagas que o módulo RA usa para alocação de cooperados.
INSERT INTO parametro_vagas
  (id, unidade_id, cargo, quantidade, salario_base, tipo_escala,
   adicional_noturno, periculosidade, insalubridade,
   valor_vr_dia, valor_vt_dia, ativa)
VALUES
  (1, 1, 'Enfermeiro(a) UTI',          3, 4500.00, 'plantao',         TRUE,  FALSE, 'pre',       18.00, 8.00, TRUE),
  (2, 1, 'Técnico(a) de Enfermagem',   5, 2800.00, 'plantao',         TRUE,  FALSE, 'sem_risco', 18.00, 8.00, TRUE),
  (3, 2, 'Enfermeiro(a) PS',           2, 4200.00, '12x36',           FALSE, FALSE, 'sem_risco', 18.00, 0.00, TRUE),
  (4, 3, 'Fisioterapeuta',             2, 3800.00, 'mensal',          FALSE, FALSE, 'sem_risco', 15.00, 8.00, TRUE),
  (5, 4, 'Técnico(a) de Enfermagem',   4, 2600.00, 'plantao',         FALSE, FALSE, 'sem_risco', 15.00, 6.00, TRUE),
  (6, 5, 'Médico(a) Cardiologista',    1, 12000.00,'por_procedimento', FALSE, FALSE, 'sem_risco',  0.00, 0.00, TRUE),
  (7, 6, 'Farmacêutico(a)',            2, 5000.00, 'mensal',          FALSE, FALSE, 'sem_risco', 18.00, 8.00, TRUE)
ON DUPLICATE KEY UPDATE cargo = VALUES(cargo), quantidade = VALUES(quantidade);

-- ── Atividades da proposta comercial ─────────────────────────────────────────
INSERT INTO proposta_atividades
  (id, trabalho_id, cargo, quantidade, salario_base, tipo_escala,
   adicional_noturno, periculosidade, insalubridade,
   vr_dias, vt_dias, premio_incentivo, ordem)
VALUES
  (1, 1, 'Enfermeiro(a) UTI',        3, 4500.00,  'plantao',          TRUE,  FALSE, 'pre',       22, 22, 0,   1),
  (2, 1, 'Técnico(a) de Enfermagem', 6, 2800.00,  'plantao',          TRUE,  FALSE, 'sem_risco', 22, 22, 0,   2),
  (3, 2, 'Fisioterapeuta',           2, 3800.00,  'mensal',           FALSE, FALSE, 'sem_risco', 22, 22, 200, 1),
  (4, 4, 'Médico(a) Cardiologista',  1, 12000.00, 'por_procedimento', FALSE, FALSE, 'sem_risco',  0,  0, 0,   1),
  (5, 4, 'Técnico(a) de Enfermagem', 3, 2800.00,  'plantao',          TRUE,  FALSE, 'sem_risco', 22,  0, 0,   2)
ON DUPLICATE KEY UPDATE cargo = VALUES(cargo);

-- ── Alocações RA (cooperado → vaga → empresa) ────────────────────────────────
-- A tabela ra_alocacoes liga cooperados às vagas do módulo Parâmetro.
INSERT INTO ra_alocacoes
  (id, candidato_id, vaga_id, unidade_id, empresa_id,
   data_inicio, data_fim, status, criado_por_id, criado_por_nome)
VALUES
  (1, 1, 1, 1, 1, '2026-01-15', NULL,         'ativa',     1, 'Admin'),
  (2, 2, 2, 1, 1, '2026-01-15', NULL,         'ativa',     1, 'Admin'),
  (3, 3, 4, 3, 2, '2026-02-01', NULL,         'ativa',     1, 'Admin'),
  (4, 5, 5, 4, 3, '2026-03-01', NULL,         'ativa',     1, 'Admin'),
  (5, 1, 3, 2, 1, '2025-06-01', '2025-12-31', 'encerrada', 1, 'Admin')
ON DUPLICATE KEY UPDATE status = VALUES(status);

SET FOREIGN_KEY_CHECKS = 1;

-- ── Corrigir AUTO_INCREMENT após inserções com IDs explícitos ────────────────
ALTER TABLE ra_candidatos     AUTO_INCREMENT = 100;
ALTER TABLE empresas          AUTO_INCREMENT = 100;
ALTER TABLE trabalhos         AUTO_INCREMENT = 100;
ALTER TABLE parametros_trabalho AUTO_INCREMENT = 100;
ALTER TABLE parametro_unidades AUTO_INCREMENT = 100;
ALTER TABLE parametro_vagas   AUTO_INCREMENT = 100;
ALTER TABLE proposta_atividades AUTO_INCREMENT = 100;
ALTER TABLE ra_alocacoes      AUTO_INCREMENT = 100;
