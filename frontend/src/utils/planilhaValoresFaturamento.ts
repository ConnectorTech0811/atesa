// Planilha de faturamento com valores (R$): quantidades apuradas (planilha de produtividade)
// × valores da vaga no Parâmetro, mais DAR, taxa administrativa, NF, retenções e fatura.
//
// Regras (padrão do sistema; os percentuais vêm do Parâmetro e de Taxas e Impostos):
//  • Plantão/12x36: remuneração por plantão; Procedimento: por dia trabalhado;
//    Mensal: salário proporcional aos dias da alocação no mês, menos as horas de falta (÷ 220 h).
//  • Insalubridade sobre o salário mínimo (Pré/Médio 20%, Alto 40%): mensal = integral;
//    plantão = ÷ 15 plantões; procedimento = ÷ 30 dias. Periculosidade (30% da remuneração) só sem insalubridade.
//  • Valor da hora = (remuneração + insalubridade/periculosidade) ÷ horas da jornada
//    (horário da vaga; sem horário: 12 h no plantão, 8 h no procedimento, 220 h no mensal).
//  • Adicional noturno = valor da hora × 20% × horas noturnas apuradas (só vaga com Ad. Noturno = Sim).
//  • Hora excedente = valor da hora × 1,5 × horas excedentes apuradas.
//  • VR/VT = valor/dia do Parâmetro × plantões (ou dias trabalhados).
//  • Serviços prestados = remuneração + insalubridade + periculosidade + ad. noturno + hora excedente.
//  • Provisão DAR = serviços × DAR% (padrão 8,33% = 1/12).
//  • Taxa Adm = (total do cooperado + DAR) × taxa de serviço do Parâmetro.
//  • NF = serviços + VR/VT + DAR + taxa adm. Retenções: IR sobre serviços; PIS, COFINS e ISS sobre a NF.
//  • Fatura = NF − retenções.
import type { LinhaFaturamento, ReferenciasValoresFaturamento, VagaValoresReferencia } from '../api/escalaFaturamentoApi';
import { DIAS_MES, valorInsalubridadeUnitario } from './adicionalNoturno';

export const PERCENTUAL_PERICULOSIDADE = 30;
export const PERCENTUAL_AD_NOTURNO = 20;
export const FATOR_HORA_EXCEDENTE = 1.5;
const HORAS_MES = 220;

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** "07:00 às 19:00" → 12; "19:00 às 07:00" → 12; sem horário legível → null. */
export function horasDoHorario(horario: string | null | undefined): number | null {
  const m = String(horario ?? '').match(/(\d{1,2})[:h](\d{2})?\D+(\d{1,2})[:h](\d{2})?/);
  if (!m) return null;
  const ini = Number(m[1]) * 60 + Number(m[2] ?? 0);
  const fim = Number(m[3]) * 60 + Number(m[4] ?? 0);
  if (ini > 24 * 60 || fim > 24 * 60) return null;
  let min = fim - ini;
  if (min <= 0) min += 24 * 60;
  return min / 60;
}

export interface ParametrosCalculo {
  /** Taxa adm (%) por unidade do Parâmetro; `taxaAdmPadrao` vale para as linhas sem taxa na unidade. */
  taxaAdmPorUnidade: Map<number, number>;
  taxaAdmPadrao: number | null;
  issPercentual: number | null;
  issRetido: boolean;
  irrf: number;
  pis: number;
  cofins: number;
  dar: number;
  salarioMinimo: number;
}

export function parametrosDasReferencias(ref: ReferenciasValoresFaturamento, ajustes: { taxaAdmPadrao: number | null; issPercentual: number | null }): ParametrosCalculo {
  const taxaAdmPorUnidade = new Map<number, number>();
  for (const u of ref.unidades) if (u.taxa_adm_percentual !== null) taxaAdmPorUnidade.set(u.id, u.taxa_adm_percentual);
  return {
    taxaAdmPorUnidade,
    taxaAdmPadrao: ajustes.taxaAdmPadrao,
    issPercentual: ajustes.issPercentual,
    issRetido: ref.aliquotas.iss.retido,
    irrf: ref.aliquotas.irrf,
    pis: ref.aliquotas.pis,
    cofins: ref.aliquotas.cofins,
    dar: ref.aliquotas.dar,
    salarioMinimo: ref.salario_minimo,
  };
}

export interface LinhaValores {
  linha: LinhaFaturamento;
  vaga: VagaValoresReferencia | null;
  /** Por que a linha saiu sem valor ou com valor incompleto. */
  pendencias: string[];
  unidade: 'plantão' | 'dia' | 'mês' | '';
  quantidade: number;
  valor_unitario: number;
  valor_hora: number;
  remuneracao: number;
  insalubridade: number;
  periculosidade: number;
  ad_noturno: number;
  hora_excedente: number;
  vr: number;
  vt: number;
  total_cooperado: number;
  servicos_prestados: number;
  prov_dar: number;
  taxa_adm_percentual: number | null;
  taxa_adm: number;
  nf: number;
  ret_ir: number;
  ret_pis: number;
  ret_cofins: number;
  ret_iss: number;
  fatura: number;
}

const ZERO = {
  unidade: '' as const, quantidade: 0, valor_unitario: 0, valor_hora: 0, remuneracao: 0, insalubridade: 0, periculosidade: 0,
  ad_noturno: 0, hora_excedente: 0, vr: 0, vt: 0, total_cooperado: 0, servicos_prestados: 0, prov_dar: 0,
  taxa_adm_percentual: null, taxa_adm: 0, nf: 0, ret_ir: 0, ret_pis: 0, ret_cofins: 0, ret_iss: 0, fatura: 0,
};

export function calcularLinhaValores(l: LinhaFaturamento, vaga: VagaValoresReferencia | null, p: ParametrosCalculo): LinhaValores {
  const pendencias: string[] = [];
  if (!vaga) {
    pendencias.push(l.origem === 'valores_cliente' ? 'Sem alocação neste cliente.' : 'Alocação sem vaga do Parâmetro.');
    return { linha: l, vaga, pendencias, ...ZERO };
  }
  const salario = Number(vaga.salario_base) || 0;
  if (salario <= 0) pendencias.push('Vaga sem remuneração no Parâmetro.');

  const plantoes = (Number(l.pl_diurno) || 0) + (Number(l.pl_noturno) || 0);
  const insalVaga = valorInsalubridadeUnitario(vaga.tipo_escala, vaga.insalubridade, p.salarioMinimo);
  const horasJornada = horasDoHorario(vaga.horario);

  let unidade: LinhaValores['unidade'];
  let quantidade: number;
  let remuneracao: number;
  let insalubridade: number;
  let insalUnit: number;
  let horasBase: number;
  let diasAjuda: number;

  if (vaga.tipo_escala === 'mensal') {
    unidade = 'mês';
    const fracao = Math.min(1, (Number(l.dias_mes_fechado) || 0) / DIAS_MES);
    quantidade = r2(fracao);
    const desconto = (salario / HORAS_MES) * (Number(l.horas_falta) || 0);
    remuneracao = Math.max(0, salario * fracao - desconto);
    insalubridade = insalVaga * fracao;
    insalUnit = insalVaga;
    horasBase = HORAS_MES;
    diasAjuda = Number(l.dias_trabalhados) || 0;
  } else if (vaga.tipo_escala === 'por_procedimento') {
    unidade = 'dia';
    quantidade = Number(l.dias_trabalhados) || 0;
    remuneracao = salario * quantidade;
    insalUnit = insalVaga;
    insalubridade = insalUnit * quantidade;
    horasBase = horasJornada ?? 8;
    diasAjuda = quantidade;
  } else {
    unidade = 'plantão';
    quantidade = plantoes;
    remuneracao = salario * quantidade;
    insalUnit = insalVaga;
    insalubridade = insalUnit * quantidade;
    horasBase = horasJornada ?? 12;
    diasAjuda = quantidade;
  }

  const periculosidade = insalubridade === 0 && vaga.periculosidade ? remuneracao * (PERCENTUAL_PERICULOSIDADE / 100) : 0;
  const pericUnit = insalUnit === 0 && vaga.periculosidade ? salario * (PERCENTUAL_PERICULOSIDADE / 100) : 0;
  const valorHora = horasBase > 0 ? (salario + insalUnit + pericUnit) / horasBase : 0;

  const adNoturno = vaga.adicional_noturno ? valorHora * (PERCENTUAL_AD_NOTURNO / 100) * (Number(l.ad_noturno) || 0) : 0;
  if (!vaga.adicional_noturno && Number(l.ad_noturno) > 0) {
    pendencias.push(`${l.ad_noturno} h noturnas apuradas, mas a vaga está com Ad. Noturno = Não no Parâmetro.`);
  }
  const horaExcedente = valorHora * FATOR_HORA_EXCEDENTE * (Number(l.hora_excedente) || 0);
  const vr = (Number(vaga.valor_vr_dia) || 0) * diasAjuda;
  const vt = (Number(vaga.valor_vt_dia) || 0) * diasAjuda;

  const servicos = r2(remuneracao) + r2(insalubridade) + r2(periculosidade) + r2(adNoturno) + r2(horaExcedente);
  const totalCooperado = servicos + r2(vr) + r2(vt);
  const provDar = r2(servicos * (p.dar / 100));

  const taxaPct = (l.unidade_id != null && p.taxaAdmPorUnidade.has(l.unidade_id))
    ? p.taxaAdmPorUnidade.get(l.unidade_id)!
    : p.taxaAdmPadrao;
  if (taxaPct === null) pendencias.push('Taxa de serviço não informada no Parâmetro.');
  const taxaAdm = r2((totalCooperado + provDar) * ((taxaPct ?? 0) / 100));

  const nf = r2(servicos + r2(vr) + r2(vt) + provDar + taxaAdm);
  const retIr = r2(servicos * (p.irrf / 100));
  const retPis = r2(nf * (p.pis / 100));
  const retCofins = r2(nf * (p.cofins / 100));
  if (p.issPercentual === null) pendencias.push('Alíquota de ISS não informada.');
  const retIss = p.issRetido ? r2(nf * ((p.issPercentual ?? 0) / 100)) : 0;

  return {
    linha: l, vaga, pendencias, unidade, quantidade,
    valor_unitario: r2(salario),
    valor_hora: r2(valorHora),
    remuneracao: r2(remuneracao),
    insalubridade: r2(insalubridade),
    periculosidade: r2(periculosidade),
    ad_noturno: r2(adNoturno),
    hora_excedente: r2(horaExcedente),
    vr: r2(vr),
    vt: r2(vt),
    total_cooperado: r2(totalCooperado),
    servicos_prestados: r2(servicos),
    prov_dar: provDar,
    taxa_adm_percentual: taxaPct,
    taxa_adm: taxaAdm,
    nf,
    ret_ir: retIr,
    ret_pis: retPis,
    ret_cofins: retCofins,
    ret_iss: retIss,
    fatura: r2(nf - retIr - retPis - retCofins - retIss),
  };
}

export function calcularPlanilhaValores(linhas: LinhaFaturamento[], ref: ReferenciasValoresFaturamento, p: ParametrosCalculo): LinhaValores[] {
  const vagas = new Map(ref.vagas.map((v) => [v.id, v]));
  return linhas.map((l) => calcularLinhaValores(l, l.vaga_id != null ? vagas.get(l.vaga_id) ?? null : null, p));
}

type ChaveValor = Exclude<{ [K in keyof LinhaValores]: LinhaValores[K] extends number ? K : never }[keyof LinhaValores], undefined>;

export const COLUNAS_VALORES: { titulo: string; chave: ChaveValor; moeda: boolean }[] = [
  { titulo: 'QTDE', chave: 'quantidade', moeda: false },
  { titulo: 'VALOR UNIT.', chave: 'valor_unitario', moeda: true },
  { titulo: 'REMUNERAÇÃO', chave: 'remuneracao', moeda: true },
  { titulo: 'INSALUBRIDADE', chave: 'insalubridade', moeda: true },
  { titulo: 'PERICULOSIDADE', chave: 'periculosidade', moeda: true },
  { titulo: 'AD. NOTURNO', chave: 'ad_noturno', moeda: true },
  { titulo: 'HORA EXCEDENTE', chave: 'hora_excedente', moeda: true },
  { titulo: 'AJUDA CUSTO VR', chave: 'vr', moeda: true },
  { titulo: 'AJUDA CUSTO VT', chave: 'vt', moeda: true },
  { titulo: 'TOTAL COOPERADO', chave: 'total_cooperado', moeda: true },
  { titulo: 'SERV. PRESTADOS', chave: 'servicos_prestados', moeda: true },
  { titulo: 'PROV. DAR', chave: 'prov_dar', moeda: true },
  { titulo: 'TAXA ADM', chave: 'taxa_adm', moeda: true },
  { titulo: 'VALOR NF', chave: 'nf', moeda: true },
  { titulo: 'RET. IR', chave: 'ret_ir', moeda: true },
  { titulo: 'RET. PIS', chave: 'ret_pis', moeda: true },
  { titulo: 'RET. COFINS', chave: 'ret_cofins', moeda: true },
  { titulo: 'RET. ISS', chave: 'ret_iss', moeda: true },
  { titulo: 'FATURA', chave: 'fatura', moeda: true },
];

export function totaisValores(linhas: LinhaValores[]): Record<ChaveValor, number> {
  const t = {} as Record<ChaveValor, number>;
  for (const c of COLUNAS_VALORES) t[c.chave] = r2(linhas.reduce((s, l) => s + (Number(l[c.chave]) || 0), 0));
  return t;
}

const limparNomeArquivo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

export async function baixarPlanilhaValores(dados: { empresa: string; competencia: string; linhas: LinhaValores[]; p: ParametrosCalculo }) {
  const XLSX = await import('xlsx');
  const cab = ['COOPERADO', 'MATRÍCULA', 'ADESÃO', 'FUNÇÃO', 'LOCAL', 'ESCALA', 'UNIDADE', 'TAXA ADM %', ...COLUNAS_VALORES.map((c) => c.titulo), 'PENDÊNCIAS'];
  const corpo = dados.linhas.map((v) => [
    v.linha.cooperado, v.linha.matricula, v.linha.data_inicio ? new Date(`${v.linha.data_inicio}T12:00:00`) : null,
    v.linha.atividade, v.linha.local, v.vaga?.tipo_escala ?? '', v.unidade, v.taxa_adm_percentual,
    ...COLUNAS_VALORES.map((c) => v[c.chave]), v.pendencias.join(' '),
  ]);
  const t = totaisValores(dados.linhas);
  const totais = ['TOTAL', null, null, null, null, null, null, null, ...COLUNAS_VALORES.map((c) => (c.chave === 'quantidade' ? null : t[c.chave])), null];
  const p = dados.p;
  const rodape = [
    [],
    [`Alíquotas: DAR ${p.dar.toFixed(2)}% · IR ${p.irrf}% · PIS ${p.pis}% · COFINS ${p.cofins}% · ISS ${p.issPercentual ?? '—'}%${p.issRetido ? ' (retido)' : ' (não retido)'}`],
  ];
  const ws = XLSX.utils.aoa_to_sheet([cab, ...corpo, totais, ...rodape], { cellDates: true, dateNF: 'dd/mm/yyyy' });
  const primeiraMoeda = 8;
  const range = XLSX.utils.decode_range(ws['!ref']!);
  for (let r = 1; r <= corpo.length + 1; r++) {
    for (let c = primeiraMoeda; c < primeiraMoeda + COLUNAS_VALORES.length; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r, c })];
      if (cell && typeof cell.v === 'number' && COLUNAS_VALORES[c - primeiraMoeda].moeda) cell.z = '#,##0.00';
    }
  }
  ws['!cols'] = cab.map((c) => ({ wch: c === 'COOPERADO' ? 38 : c === 'FUNÇÃO' || c === 'LOCAL' || c === 'PENDÊNCIAS' ? 28 : Math.max(10, c.length + 2) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: corpo.length, c: range.e.c } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'faturamento');
  const [mm, aaaa] = dados.competencia.includes('/') ? dados.competencia.split('/') : dados.competencia.split('-').reverse();
  XLSX.writeFile(wb, `${limparNomeArquivo(`FATURAMENTO ${dados.empresa} - ${mm}-${aaaa}`)}.xlsx`);
}
