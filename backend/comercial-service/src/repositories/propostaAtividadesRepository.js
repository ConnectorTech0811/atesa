import { pool } from '../config/database.js';

// Valor unitário de VR (por dia) e VT de cada função, vindos do simulador.
// Antes só os dias eram gravados e o PDF multiplicava por um valor vazio (R$ 0).
let colunasValoresGarantidas = null;
function garantirColunasValores() {
  if (!colunasValoresGarantidas) {
    colunasValoresGarantidas = (async () => {
      for (const col of ['valor_vr_dia', 'valor_vt_dia']) {
        try {
          await pool.query(`ALTER TABLE proposta_atividades ADD COLUMN ${col} DECIMAL(10,2) NULL`);
        } catch (e) {
          if (e?.code !== 'ER_DUP_FIELDNAME') throw e;
        }
      }
    })().catch((e) => { colunasValoresGarantidas = null; throw e; });
  }
  return colunasValoresGarantidas;
}

const valorOuNulo = (v) => (v === undefined || v === null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

export async function listarAtividades(trabalhoId) {
  await garantirColunasValores();
  const [linhas] = await pool.query(
    `SELECT id, cargo, descricao, quantidade, salario_base, ordem,
            vr_dias, vt_dias, valor_vr_dia, valor_vt_dia, adicional_noturno, periculosidade, insalubridade,
            premio_incentivo, tipo_escala
     FROM proposta_atividades WHERE trabalho_id = ? ORDER BY ordem ASC, id ASC`,
    [trabalhoId]
  );
  return linhas;
}

export async function inserirAtividades(trabalhoId, atividades) {
  if (!atividades || atividades.length === 0) return [];
  await garantirColunasValores();
  const ids = [];
  for (const a of atividades) {
    const [resultado] = await pool.query(
      `INSERT INTO proposta_atividades
         (trabalho_id, cargo, descricao, quantidade, salario_base, ordem,
          vr_dias, vt_dias, valor_vr_dia, valor_vt_dia, adicional_noturno, periculosidade, insalubridade, premio_incentivo, tipo_escala)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        trabalhoId, a.cargo, a.descricao ?? null, a.quantidade ?? 1, a.salarioBase ?? null, a.ordem ?? 0,
        a.vrDias ?? 0, a.vtDias ?? 0, valorOuNulo(a.valorVrDia), valorOuNulo(a.valorVtDia), a.adicionalNoturno ? 1 : 0, a.periculosidade ? 1 : 0,
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
    vrDias, vtDias, valorVrDia, valorVtDia, adicionalNoturno, periculosidade, insalubridade, premioIncentivo, tipoEscala,
  } = dados;
  await garantirColunasValores();
  await pool.query(
    `UPDATE proposta_atividades SET
       cargo = ?, descricao = ?, quantidade = ?, salario_base = ?,
       vr_dias = ?, vt_dias = ?, valor_vr_dia = ?, valor_vt_dia = ?, adicional_noturno = ?, periculosidade = ?,
       insalubridade = ?, premio_incentivo = ?, tipo_escala = ?
     WHERE id = ?`,
    [
      cargo, descricao ?? null, quantidade ?? 1, salarioBase ?? null,
      vrDias ?? 0, vtDias ?? 0, valorOuNulo(valorVrDia), valorOuNulo(valorVtDia), adicionalNoturno ? 1 : 0, periculosidade ? 1 : 0,
      insalubridade ?? 'sem_risco', premioIncentivo ?? 0, tipoEscala ?? 'mensal',
      id,
    ]
  );
}

export async function removerAtividade(id) {
  await pool.query('DELETE FROM proposta_atividades WHERE id = ?', [id]);
}
