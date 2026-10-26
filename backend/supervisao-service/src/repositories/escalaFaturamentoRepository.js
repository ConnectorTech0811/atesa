// ── Escalas de Plantão, Pacientes e Faturamento (Produtividade) ─────────────
// Módulo novo e isolado: não altera as tabelas/fluxos existentes da supervisão.
//  • supervisao_pacientes       → cadastro do paciente / local da escala
//  • supervisao_escalas         → lançamento de plantões (cooperado + paciente + data/hora)
//  • supervisao_valores_cliente → valores enviados pelo cliente (importação por matrícula)
import { pool } from '../config/database.js';
import { calcularHorasDosApontamentos } from './supervisaoRepository.js';
import { exigirCompetenciaAberta } from './periodoFechado.js';
import { apurarAlocacoes, TIPOS_INCONSISTENCIA } from './apuracaoFaturamento.js';
import { obterRegrasApuracao } from './regrasApuracaoRepository.js';
import { dataLocalISO } from '../../../shared/src/datas.js';

// Plantão diurno: início entre 07:00 e 18:59. Noturno: início entre 19:00 e 06:59.
const HORA_INICIO_DIURNO = 7;
const HORA_INICIO_NOTURNO = 19;

export const CAMPOS_VALORES_CLIENTE = ['desc_refeicao', 'bonificacao', 'desc_estacionamento', 'desc_farmacia', 'reembolso'];

let inicializado = null;
export function inicializarTabelasEscalaFaturamento() {
  if (!inicializado) {
    inicializado = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_pacientes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          nome VARCHAR(200) NOT NULL,
          tipo ENUM('paciente', 'local') NOT NULL DEFAULT 'paciente',
          empresa_id INT NULL,
          endereco VARCHAR(300) NULL,
          patologia TEXT NULL,
          cuidados TEXT NULL,
          observacoes TEXT NULL,
          ativo TINYINT(1) NOT NULL DEFAULT 1,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_spac_empresa (empresa_id),
          INDEX idx_spac_nome (nome)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_escalas (
          id INT AUTO_INCREMENT PRIMARY KEY,
          candidato_id INT NOT NULL,
          paciente_id INT NULL,
          alocacao_id INT NULL,
          empresa_id INT NULL,
          data DATE NOT NULL,
          hora_inicio TIME NOT NULL,
          hora_fim TIME NOT NULL,
          duracao_minutos INT NOT NULL DEFAULT 0,
          turno ENUM('diurno', 'noturno') NOT NULL,
          status ENUM('prevista', 'realizada', 'cancelada') NOT NULL DEFAULT 'prevista',
          observacao TEXT NULL,
          criado_por_id INT NULL,
          criado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_sesc_cand_data (candidato_id, data),
          INDEX idx_sesc_data (data),
          INDEX idx_sesc_paciente (paciente_id),
          INDEX idx_sesc_alocacao (alocacao_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_valores_cliente (
          id INT AUTO_INCREMENT PRIMARY KEY,
          competencia CHAR(7) NOT NULL,
          empresa_id INT NOT NULL DEFAULT 0,
          candidato_id INT NOT NULL,
          matricula VARCHAR(20) NULL,
          nome VARCHAR(200) NULL,
          desc_refeicao DECIMAL(12,2) NOT NULL DEFAULT 0,
          bonificacao DECIMAL(12,2) NOT NULL DEFAULT 0,
          desc_estacionamento DECIMAL(12,2) NOT NULL DEFAULT 0,
          desc_farmacia DECIMAL(12,2) NOT NULL DEFAULT 0,
          reembolso DECIMAL(12,2) NOT NULL DEFAULT 0,
          importado_por_id INT NULL,
          importado_por_nome VARCHAR(150) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          UNIQUE KEY uk_svc_comp_emp_cand (competencia, empresa_id, candidato_id),
          INDEX idx_svc_cand (candidato_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Vínculo da escala com o que está parametrizado (unidade/local, vaga e atividade)
      for (const col of ['vaga_id INT NULL', 'unidade_id INT NULL', 'atividade VARCHAR(200) NULL']) {
        try { await pool.query(`ALTER TABLE supervisao_escalas ADD COLUMN ${col}`); } catch { /* coluna já existe */ }
      }
    })().catch((err) => {
      inicializado = null;
      console.error('[escalaFaturamento] Erro ao criar tabelas:', err?.message);
      throw err;
    });
  }
  return inicializado;
}
inicializarTabelasEscalaFaturamento().catch(() => {});

// ── Helpers ──────────────────────────────────────────────────────────────────
function erro400(msg) {
  return Object.assign(new Error(msg), { status: 400 });
}

function parseHora(h) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(h || '').trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;
  return { hh, mm, texto: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` };
}

export function classificarTurno(horaInicio) {
  const h = parseHora(horaInicio);
  if (!h) return 'diurno';
  return h.hh >= HORA_INICIO_DIURNO && h.hh < HORA_INICIO_NOTURNO ? 'diurno' : 'noturno';
}

function duracaoMinutos(ini, fim) {
  const a = ini.hh * 60 + ini.mm;
  let b = fim.hh * 60 + fim.mm;
  if (b <= a) b += 24 * 60; // plantão que vira o dia (ex.: 19:00 → 07:00)
  return b - a;
}

function validarData(d) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(d || ''));
}

function intervaloCompetencia(competencia) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(competencia || ''));
  if (!m) throw erro400('Competência inválida. Use o formato AAAA-MM.');
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  if (mes < 1 || mes > 12) throw erro400('Competência inválida. Use o formato AAAA-MM.');
  const ultimoDia = new Date(ano, mes, 0).getDate();
  return {
    inicio: `${m[1]}-${m[2]}-01`,
    fim: `${m[1]}-${m[2]}-${String(ultimoDia).padStart(2, '0')}`,
    rotulo: `${m[2]}/${m[1]}`,
  };
}

function iso(d) {
  if (!d) return null;
  if (d instanceof Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  return String(d).slice(0, 10);
}

function normalizarMatricula(m) {
  return String(m ?? '').trim().replace(/\.0+$/, '').replace(/^0+(?=\d)/, '').toUpperCase();
}

function numeroOuZero(v) {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/[R$\s]/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// ── Listas de apoio (selects da tela) ────────────────────────────────────────
export async function listarOpcoesEscala() {
  await inicializarTabelasEscalaFaturamento();
  const [cooperados] = await pool.query(
    `SELECT id, nome, matricula FROM ra_candidatos
      WHERE matricula IS NOT NULL AND matricula <> '' AND inativado_em IS NULL
      ORDER BY nome`
  );
  const [empresas] = await pool.query(`SELECT id, nome_empresa FROM empresas ORDER BY nome_empresa`);
  const [alocacoes] = await pool.query(
    `SELECT a.id, a.candidato_id, a.empresa_id, a.status, a.data_inicio, a.data_fim,
            v.cargo, u.nome_unidade, e.nome_empresa
       FROM ra_alocacoes a
       LEFT JOIN parametro_vagas v ON v.id = a.vaga_id
       LEFT JOIN parametro_unidades u ON u.id = a.unidade_id
       LEFT JOIN empresas e ON e.id = a.empresa_id
      WHERE a.status <> 'cancelada'
      ORDER BY a.status = 'ativa' DESC, a.data_inicio DESC`
  );
  // Atividades, horários e locais já parametrizados (tela Parâmetro)
  const [vagas] = await pool.query(
    `SELECT v.id, v.unidade_id, u.empresa_id, u.nome_unidade, u.endereco AS unidade_endereco,
            v.cargo, v.tipo_atividade, v.horario, v.intervalo, v.tipo_escala
       FROM parametro_vagas v
       JOIN parametro_unidades u ON u.id = v.unidade_id
      WHERE u.ativa = 1
      ORDER BY u.nome_unidade, v.cargo`
  );
  return { cooperados, empresas, alocacoes, vagas };
}

// ── Pacientes / Locais ───────────────────────────────────────────────────────
export async function listarPacientes({ busca, empresaId, incluirInativos } = {}) {
  await inicializarTabelasEscalaFaturamento();
  let sql = `SELECT p.*, e.nome_empresa
               FROM supervisao_pacientes p
               LEFT JOIN empresas e ON e.id = p.empresa_id
              WHERE 1=1`;
  const params = [];
  if (!incluirInativos || incluirInativos === 'false') sql += ' AND p.ativo = 1';
  if (empresaId) { sql += ' AND p.empresa_id = ?'; params.push(Number(empresaId)); }
  if (busca) {
    sql += ' AND (p.nome LIKE ? OR p.endereco LIKE ? OR p.patologia LIKE ?)';
    const like = `%${busca}%`;
    params.push(like, like, like);
  }
  sql += ' ORDER BY p.nome';
  const [rows] = await pool.query(sql, params);
  return rows;
}

function dadosPaciente(dados) {
  const nome = String(dados.nome || '').trim();
  if (!nome) throw erro400('Informe o nome do paciente / local.');
  return {
    nome,
    tipo: dados.tipo === 'local' ? 'local' : 'paciente',
    empresa_id: dados.empresaId ? Number(dados.empresaId) : null,
    endereco: String(dados.endereco || '').trim() || null,
    patologia: String(dados.patologia || '').trim() || null,
    cuidados: String(dados.cuidados || '').trim() || null,
    observacoes: String(dados.observacoes || '').trim() || null,
  };
}

export async function criarPaciente(dados, usuario) {
  await inicializarTabelasEscalaFaturamento();
  const p = dadosPaciente(dados);
  const [res] = await pool.query(
    `INSERT INTO supervisao_pacientes (nome, tipo, empresa_id, endereco, patologia, cuidados, observacoes, criado_por_id, criado_por_nome)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [p.nome, p.tipo, p.empresa_id, p.endereco, p.patologia, p.cuidados, p.observacoes, usuario.id, usuario.nome]
  );
  return { ok: true, id: res.insertId };
}

export async function atualizarPaciente(id, dados) {
  await inicializarTabelasEscalaFaturamento();
  const p = dadosPaciente(dados);
  const ativo = dados.ativo === undefined ? 1 : (dados.ativo ? 1 : 0);
  const [res] = await pool.query(
    `UPDATE supervisao_pacientes
        SET nome = ?, tipo = ?, empresa_id = ?, endereco = ?, patologia = ?, cuidados = ?, observacoes = ?, ativo = ?
      WHERE id = ?`,
    [p.nome, p.tipo, p.empresa_id, p.endereco, p.patologia, p.cuidados, p.observacoes, ativo, Number(id)]
  );
  if (!res.affectedRows) throw Object.assign(new Error('Paciente / local não encontrado.'), { status: 404 });
  return { ok: true, id: Number(id) };
}

// ── Escalas ──────────────────────────────────────────────────────────────────
export async function listarEscalas({ dataInicio, dataFim, candidatoId, pacienteId, empresaId, turno, status } = {}) {
  await inicializarTabelasEscalaFaturamento();
  let sql = `
    SELECT s.*, c.nome AS cooperado_nome, c.matricula,
           p.nome AS paciente_nome, p.tipo AS paciente_tipo, p.endereco AS paciente_endereco,
           p.patologia AS paciente_patologia, p.cuidados AS paciente_cuidados,
           COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) AS empresa_id_efetiva,
           e.nome_empresa, pu.nome_unidade
      FROM supervisao_escalas s
      JOIN ra_candidatos c ON c.id = s.candidato_id
      LEFT JOIN supervisao_pacientes p ON p.id = s.paciente_id
      LEFT JOIN parametro_unidades pu ON pu.id = s.unidade_id
      LEFT JOIN ra_alocacoes a ON a.id = s.alocacao_id
      LEFT JOIN empresas e ON e.id = COALESCE(s.empresa_id, p.empresa_id, a.empresa_id)
     WHERE 1=1`;
  const params = [];
  if (dataInicio) { sql += ' AND s.data >= ?'; params.push(dataInicio); }
  if (dataFim) { sql += ' AND s.data <= ?'; params.push(dataFim); }
  if (candidatoId) { sql += ' AND s.candidato_id = ?'; params.push(Number(candidatoId)); }
  if (pacienteId) { sql += ' AND s.paciente_id = ?'; params.push(Number(pacienteId)); }
  if (empresaId) { sql += ' AND COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) = ?'; params.push(Number(empresaId)); }
  if (turno) { sql += ' AND s.turno = ?'; params.push(turno); }
  if (status) { sql += ' AND s.status = ?'; params.push(status); }
  sql += ' ORDER BY s.data DESC, s.hora_inicio DESC LIMIT 2000';
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function montarEscala(dados) {
  const candidatoId = Number(dados.candidatoId);
  if (!candidatoId) throw erro400('Selecione o cooperado da escala.');
  if (!validarData(dados.data)) throw erro400('Informe a data do plantão.');
  const ini = parseHora(dados.horaInicio);
  const fim = parseHora(dados.horaFim);
  if (!ini || !fim) throw erro400('Informe hora de início e hora de fim (HH:mm).');

  let empresaId = dados.empresaId ? Number(dados.empresaId) : null;
  let unidadeId = dados.unidadeId ? Number(dados.unidadeId) : null;
  const vagaId = dados.vagaId ? Number(dados.vagaId) : null;
  let atividade = String(dados.atividade || '').trim() || null;
  if (vagaId) {
    // Atividade parametrizada: cliente, unidade e cargo vêm do Parâmetro
    const [[vaga]] = await pool.query(
      `SELECT v.cargo, v.tipo_atividade, v.unidade_id, u.empresa_id
         FROM parametro_vagas v JOIN parametro_unidades u ON u.id = v.unidade_id
        WHERE v.id = ?`,
      [vagaId]
    );
    if (!vaga) throw erro400('Atividade parametrizada não encontrada. Atualize a tela e tente novamente.');
    empresaId = vaga.empresa_id;
    if (!unidadeId) unidadeId = vaga.unidade_id;
    if (!atividade) atividade = vaga.cargo;
  }
  if (!dados.pacienteId && !unidadeId && !empresaId) throw erro400('Selecione o paciente / local da escala.');

  let alocacaoId = dados.alocacaoId ? Number(dados.alocacaoId) : null;
  if (!alocacaoId) {
    // Vincula automaticamente quando o cooperado tem uma única alocação ativa
    const [alocs] = await pool.query(
      `SELECT id, empresa_id FROM ra_alocacoes WHERE candidato_id = ? AND status = 'ativa'`,
      [candidatoId]
    );
    if (alocs.length === 1) {
      alocacaoId = alocs[0].id;
      if (!empresaId) empresaId = alocs[0].empresa_id;
    }
  }
  const status = ['prevista', 'realizada', 'cancelada'].includes(dados.status) ? dados.status : 'prevista';
  return {
    candidato_id: candidatoId,
    paciente_id: dados.pacienteId ? Number(dados.pacienteId) : null,
    alocacao_id: alocacaoId,
    empresa_id: empresaId,
    unidade_id: unidadeId,
    vaga_id: vagaId,
    atividade,
    data: dados.data,
    hora_inicio: ini.texto,
    hora_fim: fim.texto,
    duracao_minutos: duracaoMinutos(ini, fim),
    turno: classificarTurno(ini.texto),
    status,
    observacao: String(dados.observacao || '').trim() || null,
  };
}

// Intervalo absoluto do plantão em minutos (permite comparar plantões que viram o dia)
function intervaloAbsoluto(data, horaInicio, duracao) {
  const [a, m, d] = iso(data).split('-').map(Number);
  const h = parseHora(horaInicio);
  const ini = Date.UTC(a, m - 1, d) / 60000 + h.hh * 60 + h.mm;
  return [ini, ini + Number(duracao || 0)];
}

const fmtDataBR = (d) => iso(d).split('-').reverse().join('/');

/** Impede lançar o mesmo cooperado em dois plantões com horários sobrepostos. */
async function validarConflitos(candidatoId, novas, ignorarId = null) {
  if (!novas.length) return;
  const datas = novas.map((e) => e.data).sort();
  const [existentes] = await pool.query(
    `SELECT id, data, hora_inicio, duracao_minutos FROM supervisao_escalas
      WHERE candidato_id = ? AND status <> 'cancelada'
        AND data BETWEEN DATE_SUB(?, INTERVAL 1 DAY) AND DATE_ADD(?, INTERVAL 1 DAY)
        ${ignorarId ? 'AND id <> ?' : ''}`,
    ignorarId ? [candidatoId, datas[0], datas[datas.length - 1], ignorarId] : [candidatoId, datas[0], datas[datas.length - 1]]
  );
  const ocupados = existentes.map((e) => ({ ...e, faixa: intervaloAbsoluto(e.data, e.hora_inicio, e.duracao_minutos) }));
  const conflitos = [];
  for (const n of novas) {
    if (n.status === 'cancelada') continue;
    const faixa = intervaloAbsoluto(n.data, n.hora_inicio, n.duracao_minutos);
    const choque = ocupados.find((o) => faixa[0] < o.faixa[1] && o.faixa[0] < faixa[1]);
    if (choque) conflitos.push(`${fmtDataBR(n.data)} ${n.hora_inicio} (já há plantão em ${fmtDataBR(choque.data)} às ${String(choque.hora_inicio).slice(0, 5)})`);
    ocupados.push({ data: n.data, hora_inicio: n.hora_inicio, faixa });
  }
  if (conflitos.length) {
    const lista = conflitos.slice(0, 5).join('; ');
    const resto = conflitos.length > 5 ? ` e mais ${conflitos.length - 5}` : '';
    throw Object.assign(new Error(`Conflito de horário para o cooperado: ${lista}${resto}.`), { status: 409 });
  }
}

const MAX_PLANTOES_POR_LANCAMENTO = 400;

export async function criarEscala(dados, usuario) {
  await inicializarTabelasEscalaFaturamento();
  // Permite lançar o mesmo plantão em várias datas de uma vez.
  // Cada item pode trazer o próprio horário (ex.: plantões seguidos no mesmo dia).
  const itens = Array.isArray(dados.plantoes) && dados.plantoes.length
    ? dados.plantoes
    : (Array.isArray(dados.datas) && dados.datas.length ? dados.datas : [dados.data]).map((data) => ({ data }));
  if (itens.length > MAX_PLANTOES_POR_LANCAMENTO) {
    throw erro400(`Limite de ${MAX_PLANTOES_POR_LANCAMENTO} plantões por lançamento. Reduza o período.`);
  }
  // Os dados comuns são resolvidos uma vez; data e horário variam por item
  const base = await montarEscala({ ...dados, data: itens[0]?.data });
  const escalas = itens.map((it) => {
    if (!validarData(it.data)) throw erro400('Informe a data do plantão.');
    const ini = parseHora(it.horaInicio ?? dados.horaInicio);
    const fim = parseHora(it.horaFim ?? dados.horaFim);
    if (!ini || !fim) throw erro400('Informe hora de início e hora de fim (HH:mm).');
    return {
      ...base,
      data: it.data,
      hora_inicio: ini.texto,
      hora_fim: fim.texto,
      duracao_minutos: duracaoMinutos(ini, fim),
      turno: classificarTurno(ini.texto),
    };
  });
  await exigirCompetenciaAberta(escalas.map((e) => e.data), 'lançar plantões');
  await validarConflitos(base.candidato_id, escalas);

  const valores = escalas.map((e) => [e.candidato_id, e.paciente_id, e.alocacao_id, e.empresa_id, e.unidade_id, e.vaga_id, e.atividade,
    e.data, e.hora_inicio, e.hora_fim, e.duracao_minutos, e.turno, e.status, e.observacao, usuario.id, usuario.nome]);
  const [res] = await pool.query(
    `INSERT INTO supervisao_escalas
       (candidato_id, paciente_id, alocacao_id, empresa_id, unidade_id, vaga_id, atividade,
        data, hora_inicio, hora_fim, duracao_minutos, turno, status, observacao, criado_por_id, criado_por_nome)
     VALUES ?`,
    [valores]
  );
  // INSERT múltiplo no InnoDB gera ids consecutivos a partir de insertId
  const ids = escalas.map((_, i) => res.insertId + i);
  return { ok: true, ids };
}

export async function atualizarEscala(id, dados) {
  await inicializarTabelasEscalaFaturamento();
  const [[anterior]] = await pool.query(`SELECT data FROM supervisao_escalas WHERE id = ?`, [Number(id)]);
  if (!anterior) throw Object.assign(new Error('Escala não encontrada.'), { status: 404 });
  const e = await montarEscala(dados);
  await exigirCompetenciaAberta([anterior.data, e.data], 'alterar este plantão');
  await validarConflitos(e.candidato_id, [e], Number(id));
  const [res] = await pool.query(
    `UPDATE supervisao_escalas
        SET candidato_id = ?, paciente_id = ?, alocacao_id = ?, empresa_id = ?, unidade_id = ?, vaga_id = ?, atividade = ?,
            data = ?, hora_inicio = ?, hora_fim = ?, duracao_minutos = ?, turno = ?, status = ?, observacao = ?
      WHERE id = ?`,
    [e.candidato_id, e.paciente_id, e.alocacao_id, e.empresa_id, e.unidade_id, e.vaga_id, e.atividade,
      e.data, e.hora_inicio, e.hora_fim, e.duracao_minutos, e.turno, e.status, e.observacao, Number(id)]
  );
  if (!res.affectedRows) throw Object.assign(new Error('Escala não encontrada.'), { status: 404 });
  return { ok: true, id: Number(id) };
}

export async function excluirEscala(id) {
  await inicializarTabelasEscalaFaturamento();
  const [[anterior]] = await pool.query(`SELECT data FROM supervisao_escalas WHERE id = ?`, [Number(id)]);
  if (!anterior) throw Object.assign(new Error('Escala não encontrada.'), { status: 404 });
  await exigirCompetenciaAberta([anterior.data], 'excluir este plantão');
  const [res] = await pool.query(`DELETE FROM supervisao_escalas WHERE id = ?`, [Number(id)]);
  if (!res.affectedRows) throw Object.assign(new Error('Escala não encontrada.'), { status: 404 });
  return { ok: true };
}

// ── Conferência da Supervisão: plantões diurnos/noturnos × horas apontadas ──
export async function conferenciaPlantoes({ dataInicio, dataFim, empresaId, candidatoId } = {}) {
  await inicializarTabelasEscalaFaturamento();
  if (!validarData(dataInicio) || !validarData(dataFim)) throw erro400('Informe o período (data início e data fim).');

  const escalas = (await listarEscalas({ dataInicio, dataFim, empresaId, candidatoId }))
    .filter((e) => e.status !== 'cancelada');

  const porCooperado = new Map();
  for (const e of escalas) {
    if (!porCooperado.has(e.candidato_id)) {
      porCooperado.set(e.candidato_id, {
        candidato_id: e.candidato_id,
        cooperado_nome: e.cooperado_nome,
        matricula: e.matricula,
        plantoes_diurnos: 0,
        minutos_diurnos: 0,
        plantoes_noturnos: 0,
        minutos_noturnos: 0,
        plantoes_realizados: 0,
        plantoes_previstos: 0,
        minutos_apontados: 0,
      });
    }
    const r = porCooperado.get(e.candidato_id);
    if (e.turno === 'noturno') { r.plantoes_noturnos++; r.minutos_noturnos += e.duracao_minutos; }
    else { r.plantoes_diurnos++; r.minutos_diurnos += e.duracao_minutos; }
    if (e.status === 'realizada') r.plantoes_realizados++; else r.plantoes_previstos++;
  }

  const ids = [...porCooperado.keys()];
  if (ids.length) {
    // Plantão noturno termina no dia seguinte: considera +1 dia no fim do período
    const [aps] = await pool.query(
      `SELECT candidato_id, data_referencia, tipo_evento, timestamp_dispositivo
         FROM ra_apontamentos
        WHERE candidato_id IN (?) AND data_referencia >= ? AND data_referencia <= DATE_ADD(?, INTERVAL 1 DAY)`,
      [ids, dataInicio, dataFim]
    );
    const apsPorCand = new Map();
    for (const a of aps) {
      if (!apsPorCand.has(a.candidato_id)) apsPorCand.set(a.candidato_id, []);
      apsPorCand.get(a.candidato_id).push(a);
    }
    for (const [cid, lista] of apsPorCand) {
      porCooperado.get(cid).minutos_apontados = calcularHorasDosApontamentos(lista).totalMinutos;
    }
  }

  return [...porCooperado.values()]
    .map((r) => ({
      ...r,
      minutos_escala: r.minutos_diurnos + r.minutos_noturnos,
      diferenca_minutos: r.minutos_apontados - (r.minutos_diurnos + r.minutos_noturnos),
    }))
    .sort((a, b) => String(a.cooperado_nome).localeCompare(String(b.cooperado_nome)));
}

// ── Valores enviados pelo cliente (importação por matrícula) ────────────────
export async function importarValoresCliente({ competencia, empresaId, linhas }, usuario) {
  await inicializarTabelasEscalaFaturamento();
  intervaloCompetencia(competencia);
  if (!Array.isArray(linhas) || linhas.length === 0) throw erro400('A planilha não possui linhas para importar.');
  const emp = empresaId ? Number(empresaId) : 0;

  const [cands] = await pool.query(
    `SELECT id, nome, matricula FROM ra_candidatos WHERE matricula IS NOT NULL AND matricula <> ''`
  );
  const porMatricula = new Map(cands.map((c) => [normalizarMatricula(c.matricula), c]));

  // Agrupa por cooperado (a mesma matrícula pode vir em mais de uma linha → soma)
  const acumulado = new Map();
  const erros = [];
  const avisos = [];
  linhas.forEach((l, i) => {
    const linha = Number(l.linha) || i + 2;
    const mat = normalizarMatricula(l.matricula);
    if (!mat) {
      const algumValor = CAMPOS_VALORES_CLIENTE.some((k) => numeroOuZero(l[k]) !== 0);
      if (algumValor || String(l.nome || '').trim()) erros.push({ linha, matricula: '', nome: l.nome || '', motivo: 'Matrícula não informada.' });
      return;
    }
    const cand = porMatricula.get(mat);
    if (!cand) {
      erros.push({ linha, matricula: mat, nome: l.nome || '', motivo: 'Matrícula não encontrada no sistema.' });
      return;
    }
    const valores = {};
    for (const k of CAMPOS_VALORES_CLIENTE) {
      const n = numeroOuZero(l[k]);
      if (Number.isNaN(n)) {
        erros.push({ linha, matricula: mat, nome: l.nome || cand.nome, motivo: `Valor inválido na coluna ${k}: "${l[k]}".` });
        return;
      }
      valores[k] = n;
    }
    const nomePlanilha = String(l.nome || '').trim();
    if (nomePlanilha && nomePlanilha.toUpperCase() !== String(cand.nome || '').trim().toUpperCase()) {
      avisos.push({ linha, matricula: mat, nome: nomePlanilha, motivo: `Nome diferente do cadastro (${cand.nome}). Importado pela matrícula.` });
    }
    if (!acumulado.has(cand.id)) {
      acumulado.set(cand.id, { cand, valores: Object.fromEntries(CAMPOS_VALORES_CLIENTE.map((k) => [k, 0])) });
    }
    const acc = acumulado.get(cand.id);
    for (const k of CAMPOS_VALORES_CLIENTE) acc.valores[k] = r2(acc.valores[k] + valores[k]);
  });

  for (const { cand, valores } of acumulado.values()) {
    await pool.query(
      `INSERT INTO supervisao_valores_cliente
         (competencia, empresa_id, candidato_id, matricula, nome, desc_refeicao, bonificacao, desc_estacionamento, desc_farmacia, reembolso, importado_por_id, importado_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         matricula = VALUES(matricula), nome = VALUES(nome),
         desc_refeicao = VALUES(desc_refeicao), bonificacao = VALUES(bonificacao),
         desc_estacionamento = VALUES(desc_estacionamento), desc_farmacia = VALUES(desc_farmacia),
         reembolso = VALUES(reembolso), importado_por_id = VALUES(importado_por_id), importado_por_nome = VALUES(importado_por_nome)`,
      [competencia, emp, cand.id, cand.matricula, cand.nome, valores.desc_refeicao, valores.bonificacao,
        valores.desc_estacionamento, valores.desc_farmacia, valores.reembolso, usuario.id, usuario.nome]
    );
  }

  return { ok: true, importados: acumulado.size, erros, avisos };
}

export async function listarValoresCliente({ competencia, empresaId } = {}) {
  await inicializarTabelasEscalaFaturamento();
  intervaloCompetencia(competencia);
  const [rows] = await pool.query(
    `SELECT v.*, c.nome AS cooperado_nome
       FROM supervisao_valores_cliente v
       JOIN ra_candidatos c ON c.id = v.candidato_id
      WHERE v.competencia = ? AND v.empresa_id = ?
      ORDER BY c.nome`,
    [competencia, empresaId ? Number(empresaId) : 0]
  );
  return rows;
}

export async function excluirValoresCliente({ competencia, empresaId }) {
  await inicializarTabelasEscalaFaturamento();
  intervaloCompetencia(competencia);
  const [res] = await pool.query(
    `DELETE FROM supervisao_valores_cliente WHERE competencia = ? AND empresa_id = ?`,
    [competencia, empresaId ? Number(empresaId) : 0]
  );
  return { ok: true, removidos: res.affectedRows };
}

// ── Planilha de Faturamento / Produtividade ─────────────────────────────────
// Uma linha por alocação (cooperado × atividade × local) da empresa na competência,
// no mesmo formato das planilhas de produtividade enviadas aos clientes.
export async function gerarPlanilhaFaturamento({ empresaId, competencia }) {
  await inicializarTabelasEscalaFaturamento();
  if (!empresaId) throw erro400('Selecione a empresa (cliente).');
  const per = intervaloCompetencia(competencia);
  const emp = Number(empresaId);

  const [[empresa]] = await pool.query(`SELECT id, nome_empresa FROM empresas WHERE id = ?`, [emp]);
  if (!empresa) throw Object.assign(new Error('Empresa não encontrada.'), { status: 404 });

  const [alocacoes] = await pool.query(
    `SELECT a.id, a.candidato_id, a.empresa_id, a.vaga_id, a.unidade_id, a.data_inicio, a.data_fim, a.status,
            c.nome, c.matricula, v.cargo, v.tipo_escala, u.nome_unidade,
            v.horario, v.tempo_refeicao, v.tempo_pausa, v.desconta_refeicao, v.desconta_pausa, v.adicional_noturno
       FROM ra_alocacoes a
       JOIN ra_candidatos c ON c.id = a.candidato_id
       LEFT JOIN parametro_vagas v ON v.id = a.vaga_id
       LEFT JOIN parametro_unidades u ON u.id = a.unidade_id
      WHERE a.empresa_id = ?
        AND a.status <> 'cancelada'
        AND (a.data_inicio IS NULL OR a.data_inicio <= ?)
        AND (a.data_fim IS NULL OR a.data_fim >= ?)
      ORDER BY c.nome, a.data_inicio`,
    [emp, per.fim, per.inicio]
  );
  for (const a of alocacoes) {
    a.vaga_params = a.vaga_id
      ? {
        horario: a.horario, tempo_refeicao: a.tempo_refeicao, tempo_pausa: a.tempo_pausa,
        desconta_refeicao: a.desconta_refeicao, desconta_pausa: a.desconta_pausa, adicional_noturno: a.adicional_noturno,
      }
      : null;
  }

  const candIds = [...new Set(alocacoes.map((a) => a.candidato_id))];

  const [valores] = await pool.query(
    `SELECT v.*, c.nome AS cooperado_nome, c.matricula AS matricula_atual
       FROM supervisao_valores_cliente v
       JOIN ra_candidatos c ON c.id = v.candidato_id
      WHERE v.competencia = ? AND v.empresa_id IN (?, 0)
      ORDER BY v.empresa_id DESC`,
    [competencia, emp]
  );
  // Valores importados para a empresa têm prioridade sobre os importados sem empresa
  const valoresPorCand = new Map();
  for (const v of valores) if (!valoresPorCand.has(v.candidato_id)) valoresPorCand.set(v.candidato_id, v);

  let apontamentos = [];
  let escalas = [];
  let complementos = [];
  let todasAlocacoes = [];
  if (candIds.length) {
    // Margem de 1 dia: plantão que começa no último dia termina no mês seguinte (e vice-versa)
    [apontamentos] = await pool.query(
      `SELECT candidato_id, alocacao_id, vaga_id, data_referencia, tipo_evento, timestamp_dispositivo
         FROM ra_apontamentos
        WHERE candidato_id IN (?) AND data_referencia BETWEEN DATE_SUB(?, INTERVAL 1 DAY) AND DATE_ADD(?, INTERVAL 1 DAY)`,
      [candIds, per.inicio, per.fim]
    );
    [escalas] = await pool.query(
      `SELECT s.candidato_id, s.alocacao_id, s.vaga_id, s.data, s.hora_inicio, s.turno, s.duracao_minutos, s.status,
              COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) AS empresa_id_efetiva
         FROM supervisao_escalas s
         LEFT JOIN supervisao_pacientes p ON p.id = s.paciente_id
         LEFT JOIN ra_alocacoes a ON a.id = s.alocacao_id
        WHERE s.candidato_id IN (?) AND s.data BETWEEN ? AND ? AND s.status <> 'cancelada'`,
      [candIds, per.inicio, per.fim]
    );
    [complementos] = await pool.query(
      `SELECT candidato_id, alocacao_id, data_referencia, tipo, quantidade_minutos, quantidade_horas, valor
         FROM supervisao_horas_complementares
        WHERE candidato_id IN (?) AND data_referencia BETWEEN ? AND ?`,
      [candIds, per.inicio, per.fim]
    ).catch(() => [[]]);
    // Todas as alocações dos cooperados (inclusive em outros clientes) para atribuir batidas sem alocação
    [todasAlocacoes] = await pool.query(
      `SELECT id, candidato_id, empresa_id, vaga_id, data_inicio, data_fim
         FROM ra_alocacoes
        WHERE candidato_id IN (?) AND status <> 'cancelada'
          AND (data_inicio IS NULL OR data_inicio <= ?) AND (data_fim IS NULL OR data_fim >= ?)`,
      [candIds, per.fim, per.inicio]
    );
  }

  const regras = await obterRegrasApuracao();
  const resumos = apurarAlocacoes({
    alocacoes, todasAlocacoes, apontamentos, escalas, complementos,
    periodo: per, hoje: dataLocalISO(), empresaId: emp, regras,
  });

  const primeiraAlocacao = new Map();
  for (const a of alocacoes) if (!primeiraAlocacao.has(a.candidato_id)) primeiraAlocacao.set(a.candidato_id, a.id);

  const diasNoPeriodo = (a) => {
    const ini = a.data_inicio && iso(a.data_inicio) > per.inicio ? iso(a.data_inicio) : per.inicio;
    const fim = a.data_fim && iso(a.data_fim) < per.fim ? iso(a.data_fim) : per.fim;
    const d = Math.round((new Date(`${fim}T12:00:00`) - new Date(`${ini}T12:00:00`)) / 86400000) + 1;
    return Math.max(0, Math.min(30, d));
  };

  const valoresUsados = new Set();
  const linhas = alocacoes.map((a) => {
    const r = resumos.get(Number(a.id));
    const diasTrabalhados = r.dias.size;

    // Valores do cliente entram uma única vez por cooperado (na 1ª linha dele)
    let vc = null;
    if (primeiraAlocacao.get(a.candidato_id) === a.id && valoresPorCand.has(a.candidato_id)) {
      vc = valoresPorCand.get(a.candidato_id);
      valoresUsados.add(a.candidato_id);
    }

    return {
      alocacao_id: a.id,
      candidato_id: a.candidato_id,
      unidade_id: a.unidade_id ?? null,
      vaga_id: a.vaga_id ?? null,
      cooperado: a.nome,
      matricula: a.matricula,
      data_inicio: iso(a.data_inicio),
      desligamento: a.data_fim && iso(a.data_fim) <= per.fim ? iso(a.data_fim) : null,
      atividade: a.cargo || '',
      tipo_escala: a.tipo_escala || null,
      competencia: per.rotulo,
      local: a.nome_unidade || empresa.nome_empresa,
      dias_mes_total: 30,
      dias_mes_fechado: a.tipo_escala === 'mensal' ? diasNoPeriodo(a) : diasTrabalhados,
      dias_trabalhados: diasTrabalhados,
      total_horas: r2(r.minutos_trabalhados / 60),
      horas_apontadas: r2(r.minutos_apontados / 60),
      horas_escala: r2(r.minutos_escala / 60),
      horas_previstas: r2(r.minutos_previstos / 60),
      horas_falta: r2(r.minutos_falta / 60),
      horas_noturnas: r2(r.minutos_noturnos / 60),
      pl_diurno: r.pl_diurno,
      pl_noturno: r.pl_noturno,
      hora_excedente: r2((r.minutos_extra + r.minutos_extra_manual) / 60),
      ad_noturno: r2((r.minutos_ad_noturno + r.minutos_ad_noturno_manual) / 60),
      inconsistencias: r.inconsistencias,
      avisos: r.avisos,
      bonificacao: r2((vc ? Number(vc.bonificacao) : 0) + r.bonificacao_sistema),
      desc_refeicao: vc ? r2(vc.desc_refeicao) : 0,
      desc_estacionamento: vc ? r2(vc.desc_estacionamento) : 0,
      desc_farmacia: vc ? r2(vc.desc_farmacia) : 0,
      reembolso: vc ? r2(vc.reembolso) : 0,
    };
  });

  // Cooperados com valores importados mas sem alocação nesta empresa/competência
  const semAlocacao = [];
  for (const [cid, v] of valoresPorCand) {
    if (valoresUsados.has(cid)) continue;
    // valores "sem empresa" só entram se o cooperado tiver alocação aqui
    if (Number(v.empresa_id) === 0) continue;
    semAlocacao.push(cid);
    linhas.push({
      alocacao_id: null,
      candidato_id: cid,
      unidade_id: null,
      vaga_id: null,
      cooperado: v.cooperado_nome,
      matricula: v.matricula_atual || v.matricula,
      data_inicio: null,
      desligamento: null,
      atividade: '',
      tipo_escala: null,
      competencia: per.rotulo,
      local: empresa.nome_empresa,
      dias_mes_total: 30,
      dias_mes_fechado: 0,
      dias_trabalhados: 0,
      total_horas: 0,
      horas_apontadas: 0,
      horas_escala: 0,
      horas_previstas: 0,
      horas_falta: 0,
      horas_noturnas: 0,
      pl_diurno: 0,
      pl_noturno: 0,
      hora_excedente: 0,
      ad_noturno: 0,
      inconsistencias: [],
      avisos: [],
      bonificacao: r2(v.bonificacao),
      desc_refeicao: r2(v.desc_refeicao),
      desc_estacionamento: r2(v.desc_estacionamento),
      desc_farmacia: r2(v.desc_farmacia),
      reembolso: r2(v.reembolso),
    });
  }

  linhas.sort((x, y) => String(x.cooperado).localeCompare(String(y.cooperado)) || String(x.data_inicio || '').localeCompare(String(y.data_inicio || '')));

  const totalInconsistencias = linhas.reduce((s, l) => s + l.inconsistencias.length, 0);
  return {
    empresa: { id: empresa.id, nome: empresa.nome_empresa },
    competencia: per.rotulo,
    periodo: { inicio: per.inicio, fim: per.fim },
    linhas,
    regras,
    tipos_inconsistencia: TIPOS_INCONSISTENCIA,
    total_inconsistencias: totalInconsistencias,
    avisos: semAlocacao.length
      ? [`${semAlocacao.length} cooperado(s) com valores importados não possuem alocação nesta empresa na competência; foram incluídos ao final, sem dados de jornada.`]
      : [],
  };
}
