// ── Contas a pagar ──────────────────────────────────────────────────────────
// Fluxo: aguardando aprovação → aprovada → programada → paga (baixa com comprovante)
//        | rejeitada (volta a aguardar aprovação ao ser corrigida) | cancelada.
// Responsáveis (cadastro, aprovação, programação, baixa) e alterações ficam registrados.
// Sem DDA: não há integração bancária existente nem escopo aprovado.
import { pool } from '../config/database.js';
import {
  r2, erro, texto, numero, dataISO, emTransacao, garantirEstruturaPagamentos, auditarFin,
  decodificarArquivo, salvarDocumento, listarDocumentos,
} from './financeiroComum.js';
import { cpfValido, cnpjValido, problemasConta, problemasChavePix, normalizarChavePix } from './dadosBancarios.js';

export const TIPOS_DOCUMENTO = ['nfe', 'nfse', 'boleto', 'recibo', 'fatura', 'outro'];
export const FORMAS_PAGAMENTO = ['boleto', 'pix', 'transferencia', 'debito_automatico', 'dinheiro', 'outro'];
const COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/;
const soDigitos = (v) => String(v ?? '').replace(/\D/g, '');

// ── Fornecedores ────────────────────────────────────────────────────────────
function montarFornecedor(d) {
  const nome = texto(d.nome, 200);
  if (!nome) throw erro(400, 'Informe o nome / razão social.');
  const doc = soDigitos(d.documento);
  if (!(doc.length === 11 ? cpfValido(doc) : doc.length === 14 ? cnpjValido(doc) : false)) throw erro(400, 'CPF/CNPJ inválido.');
  const telefone = soDigitos(d.telefone);
  if (telefone && !/^[1-9]{2}\d{8,9}$/.test(telefone)) throw erro(400, 'Telefone inválido (DDD + número).');
  const f = {
    nome, documento: doc, email: texto(d.email, 150), telefone: telefone || null,
    codigo_banco: soDigitos(d.codigoBanco) || null, agencia: soDigitos(d.agencia) || null, conta: soDigitos(d.conta) || null,
    digito: texto(d.digito, 2)?.toUpperCase() ?? null, tipo_conta: d.tipoConta || null,
    chave_pix: texto(normalizarChavePix(d.chavePix, d.tipoPix), 150), tipo_pix: d.tipoPix || null, observacao: texto(d.observacao, 5000),
    ativo: d.ativo === undefined ? 1 : (d.ativo === true || d.ativo === 1 || d.ativo === '1' || d.ativo === 'true' ? 1 : 0),
  };
  if (f.codigo_banco || f.agencia || f.conta) {
    const p = problemasConta(f);
    if (p.length) throw erro(400, `Conta bancária: ${p.join(' ')}`);
  }
  if (f.chave_pix) {
    const p = problemasChavePix(f.chave_pix, f.tipo_pix);
    if (p.length) throw erro(400, p.join(' '));
  }
  return f;
}

export async function listarFornecedores({ busca, incluirInativos } = {}) {
  await garantirEstruturaPagamentos();
  // Resumo das contas em aberto: preenche as colunas da lista de fornecedores
  let sql = `SELECT f.*, a.contas_abertas, a.valor_aberto, a.proximo_vencimento, a.ultima_competencia
               FROM fornecedores f
               LEFT JOIN (SELECT fornecedor_id, COUNT(*) AS contas_abertas, SUM(valor) AS valor_aberto, MIN(vencimento) AS proximo_vencimento, MAX(competencia) AS ultima_competencia
                            FROM contas_pagar WHERE situacao IN ('aguardando_aprovacao','aprovada','programada','rejeitada') GROUP BY fornecedor_id) a ON a.fornecedor_id = f.id
              WHERE 1=1`;
  const params = [];
  if (!incluirInativos || incluirInativos === 'false') sql += ' AND f.ativo = 1';
  if (busca) { sql += ' AND (f.nome LIKE ? OR f.documento LIKE ?)'; params.push(`%${busca}%`, `%${soDigitos(busca) || busca}%`); }
  sql += ' ORDER BY f.nome LIMIT 500';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function salvarFornecedor(id, dados, usuario) {
  await garantirEstruturaPagamentos();
  const f = montarFornecedor(dados);
  return emTransacao(async (conn) => {
    try {
      if (!id) {
        const cols = Object.keys(f);
        const [res] = await conn.query(`INSERT INTO fornecedores (${cols.join(', ')}, criado_por_nome) VALUES (${cols.map(() => '?').join(', ')}, ?)`, [...cols.map((c) => f[c]), usuario.nome ?? null]);
        await auditarFin(conn, usuario, { entidade: 'fornecedor', entidadeId: res.insertId, acao: 'criacao', novo: f });
        return { ok: true, id: res.insertId };
      }
      const [[atual]] = await conn.query(`SELECT * FROM fornecedores WHERE id = ? FOR UPDATE`, [Number(id)]);
      if (!atual) throw erro(404, 'Fornecedor não encontrado.');
      const alterados = Object.keys(f).filter((c) => String(atual[c] ?? '') !== String(f[c] ?? ''));
      if (alterados.length) {
        await conn.query(`UPDATE fornecedores SET ${alterados.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`, [...alterados.map((c) => f[c]), atual.id]);
        for (const c of alterados) await auditarFin(conn, usuario, { entidade: 'fornecedor', entidadeId: atual.id, acao: 'edicao', campo: c, anterior: atual[c], novo: f[c] });
      }
      return { ok: true, id: atual.id };
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Já existe fornecedor com este CPF/CNPJ.');
      throw err;
    }
  });
}

// ── Categorias ──────────────────────────────────────────────────────────────
export async function listarCategorias({ incluirInativas } = {}) {
  await garantirEstruturaPagamentos();
  const [rows] = await pool.query(`SELECT * FROM contas_pagar_categorias ${incluirInativas === 'true' ? '' : 'WHERE ativa = 1'} ORDER BY nome`);
  return rows;
}

export async function salvarCategoria(id, { nome, ativa } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const n = texto(nome, 100);
  if (!n) throw erro(400, 'Informe o nome da categoria.');
  return emTransacao(async (conn) => {
    try {
      if (!id) {
        const [res] = await conn.query(`INSERT INTO contas_pagar_categorias (nome, criado_por_nome) VALUES (?, ?)`, [n, usuario.nome ?? null]);
        await auditarFin(conn, usuario, { entidade: 'categoria_conta', entidadeId: res.insertId, acao: 'criacao', novo: n });
        return { ok: true, id: res.insertId };
      }
      const [[a]] = await conn.query(`SELECT * FROM contas_pagar_categorias WHERE id = ?`, [Number(id)]);
      if (!a) throw erro(404, 'Categoria não encontrada.');
      const at = ativa === undefined ? a.ativa : (ativa ? 1 : 0);
      await conn.query(`UPDATE contas_pagar_categorias SET nome = ?, ativa = ? WHERE id = ?`, [n, at, a.id]);
      await auditarFin(conn, usuario, { entidade: 'categoria_conta', entidadeId: a.id, acao: 'edicao', anterior: { nome: a.nome, ativa: a.ativa }, novo: { nome: n, ativa: at } });
      return { ok: true, id: a.id };
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Já existe categoria com este nome.');
      throw err;
    }
  });
}

// ── Contas ──────────────────────────────────────────────────────────────────
function montarConta(d, atual = {}) {
  const pegar = (camel, snake) => (camel in d ? d[camel] : atual[snake]);
  const fornecedorId = Number(pegar('fornecedorId', 'fornecedor_id'));
  if (!fornecedorId) throw erro(400, 'Selecione o fornecedor.');
  const categoriaId = Number(pegar('categoriaId', 'categoria_id'));
  if (!categoriaId) throw erro(400, 'Selecione a categoria.');
  const descricao = texto(pegar('descricao', 'descricao'), 255);
  if (!descricao) throw erro(400, 'Informe a descrição.');
  const competencia = String(pegar('competencia', 'competencia') || '');
  if (!COMPETENCIA.test(competencia)) throw erro(400, 'Competência inválida (AAAA-MM).');
  const valor = numero(pegar('valor', 'valor'));
  if (valor === null || Number.isNaN(valor) || valor <= 0) throw erro(400, 'Informe o valor.');
  const vencimento = dataISO(String(pegar('vencimento', 'vencimento') ?? '').slice(0, 10));
  if (!vencimento) throw erro(400, 'Informe o vencimento.');
  const tipo = pegar('documentoTipo', 'documento_tipo');
  if (!TIPOS_DOCUMENTO.includes(tipo)) throw erro(400, 'Tipo de documento fiscal inválido.');
  const numeroDoc = texto(pegar('documentoNumero', 'documento_numero'), 60);
  const emissaoBruta = pegar('documentoEmissao', 'documento_emissao');
  const emissao = emissaoBruta ? dataISO(String(emissaoBruta).slice(0, 10)) : null;
  if (emissaoBruta && !emissao) throw erro(400, 'Data de emissão do documento inválida.');
  return {
    fornecedor_id: fornecedorId, categoria_id: categoriaId, descricao, competencia, valor: r2(valor), vencimento,
    documento_tipo: tipo, documento_numero: numeroDoc, documento_emissao: emissao,
    chave_documento: numeroDoc ? `${fornecedorId}|${tipo}|${numeroDoc.replace(/^0+(?=\d)/, '').toUpperCase()}` : null,
    observacao: texto(pegar('observacao', 'observacao'), 5000),
  };
}

async function validarReferencias(conn, c) {
  const [[f]] = await conn.query(`SELECT id, ativo FROM fornecedores WHERE id = ?`, [c.fornecedor_id]);
  if (!f) throw erro(400, 'Fornecedor não encontrado.');
  if (!Number(f.ativo)) throw erro(400, 'Fornecedor inativo.');
  const [[cat]] = await conn.query(`SELECT id, ativa FROM contas_pagar_categorias WHERE id = ?`, [c.categoria_id]);
  if (!cat || !Number(cat.ativa)) throw erro(400, 'Categoria não encontrada ou inativa.');
}

export async function listarContas({ situacao, fornecedorId, categoriaId, competencia, vencidas, vencimentoAte } = {}) {
  await garantirEstruturaPagamentos();
  let sql = `SELECT cp.*, f.nome AS fornecedor_nome, f.documento AS fornecedor_documento, cat.nome AS categoria_nome,
                    (cp.situacao IN ('aguardando_aprovacao','aprovada','programada') AND cp.vencimento < CURDATE()) AS vencida
               FROM contas_pagar cp JOIN fornecedores f ON f.id = cp.fornecedor_id JOIN contas_pagar_categorias cat ON cat.id = cp.categoria_id
              WHERE 1=1`;
  const params = [];
  if (situacao) { sql += ' AND cp.situacao IN (?)'; params.push(String(situacao).split(',')); }
  if (fornecedorId) { sql += ' AND cp.fornecedor_id = ?'; params.push(Number(fornecedorId)); }
  if (categoriaId) { sql += ' AND cp.categoria_id = ?'; params.push(Number(categoriaId)); }
  if (competencia) { sql += ' AND cp.competencia = ?'; params.push(competencia); }
  if (vencimentoAte) { sql += ' AND cp.vencimento <= ?'; params.push(vencimentoAte); }
  if (vencidas === 'true' || vencidas === true) sql += ` AND cp.situacao IN ('aguardando_aprovacao','aprovada','programada') AND cp.vencimento < CURDATE()`;
  sql += ' ORDER BY cp.vencimento, cp.id LIMIT 2000';
  const [rows] = await pool.query(sql, params);
  return rows;
}

export async function obterConta(id) {
  await garantirEstruturaPagamentos();
  const [[c]] = await pool.query(
    `SELECT cp.*, f.nome AS fornecedor_nome, cat.nome AS categoria_nome FROM contas_pagar cp
       JOIN fornecedores f ON f.id = cp.fornecedor_id JOIN contas_pagar_categorias cat ON cat.id = cp.categoria_id WHERE cp.id = ?`, [Number(id)]
  );
  if (!c) throw erro(404, 'Conta não encontrada.');
  const [historico] = await pool.query(`SELECT * FROM financeiro_auditoria WHERE entidade = 'conta_pagar' AND entidade_id = ? ORDER BY criado_em DESC, id DESC`, [c.id]);
  return { conta: c, anexos: await listarDocumentos('conta_pagar', c.id), historico };
}

export async function criarConta(dados, usuario) {
  await garantirEstruturaPagamentos();
  const c = montarConta(dados);
  return emTransacao(async (conn) => {
    await validarReferencias(conn, c);
    const cols = Object.keys(c);
    let res;
    try {
      [res] = await conn.query(
        `INSERT INTO contas_pagar (${cols.join(', ')}, criado_por_id, criado_por_nome) VALUES (${cols.map(() => '?').join(', ')}, ?, ?)`,
        [...cols.map((k) => c[k]), usuario.id ?? null, usuario.nome ?? null]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Este documento fiscal já está lançado para o fornecedor.');
      throw err;
    }
    const codigo = `CP-${c.competencia.replace('-', '')}-${String(res.insertId).padStart(6, '0')}`;
    await conn.query(`UPDATE contas_pagar SET codigo = ? WHERE id = ?`, [codigo, res.insertId]);
    await auditarFin(conn, usuario, { entidade: 'conta_pagar', entidadeId: res.insertId, acao: 'criacao', novo: { codigo, ...c } });
    return { ok: true, id: res.insertId, codigo };
  });
}

async function carregarConta(conn, id) {
  const [[c]] = await conn.query(`SELECT * FROM contas_pagar WHERE id = ? FOR UPDATE`, [Number(id)]);
  if (!c) throw erro(404, 'Conta não encontrada.');
  return c;
}

/** Edição: só antes da aprovação (ou rejeitada, que volta a aguardar aprovação). */
export async function atualizarConta(id, dados, usuario) {
  await garantirEstruturaPagamentos();
  return emTransacao(async (conn) => {
    const atual = await carregarConta(conn, id);
    if (!['aguardando_aprovacao', 'rejeitada'].includes(atual.situacao)) throw erro(409, `Conta "${atual.situacao}" não pode ser alterada.`);
    const c = montarConta(dados, { ...atual, vencimento: String(atual.vencimento).slice(0, 10), documento_emissao: atual.documento_emissao ? String(atual.documento_emissao).slice(0, 10) : null });
    await validarReferencias(conn, c);
    const alterados = Object.keys(c).filter((k) => String(atual[k] ?? '').slice(0, k.includes('emissao') || k === 'vencimento' ? 10 : undefined) !== String(c[k] ?? '')
      && !(k === 'valor' && Number(atual[k]) === c[k]));
    const voltaAprovacao = atual.situacao === 'rejeitada';
    if (!alterados.length && !voltaAprovacao) return { ok: true };
    try {
      await conn.query(
        `UPDATE contas_pagar SET ${[...alterados.map((k) => `${k} = ?`), "situacao = 'aguardando_aprovacao'"].join(', ')} WHERE id = ?`,
        [...alterados.map((k) => c[k]), atual.id]
      );
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Este documento fiscal já está lançado para o fornecedor.');
      throw err;
    }
    for (const k of alterados.filter((x) => x !== 'chave_documento')) {
      await auditarFin(conn, usuario, { entidade: 'conta_pagar', entidadeId: atual.id, acao: 'edicao', campo: k, anterior: atual[k], novo: c[k] });
    }
    if (voltaAprovacao) await auditarFin(conn, usuario, { entidade: 'conta_pagar', entidadeId: atual.id, acao: 'reenvio_aprovacao', anterior: 'rejeitada', novo: 'aguardando_aprovacao' });
    return { ok: true };
  });
}

export async function aprovarConta(id, usuario) {
  await garantirEstruturaPagamentos();
  return emTransacao(async (conn) => {
    const c = await carregarConta(conn, id);
    if (c.situacao !== 'aguardando_aprovacao') throw erro(409, `Conta "${c.situacao}".`);
    await conn.query(`UPDATE contas_pagar SET situacao = 'aprovada', aprovado_por_id = ?, aprovado_por_nome = ?, aprovado_em = NOW(), motivo_situacao = NULL WHERE id = ?`, [usuario.id ?? null, usuario.nome ?? null, c.id]);
    await auditarFin(conn, usuario, {
      entidade: 'conta_pagar', entidadeId: c.id, acao: 'aprovacao', anterior: c.situacao, novo: 'aprovada',
      motivo: Number(c.criado_por_id) === Number(usuario.id) ? 'Aprovada pelo mesmo usuário que cadastrou.' : null,
    });
    return { ok: true };
  });
}

export async function rejeitarConta(id, { motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo da rejeição.');
  return emTransacao(async (conn) => {
    const c = await carregarConta(conn, id);
    if (!['aguardando_aprovacao', 'aprovada', 'programada'].includes(c.situacao)) throw erro(409, `Conta "${c.situacao}".`);
    await conn.query(`UPDATE contas_pagar SET situacao = 'rejeitada', motivo_situacao = ?, data_programada = NULL WHERE id = ?`, [mot, c.id]);
    await auditarFin(conn, usuario, { entidade: 'conta_pagar', entidadeId: c.id, acao: 'rejeicao', anterior: c.situacao, novo: 'rejeitada', motivo: mot });
    return { ok: true };
  });
}

export async function programarConta(id, { dataProgramada, formaPagamento } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const data = dataISO(dataProgramada);
  if (!data) throw erro(400, 'Informe a data programada.');
  if (!FORMAS_PAGAMENTO.includes(formaPagamento)) throw erro(400, 'Informe a forma de pagamento.');
  return emTransacao(async (conn) => {
    const c = await carregarConta(conn, id);
    if (!['aprovada', 'programada'].includes(c.situacao)) throw erro(409, 'Só contas aprovadas podem ser programadas.');
    await conn.query(`UPDATE contas_pagar SET situacao = 'programada', data_programada = ?, forma_pagamento = ?, programado_por_nome = ? WHERE id = ?`, [data, formaPagamento, usuario.nome ?? null, c.id]);
    await auditarFin(conn, usuario, {
      entidade: 'conta_pagar', entidadeId: c.id, acao: 'programacao', anterior: { situacao: c.situacao, data: c.data_programada, forma: c.forma_pagamento }, novo: { data, forma: formaPagamento },
    });
    return { ok: true, aviso: data > String(c.vencimento).slice(0, 10) ? 'Programada para depois do vencimento.' : null };
  });
}

export async function baixarConta(id, dados = {}, usuario) {
  await garantirEstruturaPagamentos();
  const data = dataISO(dados.dataPagamento);
  if (!data) throw erro(400, 'Informe a data do pagamento.');
  const juros = numero(dados.juros) ?? 0;
  const multa = numero(dados.multa) ?? 0;
  const desconto = numero(dados.desconto) ?? 0;
  const valorPago = numero(dados.valorPago);
  if ([juros, multa, desconto].some((x) => Number.isNaN(x) || x < 0)) throw erro(400, 'Juros, multa e desconto devem ser valores não negativos.');
  if (valorPago === null || Number.isNaN(valorPago) || valorPago <= 0) throw erro(400, 'Informe o valor pago.');
  const forma = dados.formaPagamento;
  if (forma && !FORMAS_PAGAMENTO.includes(forma)) throw erro(400, 'Forma de pagamento inválida.');
  const comprovante = dados.comprovante?.conteudoBase64 ? decodificarArquivo(dados.comprovante, ['pdf', 'png', 'jpg', 'jpeg']) : null;
  return emTransacao(async (conn) => {
    const c = await carregarConta(conn, id);
    if (!['aprovada', 'programada'].includes(c.situacao)) throw erro(409, 'Só contas aprovadas ou programadas podem receber baixa.');
    const esperado = r2(Number(c.valor) + juros + multa - desconto);
    if (r2(valorPago) !== esperado) {
      throw erro(400, `Valor pago (R$ ${r2(valorPago).toFixed(2)}) não confere com valor + juros + multa − desconto (R$ ${esperado.toFixed(2)}).`);
    }
    await conn.query(
      `UPDATE contas_pagar SET situacao = 'paga', data_pagamento = ?, valor_pago = ?, juros = ?, multa = ?, desconto = ?, forma_pagamento = COALESCE(?, forma_pagamento),
              baixado_por_nome = ?, baixado_em = NOW() WHERE id = ?`,
      [data, r2(valorPago), r2(juros), r2(multa), r2(desconto), forma ?? null, usuario.nome ?? null, c.id]
    );
    if (comprovante) await salvarDocumento(conn, { entidade: 'conta_pagar', entidadeId: c.id, tipo: 'comprovante', arquivo: comprovante }, usuario);
    await auditarFin(conn, usuario, {
      entidade: 'conta_pagar', entidadeId: c.id, acao: 'baixa', anterior: c.situacao,
      novo: { situacao: 'paga', data_pagamento: data, valor_pago: r2(valorPago), juros: r2(juros), multa: r2(multa), desconto: r2(desconto), comprovante: comprovante?.nome ?? null },
      motivo: texto(dados.observacao, 2000),
    });
    return { ok: true };
  });
}

export async function estornarBaixaConta(id, { motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do estorno.');
  return emTransacao(async (conn) => {
    const c = await carregarConta(conn, id);
    if (c.situacao !== 'paga') throw erro(409, 'Só contas pagas podem ter a baixa estornada.');
    await conn.query(`UPDATE contas_pagar SET situacao = 'aprovada', data_pagamento = NULL, valor_pago = NULL, juros = 0, multa = 0, desconto = 0, data_programada = NULL WHERE id = ?`, [c.id]);
    await auditarFin(conn, usuario, {
      entidade: 'conta_pagar', entidadeId: c.id, acao: 'estorno_baixa', anterior: { data_pagamento: c.data_pagamento, valor_pago: c.valor_pago }, novo: 'aprovada', motivo: mot,
    });
    return { ok: true };
  });
}

export async function cancelarConta(id, { motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do cancelamento.');
  return emTransacao(async (conn) => {
    const c = await carregarConta(conn, id);
    if (['paga', 'cancelada'].includes(c.situacao)) throw erro(409, `Conta "${c.situacao}" não pode ser cancelada${c.situacao === 'paga' ? ' (estorne a baixa antes)' : ''}.`);
    // chave_documento = NULL: o documento poderá ser lançado de novo corretamente
    await conn.query(`UPDATE contas_pagar SET situacao = 'cancelada', chave_documento = NULL, motivo_situacao = ? WHERE id = ?`, [mot, c.id]);
    await auditarFin(conn, usuario, { entidade: 'conta_pagar', entidadeId: c.id, acao: 'cancelamento', anterior: c.situacao, novo: 'cancelada', motivo: mot });
    return { ok: true };
  });
}

export async function anexarDocumentoConta(id, dados, usuario) {
  await garantirEstruturaPagamentos();
  const tipo = ['documento_fiscal', 'boleto', 'comprovante', 'outro'].includes(dados.tipo) ? dados.tipo : 'outro';
  const arquivo = decodificarArquivo(dados, ['pdf', 'xml', 'png', 'jpg', 'jpeg']);
  return emTransacao(async (conn) => {
    const c = await carregarConta(conn, id);
    if (c.situacao === 'cancelada') throw erro(409, 'Conta cancelada.');
    const docId = await salvarDocumento(conn, { entidade: 'conta_pagar', entidadeId: c.id, tipo, arquivo }, usuario);
    await auditarFin(conn, usuario, { entidade: 'conta_pagar', entidadeId: c.id, acao: 'anexo', novo: { tipo, arquivo: arquivo.nome, sha256: arquivo.sha256 } });
    return { ok: true, id: docId };
  });
}
