// ── Referências de valores (R$) da planilha de faturamento ──────────────────
// A planilha de valores (card 3 do Faturamento) multiplica as quantidades apuradas
// (planilha de produtividade) pelos valores da vaga no Parâmetro. Aqui só se lê:
//  • vagas do Parâmetro do cliente (remuneração, insalubridade, ad. noturno, VR/VT);
//  • taxa administrativa = "Taxa de serviço" da ficha do Parâmetro (por unidade);
//  • ISS = alíquota da última NFS-e emitida para o cliente; sem nota, a do estado do cliente
//    em Taxas e Impostos; sem nenhuma, a tela pede para preencher;
//  • IRRF, PIS, COFINS, DAR e salário mínimo de Taxas e Impostos (parametros_sistema).
import { pool } from '../config/database.js';

const erro400 = (msg) => Object.assign(new Error(msg), { status: 400 });

/** "14%", "14,5 %", "32" → 14 / 14.5 / 32. Texto sem número → null. */
export function percentualDoTexto(texto) {
  if (texto === null || texto === undefined) return null;
  const m = String(texto).replace(/\s/g, '').match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(',', '.'));
  return Number.isFinite(n) && n >= 0 && n <= 100 ? n : null;
}

// Alíquotas em parametros_sistema vêm como fração (seed: 0,0065) ou percentual (tela Taxas: 0,65).
// Abaixo de 0,5 é fração (mesma regra do frontend, utils/aliquotas.ts). Padrões em percentual.
const PADROES = {
  irrf_geral: 1.5, pis_rc: 0.65, cofins_rc: 3, dar_pre: 8.33333333, salario_minimo_base: 1621,
};
export const emPercentual = (n) => (n > 0 && n < 0.5 ? Number((n * 100).toFixed(4)) : n);
const ISS_POR_UF = { SP: 'iss_emissao_prestacao_sp', CE: 'iss_emissao_prestacao_ce', PE: 'iss_emissao_prestacao_pe' };

async function lerParametrosSistema(chaves) {
  try {
    const [rows] = await pool.query(`SELECT chave, valor FROM parametros_sistema WHERE chave IN (?)`, [chaves]);
    return new Map(rows.map((r) => [r.chave, Number(r.valor)]));
  } catch {
    return new Map(); // tabela ausente: usa os padrões
  }
}

async function ultimaAliquotaIss(empresaId) {
  try {
    const [[nota]] = await pool.query(
      `SELECT n.aliquota_iss, n.iss_retido, n.data_emissao
         FROM faturamento_notas n
         JOIN faturamento_processos p ON p.id = n.processo_id
        WHERE p.empresa_id = ? AND n.status = 'emitida' AND n.aliquota_iss IS NOT NULL
        ORDER BY n.data_emissao DESC, n.id DESC
        LIMIT 1`,
      [empresaId]
    );
    return nota ?? null;
  } catch {
    return null; // módulo de notas ainda não inicializado neste banco
  }
}

export async function obterReferenciasValores(empresaId) {
  const emp = Number(empresaId);
  if (!emp) throw erro400('Selecione o cliente.');
  const [[empresa]] = await pool.query(`SELECT id, nome_empresa, uf FROM empresas WHERE id = ?`, [emp]);
  if (!empresa) throw Object.assign(new Error('Cliente não encontrado.'), { status: 404 });

  const [unidades] = await pool.query(
    `SELECT id, nome_unidade, taxa_servico FROM parametro_unidades WHERE empresa_id = ? ORDER BY nome_unidade`,
    [emp]
  );
  const [vagas] = await pool.query(
    `SELECT v.id, v.unidade_id, v.cargo, v.salario_base, v.tipo_escala, v.recebe_por, v.insalubridade,
            v.periculosidade, v.adicional_noturno, v.valor_vr_dia, v.valor_vt_dia, v.horario
       FROM parametro_vagas v
       JOIN parametro_unidades u ON u.id = v.unidade_id
      WHERE u.empresa_id = ?`,
    [emp]
  );

  const uf = String(empresa.uf || '').toUpperCase().trim();
  const chaves = [...Object.keys(PADROES), ...Object.values(ISS_POR_UF), 'iss_geral'];
  const ps = await lerParametrosSistema(chaves);
  const p = (k) => (ps.has(k) ? ps.get(k) : PADROES[k]);
  const pct = (k) => emPercentual(p(k));

  // ISS: última nota emitida → estado do cliente → sem fonte (a tela pede)
  const nota = await ultimaAliquotaIss(emp);
  let iss = { percentual: null, origem: 'nenhuma', retido: true };
  if (nota) {
    iss = { percentual: Number(nota.aliquota_iss), origem: 'nota', retido: !!Number(nota.iss_retido), data_nota: nota.data_emissao };
  } else if (ISS_POR_UF[uf] && ps.has(ISS_POR_UF[uf])) {
    iss = { percentual: emPercentual(ps.get(ISS_POR_UF[uf])), origem: 'estado', retido: true, uf };
  }

  return {
    empresa_id: emp,
    uf: uf || null,
    unidades: unidades.map((u) => ({
      id: u.id, nome_unidade: u.nome_unidade, taxa_servico: u.taxa_servico,
      taxa_adm_percentual: percentualDoTexto(u.taxa_servico),
    })),
    vagas: vagas.map((v) => ({
      id: v.id, unidade_id: v.unidade_id, cargo: v.cargo, salario_base: v.salario_base === null ? null : Number(v.salario_base),
      tipo_escala: v.tipo_escala, recebe_por: v.recebe_por, insalubridade: v.insalubridade,
      periculosidade: !!Number(v.periculosidade), adicional_noturno: !!Number(v.adicional_noturno),
      valor_vr_dia: Number(v.valor_vr_dia) || 0, valor_vt_dia: Number(v.valor_vt_dia) || 0, horario: v.horario,
    })),
    aliquotas: {
      irrf: pct('irrf_geral'),
      pis: pct('pis_rc'),
      cofins: pct('cofins_rc'),
      dar: pct('dar_pre'),
      iss,
    },
    salario_minimo: p('salario_minimo_base'),
  };
}
