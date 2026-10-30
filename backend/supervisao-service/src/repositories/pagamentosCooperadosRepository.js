// ── Pagamentos de cooperados: lançamentos, adiantamentos, bloqueios e fila ───
// Extrato (cooperado_lancamentos): todo crédito/débito tem origem, valor, competência, situação e
// histórico. A chave de origem impede lançar duas vezes o mesmo desconto/remuneração.
//   aguardando → (débito de adiantamento ainda não pago)  pendente → reservado (no pagamento)
//   → liquidado (pagamento confirmado) | cancelado. Correções de liquidados: estorno (lançamento oposto).
//
// Fontes reutilizadas: esocial_remuneracoes (bruto/INSS/IRRF importados pelo Benefícios),
// ra_descontos e ra_cotas_mensais (cadastro de descontos). Nenhuma fórmula é aplicada: descontos em
// percentual e regras ambíguas ficam como "regra pendente" e não são lançados.
//
// Fila (cooperado_pagamentos): por padrão o pagamento só é liberado com o recebimento do cliente
// confirmado (cobranças dos processos de faturamento do cooperado pagas). Exceções: só perfis
// autorizados, com justificativa e auditoria. Inativos/bloqueados ficam "retidos" (valores preservados).
import { pool } from '../config/database.js';
import {
  r2, erro, texto, numero, emTransacao, garantirEstruturaPagamentos, auditarFin, decodificarArquivo, salvarDocumento,
} from './financeiroComum.js';
import { validarDadosBancarios, fotoDadosBancarios, problemasConta, problemasChavePix, normalizarChavePix } from './dadosBancarios.js';

const COMPETENCIA = /^(\d{4})-(0[1-9]|1[0-2])$/;
const STATUS_ATIVO = 1;
const ROTULO_STATUS_CADASTRO = { 0: 'pré-cadastro', 1: 'ativo', 2: 'inativo', 3: 'reprovado', 4: 'desligado' };
const SITUACOES_ABERTAS = ['em_preparacao', 'retido', 'rejeitado'];
const PENDENCIAS_BANCARIAS = ['sem_dados_bancarios', 'dados_bancarios_invalidos'];
const TIPOS_PIX_COOPERADO = ['cpf', 'email', 'telefone', 'aleatoria']; // ra_dados_bancarios.tipo_pix não tem CNPJ

export const PENDENCIAS = {
  sem_dados_bancarios: { excepcionavel: false, texto: 'Sem dados bancários cadastrados.' },
  dados_bancarios_invalidos: { excepcionavel: false, texto: 'Dados bancários inválidos.' },
  liquido_nao_positivo: { excepcionavel: false, texto: 'Valor líquido zero ou negativo: adie a compensação de algum débito.' },
  bloqueio_pagamento: { excepcionavel: false, texto: 'Cooperado com bloqueio de pagamento ativo.' },
  situacao_cadastral: { excepcionavel: true, texto: 'Cooperado não está ativo no cadastro.' },
  sem_processo_vinculado: { excepcionavel: true, texto: 'Nenhum processo de faturamento aprovado vinculado ao cooperado nesta competência.' },
  recebimento_nao_confirmado: { excepcionavel: true, texto: 'Recebimento do cliente ainda não confirmado.' },
};

function exigirCompetencia(c, rotulo = 'Competência') {
  if (!COMPETENCIA.test(String(c || ''))) throw erro(400, `${rotulo} inválida. Use AAAA-MM.`);
  return c;
}

// ── Regras puras ────────────────────────────────────────────────────────────
export function totalizar(lancamentos) {
  let creditos = 0;
  let debitos = 0;
  for (const l of lancamentos) {
    if (l.tipo === 'credito') creditos += Number(l.valor); else debitos += Number(l.valor);
  }
  return { creditos: r2(creditos), debitos: r2(debitos), liquido: r2(creditos - debitos) };
}

/** Recebimento confirmado = todos os processos vinculados com cobranças e todas pagas. */
export function situacaoRecebimento(processos) {
  if (!processos.length) return { confirmado: false, codigo: 'sem_processo_vinculado' };
  const faltando = processos.filter((p) => {
    const ativas = p.cobrancas.filter((c) => c.status !== 'cancelada');
    return !ativas.length || ativas.some((c) => !['paga', 'divergente'].includes(c.status));
  });
  if (faltando.length) {
    return { confirmado: false, codigo: 'recebimento_nao_confirmado', detalhe: `Aguardando recebimento: ${faltando.map((p) => p.codigo).join(', ')}.` };
  }
  return { confirmado: true };
}

export function calcularPendencias({ cooperado, bloqueiosAtivos, dadosBancarios, liquido, recebimento }) {
  const lista = [];
  const add = (codigo, detalhe) => lista.push({ codigo, excepcionavel: PENDENCIAS[codigo].excepcionavel, descricao: detalhe || PENDENCIAS[codigo].texto });
  if (!dadosBancarios) add('sem_dados_bancarios');
  else {
    const v = validarDadosBancarios(dadosBancarios, null, cooperado.cpf);
    if (!v.valido) add('dados_bancarios_invalidos', `Dados bancários inválidos: ${v.problemas.join(' ')}`);
  }
  if (liquido <= 0) add('liquido_nao_positivo');
  if (bloqueiosAtivos.length) add('bloqueio_pagamento', `Bloqueio de pagamento: ${bloqueiosAtivos.map((b) => b.motivo).join(' | ')}`);
  if (Number(cooperado.status) !== STATUS_ATIVO) {
    add('situacao_cadastral', `Cooperado ${ROTULO_STATUS_CADASTRO[cooperado.status] ?? `status ${cooperado.status}`} no cadastro.`);
  }
  if (!recebimento.confirmado) add(recebimento.codigo, recebimento.detalhe);
  return lista;
}

// ── Prévia e geração de lançamentos a partir dos cadastros ─────────────────
async function lancamentosExistentes(conn, chaves) {
  if (!chaves.length) return new Map();
  const [rows] = await conn.query(
    `SELECT id, chave_origem, valor, situacao FROM cooperado_lancamentos WHERE chave_origem IN (?) AND situacao <> 'cancelado'`, [chaves]
  );
  return new Map(rows.map((r) => [r.chave_origem, r]));
}

/** Monta a prévia: o que existe nos cadastros para a competência e o que já foi lançado. */
export async function previaLancamentos(competencia, conn = pool) {
  await garantirEstruturaPagamentos();
  exigirCompetencia(competencia);
  const itens = [];
  const avisos = [];
  const add = (i) => itens.push(i);

  const [rem] = await conn.query(
    `SELECT r.*, c.nome, c.status FROM esocial_remuneracoes r JOIN ra_candidatos c ON c.id = r.candidato_id WHERE r.competencia = ?`, [competencia]
  );
  if (!rem.length) avisos.push('Nenhuma remuneração importada (Benefícios → eSocial) para a competência.');
  for (const r of rem) {
    const base = { fonte: 'esocial_remuneracao', candidato_id: r.candidato_id, nome: r.nome, competencia, origem_ref: `esocial_remuneracoes#${r.id}` };
    add({ ...base, chave: `esocial:${competencia}:${r.candidato_id}:bruto`, tipo: 'credito', categoria: 'remuneracao', descricao: `Remuneração ${competencia}`, valor: r2(r.valor_bruto) });
    if (Number(r.valor_inss) > 0) add({ ...base, chave: `esocial:${competencia}:${r.candidato_id}:inss`, tipo: 'debito', categoria: 'inss', descricao: `INSS ${competencia}`, valor: r2(r.valor_inss) });
    if (Number(r.valor_irrf) > 0) add({ ...base, chave: `esocial:${competencia}:${r.candidato_id}:irrf`, tipo: 'debito', categoria: 'irrf', descricao: `IRRF ${competencia}`, valor: r2(r.valor_irrf) });
    if (r.valor_liquido !== null && r2(r.valor_liquido) !== r2(r.valor_bruto - r.valor_inss - r.valor_irrf)) {
      avisos.push(`${r.nome}: líquido importado (${r2(r.valor_liquido)}) difere de bruto − INSS − IRRF (${r2(r.valor_bruto - r.valor_inss - r.valor_irrf)}). Outros descontos já podem estar embutidos; confira para não descontar em dobro.`);
    }
  }

  // Descontos do cadastro: só para cooperados com remuneração na competência
  const ids = [...new Set(rem.map((r) => r.candidato_id))];
  const nomes = new Map(rem.map((r) => [r.candidato_id, r.nome]));
  if (ids.length) {
    const [descs] = await conn.query(`SELECT * FROM ra_descontos WHERE candidato_id IN (?)`, [ids]);
    for (const d of descs) {
      const base = { fonte: 'cadastro_descontos', candidato_id: d.candidato_id, nome: nomes.get(d.candidato_id), competencia, origem_ref: `ra_descontos#${d.id}` };
      for (const [campo, rotulo] of [['inss_percentual', 'INSS'], ['seguro_vida_percentual', 'Seguro de vida'], ['rateio_percentual', 'Rateio']]) {
        if (Number(d[campo]) > 0) {
          add({ ...base, chave: `cadastro:${competencia}:${d.candidato_id}:${campo}`, tipo: 'debito', categoria: 'desconto_fixo', descricao: `${rotulo} ${Number(d[campo])}%`, valor: null,
            situacao: 'regra_pendente', observacao: 'Percentual sem base de cálculo definida pela ATESA (e o INSS já pode vir da remuneração importada).' });
        }
      }
      if (Number(d.quota_parte_valor) > 0) {
        add({ ...base, chave: `cadastro:quota:${d.candidato_id}`, tipo: 'debito', categoria: 'quota_parte', descricao: 'Quota-parte',
          valor: r2(d.quota_parte_valor), situacao: 'regra_pendente',
          observacao: Number(d.quota_parcelada) ? `Parcelada (${d.quota_cotas_pagas}/${d.quota_total_cotas ?? '?'}): não está definido se o valor cadastrado é total ou por parcela.` : 'Não está definido quando a quota-parte é descontada.' });
      }
      if (Number(d.outras_valor) > 0) {
        add({ ...base, chave: `cadastro:${competencia}:${d.candidato_id}:outras`, tipo: 'debito', categoria: 'desconto_fixo', descricao: d.outras_descricao || 'Outros descontos',
          valor: r2(d.outras_valor), situacao: 'requer_confirmacao', observacao: 'Desconto fixo do cadastro: confirme se é mensal.' });
      }
      let outros = [];
      try { outros = JSON.parse(d.outros_descontos || '[]'); } catch { avisos.push(`${nomes.get(d.candidato_id)}: lista de outros descontos ilegível no cadastro.`); }
      outros.forEach((o, i) => {
        if (Number(o?.valor) > 0) {
          add({ ...base, chave: `cadastro:${competencia}:${d.candidato_id}:outros:${i}:${String(o.descricao || '').slice(0, 30)}`, tipo: 'debito', categoria: 'desconto_fixo',
            descricao: o.descricao || 'Desconto', valor: r2(o.valor), situacao: 'requer_confirmacao', observacao: 'Desconto fixo do cadastro: confirme se é mensal.' });
        }
      });
    }

    const [cotas] = await conn.query(`SELECT * FROM ra_cotas_mensais WHERE candidato_id IN (?) AND ativa = 1`, [ids]);
    if (cotas.length) {
      const [lancadas] = await conn.query(
        `SELECT origem_ref, COUNT(*) AS n FROM cooperado_lancamentos WHERE origem = 'cota_mensal' AND situacao <> 'cancelado' AND origem_ref IN (?) GROUP BY origem_ref`,
        [cotas.map((c) => `ra_cotas_mensais#${c.id}`)]
      );
      const porCota = new Map(lancadas.map((l) => [l.origem_ref, Number(l.n)]));
      for (const c of cotas) {
        const ref = `ra_cotas_mensais#${c.id}`;
        const base = { fonte: 'cota_mensal', candidato_id: c.candidato_id, nome: nomes.get(c.candidato_id), competencia, origem_ref: ref, tipo: 'debito', categoria: 'cota', valor: r2(c.valor) };
        if (c.total_parcelas) {
          const feitas = Number(c.parcelas_pagas) + (porCota.get(ref) || 0);
          if (feitas >= Number(c.total_parcelas)) continue;
          add({ ...base, chave: `cota:${c.id}:${competencia}`, descricao: `${c.descricao} (parcela ${feitas + 1}/${c.total_parcelas})`, situacao: 'novo' });
        } else if (Number(c.recorrente)) {
          add({ ...base, chave: `cota:${c.id}:${competencia}`, descricao: c.descricao, situacao: 'novo' });
        } else {
          add({ ...base, chave: `cota:${c.id}:unica`, descricao: c.descricao, situacao: 'requer_confirmacao', observacao: 'Cota não recorrente e sem parcelas: confirme se deve ser descontada nesta competência.' });
        }
      }
    }
  }

  const existentes = await lancamentosExistentes(conn, itens.map((i) => i.chave));
  for (const i of itens) {
    const ex = existentes.get(i.chave);
    if (ex) {
      i.lancamento_id = ex.id;
      i.situacao = i.valor !== null && r2(ex.valor) !== i.valor ? 'valor_diferente' : 'ja_lancado';
      if (i.situacao === 'valor_diferente') i.observacao = `Já lançado com R$ ${r2(ex.valor).toFixed(2)}; o cadastro hoje indica R$ ${i.valor.toFixed(2)}. Cancele o lançamento (se ainda pendente) para relançar.`;
    } else if (!i.situacao) i.situacao = 'novo';
  }
  return { competencia, itens, avisos };
}

async function inserirLancamento(conn, l, usuario) {
  try {
    const [res] = await conn.query(
      `INSERT INTO cooperado_lancamentos (candidato_id, tipo, categoria, origem, origem_ref, chave_origem, chave_ativa, competencia, compensar_a_partir, descricao, valor,
                                          situacao, pagamento_id, adiantamento_pagamento_id, estorno_de_id, motivo, criado_por_id, criado_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [l.candidato_id, l.tipo, l.categoria, l.origem, l.origem_ref ?? null, l.chave ?? null, l.chave ?? null, l.competencia, l.compensar_a_partir ?? null,
        String(l.descricao).slice(0, 255), r2(l.valor), l.situacao ?? 'pendente', l.pagamento_id ?? null, l.adiantamento_pagamento_id ?? null,
        l.estorno_de_id ?? null, l.motivo ?? null, usuario.id ?? null, usuario.nome ?? null]
    );
    await auditarFin(conn, usuario, {
      entidade: 'lancamento', entidadeId: res.insertId, acao: 'criacao',
      novo: { candidato_id: l.candidato_id, tipo: l.tipo, categoria: l.categoria, origem: l.origem, competencia: l.competencia, valor: r2(l.valor), chave: l.chave ?? null },
      motivo: l.motivo ?? null,
    });
    return res.insertId;
  } catch (err) {
    if (err?.code === 'ER_DUP_ENTRY') throw erro(409, `Lançamento já existente para "${l.descricao}" (${l.competencia}).`);
    throw err;
  }
}

export async function confirmarLancamentos(competencia, { chaves } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const selecionadas = new Set((Array.isArray(chaves) ? chaves : []).map(String));
  if (!selecionadas.size) throw erro(400, 'Selecione os lançamentos a gerar.');
  return emTransacao(async (conn) => {
    const { itens } = await previaLancamentos(competencia, conn);
    let criados = 0;
    const recusados = [];
    for (const i of itens) {
      if (!selecionadas.has(i.chave)) continue;
      selecionadas.delete(i.chave);
      if (!['novo', 'requer_confirmacao'].includes(i.situacao)) { recusados.push({ chave: i.chave, motivo: i.situacao }); continue; }
      const origem = i.fonte === 'esocial_remuneracao' ? 'esocial_remuneracao' : i.fonte === 'cota_mensal' ? 'cota_mensal' : 'cadastro_descontos';
      await inserirLancamento(conn, { ...i, origem, situacao: 'pendente', motivo: i.situacao === 'requer_confirmacao' ? 'Desconto do cadastro confirmado pelo usuário na geração.' : null }, usuario);
      criados++;
    }
    for (const c of selecionadas) recusados.push({ chave: c, motivo: 'não encontrado na prévia' });
    return { ok: true, criados, recusados };
  });
}

// ── Lançamentos manuais, cancelamento, estorno, adiamento ───────────────────
export const CATEGORIAS_MANUAIS = ['ajuste', 'desconto_fixo', 'outro'];

export async function criarLancamentoManual(dados, usuario) {
  await garantirEstruturaPagamentos();
  const candidatoId = Number(dados.candidatoId);
  if (!candidatoId) throw erro(400, 'Selecione o cooperado.');
  if (!['credito', 'debito'].includes(dados.tipo)) throw erro(400, 'Informe se é crédito ou débito.');
  if (!CATEGORIAS_MANUAIS.includes(dados.categoria)) throw erro(400, 'Categoria inválida para lançamento manual.');
  const competencia = exigirCompetencia(dados.competencia);
  const compensar = dados.compensarAPartir ? exigirCompetencia(dados.compensarAPartir, 'Competência de compensação') : null;
  if (compensar && compensar < competencia) throw erro(400, 'A compensação não pode ser anterior à competência.');
  const valor = numero(dados.valor);
  if (valor === null || Number.isNaN(valor) || valor <= 0) throw erro(400, 'Informe um valor maior que zero.');
  const descricao = texto(dados.descricao, 255);
  if (!descricao) throw erro(400, 'Informe a descrição.');
  const motivo = texto(dados.motivo, 2000);
  if (!motivo) throw erro(400, 'Informe o motivo / origem do lançamento.');
  return emTransacao(async (conn) => {
    const [[c]] = await conn.query(`SELECT id FROM ra_candidatos WHERE id = ?`, [candidatoId]);
    if (!c) throw erro(404, 'Cooperado não encontrado.');
    const [dups] = await conn.query(
      `SELECT id FROM cooperado_lancamentos WHERE candidato_id = ? AND competencia = ? AND tipo = ? AND categoria = ? AND valor = ? AND situacao <> 'cancelado'`,
      [candidatoId, competencia, dados.tipo, dados.categoria, r2(valor)]
    );
    if (dups.length && !dados.confirmarDuplicidade) {
      throw erro(409, `Já existe lançamento igual (mesma competência, tipo, categoria e valor): #${dups.map((d) => d.id).join(', #')}. Confirme se é realmente outro lançamento.`, { codigo: 'POSSIVEL_DUPLICIDADE' });
    }
    const id = await inserirLancamento(conn, {
      candidato_id: candidatoId, tipo: dados.tipo, categoria: dados.categoria, origem: 'manual', competencia, compensar_a_partir: compensar,
      descricao, valor, motivo,
    }, usuario);
    return { ok: true, id };
  });
}

export async function listarLancamentos({ candidatoId, competencia, situacao, categoria } = {}) {
  await garantirEstruturaPagamentos();
  let sql = `SELECT l.*, c.nome AS cooperado_nome, c.matricula, p.codigo AS pagamento_codigo
               FROM cooperado_lancamentos l
               JOIN ra_candidatos c ON c.id = l.candidato_id
               LEFT JOIN cooperado_pagamentos p ON p.id = l.pagamento_id
              WHERE 1=1`;
  const params = [];
  if (candidatoId) { sql += ' AND l.candidato_id = ?'; params.push(Number(candidatoId)); }
  if (competencia) { sql += ' AND l.competencia = ?'; params.push(competencia); }
  if (situacao) { sql += ' AND l.situacao IN (?)'; params.push(String(situacao).split(',')); }
  if (categoria) { sql += ' AND l.categoria = ?'; params.push(categoria); }
  sql += ' ORDER BY l.competencia DESC, c.nome, l.tipo, l.id LIMIT 2000';
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function carregarLancamento(conn, id) {
  const [[l]] = await conn.query(`SELECT * FROM cooperado_lancamentos WHERE id = ? FOR UPDATE`, [Number(id)]);
  if (!l) throw erro(404, 'Lançamento não encontrado.');
  return l;
}

export async function cancelarLancamento(id, { motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do cancelamento.');
  return emTransacao(async (conn) => {
    const l = await carregarLancamento(conn, id);
    if (l.situacao !== 'pendente') throw erro(409, `Só lançamentos pendentes podem ser cancelados (este está "${l.situacao}"). Liquidados devem ser estornados.`);
    if (l.categoria === 'adiantamento' || l.categoria === 'compensacao_adiantamento') throw erro(409, 'Lançamentos de adiantamento são cancelados pelo próprio pagamento do adiantamento.');
    // chave_ativa = NULL: a mesma origem pode ser relançada (ex.: valor corrigido no cadastro)
    await conn.query(`UPDATE cooperado_lancamentos SET situacao = 'cancelado', chave_ativa = NULL, cancelado_por_nome = ?, motivo_cancelamento = ? WHERE id = ?`, [usuario.nome ?? null, mot, l.id]);
    await auditarFin(conn, usuario, { entidade: 'lancamento', entidadeId: l.id, acao: 'cancelamento', anterior: 'pendente', novo: 'cancelado', motivo: mot });
    return { ok: true };
  });
}

/** Estorno de lançamento já liquidado: gera o lançamento oposto, pendente para o próximo pagamento. */
export async function estornarLancamento(id, { motivo, competencia } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do estorno.');
  return emTransacao(async (conn) => {
    const l = await carregarLancamento(conn, id);
    if (l.situacao !== 'liquidado') throw erro(409, 'Só lançamentos liquidados são estornados; pendentes podem ser cancelados.');
    const [[ja]] = await conn.query(`SELECT id FROM cooperado_lancamentos WHERE estorno_de_id = ? AND situacao <> 'cancelado'`, [l.id]);
    if (ja) throw erro(409, `Este lançamento já foi estornado (#${ja.id}).`);
    const novoId = await inserirLancamento(conn, {
      candidato_id: l.candidato_id, tipo: l.tipo === 'credito' ? 'debito' : 'credito', categoria: 'ajuste', origem: 'estorno', origem_ref: `cooperado_lancamentos#${l.id}`,
      chave: `estorno:${l.id}`, competencia: competencia ? exigirCompetencia(competencia) : l.competencia,
      descricao: `Estorno: ${l.descricao}`, valor: l.valor, estorno_de_id: l.id, motivo: mot,
    }, usuario);
    return { ok: true, id: novoId };
  });
}

/** Adia a compensação de um débito (ex.: líquido negativo). Se estiver reservado, sai do pagamento. */
export async function adiarCompensacao(id, { compensarAPartir, motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const nova = exigirCompetencia(compensarAPartir, 'Competência de compensação');
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo.');
  return emTransacao(async (conn) => {
    const l = await carregarLancamento(conn, id);
    if (l.tipo !== 'debito') throw erro(409, 'Só débitos podem ter a compensação adiada.');
    let pagamentoId = null;
    if (l.situacao === 'reservado') {
      const [[p]] = await conn.query(`SELECT id, situacao FROM cooperado_pagamentos WHERE id = ? FOR UPDATE`, [l.pagamento_id]);
      if (!['em_preparacao', 'retido', 'rejeitado'].includes(p.situacao)) throw erro(409, `O pagamento está "${p.situacao}"; desfaça a liberação antes.`);
      pagamentoId = p.id;
    } else if (!['pendente', 'aguardando'].includes(l.situacao)) throw erro(409, `Lançamento "${l.situacao}".`);
    if (nova < l.competencia) throw erro(400, 'A compensação não pode ser anterior à competência do lançamento.');
    await conn.query(
      `UPDATE cooperado_lancamentos SET compensar_a_partir = ?, situacao = IF(situacao = 'reservado', 'pendente', situacao), pagamento_id = IF(situacao = 'reservado', NULL, pagamento_id) WHERE id = ?`,
      [nova, l.id]
    );
    await auditarFin(conn, usuario, { entidade: 'lancamento', entidadeId: l.id, acao: 'adiamento_compensacao', campo: 'compensar_a_partir', anterior: l.compensar_a_partir ?? l.competencia, novo: nova, motivo: mot });
    if (pagamentoId) await recalcularPagamento(conn, pagamentoId, usuario);
    return { ok: true };
  });
}

// ── Bloqueios de pagamento ──────────────────────────────────────────────────
export async function listarBloqueios({ candidatoId, ativos } = {}) {
  await garantirEstruturaPagamentos();
  let sql = `SELECT b.*, c.nome AS cooperado_nome FROM cooperado_bloqueios_pagamento b JOIN ra_candidatos c ON c.id = b.candidato_id WHERE 1=1`;
  const params = [];
  if (candidatoId) { sql += ' AND b.candidato_id = ?'; params.push(Number(candidatoId)); }
  if (ativos === 'true' || ativos === true) sql += ' AND b.ativo = 1';
  sql += ' ORDER BY b.ativo DESC, b.criado_em DESC';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function bloquearPagamentos({ candidatoId, motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do bloqueio.');
  return emTransacao(async (conn) => {
    const [[c]] = await conn.query(`SELECT id FROM ra_candidatos WHERE id = ?`, [Number(candidatoId)]);
    if (!c) throw erro(404, 'Cooperado não encontrado.');
    const [res] = await conn.query(`INSERT INTO cooperado_bloqueios_pagamento (candidato_id, motivo, criado_por_id, criado_por_nome) VALUES (?, ?, ?, ?)`, [c.id, mot, usuario.id ?? null, usuario.nome ?? null]);
    await auditarFin(conn, usuario, { entidade: 'bloqueio', entidadeId: res.insertId, acao: 'bloqueio', novo: { candidato_id: c.id }, motivo: mot });
    const [pags] = await conn.query(`SELECT id FROM cooperado_pagamentos WHERE candidato_id = ? AND situacao IN ('em_preparacao','retido','rejeitado')`, [c.id]);
    for (const p of pags) await recalcularPagamento(conn, p.id, usuario);
    return { ok: true, id: res.insertId };
  });
}

export async function encerrarBloqueio(id, { motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do desbloqueio.');
  return emTransacao(async (conn) => {
    const [[b]] = await conn.query(`SELECT * FROM cooperado_bloqueios_pagamento WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!b) throw erro(404, 'Bloqueio não encontrado.');
    if (!Number(b.ativo)) throw erro(409, 'Bloqueio já encerrado.');
    await conn.query(`UPDATE cooperado_bloqueios_pagamento SET ativo = 0, encerrado_por_nome = ?, encerrado_em = NOW(), motivo_encerramento = ? WHERE id = ?`, [usuario.nome ?? null, mot, b.id]);
    await auditarFin(conn, usuario, { entidade: 'bloqueio', entidadeId: b.id, acao: 'desbloqueio', motivo: mot });
    const [pags] = await conn.query(`SELECT id FROM cooperado_pagamentos WHERE candidato_id = ? AND situacao IN ('em_preparacao','retido','rejeitado')`, [b.candidato_id]);
    for (const p of pags) await recalcularPagamento(conn, p.id, usuario);
    return { ok: true };
  });
}

// ── Fila de pagamentos ──────────────────────────────────────────────────────
export function codigoPagamento(competencia, id) {
  return `PAG-${competencia.replace('-', '')}-${String(id).padStart(6, '0')}`;
}

async function processosDoPagamento(conn, pagamento, lancamentos) {
  if (pagamento.tipo !== 'repasse') return [];
  const comps = [...new Set(lancamentos.filter((l) => l.tipo === 'credito' && l.origem === 'esocial_remuneracao').map((l) => l.competencia))];
  if (!comps.length) return [];
  const [procs] = await conn.query(
    `SELECT DISTINCT p.id, p.codigo, p.competencia FROM faturamento_processos p
       JOIN faturamento_itens i ON i.processo_id = p.id
      WHERE p.status = 'aprovado' AND i.candidato_id = ? AND p.competencia IN (?)`,
    [pagamento.candidato_id, comps]
  );
  if (!procs.length) return [];
  const [cobs] = await conn.query(`SELECT processo_id, codigo, status FROM faturamento_cobrancas WHERE processo_id IN (?)`, [procs.map((p) => p.id)]);
  return procs.map((p) => ({ ...p, cobrancas: cobs.filter((c) => c.processo_id === p.id) }));
}

/** Recalcula totais, pendências e situação (em preparação ↔ retido) de um pagamento ainda não liberado. */
export async function recalcularPagamento(conn, pagamentoId, usuario) {
  const [[p]] = await conn.query(`SELECT * FROM cooperado_pagamentos WHERE id = ? FOR UPDATE`, [pagamentoId]);
  if (!p || !['em_preparacao', 'retido', 'rejeitado'].includes(p.situacao)) return p;
  const [lancs] = await conn.query(`SELECT * FROM cooperado_lancamentos WHERE pagamento_id = ? AND situacao = 'reservado'`, [p.id]);
  const [[coop]] = await conn.query(`SELECT id, nome, cpf, status FROM ra_candidatos WHERE id = ?`, [p.candidato_id]);
  const [bloqueios] = await conn.query(`SELECT motivo FROM cooperado_bloqueios_pagamento WHERE candidato_id = ? AND ativo = 1`, [p.candidato_id]);
  const [[banco]] = await conn.query(`SELECT * FROM ra_dados_bancarios WHERE candidato_id = ?`, [p.candidato_id]);
  const tot = totalizar(lancs);
  const processos = await processosDoPagamento(conn, p, lancs);
  const recebimento = situacaoRecebimento(processos);
  const pendencias = calcularPendencias({ cooperado: coop, bloqueiosAtivos: bloqueios, dadosBancarios: banco, liquido: tot.liquido, recebimento });
  // Inativo, desligado ou bloqueado: valores preservados e pagamento retido
  const reter = pendencias.some((x) => ['situacao_cadastral', 'bloqueio_pagamento'].includes(x.codigo));
  // Dados bancários em ordem: a solicitação ao setor responsável se encerra sozinha
  if (!pendencias.some((x) => PENDENCIAS_BANCARIAS.includes(x.codigo))) {
    await conn.query(`UPDATE cooperado_solicitacoes_dados SET situacao = 'atendida', chave_ativa = NULL, atendida_em = NOW() WHERE chave_ativa = ?`, [p.candidato_id]);
  }
  const situacao = p.situacao === 'rejeitado' ? 'rejeitado' : reter ? 'retido' : 'em_preparacao';
  await conn.query(
    `UPDATE cooperado_pagamentos SET valor_creditos = ?, valor_debitos = ?, valor_liquido = ?, pendencias = ?, processos_vinculados = ?, recebimento_confirmado = ?, situacao = ? WHERE id = ?`,
    [tot.creditos, tot.debitos, tot.liquido, JSON.stringify(pendencias), JSON.stringify(processos.map((x) => ({ id: x.id, codigo: x.codigo, cobrancas: x.cobrancas.map((c) => `${c.codigo}:${c.status}`) }))),
      recebimento.confirmado ? 1 : 0, situacao, p.id]
  );
  if (situacao !== p.situacao) {
    await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: p.id, acao: 'situacao', anterior: p.situacao, novo: situacao, motivo: pendencias.map((x) => x.descricao).join(' | ') || null });
  }
  return { ...p, situacao, pendencias, valor_creditos: tot.creditos, valor_debitos: tot.debitos, valor_liquido: tot.liquido };
}

async function reservarLancamentos(conn, pagamento, competencia) {
  const [res] = await conn.query(
    `UPDATE cooperado_lancamentos SET situacao = 'reservado', pagamento_id = ?
      WHERE candidato_id = ? AND situacao = 'pendente' AND categoria <> 'adiantamento'
        AND ((tipo = 'credito' AND competencia <= ?) OR (tipo = 'debito' AND COALESCE(compensar_a_partir, competencia) <= ?))`,
    [pagamento.id, pagamento.candidato_id, competencia, competencia]
  );
  return res.affectedRows;
}

export async function montarFila(competencia, usuario) {
  await garantirEstruturaPagamentos();
  exigirCompetencia(competencia);
  return emTransacao(async (conn) => {
    // Cooperados com crédito pendente, ou com pagamento ainda aberto na competência (novos débitos entram nele)
    const [cands] = await conn.query(
      `SELECT DISTINCT candidato_id FROM cooperado_lancamentos
        WHERE situacao = 'pendente' AND tipo = 'credito' AND categoria <> 'adiantamento' AND competencia <= ?
       UNION
       SELECT candidato_id FROM cooperado_pagamentos
        WHERE competencia = ? AND tipo = 'repasse' AND situacao IN ('em_preparacao','retido','rejeitado')`,
      [competencia, competencia]
    );
    let criados = 0;
    let atualizados = 0;
    const avisos = [];
    for (const { candidato_id: cid } of cands) {
      const chave = `${cid}|${competencia}|repasse`;
      let [[p]] = await conn.query(`SELECT * FROM cooperado_pagamentos WHERE chave_ativa = ? FOR UPDATE`, [chave]);
      if (p && ['liberado', 'em_lote'].includes(p.situacao)) {
        avisos.push(`Pagamento ${p.codigo} já ${p.situacao === 'liberado' ? 'liberado' : 'em lote'}: novos lançamentos aguardam o próximo pagamento.`);
        continue;
      }
      if (!p) {
        const [res] = await conn.query(
          `INSERT INTO cooperado_pagamentos (candidato_id, competencia, tipo, chave_ativa, criado_por_id, criado_por_nome) VALUES (?, ?, 'repasse', ?, ?, ?)`,
          [cid, competencia, chave, usuario.id ?? null, usuario.nome ?? null]
        );
        const codigo = codigoPagamento(competencia, res.insertId);
        await conn.query(`UPDATE cooperado_pagamentos SET codigo = ? WHERE id = ?`, [codigo, res.insertId]);
        p = { id: res.insertId, candidato_id: cid, codigo, tipo: 'repasse', situacao: 'em_preparacao' };
        await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: p.id, acao: 'criacao', novo: { codigo, candidato_id: cid, competencia } });
        criados++;
      } else atualizados++;
      const n = await reservarLancamentos(conn, p, competencia);
      if (n) await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: p.id, acao: 'lancamentos_incluidos', novo: { quantidade: n } });
      await recalcularPagamento(conn, p.id, usuario);
    }
    return { ok: true, criados, atualizados, avisos };
  });
}

/** Atualiza pendências (ex.: o recebimento do cliente foi confirmado depois da montagem). */
export async function atualizarPendenciasFila(competencia, usuario) {
  await garantirEstruturaPagamentos();
  return emTransacao(async (conn) => {
    const [pags] = await conn.query(
      `SELECT id FROM cooperado_pagamentos WHERE situacao IN ('em_preparacao','retido','rejeitado')${competencia ? ' AND competencia = ?' : ''}`,
      competencia ? [exigirCompetencia(competencia)] : []
    );
    for (const p of pags) await recalcularPagamento(conn, p.id, usuario);
    return { ok: true, atualizados: pags.length };
  });
}

export async function listarFila({ id, competencia, situacao, candidatoId, tipo } = {}) {
  await garantirEstruturaPagamentos();
  let sql = `SELECT p.*, c.nome AS cooperado_nome, c.matricula, c.status AS status_cadastro, c.cpf,
                    b.banco, b.codigo_banco, b.agencia, b.conta, b.digito, b.tipo_conta, b.chave_pix, b.tipo_pix,
                    s.criado_em AS solicitacao_em, s.criado_por_nome AS solicitacao_por_nome
               FROM cooperado_pagamentos p
               JOIN ra_candidatos c ON c.id = p.candidato_id
               LEFT JOIN ra_dados_bancarios b ON b.candidato_id = p.candidato_id
               LEFT JOIN cooperado_solicitacoes_dados s ON s.chave_ativa = p.candidato_id
              WHERE 1=1`;
  const params = [];
  if (id) { sql += ' AND p.id = ?'; params.push(Number(id)); }
  if (competencia) { sql += ' AND p.competencia = ?'; params.push(competencia); }
  if (situacao) { sql += ' AND p.situacao IN (?)'; params.push(String(situacao).split(',')); }
  if (candidatoId) { sql += ' AND p.candidato_id = ?'; params.push(Number(candidatoId)); }
  if (tipo) { sql += ' AND p.tipo = ?'; params.push(tipo); }
  sql += ' ORDER BY p.competencia DESC, c.nome LIMIT 2000';
  const [rows] = await pool.query(sql, params);
  return rows.map((r) => ({
    ...r,
    pendencias: r.pendencias ? JSON.parse(r.pendencias) : [],
    processos_vinculados: r.processos_vinculados ? JSON.parse(r.processos_vinculados) : [],
    dados_bancarios: r.dados_bancarios ? JSON.parse(r.dados_bancarios) : null,
  }));
}

export async function obterPagamento(id) {
  await garantirEstruturaPagamentos();
  const [p] = await listarFila({ id });
  if (!p) throw erro(404, 'Pagamento não encontrado.');
  const [lancamentos] = await pool.query(`SELECT * FROM cooperado_lancamentos WHERE pagamento_id = ? OR adiantamento_pagamento_id = ? ORDER BY tipo, competencia, id`, [p.id, p.id]);
  const [lotes] = await pool.query(
    `SELECT i.*, l.codigo AS lote_codigo, l.situacao AS lote_situacao FROM pagamento_lote_itens i JOIN pagamento_lotes l ON l.id = i.lote_id WHERE i.pagamento_id = ? ORDER BY i.id`,
    [p.id]
  );
  const [historico] = await pool.query(`SELECT * FROM financeiro_auditoria WHERE entidade = 'pagamento' AND entidade_id = ? ORDER BY criado_em DESC, id DESC`, [p.id]);
  return { pagamento: p, lancamentos, lotes, historico };
}

async function carregarPagamento(conn, id) {
  const [[p]] = await conn.query(`SELECT * FROM cooperado_pagamentos WHERE id = ? FOR UPDATE`, [Number(id)]);
  if (!p) throw erro(404, 'Pagamento não encontrado.');
  return p;
}

/**
 * Libera o pagamento para lote/remessa. Pendências não excepcionáveis sempre bloqueiam; as
 * excepcionáveis (recebimento não confirmado, sem processo, situação cadastral) só com exceção de
 * usuário autorizado (`podeExcecao`) e justificativa.
 */
export async function liberarPagamento(id, { excecao, motivo } = {}, usuario, { podeExcecao = false } = {}) {
  await garantirEstruturaPagamentos();
  // Em transação própria: as pendências atualizadas ficam gravadas mesmo se a liberação for recusada
  await emTransacao((conn) => recalcularPagamento(conn, Number(id), usuario));
  return emTransacao(async (conn) => {
    let p = await carregarPagamento(conn, id);
    if (!['em_preparacao', 'retido', 'rejeitado'].includes(p.situacao)) throw erro(409, `O pagamento está "${p.situacao}".`);
    const anterior = p.situacao;
    p = await recalcularPagamento(conn, p.id, usuario);
    const bloqueantes = p.pendencias.filter((x) => !x.excepcionavel);
    if (bloqueantes.length) {
      throw erro(409, `Não é possível liberar: ${bloqueantes.map((x) => x.descricao).join(' ')}`, { codigo: 'PENDENCIAS_BLOQUEANTES', detalhes: bloqueantes.map((x) => x.descricao), pendencias: p.pendencias });
    }
    const excepcionaveis = p.pendencias.filter((x) => x.excepcionavel);
    let mot = null;
    if (excepcionaveis.length) {
      if (!excecao) {
        throw erro(409, `Liberação bloqueada: ${excepcionaveis.map((x) => x.descricao).join(' ')} Somente perfis autorizados podem liberar por exceção, com justificativa.`,
          { codigo: 'EXIGE_EXCECAO', detalhes: excepcionaveis.map((x) => x.descricao), pendencias: p.pendencias });
      }
      if (!podeExcecao) throw erro(403, 'Seu usuário não está autorizado a liberar pagamentos por exceção.');
      mot = texto(motivo, 2000);
      if (!mot || mot.length < 10) throw erro(400, 'Informe a justificativa da exceção (mínimo de 10 caracteres).');
    }
    const [[coop]] = await conn.query(`SELECT nome, cpf FROM ra_candidatos WHERE id = ?`, [p.candidato_id]);
    const [[banco]] = await conn.query(`SELECT * FROM ra_dados_bancarios WHERE candidato_id = ?`, [p.candidato_id]);
    const foto = fotoDadosBancarios(banco, { nome: coop.nome, documento: coop.cpf });
    await conn.query(
      `UPDATE cooperado_pagamentos SET situacao = 'liberado', dados_bancarios = ?, excecao = ?, excecao_motivo = ?, excecao_por_id = ?, excecao_por_nome = ?,
              liberado_por_id = ?, liberado_por_nome = ?, liberado_em = NOW(), motivo_situacao = NULL WHERE id = ?`,
      [JSON.stringify(foto), mot ? 1 : 0, mot, mot ? usuario.id ?? null : null, mot ? usuario.nome ?? null : null, usuario.id ?? null, usuario.nome ?? null, p.id]
    );
    await auditarFin(conn, usuario, {
      entidade: 'pagamento', entidadeId: p.id, acao: mot ? 'liberacao_excecao' : 'liberacao', anterior,
      novo: { situacao: 'liberado', liquido: r2(p.valor_liquido ?? 0), excecoes: excepcionaveis.map((x) => x.codigo), dados_bancarios: foto }, motivo: mot,
    });
    return { ok: true, excecao: !!mot };
  });
}

export async function desfazerLiberacao(id, { motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo.');
  return emTransacao(async (conn) => {
    const p = await carregarPagamento(conn, id);
    if (p.situacao !== 'liberado') throw erro(409, `O pagamento está "${p.situacao}".`);
    await conn.query(`UPDATE cooperado_pagamentos SET situacao = 'em_preparacao', dados_bancarios = NULL, excecao = 0, excecao_motivo = NULL, excecao_por_id = NULL, excecao_por_nome = NULL WHERE id = ?`, [p.id]);
    await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: p.id, acao: 'liberacao_desfeita', anterior: 'liberado', novo: 'em_preparacao', motivo: mot });
    await recalcularPagamento(conn, p.id, usuario);
    return { ok: true };
  });
}

export async function cancelarPagamento(id, { motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do cancelamento.');
  return emTransacao(async (conn) => {
    const p = await carregarPagamento(conn, id);
    if (!['em_preparacao', 'liberado', 'retido', 'rejeitado'].includes(p.situacao)) throw erro(409, `Não é possível cancelar um pagamento "${p.situacao}".`);
    if (p.tipo === 'adiantamento') {
      // Adiantamento cancelado: o crédito e o débito de compensação deixam de existir
      const [afetados] = await conn.query(
        `SELECT id, situacao FROM cooperado_lancamentos WHERE (pagamento_id = ? AND categoria = 'adiantamento') OR (adiantamento_pagamento_id = ? AND situacao = 'aguardando')`,
        [p.id, p.id]
      );
      for (const l of afetados) {
        await auditarFin(conn, usuario, { entidade: 'lancamento', entidadeId: l.id, acao: 'cancelamento', anterior: l.situacao, novo: 'cancelado', motivo: `Cancelamento do adiantamento ${p.codigo}: ${mot}` });
      }
      await conn.query(
        `UPDATE cooperado_lancamentos SET situacao = 'cancelado', chave_ativa = NULL, cancelado_por_nome = ?, motivo_cancelamento = ?
          WHERE (pagamento_id = ? AND categoria = 'adiantamento') OR (adiantamento_pagamento_id = ? AND situacao = 'aguardando')`,
        [usuario.nome ?? null, mot, p.id, p.id]
      );
    } else {
      // Repasse cancelado: os lançamentos voltam a ficar pendentes (nada é apagado)
      await conn.query(`UPDATE cooperado_lancamentos SET situacao = 'pendente', pagamento_id = NULL WHERE pagamento_id = ? AND situacao = 'reservado'`, [p.id]);
    }
    await conn.query(`UPDATE cooperado_pagamentos SET situacao = 'cancelado', chave_ativa = NULL, motivo_situacao = ? WHERE id = ?`, [mot, p.id]);
    await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: p.id, acao: 'cancelamento', anterior: p.situacao, novo: 'cancelado', motivo: mot });
    return { ok: true };
  });
}

/** Confirma o pagamento (comprovante/retorno do banco). Só aqui os lançamentos são liquidados. */
export async function confirmarPagamentoConn(conn, id, { dataPagamento, motivo, comprovante } = {}, usuario) {
  const p = await carregarPagamento(conn, id);
  if (!['liberado', 'em_lote'].includes(p.situacao)) throw erro(409, `Só pagamentos liberados ou em lote podem ser confirmados (este está "${p.situacao}").`);
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(dataPagamento || '')) ? dataPagamento : null;
  if (!data) throw erro(400, 'Informe a data do pagamento.');
  await conn.query(
    `UPDATE cooperado_pagamentos SET situacao = 'pago', chave_ativa = NULL, data_pagamento = ?, confirmado_por_nome = ?, confirmado_em = NOW(), motivo_situacao = ? WHERE id = ?`,
    [data, usuario.nome ?? null, texto(motivo, 2000), p.id]
  );
  await conn.query(`UPDATE cooperado_lancamentos SET situacao = 'liquidado' WHERE pagamento_id = ? AND situacao = 'reservado'`, [p.id]);
  if (p.tipo === 'adiantamento') {
    // Adiantamento pago: o débito passa a ser compensado nos próximos repasses
    await conn.query(`UPDATE cooperado_lancamentos SET situacao = 'pendente' WHERE adiantamento_pagamento_id = ? AND situacao = 'aguardando'`, [p.id]);
  }
  if (comprovante) await salvarDocumento(conn, { entidade: 'pagamento', entidadeId: p.id, tipo: 'comprovante', arquivo: comprovante }, usuario);
  await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: p.id, acao: 'confirmacao_pagamento', anterior: p.situacao, novo: { situacao: 'pago', data_pagamento: data, comprovante: comprovante?.nome ?? null }, motivo: texto(motivo, 2000) });
  return p;
}

export async function confirmarPagamento(id, dados = {}, usuario) {
  await garantirEstruturaPagamentos();
  const comprovante = dados.comprovante?.conteudoBase64 ? decodificarArquivo(dados.comprovante, ['pdf', 'png', 'jpg', 'jpeg']) : null;
  return emTransacao(async (conn) => {
    const [[item]] = await conn.query(`SELECT id FROM pagamento_lote_itens WHERE pagamento_id = ? AND situacao = 'incluido'`, [Number(id)]);
    if (item) throw erro(409, 'Este pagamento está em um lote: registre a confirmação pelo lote.');
    await confirmarPagamentoConn(conn, id, { ...dados, comprovante }, usuario);
    return { ok: true };
  });
}

/** Confirma vários pagamentos pagos fora de lote de uma vez (mesma data); ou todos, ou nenhum. */
export async function confirmarPagamentos({ ids, dataPagamento, motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const lista = [...new Set((Array.isArray(ids) ? ids : []).map(Number).filter(Boolean))];
  if (!lista.length) throw erro(400, 'Selecione os pagamentos.');
  return emTransacao(async (conn) => {
    const [itens] = await conn.query(
      `SELECT p.codigo FROM pagamento_lote_itens i JOIN cooperado_pagamentos p ON p.id = i.pagamento_id WHERE i.pagamento_id IN (?) AND i.situacao = 'incluido'`, [lista]
    );
    if (itens.length) throw erro(409, `Registre a confirmação pelo lote: ${itens.map((i) => i.codigo).join(', ')}.`);
    for (const id of lista) await confirmarPagamentoConn(conn, id, { dataPagamento, motivo }, usuario);
    return { ok: true, confirmados: lista.length };
  });
}

/** Rejeição do banco: volta para correção (dados bancários) e nova liberação; valores preservados. */
export async function rejeitarPagamentoConn(conn, id, { codigo, descricao } = {}, usuario) {
  const p = await carregarPagamento(conn, id);
  if (p.situacao !== 'em_lote') throw erro(409, `Só pagamentos em lote podem ser rejeitados (este está "${p.situacao}").`);
  const desc = texto(descricao, 300);
  if (!desc) throw erro(400, 'Informe o motivo da rejeição.');
  await conn.query(`UPDATE cooperado_pagamentos SET situacao = 'rejeitado', dados_bancarios = NULL, motivo_situacao = ? WHERE id = ?`, [`${codigo ? `${codigo} — ` : ''}${desc}`, p.id]);
  await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: p.id, acao: 'rejeicao_banco', anterior: 'em_lote', novo: 'rejeitado', motivo: `${codigo ? `${codigo} — ` : ''}${desc}` });
  await recalcularPagamento(conn, p.id, usuario);
  return p;
}

// ── Dados bancários do cooperado (corrigidos ou solicitados pela fila) ──────
/** Grava na mesma ficha usada por Benefícios e reavalia os pagamentos em aberto do cooperado. */
export async function salvarDadosBancariosCooperado(candidatoId, d = {}, usuario, { podeVerInterno = false } = {}) {
  await garantirEstruturaPagamentos();
  const tipoPix = d.tipoPix || null;
  const b = {
    banco: texto(d.banco, 100), codigo_banco: String(d.codigoBanco ?? '').replace(/\D/g, '') || null, agencia: String(d.agencia ?? '').replace(/\D/g, '') || null,
    conta: String(d.conta ?? '').replace(/\D/g, '') || null, digito: texto(d.digito, 2)?.toUpperCase() ?? null, tipo_conta: d.tipoConta || 'corrente',
    chave_pix: texto(normalizarChavePix(d.chavePix, tipoPix), 150), tipo_pix: tipoPix,
  };
  const temConta = b.codigo_banco || b.agencia || b.conta;
  if (!temConta && !b.chave_pix) throw erro(400, 'Informe a conta bancária ou uma chave PIX.');
  if (temConta) {
    const p = problemasConta(b);
    if (p.length) throw erro(400, `Conta bancária: ${p.join(' ')}`, { detalhes: p });
  }
  return emTransacao(async (conn) => {
    const [[c]] = await conn.query(`SELECT id, nome, cpf, tipo_contratacao FROM ra_candidatos WHERE id = ?`, [Number(candidatoId)]);
    if (!c) throw erro(404, 'Cooperado não encontrado.');
    if (c.tipo_contratacao === 'interno' && !podeVerInterno) throw erro(403, 'Dados de cooperado interno só podem ser alterados por usuários autorizados.');
    if (b.chave_pix) {
      if (!TIPOS_PIX_COOPERADO.includes(tipoPix)) throw erro(400, 'Tipo da chave PIX inválido para cooperado.');
      const p = problemasChavePix(b.chave_pix, tipoPix, c.cpf);
      if (p.length) throw erro(400, p.join(' '), { detalhes: p });
    } else b.tipo_pix = null;
    const [[atual]] = await conn.query(`SELECT * FROM ra_dados_bancarios WHERE candidato_id = ? FOR UPDATE`, [c.id]);
    const cols = Object.keys(b);
    await conn.query(
      `INSERT INTO ra_dados_bancarios (candidato_id, ${cols.join(', ')}) VALUES (?, ${cols.map(() => '?').join(', ')})
       ON DUPLICATE KEY UPDATE ${cols.map((k) => `${k} = VALUES(${k})`).join(', ')}`,
      [c.id, ...cols.map((k) => b[k])]
    );
    const anterior = atual ? Object.fromEntries(cols.map((k) => [k, atual[k]])) : null;
    await auditarFin(conn, usuario, { entidade: 'cooperado', entidadeId: c.id, acao: 'dados_bancarios', anterior, novo: b, motivo: texto(d.motivo, 2000) });
    await conn.query(
      `INSERT INTO ra_auditoria (candidato_id, tabela, campo, acao, valor_anterior, valor_novo, observacao, usuario_id, usuario_nome) VALUES (?, 'ra_dados_bancarios', 'banco', ?, ?, ?, 'Alterado pela fila de pagamentos do Financeiro.', ?, ?)`,
      [c.id, atual ? 'edicao' : 'criacao', atual?.banco ?? null, b.banco, usuario.id ?? null, usuario.nome ?? null]
    );
    await conn.query(`INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'dados_bancarios', ?)`, [c.id, `Dados bancários atualizados por ${usuario.nome ?? 'usuário'} (Financeiro).`]);
    const [pags] = await conn.query(`SELECT id FROM cooperado_pagamentos WHERE candidato_id = ? AND situacao IN (?)`, [c.id, SITUACOES_ABERTAS]);
    for (const p of pags) await recalcularPagamento(conn, p.id, usuario);
    return { ok: true, atualizados: pags.length };
  });
}

/**
 * Pede ao setor responsável pela ficha do cooperado (Benefícios) a coleta dos dados bancários: vira
 * alerta em Benefícios e fica aberta na fila até os dados ficarem válidos.
 */
export async function solicitarDadosBancarios(pagamentoId, { mensagem } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const msg = texto(mensagem, 500);
  return emTransacao(async (conn) => {
    const p = await carregarPagamento(conn, pagamentoId);
    if (!SITUACOES_ABERTAS.includes(p.situacao)) throw erro(409, `O pagamento está "${p.situacao}".`);
    const [[c]] = await conn.query(`SELECT id, nome, matricula FROM ra_candidatos WHERE id = ?`, [p.candidato_id]);
    let res;
    try {
      [res] = await conn.query(
        `INSERT INTO cooperado_solicitacoes_dados (candidato_id, pagamento_id, mensagem, chave_ativa, criado_por_id, criado_por_nome) VALUES (?, ?, ?, ?, ?, ?)`,
        [c.id, p.id, msg, c.id, usuario.id ?? null, usuario.nome ?? null]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Já existe uma solicitação aberta para este cooperado.');
      throw err;
    }
    await conn.query(
      `INSERT INTO ra_alertas (candidato_id, tipo, mensagem) VALUES (?, 'solicitacao_dados_bancarios', ?)`,
      [c.id, `SOLICITAÇÃO DO FINANCEIRO: coletar os dados bancários de ${c.nome}${c.matricula ? ` (mat. ${c.matricula})` : ''} para o pagamento ${p.codigo}. Solicitado por ${usuario.nome ?? 'usuário'}.${msg ? ` Observação: "${msg}".` : ''}`]
    );
    await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: p.id, acao: 'solicitacao_dados_bancarios', novo: { solicitacao: res.insertId, setor: 'beneficios' }, motivo: msg });
    return { ok: true, id: res.insertId };
  });
}

// ── Adiantamentos ───────────────────────────────────────────────────────────
export async function registrarAdiantamento(dados, usuario) {
  await garantirEstruturaPagamentos();
  const candidatoId = Number(dados.candidatoId);
  const competencia = exigirCompetencia(dados.competencia);
  const compensar = exigirCompetencia(dados.compensarAPartir, 'Competência de compensação');
  if (compensar < competencia) throw erro(400, 'A compensação não pode ser anterior à competência do adiantamento.');
  const valor = numero(dados.valor);
  if (valor === null || Number.isNaN(valor) || valor <= 0) throw erro(400, 'Informe o valor do adiantamento.');
  const motivo = texto(dados.motivo, 2000);
  if (!motivo) throw erro(400, 'Informe o motivo / solicitação do adiantamento.');
  return emTransacao(async (conn) => {
    const [[c]] = await conn.query(`SELECT id, nome FROM ra_candidatos WHERE id = ?`, [candidatoId]);
    if (!c) throw erro(404, 'Cooperado não encontrado.');
    const chave = `${c.id}|${competencia}|adiantamento`;
    let res;
    try {
      [res] = await conn.query(
        `INSERT INTO cooperado_pagamentos (candidato_id, competencia, tipo, chave_ativa, criado_por_id, criado_por_nome) VALUES (?, ?, 'adiantamento', ?, ?, ?)`,
        [c.id, competencia, chave, usuario.id ?? null, usuario.nome ?? null]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Já existe um adiantamento em aberto para este cooperado nesta competência.');
      throw err;
    }
    const pagamentoId = res.insertId;
    const codigo = codigoPagamento(competencia, pagamentoId);
    await conn.query(`UPDATE cooperado_pagamentos SET codigo = ? WHERE id = ?`, [codigo, pagamentoId]);
    await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: pagamentoId, acao: 'criacao_adiantamento', novo: { codigo, candidato_id: c.id, competencia, valor: r2(valor), compensar_a_partir: compensar }, motivo });
    await inserirLancamento(conn, {
      candidato_id: c.id, tipo: 'credito', categoria: 'adiantamento', origem: 'adiantamento', origem_ref: `cooperado_pagamentos#${pagamentoId}`,
      chave: `adiantamento:${pagamentoId}:credito`, competencia, descricao: `Adiantamento ${competencia}`, valor, situacao: 'reservado', pagamento_id: pagamentoId, motivo,
    }, usuario);
    await inserirLancamento(conn, {
      candidato_id: c.id, tipo: 'debito', categoria: 'compensacao_adiantamento', origem: 'adiantamento', origem_ref: `cooperado_pagamentos#${pagamentoId}`,
      chave: `adiantamento:${pagamentoId}:compensacao`, competencia, compensar_a_partir: compensar, descricao: `Compensação do adiantamento ${codigo}`, valor,
      situacao: 'aguardando', adiantamento_pagamento_id: pagamentoId, motivo,
    }, usuario);
    await recalcularPagamento(conn, pagamentoId, usuario);
    return { ok: true, id: pagamentoId, codigo };
  });
}

/** Extrato do cooperado: lançamentos, saldo pendente e pagamentos. */
export async function extratoCooperado(candidatoId) {
  await garantirEstruturaPagamentos();
  const [[c]] = await pool.query(`SELECT id, nome, matricula, status, inativado_em FROM ra_candidatos WHERE id = ?`, [Number(candidatoId)]);
  if (!c) throw erro(404, 'Cooperado não encontrado.');
  const lancamentos = await listarLancamentos({ candidatoId: c.id });
  const pendentes = lancamentos.filter((l) => ['pendente', 'reservado', 'aguardando'].includes(l.situacao));
  const pagamentos = await listarFila({ candidatoId: c.id });
  return { cooperado: c, lancamentos, saldo_pendente: totalizar(pendentes), pagamentos, bloqueios: await listarBloqueios({ candidatoId: c.id }) };
}

export async function listarCooperadosParaLancamento(busca) {
  const like = `%${String(busca || '').trim()}%`;
  const [rows] = await pool.query(
    `SELECT id, nome, matricula, status FROM ra_candidatos WHERE status IN (1, 2, 4) AND (nome LIKE ? OR matricula LIKE ? OR cpf LIKE ?) ORDER BY nome LIMIT 500`,
    [like, like, like]
  );
  return rows;
}
