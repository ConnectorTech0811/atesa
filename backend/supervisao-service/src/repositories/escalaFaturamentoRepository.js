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

      // Substituição de cooperado: o plantão do titular fica cancelado e apontando para quem cobriu;
      // o plantão novo do substituto aponta para quem ele cobre
      for (const col of ['substituicao_id INT NULL', 'cobre_candidato_id INT NULL', 'substituido_por_id INT NULL']) {
        try { await pool.query(`ALTER TABLE supervisao_escalas ADD COLUMN ${col}`); } catch { /* coluna já existe */ }
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS supervisao_substituicoes (
          id INT AUTO_INCREMENT PRIMARY KEY,
          tipo ENUM('cobertura', 'definitiva') NOT NULL,
          periodo VARCHAR(20) NOT NULL,
          titular_id INT NOT NULL,
          substituto_id INT NOT NULL,
          escala_origem_id INT NULL,
          alocacao_titular_id INT NULL,
          alocacao_substituto_id INT NULL,
          empresa_id INT NULL,
          unidade_id INT NULL,
          vaga_id INT NULL,
          paciente_id INT NULL,
          posto VARCHAR(300) NULL,
          data_inicio DATE NOT NULL,
          data_fim DATE NULL,
          motivo_tipo VARCHAR(30) NOT NULL,
          motivo TEXT NOT NULL,
          plantoes INT NOT NULL DEFAULT 0,
          usuario_id INT NULL,
          usuario_nome VARCHAR(150) NULL,
          usuario_perfil VARCHAR(50) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_ssub_titular (titular_id),
          INDEX idx_ssub_substituto (substituto_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);
      try { await pool.query(`ALTER TABLE supervisao_substituicoes ADD COLUMN usuario_perfil VARCHAR(50) NULL AFTER usuario_nome`); } catch { /* coluna já existe */ }
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
// Clientes permitidos (Set de empresa_id) da escalista; null = sem restrição. Ver escalistasRepository.
const permite = (permitidos, empresaId) => !permitidos || permitidos.has(Number(empresaId));
function exigirClientePermitido(permitidos, empresaId) {
  if (!permite(permitidos, empresaId)) {
    throw Object.assign(new Error('Este cliente não está liberado para o seu usuário. Peça ao administrador para liberar em Cadastro de Usuários → Escalistas.'), { status: 403 });
  }
}
/**
 * Cooperados que a escalista pode escalar: alocação ativa em um cliente permitido ou plantão
 * já lançado em um cliente permitido. null = sem restrição.
 */
async function cooperadosPermitidos(permitidos) {
  if (!permitidos) return null;
  if (!permitidos.size) return new Set();
  const ids = [...permitidos];
  const [rows] = await pool.query(
    `SELECT candidato_id FROM ra_alocacoes WHERE status = 'ativa' AND empresa_id IN (?)
     UNION
     SELECT s.candidato_id FROM supervisao_escalas s
       LEFT JOIN supervisao_pacientes p ON p.id = s.paciente_id
       LEFT JOIN ra_alocacoes a ON a.id = s.alocacao_id
      WHERE COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) IN (?)`,
    [ids, ids]
  );
  return new Set(rows.map((r) => Number(r.candidato_id)));
}
async function exigirCooperadoPermitido(permitidos, candidatoId) {
  const coops = await cooperadosPermitidos(permitidos);
  if (coops && !coops.has(Number(candidatoId))) {
    throw Object.assign(new Error('Este cooperado não está alocado em nenhum cliente liberado para o seu usuário.'), { status: 403 });
  }
}

async function empresaDaEscala(id) {
  const [[e]] = await pool.query(
    `SELECT s.data, COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) AS empresa_id
       FROM supervisao_escalas s
       LEFT JOIN supervisao_pacientes p ON p.id = s.paciente_id
       LEFT JOIN ra_alocacoes a ON a.id = s.alocacao_id
      WHERE s.id = ?`,
    [Number(id)]
  );
  return e ?? null;
}

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
export async function listarOpcoesEscala(permitidos = null) {
  await inicializarTabelasEscalaFaturamento();
  const [cooperados] = await pool.query(
    `SELECT id, nome, matricula FROM ra_candidatos
      WHERE matricula IS NOT NULL AND matricula <> '' AND inativado_em IS NULL
      ORDER BY nome`
  );
  const [empresas] = await pool.query(`SELECT id, nome_empresa FROM empresas ORDER BY nome_empresa`);
  const [alocacoes] = await pool.query(
    `SELECT a.id, a.candidato_id, a.empresa_id, a.unidade_id, a.vaga_id, a.status, a.data_inicio, a.data_fim,
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
      WHERE u.ativa = 1 AND v.ativa = 1
      ORDER BY u.nome_unidade, v.cargo`
  );
  if (permitidos) {
    const coops = await cooperadosPermitidos(permitidos);
    return {
      cooperados: cooperados.filter((c) => coops.has(Number(c.id))),
      empresas: empresas.filter((e) => permite(permitidos, e.id)),
      alocacoes: alocacoes.filter((a) => permite(permitidos, a.empresa_id)),
      vagas: vagas.filter((v) => permite(permitidos, v.empresa_id)),
    };
  }
  return { cooperados, empresas, alocacoes, vagas };
}

// ── Pacientes / Locais ───────────────────────────────────────────────────────
export async function listarPacientes({ busca, empresaId, incluirInativos } = {}, permitidos = null) {
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
  // Paciente sem cliente vinculado fica visível para todos
  return permitidos ? rows.filter((p) => !p.empresa_id || permite(permitidos, p.empresa_id)) : rows;
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
export async function listarEscalas({ dataInicio, dataFim, candidatoId, pacienteId, empresaId, turno, status } = {}, permitidos = null) {
  await inicializarTabelasEscalaFaturamento();
  let sql = `
    SELECT s.*, c.nome AS cooperado_nome, c.matricula,
           p.nome AS paciente_nome, p.tipo AS paciente_tipo, p.endereco AS paciente_endereco,
           p.patologia AS paciente_patologia, p.cuidados AS paciente_cuidados,
           COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) AS empresa_id_efetiva,
           e.nome_empresa, pu.nome_unidade,
           cc.nome AS cobre_nome, cs.nome AS substituido_por_nome,
           ss.tipo AS substituicao_tipo, ss.usuario_nome AS substituicao_autor,
           ss.usuario_perfil AS substituicao_autor_perfil, ss.criado_em AS substituicao_em
      FROM supervisao_escalas s
      JOIN ra_candidatos c ON c.id = s.candidato_id
      LEFT JOIN ra_candidatos cc ON cc.id = s.cobre_candidato_id
      LEFT JOIN ra_candidatos cs ON cs.id = s.substituido_por_id
      LEFT JOIN supervisao_substituicoes ss ON ss.id = s.substituicao_id
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
  return permitidos ? rows.filter((e) => permite(permitidos, e.empresa_id_efetiva)) : rows;
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

export async function criarEscala(dados, usuario, permitidos = null) {
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
  exigirClientePermitido(permitidos, base.empresa_id);
  await exigirCooperadoPermitido(permitidos, base.candidato_id);
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

export async function atualizarEscala(id, dados, permitidos = null) {
  await inicializarTabelasEscalaFaturamento();
  const anterior = await empresaDaEscala(id);
  if (!anterior) throw Object.assign(new Error('Escala não encontrada.'), { status: 404 });
  exigirClientePermitido(permitidos, anterior.empresa_id);
  const e = await montarEscala(dados);
  exigirClientePermitido(permitidos, e.empresa_id);
  await exigirCooperadoPermitido(permitidos, e.candidato_id);
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

export async function excluirEscala(id, permitidos = null) {
  await inicializarTabelasEscalaFaturamento();
  const anterior = await empresaDaEscala(id);
  if (!anterior) throw Object.assign(new Error('Escala não encontrada.'), { status: 404 });
  exigirClientePermitido(permitidos, anterior.empresa_id);
  await exigirCompetenciaAberta([anterior.data], 'excluir este plantão');
  const [res] = await pool.query(`DELETE FROM supervisao_escalas WHERE id = ?`, [Number(id)]);
  if (!res.affectedRows) throw Object.assign(new Error('Escala não encontrada.'), { status: 404 });
  return { ok: true };
}

// ── Substituição de cooperado (cobertura de falta ou troca definitiva) ──────
// O titular sai do posto/vaga e outro cooperado assume os plantões previstos do período:
//  • cobertura (1 dia, 7 dias, 15 dias, 1 mês ou período informado): os plantões do titular
//    ficam cancelados (com o nome de quem cobriu) e são lançados iguais para o substituto;
//  • definitiva: além dos plantões a partir da data, a alocação do titular no posto é encerrada
//    e o substituto passa a ser alocado na vaga (contrato).
export const PERIODOS_SUBSTITUICAO = ['1d', '7d', '15d', '1m', 'personalizado', 'definitiva'];
export const MOTIVOS_SUBSTITUICAO = {
  falta: 'Falta',
  imprevisto: 'Imprevisto',
  atestado: 'Atestado / afastamento',
  ferias: 'Férias',
  desligamento: 'Desligamento',
  outro: 'Outro',
};
const DIAS_PERIODO = { '1d': 1, '7d': 7, '15d': 15 };
export const ROTULO_PERFIL = {
  administrador: 'Administrador', consultor: 'Consultor', executivo_contas: 'Executivo de Contas', parametro: 'Parâmetro',
  ra: 'RA', beneficios: 'Benefícios', supervisao: 'Supervisão', faturamento: 'Faturamento', financeiro: 'Financeiro',
  suporte: 'Suporte', escalista: 'Escalista',
};
const MAX_DIAS_PERSONALIZADO = 366;

function somarDias(isoData, n) {
  const [a, m, d] = isoData.split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
function somarMeses(isoData, n) {
  const [a, m, d] = isoData.split('-').map(Number);
  const ultimo = new Date(Date.UTC(a, m - 1 + n + 1, 0)).getUTCDate();
  return new Date(Date.UTC(a, m - 1 + n, Math.min(d, ultimo))).toISOString().slice(0, 10);
}

/** Data final da cobertura (inclusive); null na substituição definitiva. */
export function fimDaCobertura(periodo, dataInicio, dataFimInformada) {
  if (periodo === 'definitiva') return null;
  if (DIAS_PERIODO[periodo]) return somarDias(dataInicio, DIAS_PERIODO[periodo] - 1);
  if (periodo === '1m') return somarDias(somarMeses(dataInicio, 1), -1);
  if (!validarData(dataFimInformada)) throw erro400('Informe a data final da cobertura.');
  if (dataFimInformada < dataInicio) throw erro400('A data final da cobertura deve ser igual ou posterior à inicial.');
  if (dataFimInformada > somarDias(dataInicio, MAX_DIAS_PERSONALIZADO)) throw erro400('A cobertura pode ter no máximo 1 ano. Para trocar o cooperado de vez, use "Assumir a vaga (definitivo)".');
  return dataFimInformada;
}

/** Plantões do titular naquele posto: mesma vaga (ou alocação) e, se houver, mesmo paciente. */
function filtroDoPosto(posto) {
  const cond = [];
  const params = [];
  if (posto.vaga_id && posto.alocacao_id) {
    cond.push('(s.vaga_id = ? OR (s.vaga_id IS NULL AND s.alocacao_id = ?))');
    params.push(posto.vaga_id, posto.alocacao_id);
  } else if (posto.vaga_id) {
    cond.push('s.vaga_id = ?'); params.push(posto.vaga_id);
  } else if (posto.unidade_id) {
    cond.push('s.unidade_id = ?'); params.push(posto.unidade_id);
  } else if (posto.alocacao_id) {
    cond.push('s.alocacao_id = ?'); params.push(posto.alocacao_id);
  } else if (!posto.paciente_id) {
    cond.push('COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) <=> ?'); params.push(posto.empresa_id);
  }
  if (posto.paciente_id) { cond.push('s.paciente_id = ?'); params.push(posto.paciente_id); }
  return { cond, params };
}

async function descreverPosto(posto) {
  const [[r]] = await pool.query(
    `SELECT (SELECT cargo FROM parametro_vagas WHERE id = ?) AS cargo,
            (SELECT nome_unidade FROM parametro_unidades WHERE id = ?) AS unidade,
            (SELECT nome FROM supervisao_pacientes WHERE id = ?) AS paciente,
            (SELECT nome_empresa FROM empresas WHERE id = ?) AS empresa`,
    [posto.vaga_id, posto.unidade_id, posto.paciente_id, posto.empresa_id]
  );
  return [r.cargo || posto.atividade, r.paciente || r.unidade, r.empresa].filter(Boolean).join(' · ') || 'Posto sem identificação';
}

/**
 * Dados para o modal: a origem (plantão em Escalas ou alocação ativa no Monitoramento),
 * o posto e os plantões previstos do titular a partir da data.
 */
async function resolverOrigemSubstituicao(dados) {
  if (dados.escalaId) {
    const [[esc]] = await pool.query(
      `SELECT s.*, COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) AS empresa_id_efetiva
         FROM supervisao_escalas s
         LEFT JOIN supervisao_pacientes p ON p.id = s.paciente_id
         LEFT JOIN ra_alocacoes a ON a.id = s.alocacao_id
        WHERE s.id = ?`,
      [Number(dados.escalaId)]
    );
    if (!esc) throw Object.assign(new Error('Plantão não encontrado. Atualize a lista.'), { status: 404 });
    if (esc.status !== 'prevista') throw erro400('Só plantões com situação "Prevista" podem ser substituídos.');
    const [[alocTitular]] = await pool.query(
      `SELECT * FROM ra_alocacoes
        WHERE candidato_id = ? AND status = 'ativa' AND (id = ? OR (vaga_id = ? AND ? IS NOT NULL))
        ORDER BY id = ? DESC LIMIT 1`,
      [esc.candidato_id, esc.alocacao_id ?? 0, esc.vaga_id ?? 0, esc.vaga_id, esc.alocacao_id ?? 0]
    );
    return {
      titularId: esc.candidato_id,
      dataInicio: iso(esc.data),
      escalaOrigemId: esc.id,
      alocTitular: alocTitular || null,
      posto: {
        empresa_id: esc.empresa_id_efetiva, unidade_id: esc.unidade_id, vaga_id: esc.vaga_id,
        paciente_id: esc.paciente_id, alocacao_id: esc.alocacao_id, atividade: esc.atividade,
      },
    };
  }
  const titularId = Number(dados.candidatoId);
  if (!titularId) throw erro400('Informe o plantão ou o cooperado a ser substituído.');
  if (!validarData(dados.dataInicio)) throw erro400('Informe a data de início da substituição.');
  const [alocs] = await pool.query(
    `SELECT * FROM ra_alocacoes WHERE candidato_id = ? AND status = 'ativa' ${dados.alocacaoId ? 'AND id = ?' : ''} ORDER BY data_inicio DESC`,
    dados.alocacaoId ? [titularId, Number(dados.alocacaoId)] : [titularId]
  );
  if (!alocs.length) throw erro400('O cooperado não tem alocação ativa (vaga/posto) para ser substituída.');
  const aloc = alocs[0];
  return {
    titularId,
    dataInicio: dados.dataInicio,
    escalaOrigemId: null,
    alocTitular: aloc,
    posto: { empresa_id: aloc.empresa_id, unidade_id: aloc.unidade_id, vaga_id: aloc.vaga_id, paciente_id: null, alocacao_id: aloc.id, atividade: null },
  };
}

async function plantoesDoTitular(origem, dataFim) {
  const { cond, params } = filtroDoPosto(origem.posto);
  const [rows] = await pool.query(
    `SELECT s.* FROM supervisao_escalas s
       LEFT JOIN supervisao_pacientes p ON p.id = s.paciente_id
       LEFT JOIN ra_alocacoes a ON a.id = s.alocacao_id
      WHERE s.candidato_id = ? AND s.status = 'prevista' AND s.data >= ?
        ${dataFim ? 'AND s.data <= ?' : ''}
        ${cond.map((c) => `AND ${c}`).join(' ')}
      ORDER BY s.data, s.hora_inicio
      LIMIT ${MAX_PLANTOES_POR_LANCAMENTO + 1}`,
    [origem.titularId, origem.dataInicio, ...(dataFim ? [dataFim] : []), ...params]
  );
  if (rows.length > MAX_PLANTOES_POR_LANCAMENTO) {
    throw erro400(`O período tem mais de ${MAX_PLANTOES_POR_LANCAMENTO} plantões. Reduza o período da cobertura.`);
  }
  return rows;
}

/** Prévia para o modal: posto, período calculado e plantões que passarão para o substituto. */
export async function previaSubstituicao(dados, permitidos = null) {
  await inicializarTabelasEscalaFaturamento();
  const origem = await resolverOrigemSubstituicao(dados);
  exigirClientePermitido(permitidos, origem.posto.empresa_id);
  const periodo = PERIODOS_SUBSTITUICAO.includes(dados.periodo) ? dados.periodo : '1d';
  const dataFim = fimDaCobertura(periodo, origem.dataInicio, dados.dataFim || origem.dataInicio);
  const plantoes = await plantoesDoTitular(origem, dataFim);
  return {
    titularId: origem.titularId,
    dataInicio: origem.dataInicio,
    dataFim,
    posto: await descreverPosto(origem.posto),
    vagaId: origem.posto.vaga_id ?? null,
    alocacaoTitularId: origem.alocTitular?.id ?? null,
    plantoes: plantoes.map((p) => ({ id: p.id, data: iso(p.data), hora_inicio: String(p.hora_inicio).slice(0, 5), hora_fim: String(p.hora_fim).slice(0, 5) })),
  };
}

/**
 * Histórico de substituições/coberturas (imutável): quem saiu, quem cobriu, posto/vaga, período,
 * motivo e o autor (nome, perfil, data/hora). Filtra por cooperado (titular ou substituto), vaga,
 * cliente e período da cobertura.
 */
export async function listarSubstituicoes({ candidatoId, vagaId, empresaId, dataInicio, dataFim, busca } = {}, permitidos = null) {
  await inicializarTabelasEscalaFaturamento();
  const cond = [];
  const params = [];
  if (candidatoId) { cond.push('(ss.titular_id = ? OR ss.substituto_id = ?)'); params.push(Number(candidatoId), Number(candidatoId)); }
  if (vagaId) { cond.push('ss.vaga_id = ?'); params.push(Number(vagaId)); }
  if (empresaId) { cond.push('ss.empresa_id = ?'); params.push(Number(empresaId)); }
  // Cobertura que encosta no período (a definitiva não tem fim)
  if (validarData(dataFim)) { cond.push('ss.data_inicio <= ?'); params.push(dataFim); }
  if (validarData(dataInicio)) { cond.push('(ss.data_fim IS NULL OR ss.data_fim >= ?)'); params.push(dataInicio); }
  if (busca && String(busca).trim()) {
    const b = `%${String(busca).trim()}%`;
    cond.push('(t.nome LIKE ? OR su.nome LIKE ? OR t.matricula LIKE ? OR su.matricula LIKE ? OR ss.posto LIKE ? OR ss.usuario_nome LIKE ?)');
    params.push(b, b, b, b, b, b);
  }
  const [rows] = await pool.query(
    `SELECT ss.*, t.nome AS titular_nome, t.matricula AS titular_matricula,
            su.nome AS substituto_nome, su.matricula AS substituto_matricula,
            e.nome_empresa, v.cargo AS vaga_cargo, u.nome_unidade
       FROM supervisao_substituicoes ss
       JOIN ra_candidatos t ON t.id = ss.titular_id
       JOIN ra_candidatos su ON su.id = ss.substituto_id
       LEFT JOIN empresas e ON e.id = ss.empresa_id
       LEFT JOIN parametro_vagas v ON v.id = ss.vaga_id
       LEFT JOIN parametro_unidades u ON u.id = ss.unidade_id
      ${cond.length ? `WHERE ${cond.join(' AND ')}` : ''}
      ORDER BY ss.criado_em DESC, ss.id DESC
      LIMIT 1000`,
    params
  );
  return rows.filter((r) => permite(permitidos, r.empresa_id)).map((r) => ({
    ...r,
    data_inicio: iso(r.data_inicio),
    data_fim: iso(r.data_fim),
    motivo_rotulo: MOTIVOS_SUBSTITUICAO[r.motivo_tipo] ?? r.motivo_tipo,
    usuario_perfil_rotulo: ROTULO_PERFIL[r.usuario_perfil] ?? r.usuario_perfil ?? null,
  }));
}

export async function substituirCooperado(dados, usuario, permitidos = null) {
  await inicializarTabelasEscalaFaturamento();
  const substitutoId = Number(dados.substitutoId);
  const periodo = String(dados.periodo || '');
  const motivoTipo = String(dados.motivoTipo || '');
  const motivo = String(dados.motivo || '').trim();
  if (!substitutoId) throw erro400('Selecione o cooperado que vai cobrir.');
  if (!PERIODOS_SUBSTITUICAO.includes(periodo)) throw erro400('Selecione o período da cobertura.');
  if (!MOTIVOS_SUBSTITUICAO[motivoTipo]) throw erro400('Selecione o motivo da substituição.');
  if (!motivo) throw erro400('Informe obrigatoriamente a justificativa da substituição.');

  const origem = await resolverOrigemSubstituicao(dados);
  exigirClientePermitido(permitidos, origem.posto.empresa_id);
  await exigirCooperadoPermitido(permitidos, substitutoId);
  if (substitutoId === Number(origem.titularId)) throw erro400('O substituto deve ser outro cooperado.');
  const definitiva = periodo === 'definitiva';
  const dataFim = fimDaCobertura(periodo, origem.dataInicio, dados.dataFim);

  const [pessoas] = await pool.query(
    `SELECT id, nome, inativado_em FROM ra_candidatos WHERE id IN (?, ?)`,
    [origem.titularId, substitutoId]
  );
  const titular = pessoas.find((c) => c.id === Number(origem.titularId));
  const substituto = pessoas.find((c) => c.id === substitutoId);
  if (!substituto || substituto.inativado_em) throw erro400('Cooperado substituto não encontrado ou inativo.');

  const plantoes = await plantoesDoTitular(origem, dataFim);
  if (!definitiva && plantoes.length === 0) {
    throw erro400('O titular não tem plantões previstos neste posto no período escolhido. Lance a escala antes ou escolha outro período.');
  }

  // Vaga parametrizada do posto: obrigatória para alocar o substituto em definitivo
  const vagaId = origem.posto.vaga_id ?? origem.alocTitular?.vaga_id ?? null;
  let vaga = null;
  if (vagaId) {
    [[vaga]] = await pool.query(
      `SELECT v.id, v.cargo, v.unidade_id, u.empresa_id
         FROM parametro_vagas v JOIN parametro_unidades u ON u.id = v.unidade_id WHERE v.id = ?`,
      [vagaId]
    );
  }
  if (definitiva && !vaga) {
    throw erro400('Para o substituto assumir a vaga em definitivo, o plantão precisa estar vinculado a uma atividade parametrizada (vaga) do Parâmetro.');
  }

  const novas = plantoes.map((p) => ({
    ...p,
    data: iso(p.data),
    hora_inicio: String(p.hora_inicio).slice(0, 5),
    hora_fim: String(p.hora_fim).slice(0, 5),
  }));
  await exigirCompetenciaAberta([origem.dataInicio, ...novas.map((n) => n.data)], 'substituir o cooperado');
  await validarConflitos(substitutoId, novas);

  const postoTexto = await descreverPosto(origem.posto);
  const fmt = (d) => (d ? fmtDataBR(d) : '');
  const periodoTexto = definitiva ? `a partir de ${fmt(origem.dataInicio)} (definitivo)`
    : dataFim === origem.dataInicio ? `em ${fmt(origem.dataInicio)}` : `de ${fmt(origem.dataInicio)} a ${fmt(dataFim)}`;
  const motivoTexto = `${MOTIVOS_SUBSTITUICAO[motivoTipo]}: ${motivo}`;
  const diaAnterior = somarDias(origem.dataInicio, -1);
  // Autoria gravada junto de cada registro (plantões, alocações e histórico)
  const perfil = usuario.tipoUsuario || 'supervisao';
  const agora = new Date();
  const autoria = `registrado por ${usuario.nome} (${ROTULO_PERFIL[perfil] ?? perfil}) em ${agora.toLocaleDateString('pt-BR')} ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();

    // Definitiva: encerra a alocação do titular no posto e aloca o substituto na vaga
    let alocSubstitutoId = null;
    if (definitiva) {
      if (origem.alocTitular) {
        await conexao.query(
          `UPDATE ra_alocacoes
              SET status = 'encerrada', data_fim = GREATEST(data_inicio, ?), encerrado_em = NOW(),
                  encerrado_por_id = ?, encerrado_por_nome = ?,
                  observacoes = CONCAT(COALESCE(observacoes, ''), ?)
            WHERE id = ? AND status = 'ativa'`,
          [diaAnterior, usuario.id, usuario.nome,
            `\n[Substituído por ${substituto.nome} a partir de ${fmt(origem.dataInicio)} — ${motivoTexto} — ${autoria}]`,
            origem.alocTitular.id]
        );
      }
      const [ativasSub] = await conexao.query(
        `SELECT id, vaga_id FROM ra_alocacoes WHERE candidato_id = ? AND status = 'ativa' FOR UPDATE`,
        [substitutoId]
      );
      const naVaga = ativasSub.find((a) => Number(a.vaga_id) === Number(vaga.id));
      if (naVaga) {
        alocSubstitutoId = naVaga.id;
      } else {
        if (dados.encerrarAlocacaoAtualSubstituto && ativasSub.length) {
          await conexao.query(
            `UPDATE ra_alocacoes
                SET status = 'encerrada', data_fim = GREATEST(data_inicio, ?), encerrado_em = NOW(),
                    encerrado_por_id = ?, encerrado_por_nome = ?,
                    observacoes = CONCAT(COALESCE(observacoes, ''), ?)
              WHERE id IN (?)`,
            [diaAnterior, usuario.id, usuario.nome,
              `\n[Transferido para ${postoTexto} a partir de ${fmt(origem.dataInicio)}, substituindo ${titular?.nome ?? ''} — ${autoria}]`,
              ativasSub.map((a) => a.id)]
          );
        }
        const [ins] = await conexao.query(
          `INSERT INTO ra_alocacoes
             (candidato_id, vaga_id, unidade_id, empresa_id, data_inicio, observacoes, status, criado_por_id, criado_por_nome)
           VALUES (?, ?, ?, ?, ?, ?, 'ativa', ?, ?)`,
          [substitutoId, vaga.id, vaga.unidade_id, vaga.empresa_id, origem.dataInicio,
            `Assumiu a vaga de ${titular?.nome ?? 'outro cooperado'} (substituição definitiva) — ${motivoTexto} — ${autoria}`,
            usuario.id, usuario.nome]
        );
        alocSubstitutoId = ins.insertId;
      }
    }

    const [sub] = await conexao.query(
      `INSERT INTO supervisao_substituicoes
         (tipo, periodo, titular_id, substituto_id, escala_origem_id, alocacao_titular_id, alocacao_substituto_id,
          empresa_id, unidade_id, vaga_id, paciente_id, posto, data_inicio, data_fim, motivo_tipo, motivo, plantoes,
          usuario_id, usuario_nome, usuario_perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [definitiva ? 'definitiva' : 'cobertura', periodo, origem.titularId, substitutoId, origem.escalaOrigemId,
        origem.alocTitular?.id ?? null, alocSubstitutoId, origem.posto.empresa_id ?? null, origem.posto.unidade_id ?? null,
        vagaId, origem.posto.paciente_id ?? null, postoTexto.slice(0, 300), origem.dataInicio, dataFim, motivoTipo, motivo,
        novas.length, usuario.id, usuario.nome, perfil]
    );
    const substituicaoId = sub.insertId;

    if (novas.length) {
      // Plantões do titular: cancelados, com o registro de quem cobriu (histórico preservado)
      await conexao.query(
        `UPDATE supervisao_escalas
            SET status = 'cancelada', substituicao_id = ?, substituido_por_id = ?,
                observacao = CONCAT_WS('\n', NULLIF(observacao, ''), ?)
          WHERE id IN (?)`,
        [substituicaoId, substitutoId, `Substituído por ${substituto.nome} — ${motivoTexto} — ${autoria}`, novas.map((n) => n.id)]
      );
      // Mesmos plantões para o substituto (alocação só na definitiva: na cobertura ele não é do posto)
      const valores = novas.map((n) => [substitutoId, n.paciente_id, definitiva ? alocSubstitutoId : null, n.empresa_id, n.unidade_id,
        n.vaga_id, n.atividade, n.data, n.hora_inicio, n.hora_fim, n.duracao_minutos, n.turno, 'prevista',
        `Cobertura de ${titular?.nome ?? 'outro cooperado'} — ${motivoTexto} — ${autoria}`, usuario.id, usuario.nome,
        substituicaoId, origem.titularId]);
      await conexao.query(
        `INSERT INTO supervisao_escalas
           (candidato_id, paciente_id, alocacao_id, empresa_id, unidade_id, vaga_id, atividade,
            data, hora_inicio, hora_fim, duracao_minutos, turno, status, observacao, criado_por_id, criado_por_nome,
            substituicao_id, cobre_candidato_id)
         VALUES ?`,
        [valores]
      );
    }

    // Linha do tempo (Monitoramento → cooperado) dos dois cooperados
    const tipoHist = definitiva ? 'substituicao' : 'cobertura';
    const historico = [
      [origem.titularId, origem.alocTitular?.id ?? 0, tipoHist, vagaId, postoTexto,
        null, definitiva ? `Saiu do posto — vaga assumida por ${substituto.nome}` : `Coberto por ${substituto.nome} ${periodoTexto}`],
      [substitutoId, alocSubstitutoId ?? 0, tipoHist, null, null,
        vagaId, definitiva ? `${postoTexto} (assumiu a vaga de ${titular?.nome ?? ''})` : `Cobertura de ${titular?.nome ?? ''} em ${postoTexto} ${periodoTexto}`],
    ];
    for (const h of historico) {
      await conexao.query(
        `INSERT INTO supervisao_historico_operacao
           (candidato_id, alocacao_id, tipo_alteracao, vaga_anterior_id, vaga_anterior_nome, vaga_nova_id, vaga_nova_nome, motivo, usuario_id, usuario_nome, usuario_perfil)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...h, `${motivoTexto} (${novas.length} plantão(ões))`, usuario.id, usuario.nome, perfil]
      );
    }
    await conexao.query(
      `INSERT INTO supervisao_auditoria_apontamentos
         (apontamento_id, candidato_id, candidato_nome, usuario_id, usuario_nome, usuario_perfil, acao, campo, valor_anterior, valor_novo, motivo, origem)
       VALUES (0, ?, ?, ?, ?, ?, 'edicao', 'substituicao', ?, ?, ?, 'web_supervisao')`,
      [origem.titularId, titular?.nome ?? '', usuario.id, usuario.nome, perfil,
        `${titular?.nome ?? ''} em ${postoTexto}`, `${substituto.nome} ${periodoTexto}`, motivoTexto]
    );

    await conexao.commit();
    return {
      ok: true,
      id: substituicaoId,
      tipo: definitiva ? 'definitiva' : 'cobertura',
      plantoes: novas.length,
      dataInicio: origem.dataInicio,
      dataFim,
      alocacaoSubstitutoId: alocSubstitutoId,
    };
  } catch (err) {
    await conexao.rollback();
    throw err;
  } finally {
    conexao.release();
  }
}

// ── Conferência da Supervisão: plantões diurnos/noturnos × horas apontadas ──
export async function conferenciaPlantoes({ dataInicio, dataFim, empresaId, candidatoId } = {}, permitidos = null) {
  await inicializarTabelasEscalaFaturamento();
  if (!validarData(dataInicio) || !validarData(dataFim)) throw erro400('Informe o período (data início e data fim).');

  const escalas = (await listarEscalas({ dataInicio, dataFim, empresaId, candidatoId }, permitidos))
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

  // Cooperados com plantão na escala deste cliente e sem alocação ativa aqui no período
  // (cobertura de falta, alocação encerrada ou ainda não feita pelo RA): ganham uma linha própria,
  // senão os plantões deles nunca apareciam na planilha.
  const [escalasDoCliente] = await pool.query(
    `SELECT s.candidato_id, s.vaga_id, s.unidade_id, s.atividade, c.nome, c.matricula,
            v.cargo, v.tipo_escala, u.nome_unidade,
            v.horario, v.tempo_refeicao, v.tempo_pausa, v.desconta_refeicao, v.desconta_pausa, v.adicional_noturno
       FROM supervisao_escalas s
       JOIN ra_candidatos c ON c.id = s.candidato_id
       LEFT JOIN supervisao_pacientes p ON p.id = s.paciente_id
       LEFT JOIN ra_alocacoes a ON a.id = s.alocacao_id
       LEFT JOIN parametro_vagas v ON v.id = s.vaga_id
       LEFT JOIN parametro_unidades u ON u.id = s.unidade_id
      WHERE COALESCE(s.empresa_id, p.empresa_id, a.empresa_id) = ?
        AND s.data BETWEEN ? AND ? AND s.status <> 'cancelada'
      ORDER BY s.data`,
    [emp, per.inicio, per.fim]
  );
  const comAlocacao = new Set(alocacoes.map((a) => a.candidato_id));
  for (const e of escalasDoCliente) {
    if (comAlocacao.has(e.candidato_id)) continue;
    comAlocacao.add(e.candidato_id);
    alocacoes.push({
      // id negativo: só identifica a linha na apuração; na planilha sai sem alocacao_id
      id: -Number(e.candidato_id), sem_alocacao: true,
      candidato_id: e.candidato_id, empresa_id: emp, vaga_id: e.vaga_id, unidade_id: e.unidade_id,
      data_inicio: null, data_fim: null, nome: e.nome, matricula: e.matricula,
      cargo: e.cargo || e.atividade, tipo_escala: e.tipo_escala, nome_unidade: e.nome_unidade,
      vaga_params: e.vaga_id
        ? {
          horario: e.horario, tempo_refeicao: e.tempo_refeicao, tempo_pausa: e.tempo_pausa,
          desconta_refeicao: e.desconta_refeicao, desconta_pausa: e.desconta_pausa, adicional_noturno: e.adicional_noturno,
        }
        : null,
    });
  }
  alocacoes.sort((a, b) => String(a.nome).localeCompare(String(b.nome), 'pt-BR'));

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

  // Regra de apuração do próprio cliente (ou o padrão do sistema, se ele não tiver uma)
  const regras = await obterRegrasApuracao(emp);
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
      alocacao_id: a.sem_alocacao ? null : a.id,
      // 'escala': cooperado sem alocação ativa no cliente, com plantões na escala dele
      origem: a.sem_alocacao ? 'escala' : 'alocacao',
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
      origem: 'valores_cliente',
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
