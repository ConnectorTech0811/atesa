// ── Lotes de pagamento e arquivos de remessa ────────────────────────────────
// Nenhum leiaute bancário foi fornecido pela ATESA: LEIAUTES_REMESSA está vazio de propósito.
// Sem leiaute, o lote gera apenas a PLANILHA DE CONFERÊNCIA (CSV) para pagamento pelo internet
// banking, nunca um arquivo "parecido" com CNAB. Quando o leiaute/versão oficial do banco e a
// modalidade forem confirmados, o gerador é registrado aqui (chave "banco:modalidade").
//
// Gerar o lote NÃO conclui pagamentos: eles ficam "em lote" até a confirmação (comprovante ou
// retorno do banco) ou a rejeição, item a item.
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { r2, erro, texto, emTransacao, garantirEstruturaPagamentos, auditarFin, salvarDocumento, decodificarArquivo } from './financeiroComum.js';
import { validarDadosBancarios } from './dadosBancarios.js';
import { confirmarPagamentoConn, rejeitarPagamentoConn } from './pagamentosCooperadosRepository.js';

export const MODALIDADES = ['credito_conta', 'ted', 'pix'];

/** Geradores por "banco:modalidade": { versao, gerar(lote, itens) => Buffer }. Aguardando leiautes oficiais. */
export const LEIAUTES_REMESSA = {};

const csvCampo = (v) => {
  const s = String(v ?? '');
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export function planilhaConferencia(lote, itens) {
  const cab = ['lote', 'pagamento', 'favorecido', 'cpf', 'modalidade', 'banco', 'agencia', 'conta', 'digito', 'tipo_conta', 'chave_pix', 'tipo_pix', 'valor'];
  const linhas = itens.map((i) => {
    const f = i.favorecido;
    return [lote.codigo, i.pagamento_codigo, f.titular_nome, f.titular_documento, lote.modalidade, f.codigo_banco, f.agencia, f.conta, f.digito, f.tipo_conta,
      lote.modalidade === 'pix' ? f.chave_pix : '', lote.modalidade === 'pix' ? f.tipo_pix : '', r2(i.valor).toFixed(2).replace('.', ',')];
  });
  const total = r2(itens.reduce((s, i) => s + Number(i.valor), 0)).toFixed(2).replace('.', ',');
  const corpo = [
    '# PLANILHA DE CONFERÊNCIA — não é arquivo de remessa bancária (leiaute do banco não cadastrado)',
    cab.join(';'),
    ...linhas.map((l) => l.map(csvCampo).join(';')),
    `TOTAL;;;;;;;;;;;;${total}`,
  ].join('\r\n');
  return Buffer.from(`﻿${corpo}\r\n`, 'utf8');
}

/** Valida os pagamentos para a modalidade/banco (sem gravar). Devolve itens válidos e problemas. */
export function validarParaLote(pagamentos, { modalidade, bancoCodigo }) {
  const problemas = [];
  const itens = [];
  for (const p of pagamentos) {
    const rotulo = `${p.codigo} (${p.cooperado_nome})`;
    if (p.situacao !== 'liberado') { problemas.push(`${rotulo}: pagamento "${p.situacao}", não liberado.`); continue; }
    if (!(Number(p.valor_liquido) > 0)) { problemas.push(`${rotulo}: valor líquido inválido.`); continue; }
    const f = p.dados_bancarios;
    const v = validarDadosBancarios(f, modalidade, f?.titular_documento);
    if (!v.valido) { problemas.push(`${rotulo}: ${v.problemas.join(' ')}`); continue; }
    if (modalidade === 'credito_conta' && bancoCodigo && f.codigo_banco !== bancoCodigo) {
      problemas.push(`${rotulo}: crédito em conta exige conta no banco ${bancoCodigo} (favorecido: ${f.codigo_banco}).`);
      continue;
    }
    itens.push({ pagamento_id: p.id, pagamento_codigo: p.codigo, valor: r2(p.valor_liquido), favorecido: f });
  }
  return { itens, problemas };
}

export async function criarLote({ modalidade, bancoCodigo, pagamentoIds } = {}, usuario) {
  await garantirEstruturaPagamentos();
  if (!MODALIDADES.includes(modalidade)) throw erro(400, 'Modalidade inválida (crédito em conta, TED ou PIX).');
  const banco = String(bancoCodigo || '').replace(/\D/g, '') || null;
  if (banco && banco.length !== 3) throw erro(400, 'Código do banco deve ter 3 dígitos.');
  if (modalidade === 'credito_conta' && !banco) throw erro(400, 'Informe o banco pagador para crédito em conta.');
  const ids = [...new Set((Array.isArray(pagamentoIds) ? pagamentoIds : []).map(Number).filter(Boolean))];
  if (!ids.length) throw erro(400, 'Selecione os pagamentos do lote.');
  return emTransacao(async (conn) => {
    const [pags] = await conn.query(
      `SELECT p.*, c.nome AS cooperado_nome FROM cooperado_pagamentos p JOIN ra_candidatos c ON c.id = p.candidato_id WHERE p.id IN (?) FOR UPDATE`, [ids]
    );
    if (pags.length !== ids.length) throw erro(404, 'Pagamento não encontrado.');
    for (const p of pags) p.dados_bancarios = p.dados_bancarios ? JSON.parse(p.dados_bancarios) : null;
    const { itens, problemas } = validarParaLote(pags, { modalidade, bancoCodigo: banco });
    if (problemas.length) throw erro(400, 'Há pagamentos que não podem entrar no lote.', { detalhes: problemas });

    const gerador = banco ? LEIAUTES_REMESSA[`${banco}:${modalidade}`] : null;
    const leiaute = gerador ? `${banco}:${modalidade}:${gerador.versao}` : 'conferencia_csv';
    const total = r2(itens.reduce((s, i) => s + i.valor, 0));
    const [res] = await conn.query(
      `INSERT INTO pagamento_lotes (banco_codigo, modalidade, leiaute, total_itens, valor_total, gerado_por_id, gerado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [banco, modalidade, leiaute, itens.length, total, usuario.id ?? null, usuario.nome ?? null]
    );
    const loteId = res.insertId;
    const codigo = `LOTE-${String(loteId).padStart(6, '0')}`;
    const lote = { id: loteId, codigo, modalidade, banco_codigo: banco };
    try {
      for (const i of itens) {
        await conn.query(
          `INSERT INTO pagamento_lote_itens (lote_id, pagamento_id, chave_ativa, valor, favorecido) VALUES (?, ?, ?, ?, ?)`,
          [loteId, i.pagamento_id, i.pagamento_id, i.valor, JSON.stringify(i.favorecido)]
        );
      }
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Um dos pagamentos já está em outro lote ativo.');
      throw err;
    }
    const buffer = gerador ? gerador.gerar(lote, itens) : planilhaConferencia(lote, itens);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const nome = gerador ? `${codigo}.rem` : `${codigo}-conferencia.csv`;
    const docId = await salvarDocumento(conn, {
      entidade: 'lote', entidadeId: loteId, tipo: gerador ? 'remessa' : 'conferencia',
      arquivo: { nome, mime: gerador ? 'text/plain' : 'text/csv', buffer, sha256 },
    }, usuario);
    await conn.query(`UPDATE pagamento_lotes SET codigo = ?, documento_id = ?, sha256 = ? WHERE id = ?`, [codigo, docId, sha256, loteId]);
    await conn.query(`UPDATE cooperado_pagamentos SET situacao = 'em_lote' WHERE id IN (?)`, [itens.map((i) => i.pagamento_id)]);
    for (const i of itens) await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: i.pagamento_id, acao: 'inclusao_lote', anterior: 'liberado', novo: { situacao: 'em_lote', lote: codigo } });
    await auditarFin(conn, usuario, { entidade: 'lote', entidadeId: loteId, acao: 'geracao', novo: { codigo, modalidade, banco, leiaute, itens: itens.length, total, sha256 } });
    return { ok: true, id: loteId, codigo, leiaute, aviso: gerador ? null : 'Leiaute de remessa do banco não cadastrado: foi gerada a planilha de conferência (CSV) para pagamento manual. Nenhum pagamento foi concluído.' };
  });
}

export async function listarLotes() {
  await garantirEstruturaPagamentos();
  const [rows] = await pool.query(
    `SELECT l.*, SUM(i.situacao = 'incluido') AS itens_pendentes, SUM(i.situacao = 'confirmado') AS itens_confirmados, SUM(i.situacao = 'rejeitado') AS itens_rejeitados
       FROM pagamento_lotes l LEFT JOIN pagamento_lote_itens i ON i.lote_id = l.id GROUP BY l.id ORDER BY l.gerado_em DESC, l.id DESC LIMIT 200`
  );
  return rows;
}

export async function obterLote(id) {
  await garantirEstruturaPagamentos();
  const [[l]] = await pool.query(`SELECT * FROM pagamento_lotes WHERE id = ?`, [Number(id)]);
  if (!l) throw erro(404, 'Lote não encontrado.');
  const [itens] = await pool.query(
    `SELECT i.*, p.codigo AS pagamento_codigo, p.situacao AS pagamento_situacao, c.nome AS cooperado_nome
       FROM pagamento_lote_itens i JOIN cooperado_pagamentos p ON p.id = i.pagamento_id JOIN ra_candidatos c ON c.id = p.candidato_id
      WHERE i.lote_id = ? ORDER BY c.nome`, [l.id]
  );
  return { lote: l, itens: itens.map((i) => ({ ...i, favorecido: JSON.parse(i.favorecido) })) };
}

async function carregarLote(conn, id) {
  const [[l]] = await conn.query(`SELECT * FROM pagamento_lotes WHERE id = ? FOR UPDATE`, [Number(id)]);
  if (!l) throw erro(404, 'Lote não encontrado.');
  return l;
}

/** Registra que o arquivo foi enviado/usado no banco. Não altera a situação dos pagamentos. */
export async function marcarLoteEnviado(id, usuario) {
  await garantirEstruturaPagamentos();
  return emTransacao(async (conn) => {
    const l = await carregarLote(conn, id);
    if (l.situacao !== 'gerado') throw erro(409, `O lote está "${l.situacao}".`);
    await conn.query(`UPDATE pagamento_lotes SET situacao = 'enviado', enviado_por_nome = ?, enviado_em = NOW() WHERE id = ?`, [usuario.nome ?? null, l.id]);
    await auditarFin(conn, usuario, { entidade: 'lote', entidadeId: l.id, acao: 'envio', anterior: 'gerado', novo: 'enviado' });
    return { ok: true };
  });
}

export async function cancelarLote(id, { motivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const mot = texto(motivo, 2000);
  if (!mot) throw erro(400, 'Informe o motivo do cancelamento.');
  return emTransacao(async (conn) => {
    const l = await carregarLote(conn, id);
    if (!['gerado', 'enviado'].includes(l.situacao)) throw erro(409, `O lote está "${l.situacao}".`);
    const [itens] = await conn.query(`SELECT * FROM pagamento_lote_itens WHERE lote_id = ?`, [l.id]);
    if (itens.some((i) => i.situacao !== 'incluido')) throw erro(409, 'O lote já tem itens confirmados ou rejeitados; trate os restantes item a item.');
    await conn.query(`UPDATE pagamento_lote_itens SET situacao = 'removido', chave_ativa = NULL, atualizado_por_nome = ? WHERE lote_id = ?`, [usuario.nome ?? null, l.id]);
    await conn.query(`UPDATE cooperado_pagamentos SET situacao = 'liberado' WHERE id IN (?) AND situacao = 'em_lote'`, [itens.map((i) => i.pagamento_id)]);
    await conn.query(`UPDATE pagamento_lotes SET situacao = 'cancelado', motivo_cancelamento = ? WHERE id = ?`, [mot, l.id]);
    for (const i of itens) await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: i.pagamento_id, acao: 'remocao_lote', anterior: 'em_lote', novo: 'liberado', motivo: mot });
    await auditarFin(conn, usuario, { entidade: 'lote', entidadeId: l.id, acao: 'cancelamento', anterior: l.situacao, novo: 'cancelado', motivo: l.situacao === 'enviado' ? `${mot} (lote já enviado: confirme no banco que nada foi pago)` : mot });
    return { ok: true };
  });
}

/** Confirmação ou rejeição de um item (comprovante, extrato ou retorno do banco). */
export async function registrarOcorrenciaItem(itemId, dados = {}, usuario) {
  await garantirEstruturaPagamentos();
  if (!['confirmado', 'rejeitado'].includes(dados.situacao)) throw erro(400, 'Informe se o item foi pago (confirmado) ou rejeitado.');
  const comprovante = dados.comprovante?.conteudoBase64 ? decodificarArquivo(dados.comprovante, ['pdf', 'png', 'jpg', 'jpeg']) : null;
  return emTransacao(async (conn) => {
    const [[i]] = await conn.query(`SELECT * FROM pagamento_lote_itens WHERE id = ? FOR UPDATE`, [Number(itemId)]);
    if (!i) throw erro(404, 'Item não encontrado.');
    if (i.situacao !== 'incluido') throw erro(409, `O item já está "${i.situacao}".`);
    const l = await carregarLote(conn, i.lote_id);
    if (l.situacao === 'cancelado') throw erro(409, 'Lote cancelado.');
    if (dados.situacao === 'confirmado') {
      await confirmarPagamentoConn(conn, i.pagamento_id, { dataPagamento: dados.dataPagamento, motivo: dados.descricao, comprovante }, usuario);
    } else {
      await rejeitarPagamentoConn(conn, i.pagamento_id, { codigo: dados.codigo, descricao: dados.descricao }, usuario);
    }
    await conn.query(
      `UPDATE pagamento_lote_itens SET situacao = ?, chave_ativa = NULL, ocorrencia_codigo = ?, ocorrencia_descricao = ?, atualizado_por_nome = ? WHERE id = ?`,
      [dados.situacao, texto(dados.codigo, 20), texto(dados.descricao, 300), usuario.nome ?? null, i.id]
    );
    const [[{ restantes }]] = await conn.query(`SELECT COUNT(*) AS restantes FROM pagamento_lote_itens WHERE lote_id = ? AND situacao = 'incluido'`, [l.id]);
    if (Number(restantes) === 0) {
      await conn.query(`UPDATE pagamento_lotes SET situacao = 'processado' WHERE id = ?`, [l.id]);
      await auditarFin(conn, usuario, { entidade: 'lote', entidadeId: l.id, acao: 'processado', anterior: l.situacao, novo: 'processado' });
    }
    await auditarFin(conn, usuario, { entidade: 'lote', entidadeId: l.id, acao: `item_${dados.situacao}`, campo: `pagamento#${i.pagamento_id}`, novo: { codigo: dados.codigo ?? null, descricao: dados.descricao ?? null } });
    return { ok: true };
  });
}
