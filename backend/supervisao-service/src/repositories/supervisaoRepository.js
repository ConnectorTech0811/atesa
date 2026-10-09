import { pool } from '../config/database.js';
import { dataLocalISO } from '../../../shared/src/datas.js';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { enviarEmail } from '../../../shared/src/email.js';

// ── Inicialização de Estruturas no Banco de Dados ───────────────────────────
export async function inicializarTabelasSupervisao() {
  try {
    // 1. Tabela de Auditoria Imutável dos Apontamentos e Supervisão
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supervisao_auditoria_apontamentos (
        id INT AUTO_INCREMENT PRIMARY KEY,
        apontamento_id INT NOT NULL,
        candidato_id INT NOT NULL,
        candidato_nome VARCHAR(200) NOT NULL,
        usuario_id INT NOT NULL,
        usuario_nome VARCHAR(150) NOT NULL,
        usuario_perfil VARCHAR(50) NOT NULL,
        acao ENUM('criacao','edicao','inclusao_observacao','ajuste') NOT NULL,
        campo VARCHAR(100) NULL,
        valor_anterior TEXT NULL,
        valor_novo TEXT NULL,
        motivo TEXT NULL,
        ip VARCHAR(45) NULL,
        origem VARCHAR(50) NOT NULL DEFAULT 'web_supervisao',
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sup_aud_apont (apontamento_id),
        INDEX idx_sup_aud_cand (candidato_id),
        INDEX idx_sup_aud_data (criado_em)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 2. Tabela de Horas Complementares e Bonificações (2ª Entrega)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supervisao_horas_complementares (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        alocacao_id INT NULL,
        data_referencia DATE NOT NULL,
        tipo ENUM('hora_adicional', 'hora_extra', 'adicional_noturno', 'desconto', 'bonificacao') NOT NULL,
        quantidade_horas DECIMAL(5,2) NULL,
        quantidade_minutos INT NULL,
        valor DECIMAL(10,2) NULL DEFAULT 0,
        motivo VARCHAR(255) NOT NULL,
        observacao TEXT NULL,
        criado_por_id INT NOT NULL,
        criado_por_nome VARCHAR(150) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_shc_cand (candidato_id),
        INDEX idx_shc_data (data_referencia),
        INDEX idx_shc_tipo (tipo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 3. Tabela de Histórico de Alterações de Operação (Vaga, Turno, Atividade)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supervisao_historico_operacao (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        alocacao_id INT NOT NULL,
        tipo_alteracao ENUM('vaga', 'atividade', 'turno', 'tempo', 'operacao') NOT NULL,
        vaga_anterior_id INT NULL,
        vaga_anterior_nome VARCHAR(200) NULL,
        vaga_nova_id INT NULL,
        vaga_nova_nome VARCHAR(200) NULL,
        turno_anterior VARCHAR(100) NULL,
        turno_novo VARCHAR(100) NULL,
        atividade_anterior VARCHAR(200) NULL,
        atividade_nova VARCHAR(200) NULL,
        motivo TEXT NOT NULL,
        usuario_id INT NOT NULL,
        usuario_nome VARCHAR(150) NOT NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sho_cand (candidato_id),
        INDEX idx_sho_aloc (alocacao_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 4. Tabela de Solicitações de Reset de Senha de Cooperado
    await pool.query(`
      CREATE TABLE IF NOT EXISTS supervisao_reset_senhas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        candidato_id INT NOT NULL,
        codigo VARCHAR(10) NOT NULL,
        expira_em DATETIME NOT NULL,
        tentativas INT NOT NULL DEFAULT 0,
        utilizado TINYINT(1) NOT NULL DEFAULT 0,
        solicitado_por_id INT NOT NULL,
        solicitado_por_nome VARCHAR(150) NOT NULL,
        utilizado_em DATETIME NULL,
        criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_srs_cand (candidato_id),
        INDEX idx_srs_cod (codigo)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 5. Colunas complementares para ra_apontamentos
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN observacao_original TEXT NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN observacao_ajuste TEXT NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN status VARCHAR(50) NOT NULL DEFAULT 'normal'`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN ajustado TINYINT(1) NOT NULL DEFAULT 0`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN ajustado_por_id INT NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN ajustado_por_nome VARCHAR(150) NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN ajustado_em DATETIME NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN motivo_ajuste TEXT NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN data_original DATE NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN timestamp_original DATETIME NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN tipo_evento_original VARCHAR(50) NULL`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN origem VARCHAR(50) NOT NULL DEFAULT 'app'`); } catch {}
    try { await pool.query(`ALTER TABLE ra_apontamentos ADD COLUMN atividade VARCHAR(150) NULL`); } catch {}

    // 6. Coluna de hierarquia em usuarios
    try { await pool.query(`ALTER TABLE usuarios ADD COLUMN superior_id INT NULL`); } catch {}

    // 7. Sincronização inicial de apontamentos existentes na trilha de auditoria
    try {
      await pool.query(`
        INSERT INTO supervisao_auditoria_apontamentos
          (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, ip, origem, criado_em)
        SELECT 
          ap.id,
          ap.candidato_id,
          COALESCE(c.nome, 'Cooperado'),
          ap.candidato_id,
          COALESCE(c.nome, 'Cooperado'),
          'cooperado',
          'criacao',
          'apontamento_ponto',
          NULL,
          ap.tipo_evento,
          COALESCE(ap.observacao, CONCAT('Registro efetuado no App (', ap.tipo_evento, ')')),
          ap.ip_sincronizacao,
          'app_cooperado',
          ap.timestamp_dispositivo
        FROM ra_apontamentos ap
        JOIN ra_candidatos c ON c.id = ap.candidato_id
        LEFT JOIN supervisao_auditoria_apontamentos aud ON aud.apontamento_id = ap.id AND aud.acao = 'criacao'
        WHERE aud.id IS NULL
      `);
    } catch (eBackfill) {
      console.warn('[supervisaoRepository] Aviso ao sincronizar auditoria inicial:', eBackfill?.message);
    }

  } catch (err) {
    console.error('[supervisaoRepository] Erro na inicialização das tabelas:', err?.message);
  }
}

// Inicializa na carga do módulo
inicializarTabelasSupervisao().catch(() => {});

// ── Funções Auxiliares de Cálculo de Horas ───────────────────────────────────
function calcularHorasDosApontamentos(apontamentos = []) {
  if (!apontamentos || apontamentos.length === 0) return { totalMinutos: 0, totalFormatado: '00:00' };

  const porData = {};
  for (const ap of apontamentos) {
    const dt = ap.data_referencia ? String(ap.data_referencia).slice(0, 10) : 'indefinida';
    if (!porData[dt]) porData[dt] = [];
    porData[dt].push(ap);
  }

  let totalMinutosGeral = 0;

  for (const dt of Object.keys(porData)) {
    const bats = porData[dt].sort((a, b) => new Date(a.timestamp_dispositivo) - new Date(b.timestamp_dispositivo));
    const jIni = bats.find(b => b.tipo_evento === 'jornada_inicio');
    const jFim = bats.find(b => b.tipo_evento === 'jornada_fim');
    const rIni = bats.find(b => b.tipo_evento === 'refeicao_inicio');
    const rFim = bats.find(b => b.tipo_evento === 'refeicao_fim');

    if (jIni && jFim) {
      const diffMs = new Date(jFim.timestamp_dispositivo) - new Date(jIni.timestamp_dispositivo);
      let mins = Math.max(0, Math.floor(diffMs / 60000));
      if (rIni && rFim) {
        const refMs = new Date(rFim.timestamp_dispositivo) - new Date(rIni.timestamp_dispositivo);
        const refMins = Math.max(0, Math.floor(refMs / 60000));
        mins = Math.max(0, mins - refMins);
      }
      totalMinutosGeral += mins;
    }
  }

  const horas = Math.floor(totalMinutosGeral / 60);
  const minutos = totalMinutosGeral % 60;
  const totalFormatado = `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;

  return { totalMinutos: totalMinutosGeral, totalFormatado };
}

function minutosParaFormatado(minutos = 0) {
  const m = Number(minutos) || 0;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return `${String(h).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

// ── 1. Dashboard Resumo Operacional ──────────────────────────────────────────
export async function obterResumoDashboard({ periodo, dataInicio, dataFim, candidatoId, empresaId, status } = {}) {
  const hoje = dataLocalISO();
  const dataIniEfetiva = dataInicio || hoje;
  const dataFimEfetiva = dataFim || hoje;

  // 1. Total de cooperados ativos no sistema
  const [[{ totalCooperadosAtivos }]] = await pool.query(
    `SELECT COUNT(*) AS totalCooperadosAtivos FROM ra_candidatos WHERE status = 1`
  );

  // 2. Cooperados com apontamento hoje / no período
  let sqlEmAtividade = `
    SELECT COUNT(DISTINCT candidato_id) AS totalEmAtividade
    FROM ra_apontamentos
    WHERE data_referencia >= ? AND data_referencia <= ?
  `;
  const paramsEmAtiv = [dataIniEfetiva, dataFimEfetiva];
  if (candidatoId) {
    sqlEmAtividade += ` AND candidato_id = ?`;
    paramsEmAtiv.push(candidatoId);
  }
  const [[{ totalEmAtividade }]] = await pool.query(sqlEmAtividade, paramsEmAtiv);

  const cooperadosSemAtividade = Math.max(0, Number(totalCooperadosAtivos) - Number(totalEmAtividade));

  // 3. Total de apontamentos no período e apontamentos ajustados
  let sqlApontamentos = `
    SELECT *
    FROM ra_apontamentos
    WHERE (data_referencia >= ? AND data_referencia <= ?)
       OR (ajustado = 1 AND DATE(ajustado_em) >= ? AND DATE(ajustado_em) <= ?)
  `;
  const paramsApont = [dataIniEfetiva, dataFimEfetiva, dataIniEfetiva, dataFimEfetiva];
  if (candidatoId) {
    sqlApontamentos += ` AND candidato_id = ?`;
    paramsApont.push(candidatoId);
  }
  const [apontamentosPeriodo] = await pool.query(sqlApontamentos, paramsApont);

  const totalApontamentos = apontamentosPeriodo.length;
  const apontamentosAjustados = apontamentosPeriodo.filter(a => a.ajustado === 1 || (a.status && a.status.toLowerCase() === 'ajustado')).length;
  const apontamentosDivergentes = apontamentosPeriodo.filter(a => a.status && a.status.toLowerCase() === 'divergente').length;
  const apontamentosPendentes = apontamentosPeriodo.filter(a => a.status && a.status.toLowerCase() === 'pendente').length;

  // 4. Cálculo de horas trabalhadas no período
  const { totalFormatado: horasTrabalhadasFormatadas, totalMinutos: horasTrabalhadasMinutos } = calcularHorasDosApontamentos(apontamentosPeriodo);

  // 5. Totais de Horas Complementares e Bonificações (2ª Entrega)
  let sqlCompl = `
    SELECT tipo, 
           SUM(COALESCE(quantidade_minutos, quantidade_horas * 60, 0)) AS totalMinutos,
           SUM(COALESCE(valor, 0)) AS totalValor
    FROM supervisao_horas_complementares
    WHERE data_referencia >= ? AND data_referencia <= ?
  `;
  const paramsCompl = [dataIniEfetiva, dataFimEfetiva];
  if (candidatoId) {
    sqlCompl += ` AND candidato_id = ?`;
    paramsCompl.push(candidatoId);
  }
  sqlCompl += ` GROUP BY tipo`;
  const [rowsCompl] = await pool.query(sqlCompl, paramsCompl).catch(() => [[]]);

  let minutosAdicionais = 0;
  let minutosNoturno = 0;
  let minutosDesconto = 0;
  let valorBonificacoes = 0;

  for (const c of rowsCompl) {
    const mins = Number(c.totalMinutos) || 0;
    if (c.tipo === 'hora_adicional' || c.tipo === 'hora_extra') minutosAdicionais += mins;
    if (c.tipo === 'adicional_noturno') minutosNoturno += mins;
    if (c.tipo === 'desconto') minutosDesconto += mins;
    if (c.tipo === 'bonificacao') valorBonificacoes += Number(c.totalValor) || 0;
  }

  return {
    periodo: { dataInicio: dataIniEfetiva, dataFim: dataFimEfetiva },
    cards: {
      totalCooperadosAtivos: Number(totalCooperadosAtivos) || 0,
      cooperadosEmAtividade: Number(totalEmAtividade) || 0,
      cooperadosSemAtividade,
      totalApontamentos,
      apontamentosAjustados,
      apontamentosDivergentes,
      apontamentosPendentes,
      horasTrabalhadasHoje: horasTrabalhadasFormatadas,
      horasTrabalhadasMinutos,
      horasAdicionais: minutosParaFormatado(minutosAdicionais),
      adicionalNoturno: minutosParaFormatado(minutosNoturno),
      descontoHoras: minutosParaFormatado(minutosDesconto),
      bonificacoesTotal: valorBonificacoes,
    },
  };
}

// ── 2. Listagem de Cooperados para Monitoramento ─────────────────────────────
export async function listarCooperadosMonitoramento({ busca, status, empresaId, vagaId, dataInicio, dataFim, limite = 100, pagina = 1 } = {}) {
  const hoje = dataLocalISO();
  const dataIniEfetiva = dataInicio || hoje;
  const dataFimEfetiva = dataFim || hoje;

  let sql = `
    SELECT 
      c.id,
      c.nome,
      c.cpf,
      c.email,
      c.telefone,
      c.whatsapp,
      c.matricula,
      c.status AS status_candidato,
      c.cooperativa,
      
      -- Alocação vigente
      a.id AS alocacao_id,
      a.data_inicio AS alocacao_data_inicio,
      a.data_fim AS alocacao_data_fim,
      a.status AS alocacao_status,
      
      -- Empresa / Tomador
      emp.id AS empresa_id,
      COALESCE(emp.nome_empresa, 'Não alocado') AS empresa_nome,
      
      -- Unidade
      pu.id AS unidade_id,
      pu.nome_unidade,
      
      -- Vaga
      pv.id AS vaga_id,
      pv.cargo AS vaga_cargo,
      pv.tipo_escala AS vaga_escala,
      pv.salario_base,
      
      -- Último apontamento registrado
      (
        SELECT JSON_OBJECT(
          'id', ap_last.id,
          'data_referencia', ap_last.data_referencia,
          'tipo_evento', ap_last.tipo_evento,
          'timestamp_dispositivo', ap_last.timestamp_dispositivo,
          'observacao', ap_last.observacao,
          'status', ap_last.status,
          'ajustado', ap_last.ajustado
        )
        FROM ra_apontamentos ap_last
        WHERE ap_last.candidato_id = c.id
        ORDER BY ap_last.timestamp_dispositivo DESC
        LIMIT 1
      ) AS ultimo_apontamento_json,

      -- Total de apontamentos e ajustes no período
      (
        SELECT COUNT(*)
        FROM ra_apontamentos ap_p
        WHERE ap_p.candidato_id = c.id
          AND ap_p.data_referencia >= ? AND ap_p.data_referencia <= ?
      ) AS total_apontamentos_periodo,

      (
        SELECT COUNT(*)
        FROM ra_apontamentos ap_aj
        WHERE ap_aj.candidato_id = c.id
          AND ap_aj.ajustado = 1
          AND ap_aj.data_referencia >= ? AND ap_aj.data_referencia <= ?
      ) AS total_ajustes_periodo

    FROM ra_candidatos c
    LEFT JOIN ra_alocacoes a ON a.candidato_id = c.id AND a.status = 'ativa'
    LEFT JOIN empresas emp ON emp.id = a.empresa_id
    LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
    LEFT JOIN parametro_vagas pv ON pv.id = a.vaga_id
    WHERE 1=1
  `;

  const params = [dataIniEfetiva, dataFimEfetiva, dataIniEfetiva, dataFimEfetiva];

  if (busca && busca.trim()) {
    const raw = busca.trim();
    const termo = `%${raw}%`;
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 3) {
      const cpfLimpo = `%${digits}%`;
      sql += ` AND (c.nome LIKE ? OR c.cpf LIKE ? OR REPLACE(REPLACE(REPLACE(c.cpf, '.', ''), '-', ''), ' ', '') LIKE ? OR c.matricula LIKE ?)`;
      params.push(termo, termo, cpfLimpo, termo);
    } else {
      sql += ` AND (c.nome LIKE ? OR c.matricula LIKE ?)`;
      params.push(termo, termo);
    }
  }

  if (status !== undefined && status !== '') {
    sql += ` AND c.status = ?`;
    params.push(Number(status));
  }

  if (empresaId) {
    sql += ` AND a.empresa_id = ?`;
    params.push(Number(empresaId));
  }

  if (vagaId) {
    sql += ` AND a.vaga_id = ?`;
    params.push(Number(vagaId));
  }

  sql += ` GROUP BY c.id ORDER BY c.nome ASC`;

  const offset = (Math.max(1, Number(pagina)) - 1) * Number(limite);
  sql += ` LIMIT ? OFFSET ?`;
  params.push(Number(limite), Number(offset));

  const [rows] = await pool.query(sql, params);

  return rows.map(r => {
    let ultimoApontamento = null;
    if (r.ultimo_apontamento_json) {
      try {
        ultimoApontamento = typeof r.ultimo_apontamento_json === 'string'
          ? JSON.parse(r.ultimo_apontamento_json)
          : r.ultimo_apontamento_json;
      } catch {}
    }

    const estaEmAtividadeHoje = Number(r.total_apontamentos_periodo) > 0;

    return {
      id: r.id,
      nome: r.nome,
      cpf: r.cpf,
      email: r.email,
      telefone: r.telefone,
      whatsapp: r.whatsapp,
      matricula: r.matricula,
      statusCandidato: r.status_candidato,
      cooperativa: r.cooperativa,
      alocacao: r.alocacao_id ? {
        id: r.alocacao_id,
        empresaId: r.empresa_id,
        empresaNome: r.empresa_nome,
        unidadeId: r.unidade_id,
        unidadeNome: r.nome_unidade,
        vagaId: r.vaga_id,
        vagaCargo: r.vaga_cargo,
        vagaEscala: r.vaga_escala,
        salarioBase: r.salario_base,
        dataInicio: r.alocacao_data_inicio,
        dataFim: r.alocacao_data_fim,
        status: r.alocacao_status,
      } : null,
      ultimoApontamento,
      totalApontamentosPeriodo: Number(r.total_apontamentos_periodo) || 0,
      totalAjustesPeriodo: Number(r.total_ajustes_periodo) || 0,
      situacao: estaEmAtividadeHoje ? 'em_atividade' : (r.status_candidato === 1 ? 'ativo' : 'inativo'),
    };
  });
}

// ── 3. Detalhes do Cooperado e Monitoramento Individual ───────────────────────
export async function obterDetalhesCooperadoMonitoramento(candidatoId, { dataInicio, dataFim } = {}) {
  const [[cand]] = await pool.query(
    `SELECT 
       c.*,
       a.id AS alocacao_id,
       a.data_inicio AS alocacao_data_inicio,
       a.data_fim AS alocacao_data_fim,
       a.status AS alocacao_status,
       emp.id AS empresa_id,
       COALESCE(emp.nome_empresa, 'Não alocado') AS empresa_nome,
       pu.id AS unidade_id,
       pu.nome_unidade,
       pv.id AS vaga_id,
       pv.cargo AS vaga_cargo,
       pv.tipo_escala AS vaga_escala,
       pv.salario_base
     FROM ra_candidatos c
     LEFT JOIN ra_alocacoes a ON a.candidato_id = c.id AND a.status = 'ativa'
     LEFT JOIN empresas emp ON emp.id = a.empresa_id
     LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
     LEFT JOIN parametro_vagas pv ON pv.id = a.vaga_id
     WHERE c.id = ?`,
    [candidatoId]
  );

  if (!cand) return null;

  // Busca apontamentos do período
  let sqlApontamentos = `
    SELECT 
      ap.*,
      pv.cargo AS vaga_cargo,
      emp.nome_empresa AS empresa_nome
    FROM ra_apontamentos ap
    LEFT JOIN parametro_vagas pv ON pv.id = ap.vaga_id
    LEFT JOIN ra_alocacoes a ON a.id = ap.alocacao_id
    LEFT JOIN empresas emp ON emp.id = a.empresa_id
    WHERE ap.candidato_id = ?
  `;
  const paramsApont = [candidatoId];

  if (dataInicio) {
    sqlApontamentos += ` AND ap.data_referencia >= ?`;
    paramsApont.push(dataInicio);
  }
  if (dataFim) {
    sqlApontamentos += ` AND ap.data_referencia <= ?`;
    paramsApont.push(dataFim);
  }

  sqlApontamentos += ` ORDER BY ap.timestamp_dispositivo DESC`;
  const [apontamentos] = await pool.query(sqlApontamentos, paramsApont);

  // Busca complementos de horas e bonificações
  let sqlCompl = `
    SELECT * FROM supervisao_horas_complementares 
    WHERE candidato_id = ?
  `;
  const paramsCompl = [candidatoId];
  if (dataInicio) { sqlCompl += ` AND data_referencia >= ?`; paramsCompl.push(dataInicio); }
  if (dataFim) { sqlCompl += ` AND data_referencia <= ?`; paramsCompl.push(dataFim); }
  sqlCompl += ` ORDER BY data_referencia DESC, criado_em DESC`;
  const [complementos] = await pool.query(sqlCompl, paramsCompl).catch(() => [[]]);

  // Busca histórico de alterações da operação
  const [historicoOperacao] = await pool.query(
    `SELECT * FROM supervisao_historico_operacao WHERE candidato_id = ? ORDER BY criado_em DESC`,
    [candidatoId]
  ).catch(() => [[]]);

  // Busca auditoria específica do cooperado
  const [logsAuditoria] = await pool.query(
    `SELECT * FROM supervisao_auditoria_apontamentos 
     WHERE candidato_id = ? 
     ORDER BY criado_em DESC 
     LIMIT 50`,
    [candidatoId]
  );

  // Cálculo das horas trabalhadas
  const { totalFormatado: totalHoras, totalMinutos } = calcularHorasDosApontamentos(apontamentos);
  const totalAjustes = apontamentos.filter(a => a.ajustado === 1).length;

  // Totalizadores de complementos
  let minutosAdicionais = 0;
  let minutosNoturno = 0;
  let minutosDesconto = 0;
  let valorBonificacoes = 0;

  for (const c of complementos) {
    const mins = Number(c.quantidade_minutos) || (Number(c.quantidade_horas) * 60) || 0;
    if (c.tipo === 'hora_adicional' || c.tipo === 'hora_extra') minutosAdicionais += mins;
    if (c.tipo === 'adicional_noturno') minutosNoturno += mins;
    if (c.tipo === 'desconto') minutosDesconto += mins;
    if (c.tipo === 'bonificacao') valorBonificacoes += Number(c.valor) || 0;
  }

  return {
    cooperado: {
      id: cand.id,
      nome: cand.nome,
      cpf: cand.cpf,
      email: cand.email,
      telefone: cand.telefone,
      whatsapp: cand.whatsapp,
      matricula: cand.matricula,
      status: cand.status,
      cooperativa: cand.cooperativa,
      alocacao: cand.alocacao_id ? {
        id: cand.alocacao_id,
        empresaId: cand.empresa_id,
        empresaNome: cand.empresa_nome,
        unidadeId: cand.unidade_id,
        unidadeNome: cand.nome_unidade,
        vagaId: cand.vaga_id,
        vagaCargo: cand.vaga_cargo,
        vagaEscala: cand.vaga_escala,
        salarioBase: cand.salario_base,
        dataInicio: cand.alocacao_data_inicio,
        dataFim: cand.alocacao_data_fim,
        status: cand.alocacao_status,
      } : null,
    },
    resumo: {
      totalApontamentos: apontamentos.length,
      totalHoras,
      totalMinutos,
      totalAjustes,
      horasAdicionais: minutosParaFormatado(minutosAdicionais),
      adicionalNoturno: minutosParaFormatado(minutosNoturno),
      descontoHoras: minutosParaFormatado(minutosDesconto),
      bonificacoesTotal: valorBonificacoes,
      ultimoApontamento: apontamentos[0] || null,
    },
    apontamentos,
    complementos,
    historicoOperacao,
    logsAuditoria,
  };
}

// ── 4. Listagem Global de Apontamentos ───────────────────────────────────────
export async function listarTodosApontamentos({ busca, candidatoId, empresaId, vagaId, tipoEvento, status, apenasAjustados, dataInicio, dataFim, limite = 100, pagina = 1 } = {}) {
  let sql = `
    SELECT 
      ap.*,
      c.nome AS candidato_nome,
      c.cpf AS candidato_cpf,
      c.matricula AS candidato_matricula,
      COALESCE(emp.nome_empresa, 'Não alocado') AS empresa_nome,
      pv.cargo AS vaga_cargo,
      pu.nome_unidade
    FROM ra_apontamentos ap
    JOIN ra_candidatos c ON c.id = ap.candidato_id
    LEFT JOIN ra_alocacoes a ON a.id = ap.alocacao_id
    LEFT JOIN empresas emp ON emp.id = a.empresa_id
    LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
    LEFT JOIN parametro_vagas pv ON pv.id = ap.vaga_id
    WHERE 1=1
  `;
  const params = [];

  if (busca && busca.trim()) {
    const raw = busca.trim();
    const termo = `%${raw}%`;
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 3) {
      const cpfLimpo = `%${digits}%`;
      sql += ` AND (c.nome LIKE ? OR c.cpf LIKE ? OR REPLACE(REPLACE(REPLACE(c.cpf, '.', ''), '-', ''), ' ', '') LIKE ? OR c.matricula LIKE ?)`;
      params.push(termo, termo, cpfLimpo, termo);
    } else {
      sql += ` AND (c.nome LIKE ? OR c.matricula LIKE ?)`;
      params.push(termo, termo);
    }
  }

  if (candidatoId) {
    sql += ` AND ap.candidato_id = ?`;
    params.push(Number(candidatoId));
  }

  if (empresaId) {
    sql += ` AND a.empresa_id = ?`;
    params.push(Number(empresaId));
  }

  if (vagaId) {
    sql += ` AND ap.vaga_id = ?`;
    params.push(Number(vagaId));
  }

  if (tipoEvento) {
    if (tipoEvento === 'deslocamento_inicio' || tipoEvento === 'deslocamento') {
      sql += ` AND ap.tipo_evento IN ('deslocamento_inicio', 'a_caminho', 'deslocamento_fim')`;
    } else {
      sql += ` AND ap.tipo_evento = ?`;
      params.push(tipoEvento);
    }
  }

  if (status) {
    sql += ` AND ap.status = ?`;
    params.push(status);
  }

  if (apenasAjustados) {
    sql += ` AND ap.ajustado = 1`;
  }

  if (dataInicio) {
    sql += ` AND ap.data_referencia >= ?`;
    params.push(dataInicio);
  }

  if (dataFim) {
    sql += ` AND ap.data_referencia <= ?`;
    params.push(dataFim);
  }

  sql += ` ORDER BY ap.timestamp_dispositivo DESC`;

  const offset = (Math.max(1, Number(pagina)) - 1) * Number(limite);
  sql += ` LIMIT ? OFFSET ?`;
  params.push(Number(limite), Number(offset));

  const [rows] = await pool.query(sql, params);
  return rows;
}

// ── 5. Buscar Apontamento por ID ────────────────────────────────────────────
export async function obterApontamentoPorId(id) {
  const [[row]] = await pool.query(
    `SELECT 
       ap.*,
       c.nome AS candidato_nome,
       c.cpf AS candidato_cpf,
       c.matricula AS candidato_matricula,
       COALESCE(emp.nome_empresa, 'Não alocado') AS empresa_nome,
       pv.cargo AS vaga_cargo,
       pu.nome_unidade
     FROM ra_apontamentos ap
     JOIN ra_candidatos c ON c.id = ap.candidato_id
     LEFT JOIN ra_alocacoes a ON a.id = ap.alocacao_id
     LEFT JOIN empresas emp ON emp.id = a.empresa_id
     LEFT JOIN parametro_unidades pu ON pu.id = a.unidade_id
     LEFT JOIN parametro_vagas pv ON pv.id = ap.vaga_id
     WHERE ap.id = ?`,
    [id]
  );
  return row || null;
}

// ── 6. Edição de Apontamento com Regra AJUSTE e Auditoria Completa ──────────
export async function editarApontamento(id, dadosEdicao, usuarioLogado, ip = null) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[apAnterior]] = await conexao.query(
      `SELECT ap.*, c.nome AS candidato_nome, c.cpf AS candidato_cpf, c.email AS candidato_email
       FROM ra_apontamentos ap
       JOIN ra_candidatos c ON c.id = ap.candidato_id
       WHERE ap.id = ? FOR UPDATE`,
      [id]
    );

    if (!apAnterior) {
      throw new Error('Apontamento não encontrado.');
    }

    // Bloqueio de auto-edição para administrador
    if (usuarioLogado.tipoUsuario === 'administrador') {
      const candCpfLimpo = String(apAnterior.candidato_cpf || '').replace(/\D/g, '');
      const userCpfLimpo = String(usuarioLogado.cpf || '').replace(/\D/g, '');
      const candEmailLimpo = String(apAnterior.candidato_email || '').trim().toLowerCase();
      const userEmailLimpo = String(usuarioLogado.email || '').trim().toLowerCase();

      const ehOMesmoRegistro = (candCpfLimpo && userCpfLimpo && candCpfLimpo === userCpfLimpo) ||
                               (candEmailLimpo && userEmailLimpo && candEmailLimpo === userEmailLimpo) ||
                               (usuarioLogado.candidatoId && Number(usuarioLogado.candidatoId) === Number(apAnterior.candidato_id));

      if (ehOMesmoRegistro) {
        throw new Error('Um administrador não pode editar o próprio registro de apontamento. Apenas seu superior imediato ou a Supervisão pode realizar esta alteração.');
      }
    }

    const dataOriginal = apAnterior.data_original || apAnterior.data_referencia;
    const timestampOriginal = apAnterior.timestamp_original || apAnterior.timestamp_dispositivo;
    const tipoEventoOriginal = apAnterior.tipo_evento_original || apAnterior.tipo_evento;
    const observacaoOriginal = apAnterior.observacao_original !== null ? apAnterior.observacao_original : apAnterior.observacao;

    const motivo = (dadosEdicao.motivo || '').trim();
    let novaObservacaoAjuste = (dadosEdicao.observacao || dadosEdicao.motivo || '').trim();
    if (!novaObservacaoAjuste.toUpperCase().startsWith('AJUSTE')) {
      novaObservacaoAjuste = `AJUSTE - ${novaObservacaoAjuste}`;
    }

    const novaData = dadosEdicao.dataReferencia || apAnterior.data_referencia;
    const novoTimestamp = dadosEdicao.timestampDispositivo ? new Date(dadosEdicao.timestampDispositivo) : apAnterior.timestamp_dispositivo;
    const novoTipoEvento = dadosEdicao.tipoEvento || apAnterior.tipo_evento;
    const novaAtividade = dadosEdicao.atividade !== undefined ? dadosEdicao.atividade : apAnterior.atividade;
    const novoStatus = dadosEdicao.status || 'ajustado';

    await conexao.query(
      `UPDATE ra_apontamentos SET
         data_referencia = ?,
         timestamp_dispositivo = ?,
         tipo_evento = ?,
         atividade = ?,
         observacao = ?,
         observacao_ajuste = ?,
         observacao_original = ?,
         status = ?,
         ajustado = 1,
         ajustado_por_id = ?,
         ajustado_por_nome = ?,
         ajustado_em = NOW(),
         motivo_ajuste = ?,
         data_original = ?,
         timestamp_original = ?,
         tipo_evento_original = ?
       WHERE id = ?`,
      [
        novaData,
        novoTimestamp,
        novoTipoEvento,
        novaAtividade,
        novaObservacaoAjuste,
        novaObservacaoAjuste,
        observacaoOriginal,
        novoStatus,
        usuarioLogado.id,
        usuarioLogado.nome,
        motivo,
        dataOriginal,
        timestampOriginal,
        tipoEventoOriginal,
        id,
      ]
    );

    const camposParaAuditar = [
      { campo: 'data_referencia', anterior: String(apAnterior.data_referencia).slice(0, 10), novo: String(novaData).slice(0, 10) },
      { campo: 'timestamp_dispositivo', anterior: String(apAnterior.timestamp_dispositivo), novo: String(novoTimestamp) },
      { campo: 'tipo_evento', anterior: apAnterior.tipo_evento, novo: novoTipoEvento },
      { campo: 'atividade', anterior: apAnterior.atividade || '', novo: novaAtividade || '' },
      { campo: 'observacao', anterior: apAnterior.observacao || '', novo: novaObservacaoAjuste },
      { campo: 'status', anterior: apAnterior.status || 'normal', novo: novoStatus },
    ];

    for (const item of camposParaAuditar) {
      if (item.anterior !== item.novo) {
        await conexao.query(
          `INSERT INTO supervisao_auditoria_apontamentos
             (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, ip, origem)
           VALUES (?, ?, ?, ?, ?, ?, 'ajuste', ?, ?, ?, ?, ?, 'web_supervisao')`,
          [
            id,
            apAnterior.candidato_id,
            apAnterior.candidato_nome,
            usuarioLogado.id,
            usuarioLogado.nome,
            usuarioLogado.tipoUsuario,
            item.campo,
            item.anterior,
            item.novo,
            motivo || 'Ajuste operacional pela Supervisão',
            ip,
          ]
        );
      }
    }

    await conexao.commit();
    return { ok: true, id, mensagem: 'Apontamento ajustado com sucesso e registrado na auditoria.' };
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}

// ── 7. Inserção de Observação Avulsa no Apontamento ──────────────────────────
export async function adicionarObservacaoApontamento(id, { observacao, motivo, ehAjuste = false }, usuarioLogado, ip = null) {
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[apAnterior]] = await conexao.query(
      `SELECT ap.*, c.nome AS candidato_nome 
       FROM ra_apontamentos ap
       JOIN ra_candidatos c ON c.id = ap.candidato_id
       WHERE ap.id = ? FOR UPDATE`,
      [id]
    );

    if (!apAnterior) {
      throw new Error('Apontamento não encontrado.');
    }

    let textoObs = (observacao || '').trim();
    const ehMarcadoAjuste = ehAjuste || textoObs.toUpperCase().startsWith('AJUSTE') || Boolean(motivo);
    if (ehMarcadoAjuste && !textoObs.toUpperCase().startsWith('AJUSTE')) {
      textoObs = `AJUSTE - ${textoObs}`;
    }

    const obsOriginal = apAnterior.observacao_original !== null ? apAnterior.observacao_original : apAnterior.observacao;
    const novoStatus = ehMarcadoAjuste ? 'ajustado' : (apAnterior.status || 'normal');
    const motivoFinal = motivo ? motivo.trim() : (ehMarcadoAjuste ? textoObs : null);

    await conexao.query(
      `UPDATE ra_apontamentos SET
         observacao = ?,
         observacao_ajuste = ?,
         observacao_original = ?,
         status = ?,
         ajustado = ?,
         motivo_ajuste = COALESCE(?, motivo_ajuste),
         ajustado_por_id = ?,
         ajustado_por_nome = ?,
         ajustado_em = NOW()
       WHERE id = ?`,
      [
        textoObs,
        textoObs,
        obsOriginal,
        novoStatus,
        ehMarcadoAjuste ? 1 : (apAnterior.ajustado || 0),
        motivoFinal,
        usuarioLogado.id,
        usuarioLogado.nome,
        id
      ]
    );

    await conexao.query(
      `INSERT INTO supervisao_auditoria_apontamentos
         (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, ip, origem)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'observacao', ?, ?, ?, ?, 'web_supervisao')`,
      [
        id,
        apAnterior.candidato_id,
        apAnterior.candidato_nome,
        usuarioLogado.id,
        usuarioLogado.nome,
        usuarioLogado.tipoUsuario,
        ehMarcadoAjuste ? 'ajuste' : 'inclusao_observacao',
        apAnterior.observacao || '',
        textoObs,
        motivoFinal || 'Observação registrada pela Supervisão',
        ip,
      ]
    );

    await conexao.commit();
    return { ok: true, id };
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}

// ── 8. Gestão de Horas Complementares & Bonificações (2ª Entrega) ────────────
export async function criarComplementoCooperado(candidatoId, dados, usuarioLogado, ip = null) {
  const { dataReferencia, tipo, quantidadeHoras, quantidadeMinutos, valor, motivo, observacao, alocacaoId } = dados;

  if (!tipo || !dataReferencia || !motivo) {
    throw new Error('Preencha tipo, data de referência e motivo do lançamento.');
  }

  const mins = quantidadeMinutos !== undefined && quantidadeMinutos !== null && quantidadeMinutos !== ''
    ? Number(quantidadeMinutos)
    : (quantidadeHoras ? Math.round(Number(quantidadeHoras) * 60) : 0);

  const [[cand]] = await pool.query(`SELECT nome FROM ra_candidatos WHERE id = ?`, [candidatoId]);
  const candidatoNome = cand?.nome || `Cooperado #${candidatoId}`;

  const [res] = await pool.query(
    `INSERT INTO supervisao_horas_complementares
       (candidato_id, alocacao_id, data_referencia, tipo, quantidade_horas, quantidade_minutos, valor, motivo, observacao, criado_por_id, criado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      candidatoId,
      alocacaoId || null,
      dataReferencia,
      tipo,
      quantidadeHoras ? Number(quantidadeHoras) : null,
      mins,
      valor ? Number(valor) : 0,
      motivo,
      observacao || null,
      usuarioLogado.id,
      usuarioLogado.nome,
    ]
  );

  // Registro na auditoria
  await pool.query(
    `INSERT INTO supervisao_auditoria_apontamentos
       (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, ip, origem)
     VALUES (0, ?, ?, ?, ?, ?, 'criacao', ?, NULL, ?, ?, ?, 'web_supervisao')`,
    [
      candidatoId,
      candidatoNome,
      usuarioLogado.id,
      usuarioLogado.nome,
      usuarioLogado.tipoUsuario,
      `complemento_${tipo}`,
      tipo === 'bonificacao' ? `R$ ${Number(valor || 0).toFixed(2)}` : `${minutosParaFormatado(mins)}h (${dataReferencia})`,
      motivo,
      ip,
    ]
  );

  return { ok: true, id: res.insertId };
}

export async function excluirComplemento(id, motivo, usuarioLogado, ip = null) {
  const [[compl]] = await pool.query(
    `SELECT shc.*, c.nome AS candidato_nome 
     FROM supervisao_horas_complementares shc
     JOIN ra_candidatos c ON c.id = shc.candidato_id
     WHERE shc.id = ?`,
    [id]
  );

  if (!compl) {
    throw new Error('Lançamento complementar não encontrado.');
  }

  await pool.query(`DELETE FROM supervisao_horas_complementares WHERE id = ?`, [id]);

  await pool.query(
    `INSERT INTO supervisao_auditoria_apontamentos
       (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, ip, origem)
     VALUES (0, ?, ?, ?, ?, ?, 'edicao', ?, ?, 'REMOVIDO', ?, ?, 'web_supervisao')`,
    [
      compl.candidato_id,
      compl.candidato_nome,
      usuarioLogado.id,
      usuarioLogado.nome,
      usuarioLogado.tipoUsuario,
      `exclusao_complemento_${compl.tipo}`,
      `${compl.tipo}: ${compl.quantidade_horas || 0}h / R$ ${compl.valor || 0}`,
      motivo || 'Exclusão solicitada pela Supervisão',
      ip,
    ]
  );

  return { ok: true, id };
}

// ── 9. Alteração de Operação Vigente (Vaga, Atividade, Turno, Tempo) ─────────
export async function listarVagasDisponiveis() {
  const [rows] = await pool.query(`
    SELECT 
      pv.id AS vaga_id,
      pv.cargo AS vaga_cargo,
      pv.tipo_escala,
      pv.salario_base,
      pu.id AS unidade_id,
      pu.nome_unidade,
      emp.id AS empresa_id,
      COALESCE(emp.nome_empresa, 'Empresa') AS empresa_nome
    FROM parametro_vagas pv
    JOIN parametro_unidades pu ON pu.id = pv.unidade_id
    JOIN empresas emp ON emp.id = pu.empresa_id
    WHERE pv.ativa = 1
    ORDER BY emp.nome_empresa ASC, pv.cargo ASC
  `);
  return rows;
}

export async function alterarOperacaoCooperado(candidatoId, dados, usuarioLogado, ip = null) {
  const { novaVagaId, novaAtividade, novoTurno, motivo } = dados;

  if (!motivo || !motivo.trim()) {
    throw new Error('Informe obrigatoriamente a justificativa para a alteração da operação.');
  }

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    const [[alocAtual]] = await conexao.query(
      `SELECT a.*, pv.cargo AS vaga_cargo, pv.tipo_escala AS vaga_escala,
              emp.nome_empresa AS empresa_nome, c.nome AS candidato_nome
       FROM ra_alocacoes a
       JOIN ra_candidatos c ON c.id = a.candidato_id
       LEFT JOIN parametro_vagas pv ON pv.id = a.vaga_id
       LEFT JOIN empresas emp ON emp.id = a.empresa_id
       WHERE a.candidato_id = ? AND a.status = 'ativa'
       LIMIT 1 FOR UPDATE`,
      [candidatoId]
    );

    if (!alocAtual) {
      throw new Error('O cooperado não possui uma alocação ativa para ser alterada.');
    }

    let vagaNovaNome = alocAtual.vaga_cargo;
    let novaVagaEfetiva = alocAtual.vaga_id;
    let novaUnidadeEfetiva = alocAtual.unidade_id;
    let novaEmpresaEfetiva = alocAtual.empresa_id;

    if (novaVagaId && Number(novaVagaId) !== Number(alocAtual.vaga_id)) {
      const [[vagaInfo]] = await conexao.query(
        `SELECT pv.*, pu.empresa_id, pu.id AS unidade_id FROM parametro_vagas pv
         JOIN parametro_unidades pu ON pu.id = pv.unidade_id
         WHERE pv.id = ?`,
        [novaVagaId]
      );
      if (vagaInfo) {
        vagaNovaNome = vagaInfo.cargo;
        novaVagaEfetiva = vagaInfo.id;
        novaUnidadeEfetiva = vagaInfo.unidade_id;
        novaEmpresaEfetiva = vagaInfo.empresa_id;
      }
    }

    // 1. Atualiza alocação ativa
    await conexao.query(
      `UPDATE ra_alocacoes SET
         vaga_id = ?,
         unidade_id = ?,
         empresa_id = ?,
         observacoes = CONCAT(COALESCE(observacoes, ''), '\n[Alteração pela Supervisão em ', DATE_FORMAT(NOW(), '%d/%m/%Y %H:%i'), ' por ', ?, ': ', ?, ']')
       WHERE id = ?`,
      [
        novaVagaEfetiva,
        novaUnidadeEfetiva,
        novaEmpresaEfetiva,
        usuarioLogado.nome,
        motivo,
        alocAtual.id,
      ]
    );

    // 2. Grava histórico de alteração da operação
    await conexao.query(
      `INSERT INTO supervisao_historico_operacao
         (candidato_id, alocacao_id, tipo_alteracao, vaga_anterior_id, vaga_anterior_nome, vaga_nova_id, vaga_nova_nome, turno_anterior, turno_novo, atividade_anterior, atividade_nova, motivo, usuario_id, usuario_nome)
       VALUES (?, ?, 'operacao', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        candidatoId,
        alocAtual.id,
        alocAtual.vaga_id,
        alocAtual.vaga_cargo,
        novaVagaEfetiva,
        vagaNovaNome,
        alocAtual.vaga_escala,
        novoTurno || alocAtual.vaga_escala,
        null,
        novaAtividade || null,
        motivo,
        usuarioLogado.id,
        usuarioLogado.nome,
      ]
    );

    // 3. Auditoria geral
    await conexao.query(
      `INSERT INTO supervisao_auditoria_apontamentos
         (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, ip, origem)
       VALUES (0, ?, ?, ?, ?, ?, 'edicao', 'operacao_vaga', ?, ?, ?, ?, 'web_supervisao')`,
      [
        candidatoId,
        alocAtual.candidato_nome,
        usuarioLogado.id,
        usuarioLogado.nome,
        usuarioLogado.tipoUsuario,
        `Vaga: ${alocAtual.vaga_cargo}`,
        `Vaga: ${vagaNovaNome}${novoTurno ? ' | Turno: ' + novoTurno : ''}`,
        motivo,
        ip,
      ]
    );

    await conexao.commit();
    return { ok: true, mensagem: 'Operação do cooperado atualizada com sucesso!' };
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}

// ── 10. Fluxo de Reset Seguro de Senha do Cooperado ──────────────────────────
export async function solicitarResetSenhaCooperado(candidatoId, usuarioLogado, ip = null) {
  const [[cand]] = await pool.query(`SELECT * FROM ra_candidatos WHERE id = ?`, [candidatoId]);
  if (!cand) throw new Error('Cooperado não encontrado.');
  if (!cand.email) throw new Error('O cooperado não possui e-mail cadastrado para envio do código de recuperação.');

  // Gera código aleatório de 6 dígitos
  const codigo = String(Math.floor(100000 + Math.random() * 900000));
  const expiraEm = new Date(Date.now() + 30 * 60 * 1000); // 30 minutos

  // Invalida códigos anteriores não utilizados
  await pool.query(
    `UPDATE supervisao_reset_senhas SET utilizado = 1 WHERE candidato_id = ? AND utilizado = 0`,
    [candidatoId]
  );

  // Insere novo código
  await pool.query(
    `INSERT INTO supervisao_reset_senhas
       (candidato_id, codigo, expira_em, solicitado_por_id, solicitado_por_nome)
     VALUES (?, ?, ?, ?, ?)`,
    [candidatoId, codigo, expiraEm, usuarioLogado.id, usuarioLogado.nome]
  );

  // Envia e-mail formatado
  await enviarEmail({
    para: cand.email,
    assunto: '🔐 Código de Redefinição de Senha — ATESA Cooperado',
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #4a9e4f, #2e7d32); padding: 24px; text-align: center; color: #ffffff;">
          <h2 style="margin: 0; font-size: 22px; font-weight: 700;">ATESA — App do Cooperado</h2>
          <p style="margin: 6px 0 0 0; opacity: 0.9; font-size: 14px;">Solicitação de Redefinição de Senha</p>
        </div>
        <div style="padding: 28px 24px; color: #334155;">
          <p style="font-size: 15px; margin-top: 0;">Olá, <strong>${cand.nome}</strong>!</p>
          <p style="font-size: 14px; line-height: 1.5;">A Supervisão ATESA solicitou a redefinição de acesso à sua conta. Utilize o código de verificação abaixo no aplicativo:</p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0; border: 1px dashed #cbd5e1;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f172a; font-family: monospace;">${codigo}</span>
            <div style="font-size: 12px; color: #64748b; margin-top: 6px;">Código válido por 30 minutos • Uso único</div>
          </div>
          <p style="font-size: 12.5px; color: #64748b;">Se você não reconhece esta solicitação, entre em contato imediatamente com o suporte da sua cooperativa.</p>
        </div>
      </div>
    `,
    texto: `Olá ${cand.nome}, seu código para redefinição de senha no App do Cooperado ATESA é: ${codigo}. Válido por 30 minutos.`,
  });

  // Log de auditoria
  await pool.query(
    `INSERT INTO supervisao_auditoria_apontamentos
       (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, ip, origem)
     VALUES (0, ?, ?, ?, ?, ?, 'edicao', 'reset_senha_solicitado', NULL, 'Código disparado por e-mail', 'Solicitação de reset iniciada pela Supervisão', ?, 'web_supervisao')`,
    [candidatoId, cand.nome, usuarioLogado.id, usuarioLogado.nome, usuarioLogado.tipoUsuario, ip]
  );

  return { ok: true, mensagem: `Código de verificação enviado para o e-mail ${cand.email}.` };
}

export async function confirmarResetSenhaCooperado({ candidatoId, codigo, novaSenha }) {
  if (!codigo || !novaSenha || novaSenha.length < 6) {
    throw new Error('Informe o código de 6 dígitos e uma nova senha com no mínimo 6 caracteres.');
  }

  const [[solic]] = await pool.query(
    `SELECT * FROM supervisao_reset_senhas 
     WHERE candidato_id = ? AND utilizado = 0 AND expira_em > NOW()
     ORDER BY id DESC LIMIT 1`,
    [candidatoId]
  );

  if (!solic) {
    throw new Error('Código de redefinição inválido ou expirado. Solicite um novo código.');
  }

  if (solic.tentativas >= 3) {
    await pool.query(`UPDATE supervisao_reset_senhas SET utilizado = 1 WHERE id = ?`, [solic.id]);
    throw new Error('Limite de tentativas excedido. Solicite uma nova redefinição.');
  }

  if (solic.codigo.trim() !== String(codigo).trim()) {
    await pool.query(`UPDATE supervisao_reset_senhas SET tentativas = tentativas + 1 WHERE id = ?`, [solic.id]);
    throw new Error('Código de verificação incorreto.');
  }

  const senhaHash = await bcrypt.hash(novaSenha, 10);
  await pool.query(`UPDATE ra_candidatos SET senha_hash = ? WHERE id = ?`, [senhaHash, candidatoId]);
  await pool.query(`UPDATE supervisao_reset_senhas SET utilizado = 1, utilizado_em = NOW() WHERE id = ?`, [solic.id]);

  return { ok: true, mensagem: 'Senha redefinida com sucesso! Você já pode entrar no aplicativo.' };
}

// ── 11. Relatórios Consolidados (2ª Entrega) ─────────────────────────────────
export async function gerarRelatorioIndividual(candidatoId, { dataInicio, dataFim } = {}) {
  return obterDetalhesCooperadoMonitoramento(candidatoId, { dataInicio, dataFim });
}

export async function gerarRelatorioPorVaga({ vagaId, empresaId, dataInicio, dataFim } = {}) {
  const hoje = dataLocalISO();
  const dtIni = dataInicio || hoje;
  const dtFim = dataFim || hoje;

  let sql = `
    SELECT 
      pv.id AS vaga_id,
      pv.cargo AS vaga_cargo,
      pv.tipo_escala,
      emp.id AS empresa_id,
      COALESCE(emp.nome_empresa, 'Empresa') AS empresa_nome,
      c.id AS candidato_id,
      c.nome AS candidato_nome,
      c.cpf AS candidato_cpf,
      c.matricula AS candidato_matricula,
      
      -- Total de apontamentos do cooperado nesta vaga no período
      (
        SELECT COUNT(*) FROM ra_apontamentos ap
        WHERE ap.candidato_id = c.id
          AND ap.data_referencia >= ? AND ap.data_referencia <= ?
      ) AS total_apontamentos,

      (
        SELECT COUNT(*) FROM ra_apontamentos ap_aj
        WHERE ap_aj.candidato_id = c.id AND ap_aj.ajustado = 1
          AND ap_aj.data_referencia >= ? AND ap_aj.data_referencia <= ?
      ) AS total_ajustes

    FROM parametro_vagas pv
    JOIN parametro_unidades pu ON pu.id = pv.unidade_id
    JOIN empresas emp ON emp.id = pu.empresa_id
    JOIN ra_alocacoes a ON a.vaga_id = pv.id AND a.status = 'ativa'
    JOIN ra_candidatos c ON c.id = a.candidato_id
    WHERE 1=1
  `;
  const params = [dtIni, dtFim, dtIni, dtFim];

  if (vagaId) {
    sql += ` AND pv.id = ?`;
    params.push(Number(vagaId));
  }
  if (empresaId) {
    sql += ` AND emp.id = ?`;
    params.push(Number(empresaId));
  }

  sql += ` ORDER BY emp.nome_empresa ASC, pv.cargo ASC, c.nome ASC`;

  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function gerarRelatorioGeralSupervisao({ empresaId, vagaId, dataInicio, dataFim } = {}) {
  const hoje = dataLocalISO();
  const dtIni = dataInicio || hoje;
  const dtFim = dataFim || hoje;

  const resumo = await obterResumoDashboard({ dataInicio: dtIni, dataFim: dtFim, empresaId });
  const cooperados = await listarCooperadosMonitoramento({ dataInicio: dtIni, dataFim: dtFim, empresaId, vagaId, limite: 500 });

  return {
    periodo: { dataInicio: dtIni, dataFim: dtFim },
    resumo,
    totalCooperadosListados: cooperados.length,
    cooperados,
  };
}

// ── 12. Consulta aos Logs de Auditoria (Somente Leitura) ──────────────────────
export async function listarLogsAuditoria({ busca, candidatoId, usuarioId, acao, dataInicio, dataFim, limite = 100, pagina = 1 } = {}) {
  let sql = `
    SELECT 
      l.*,
      c.cpf AS candidato_cpf,
      c.matricula AS candidato_matricula,
      ap.data_referencia AS apontamento_data,
      ap.tipo_evento AS apontamento_tipo_evento
    FROM supervisao_auditoria_apontamentos l
    LEFT JOIN ra_candidatos c ON c.id = l.candidato_id
    LEFT JOIN ra_apontamentos ap ON ap.id = l.apontamento_id
    WHERE 1=1
  `;
  const params = [];

  if (busca && busca.trim()) {
    const raw = busca.trim();
    const termo = `%${raw}%`;
    const digits = raw.replace(/\D/g, '');
    if (digits.length >= 3) {
      const cpfLimpo = `%${digits}%`;
      sql += ` AND (l.candidato_nome LIKE ? OR l.usuario_nome LIKE ? OR l.motivo LIKE ? OR l.campo LIKE ? OR c.cpf LIKE ? OR REPLACE(REPLACE(REPLACE(c.cpf, '.', ''), '-', ''), ' ', '') LIKE ? OR c.matricula LIKE ?)`;
      params.push(termo, termo, termo, termo, termo, cpfLimpo, termo);
    } else {
      sql += ` AND (l.candidato_nome LIKE ? OR l.usuario_nome LIKE ? OR l.motivo LIKE ? OR l.campo LIKE ? OR c.matricula LIKE ?)`;
      params.push(termo, termo, termo, termo, termo);
    }
  }

  if (candidatoId) {
    sql += ` AND l.candidato_id = ?`;
    params.push(Number(candidatoId));
  }

  if (usuarioId) {
    sql += ` AND l.usuario_id = ?`;
    params.push(Number(usuarioId));
  }

  if (acao) {
    sql += ` AND l.acao = ?`;
    params.push(acao);
  }

  if (dataInicio) {
    sql += ` AND l.criado_em >= ?`;
    params.push(dataInicio);
  }

  if (dataFim) {
    sql += ` AND l.criado_em <= ?`;
    params.push(`${dataFim} 23:59:59`);
  }

  sql += ` ORDER BY l.criado_em DESC`;

  const offset = (Math.max(1, Number(pagina)) - 1) * Number(limite);
  sql += ` LIMIT ? OFFSET ?`;
  params.push(Number(limite), Number(offset));

  const [rows] = await pool.query(sql, params);
  return rows;
}
