// ── Base comum de Comissões, Notas Fiscais, Cobranças e Recebimentos ────────
// Tabelas novas (nenhuma tabela existente é alterada). São criadas no primeiro uso
// (não na importação do módulo), para que salvar/reiniciar o serviço não altere o banco.
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { inicializarTabelasFaturamentoProcesso } from './faturamentoProcessoRepository.js';

export const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function erro(status, msg, extra = {}) {
  return Object.assign(new Error(msg), { status, ...extra });
}

export function texto(v, max) {
  const s = String(v ?? '').trim();
  return s ? s.slice(0, max) : null;
}

/** Número em formato BR ("1.234,56") ou JS; devolve NaN se inválido e null se vazio. */
export function numero(v) {
  if (v === null || v === undefined || String(v).trim() === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

export function dataISO(v) {
  const s = String(v ?? '').trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
    if (br) m = [s, br[3], br[2], br[1]];
  }
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (d.getFullYear() !== Number(m[1]) || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

export async function emTransacao(fn) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const r = await fn(conn);
    await conn.commit();
    return r;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

let inicializado = null;
export function garantirEstruturaFinanceira() {
  if (!inicializado) {
    inicializado = (async () => {
      await inicializarTabelasFaturamentoProcesso();
      const ddl = [
        `CREATE TABLE IF NOT EXISTS financeiro_auditoria (
          id INT AUTO_INCREMENT PRIMARY KEY,
          entidade VARCHAR(40) NOT NULL,
          entidade_id INT NULL,
          processo_id INT NULL,
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
          INDEX idx_finaud_entidade (entidade, entidade_id),
          INDEX idx_finaud_processo (processo_id),
          INDEX idx_finaud_data (criado_em)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS financeiro_documentos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          entidade VARCHAR(40) NOT NULL,
          entidade_id INT NOT NULL,
          tipo VARCHAR(30) NOT NULL,
          nome_arquivo VARCHAR(255) NOT NULL,
          mime VARCHAR(100) NOT NULL,
          tamanho INT NOT NULL,
          sha256 CHAR(64) NOT NULL,
          conteudo MEDIUMBLOB NOT NULL,
          enviado_por_id INT NULL,
          enviado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_findoc_entidade (entidade, entidade_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ── Comissões ──
        `CREATE TABLE IF NOT EXISTS comissao_regras (
          id INT AUTO_INCREMENT PRIMARY KEY,
          papel ENUM('consultor','executivo') NOT NULL,
          usuario_id INT NULL,
          empresa_id INT NULL,
          percentual DECIMAL(7,4) NOT NULL,
          base_calculo ENUM('nao_definida','valor_nf_servicos','valor_recebido','manual') NOT NULL DEFAULT 'nao_definida',
          referencia_vigencia ENUM('nao_definida','competencia','emissao_nf','recebimento') NOT NULL DEFAULT 'nao_definida',
          vigencia_inicio DATE NOT NULL,
          vigencia_fim DATE NULL,
          confirmada TINYINT(1) NOT NULL DEFAULT 0,
          confirmacao_referencia VARCHAR(300) NULL,
          confirmada_por_id INT NULL,
          confirmada_por_nome VARCHAR(150) NULL,
          confirmada_em DATETIME NULL,
          ativa TINYINT(1) NOT NULL DEFAULT 1,
          observacao TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_comreg_papel (papel, usuario_id, empresa_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS faturamento_responsaveis (
          id INT AUTO_INCREMENT PRIMARY KEY,
          processo_id INT NOT NULL,
          papel ENUM('consultor','executivo') NOT NULL,
          usuario_id INT NOT NULL,
          usuario_nome VARCHAR(150) NOT NULL,
          origem ENUM('empresa','manual') NOT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fatresp (processo_id, papel, usuario_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS comissoes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          processo_id INT NOT NULL,
          responsavel_id INT NOT NULL,
          usuario_id INT NOT NULL,
          usuario_nome VARCHAR(150) NOT NULL,
          papel ENUM('consultor','executivo') NOT NULL,
          regra_id INT NULL,
          percentual DECIMAL(7,4) NULL,
          base_calculo VARCHAR(30) NULL,
          base_valor DECIMAL(14,2) NULL,
          base_manual_motivo TEXT NULL,
          valor DECIMAL(14,2) NULL,
          situacao ENUM('aguardando_regra','aguardando_base','calculada','conferida','contestada') NOT NULL,
          motivo_situacao TEXT NULL,
          conferido_por_id INT NULL,
          conferido_por_nome VARCHAR(150) NULL,
          conferido_em DATETIME NULL,
          calculado_em DATETIME NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_comissao_resp (processo_id, responsavel_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ── Notas fiscais ──
        `CREATE TABLE IF NOT EXISTS fiscal_municipios (
          id INT AUTO_INCREMENT PRIMARY KEY,
          municipio VARCHAR(120) NOT NULL,
          uf CHAR(2) NOT NULL,
          codigo_ibge VARCHAR(7) NULL,
          sistema VARCHAR(150) NULL,
          url VARCHAR(300) NULL,
          modo_integracao ENUM('nao_analisado','manual','api_nacional','webservice_municipal','rpa') NOT NULL DEFAULT 'nao_analisado',
          situacao ENUM('nao_analisado','em_analise','aguardando_acesso','viavel','inviavel') NOT NULL DEFAULT 'nao_analisado',
          requisitos TEXT NULL,
          pendencias TEXT NULL,
          observacoes TEXT NULL,
          atualizado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fiscmun (municipio, uf)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS faturamento_notas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          processo_id INT NOT NULL,
          municipio_id INT NULL,
          status ENUM('rascunho','emitida','cancelada') NOT NULL DEFAULT 'rascunho',
          modo_emissao ENUM('manual_portal','api','rpa') NOT NULL DEFAULT 'manual_portal',
          chave_numero VARCHAR(80) NULL,
          numero VARCHAR(30) NULL,
          serie VARCHAR(10) NULL,
          codigo_verificacao VARCHAR(60) NULL,
          data_emissao DATE NULL,
          competencia CHAR(7) NOT NULL,
          prestador_nome VARCHAR(200) NULL,
          prestador_cnpj VARCHAR(14) NULL,
          tomador_nome VARCHAR(200) NULL,
          tomador_documento VARCHAR(14) NULL,
          tomador_endereco VARCHAR(300) NULL,
          tomador_municipio VARCHAR(120) NULL,
          tomador_uf CHAR(2) NULL,
          codigo_servico VARCHAR(20) NULL,
          discriminacao TEXT NULL,
          valor_servicos DECIMAL(14,2) NOT NULL DEFAULT 0,
          valor_deducoes DECIMAL(14,2) NOT NULL DEFAULT 0,
          aliquota_iss DECIMAL(7,4) NULL,
          valor_iss DECIMAL(14,2) NOT NULL DEFAULT 0,
          iss_retido TINYINT(1) NOT NULL DEFAULT 0,
          valor_pis DECIMAL(14,2) NOT NULL DEFAULT 0,
          valor_cofins DECIMAL(14,2) NOT NULL DEFAULT 0,
          valor_csll DECIMAL(14,2) NOT NULL DEFAULT 0,
          valor_irrf DECIMAL(14,2) NOT NULL DEFAULT 0,
          valor_inss DECIMAL(14,2) NOT NULL DEFAULT 0,
          outras_retencoes DECIMAL(14,2) NOT NULL DEFAULT 0,
          valor_liquido DECIMAL(14,2) NULL,
          motivo_cancelamento TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          emitida_registrada_por_nome VARCHAR(150) NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fatnota_numero (chave_numero),
          INDEX idx_fatnota_proc (processo_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ── Cobranças ──
        `CREATE TABLE IF NOT EXISTS faturamento_cobrancas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          codigo VARCHAR(30) NULL,
          processo_id INT NOT NULL,
          nota_id INT NULL,
          empresa_id INT NOT NULL,
          valor DECIMAL(14,2) NOT NULL,
          vencimento DATE NOT NULL,
          forma ENUM('boleto','pix','transferencia','deposito','outro') NOT NULL,
          banco_codigo VARCHAR(3) NULL,
          nosso_numero VARCHAR(40) NULL,
          chave_nosso_numero VARCHAR(50) NULL,
          linha_digitavel VARCHAR(60) NULL,
          status ENUM('aberta','parcial','paga','divergente','cancelada') NOT NULL DEFAULT 'aberta',
          valor_recebido DECIMAL(14,2) NOT NULL DEFAULT 0,
          observacao TEXT NULL,
          motivo_cancelamento TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fatcob_codigo (codigo),
          UNIQUE KEY uk_fatcob_nosso_numero (chave_nosso_numero),
          INDEX idx_fatcob_proc (processo_id),
          INDEX idx_fatcob_status (status, vencimento)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        // ── Recebimentos e retorno bancário ──
        `CREATE TABLE IF NOT EXISTS financeiro_retornos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          layout VARCHAR(20) NOT NULL,
          banco_codigo VARCHAR(3) NULL,
          nome_arquivo VARCHAR(255) NOT NULL,
          sha256 CHAR(64) NOT NULL,
          sha256_ativo CHAR(64) NULL,
          documento_id INT NULL,
          status ENUM('pendente','processado','descartado') NOT NULL DEFAULT 'pendente',
          total_registros INT NOT NULL DEFAULT 0,
          valor_total DECIMAL(14,2) NOT NULL DEFAULT 0,
          resumo TEXT NULL,
          importado_por_id INT NULL,
          importado_por_nome VARCHAR(150) NULL,
          importado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          processado_por_nome VARCHAR(150) NULL,
          processado_em DATETIME NULL,
          motivo_descarte TEXT NULL,
          UNIQUE KEY uk_finret_sha (sha256_ativo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS financeiro_retorno_linhas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          retorno_id INT NOT NULL,
          linha_numero INT NOT NULL,
          identificador VARCHAR(50) NOT NULL,
          data_pagamento DATE NOT NULL,
          data_credito DATE NULL,
          valor_pago DECIMAL(14,2) NOT NULL,
          juros DECIMAL(14,2) NOT NULL DEFAULT 0,
          desconto DECIMAL(14,2) NOT NULL DEFAULT 0,
          pagador_nome VARCHAR(200) NULL,
          pagador_documento VARCHAR(14) NULL,
          cobranca_id INT NULL,
          classificacao ENUM('integral','parcial','a_maior','nao_identificado','cobranca_cancelada','ja_quitada','duplicado') NOT NULL,
          mensagem VARCHAR(300) NULL,
          recebimento_id INT NULL,
          INDEX idx_finretl_ret (retorno_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS financeiro_recebimentos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          cobranca_id INT NULL,
          origem ENUM('retorno','manual') NOT NULL,
          retorno_linha_id INT NULL,
          identificador VARCHAR(50) NULL,
          data_pagamento DATE NOT NULL,
          data_credito DATE NULL,
          valor DECIMAL(14,2) NOT NULL,
          juros DECIMAL(14,2) NOT NULL DEFAULT 0,
          desconto DECIMAL(14,2) NOT NULL DEFAULT 0,
          pagador_nome VARCHAR(200) NULL,
          pagador_documento VARCHAR(14) NULL,
          situacao ENUM('ativo','estornado') NOT NULL DEFAULT 'ativo',
          observacao TEXT NULL,
          motivo TEXT NULL,
          autorizado_por_id INT NULL,
          autorizado_por_nome VARCHAR(150) NULL,
          vinculado_por_nome VARCHAR(150) NULL,
          vinculado_em DATETIME NULL,
          estornado_por_nome VARCHAR(150) NULL,
          estornado_em DATETIME NULL,
          motivo_estorno TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_finrec_cob (cobranca_id, situacao),
          INDEX idx_finrec_ident (identificador, data_pagamento)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      ];
      for (const sql of ddl) await pool.query(sql);
      // 2026-10-21: marca a prefeitura onde a ATESA (prestador) emite a NFS-e
      try {
        await pool.query(`ALTER TABLE fiscal_municipios ADD COLUMN prefeitura_emissora TINYINT(1) NOT NULL DEFAULT 0`);
      } catch (err) {
        if (err?.code !== 'ER_DUP_FIELDNAME') throw err;
      }
    })().catch((err) => {
      inicializado = null;
      console.error('[financeiro] Erro ao criar tabelas:', err?.message);
      throw err;
    });
  }
  return inicializado;
}

// ── Auditoria ────────────────────────────────────────────────────────────────
export async function auditarFin(conn, usuario, { entidade, entidadeId = null, processoId = null, acao, campo = null, anterior = null, novo = null, motivo = null }) {
  const txt = (v) => (v === null || v === undefined ? null : typeof v === 'object' ? JSON.stringify(v) : String(v));
  await conn.query(
    `INSERT INTO financeiro_auditoria
       (entidade, entidade_id, processo_id, acao, campo, valor_anterior, valor_novo, motivo, usuario_id, usuario_nome, usuario_perfil, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entidade, entidadeId, processoId, acao, campo, txt(anterior), txt(novo), motivo ?? null,
      usuario?.id ?? null, usuario?.nome ?? null, usuario?.perfil ?? null, usuario?.ip ?? null]
  );
}

export async function listarAuditoriaFinanceira({ entidade, entidadeId, processoId, limite } = {}) {
  await garantirEstruturaFinanceira();
  let sql = 'SELECT * FROM financeiro_auditoria WHERE 1=1';
  const params = [];
  if (entidade) { sql += ' AND entidade = ?'; params.push(entidade); }
  if (entidadeId) { sql += ' AND entidade_id = ?'; params.push(Number(entidadeId)); }
  if (processoId) { sql += ' AND processo_id = ?'; params.push(Number(processoId)); }
  sql += ' ORDER BY criado_em DESC, id DESC LIMIT ?';
  params.push(Math.min(Number(limite) || 500, 2000));
  const [rows] = await pool.query(sql, params);
  return rows;
}

// ── Documentos (PDF/XML da NF, comprovantes, arquivos de retorno) ───────────
export const TAMANHO_MAXIMO_DOCUMENTO = 3 * 1024 * 1024; // envio em base64 cabe no limite de 4,5 MB da Vercel
const MIMES_PERMITIDOS = {
  pdf: 'application/pdf',
  xml: 'application/xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  txt: 'text/plain',
  ret: 'text/plain',
  rem: 'text/plain',
  csv: 'text/csv',
};

/** Valida e decodifica um arquivo enviado em base64. */
export function decodificarArquivo({ nomeArquivo, conteudoBase64 } = {}, extensoesAceitas) {
  const nome = String(nomeArquivo || '').trim().replace(/[\\/]/g, '_').slice(0, 255);
  if (!nome) throw erro(400, 'Informe o arquivo.');
  const ext = (nome.split('.').pop() || '').toLowerCase();
  if (!extensoesAceitas.includes(ext) || !MIMES_PERMITIDOS[ext]) {
    throw erro(400, `Tipo de arquivo não aceito. Use: ${extensoesAceitas.join(', ')}.`);
  }
  const b64 = String(conteudoBase64 || '').replace(/^data:[^;]+;base64,/, '');
  if (!b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) throw erro(400, 'Conteúdo do arquivo inválido.');
  const buffer = Buffer.from(b64, 'base64');
  if (buffer.length === 0) throw erro(400, 'O arquivo está vazio.');
  if (buffer.length > TAMANHO_MAXIMO_DOCUMENTO) throw erro(400, 'Arquivo maior que 3 MB.');
  if (ext === 'pdf' && buffer.subarray(0, 5).toString('latin1') !== '%PDF-') throw erro(400, 'O arquivo não é um PDF válido.');
  return { nome, ext, mime: MIMES_PERMITIDOS[ext], buffer, sha256: crypto.createHash('sha256').update(buffer).digest('hex') };
}

export async function salvarDocumento(conn, { entidade, entidadeId, tipo, arquivo }, usuario) {
  const [res] = await conn.query(
    `INSERT INTO financeiro_documentos (entidade, entidade_id, tipo, nome_arquivo, mime, tamanho, sha256, conteudo, enviado_por_id, enviado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [entidade, entidadeId, tipo, arquivo.nome, arquivo.mime, arquivo.buffer.length, arquivo.sha256, arquivo.buffer,
      usuario?.id ?? null, usuario?.nome ?? null]
  );
  return res.insertId;
}

export async function listarDocumentos(entidade, entidadeId) {
  const [rows] = await pool.query(
    `SELECT id, entidade, entidade_id, tipo, nome_arquivo, mime, tamanho, sha256, enviado_por_nome, criado_em
       FROM financeiro_documentos WHERE entidade = ? AND entidade_id = ? ORDER BY criado_em DESC`,
    [entidade, Number(entidadeId)]
  );
  return rows;
}

export async function obterConteudoDocumento(id) {
  await garantirEstruturaFinanceira();
  const [[doc]] = await pool.query(`SELECT * FROM financeiro_documentos WHERE id = ?`, [Number(id)]);
  if (!doc) throw erro(404, 'Documento não encontrado.');
  return doc;
}

// ── Pagamentos de cooperados, lotes/remessas e contas a pagar ───────────────
let inicializadoPagamentos = null;
export function garantirEstruturaPagamentos() {
  if (!inicializadoPagamentos) {
    inicializadoPagamentos = (async () => {
      await garantirEstruturaFinanceira();
      const ddl = [
        `CREATE TABLE IF NOT EXISTS cooperado_lancamentos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidato_id INT NOT NULL,
          tipo ENUM('credito','debito') NOT NULL,
          categoria ENUM('remuneracao','inss','irrf','quota_parte','desconto_fixo','cota','adiantamento','compensacao_adiantamento','ajuste','outro') NOT NULL,
          origem ENUM('esocial_remuneracao','cadastro_descontos','cota_mensal','adiantamento','manual','estorno') NOT NULL,
          origem_ref VARCHAR(80) NULL,
          chave_origem VARCHAR(120) NULL,
          chave_ativa VARCHAR(120) NULL,
          competencia CHAR(7) NOT NULL,
          compensar_a_partir CHAR(7) NULL,
          descricao VARCHAR(255) NOT NULL,
          valor DECIMAL(12,2) NOT NULL,
          situacao ENUM('aguardando','pendente','reservado','liquidado','cancelado') NOT NULL DEFAULT 'pendente',
          pagamento_id INT NULL,
          adiantamento_pagamento_id INT NULL,
          estorno_de_id INT NULL,
          motivo TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          cancelado_por_nome VARCHAR(150) NULL,
          motivo_cancelamento TEXT NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_coolanc_chave (chave_ativa),
          INDEX idx_coolanc_cand (candidato_id, situacao),
          INDEX idx_coolanc_comp (competencia),
          INDEX idx_coolanc_pag (pagamento_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS cooperado_pagamentos (
          id INT AUTO_INCREMENT PRIMARY KEY,
          codigo VARCHAR(30) NULL,
          candidato_id INT NOT NULL,
          competencia CHAR(7) NOT NULL,
          tipo ENUM('repasse','adiantamento') NOT NULL,
          chave_ativa VARCHAR(40) NULL,
          valor_creditos DECIMAL(12,2) NOT NULL DEFAULT 0,
          valor_debitos DECIMAL(12,2) NOT NULL DEFAULT 0,
          valor_liquido DECIMAL(12,2) NOT NULL DEFAULT 0,
          situacao ENUM('em_preparacao','liberado','em_lote','pago','rejeitado','retido','cancelado') NOT NULL DEFAULT 'em_preparacao',
          pendencias TEXT NULL,
          processos_vinculados TEXT NULL,
          recebimento_confirmado TINYINT(1) NOT NULL DEFAULT 0,
          excecao TINYINT(1) NOT NULL DEFAULT 0,
          excecao_motivo TEXT NULL,
          excecao_por_id INT NULL,
          excecao_por_nome VARCHAR(150) NULL,
          dados_bancarios TEXT NULL,
          liberado_por_id INT NULL,
          liberado_por_nome VARCHAR(150) NULL,
          liberado_em DATETIME NULL,
          data_pagamento DATE NULL,
          confirmado_por_nome VARCHAR(150) NULL,
          confirmado_em DATETIME NULL,
          motivo_situacao TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_coopag_codigo (codigo),
          UNIQUE KEY uk_coopag_chave (chave_ativa),
          INDEX idx_coopag_comp (competencia, situacao),
          INDEX idx_coopag_cand (candidato_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS cooperado_bloqueios_pagamento (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidato_id INT NOT NULL,
          motivo TEXT NOT NULL,
          ativo TINYINT(1) NOT NULL DEFAULT 1,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          encerrado_por_nome VARCHAR(150) NULL,
          encerrado_em DATETIME NULL,
          motivo_encerramento TEXT NULL,
          INDEX idx_coobloq_cand (candidato_id, ativo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS pagamento_lotes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          codigo VARCHAR(30) NULL,
          banco_codigo VARCHAR(3) NULL,
          modalidade ENUM('credito_conta','ted','pix') NOT NULL,
          leiaute VARCHAR(40) NOT NULL,
          situacao ENUM('gerado','enviado','processado','cancelado') NOT NULL DEFAULT 'gerado',
          documento_id INT NULL,
          sha256 CHAR(64) NULL,
          total_itens INT NOT NULL DEFAULT 0,
          valor_total DECIMAL(14,2) NOT NULL DEFAULT 0,
          gerado_por_id INT NULL,
          gerado_por_nome VARCHAR(150) NULL,
          gerado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          enviado_por_nome VARCHAR(150) NULL,
          enviado_em DATETIME NULL,
          motivo_cancelamento TEXT NULL,
          UNIQUE KEY uk_paglote_codigo (codigo)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS pagamento_lote_itens (
          id INT AUTO_INCREMENT PRIMARY KEY,
          lote_id INT NOT NULL,
          pagamento_id INT NOT NULL,
          chave_ativa INT NULL,
          valor DECIMAL(12,2) NOT NULL,
          favorecido TEXT NOT NULL,
          situacao ENUM('incluido','confirmado','rejeitado','removido') NOT NULL DEFAULT 'incluido',
          ocorrencia_codigo VARCHAR(20) NULL,
          ocorrencia_descricao VARCHAR(300) NULL,
          atualizado_por_nome VARCHAR(150) NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_paglitem_ativo (chave_ativa),
          INDEX idx_paglitem_lote (lote_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS fornecedores (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(200) NOT NULL,
          documento VARCHAR(14) NOT NULL,
          email VARCHAR(150) NULL,
          telefone VARCHAR(20) NULL,
          codigo_banco VARCHAR(3) NULL,
          agencia VARCHAR(10) NULL,
          conta VARCHAR(20) NULL,
          digito VARCHAR(2) NULL,
          tipo_conta ENUM('corrente','poupanca') NULL,
          chave_pix VARCHAR(150) NULL,
          tipo_pix ENUM('cpf','cnpj','email','telefone','aleatoria') NULL,
          ativo TINYINT(1) NOT NULL DEFAULT 1,
          observacao TEXT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_fornec_doc (documento)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS cooperado_solicitacoes_dados (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidato_id INT NOT NULL,
          pagamento_id INT NULL,
          setor VARCHAR(40) NOT NULL DEFAULT 'beneficios',
          mensagem VARCHAR(500) NULL,
          situacao ENUM('aberta','atendida') NOT NULL DEFAULT 'aberta',
          chave_ativa INT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atendida_em DATETIME NULL,
          UNIQUE KEY uk_csd_ativa (chave_ativa),
          INDEX idx_csd_candidato (candidato_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS contas_pagar_categorias (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(100) NOT NULL,
          ativa TINYINT(1) NOT NULL DEFAULT 1,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE KEY uk_cpcat_nome (nome)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
        `CREATE TABLE IF NOT EXISTS contas_pagar (
          id INT AUTO_INCREMENT PRIMARY KEY,
          codigo VARCHAR(30) NULL,
          fornecedor_id INT NOT NULL,
          categoria_id INT NOT NULL,
          descricao VARCHAR(255) NOT NULL,
          competencia CHAR(7) NOT NULL,
          valor DECIMAL(14,2) NOT NULL,
          vencimento DATE NOT NULL,
          documento_tipo ENUM('nfe','nfse','boleto','recibo','fatura','outro') NOT NULL,
          documento_numero VARCHAR(60) NULL,
          documento_emissao DATE NULL,
          chave_documento VARCHAR(120) NULL,
          situacao ENUM('aguardando_aprovacao','aprovada','programada','paga','rejeitada','cancelada') NOT NULL DEFAULT 'aguardando_aprovacao',
          forma_pagamento ENUM('boleto','pix','transferencia','debito_automatico','dinheiro','outro') NULL,
          data_programada DATE NULL,
          data_pagamento DATE NULL,
          valor_pago DECIMAL(14,2) NULL,
          juros DECIMAL(14,2) NOT NULL DEFAULT 0,
          multa DECIMAL(14,2) NOT NULL DEFAULT 0,
          desconto DECIMAL(14,2) NOT NULL DEFAULT 0,
          observacao TEXT NULL,
          motivo_situacao TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          aprovado_por_id INT NULL,
          aprovado_por_nome VARCHAR(150) NULL,
          aprovado_em DATETIME NULL,
          programado_por_nome VARCHAR(150) NULL,
          baixado_por_nome VARCHAR(150) NULL,
          baixado_em DATETIME NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_cp_codigo (codigo),
          UNIQUE KEY uk_cp_documento (chave_documento),
          INDEX idx_cp_situacao (situacao, vencimento),
          INDEX idx_cp_fornec (fornecedor_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`,
      ];
      for (const sql of ddl) await pool.query(sql);
    })().catch((err) => {
      inicializadoPagamentos = null;
      console.error('[financeiro] Erro ao criar tabelas de pagamentos:', err?.message);
      throw err;
    });
  }
  return inicializadoPagamentos;
}
