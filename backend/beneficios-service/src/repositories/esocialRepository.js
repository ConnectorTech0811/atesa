import { pool } from '../config/database.js';

// ── Estrutura ─────────────────────────────────────────────────────────────────

let tabelasProntas = null;

/** Cria as tabelas do eSocial (idempotente). Aguardado por todas as rotas do módulo. */
export function garantirTabelasESocial() {
  if (!tabelasProntas) {
    tabelasProntas = criarTabelas().catch((e) => {
      tabelasProntas = null;
      throw e;
    });
  }
  return tabelasProntas;
}

async function criarTabelas() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS esocial_config (
      id TINYINT PRIMARY KEY DEFAULT 1,
      tp_insc TINYINT NOT NULL DEFAULT 1,
      nr_insc_empregador VARCHAR(14) NULL,
      cnpj_transmissor VARCHAR(14) NULL,
      ambiente TINYINT NOT NULL DEFAULT 2,
      versao_layout VARCHAR(20) NOT NULL DEFAULT 'v_S_01_03_00',
      cod_categ VARCHAR(3) NOT NULL DEFAULT '731',
      cnpj_estab VARCHAR(14) NULL,
      cod_lotacao VARCHAR(30) NULL,
      rubrica_remuneracao VARCHAR(30) NULL,
      rubrica_inss VARCHAR(30) NULL,
      rubrica_irrf VARCHAR(30) NULL,
      ide_tab_rubr VARCHAR(8) NULL,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      atualizado_por_nome VARCHAR(200) NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);
  await pool.query(`INSERT IGNORE INTO esocial_config (id) VALUES (1)`);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS esocial_competencias (
      competencia CHAR(7) NOT NULL,
      ambiente TINYINT NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'aberta',
      fechamento_solicitado_em DATETIME NULL,
      fechamento_solicitado_por_nome VARCHAR(200) NULL,
      fechada_em DATETIME NULL,
      inss_apurado DECIMAL(14,2) NULL,
      irrf_apurado DECIMAL(14,2) NULL,
      reaberta_em DATETIME NULL,
      reaberta_por_nome VARCHAR(200) NULL,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (competencia, ambiente)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS esocial_remuneracoes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      competencia CHAR(7) NOT NULL,
      candidato_id INT NOT NULL,
      valor_bruto DECIMAL(12,2) NOT NULL,
      valor_inss DECIMAL(12,2) NOT NULL DEFAULT 0,
      valor_irrf DECIMAL(12,2) NOT NULL DEFAULT 0,
      valor_liquido DECIMAL(12,2) NULL,
      data_pagamento DATE NULL,
      cnpj_estab VARCHAR(14) NULL,
      cod_lotacao VARCHAR(30) NULL,
      importado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      importado_por_nome VARCHAR(200) NULL,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unq_remun_comp_cand (competencia, candidato_id),
      INDEX idx_remun_pgto (data_pagamento)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS esocial_lotes (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ambiente TINYINT NOT NULL,
      grupo TINYINT NOT NULL,
      tipo_evento VARCHAR(6) NOT NULL,
      competencia CHAR(7) NULL,
      qtd_eventos INT NOT NULL DEFAULT 0,
      status VARCHAR(20) NOT NULL DEFAULT 'enviando',
      protocolo VARCHAR(60) NULL,
      cd_resposta VARCHAR(10) NULL,
      desc_resposta TEXT NULL,
      ocorrencias_json LONGTEXT NULL,
      xml_retorno_envio MEDIUMTEXT NULL,
      xml_retorno_consulta MEDIUMTEXT NULL,
      tentativas_consulta INT NOT NULL DEFAULT 0,
      ultima_consulta_em DATETIME NULL,
      enviado_em DATETIME NULL,
      processado_em DATETIME NULL,
      enviado_por_nome VARCHAR(200) NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_lote_status (status, ambiente)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS esocial_eventos (
      id INT AUTO_INCREMENT PRIMARY KEY,
      evento_id VARCHAR(40) NULL,
      ambiente TINYINT NOT NULL,
      tipo VARCHAR(6) NOT NULL,
      candidato_id INT NULL,
      competencia CHAR(7) NULL,
      per_apur CHAR(7) NULL,
      remuneracao_id INT NULL,
      lote_id INT NULL,
      ind_retif TINYINT NOT NULL DEFAULT 1,
      status VARCHAR(20) NOT NULL,
      cd_resposta VARCHAR(10) NULL,
      desc_resposta TEXT NULL,
      ocorrencias_json LONGTEXT NULL,
      nr_recibo VARCHAR(40) NULL,
      totalizadores_json LONGTEXT NULL,
      xml_evento MEDIUMTEXT NULL,
      origem VARCHAR(20) NOT NULL DEFAULT 'sistema',
      enviado_por_nome VARCHAR(200) NULL,
      criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
      atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY unq_evento_id (evento_id),
      INDEX idx_ev_cand (tipo, ambiente, candidato_id),
      INDEX idx_ev_comp (tipo, ambiente, competencia),
      INDEX idx_ev_perapur (tipo, ambiente, per_apur),
      INDEX idx_ev_lote (lote_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  try { await pool.query(`ALTER TABLE ra_dados_sensiveis ADD COLUMN codigo_municipio_ibge VARCHAR(7) NULL`); } catch { }
}

// ── Configuração ──────────────────────────────────────────────────────────────

export async function obterConfig() {
  const [[cfg]] = await pool.query(`SELECT * FROM esocial_config WHERE id = 1`);
  return cfg;
}

const CAMPOS_CONFIG = [
  'tp_insc', 'nr_insc_empregador', 'cnpj_transmissor', 'ambiente', 'versao_layout', 'cod_categ',
  'cnpj_estab', 'cod_lotacao', 'rubrica_remuneracao', 'rubrica_inss', 'rubrica_irrf', 'ide_tab_rubr',
];

export async function salvarConfig(dados, usuarioNome) {
  const campos = CAMPOS_CONFIG.filter((c) => dados[c] !== undefined);
  if (!campos.length) return;
  await pool.query(
    `UPDATE esocial_config SET ${campos.map((c) => `${c} = ?`).join(', ')}, atualizado_por_nome = ? WHERE id = 1`,
    [...campos.map((c) => (dados[c] === '' ? null : dados[c])), usuarioNome]
  );
}

// ── Cooperados ────────────────────────────────────────────────────────────────

/** Dados cadastrais completos para o S-2300 (cargo/CBO vêm da primeira alocação). */
export async function buscarCooperadosParaCadastro(candidatoIds) {
  if (!candidatoIds.length) return [];
  const [linhas] = await pool.query(
    `SELECT c.id, c.nome, c.cpf, c.email, c.telefone, c.matricula, c.tipo_contratacao,
            ds.genero, ds.cor_etnia, ds.estado_civil, ds.grau_instrucao, ds.data_nascimento,
            ds.nacionalidade, ds.nome_social, ds.cep, ds.logradouro, ds.numero, ds.complemento,
            ds.bairro, ds.cidade, ds.uf, ds.codigo_municipio_ibge,
            (SELECT a.data_inicio FROM ra_alocacoes a WHERE a.candidato_id = c.id AND a.status <> 'cancelada'
              ORDER BY a.data_inicio ASC, a.id ASC LIMIT 1) AS data_inicio_alocacao,
            (SELECT v.cargo FROM ra_alocacoes a JOIN parametro_vagas v ON v.id = a.vaga_id
              WHERE a.candidato_id = c.id AND a.status <> 'cancelada'
              ORDER BY a.data_inicio ASC, a.id ASC LIMIT 1) AS cargo,
            COALESCE(
              NULLIF((SELECT v.cbo FROM ra_alocacoes a JOIN parametro_vagas v ON v.id = a.vaga_id
                       WHERE a.candidato_id = c.id AND a.status <> 'cancelada'
                       ORDER BY a.data_inicio ASC, a.id ASC LIMIT 1), ''),
              ds.cbo
            ) AS cbo
     FROM ra_candidatos c
     LEFT JOIN ra_dados_sensiveis ds ON ds.candidato_id = c.id
     WHERE c.id IN (?)`,
    [candidatoIds]
  );
  return linhas;
}

export async function salvarCodigoMunicipio(candidatoId, codigo) {
  await pool.query(`UPDATE ra_dados_sensiveis SET codigo_municipio_ibge = ? WHERE candidato_id = ?`, [codigo, candidatoId]);
}

/** Cooperados alocados (alocação não cancelada) que nunca tiveram S-2300 neste ambiente. */
export async function listarIdsSemCadastroESocial(ambiente, limite) {
  const [linhas] = await pool.query(
    `SELECT DISTINCT a.candidato_id AS id
     FROM ra_alocacoes a
     WHERE a.status <> 'cancelada'
       AND NOT EXISTS (SELECT 1 FROM esocial_eventos e
                       WHERE e.tipo = 'S-2300' AND e.ambiente = ? AND e.candidato_id = a.candidato_id)
     ORDER BY a.candidato_id
     LIMIT ?`,
    [ambiente, limite]
  );
  return linhas.map((l) => l.id);
}

export async function contarSemCadastroESocial(ambiente) {
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(DISTINCT a.candidato_id) AS total
     FROM ra_alocacoes a
     WHERE a.status <> 'cancelada'
       AND NOT EXISTS (SELECT 1 FROM esocial_eventos e
                       WHERE e.tipo = 'S-2300' AND e.ambiente = ? AND e.candidato_id = a.candidato_id)`,
    [ambiente]
  );
  return Number(total);
}

/** Lista de cooperados alocados com a situação da última tentativa de S-2300. */
export async function listarSituacaoCadastro(ambiente) {
  const [linhas] = await pool.query(
    `SELECT c.id AS candidato_id, c.nome, c.cpf, c.matricula, c.tipo_contratacao,
            e.id AS evento_db_id, e.status, e.cd_resposta, e.desc_resposta, e.ocorrencias_json,
            e.nr_recibo, e.criado_em AS ultima_tentativa_em, e.origem,
            (SELECT COUNT(*) FROM esocial_eventos x
              WHERE x.tipo = 'S-2300' AND x.ambiente = ? AND x.candidato_id = c.id AND x.origem = 'sistema') AS tentativas
     FROM ra_candidatos c
     LEFT JOIN esocial_eventos e ON e.id = (
       SELECT MAX(y.id) FROM esocial_eventos y WHERE y.tipo = 'S-2300' AND y.ambiente = ? AND y.candidato_id = c.id)
     WHERE EXISTS (SELECT 1 FROM ra_alocacoes a WHERE a.candidato_id = c.id AND a.status <> 'cancelada')
     ORDER BY c.nome`,
    [ambiente, ambiente]
  );
  return linhas;
}

// ── Remunerações ──────────────────────────────────────────────────────────────

export async function buscarCandidatosPorMatriculaOuCpf(matriculas, cpfs) {
  if (!matriculas.length && !cpfs.length) return [];
  const [linhas] = await pool.query(
    `SELECT id, nome, cpf, matricula FROM ra_candidatos
     WHERE matricula IN (?) OR cpf IN (?)`,
    [matriculas.length ? matriculas : [''], cpfs.length ? cpfs : ['']]
  );
  return linhas;
}

export async function salvarRemuneracoes(competencia, linhas, usuarioNome) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const l of linhas) {
      await conn.query(
        `INSERT INTO esocial_remuneracoes
           (competencia, candidato_id, valor_bruto, valor_inss, valor_irrf, valor_liquido, data_pagamento,
            cnpj_estab, cod_lotacao, importado_por_nome)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           valor_bruto = VALUES(valor_bruto), valor_inss = VALUES(valor_inss), valor_irrf = VALUES(valor_irrf),
           valor_liquido = VALUES(valor_liquido), data_pagamento = VALUES(data_pagamento),
           cnpj_estab = VALUES(cnpj_estab), cod_lotacao = VALUES(cod_lotacao),
           importado_por_nome = VALUES(importado_por_nome)`,
        [competencia, l.candidatoId, l.valorBruto, l.valorInss, l.valorIrrf, l.valorLiquido, l.dataPagamento,
          l.cnpjEstab, l.codLotacao, usuarioNome]
      );
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function removerRemuneracao(competencia, candidatoId) {
  await pool.query(`DELETE FROM esocial_remuneracoes WHERE competencia = ? AND candidato_id = ?`, [competencia, candidatoId]);
}

const SELECT_REMUN = `
  SELECT r.*, DATE_FORMAT(r.data_pagamento, '%Y-%m-%d') AS data_pagamento,
         c.nome, c.cpf, c.matricula, c.tipo_contratacao
  FROM esocial_remuneracoes r
  JOIN ra_candidatos c ON c.id = r.candidato_id`;

export async function buscarRemuneracoes(competencia, candidatoIds) {
  if (!candidatoIds.length) return [];
  const [linhas] = await pool.query(`${SELECT_REMUN} WHERE r.competencia = ? AND r.candidato_id IN (?)`, [competencia, candidatoIds]);
  return linhas;
}

/**
 * Remunerações da competência com a última tentativa de S-1200 e de S-1210.
 */
export async function listarRemuneracoesComSituacao(competencia, ambiente) {
  const ultimo = (tipo) => `(SELECT MAX(y.id) FROM esocial_eventos y
     WHERE y.tipo = '${tipo}' AND y.ambiente = ? AND y.candidato_id = r.candidato_id AND y.competencia = r.competencia)`;
  const tentativas = (tipo) => `(SELECT COUNT(*) FROM esocial_eventos x
     WHERE x.tipo = '${tipo}' AND x.ambiente = ? AND x.candidato_id = r.candidato_id AND x.competencia = r.competencia)`;
  const [linhas] = await pool.query(
    `SELECT r.id, r.competencia, r.candidato_id, r.valor_bruto, r.valor_inss, r.valor_irrf, r.valor_liquido,
            DATE_FORMAT(r.data_pagamento, '%Y-%m-%d') AS data_pagamento, r.atualizado_em,
            c.nome, c.cpf, c.matricula, c.tipo_contratacao,
            (SELECT p.status FROM esocial_eventos p WHERE p.tipo = 'S-2300' AND p.ambiente = ?
              AND p.candidato_id = r.candidato_id ORDER BY p.id DESC LIMIT 1) AS s2300_status,
            e1.id AS s1200_id, e1.status AS s1200_status, e1.desc_resposta AS s1200_desc, e1.ocorrencias_json AS s1200_ocorrencias,
            e1.nr_recibo AS s1200_recibo, e1.criado_em AS s1200_em, ${tentativas('S-1200')} AS s1200_tentativas,
            e2.id AS s1210_id, e2.status AS s1210_status, e2.desc_resposta AS s1210_desc, e2.ocorrencias_json AS s1210_ocorrencias,
            e2.nr_recibo AS s1210_recibo, e2.criado_em AS s1210_em, e2.per_apur AS s1210_per_apur, ${tentativas('S-1210')} AS s1210_tentativas
     FROM esocial_remuneracoes r
     JOIN ra_candidatos c ON c.id = r.candidato_id
     LEFT JOIN esocial_eventos e1 ON e1.id = ${ultimo('S-1200')}
     LEFT JOIN esocial_eventos e2 ON e2.id = ${ultimo('S-1210')}
     WHERE r.competencia = ?
     ORDER BY c.nome`,
    [ambiente, ambiente, ambiente, ambiente, ambiente, competencia]
  );
  return linhas;
}

/**
 * Pré-requisito para o envio em massa: S-1200 exige S-2300 aceito; S-1210 exige
 * o S-1200 da competência aceito. Quem não cumpre fica "aguardando" na tela.
 */
function condicaoPreRequisito(tipo) {
  return tipo === 'S-1200'
    ? `EXISTS (SELECT 1 FROM esocial_eventos p WHERE p.tipo = 'S-2300' AND p.ambiente = e_amb.amb
               AND p.candidato_id = r.candidato_id AND p.status = 'aceito')`
    : `EXISTS (SELECT 1 FROM esocial_eventos p WHERE p.tipo = 'S-1200' AND p.ambiente = e_amb.amb
               AND p.candidato_id = r.candidato_id AND p.competencia = r.competencia AND p.status = 'aceito')`;
}

const FROM_REMUN_SEM_EVENTO = (tipo) => `
  FROM esocial_remuneracoes r
  JOIN (SELECT ? AS amb) e_amb
  WHERE r.competencia = ?
    AND NOT EXISTS (SELECT 1 FROM esocial_eventos e WHERE e.tipo = ? AND e.ambiente = e_amb.amb
                    AND e.candidato_id = r.candidato_id AND e.competencia = r.competencia)
    AND ${condicaoPreRequisito(tipo)}`;

/** Ids de remunerações ainda sem nenhuma tentativa do tipo e com pré-requisito cumprido. */
export async function listarIdsRemuneracaoSemEvento(tipo, competencia, ambiente, limite) {
  const [linhas] = await pool.query(
    `SELECT r.candidato_id AS id ${FROM_REMUN_SEM_EVENTO(tipo)} ORDER BY r.candidato_id LIMIT ?`,
    [ambiente, competencia, tipo, limite]
  );
  return linhas.map((l) => l.id);
}

export async function contarRemuneracaoSemEvento(tipo, competencia, ambiente) {
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total ${FROM_REMUN_SEM_EVENTO(tipo)}`,
    [ambiente, competencia, tipo]
  );
  return Number(total);
}

/** Pagamentos (S-1210) cuja data de pagamento cai no mês informado, de qualquer competência. */
export async function listarPagamentosDoPeriodo(perApur, ambiente) {
  const [linhas] = await pool.query(
    `SELECT r.id, r.competencia, r.candidato_id, c.nome, c.matricula, c.tipo_contratacao,
            DATE_FORMAT(r.data_pagamento, '%Y-%m-%d') AS data_pagamento,
            e.status AS s1210_status
     FROM esocial_remuneracoes r
     JOIN ra_candidatos c ON c.id = r.candidato_id
     LEFT JOIN esocial_eventos e ON e.id = (
       SELECT MAX(y.id) FROM esocial_eventos y WHERE y.tipo = 'S-1210' AND y.ambiente = ?
         AND y.candidato_id = r.candidato_id AND y.competencia = r.competencia)
     WHERE DATE_FORMAT(r.data_pagamento, '%Y-%m') = ?`,
    [ambiente, perApur]
  );
  return linhas;
}

// ── Eventos e lotes ───────────────────────────────────────────────────────────

/** Última tentativa de um tipo de evento para o cooperado (opcionalmente por competência). */
export async function buscarUltimoEvento({ tipo, ambiente, candidatoId, competencia }) {
  const [[ev]] = await pool.query(
    `SELECT * FROM esocial_eventos
     WHERE tipo = ? AND ambiente = ? AND candidato_id <=> ? AND competencia <=> ?
     ORDER BY id DESC LIMIT 1`,
    [tipo, ambiente, candidatoId ?? null, competencia ?? null]
  );
  return ev ?? null;
}

/** Último evento ACEITO (para retificação, que exige o recibo do original). */
export async function buscarUltimoEventoAceito({ tipo, ambiente, candidatoId, competencia }) {
  const [[ev]] = await pool.query(
    `SELECT * FROM esocial_eventos
     WHERE tipo = ? AND ambiente = ? AND candidato_id <=> ? AND competencia <=> ? AND status = 'aceito'
     ORDER BY id DESC LIMIT 1`,
    [tipo, ambiente, candidatoId ?? null, competencia ?? null]
  );
  return ev ?? null;
}

export async function inserirEvento(ev) {
  const [r] = await pool.query(
    `INSERT INTO esocial_eventos
       (evento_id, ambiente, tipo, candidato_id, competencia, per_apur, remuneracao_id, lote_id, ind_retif,
        status, desc_resposta, ocorrencias_json, nr_recibo, xml_evento, origem, enviado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [ev.eventoId ?? null, ev.ambiente, ev.tipo, ev.candidatoId ?? null, ev.competencia ?? null, ev.perApur ?? null,
      ev.remuneracaoId ?? null, ev.loteId ?? null, ev.indRetif ?? 1, ev.status, ev.descResposta ?? null,
      ev.ocorrencias ? JSON.stringify(ev.ocorrencias) : null, ev.nrRecibo ?? null, ev.xml ?? null,
      ev.origem ?? 'sistema', ev.usuarioNome ?? null]
  );
  return r.insertId;
}

export async function criarLote({ ambiente, grupo, tipo, competencia, qtd, usuarioNome }) {
  const [r] = await pool.query(
    `INSERT INTO esocial_lotes (ambiente, grupo, tipo_evento, competencia, qtd_eventos, status, enviado_por_nome)
     VALUES (?, ?, ?, ?, ?, 'enviando', ?)`,
    [ambiente, grupo, tipo, competencia ?? null, qtd, usuarioNome]
  );
  return r.insertId;
}

export async function registrarRetornoEnvioLote(loteId, ret) {
  const status = ret.aceito ? 'enviado' : 'erro_envio';
  await pool.query(
    `UPDATE esocial_lotes SET status = ?, protocolo = ?, cd_resposta = ?, desc_resposta = ?, ocorrencias_json = ?,
       xml_retorno_envio = ?, enviado_em = NOW()
     WHERE id = ?`,
    [status, ret.protocolo, ret.cdResposta, ret.descResposta, JSON.stringify(ret.ocorrencias ?? []), ret.xmlRetorno ?? null, loteId]
  );
  if (ret.aceito) {
    await pool.query(`UPDATE esocial_eventos SET status = 'enviado' WHERE lote_id = ? AND status = 'enviando'`, [loteId]);
  } else {
    await pool.query(
      `UPDATE esocial_eventos SET status = 'erro_envio', cd_resposta = ?, desc_resposta = ?, ocorrencias_json = ?
       WHERE lote_id = ? AND status = 'enviando'`,
      [ret.cdResposta, ret.descResposta || 'Lote não recebido pelo eSocial.', JSON.stringify(ret.ocorrencias ?? []), loteId]
    );
  }
}

export async function listarLotesAguardandoRetorno(ambiente, limite) {
  const [linhas] = await pool.query(
    `SELECT * FROM esocial_lotes
     WHERE status = 'enviado' AND ambiente = ?
       AND (ultima_consulta_em IS NULL OR ultima_consulta_em < (NOW() - INTERVAL 5 SECOND))
     ORDER BY COALESCE(ultima_consulta_em, enviado_em) ASC LIMIT ?`,
    [ambiente, limite]
  );
  return linhas;
}

export async function contarLotesAguardandoRetorno(ambiente) {
  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM esocial_lotes WHERE status = 'enviado' AND ambiente = ?`, [ambiente]
  );
  return Number(total);
}

export async function registrarConsultaSemResultado(loteId, ret) {
  await pool.query(
    `UPDATE esocial_lotes SET tentativas_consulta = tentativas_consulta + 1, ultima_consulta_em = NOW(),
       cd_resposta = COALESCE(?, cd_resposta), desc_resposta = COALESCE(?, desc_resposta)
     WHERE id = ?`,
    [ret?.cdResposta ?? null, ret?.descResposta ?? null, loteId]
  );
}

/** Aplica o resultado da consulta: atualiza cada evento do lote e encerra o lote. */
export async function registrarProcessamentoLote(loteId, ret) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const porId = new Map(ret.eventos.map((e) => [e.id, e]));
    const [eventos] = await conn.query(`SELECT id, evento_id FROM esocial_eventos WHERE lote_id = ?`, [loteId]);
    for (const ev of eventos) {
      const r = porId.get(ev.evento_id);
      if (r) {
        await conn.query(
          `UPDATE esocial_eventos SET status = ?, cd_resposta = ?, desc_resposta = ?, ocorrencias_json = ?,
             nr_recibo = ?, totalizadores_json = ?
           WHERE id = ?`,
          [r.aceito ? 'aceito' : 'rejeitado', r.cdResposta, r.descResposta, JSON.stringify(r.ocorrencias),
            r.nrRecibo, r.totalizadores.length ? JSON.stringify(r.totalizadores) : null, ev.id]
        );
      } else {
        // Lote rejeitado por inteiro: o motivo está no status do lote
        await conn.query(
          `UPDATE esocial_eventos SET status = 'rejeitado', cd_resposta = ?, desc_resposta = ?, ocorrencias_json = ?
           WHERE id = ?`,
          [ret.cdResposta, ret.descResposta || 'Evento não processado pelo eSocial.', JSON.stringify(ret.ocorrencias ?? []), ev.id]
        );
      }
    }
    await conn.query(
      `UPDATE esocial_lotes SET status = ?, cd_resposta = ?, desc_resposta = ?, ocorrencias_json = ?,
         xml_retorno_consulta = ?, processado_em = NOW(), ultima_consulta_em = NOW(),
         tentativas_consulta = tentativas_consulta + 1
       WHERE id = ?`,
      [ret.falha ? 'erro_processamento' : 'processado', ret.cdResposta, ret.descResposta,
        JSON.stringify(ret.ocorrencias ?? []), ret.xmlRetorno ?? null, loteId]
    );
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function buscarEventosDoLote(loteId) {
  const [linhas] = await pool.query(`SELECT * FROM esocial_eventos WHERE lote_id = ?`, [loteId]);
  return linhas;
}

export async function listarLotes(ambiente, { limite = 50 } = {}) {
  const [linhas] = await pool.query(
    `SELECT l.id, l.grupo, l.tipo_evento, l.competencia, l.qtd_eventos, l.status, l.protocolo, l.cd_resposta,
            l.desc_resposta, l.enviado_em, l.processado_em, l.enviado_por_nome, l.criado_em,
            SUM(e.status = 'aceito') AS aceitos, SUM(e.status = 'rejeitado') AS rejeitados
     FROM esocial_lotes l
     LEFT JOIN esocial_eventos e ON e.lote_id = l.id
     WHERE l.ambiente = ?
     GROUP BY l.id
     ORDER BY l.id DESC LIMIT ?`,
    [ambiente, limite]
  );
  return linhas;
}

/** Histórico completo de tentativas de um cooperado (todos os tipos). */
export async function listarHistoricoCooperado(candidatoId, ambiente) {
  const [linhas] = await pool.query(
    `SELECT e.id, e.evento_id, e.tipo, e.competencia, e.per_apur, e.ind_retif, e.status, e.cd_resposta,
            e.desc_resposta, e.ocorrencias_json, e.nr_recibo, e.origem, e.enviado_por_nome, e.criado_em,
            e.atualizado_em, e.lote_id, l.protocolo
     FROM esocial_eventos e
     LEFT JOIN esocial_lotes l ON l.id = e.lote_id
     WHERE e.candidato_id = ? AND e.ambiente = ?
     ORDER BY e.id DESC`,
    [candidatoId, ambiente]
  );
  return linhas;
}

export async function buscarEventoPorId(id) {
  const [[ev]] = await pool.query(`SELECT * FROM esocial_eventos WHERE id = ?`, [id]);
  return ev ?? null;
}

// ── Competências ──────────────────────────────────────────────────────────────

export async function obterCompetencia(competencia, ambiente) {
  const [[c]] = await pool.query(
    `SELECT * FROM esocial_competencias WHERE competencia = ? AND ambiente = ?`, [competencia, ambiente]
  );
  return c ?? { competencia, ambiente, status: 'aberta' };
}

export async function atualizarCompetencia(competencia, ambiente, campos) {
  const nomes = Object.keys(campos);
  await pool.query(
    `INSERT INTO esocial_competencias (competencia, ambiente, ${nomes.join(', ')})
     VALUES (?, ?, ${nomes.map(() => '?').join(', ')})
     ON DUPLICATE KEY UPDATE ${nomes.map((n) => `${n} = VALUES(${n})`).join(', ')}`,
    [competencia, ambiente, ...nomes.map((n) => campos[n])]
  );
}

export async function listarCompetencias(ambiente) {
  const [linhas] = await pool.query(
    `SELECT x.competencia, COALESCE(c.status, 'aberta') AS status, c.fechada_em, c.inss_apurado, c.irrf_apurado
     FROM (SELECT DISTINCT competencia FROM esocial_remuneracoes
           UNION SELECT competencia FROM esocial_competencias WHERE ambiente = ?) x
     LEFT JOIN esocial_competencias c ON c.competencia = x.competencia AND c.ambiente = ?
     ORDER BY x.competencia DESC`,
    [ambiente, ambiente]
  );
  return linhas;
}

/** Existe algum evento aceito do tipo no período de apuração? (indicadores do S-1299) */
export async function existeEventoAceitoNoPeriodo(tipo, ambiente, perApur) {
  const [[r]] = await pool.query(
    `SELECT 1 AS ok FROM esocial_eventos WHERE tipo = ? AND ambiente = ? AND per_apur = ? AND status = 'aceito' LIMIT 1`,
    [tipo, ambiente, perApur]
  );
  return !!r;
}

/** Trava distribuída simples (MySQL GET_LOCK) para evitar dois envios simultâneos. */
export async function comTrava(nome, fn) {
  const conn = await pool.getConnection();
  try {
    const [[{ ok }]] = await conn.query(`SELECT GET_LOCK(?, 0) AS ok`, [nome]);
    if (Number(ok) !== 1) {
      const e = new Error('Já existe um envio ao eSocial em andamento. Aguarde alguns segundos e tente novamente.');
      e.status = 409;
      throw e;
    }
    try {
      return await fn();
    } finally {
      await conn.query(`SELECT RELEASE_LOCK(?)`, [nome]).catch(() => { });
    }
  } finally {
    conn.release();
  }
}
