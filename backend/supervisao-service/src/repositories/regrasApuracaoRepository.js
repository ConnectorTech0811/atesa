// ── Regras de apuração de jornada (tolerância, adicional noturno, refeição) ──
// Uma linha só (id = 1). Enquanto ninguém salvar, valem os padrões de REGRAS_PADRAO.
import { pool } from '../config/database.js';
import { REGRAS_PADRAO, horaParaMin } from './apuracaoJornadas.js';

let inicializado = null;
function inicializar() {
  if (!inicializado) {
    inicializado = pool.query(`
      CREATE TABLE IF NOT EXISTS faturamento_regras_apuracao (
        id TINYINT PRIMARY KEY DEFAULT 1,
        regras_json TEXT NOT NULL,
        atualizado_por_id INT NULL,
        atualizado_por_nome VARCHAR(150) NULL,
        atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `).catch((e) => { inicializado = null; throw e; });
  }
  return inicializado;
}

function erro400(msg) {
  return Object.assign(new Error(msg), { status: 400 });
}

/** Normaliza e valida; campos ausentes ficam com o valor atual/padrão. */
export function normalizarRegras(dados = {}, base = REGRAS_PADRAO) {
  const r = { ...REGRAS_PADRAO, ...base };
  const num = (v, min, max, rotulo) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < min || n > max) throw erro400(`${rotulo} deve estar entre ${min} e ${max}.`);
    return n;
  };
  if (dados.tolerancia_minutos !== undefined) r.tolerancia_minutos = num(dados.tolerancia_minutos, 0, 120, 'Tolerância (min)');
  if (dados.jornada_maxima_horas !== undefined) r.jornada_maxima_horas = num(dados.jornada_maxima_horas, 12, 48, 'Jornada máxima (h)');
  if (dados.janela_escala_horas !== undefined) r.janela_escala_horas = num(dados.janela_escala_horas, 1, 12, 'Janela da escala (h)');
  for (const k of ['noturno_inicio', 'noturno_fim']) {
    if (dados[k] !== undefined) {
      if (horaParaMin(dados[k]) === null) throw erro400('Horário do adicional noturno inválido (HH:mm).');
      r[k] = String(dados[k]).slice(0, 5);
    }
  }
  if (dados.hora_noturna_reduzida !== undefined) r.hora_noturna_reduzida = !!dados.hora_noturna_reduzida;
  if (dados.extras_automaticos !== undefined) r.extras_automaticos = !!dados.extras_automaticos;
  if (dados.refeicao_nao_registrada !== undefined) {
    if (!['descontar_parametro', 'nao_descontar'].includes(dados.refeicao_nao_registrada)) throw erro400('Opção de refeição não registrada inválida.');
    r.refeicao_nao_registrada = dados.refeicao_nao_registrada;
  }
  return r;
}

export async function obterRegrasApuracao() {
  await inicializar();
  const [[row]] = await pool.query(`SELECT regras_json, atualizado_por_nome, atualizado_em FROM faturamento_regras_apuracao WHERE id = 1`);
  let salvas = {};
  try { salvas = row ? JSON.parse(row.regras_json) : {}; } catch { salvas = {}; }
  return {
    ...normalizarRegras(salvas),
    personalizadas: !!row,
    atualizado_por_nome: row?.atualizado_por_nome ?? null,
    atualizado_em: row?.atualizado_em ?? null,
  };
}

export async function salvarRegrasApuracao(dados, usuario) {
  const atual = await obterRegrasApuracao();
  const regras = normalizarRegras(dados, atual);
  const json = JSON.stringify(Object.fromEntries(Object.keys(REGRAS_PADRAO).map((k) => [k, regras[k]])));
  await pool.query(
    `INSERT INTO faturamento_regras_apuracao (id, regras_json, atualizado_por_id, atualizado_por_nome) VALUES (1, ?, ?, ?)
     ON DUPLICATE KEY UPDATE regras_json = VALUES(regras_json), atualizado_por_id = VALUES(atualizado_por_id), atualizado_por_nome = VALUES(atualizado_por_nome)`,
    [json, usuario?.id ?? null, usuario?.nome ?? null]
  );
  return obterRegrasApuracao();
}
