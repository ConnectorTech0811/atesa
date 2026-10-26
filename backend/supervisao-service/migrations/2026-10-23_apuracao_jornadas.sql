-- ============================================================
-- Apuração por jornada, escala parametrizada e regras de apuração — 2026-10-23
-- Aplicada automaticamente no primeiro uso pelo supervisao-service:
--   escalaFaturamentoRepository (inicializarTabelasEscalaFaturamento),
--   faturamentoProcessoRepository (inicializarTabelasFaturamentoProcesso),
--   regrasApuracaoRepository (obterRegrasApuracao).
-- Só adiciona colunas/tabela nova; nenhum dado existente é alterado.
-- ============================================================

-- Escala ligada ao que está no Parâmetro (local, vaga e atividade)
ALTER TABLE supervisao_escalas ADD COLUMN vaga_id INT NULL;
ALTER TABLE supervisao_escalas ADD COLUMN unidade_id INT NULL;
ALTER TABLE supervisao_escalas ADD COLUMN atividade VARCHAR(200) NULL;

-- Itens do processo de faturamento: previsto, falta, noturno bruto e avisos da apuração
ALTER TABLE faturamento_itens ADD COLUMN horas_previstas DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faturamento_itens ADD COLUMN horas_falta DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faturamento_itens ADD COLUMN horas_noturnas DECIMAL(10,2) NOT NULL DEFAULT 0;
ALTER TABLE faturamento_itens ADD COLUMN avisos_json TEXT NULL;

-- Regras de apuração (linha única; sem linha = valores padrão do código)
CREATE TABLE IF NOT EXISTS faturamento_regras_apuracao (
  id TINYINT PRIMARY KEY DEFAULT 1,
  regras_json TEXT NOT NULL,
  atualizado_por_id INT NULL,
  atualizado_por_nome VARCHAR(150) NULL,
  atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
