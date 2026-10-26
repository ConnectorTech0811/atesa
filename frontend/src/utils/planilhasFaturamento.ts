// Geração e leitura de planilhas .xlsx do Faturamento / Produtividade.
// A biblioteca SheetJS é carregada sob demanda para não pesar no bundle inicial.
import type { LinhaFaturamento, LinhaValoresCliente, PlanilhaFaturamento } from '../api/escalaFaturamentoApi';

export type ModeloFaturamento = 'horista' | 'pl' | 'mensal';

export const ROTULO_MODELO: Record<ModeloFaturamento, string> = {
  horista: 'Horista (ex.: HSM)',
  pl: 'Plantão — PL (ex.: Savior)',
  mensal: 'Mensal (ex.: SEMSP Casa Verde)',
};

const SUFIXO_ARQUIVO: Record<ModeloFaturamento, string> = {
  horista: 'HORISTA',
  pl: 'PL',
  mensal: 'MENSAL',
};

type Coluna = {
  titulo: string;
  valor: (l: LinhaFaturamento) => string | number | Date | null;
  somar?: boolean;
};

const data = (s: string | null) => (s ? new Date(`${s}T12:00:00`) : null);
const vazio = () => null;
const num = (n: number) => (n ? n : null);

const COLS_IDENTIFICACAO: Coluna[] = [
  { titulo: 'QTDE', valor: () => 1, somar: true },
  { titulo: 'COOPERADO', valor: (l) => l.cooperado },
  { titulo: 'MATRÍCULA', valor: (l) => (/^\d+$/.test(String(l.matricula || '')) ? Number(l.matricula) : l.matricula) },
  { titulo: 'DATA DE INÍCIO', valor: (l) => data(l.data_inicio) },
  { titulo: 'DESLIGAMENTO', valor: (l) => data(l.desligamento) },
  { titulo: 'ATIVIDADE', valor: (l) => l.atividade },
  { titulo: 'COMPETÊNCIA', valor: (l) => l.competencia },
  { titulo: 'LOCAL', valor: (l) => l.local },
  { titulo: 'DIAS MÊS TOTAL', valor: (l) => l.dias_mes_total },
  { titulo: 'DIAS MÊS FECHADO', valor: (l) => l.dias_mes_fechado, somar: true },
];

const COLS_VALORES_CLIENTE: Coluna[] = [
  { titulo: 'BONIFICAÇÃO', valor: (l) => num(l.bonificacao), somar: true },
  { titulo: 'DESC. REFEIÇÃO', valor: (l) => num(l.desc_refeicao), somar: true },
  { titulo: 'DESC. ESTACIONAMENTO', valor: (l) => num(l.desc_estacionamento), somar: true },
  { titulo: 'DESC. FARMÁCIA', valor: (l) => num(l.desc_farmacia), somar: true },
  { titulo: 'REEMBOLSO', valor: (l) => num(l.reembolso), somar: true },
];

// Colunas sem fonte no sistema saem em branco para preenchimento manual.
const COLUNAS: Record<ModeloFaturamento, Coluna[]> = {
  horista: [
    ...COLS_IDENTIFICACAO,
    { titulo: 'DIAS TRABALHADOS', valor: (l) => l.dias_trabalhados, somar: true },
    { titulo: 'TOTAL HORAS', valor: (l) => l.total_horas, somar: true },
    { titulo: 'AJUDA DE CUSTO EXTRA', valor: vazio },
    { titulo: 'AD NOTURNO', valor: (l) => l.ad_noturno, somar: true },
    { titulo: 'DAR', valor: vazio, somar: true },
    ...COLS_VALORES_CLIENTE,
  ],
  pl: [
    ...COLS_IDENTIFICACAO,
    { titulo: 'TOTAL HORAS', valor: (l) => l.total_horas, somar: true },
    { titulo: 'PL DIURNO', valor: (l) => l.pl_diurno, somar: true },
    { titulo: 'PL NOTURNO', valor: (l) => l.pl_noturno, somar: true },
    { titulo: 'HORA EXCED. 50%', valor: (l) => l.hora_excedente, somar: true },
    { titulo: 'AD NOTURNO', valor: (l) => l.ad_noturno, somar: true },
    ...COLS_VALORES_CLIENTE,
  ],
  mensal: [
    ...COLS_IDENTIFICACAO,
    { titulo: 'DIAS TRABALHADOS', valor: (l) => l.dias_trabalhados, somar: true },
    { titulo: 'TOTAL HORAS', valor: (l) => l.total_horas, somar: true },
    { titulo: 'PL DIURNO', valor: (l) => l.pl_diurno, somar: true },
    { titulo: 'PL NOTURNO', valor: (l) => l.pl_noturno, somar: true },
    { titulo: 'NÃO EXERCEU ATIVIDADE', valor: vazio },
    { titulo: 'FOLGA', valor: vazio },
    { titulo: 'D.S.R', valor: vazio },
    { titulo: 'HORA EXCED. 50%', valor: (l) => l.hora_excedente, somar: true },
    { titulo: 'AD NOTURNO', valor: (l) => l.ad_noturno, somar: true },
    ...COLS_VALORES_CLIENTE,
  ],
};

export function sugerirModelo(linhas: LinhaFaturamento[]): ModeloFaturamento {
  const cont = { horista: 0, pl: 0, mensal: 0 };
  for (const l of linhas) {
    if (l.tipo_escala === 'mensal') cont.mensal++;
    else if (l.tipo_escala === 'plantao' || l.tipo_escala === '12x36') cont.pl++;
    else if (l.tipo_escala) cont.horista++;
  }
  if (cont.mensal >= cont.pl && cont.mensal >= cont.horista && cont.mensal > 0) return 'mensal';
  if (cont.pl >= cont.horista && cont.pl > 0) return 'pl';
  return 'horista';
}

export function colunasDoModelo(modelo: ModeloFaturamento) {
  return COLUNAS[modelo];
}

async function carregarXlsx() {
  return import('xlsx');
}

const limparNomeArquivo = (s: string) => s.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim();

// O arquivo só usa o cabeçalho e as linhas; regras e inconsistências ficam na tela
export async function baixarPlanilhaFaturamento(planilha: Pick<PlanilhaFaturamento, 'empresa' | 'competencia' | 'periodo' | 'linhas' | 'avisos'>, modelo: ModeloFaturamento) {
  const XLSX = await carregarXlsx();
  const cols = COLUNAS[modelo];
  const linhas = planilha.linhas.map((l) => cols.map((c) => c.valor(l)));
  const totais = cols.map((c, i) => {
    if (!c.somar) return null;
    const t = linhas.reduce((s, row) => s + (typeof row[i] === 'number' ? (row[i] as number) : 0), 0);
    return Math.round(t * 100) / 100;
  });
  const aoa = [cols.map((c) => c.titulo), ...linhas, totais];

  const ws = XLSX.utils.aoa_to_sheet(aoa, { cellDates: true, dateNF: 'dd/mm/yyyy' });
  ws['!cols'] = cols.map((c) => ({ wch: c.titulo === 'COOPERADO' ? 42 : c.titulo === 'LOCAL' || c.titulo === 'ATIVIDADE' ? 30 : Math.max(10, c.titulo.length + 2) }));
  ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: linhas.length, c: cols.length - 1 } }) };
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'work-flow');

  const [mm, aaaa] = planilha.competencia.split('/');
  const nome = limparNomeArquivo(`PRODUTIVIDADE ${planilha.empresa.nome} - ${mm}-${aaaa} - ${SUFIXO_ARQUIVO[modelo]}`);
  XLSX.writeFile(wb, `${nome}.xlsx`);
}

// ── Importação dos valores enviados pelo cliente ────────────────────────────
export const COLUNAS_MODELO_VALORES = [
  'NOME',
  'MATRÍCULA',
  'DESC. REFEIÇÃO',
  'BONIFICAÇÃO',
  'DESC. ESTACIONAMENTO',
  'DESC. FARMÁCIA',
  'REEMBOLSO',
];

export async function baixarModeloValoresCliente() {
  const XLSX = await carregarXlsx();
  const ws = XLSX.utils.aoa_to_sheet([
    COLUNAS_MODELO_VALORES,
    ['NOME DO COOPERADO (EXEMPLO)', 12345, 84.34, 120, 45, 40, 42.4],
  ]);
  ws['!cols'] = COLUNAS_MODELO_VALORES.map((c) => ({ wch: c === 'NOME' ? 42 : c.length + 4 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'valores-cliente');
  XLSX.writeFile(wb, 'MODELO - VALORES DO CLIENTE (FATURAMENTO).xlsx');
}

const normalizar = (s: unknown) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');

// Aceita o modelo padrão e também as planilhas do cliente (ex.: "DESC.ESTACIONEMENTO", "COOPERADO").
const SINONIMOS: Record<keyof Omit<LinhaValoresCliente, 'linha'>, string[]> = {
  nome: ['NOME', 'COOPERADO', 'NOMEDOCOOPERADO'],
  matricula: ['MATRICULA', 'MAT', 'MATRICULADOCOOPERADO'],
  desc_refeicao: ['DESCREFEICAO', 'DESCONTOREFEICAO', 'DESCONTODEREFEICAO', 'REFEICAO'],
  bonificacao: ['BONIFICACAO', 'BONIFICACOES'],
  desc_estacionamento: ['DESCESTACIONAMENTO', 'DESCESTACIONEMENTO', 'DESCONTOESTACIONAMENTO', 'DESCONTODEESTACIONAMENTO', 'ESTACIONAMENTO'],
  desc_farmacia: ['DESCFARMACIA', 'DESCONTOFARMACIA', 'DESCONTODEFARMACIA', 'FARMACIA'],
  reembolso: ['REEMBOLSO', 'REEMBOLSOS'],
};

export async function lerPlanilhaValoresCliente(arquivo: File): Promise<{ linhas: LinhaValoresCliente[]; colunasEncontradas: string[] }> {
  const XLSX = await carregarXlsx();
  const wb = XLSX.read(await arquivo.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('A planilha está vazia.');
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });

  // Procura a linha de cabeçalho (a que tem a coluna de matrícula) nas 15 primeiras linhas
  let idxCab = -1;
  let mapa: Partial<Record<keyof typeof SINONIMOS, number>> = {};
  for (let r = 0; r < Math.min(15, aoa.length); r++) {
    const cab = (aoa[r] || []).map(normalizar);
    const m: typeof mapa = {};
    (Object.keys(SINONIMOS) as (keyof typeof SINONIMOS)[]).forEach((campo) => {
      const i = cab.findIndex((h) => SINONIMOS[campo].includes(h));
      if (i >= 0) m[campo] = i;
    });
    if (m.matricula !== undefined) { idxCab = r; mapa = m; break; }
  }
  if (idxCab < 0) throw new Error('Não encontrei a coluna "MATRÍCULA" na planilha. Use o modelo padrão.');
  const valoresEncontrados = (['desc_refeicao', 'bonificacao', 'desc_estacionamento', 'desc_farmacia', 'reembolso'] as const).filter((k) => mapa[k] !== undefined);
  if (valoresEncontrados.length === 0) {
    throw new Error('Nenhuma coluna de valores encontrada (Desc. Refeição, Bonificação, Desc. Estacionamento, Desc. Farmácia, Reembolso).');
  }

  const pegar = (row: unknown[], campo: keyof typeof SINONIMOS) => {
    const i = mapa[campo];
    const v = i === undefined ? null : row[i];
    return v === null || v === undefined ? '' : (v as any);
  };

  const linhas: LinhaValoresCliente[] = [];
  for (let r = idxCab + 1; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const matricula = String(pegar(row, 'matricula')).trim();
    const nome = String(pegar(row, 'nome')).trim();
    if (!matricula && !nome) continue; // linha de totais / vazia
    linhas.push({
      linha: r + 1,
      nome,
      matricula,
      desc_refeicao: pegar(row, 'desc_refeicao'),
      bonificacao: pegar(row, 'bonificacao'),
      desc_estacionamento: pegar(row, 'desc_estacionamento'),
      desc_farmacia: pegar(row, 'desc_farmacia'),
      reembolso: pegar(row, 'reembolso'),
    });
  }
  return { linhas, colunasEncontradas: Object.keys(mapa) };
}
