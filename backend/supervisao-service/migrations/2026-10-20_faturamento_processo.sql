-- ============================================================
-- Processo de Faturamento: estrutura, apuração, conferência e auditoria (2026-10-20)
-- Aplicada automaticamente pelo supervisao-service (inicializarTabelasFaturamentoProcesso).
-- Este arquivo documenta a mesma estrutura para aplicação manual, se necessário.
-- Somente tabelas novas: nenhuma tabela existente é alterada.
-- ============================================================

CREATE TABLE IF NOT EXISTS faturamento_processos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(30) NULL,
  competencia CHAR(7) NOT NULL,
  empresa_id INT NOT NULL,
  unidade_id INT NULL,
  cooperativa VARCHAR(150) NULL,
  centro_custo VARCHAR(100) NULL,
  periodo_inicio DATE NOT NULL,
  periodo_fim DATE NOT NULL,
  status ENUM('aberto','apurado','aprovado','rejeitado','cancelado') NOT NULL DEFAULT 'aberto',
  chave_ativa VARCHAR(40) NULL,
  versao_apuracao INT NOT NULL DEFAULT 0,
  observacao TEXT NULL,
  motivo_status TEXT NULL,
  criado_por_id INT NULL,
  criado_por_nome VARCHAR(150) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  apurado_por_id INT NULL,
  apurado_por_nome VARCHAR(150) NULL,
  apurado_em DATETIME NULL,
  aprovado_por_id INT NULL,
  aprovado_por_nome VARCHAR(150) NULL,
  aprovado_em DATETIME NULL,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_fatp_codigo (codigo),
  UNIQUE KEY uk_fatp_chave_ativa (chave_ativa),
  INDEX idx_fatp_comp_emp (competencia, empresa_id),
  INDEX idx_fatp_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS faturamento_itens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  processo_id INT NOT NULL,
  versao INT NOT NULL,
  chave_item VARCHAR(30) NOT NULL,
  alocacao_id INT NULL,
  candidato_id INT NOT NULL,
  unidade_id INT NULL,
  vaga_id INT NULL,
  cooperado_nome VARCHAR(200) NULL,
  matricula VARCHAR(20) NULL,
  atividade VARCHAR(200) NULL,
  local VARCHAR(200) NULL,
  tipo_escala VARCHAR(30) NULL,
  data_inicio DATE NULL,
  desligamento DATE NULL,
  dias_mes_total INT NOT NULL DEFAULT 30,
  dias_mes_fechado DECIMAL(8,2) NOT NULL DEFAULT 0,
  dias_trabalhados DECIMAL(8,2) NOT NULL DEFAULT 0,
  total_horas DECIMAL(10,2) NOT NULL DEFAULT 0,
  horas_apontadas DECIMAL(10,2) NOT NULL DEFAULT 0,
  horas_escala DECIMAL(10,2) NOT NULL DEFAULT 0,
  pl_diurno DECIMAL(8,2) NOT NULL DEFAULT 0,
  pl_noturno DECIMAL(8,2) NOT NULL DEFAULT 0,
  hora_excedente DECIMAL(10,2) NOT NULL DEFAULT 0,
  ad_noturno DECIMAL(10,2) NOT NULL DEFAULT 0,
  bonificacao DECIMAL(12,2) NOT NULL DEFAULT 0,
  desc_refeicao DECIMAL(12,2) NOT NULL DEFAULT 0,
  desc_estacionamento DECIMAL(12,2) NOT NULL DEFAULT 0,
  desc_farmacia DECIMAL(12,2) NOT NULL DEFAULT 0,
  reembolso DECIMAL(12,2) NOT NULL DEFAULT 0,
  parametros_vaga TEXT NULL,
  status ENUM('pendente','conferido','divergente') NOT NULL DEFAULT 'pendente',
  conferido_por_id INT NULL,
  conferido_por_nome VARCHAR(150) NULL,
  conferido_em DATETIME NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_fati_proc_chave (processo_id, chave_item),
  INDEX idx_fati_cand (candidato_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS faturamento_ajustes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  processo_id INT NOT NULL,
  chave_item VARCHAR(30) NOT NULL,
  campo VARCHAR(40) NOT NULL,
  valor DECIMAL(12,2) NOT NULL,
  motivo TEXT NOT NULL,
  criado_por_id INT NULL,
  criado_por_nome VARCHAR(150) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_fata_proc_item_campo (processo_id, chave_item, campo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS faturamento_divergencias (
  id INT AUTO_INCREMENT PRIMARY KEY,
  processo_id INT NOT NULL,
  chave_item VARCHAR(30) NULL,
  origem ENUM('automatica','manual') NOT NULL,
  tipo VARCHAR(40) NOT NULL,
  descricao TEXT NOT NULL,
  status ENUM('aberta','resolvida','descartada') NOT NULL DEFAULT 'aberta',
  resolucao TEXT NULL,
  criado_por_id INT NULL,
  criado_por_nome VARCHAR(150) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolvido_por_id INT NULL,
  resolvido_por_nome VARCHAR(150) NULL,
  resolvido_em DATETIME NULL,
  INDEX idx_fatd_proc (processo_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS faturamento_auditoria (
  id INT AUTO_INCREMENT PRIMARY KEY,
  processo_id INT NOT NULL,
  chave_item VARCHAR(30) NULL,
  acao VARCHAR(40) NOT NULL,
  campo VARCHAR(60) NULL,
  valor_anterior TEXT NULL,
  valor_novo TEXT NULL,
  motivo TEXT NULL,
  usuario_id INT NULL,
  usuario_nome VARCHAR(150) NULL,
  usuario_perfil VARCHAR(50) NULL,
  ip VARCHAR(45) NULL,
  criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_fataud_proc (processo_id, criado_em)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
