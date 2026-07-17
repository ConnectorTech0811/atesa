import { pool } from '../config/database.js';

export async function listarAtividades(trabalhoId) {
  const [linhas] = await pool.query(
    `SELECT id, cargo, descricao, quantidade, salario_base, ordem,
            vr_dias, vt_dias, adicional_noturno, periculosidade, insalubridade,
            premio_incentivo, tipo_escala
     FROM proposta_atividades WHERE trabalho_id = ? ORDER BY ordem ASC, id ASC`,
    [trabalhoId]
  );
  return linhas;
}

export async function inserirAtividades(trabalhoId, atividades) {
  if (!atividades || atividades.length === 0) return [];
  const ids = [];
  for (const a of atividades) {
    const [resultado] = await pool.query(
      `INSERT INTO proposta_atividades
         (trabalho_id, cargo, descricao, quantidade, salario_base, ordem,
          vr_dias, vt_dias, adicional_noturno, periculosidade, insalubridade, premio_incentivo, tipo_escala)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trabalhoId, a.cargo, a.descricao ?? null, a.quantidade ?? 1, a.salarioBase ?? null, a.ordem ?? 0,
        a.vrDias ?? 0, a.vtDias ?? 0, a.adicionalNoturno ? 1 : 0, a.periculosidade ? 1 : 0,
        a.insalubridade ?? 'sem_risco', a.premioIncentivo ?? 0, a.tipoEscala ?? 'mensal',
      ]
    );
    ids.push(resultado.insertId);
  }
  return ids;
}

export async function atualizarAtividade(id, dados) {
  const {
    cargo, descricao, quantidade, salarioBase,
    vrDias, vtDias, adicionalNoturno, periculosidade, insalubridade, premioIncentivo, tipoEscala,
  } = dados;
  await pool.query(
    `UPDATE proposta_atividades SET
       cargo = ?, descricao = ?, quantidade = ?, salario_base = ?,
       vr_dias = ?, vt_dias = ?, adicional_noturno = ?, periculosidade = ?,
       insalubridade = ?, premio_incentivo = ?, tipo_escala = ?
     WHERE id = ?`,
    [
      cargo, descricao ?? null, quantidade ?? 1, salarioBase ?? null,
      vrDias ?? 0, vtDias ?? 0, adicionalNoturno ? 1 : 0, periculosidade ? 1 : 0,
      insalubridade ?? 'sem_risco', premioIncentivo ?? 0, tipoEscala ?? 'mensal',
      id,
    ]
  );
}

export async function removerAtividade(id) {
  await pool.query('DELETE FROM proposta_atividades WHERE id = ?', [id]);
}
