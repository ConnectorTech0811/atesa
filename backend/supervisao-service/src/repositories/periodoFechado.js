// ── Bloqueio de alterações em competência fechada no eSocial ────────────────
// Confirmado pela ATESA: fechada a competência (S-1299), nenhuma alteração que impacte o
// fechamento pode ser feita — apontamentos, complementos, escalas e apuração do faturamento.
// A situação vem de esocial_competencias (beneficios-service, mesmo banco); qualquer status
// diferente de 'aberta' (fechando, fechada, reabrindo) bloqueia.
import { pool } from '../config/database.js';

const competenciaDe = (d) => String(d || '').slice(0, 7);

/** Competências (AAAA-MM) da lista que estão bloqueadas. */
export async function competenciasBloqueadas(datasOuCompetencias) {
  const comps = [...new Set(datasOuCompetencias.map(competenciaDe).filter((c) => /^\d{4}-\d{2}$/.test(c)))];
  if (!comps.length) return [];
  try {
    const [rows] = await pool.query(
      `SELECT c.competencia, c.status
         FROM esocial_competencias c
        WHERE c.competencia IN (?) AND c.status <> 'aberta'
          AND c.ambiente = COALESCE((SELECT ambiente FROM esocial_config WHERE id = 1), c.ambiente)`,
      [comps]
    );
    return rows;
  } catch (e) {
    // Módulo eSocial ainda não inicializado neste banco: nada fechado
    if (e?.code === 'ER_NO_SUCH_TABLE') return [];
    throw e;
  }
}

/** Lança 409 se alguma das datas/competências estiver fechada. */
export async function exigirCompetenciaAberta(datasOuCompetencias, acao = 'alterar este registro') {
  const bloqueadas = await competenciasBloqueadas(datasOuCompetencias.filter(Boolean));
  if (bloqueadas.length) {
    const lista = bloqueadas.map((b) => `${b.competencia.slice(5, 7)}/${b.competencia.slice(0, 4)}${b.status !== 'fechada' ? ` (${b.status})` : ''}`).join(', ');
    throw Object.assign(
      new Error(`Competência ${lista} fechada no eSocial: não é possível ${acao}. Para corrigir, a competência precisa ser reaberta no Fechamento eSocial.`),
      { status: 409 }
    );
  }
}
