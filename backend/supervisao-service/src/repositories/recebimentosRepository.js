// ── Recebimentos: retorno bancário, baixa manual autorizada, vínculo e estorno ─
// Fluxo do retorno: importar (valida, impede arquivo duplicado, classifica e guarda o arquivo)
// → conferir a prévia → processar (gera os recebimentos e atualiza as cobranças) ou descartar.
// Juros/multa não são presumidos: valor acima do saldo fica como "divergente" para análise.
import { pool } from '../config/database.js';
import {
  r2, erro, texto, numero, dataISO, emTransacao, garantirEstruturaFinanceira, auditarFin,
  decodificarArquivo, salvarDocumento,
} from './financeiroComum.js';
import { analisarArquivoRetorno, classificarPagamentos, COLUNAS_CSV } from './retornoBancario.js';
import { atualizarSituacaoCobranca } from './notasCobrancasRepository.js';

const CLASSES_VINCULADAS = ['integral', 'parcial', 'a_maior'];

export function modeloCsvRetorno() {
  const cab = [...COLUNAS_CSV.obrigatorias, ...COLUNAS_CSV.opcionais].join(';');
  return `${cab}\nCOB-202609-000001;05/10/2026;1500,00;341;06/10/2026;0,00;0,00;Cliente Exemplo;11111111000111\n`;
}

async function cobrancasParaClassificar(conn, registros, { bloquear = false } = {}) {
  const idents = [...new Set(registros.map((r) => String(r.identificador)))];
  if (!idents.length) return [];
  const semZeros = idents.map((i) => i.replace(/^0+(?=\d)/, ''));
  const [rows] = await conn.query(
    `SELECT id, codigo, banco_codigo, nosso_numero, valor, valor_recebido, status, processo_id
       FROM faturamento_cobrancas
      WHERE UPPER(codigo) IN (?) OR TRIM(LEADING '0' FROM nosso_numero) IN (?) ${bloquear ? 'FOR UPDATE' : ''}`,
    [idents.map((i) => i.toUpperCase()), semZeros]
  );
  return rows;
}

async function recebimentosExistentes(conn, registros) {
  const idents = [...new Set(registros.map((r) => String(r.identificador).replace(/^0+(?=\d)/, '')))];
  if (!idents.length) return [];
  const [rows] = await conn.query(
    `SELECT identificador, data_pagamento, valor FROM financeiro_recebimentos
      WHERE situacao = 'ativo' AND TRIM(LEADING '0' FROM identificador) IN (?)`,
    [idents]
  );
  return rows;
}

function resumir(linhas) {
  const resumo = {};
  for (const l of linhas) {
    resumo[l.classificacao] = resumo[l.classificacao] || { quantidade: 0, valor: 0 };
    resumo[l.classificacao].quantidade++;
    resumo[l.classificacao].valor = r2(resumo[l.classificacao].valor + Number(l.valor_pago));
  }
  return resumo;
}

// ── Importação ──────────────────────────────────────────────────────────────
export async function importarRetorno(dados, usuario) {
  await garantirEstruturaFinanceira();
  const arquivo = decodificarArquivo(dados, ['ret', 'txt', 'csv', 'rem']);
  const bancoPadrao = String(dados.bancoCodigo || '').replace(/\D/g, '') || null;
  if (bancoPadrao && bancoPadrao.length !== 3) throw erro(400, 'Código do banco deve ter 3 dígitos.');

  const [[existente]] = await pool.query(
    `SELECT id, importado_por_nome, importado_em, status FROM financeiro_retornos WHERE sha256_ativo = ?`, [arquivo.sha256]
  );
  if (existente) {
    await emTransacao((conn) => auditarFin(conn, usuario, {
      entidade: 'retorno', entidadeId: existente.id, acao: 'importacao_duplicada', novo: { arquivo: arquivo.nome, sha256: arquivo.sha256 },
    }));
    throw erro(409, `Este arquivo já foi importado (retorno #${existente.id}, ${existente.status}, por ${existente.importado_por_nome ?? '—'} em ${String(existente.importado_em).slice(0, 16)}).`);
  }

  const analise = analisarArquivoRetorno(arquivo.buffer, { bancoPadrao });
  if (!analise.ok) {
    await emTransacao((conn) => auditarFin(conn, usuario, {
      entidade: 'retorno', acao: 'importacao_rejeitada',
      novo: { arquivo: arquivo.nome, sha256: arquivo.sha256, layout: analise.layout, banco: analise.banco_codigo }, motivo: analise.erros.join(' | ').slice(0, 5000),
    }));
    throw erro(400, 'Arquivo de retorno inválido.', { detalhes: analise.erros });
  }

  return emTransacao(async (conn) => {
    const cobrancas = await cobrancasParaClassificar(conn, analise.registros);
    const linhas = classificarPagamentos(analise.registros, cobrancas, await recebimentosExistentes(conn, analise.registros));
    const resumo = resumir(linhas);
    let res;
    try {
      [res] = await conn.query(
        `INSERT INTO financeiro_retornos (layout, banco_codigo, nome_arquivo, sha256, sha256_ativo, status, total_registros, valor_total, resumo, importado_por_id, importado_por_nome)
         VALUES (?, ?, ?, ?, ?, 'pendente', ?, ?, ?, ?, ?)`,
        [analise.layout, analise.banco_codigo, arquivo.nome, arquivo.sha256, arquivo.sha256, linhas.length,
          r2(linhas.reduce((s, l) => s + Number(l.valor_pago), 0)), JSON.stringify(resumo), usuario.id ?? null, usuario.nome ?? null]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Este arquivo já foi importado.');
      throw err;
    }
    const retornoId = res.insertId;
    const docId = await salvarDocumento(conn, { entidade: 'retorno', entidadeId: retornoId, tipo: 'retorno_bancario', arquivo }, usuario);
    await conn.query(`UPDATE financeiro_retornos SET documento_id = ? WHERE id = ?`, [docId, retornoId]);
    await conn.query(
      `INSERT INTO financeiro_retorno_linhas (retorno_id, linha_numero, identificador, data_pagamento, data_credito, valor_pago, juros, desconto,
                                              pagador_nome, pagador_documento, cobranca_id, classificacao, mensagem)
       VALUES ?`,
      [linhas.map((l) => [retornoId, l.linha_numero, l.identificador, l.data_pagamento, l.data_credito, l.valor_pago, l.juros, l.desconto,
        l.pagador_nome, l.pagador_documento, l.cobranca_id, l.classificacao, l.mensagem?.slice(0, 300) ?? null])]
    );
    await auditarFin(conn, usuario, {
      entidade: 'retorno', entidadeId: retornoId, acao: 'importacao',
      novo: { arquivo: arquivo.nome, sha256: arquivo.sha256, layout: analise.layout, banco: analise.banco_codigo, registros: linhas.length, resumo },
    });
    return { ok: true, id: retornoId, resumo };
  });
}

export async function listarRetornos() {
  await garantirEstruturaFinanceira();
  const [rows] = await pool.query(`SELECT id, layout, banco_codigo, nome_arquivo, sha256, status, total_registros, valor_total, resumo,
                                          importado_por_nome, importado_em, processado_por_nome, processado_em, motivo_descarte, documento_id
                                     FROM financeiro_retornos ORDER BY importado_em DESC, id DESC LIMIT 200`);
  return rows.map((r) => ({ ...r, resumo: r.resumo ? JSON.parse(r.resumo) : {} }));
}

export async function obterRetorno(id) {
  await garantirEstruturaFinanceira();
  const [[r]] = await pool.query(`SELECT * FROM financeiro_retornos WHERE id = ?`, [Number(id)]);
  if (!r) throw erro(404, 'Retorno não encontrado.');
  const [linhas] = await pool.query(
    `SELECT l.*, c.codigo AS cobranca_codigo, c.valor AS cobranca_valor, e.nome_empresa
       FROM financeiro_retorno_linhas l
       LEFT JOIN faturamento_cobrancas c ON c.id = l.cobranca_id
       LEFT JOIN empresas e ON e.id = c.empresa_id
      WHERE l.retorno_id = ? ORDER BY l.linha_numero`,
    [r.id]
  );
  return { retorno: { ...r, resumo: r.resumo ? JSON.parse(r.resumo) : {} }, linhas };
}

export async function processarRetorno(id, usuario) {
  await garantirEstruturaFinanceira();
  return emTransacao(async (conn) => {
    const [[ret]] = await conn.query(`SELECT * FROM financeiro_retornos WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!ret) throw erro(404, 'Retorno não encontrado.');
    if (ret.status !== 'pendente') throw erro(409, `Este retorno já está "${ret.status}".`);
    const [linhasDb] = await conn.query(`SELECT * FROM financeiro_retorno_linhas WHERE retorno_id = ? ORDER BY linha_numero`, [ret.id]);
    const registros = linhasDb.map((l) => ({ ...l, data_pagamento: String(l.data_pagamento).slice(0, 10), valor_pago: Number(l.valor_pago), banco_codigo: ret.banco_codigo }));
    // Reclassifica com a situação atual (as cobranças podem ter mudado desde a importação)
    const cobrancas = await cobrancasParaClassificar(conn, registros, { bloquear: true });
    const linhas = classificarPagamentos(registros, cobrancas, await recebimentosExistentes(conn, registros));
    const afetadas = new Set();
    let gerados = 0;
    for (const l of linhas) {
      let recebimentoId = null;
      if (l.classificacao !== 'duplicado') {
        const vincula = CLASSES_VINCULADAS.includes(l.classificacao);
        const [res] = await conn.query(
          `INSERT INTO financeiro_recebimentos (cobranca_id, origem, retorno_linha_id, identificador, data_pagamento, data_credito, valor, juros, desconto,
                                                pagador_nome, pagador_documento, observacao, criado_por_id, criado_por_nome)
           VALUES (?, 'retorno', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [vincula ? l.cobranca_id : null, l.id, l.identificador, l.data_pagamento, l.data_credito, l.valor_pago, l.juros, l.desconto,
            l.pagador_nome, l.pagador_documento, vincula ? null : l.mensagem, usuario.id ?? null, usuario.nome ?? null]
        );
        recebimentoId = res.insertId;
        gerados++;
        if (vincula) afetadas.add(l.cobranca_id);
        await auditarFin(conn, usuario, {
          entidade: 'recebimento', entidadeId: recebimentoId, acao: vincula ? 'baixa_retorno' : 'recebimento_nao_identificado',
          novo: { retorno: ret.id, linha: l.linha_numero, cobranca_id: vincula ? l.cobranca_id : null, valor: l.valor_pago, classificacao: l.classificacao },
        });
      }
      await conn.query(
        `UPDATE financeiro_retorno_linhas SET cobranca_id = ?, classificacao = ?, mensagem = ?, recebimento_id = ? WHERE id = ?`,
        [l.cobranca_id, l.classificacao, l.mensagem?.slice(0, 300) ?? null, recebimentoId, l.id]
      );
    }
    for (const cid of afetadas) await atualizarSituacaoCobranca(conn, cid, usuario, `Retorno bancário #${ret.id}`);
    const resumo = resumir(linhas);
    await conn.query(
      `UPDATE financeiro_retornos SET status = 'processado', resumo = ?, processado_por_nome = ?, processado_em = NOW() WHERE id = ?`,
      [JSON.stringify(resumo), usuario.nome ?? null, ret.id]
    );
    await auditarFin(conn, usuario, { entidade: 'retorno', entidadeId: ret.id, acao: 'processamento', anterior: 'pendente', novo: { recebimentos: gerados, resumo } });
    return { ok: true, recebimentos: gerados, resumo };
  });
}

export async function descartarRetorno(id, { motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do descarte.');
  return emTransacao(async (conn) => {
    const [[ret]] = await conn.query(`SELECT id, status FROM financeiro_retornos WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!ret) throw erro(404, 'Retorno não encontrado.');
    if (ret.status !== 'pendente') throw erro(409, `Só retornos pendentes podem ser descartados (este está "${ret.status}").`);
    // sha256_ativo = NULL permite reimportar o mesmo arquivo depois
    await conn.query(`UPDATE financeiro_retornos SET status = 'descartado', sha256_ativo = NULL, motivo_descarte = ? WHERE id = ?`, [mot, ret.id]);
    await auditarFin(conn, usuario, { entidade: 'retorno', entidadeId: ret.id, acao: 'descarte', anterior: 'pendente', novo: 'descartado', motivo: mot });
    return { ok: true };
  });
}

// ── Recebimentos ────────────────────────────────────────────────────────────
export async function listarRecebimentos({ cobrancaId, naoIdentificados, situacao, dataInicio, dataFim } = {}) {
  await garantirEstruturaFinanceira();
  let sql = `SELECT r.*, c.codigo AS cobranca_codigo, e.nome_empresa, p.codigo AS processo_codigo
               FROM financeiro_recebimentos r
               LEFT JOIN faturamento_cobrancas c ON c.id = r.cobranca_id
               LEFT JOIN empresas e ON e.id = c.empresa_id
               LEFT JOIN faturamento_processos p ON p.id = c.processo_id
              WHERE 1=1`;
  const params = [];
  if (cobrancaId) { sql += ' AND r.cobranca_id = ?'; params.push(Number(cobrancaId)); }
  if (naoIdentificados === 'true' || naoIdentificados === true) sql += ` AND r.cobranca_id IS NULL AND r.situacao = 'ativo'`;
  if (situacao) { sql += ' AND r.situacao = ?'; params.push(situacao); }
  if (dataInicio) { sql += ' AND r.data_pagamento >= ?'; params.push(dataInicio); }
  if (dataFim) { sql += ' AND r.data_pagamento <= ?'; params.push(dataFim); }
  sql += ' ORDER BY r.data_pagamento DESC, r.id DESC LIMIT 1000';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function registrarBaixaManual(cobrancaId, dados, usuario) {
  await garantirEstruturaFinanceira();
  const valor = numero(dados.valor);
  if (valor === null || Number.isNaN(valor) || valor <= 0) throw erro(400, 'Informe o valor recebido.');
  const dataPag = dataISO(dados.dataPagamento);
  if (!dataPag) throw erro(400, 'Informe a data do pagamento.');
  const dataCred = dados.dataCredito ? dataISO(dados.dataCredito) : null;
  if (dados.dataCredito && !dataCred) throw erro(400, 'Data de crédito inválida.');
  const mot = texto(dados.motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo / evidência da baixa manual.');
  const comprovante = dados.comprovante?.conteudoBase64 ? decodificarArquivo(dados.comprovante, ['pdf', 'png', 'jpg', 'jpeg']) : null;
  return emTransacao(async (conn) => {
    const [[c]] = await conn.query(`SELECT * FROM faturamento_cobrancas WHERE id = ? FOR UPDATE`, [Number(cobrancaId)]);
    if (!c) throw erro(404, 'Cobrança não encontrada.');
    if (c.status === 'cancelada') throw erro(409, 'Cobrança cancelada.');
    const saldo = r2(Number(c.valor) - Number(c.valor_recebido));
    if (r2(valor) > saldo && !dados.confirmarValorMaior) {
      throw erro(409, `O valor informado (R$ ${r2(valor).toFixed(2)}) é maior que o saldo da cobrança (R$ ${saldo.toFixed(2)}). Confirme para registrar como divergente.`, { codigo: 'VALOR_MAIOR_QUE_SALDO' });
    }
    const [res] = await conn.query(
      `INSERT INTO financeiro_recebimentos (cobranca_id, origem, identificador, data_pagamento, data_credito, valor, pagador_nome, motivo,
                                            autorizado_por_id, autorizado_por_nome, criado_por_id, criado_por_nome)
       VALUES (?, 'manual', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.nosso_numero || c.codigo, dataPag, dataCred, r2(valor), texto(dados.pagadorNome, 200), mot,
        usuario.id ?? null, usuario.nome ?? null, usuario.id ?? null, usuario.nome ?? null]
    );
    if (comprovante) await salvarDocumento(conn, { entidade: 'recebimento', entidadeId: res.insertId, tipo: 'comprovante', arquivo: comprovante }, usuario);
    await auditarFin(conn, usuario, {
      entidade: 'recebimento', entidadeId: res.insertId, processoId: c.processo_id, acao: 'baixa_manual',
      novo: { cobranca: c.codigo, valor: r2(valor), data_pagamento: dataPag, comprovante: comprovante?.nome ?? null }, motivo: mot,
    });
    const atual = await atualizarSituacaoCobranca(conn, c.id, usuario, 'Baixa manual');
    return { ok: true, id: res.insertId, status_cobranca: atual.status };
  });
}

export async function vincularRecebimento(id, { cobrancaId, motivo, confirmarValorMaior } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do vínculo.');
  return emTransacao(async (conn) => {
    const [[r]] = await conn.query(`SELECT * FROM financeiro_recebimentos WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!r) throw erro(404, 'Recebimento não encontrado.');
    if (r.situacao !== 'ativo') throw erro(409, 'Recebimento estornado.');
    if (r.cobranca_id) throw erro(409, 'Este recebimento já está vinculado a uma cobrança.');
    const [[c]] = await conn.query(`SELECT * FROM faturamento_cobrancas WHERE id = ? FOR UPDATE`, [Number(cobrancaId)]);
    if (!c) throw erro(404, 'Cobrança não encontrada.');
    if (c.status === 'cancelada') throw erro(409, 'Cobrança cancelada.');
    const saldo = r2(Number(c.valor) - Number(c.valor_recebido));
    if (r2(r.valor) > saldo && !confirmarValorMaior) {
      throw erro(409, `O recebimento (R$ ${r2(r.valor).toFixed(2)}) é maior que o saldo da cobrança (R$ ${saldo.toFixed(2)}). Confirme para registrar como divergente.`, { codigo: 'VALOR_MAIOR_QUE_SALDO' });
    }
    await conn.query(
      `UPDATE financeiro_recebimentos SET cobranca_id = ?, motivo = ?, vinculado_por_nome = ?, vinculado_em = NOW(), autorizado_por_id = ?, autorizado_por_nome = ? WHERE id = ?`,
      [c.id, mot, usuario.nome ?? null, usuario.id ?? null, usuario.nome ?? null, r.id]
    );
    await auditarFin(conn, usuario, { entidade: 'recebimento', entidadeId: r.id, processoId: c.processo_id, acao: 'vinculo', anterior: null, novo: { cobranca: c.codigo, valor: r2(r.valor) }, motivo: mot });
    const atual = await atualizarSituacaoCobranca(conn, c.id, usuario, `Vínculo do recebimento #${r.id}`);
    return { ok: true, status_cobranca: atual.status };
  });
}

export async function estornarRecebimento(id, { motivo } = {}, usuario) {
  await garantirEstruturaFinanceira();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do estorno.');
  return emTransacao(async (conn) => {
    const [[r]] = await conn.query(`SELECT * FROM financeiro_recebimentos WHERE id = ? FOR UPDATE`, [Number(id)]);
    if (!r) throw erro(404, 'Recebimento não encontrado.');
    if (r.situacao !== 'ativo') throw erro(409, 'Recebimento já estornado.');
    await conn.query(
      `UPDATE financeiro_recebimentos SET situacao = 'estornado', estornado_por_nome = ?, estornado_em = NOW(), motivo_estorno = ? WHERE id = ?`,
      [usuario.nome ?? null, mot, r.id]
    );
    await auditarFin(conn, usuario, { entidade: 'recebimento', entidadeId: r.id, acao: 'estorno', anterior: { valor: r2(r.valor), cobranca_id: r.cobranca_id }, motivo: mot });
    if (r.cobranca_id) await atualizarSituacaoCobranca(conn, r.cobranca_id, usuario, `Estorno do recebimento #${r.id}`);
    return { ok: true };
  });
}
