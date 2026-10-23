// ── Relatórios de faturamento e financeiro (somente leitura) ────────────────
// Todos devolvem o mesmo formato, para a tela e a exportação serem genéricas:
//   { titulo, filtros, resumo: [{ rotulo, valor, tipo }], divergencias: [{ nivel, texto, referencia }],
//     secoes: [{ titulo, colunas: [{ chave, titulo, tipo }], linhas, totais }], avisos }
// tipo de coluna: texto | moeda | numero | data | competencia
// A ATESA não forneceu modelos de relatório (exceto as planilhas de produtividade, já existentes);
// colunas e formatos seguem o padrão do sistema até a validação com o cliente.
import { pool } from '../config/database.js';
import { r2, erro, garantirEstruturaPagamentos } from './financeiroComum.js';

const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const MAX_MESES = 24;

export const RELATORIOS = {
  faturamento: 'Faturamento por processo',
  notas: 'Notas fiscais',
  cobrancas: 'Cobranças',
  recebimentos: 'Recebimentos',
  inadimplencia: 'Inadimplência',
  conciliacao: 'Conciliação bancária',
  pagamentos_cooperados: 'Pagamentos dos cooperados',
  contas_pagar: 'Contas a pagar',
  consolidacao: 'Consolidação por competência',
};

const iso = (d) => (d ? String(d).slice(0, 10) : null);
const soma = (linhas, chave) => r2(linhas.reduce((s, l) => s + (Number(l[chave]) || 0), 0));
const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);

function mesesEntre(ini, fim) {
  const [a1, m1] = ini.split('-').map(Number);
  const [a2, m2] = fim.split('-').map(Number);
  return (a2 - a1) * 12 + (m2 - m1) + 1;
}

/** Valida o intervalo de competências (padrão: últimos 12 meses). */
export function intervaloCompetencias({ competenciaInicio, competenciaFim } = {}) {
  const hoje = hojeISO().slice(0, 7);
  const fim = competenciaFim || hoje;
  let ini = competenciaInicio;
  if (!ini) {
    const [a, m] = fim.split('-').map(Number);
    const d = new Date(a, m - 12, 1);
    ini = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (!COMPETENCIA.test(ini) || !COMPETENCIA.test(fim)) throw erro(400, 'Competência inválida. Use AAAA-MM.');
  if (ini > fim) throw erro(400, 'A competência inicial é posterior à final.');
  if (mesesEntre(ini, fim) > MAX_MESES) throw erro(400, `Intervalo máximo de ${MAX_MESES} competências.`);
  return { ini, fim };
}

/** Valida o intervalo de datas (padrão: mês corrente). */
export function intervaloDatas({ dataInicio, dataFim } = {}) {
  const hoje = hojeISO();
  const ini = dataInicio || `${hoje.slice(0, 7)}-01`;
  const fim = dataFim || hoje;
  if (!DATA.test(ini) || !DATA.test(fim)) throw erro(400, 'Data inválida. Use AAAA-MM-DD.');
  if (ini > fim) throw erro(400, 'A data inicial é posterior à final.');
  if (diasEntre(ini, fim) > 731) throw erro(400, 'Intervalo máximo de 2 anos.');
  return { ini, fim };
}

const idOpcional = (v) => (v ? Number(v) || null : null);

// ── 1. Faturamento por processo ─────────────────────────────────────────────
export async function relatorioFaturamento(f = {}) {
  const { ini, fim } = intervaloCompetencias(f);
  const empresaId = idOpcional(f.empresaId);
  const params = [ini, fim];
  let filtro = '';
  if (empresaId) { filtro += ' AND p.empresa_id = ?'; params.push(empresaId); }
  if (f.status) { filtro += ' AND p.status = ?'; params.push(f.status); }
  const [procs] = await pool.query(
    `SELECT p.id, p.codigo, p.competencia, p.status, p.centro_custo, p.cooperativa, e.nome_empresa, u.nome_unidade,
            (SELECT COUNT(*) FROM faturamento_itens i WHERE i.processo_id = p.id) AS itens,
            (SELECT COALESCE(SUM(COALESCE(a.valor, i.total_horas)), 0) FROM faturamento_itens i
               LEFT JOIN faturamento_ajustes a ON a.processo_id = i.processo_id AND a.chave_item = i.chave_item AND a.campo = 'total_horas'
              WHERE i.processo_id = p.id) AS total_horas,
            (SELECT COUNT(*) FROM faturamento_notas n WHERE n.processo_id = p.id AND n.status = 'emitida') AS notas_emitidas,
            (SELECT COALESCE(SUM(n.valor_servicos), 0) FROM faturamento_notas n WHERE n.processo_id = p.id AND n.status = 'emitida') AS faturado,
            (SELECT COALESCE(SUM(n.valor_liquido), 0) FROM faturamento_notas n WHERE n.processo_id = p.id AND n.status = 'emitida') AS faturado_liquido,
            (SELECT COALESCE(SUM(c.valor), 0) FROM faturamento_cobrancas c WHERE c.processo_id = p.id AND c.status <> 'cancelada') AS cobrado,
            (SELECT COALESCE(SUM(c.valor_recebido), 0) FROM faturamento_cobrancas c WHERE c.processo_id = p.id AND c.status <> 'cancelada') AS recebido,
            (SELECT COUNT(*) FROM faturamento_cobrancas c WHERE c.processo_id = p.id AND c.status IN ('aberta','parcial') AND c.vencimento < CURDATE()) AS cobrancas_vencidas
       FROM faturamento_processos p
       JOIN empresas e ON e.id = p.empresa_id
       LEFT JOIN parametro_unidades u ON u.id = p.unidade_id
      WHERE p.competencia BETWEEN ? AND ? AND p.status <> 'cancelado'${filtro}
      ORDER BY p.competencia DESC, e.nome_empresa`,
    params
  );
  // Pagamentos de cooperados vinculados a cada processo (vínculo gravado na fila)
  const [pags] = await pool.query(
    `SELECT id, situacao, excecao, recebimento_confirmado, processos_vinculados FROM cooperado_pagamentos
      WHERE tipo = 'repasse' AND competencia BETWEEN ? AND ? AND situacao <> 'cancelado'`, [ini, fim]
  );
  const porProcesso = new Map();
  for (const pg of pags) {
    let vinc = [];
    try { vinc = JSON.parse(pg.processos_vinculados || '[]'); } catch { vinc = []; }
    for (const v of vinc) {
      if (!porProcesso.has(v.id)) porProcesso.set(v.id, []);
      porProcesso.get(v.id).push(pg);
    }
  }
  const divergencias = [];
  const linhas = procs.map((p) => {
    const ds = [];
    const lista = porProcesso.get(p.id) || [];
    const liberados = lista.filter((x) => ['liberado', 'em_lote', 'pago'].includes(x.situacao));
    const pagos = lista.filter((x) => x.situacao === 'pago');
    const semRecebimento = liberados.filter((x) => Number(x.excecao) && !Number(x.recebimento_confirmado));
    const faturado = r2(p.faturado);
    const cobrado = r2(p.cobrado);
    const recebido = r2(p.recebido);
    if (p.status === 'aprovado' && !Number(p.notas_emitidas)) ds.push('Apuração aprovada sem nota fiscal emitida.');
    if (Number(p.notas_emitidas) && cobrado !== faturado && cobrado !== r2(p.faturado_liquido)) ds.push(`Cobrado (${cobrado.toFixed(2)}) difere do faturado (${faturado.toFixed(2)}) e do líquido das notas.`);
    if (Number(p.notas_emitidas) && cobrado === 0) ds.push('Nota emitida sem cobrança.');
    if (recebido > cobrado) ds.push(`Recebido a maior: ${r2(recebido - cobrado).toFixed(2)}.`);
    if (Number(p.cobrancas_vencidas)) ds.push(`${p.cobrancas_vencidas} cobrança(s) vencida(s) em aberto.`);
    if (semRecebimento.length) ds.push(`${semRecebimento.length} pagamento(s) a cooperado liberado(s) por exceção sem recebimento confirmado.`);
    for (const d of ds) divergencias.push({ nivel: 'atencao', texto: d, referencia: `${p.codigo} · ${p.nome_empresa}` });
    return {
      codigo: p.codigo, competencia: p.competencia, cliente: p.nome_empresa, unidade: p.nome_unidade || 'Empresa inteira', centro_custo: p.centro_custo,
      status: p.status, itens: Number(p.itens), total_horas: r2(p.total_horas), faturado, cobrado, recebido, saldo: r2(cobrado - recebido),
      cooperados_liberados: liberados.length, cooperados_pagos: pagos.length, divergencias: ds.join(' | '),
    };
  });
  return {
    titulo: RELATORIOS.faturamento,
    filtros: { competenciaInicio: ini, competenciaFim: fim, empresaId, status: f.status || null },
    resumo: [
      { rotulo: 'Processos', valor: linhas.length, tipo: 'numero' },
      { rotulo: 'Faturado (NF emitidas)', valor: soma(linhas, 'faturado'), tipo: 'moeda' },
      { rotulo: 'Cobrado', valor: soma(linhas, 'cobrado'), tipo: 'moeda' },
      { rotulo: 'Recebido', valor: soma(linhas, 'recebido'), tipo: 'moeda' },
      { rotulo: 'A receber', valor: soma(linhas, 'saldo'), tipo: 'moeda' },
    ],
    divergencias,
    secoes: [{
      titulo: 'Processos de faturamento',
      colunas: [
        { chave: 'codigo', titulo: 'Processo', tipo: 'texto' }, { chave: 'competencia', titulo: 'Competência', tipo: 'competencia' },
        { chave: 'cliente', titulo: 'Cliente', tipo: 'texto' }, { chave: 'unidade', titulo: 'Unidade', tipo: 'texto' },
        { chave: 'centro_custo', titulo: 'Centro de custo', tipo: 'texto' }, { chave: 'status', titulo: 'Status', tipo: 'texto' },
        { chave: 'itens', titulo: 'Itens', tipo: 'numero' }, { chave: 'total_horas', titulo: 'Horas', tipo: 'numero' },
        { chave: 'faturado', titulo: 'Faturado', tipo: 'moeda' }, { chave: 'cobrado', titulo: 'Cobrado', tipo: 'moeda' },
        { chave: 'recebido', titulo: 'Recebido', tipo: 'moeda' }, { chave: 'saldo', titulo: 'A receber', tipo: 'moeda' },
        { chave: 'cooperados_liberados', titulo: 'Pagtos. liberados', tipo: 'numero' }, { chave: 'cooperados_pagos', titulo: 'Pagtos. pagos', tipo: 'numero' },
        { chave: 'divergencias', titulo: 'Divergências', tipo: 'texto' },
      ],
      linhas,
      totais: { itens: linhas.reduce((s, l) => s + l.itens, 0), total_horas: soma(linhas, 'total_horas'), faturado: soma(linhas, 'faturado'), cobrado: soma(linhas, 'cobrado'), recebido: soma(linhas, 'recebido'), saldo: soma(linhas, 'saldo') },
    }],
    avisos: ['Valores em R$ do faturamento vêm das notas fiscais registradas: a apuração ainda não tem preço de venda confirmado.'],
  };
}

// ── 2. Notas fiscais ────────────────────────────────────────────────────────
export async function relatorioNotas(f = {}) {
  const { ini, fim } = intervaloDatas(f);
  const params = [ini, fim];
  let filtro = '';
  if (f.status) { filtro += ' AND n.status = ?'; params.push(f.status); }
  if (idOpcional(f.empresaId)) { filtro += ' AND p.empresa_id = ?'; params.push(idOpcional(f.empresaId)); }
  const [rows] = await pool.query(
    `SELECT n.*, p.codigo AS processo_codigo, m.municipio AS mun, m.uf AS mun_uf,
            (SELECT COALESCE(SUM(c.valor), 0) FROM faturamento_cobrancas c WHERE c.nota_id = n.id AND c.status <> 'cancelada') AS cobrado,
            (SELECT COUNT(*) FROM financeiro_documentos d WHERE d.entidade = 'nota' AND d.entidade_id = n.id) AS anexos
       FROM faturamento_notas n
       JOIN faturamento_processos p ON p.id = n.processo_id
       LEFT JOIN fiscal_municipios m ON m.id = n.municipio_id
      WHERE COALESCE(n.data_emissao, DATE(n.criado_em)) BETWEEN ? AND ?${filtro}
      ORDER BY COALESCE(n.data_emissao, DATE(n.criado_em)), n.id`,
    params
  );
  const divergencias = [];
  const linhas = rows.map((n) => {
    const ds = [];
    const ref = `NF ${n.numero ?? `rascunho #${n.id}`} · ${n.tomador_nome ?? ''}`;
    if (n.status === 'emitida') {
      if (!Number(n.cobrado)) ds.push('Nota emitida sem cobrança.');
      else if (r2(n.cobrado) !== r2(n.valor_servicos) && r2(n.cobrado) !== r2(n.valor_liquido)) ds.push(`Cobranças (${r2(n.cobrado).toFixed(2)}) diferem do valor da nota e do líquido.`);
      if (!Number(n.anexos)) ds.push('Sem PDF/XML anexado.');
    }
    if (n.status === 'rascunho' && diasEntre(iso(n.criado_em), hojeISO()) > 15) ds.push('Rascunho há mais de 15 dias.');
    for (const d of ds) divergencias.push({ nivel: 'atencao', texto: d, referencia: ref });
    return {
      numero: n.numero ? `${n.numero}${n.serie ? `/${n.serie}` : ''}` : '—', status: n.status, emissao: iso(n.data_emissao), competencia: n.competencia,
      processo: n.processo_codigo, prefeitura: n.mun ? `${n.mun}/${n.mun_uf}` : null, tomador: n.tomador_nome, documento: n.tomador_documento,
      codigo_servico: n.codigo_servico, servicos: r2(n.valor_servicos), deducoes: r2(n.valor_deducoes), iss: r2(n.valor_iss), iss_retido: Number(n.iss_retido) ? 'Sim' : 'Não',
      retencoes: r2(Number(n.valor_pis) + Number(n.valor_cofins) + Number(n.valor_csll) + Number(n.valor_irrf) + Number(n.valor_inss) + Number(n.outras_retencoes)),
      liquido: n.valor_liquido === null ? null : r2(n.valor_liquido), cobrado: r2(n.cobrado), divergencias: ds.join(' | '),
    };
  });
  const emitidas = linhas.filter((l) => l.status === 'emitida');
  return {
    titulo: RELATORIOS.notas,
    filtros: { dataInicio: ini, dataFim: fim, status: f.status || null },
    resumo: [
      { rotulo: 'Notas emitidas', valor: emitidas.length, tipo: 'numero' },
      { rotulo: 'Valor dos serviços', valor: soma(emitidas, 'servicos'), tipo: 'moeda' },
      { rotulo: 'ISS', valor: soma(emitidas, 'iss'), tipo: 'moeda' },
      { rotulo: 'Retenções', valor: soma(emitidas, 'retencoes'), tipo: 'moeda' },
      { rotulo: 'Canceladas', valor: linhas.filter((l) => l.status === 'cancelada').length, tipo: 'numero' },
    ],
    divergencias,
    secoes: [{
      titulo: 'Notas fiscais (data de emissão; rascunhos pela data de criação)',
      colunas: [
        { chave: 'numero', titulo: 'Número', tipo: 'texto' }, { chave: 'status', titulo: 'Status', tipo: 'texto' }, { chave: 'emissao', titulo: 'Emissão', tipo: 'data' },
        { chave: 'competencia', titulo: 'Competência', tipo: 'competencia' }, { chave: 'processo', titulo: 'Processo', tipo: 'texto' }, { chave: 'prefeitura', titulo: 'Prefeitura', tipo: 'texto' },
        { chave: 'tomador', titulo: 'Tomador', tipo: 'texto' }, { chave: 'documento', titulo: 'CNPJ/CPF', tipo: 'texto' }, { chave: 'codigo_servico', titulo: 'Serviço', tipo: 'texto' },
        { chave: 'servicos', titulo: 'Serviços', tipo: 'moeda' }, { chave: 'deducoes', titulo: 'Deduções', tipo: 'moeda' }, { chave: 'iss', titulo: 'ISS', tipo: 'moeda' },
        { chave: 'iss_retido', titulo: 'ISS retido', tipo: 'texto' }, { chave: 'retencoes', titulo: 'Retenções federais/INSS', tipo: 'moeda' }, { chave: 'liquido', titulo: 'Líquido', tipo: 'moeda' },
        { chave: 'cobrado', titulo: 'Cobrado', tipo: 'moeda' }, { chave: 'divergencias', titulo: 'Divergências', tipo: 'texto' },
      ],
      linhas,
      totais: { servicos: soma(emitidas, 'servicos'), iss: soma(emitidas, 'iss'), retencoes: soma(emitidas, 'retencoes'), cobrado: soma(emitidas, 'cobrado') },
    }],
    avisos: ['Totais consideram somente notas emitidas. Os valores fiscais são os informados na nota (o sistema não calcula tributos).'],
  };
}

// ── 3. Cobranças ────────────────────────────────────────────────────────────
export async function relatorioCobrancas(f = {}) {
  const { ini, fim } = intervaloDatas(f);
  const params = [ini, fim];
  let filtro = '';
  if (f.status) { filtro += ' AND c.status IN (?)'; params.push(String(f.status).split(',')); }
  if (idOpcional(f.empresaId)) { filtro += ' AND c.empresa_id = ?'; params.push(idOpcional(f.empresaId)); }
  const [rows] = await pool.query(
    `SELECT c.*, e.nome_empresa, p.codigo AS processo_codigo, n.numero AS nota_numero
       FROM faturamento_cobrancas c JOIN empresas e ON e.id = c.empresa_id JOIN faturamento_processos p ON p.id = c.processo_id
       LEFT JOIN faturamento_notas n ON n.id = c.nota_id
      WHERE c.vencimento BETWEEN ? AND ?${filtro} ORDER BY c.vencimento, c.id`,
    params
  );
  const hoje = hojeISO();
  const divergencias = [];
  const linhas = rows.map((c) => {
    const venc = iso(c.vencimento);
    const aberto = ['aberta', 'parcial'].includes(c.status);
    const atraso = aberto && venc < hoje ? diasEntre(venc, hoje) : 0;
    const ds = [];
    if (c.status === 'divergente') ds.push(`Recebido a maior: ${r2(c.valor_recebido - c.valor).toFixed(2)}.`);
    if (atraso) ds.push(`Vencida há ${atraso} dia(s).`);
    if (c.status === 'parcial') ds.push(`Pagamento parcial: saldo ${r2(c.valor - c.valor_recebido).toFixed(2)}.`);
    for (const d of ds) divergencias.push({ nivel: c.status === 'divergente' ? 'erro' : 'atencao', texto: d, referencia: `${c.codigo} · ${c.nome_empresa}` });
    return {
      codigo: c.codigo, cliente: c.nome_empresa, processo: c.processo_codigo, nota: c.nota_numero, vencimento: venc, forma: c.forma,
      nosso_numero: c.nosso_numero ? `${c.banco_codigo ?? ''} ${c.nosso_numero}` : null, valor: r2(c.valor), recebido: r2(c.valor_recebido),
      saldo: c.status === 'cancelada' ? 0 : r2(c.valor - c.valor_recebido), status: c.status, dias_atraso: atraso, divergencias: ds.join(' | '),
    };
  });
  const ativas = linhas.filter((l) => l.status !== 'cancelada');
  return {
    titulo: RELATORIOS.cobrancas,
    filtros: { dataInicio: ini, dataFim: fim, status: f.status || null },
    resumo: [
      { rotulo: 'Cobranças', valor: ativas.length, tipo: 'numero' },
      { rotulo: 'Valor cobrado', valor: soma(ativas, 'valor'), tipo: 'moeda' },
      { rotulo: 'Recebido', valor: soma(ativas, 'recebido'), tipo: 'moeda' },
      { rotulo: 'Saldo', valor: soma(ativas, 'saldo'), tipo: 'moeda' },
      { rotulo: 'Vencidas em aberto', valor: ativas.filter((l) => l.dias_atraso > 0).length, tipo: 'numero' },
    ],
    divergencias,
    secoes: [{
      titulo: 'Cobranças por vencimento',
      colunas: [
        { chave: 'codigo', titulo: 'Cobrança', tipo: 'texto' }, { chave: 'cliente', titulo: 'Cliente', tipo: 'texto' }, { chave: 'processo', titulo: 'Processo', tipo: 'texto' },
        { chave: 'nota', titulo: 'NF', tipo: 'texto' }, { chave: 'vencimento', titulo: 'Vencimento', tipo: 'data' }, { chave: 'forma', titulo: 'Forma', tipo: 'texto' },
        { chave: 'nosso_numero', titulo: 'Nosso número', tipo: 'texto' }, { chave: 'valor', titulo: 'Valor', tipo: 'moeda' }, { chave: 'recebido', titulo: 'Recebido', tipo: 'moeda' },
        { chave: 'saldo', titulo: 'Saldo', tipo: 'moeda' }, { chave: 'status', titulo: 'Status', tipo: 'texto' }, { chave: 'dias_atraso', titulo: 'Dias de atraso', tipo: 'numero' },
        { chave: 'divergencias', titulo: 'Divergências', tipo: 'texto' },
      ],
      linhas,
      totais: { valor: soma(ativas, 'valor'), recebido: soma(ativas, 'recebido'), saldo: soma(ativas, 'saldo') },
    }],
    avisos: ['Totais excluem cobranças canceladas.'],
  };
}

// ── 4. Recebimentos ─────────────────────────────────────────────────────────
export async function relatorioRecebimentos(f = {}) {
  const { ini, fim } = intervaloDatas(f);
  const params = [ini, fim];
  let filtro = '';
  if (['retorno', 'manual'].includes(f.origem)) { filtro += ' AND r.origem = ?'; params.push(f.origem); }
  if (['ativo', 'estornado'].includes(f.situacao)) { filtro += ' AND r.situacao = ?'; params.push(f.situacao); }
  const [rows] = await pool.query(
    `SELECT r.*, c.codigo AS cobranca_codigo, e.nome_empresa, rt.nome_arquivo AS retorno_arquivo,
            (SELECT COUNT(*) FROM financeiro_documentos d WHERE d.entidade = 'recebimento' AND d.entidade_id = r.id) AS comprovantes
       FROM financeiro_recebimentos r
       LEFT JOIN faturamento_cobrancas c ON c.id = r.cobranca_id
       LEFT JOIN empresas e ON e.id = c.empresa_id
       LEFT JOIN financeiro_retorno_linhas rl ON rl.id = r.retorno_linha_id
       LEFT JOIN financeiro_retornos rt ON rt.id = rl.retorno_id
      WHERE r.data_pagamento BETWEEN ? AND ?${filtro} ORDER BY r.data_pagamento, r.id`,
    params
  );
  const divergencias = [];
  const linhas = rows.map((r) => {
    const ds = [];
    if (r.situacao === 'ativo' && !r.cobranca_id) ds.push('Pagamento não identificado (sem cobrança vinculada).');
    if (r.origem === 'manual' && !Number(r.comprovantes)) ds.push('Baixa manual sem comprovante anexado.');
    if (r.situacao === 'estornado') ds.push(`Estornado: ${r.motivo_estorno ?? ''}`);
    for (const d of ds) divergencias.push({ nivel: !r.cobranca_id && r.situacao === 'ativo' ? 'erro' : 'atencao', texto: d, referencia: `Recebimento #${r.id} · ${r2(r.valor).toFixed(2)}` });
    return {
      id: r.id, data_pagamento: iso(r.data_pagamento), data_credito: iso(r.data_credito), cobranca: r.cobranca_codigo, cliente: r.nome_empresa,
      origem: r.origem === 'manual' ? 'Baixa manual' : `Retorno${r.retorno_arquivo ? ` (${r.retorno_arquivo})` : ''}`, identificador: r.identificador,
      pagador: r.pagador_nome, valor: r2(r.valor), juros: r2(r.juros), desconto: r2(r.desconto), situacao: r.situacao,
      autorizado_por: r.autorizado_por_nome, divergencias: ds.join(' | '),
    };
  });
  const ativos = linhas.filter((l) => l.situacao === 'ativo');
  return {
    titulo: RELATORIOS.recebimentos,
    filtros: { dataInicio: ini, dataFim: fim, origem: f.origem || null, situacao: f.situacao || null },
    resumo: [
      { rotulo: 'Recebimentos ativos', valor: ativos.length, tipo: 'numero' },
      { rotulo: 'Total recebido', valor: soma(ativos, 'valor'), tipo: 'moeda' },
      { rotulo: 'Não identificado', valor: soma(ativos.filter((l) => !l.cobranca), 'valor'), tipo: 'moeda' },
      { rotulo: 'Baixas manuais', valor: soma(ativos.filter((l) => l.origem === 'Baixa manual'), 'valor'), tipo: 'moeda' },
      { rotulo: 'Estornado', valor: soma(linhas.filter((l) => l.situacao === 'estornado'), 'valor'), tipo: 'moeda' },
    ],
    divergencias,
    secoes: [{
      titulo: 'Recebimentos (data do pagamento)',
      colunas: [
        { chave: 'id', titulo: '#', tipo: 'numero' }, { chave: 'data_pagamento', titulo: 'Pagamento', tipo: 'data' }, { chave: 'data_credito', titulo: 'Crédito', tipo: 'data' },
        { chave: 'cobranca', titulo: 'Cobrança', tipo: 'texto' }, { chave: 'cliente', titulo: 'Cliente', tipo: 'texto' }, { chave: 'origem', titulo: 'Origem', tipo: 'texto' },
        { chave: 'identificador', titulo: 'Identificador', tipo: 'texto' }, { chave: 'pagador', titulo: 'Pagador', tipo: 'texto' }, { chave: 'valor', titulo: 'Valor', tipo: 'moeda' },
        { chave: 'juros', titulo: 'Juros', tipo: 'moeda' }, { chave: 'desconto', titulo: 'Desconto', tipo: 'moeda' }, { chave: 'situacao', titulo: 'Situação', tipo: 'texto' },
        { chave: 'autorizado_por', titulo: 'Autorizado por', tipo: 'texto' }, { chave: 'divergencias', titulo: 'Divergências', tipo: 'texto' },
      ],
      linhas,
      totais: { valor: soma(ativos, 'valor'), juros: soma(ativos, 'juros'), desconto: soma(ativos, 'desconto') },
    }],
    avisos: ['Totais consideram somente recebimentos ativos (estornados ficam listados para rastreabilidade).'],
  };
}

// ── 5. Inadimplência ────────────────────────────────────────────────────────
export async function relatorioInadimplencia(f = {}) {
  const dataBase = f.dataBase || hojeISO();
  if (!DATA.test(dataBase)) throw erro(400, 'Data base inválida. Use AAAA-MM-DD.');
  const params = [dataBase];
  let filtro = '';
  if (idOpcional(f.empresaId)) { filtro += ' AND c.empresa_id = ?'; params.push(idOpcional(f.empresaId)); }
  const [rows] = await pool.query(
    `SELECT c.*, e.nome_empresa, e.cnpj FROM faturamento_cobrancas c JOIN empresas e ON e.id = c.empresa_id
      WHERE c.status IN ('aberta','parcial') AND c.vencimento < ?${filtro} ORDER BY e.nome_empresa, c.vencimento`,
    params
  );
  const FAIXAS = [['ate_30', 1, 30], ['de_31_60', 31, 60], ['de_61_90', 61, 90], ['acima_90', 91, Infinity]];
  const porCliente = new Map();
  const detalhe = rows.map((c) => {
    const venc = iso(c.vencimento);
    const dias = diasEntre(venc, dataBase);
    const saldo = r2(c.valor - c.valor_recebido);
    const faixa = FAIXAS.find(([, a, b]) => dias >= a && dias <= b)[0];
    if (!porCliente.has(c.empresa_id)) {
      porCliente.set(c.empresa_id, { cliente: c.nome_empresa, cnpj: c.cnpj, cobrancas: 0, total: 0, ate_30: 0, de_31_60: 0, de_61_90: 0, acima_90: 0, mais_antiga: venc });
    }
    const g = porCliente.get(c.empresa_id);
    g.cobrancas++;
    g.total = r2(g.total + saldo);
    g[faixa] = r2(g[faixa] + saldo);
    if (venc < g.mais_antiga) g.mais_antiga = venc;
    return { codigo: c.codigo, cliente: c.nome_empresa, vencimento: venc, dias_atraso: dias, valor: r2(c.valor), recebido: r2(c.valor_recebido), saldo, status: c.status };
  });
  const clientes = [...porCliente.values()].sort((a, b) => b.total - a.total);
  return {
    titulo: RELATORIOS.inadimplencia,
    filtros: { dataBase, empresaId: idOpcional(f.empresaId) },
    resumo: [
      { rotulo: 'Clientes inadimplentes', valor: clientes.length, tipo: 'numero' },
      { rotulo: 'Total vencido', valor: soma(clientes, 'total'), tipo: 'moeda' },
      { rotulo: 'Até 30 dias', valor: soma(clientes, 'ate_30'), tipo: 'moeda' },
      { rotulo: '31 a 90 dias', valor: r2(soma(clientes, 'de_31_60') + soma(clientes, 'de_61_90')), tipo: 'moeda' },
      { rotulo: 'Acima de 90 dias', valor: soma(clientes, 'acima_90'), tipo: 'moeda' },
    ],
    divergencias: clientes.filter((c) => c.acima_90 > 0).map((c) => ({ nivel: 'erro', texto: `Saldo vencido há mais de 90 dias: ${c.acima_90.toFixed(2)}.`, referencia: c.cliente })),
    secoes: [
      {
        titulo: `Por cliente (data base ${dataBase.split('-').reverse().join('/')})`,
        colunas: [
          { chave: 'cliente', titulo: 'Cliente', tipo: 'texto' }, { chave: 'cnpj', titulo: 'CNPJ', tipo: 'texto' }, { chave: 'cobrancas', titulo: 'Cobranças', tipo: 'numero' },
          { chave: 'mais_antiga', titulo: 'Vencimento mais antigo', tipo: 'data' }, { chave: 'ate_30', titulo: '1–30 dias', tipo: 'moeda' }, { chave: 'de_31_60', titulo: '31–60 dias', tipo: 'moeda' },
          { chave: 'de_61_90', titulo: '61–90 dias', tipo: 'moeda' }, { chave: 'acima_90', titulo: '> 90 dias', tipo: 'moeda' }, { chave: 'total', titulo: 'Total vencido', tipo: 'moeda' },
        ],
        linhas: clientes,
        totais: { cobrancas: clientes.reduce((s, c) => s + c.cobrancas, 0), ate_30: soma(clientes, 'ate_30'), de_31_60: soma(clientes, 'de_31_60'), de_61_90: soma(clientes, 'de_61_90'), acima_90: soma(clientes, 'acima_90'), total: soma(clientes, 'total') },
      },
      {
        titulo: 'Cobranças vencidas',
        colunas: [
          { chave: 'codigo', titulo: 'Cobrança', tipo: 'texto' }, { chave: 'cliente', titulo: 'Cliente', tipo: 'texto' }, { chave: 'vencimento', titulo: 'Vencimento', tipo: 'data' },
          { chave: 'dias_atraso', titulo: 'Dias de atraso', tipo: 'numero' }, { chave: 'valor', titulo: 'Valor', tipo: 'moeda' }, { chave: 'recebido', titulo: 'Recebido', tipo: 'moeda' },
          { chave: 'saldo', titulo: 'Saldo', tipo: 'moeda' }, { chave: 'status', titulo: 'Status', tipo: 'texto' },
        ],
        linhas: detalhe,
        totais: { valor: soma(detalhe, 'valor'), recebido: soma(detalhe, 'recebido'), saldo: soma(detalhe, 'saldo') },
      },
    ],
    avisos: ['Juros e multa por atraso não são calculados (regra não definida pela ATESA).'],
  };
}

// ── 6. Conciliação bancária ─────────────────────────────────────────────────
export async function relatorioConciliacao(f = {}) {
  const { ini, fim } = intervaloDatas(f);
  const [rets] = await pool.query(
    `SELECT * FROM financeiro_retornos WHERE DATE(importado_em) BETWEEN ? AND ? ORDER BY importado_em, id`, [ini, fim]
  );
  const CLASSES = ['integral', 'parcial', 'a_maior', 'nao_identificado', 'ja_quitada', 'cobranca_cancelada', 'duplicado'];
  const linhasRet = rets.map((r) => {
    let resumo = {};
    try { resumo = JSON.parse(r.resumo || '{}'); } catch { resumo = {}; }
    const l = {
      id: r.id, arquivo: r.nome_arquivo, leiaute: `${r.layout}${r.banco_codigo ? ` ${r.banco_codigo}` : ''}`, importado_em: iso(r.importado_em),
      status: r.status, registros: Number(r.total_registros), valor: r2(r.valor_total),
    };
    for (const c of CLASSES) l[c] = resumo[c]?.quantidade || 0;
    return l;
  });
  const [naoIdent] = await pool.query(
    `SELECT id, data_pagamento, identificador, pagador_nome, valor, observacao FROM financeiro_recebimentos WHERE cobranca_id IS NULL AND situacao = 'ativo' ORDER BY data_pagamento`
  );
  const [aMaior] = await pool.query(
    `SELECT c.codigo, e.nome_empresa, c.valor, c.valor_recebido FROM faturamento_cobrancas c JOIN empresas e ON e.id = c.empresa_id WHERE c.status = 'divergente' ORDER BY c.vencimento`
  );
  const divergencias = [
    ...rets.filter((r) => r.status === 'pendente').map((r) => ({ nivel: 'atencao', texto: 'Retorno importado e ainda não processado.', referencia: `Retorno #${r.id} · ${r.nome_arquivo}` })),
    ...naoIdent.map((r) => ({ nivel: 'erro', texto: `Pagamento não identificado de ${r2(r.valor).toFixed(2)}.`, referencia: `Recebimento #${r.id} · ${r.identificador ?? ''}` })),
    ...aMaior.map((c) => ({ nivel: 'erro', texto: `Recebido a maior: ${r2(c.valor_recebido - c.valor).toFixed(2)}.`, referencia: `${c.codigo} · ${c.nome_empresa}` })),
  ];
  return {
    titulo: RELATORIOS.conciliacao,
    filtros: { dataInicio: ini, dataFim: fim },
    resumo: [
      { rotulo: 'Arquivos importados', valor: rets.length, tipo: 'numero' },
      { rotulo: 'Pendentes de processamento', valor: rets.filter((r) => r.status === 'pendente').length, tipo: 'numero' },
      { rotulo: 'Não identificados (em aberto)', valor: r2(naoIdent.reduce((s, r) => s + Number(r.valor), 0)), tipo: 'moeda' },
      { rotulo: 'Cobranças recebidas a maior', valor: aMaior.length, tipo: 'numero' },
    ],
    divergencias,
    secoes: [
      {
        titulo: 'Arquivos de retorno (data de importação)',
        colunas: [
          { chave: 'id', titulo: '#', tipo: 'numero' }, { chave: 'arquivo', titulo: 'Arquivo', tipo: 'texto' }, { chave: 'leiaute', titulo: 'Leiaute', tipo: 'texto' },
          { chave: 'importado_em', titulo: 'Importado em', tipo: 'data' }, { chave: 'status', titulo: 'Status', tipo: 'texto' }, { chave: 'registros', titulo: 'Registros', tipo: 'numero' },
          { chave: 'valor', titulo: 'Valor', tipo: 'moeda' }, { chave: 'integral', titulo: 'Integrais', tipo: 'numero' }, { chave: 'parcial', titulo: 'Parciais', tipo: 'numero' },
          { chave: 'a_maior', titulo: 'A maior', tipo: 'numero' }, { chave: 'nao_identificado', titulo: 'Não ident.', tipo: 'numero' }, { chave: 'ja_quitada', titulo: 'Já quitadas', tipo: 'numero' },
          { chave: 'cobranca_cancelada', titulo: 'Cob. cancelada', tipo: 'numero' }, { chave: 'duplicado', titulo: 'Duplicados', tipo: 'numero' },
        ],
        linhas: linhasRet,
        totais: { registros: linhasRet.reduce((s, l) => s + l.registros, 0), valor: soma(linhasRet, 'valor') },
      },
      {
        titulo: 'Pagamentos não identificados em aberto (todos os períodos)',
        colunas: [
          { chave: 'id', titulo: '#', tipo: 'numero' }, { chave: 'data_pagamento', titulo: 'Pagamento', tipo: 'data' }, { chave: 'identificador', titulo: 'Identificador', tipo: 'texto' },
          { chave: 'pagador_nome', titulo: 'Pagador', tipo: 'texto' }, { chave: 'valor', titulo: 'Valor', tipo: 'moeda' }, { chave: 'observacao', titulo: 'Observação', tipo: 'texto' },
        ],
        linhas: naoIdent.map((r) => ({ ...r, data_pagamento: iso(r.data_pagamento), valor: r2(r.valor) })),
        totais: { valor: r2(naoIdent.reduce((s, r) => s + Number(r.valor), 0)) },
      },
    ],
    avisos: ['Conciliação com o extrato bancário (saldo da conta) não é feita: não há importação de extrato nem leiaute fornecido.'],
  };
}

// ── 7. Pagamentos dos cooperados ────────────────────────────────────────────
export async function relatorioPagamentosCooperados(f = {}) {
  const { ini, fim } = intervaloCompetencias(f);
  const params = [ini, fim];
  let filtro = '';
  if (f.situacao) { filtro += ' AND p.situacao IN (?)'; params.push(String(f.situacao).split(',')); }
  if (['repasse', 'adiantamento'].includes(f.tipo)) { filtro += ' AND p.tipo = ?'; params.push(f.tipo); }
  const [rows] = await pool.query(
    `SELECT p.*, c.nome, c.matricula, c.status AS status_cadastro,
            (SELECT l.codigo FROM pagamento_lote_itens i JOIN pagamento_lotes l ON l.id = i.lote_id WHERE i.pagamento_id = p.id ORDER BY i.id DESC LIMIT 1) AS lote
       FROM cooperado_pagamentos p JOIN ra_candidatos c ON c.id = p.candidato_id
      WHERE p.competencia BETWEEN ? AND ?${filtro} ORDER BY p.competencia DESC, c.nome`,
    params
  );
  const STATUS_COOP = { 1: 'Ativo', 2: 'Inativo', 4: 'Desligado' };
  const divergencias = [];
  const linhas = rows.map((p) => {
    const ds = [];
    if (Number(p.excecao)) ds.push(`Liberado por exceção (${p.excecao_por_nome ?? '—'}): ${p.excecao_motivo ?? ''}`);
    if (['liberado', 'em_lote', 'pago'].includes(p.situacao) && !Number(p.recebimento_confirmado)) ds.push('Liberado sem recebimento do cliente confirmado.');
    if (p.situacao === 'retido') ds.push('Retido (cooperado inativo/desligado ou bloqueado).');
    if (p.situacao === 'rejeitado') ds.push(`Rejeitado pelo banco: ${p.motivo_situacao ?? ''}`);
    if (p.situacao === 'em_lote') ds.push('Em lote aguardando confirmação do banco.');
    for (const d of ds) divergencias.push({ nivel: p.situacao === 'rejeitado' || d.startsWith('Liberado sem') ? 'erro' : 'atencao', texto: d, referencia: `${p.codigo} · ${p.nome}` });
    return {
      codigo: p.codigo, competencia: p.competencia, cooperado: p.nome, matricula: p.matricula, cadastro: STATUS_COOP[p.status_cadastro] ?? String(p.status_cadastro),
      tipo: p.tipo, creditos: r2(p.valor_creditos), debitos: r2(p.valor_debitos), liquido: r2(p.valor_liquido), situacao: p.situacao,
      recebimento: Number(p.recebimento_confirmado) ? 'Confirmado' : 'Não confirmado', liberado_por: p.liberado_por_nome, lote: p.lote,
      data_pagamento: iso(p.data_pagamento), divergencias: ds.join(' | '),
    };
  });
  const somaSit = (sits) => soma(linhas.filter((l) => sits.includes(l.situacao)), 'liquido');
  return {
    titulo: RELATORIOS.pagamentos_cooperados,
    filtros: { competenciaInicio: ini, competenciaFim: fim, situacao: f.situacao || null, tipo: f.tipo || null },
    resumo: [
      { rotulo: 'Em preparação / retidos', valor: somaSit(['em_preparacao', 'retido', 'rejeitado']), tipo: 'moeda' },
      { rotulo: 'Liberado (inclui em lote)', valor: somaSit(['liberado', 'em_lote']), tipo: 'moeda' },
      { rotulo: 'Pago', valor: somaSit(['pago']), tipo: 'moeda' },
      { rotulo: 'Liberados por exceção', valor: linhas.filter((l) => l.divergencias.includes('exceção')).length, tipo: 'numero' },
    ],
    divergencias,
    secoes: [{
      titulo: 'Pagamentos',
      colunas: [
        { chave: 'codigo', titulo: 'Pagamento', tipo: 'texto' }, { chave: 'competencia', titulo: 'Competência', tipo: 'competencia' }, { chave: 'cooperado', titulo: 'Cooperado', tipo: 'texto' },
        { chave: 'matricula', titulo: 'Matrícula', tipo: 'texto' }, { chave: 'cadastro', titulo: 'Cadastro', tipo: 'texto' }, { chave: 'tipo', titulo: 'Tipo', tipo: 'texto' },
        { chave: 'creditos', titulo: 'Créditos', tipo: 'moeda' }, { chave: 'debitos', titulo: 'Descontos', tipo: 'moeda' }, { chave: 'liquido', titulo: 'Líquido', tipo: 'moeda' },
        { chave: 'situacao', titulo: 'Situação', tipo: 'texto' }, { chave: 'recebimento', titulo: 'Recebimento do cliente', tipo: 'texto' },
        { chave: 'liberado_por', titulo: 'Liberado por', tipo: 'texto' }, { chave: 'lote', titulo: 'Lote', tipo: 'texto' }, { chave: 'data_pagamento', titulo: 'Pago em', tipo: 'data' },
        { chave: 'divergencias', titulo: 'Divergências', tipo: 'texto' },
      ],
      linhas: linhas.filter((l) => l.situacao !== 'cancelado'),
      totais: { creditos: soma(linhas.filter((l) => l.situacao !== 'cancelado'), 'creditos'), debitos: soma(linhas.filter((l) => l.situacao !== 'cancelado'), 'debitos'), liquido: soma(linhas.filter((l) => l.situacao !== 'cancelado'), 'liquido') },
    }],
    avisos: ['Pagamentos cancelados não aparecem; o histórico de cada pagamento fica na fila.'],
  };
}

// ── 8. Contas a pagar ───────────────────────────────────────────────────────
export async function relatorioContasPagar(f = {}) {
  const { ini, fim } = intervaloDatas(f);
  const params = [ini, fim];
  let filtro = '';
  if (f.situacao) { filtro += ' AND cp.situacao IN (?)'; params.push(String(f.situacao).split(',')); }
  if (idOpcional(f.categoriaId)) { filtro += ' AND cp.categoria_id = ?'; params.push(idOpcional(f.categoriaId)); }
  if (idOpcional(f.fornecedorId)) { filtro += ' AND cp.fornecedor_id = ?'; params.push(idOpcional(f.fornecedorId)); }
  const [rows] = await pool.query(
    `SELECT cp.*, fo.nome AS fornecedor, fo.documento AS fornecedor_documento, cat.nome AS categoria,
            (SELECT COUNT(*) FROM financeiro_documentos d WHERE d.entidade = 'conta_pagar' AND d.entidade_id = cp.id AND d.tipo = 'documento_fiscal') AS docs_fiscais
       FROM contas_pagar cp JOIN fornecedores fo ON fo.id = cp.fornecedor_id JOIN contas_pagar_categorias cat ON cat.id = cp.categoria_id
      WHERE cp.vencimento BETWEEN ? AND ?${filtro} ORDER BY cp.vencimento, cp.id`,
    params
  );
  const hoje = hojeISO();
  const divergencias = [];
  const linhas = rows.map((c) => {
    const venc = iso(c.vencimento);
    const ds = [];
    if (['aguardando_aprovacao', 'aprovada', 'programada'].includes(c.situacao) && venc < hoje) ds.push(`Vencida há ${diasEntre(venc, hoje)} dia(s) sem pagamento.`);
    if (c.situacao === 'paga' && iso(c.data_pagamento) > venc) ds.push(`Paga com atraso (juros ${r2(c.juros).toFixed(2)}, multa ${r2(c.multa).toFixed(2)}).`);
    if (c.situacao === 'paga' && !Number(c.docs_fiscais)) ds.push('Paga sem documento fiscal anexado.');
    if (c.aprovado_por_id && Number(c.aprovado_por_id) === Number(c.criado_por_id)) ds.push('Aprovada pelo mesmo usuário que lançou.');
    for (const d of ds) divergencias.push({ nivel: d.startsWith('Vencida') ? 'erro' : 'atencao', texto: d, referencia: `${c.codigo} · ${c.fornecedor}` });
    return {
      codigo: c.codigo, fornecedor: c.fornecedor, documento: c.fornecedor_documento, categoria: c.categoria, descricao: c.descricao, competencia: c.competencia,
      doc_fiscal: `${c.documento_tipo}${c.documento_numero ? ` ${c.documento_numero}` : ''}`, vencimento: venc, valor: c.situacao === 'cancelada' ? 0 : r2(c.valor),
      situacao: c.situacao, programada: iso(c.data_programada), pagamento: iso(c.data_pagamento), valor_pago: c.valor_pago === null ? null : r2(c.valor_pago),
      aprovado_por: c.aprovado_por_nome, baixado_por: c.baixado_por_nome, divergencias: ds.join(' | '),
    };
  });
  const ativas = linhas.filter((l) => l.situacao !== 'cancelada');
  const porCategoria = new Map();
  for (const l of ativas) {
    if (!porCategoria.has(l.categoria)) porCategoria.set(l.categoria, { categoria: l.categoria, contas: 0, valor: 0, pago: 0, em_aberto: 0 });
    const g = porCategoria.get(l.categoria);
    g.contas++;
    g.valor = r2(g.valor + l.valor);
    if (l.situacao === 'paga') g.pago = r2(g.pago + (l.valor_pago ?? 0));
    else if (l.situacao !== 'rejeitada') g.em_aberto = r2(g.em_aberto + l.valor);
  }
  const cats = [...porCategoria.values()].sort((a, b) => b.valor - a.valor);
  return {
    titulo: RELATORIOS.contas_pagar,
    filtros: { dataInicio: ini, dataFim: fim, situacao: f.situacao || null },
    resumo: [
      { rotulo: 'Contas', valor: ativas.length, tipo: 'numero' },
      { rotulo: 'Valor', valor: soma(ativas, 'valor'), tipo: 'moeda' },
      { rotulo: 'Pago', valor: soma(ativas.filter((l) => l.situacao === 'paga'), 'valor_pago'), tipo: 'moeda' },
      { rotulo: 'Em aberto', valor: soma(ativas.filter((l) => !['paga', 'rejeitada'].includes(l.situacao)), 'valor'), tipo: 'moeda' },
      { rotulo: 'Vencidas', valor: ativas.filter((l) => l.divergencias.includes('Vencida')).length, tipo: 'numero' },
    ],
    divergencias,
    secoes: [
      {
        titulo: 'Por categoria',
        colunas: [{ chave: 'categoria', titulo: 'Categoria', tipo: 'texto' }, { chave: 'contas', titulo: 'Contas', tipo: 'numero' }, { chave: 'valor', titulo: 'Valor', tipo: 'moeda' }, { chave: 'pago', titulo: 'Pago', tipo: 'moeda' }, { chave: 'em_aberto', titulo: 'Em aberto', tipo: 'moeda' }],
        linhas: cats,
        totais: { contas: cats.reduce((s, c) => s + c.contas, 0), valor: soma(cats, 'valor'), pago: soma(cats, 'pago'), em_aberto: soma(cats, 'em_aberto') },
      },
      {
        titulo: 'Contas (vencimento)',
        colunas: [
          { chave: 'codigo', titulo: 'Conta', tipo: 'texto' }, { chave: 'fornecedor', titulo: 'Fornecedor', tipo: 'texto' }, { chave: 'documento', titulo: 'CPF/CNPJ', tipo: 'texto' },
          { chave: 'categoria', titulo: 'Categoria', tipo: 'texto' }, { chave: 'descricao', titulo: 'Descrição', tipo: 'texto' }, { chave: 'competencia', titulo: 'Competência', tipo: 'competencia' },
          { chave: 'doc_fiscal', titulo: 'Documento', tipo: 'texto' }, { chave: 'vencimento', titulo: 'Vencimento', tipo: 'data' }, { chave: 'valor', titulo: 'Valor', tipo: 'moeda' },
          { chave: 'situacao', titulo: 'Situação', tipo: 'texto' }, { chave: 'programada', titulo: 'Programada', tipo: 'data' }, { chave: 'pagamento', titulo: 'Pago em', tipo: 'data' },
          { chave: 'valor_pago', titulo: 'Valor pago', tipo: 'moeda' }, { chave: 'aprovado_por', titulo: 'Aprovado por', tipo: 'texto' }, { chave: 'baixado_por', titulo: 'Baixa por', tipo: 'texto' },
          { chave: 'divergencias', titulo: 'Divergências', tipo: 'texto' },
        ],
        linhas,
        totais: { valor: soma(ativas, 'valor'), valor_pago: soma(ativas, 'valor_pago') },
      },
    ],
    avisos: ['Totais excluem contas canceladas.'],
  };
}

// ── 9. Consolidação por competência ─────────────────────────────────────────
export async function relatorioConsolidacao(f = {}) {
  const { ini, fim } = intervaloCompetencias(f);
  const q = async (sql) => (await pool.query(sql, [ini, fim]))[0];
  const nf = await q(`SELECT p.competencia, SUM(n.valor_servicos) AS v FROM faturamento_notas n JOIN faturamento_processos p ON p.id = n.processo_id WHERE n.status = 'emitida' AND p.competencia BETWEEN ? AND ? GROUP BY p.competencia`);
  const cob = await q(`SELECT p.competencia, SUM(c.valor) AS cobrado, SUM(c.valor_recebido) AS recebido,
                              SUM(CASE WHEN c.status IN ('aberta','parcial') AND c.vencimento < CURDATE() THEN c.valor - c.valor_recebido ELSE 0 END) AS vencido
                         FROM faturamento_cobrancas c JOIN faturamento_processos p ON p.id = c.processo_id
                        WHERE c.status <> 'cancelada' AND p.competencia BETWEEN ? AND ? GROUP BY p.competencia`);
  const pag = await q(`SELECT competencia,
                              SUM(CASE WHEN tipo = 'repasse' AND situacao IN ('liberado','em_lote','pago') THEN valor_liquido ELSE 0 END) AS liberado,
                              SUM(CASE WHEN tipo = 'repasse' AND situacao = 'pago' THEN valor_liquido ELSE 0 END) AS pago,
                              SUM(CASE WHEN tipo = 'repasse' AND situacao IN ('em_preparacao','retido','rejeitado') THEN valor_liquido ELSE 0 END) AS a_liberar,
                              SUM(CASE WHEN tipo = 'adiantamento' AND situacao = 'pago' THEN valor_liquido ELSE 0 END) AS adiantado,
                              SUM(CASE WHEN situacao IN ('liberado','em_lote','pago') AND excecao = 1 AND recebimento_confirmado = 0 THEN valor_liquido ELSE 0 END) AS sem_recebimento
                         FROM cooperado_pagamentos WHERE competencia BETWEEN ? AND ? GROUP BY competencia`);
  const cp = await q(`SELECT competencia, SUM(CASE WHEN situacao = 'paga' THEN valor_pago ELSE 0 END) AS pagas,
                             SUM(CASE WHEN situacao IN ('aguardando_aprovacao','aprovada','programada') THEN valor ELSE 0 END) AS abertas
                        FROM contas_pagar WHERE competencia BETWEEN ? AND ? GROUP BY competencia`);
  const comps = [];
  for (let c = ini; c <= fim;) {
    comps.push(c);
    const [a, m] = c.split('-').map(Number);
    c = m === 12 ? `${a + 1}-01` : `${a}-${String(m + 1).padStart(2, '0')}`;
  }
  const idx = (lista) => new Map(lista.map((x) => [x.competencia, x]));
  const [mNf, mCob, mPag, mCp] = [idx(nf), idx(cob), idx(pag), idx(cp)];
  const divergencias = [];
  const linhas = comps.reverse().map((c) => {
    const l = {
      competencia: c,
      faturado: r2(mNf.get(c)?.v), cobrado: r2(mCob.get(c)?.cobrado), recebido: r2(mCob.get(c)?.recebido), vencido: r2(mCob.get(c)?.vencido),
      repasse_a_liberar: r2(mPag.get(c)?.a_liberar), repasse_liberado: r2(mPag.get(c)?.liberado), repasse_pago: r2(mPag.get(c)?.pago),
      adiantamentos_pagos: r2(mPag.get(c)?.adiantado), liberado_sem_recebimento: r2(mPag.get(c)?.sem_recebimento),
      contas_pagas: r2(mCp.get(c)?.pagas), contas_em_aberto: r2(mCp.get(c)?.abertas),
    };
    l.faturado_menos_cobrado = r2(l.faturado - l.cobrado);
    l.cobrado_menos_recebido = r2(l.cobrado - l.recebido);
    l.liberado_menos_pago = r2(l.repasse_liberado - l.repasse_pago);
    const ds = [];
    if (l.faturado && l.faturado_menos_cobrado) ds.push(`Faturado − cobrado = ${l.faturado_menos_cobrado.toFixed(2)} (regra bruto/líquido da cobrança não definida).`);
    if (l.recebido > l.cobrado) ds.push(`Recebido acima do cobrado: ${r2(l.recebido - l.cobrado).toFixed(2)}.`);
    if (l.liberado_sem_recebimento) ds.push(`Repasse liberado por exceção sem recebimento: ${l.liberado_sem_recebimento.toFixed(2)}.`);
    if (l.liberado_menos_pago) ds.push(`Liberado e ainda não pago (aguardando banco/confirmação): ${l.liberado_menos_pago.toFixed(2)}.`);
    if (l.repasse_liberado > l.recebido && l.recebido > 0) ds.push(`Repasse liberado (${l.repasse_liberado.toFixed(2)}) maior que o recebido do cliente (${l.recebido.toFixed(2)}).`);
    l.divergencias = ds.join(' | ');
    for (const d of ds) divergencias.push({ nivel: d.startsWith('Repasse liberado') || d.startsWith('Recebido acima') ? 'erro' : 'atencao', texto: d, referencia: c });
    return l;
  });
  const T = (k) => soma(linhas, k);
  return {
    titulo: RELATORIOS.consolidacao,
    filtros: { competenciaInicio: ini, competenciaFim: fim },
    resumo: [
      { rotulo: 'Faturado', valor: T('faturado'), tipo: 'moeda' },
      { rotulo: 'Recebido', valor: T('recebido'), tipo: 'moeda' },
      { rotulo: 'Repasse liberado', valor: T('repasse_liberado'), tipo: 'moeda' },
      { rotulo: 'Repasse pago', valor: T('repasse_pago'), tipo: 'moeda' },
      { rotulo: 'Contas pagas', valor: T('contas_pagas'), tipo: 'moeda' },
    ],
    divergencias,
    secoes: [{
      titulo: 'Fluxo por competência: faturado → cobrado → recebido → liberado → pago',
      colunas: [
        { chave: 'competencia', titulo: 'Competência', tipo: 'competencia' }, { chave: 'faturado', titulo: 'Faturado (NF)', tipo: 'moeda' }, { chave: 'cobrado', titulo: 'Cobrado', tipo: 'moeda' },
        { chave: 'recebido', titulo: 'Recebido', tipo: 'moeda' }, { chave: 'vencido', titulo: 'Vencido em aberto', tipo: 'moeda' },
        { chave: 'repasse_a_liberar', titulo: 'Repasse a liberar', tipo: 'moeda' }, { chave: 'repasse_liberado', titulo: 'Repasse liberado', tipo: 'moeda' },
        { chave: 'repasse_pago', titulo: 'Repasse pago', tipo: 'moeda' }, { chave: 'adiantamentos_pagos', titulo: 'Adiantamentos pagos', tipo: 'moeda' },
        { chave: 'liberado_sem_recebimento', titulo: 'Liberado sem recebimento', tipo: 'moeda' },
        { chave: 'contas_pagas', titulo: 'Contas pagas', tipo: 'moeda' }, { chave: 'contas_em_aberto', titulo: 'Contas em aberto', tipo: 'moeda' },
        { chave: 'faturado_menos_cobrado', titulo: 'Faturado − cobrado', tipo: 'moeda' }, { chave: 'cobrado_menos_recebido', titulo: 'Cobrado − recebido', tipo: 'moeda' },
        { chave: 'liberado_menos_pago', titulo: 'Liberado − pago', tipo: 'moeda' }, { chave: 'divergencias', titulo: 'Divergências', tipo: 'texto' },
      ],
      linhas,
      totais: Object.fromEntries(['faturado', 'cobrado', 'recebido', 'vencido', 'repasse_a_liberar', 'repasse_liberado', 'repasse_pago', 'adiantamentos_pagos', 'liberado_sem_recebimento',
        'contas_pagas', 'contas_em_aberto', 'faturado_menos_cobrado', 'cobrado_menos_recebido', 'liberado_menos_pago'].map((k) => [k, T(k)])),
    }],
    avisos: [
      'Resumo gerencial por competência, não lançamentos contábeis: a ATESA ainda não forneceu plano de contas nem leiaute de exportação para a contabilidade.',
      'Faturado/cobrado/recebido seguem a competência do processo de faturamento; repasses, a competência do pagamento; contas a pagar, a competência informada na conta.',
    ],
  };
}

const GERADORES = {
  faturamento: relatorioFaturamento, notas: relatorioNotas, cobrancas: relatorioCobrancas, recebimentos: relatorioRecebimentos,
  inadimplencia: relatorioInadimplencia, conciliacao: relatorioConciliacao, pagamentos_cooperados: relatorioPagamentosCooperados,
  contas_pagar: relatorioContasPagar, consolidacao: relatorioConsolidacao,
};

export async function gerarRelatorio(tipo, filtros) {
  const fn = GERADORES[tipo];
  if (!fn) throw erro(404, 'Relatório inexistente.');
  await garantirEstruturaPagamentos();
  const r = await fn(filtros ?? {});
  return { tipo, gerado_em: new Date().toISOString(), ...r };
}
