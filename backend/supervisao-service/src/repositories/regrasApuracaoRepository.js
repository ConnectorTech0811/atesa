// ── Regras de apuração de jornada, por cliente ──────────────────────────────
// Cada cliente (empresa) tem a sua regra. Cliente sem regra própria usa o padrão do sistema:
// REGRAS_PADRAO + o que foi salvo na regra geral antiga (faturamento_regras_apuracao, id = 1),
// que deixou de ser editável pela tela. Toda alteração fica no histórico com autor e perfil.
import { pool } from '../config/database.js';
import { REGRAS_PADRAO, horaParaMin } from './apuracaoJornadas.js';

let inicializado = null;
function inicializar() {
  if (!inicializado) {
    inicializado = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS faturamento_regras_apuracao (
          id TINYINT PRIMARY KEY DEFAULT 1,
          regras_json TEXT NOT NULL,
          atualizado_por_id INT NULL,
          atualizado_por_nome VARCHAR(150) NULL,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS faturamento_regras_apuracao_cliente (
          empresa_id INT PRIMARY KEY,
          regras_json TEXT NOT NULL,
          atualizado_por_id INT NULL,
          atualizado_por_nome VARCHAR(150) NULL,
          atualizado_por_perfil VARCHAR(50) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS faturamento_regras_apuracao_historico (
          id INT AUTO_INCREMENT PRIMARY KEY,
          empresa_id INT NOT NULL,
          acao ENUM('personalizacao', 'alteracao', 'restauracao_padrao') NOT NULL,
          regras_anteriores_json TEXT NULL,
          regras_novas_json TEXT NULL,
          usuario_id INT NULL,
          usuario_nome VARCHAR(150) NULL,
          usuario_perfil VARCHAR(50) NULL,
          criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          INDEX idx_frah_empresa (empresa_id, criado_em)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
      `);
    })().catch((e) => { inicializado = null; throw e; });
  }
  return inicializado;
}

function erro400(msg) {
  return Object.assign(new Error(msg), { status: 400 });
}

const CHAVES = Object.keys(REGRAS_PADRAO);
const somenteRegras = (r) => Object.fromEntries(CHAVES.map((k) => [k, r[k]]));
const lerJson = (txt) => { try { return txt ? JSON.parse(txt) : {}; } catch { return {}; } };

/** Normaliza e valida; campos ausentes ficam com o valor atual/padrão. */
export function normalizarRegras(dados = {}, base = REGRAS_PADRAO) {
  const r = { ...REGRAS_PADRAO, ...base };
  // Regras salvas antes da tolerância de falta separada: a falta usava a mesma tolerância da extra
  if (base.tolerancia_falta_minutos === undefined && base.tolerancia_minutos !== undefined) r.tolerancia_falta_minutos = base.tolerancia_minutos;
  const num = (v, min, max, rotulo) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw erro400(`${rotulo} deve estar entre ${min} e ${max}.`);
    return n;
  };
  // Campo opcional: vazio/null = sem limite
  const numOuNulo = (v, min, max, rotulo) => (v === null || v === '' ? null : num(v, min, max, rotulo));
  if (dados.tolerancia_minutos !== undefined) r.tolerancia_minutos = num(dados.tolerancia_minutos, 0, 120, 'Tolerância de hora extra (min)');
  if (dados.tolerancia_falta_minutos !== undefined) r.tolerancia_falta_minutos = num(dados.tolerancia_falta_minutos, 0, 120, 'Tolerância de falta/atraso (min)');
  if (dados.jornada_maxima_horas !== undefined) r.jornada_maxima_horas = num(dados.jornada_maxima_horas, 12, 48, 'Jornada máxima (h)');
  if (dados.janela_escala_horas !== undefined) r.janela_escala_horas = num(dados.janela_escala_horas, 1, 12, 'Janela da escala (h)');
  if (dados.limite_entrada_antecipada_minutos !== undefined) r.limite_entrada_antecipada_minutos = numOuNulo(dados.limite_entrada_antecipada_minutos, 0, 240, 'Limite de entrada antecipada (min)');
  if (dados.limite_saida_posterior_minutos !== undefined) r.limite_saida_posterior_minutos = numOuNulo(dados.limite_saida_posterior_minutos, 0, 240, 'Limite de saída após o horário (min)');
  if (dados.arredondamento_minutos !== undefined) {
    const n = Number(dados.arredondamento_minutos);
    if (![0, 5, 10, 15, 30].includes(n)) throw erro400('Arredondamento deve ser 0, 5, 10, 15 ou 30 minutos.');
    r.arredondamento_minutos = n;
  }
  for (const k of ['noturno_inicio', 'noturno_fim']) {
    if (dados[k] !== undefined) {
      if (horaParaMin(dados[k]) === null) throw erro400('Horário do adicional noturno inválido (HH:mm).');
      r[k] = String(dados[k]).slice(0, 5);
    }
  }
  for (const k of ['hora_noturna_reduzida', 'extras_automaticos', 'plantao_sem_batida_gera_falta']) {
    if (dados[k] !== undefined) r[k] = !!dados[k];
  }
  for (const k of ['refeicao_nao_registrada', 'pausa_nao_registrada']) {
    if (dados[k] !== undefined) {
      if (!['descontar_parametro', 'nao_descontar'].includes(dados[k])) throw erro400('Opção de intervalo não registrado inválida.');
      r[k] = dados[k];
    }
  }
  return r;
}

/** Padrão do sistema (vale para clientes sem regra própria). */
async function regrasPadraoSistema() {
  await inicializar();
  const [[row]] = await pool.query(`SELECT regras_json FROM faturamento_regras_apuracao WHERE id = 1`);
  return normalizarRegras({}, lerJson(row?.regras_json));
}

/**
 * Regras que valem para o cliente: as dele, se personalizadas; senão o padrão do sistema.
 * Sem cliente, devolve o padrão do sistema.
 */
export async function obterRegrasApuracao(empresaId = null) {
  const padrao = await regrasPadraoSistema();
  const emp = Number(empresaId) || null;
  if (!emp) return { ...padrao, empresa_id: null, personalizadas: false, atualizado_por_nome: null, atualizado_por_perfil: null, atualizado_em: null };
  const [[row]] = await pool.query(
    `SELECT regras_json, atualizado_por_nome, atualizado_por_perfil, atualizado_em
       FROM faturamento_regras_apuracao_cliente WHERE empresa_id = ?`,
    [emp]
  );
  return {
    ...(row ? normalizarRegras({}, { ...padrao, ...lerJson(row.regras_json) }) : padrao),
    empresa_id: emp,
    personalizadas: !!row,
    atualizado_por_nome: row?.atualizado_por_nome ?? null,
    atualizado_por_perfil: row?.atualizado_por_perfil ?? null,
    atualizado_em: row?.atualizado_em ?? null,
  };
}

async function exigirEmpresa(empresaId) {
  const emp = Number(empresaId);
  if (!emp) throw erro400('Selecione o cliente da regra de apuração.');
  const [[e]] = await pool.query(`SELECT id FROM empresas WHERE id = ?`, [emp]);
  if (!e) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });
  return emp;
}

export async function salvarRegrasApuracao(empresaId, dados, usuario) {
  const emp = await exigirEmpresa(empresaId);
  const atual = await obterRegrasApuracao(emp);
  const novas = somenteRegras(normalizarRegras(dados, atual));
  const anteriores = somenteRegras(atual);
  if (atual.personalizadas && JSON.stringify(novas) === JSON.stringify(anteriores)) return atual;
  const perfil = usuario?.tipoUsuario ?? null;
  const conexao = await pool.getConnection();
  try {
    await conexao.beginTransaction();
    await conexao.query(
      `INSERT INTO faturamento_regras_apuracao_cliente (empresa_id, regras_json, atualizado_por_id, atualizado_por_nome, atualizado_por_perfil)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE regras_json = VALUES(regras_json), atualizado_por_id = VALUES(atualizado_por_id),
         atualizado_por_nome = VALUES(atualizado_por_nome), atualizado_por_perfil = VALUES(atualizado_por_perfil)`,
      [emp, JSON.stringify(novas), usuario?.id ?? null, usuario?.nome ?? null, perfil]
    );
    await conexao.query(
      `INSERT INTO faturamento_regras_apuracao_historico
         (empresa_id, acao, regras_anteriores_json, regras_novas_json, usuario_id, usuario_nome, usuario_perfil)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [emp, atual.personalizadas ? 'alteracao' : 'personalizacao', JSON.stringify(anteriores), JSON.stringify(novas),
        usuario?.id ?? null, usuario?.nome ?? null, perfil]
    );
    await conexao.commit();
  } catch (e) {
    await conexao.rollback();
    throw e;
  } finally {
    conexao.release();
  }
  return obterRegrasApuracao(emp);
}

/** Remove a regra própria do cliente: ele volta a usar o padrão do sistema. */
export async function restaurarRegrasPadrao(empresaId, usuario) {
  const emp = await exigirEmpresa(empresaId);
  const atual = await obterRegrasApuracao(emp);
  if (!atual.personalizadas) return atual;
  const padrao = await regrasPadraoSistema();
  await pool.query(`DELETE FROM faturamento_regras_apuracao_cliente WHERE empresa_id = ?`, [emp]);
  await pool.query(
    `INSERT INTO faturamento_regras_apuracao_historico
       (empresa_id, acao, regras_anteriores_json, regras_novas_json, usuario_id, usuario_nome, usuario_perfil)
     VALUES (?, 'restauracao_padrao', ?, ?, ?, ?, ?)`,
    [emp, JSON.stringify(somenteRegras(atual)), JSON.stringify(somenteRegras(padrao)),
      usuario?.id ?? null, usuario?.nome ?? null, usuario?.tipoUsuario ?? null]
  );
  return obterRegrasApuracao(emp);
}

/** Clientes com regra própria (para marcar na lista de seleção). */
export async function listarClientesComRegra() {
  await inicializar();
  const [rows] = await pool.query(
    `SELECT r.empresa_id, e.nome_empresa, r.atualizado_por_nome, r.atualizado_por_perfil, r.atualizado_em
       FROM faturamento_regras_apuracao_cliente r
       JOIN empresas e ON e.id = r.empresa_id
      ORDER BY e.nome_empresa`
  );
  return rows;
}

/** Histórico de alterações da regra do cliente: o que mudou, quem alterou (nome e perfil) e quando. */
export async function listarHistoricoRegras(empresaId) {
  const emp = await exigirEmpresa(empresaId);
  const [rows] = await pool.query(
    `SELECT id, acao, regras_anteriores_json, regras_novas_json, usuario_nome, usuario_perfil, criado_em
       FROM faturamento_regras_apuracao_historico
      WHERE empresa_id = ?
      ORDER BY criado_em DESC, id DESC
      LIMIT 200`,
    [emp]
  );
  return rows.map((r) => {
    const antes = lerJson(r.regras_anteriores_json);
    const depois = lerJson(r.regras_novas_json);
    const alteracoes = CHAVES
      .filter((k) => JSON.stringify(antes[k] ?? null) !== JSON.stringify(depois[k] ?? null))
      .map((k) => ({ campo: k, anterior: antes[k] ?? null, novo: depois[k] ?? null }));
    return { id: r.id, acao: r.acao, usuario_nome: r.usuario_nome, usuario_perfil: r.usuario_perfil, criado_em: r.criado_em, alteracoes };
  });
}
