// ── Lotes de pagamento e arquivos de remessa ────────────────────────────────
// Leiautes cadastrados (LEIAUTES_REMESSA, chave "banco:modalidade"): Itaú SISPAG CNAB 240 (manual de
// maio/2022) para crédito em conta, TED e PIX. A remessa só é gerada com a conta pagadora do banco
// cadastrada (financeiro_contas_pagadoras). Demais bancos (Bradesco, Santander, Sicredi) e Itaú sem
// conta pagadora geram a PLANILHA DE CONFERÊNCIA (CSV) para pagamento pelo internet banking.
//
// Gerar o lote NÃO conclui pagamentos: eles ficam "em lote" até a confirmação (comprovante ou
// retorno do banco) ou a rejeição, item a item.
import crypto from 'crypto';
import { pool } from '../config/database.js';
import { r2, erro, texto, emTransacao, garantirEstruturaPagamentos, auditarFin, salvarDocumento, decodificarArquivo, dataISO } from './financeiroComum.js';
import { validarDadosBancarios, cnpjValido } from './dadosBancarios.js';
import * as itau from './bancos/itauSispag.js';
import { confirmarPagamentoConn, rejeitarPagamentoConn } from './pagamentosCooperadosRepository.js';

export const MODALIDADES = ['credito_conta', 'ted', 'pix'];

/**
 * Geradores por "banco:modalidade": { versao, validarItem(favorecido, modalidade) => problemas[],
 * gerar({ lote, itens, conta, dataPagamento }) => Buffer }.
 */
const geradorItau = { versao: itau.VERSAO, validarItem: itau.problemasItem, gerar: itau.gerarRemessa };
export const LEIAUTES_REMESSA = {
  '341:credito_conta': geradorItau,
  '341:ted': geradorItau,
  '341:pix': geradorItau,
};
/** Leitores de arquivo retorno de pagamentos por banco. */
const LEITORES_RETORNO = { '341': itau.lerRetorno };
export const BANCOS_COM_REMESSA = { '341': 'Itaú (SISPAG CNAB 240)' };

// ── Conta pagadora (dados do convênio da ATESA em cada banco) ───────────────
export async function obterContaPagadora(banco) {
  await garantirEstruturaPagamentos();
  const [[c]] = await pool.query(`SELECT * FROM financeiro_contas_pagadoras WHERE banco_codigo = ?`, [String(banco)]);
  return { conta: c ?? null, problemas: itau.BANCO === String(banco) ? itau.problemasContaPagadora(c) : [], tiposPagamento: itau.TIPOS_PAGAMENTO };
}

export async function salvarContaPagadora(banco, d = {}, usuario) {
  await garantirEstruturaPagamentos();
  const b = String(banco || '');
  if (!BANCOS_COM_REMESSA[b]) throw erro(400, 'Banco sem leiaute de remessa cadastrado.');
  const so = (v, max) => String(v ?? '').replace(/\D/g, '').slice(0, max);
  const c = {
    cnpj: so(d.cnpj, 14), razao_social: texto(d.razaoSocial, 100), agencia: so(d.agencia, 5), conta: so(d.conta, 12),
    dac: String(d.dac ?? '').trim().toUpperCase().slice(0, 2), tipo_pagamento: String(d.tipoPagamento || '20'),
    endereco: texto(d.endereco, 100), numero: texto(d.numero, 10), complemento: texto(d.complemento, 50), cidade: texto(d.cidade, 60),
    cep: so(d.cep, 8) || null, uf: texto(d.uf, 2)?.toUpperCase() ?? null,
  };
  const problemas = [...(cnpjValido(c.cnpj) ? [] : ['CNPJ inválido.']), ...itau.problemasContaPagadora(c).filter((x) => !x.startsWith('CNPJ'))];
  if (problemas.length) throw erro(400, 'Conta pagadora inválida.', { detalhes: problemas });
  return emTransacao(async (conn) => {
    const [[anterior]] = await conn.query(`SELECT * FROM financeiro_contas_pagadoras WHERE banco_codigo = ? FOR UPDATE`, [b]);
    await conn.query(
      `INSERT INTO financeiro_contas_pagadoras (banco_codigo, cnpj, razao_social, agencia, conta, dac, tipo_pagamento, endereco, numero, complemento, cidade, cep, uf, atualizado_por_nome)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE cnpj = VALUES(cnpj), razao_social = VALUES(razao_social), agencia = VALUES(agencia), conta = VALUES(conta), dac = VALUES(dac),
         tipo_pagamento = VALUES(tipo_pagamento), endereco = VALUES(endereco), numero = VALUES(numero), complemento = VALUES(complemento), cidade = VALUES(cidade),
         cep = VALUES(cep), uf = VALUES(uf), atualizado_por_nome = VALUES(atualizado_por_nome)`,
      [b, c.cnpj, c.razao_social, c.agencia, c.conta, c.dac, c.tipo_pagamento, c.endereco, c.numero, c.complemento, c.cidade, c.cep, c.uf, usuario.nome ?? null]
    );
    await auditarFin(conn, usuario, {
      entidade: 'conta_pagadora', entidadeId: Number(b), acao: anterior ? 'alteracao' : 'inclusao',
      anterior: anterior ? { agencia: anterior.agencia, conta: anterior.conta, dac: anterior.dac, cnpj: anterior.cnpj } : null,
      novo: { agencia: c.agencia, conta: c.conta, dac: c.dac, cnpj: c.cnpj, tipo_pagamento: c.tipo_pagamento },
    });
    return { ok: true };
  });
}

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
export function validarParaLote(pagamentos, { modalidade, bancoCodigo, validarItem = null }) {
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
    const especificos = validarItem ? validarItem(f, modalidade) : [];
    if (especificos.length) { problemas.push(`${rotulo}: ${especificos.join(' ')}`); continue; }
    itens.push({ pagamento_id: p.id, pagamento_codigo: p.codigo, valor: r2(p.valor_liquido), favorecido: f });
  }
  return { itens, problemas };
}

const hojeISO = () => {
  const d = new Date(Date.now() - 3 * 3600 * 1000); // horário de Brasília (servidor em UTC)
  return d.toISOString().slice(0, 10);
};

export async function criarLote({ modalidade, bancoCodigo, pagamentoIds, dataPagamento } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const dataPag = dataPagamento ? dataISO(dataPagamento) : hojeISO();
  if (!dataPag) throw erro(400, 'Data de pagamento inválida.');
  if (dataPag < hojeISO()) throw erro(400, 'A data de pagamento não pode ser anterior a hoje.');
  if (!MODALIDADES.includes(modalidade)) throw erro(400, 'Modalidade inválida (crédito em conta, TED ou PIX).');
  const banco = String(bancoCodigo || '').replace(/\D/g, '') || null;
  if (banco && banco.length !== 3) throw erro(400, 'Código do banco deve ter 3 dígitos.');
  if (modalidade === 'credito_conta' && !banco) throw erro(400, 'Informe o banco pagador para crédito em conta.');
  const ids = [...new Set((Array.isArray(pagamentoIds) ? pagamentoIds : []).map(Number).filter(Boolean))];
  if (!ids.length) throw erro(400, 'Selecione os pagamentos do lote.');
  const geradorBanco = banco ? LEIAUTES_REMESSA[`${banco}:${modalidade}`] : null;
  let conta = null;
  let avisoConta = null;
  if (geradorBanco) {
    const [[c]] = await pool.query(`SELECT * FROM financeiro_contas_pagadoras WHERE banco_codigo = ?`, [banco]);
    const problemasConta = itau.problemasContaPagadora(c);
    if (problemasConta.length) avisoConta = `Conta pagadora do banco ${banco} incompleta (${problemasConta.join(' ')}): foi gerada a planilha de conferência em vez da remessa.`;
    else conta = c;
  }
  const gerador = conta ? geradorBanco : null;
  return emTransacao(async (conn) => {
    const [pags] = await conn.query(
      `SELECT p.*, c.nome AS cooperado_nome FROM cooperado_pagamentos p JOIN ra_candidatos c ON c.id = p.candidato_id WHERE p.id IN (?) FOR UPDATE`, [ids]
    );
    if (pags.length !== ids.length) throw erro(404, 'Pagamento não encontrado.');
    for (const p of pags) p.dados_bancarios = p.dados_bancarios ? JSON.parse(p.dados_bancarios) : null;
    const { itens, problemas } = validarParaLote(pags, { modalidade, bancoCodigo: banco, validarItem: gerador?.validarItem });
    if (problemas.length) throw erro(400, 'Há pagamentos que não podem entrar no lote.', { detalhes: problemas });

    const leiaute = gerador ? `${banco}:${modalidade}:${gerador.versao}` : 'conferencia_csv';
    const total = r2(itens.reduce((s, i) => s + i.valor, 0));
    const [res] = await conn.query(
      `INSERT INTO pagamento_lotes (banco_codigo, modalidade, leiaute, total_itens, valor_total, data_pagamento, gerado_por_id, gerado_por_nome) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [banco, modalidade, leiaute, itens.length, total, dataPag, usuario.id ?? null, usuario.nome ?? null]
    );
    const loteId = res.insertId;
    const codigo = `LOTE-${String(loteId).padStart(6, '0')}`;
    const lote = { id: loteId, codigo, modalidade, banco_codigo: banco };
    try {
      for (const i of itens) {
        const [ri] = await conn.query(
          `INSERT INTO pagamento_lote_itens (lote_id, pagamento_id, chave_ativa, valor, favorecido) VALUES (?, ?, ?, ?, ?)`,
          [loteId, i.pagamento_id, i.pagamento_id, i.valor, JSON.stringify(i.favorecido)]
        );
        i.item_id = ri.insertId;
      }
    } catch (err) {
      if (err?.code === 'ER_DUP_ENTRY') throw erro(409, 'Um dos pagamentos já está em outro lote ativo.');
      throw err;
    }
    let buffer;
    if (gerador) {
      try {
        buffer = gerador.gerar({ lote, itens, conta, dataPagamento: dataPag });
      } catch (err) {
        throw erro(400, `Não foi possível montar a remessa: ${err.message}`);
      }
    } else {
      buffer = planilhaConferencia(lote, itens);
    }
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const nome = gerador ? `${codigo}.rem` : `${codigo}-conferencia.csv`;
    const docId = await salvarDocumento(conn, {
      entidade: 'lote', entidadeId: loteId, tipo: gerador ? 'remessa' : 'conferencia',
      arquivo: { nome, mime: gerador ? 'text/plain' : 'text/csv', buffer, sha256 },
    }, usuario);
    await conn.query(`UPDATE pagamento_lotes SET codigo = ?, documento_id = ?, sha256 = ? WHERE id = ?`, [codigo, docId, sha256, loteId]);
    await conn.query(`UPDATE cooperado_pagamentos SET situacao = 'em_lote' WHERE id IN (?)`, [itens.map((i) => i.pagamento_id)]);
    for (const i of itens) await auditarFin(conn, usuario, { entidade: 'pagamento', entidadeId: i.pagamento_id, acao: 'inclusao_lote', anterior: 'liberado', novo: { situacao: 'em_lote', lote: codigo } });
    await auditarFin(conn, usuario, { entidade: 'lote', entidadeId: loteId, acao: 'geracao', novo: { codigo, modalidade, banco, leiaute, itens: itens.length, total, data_pagamento: dataPag, sha256 } });
    const aviso = gerador ? null
      : avisoConta ?? 'Leiaute de remessa do banco não cadastrado: foi gerada a planilha de conferência (CSV) para pagamento manual. Nenhum pagamento foi concluído.';
    return { ok: true, id: loteId, codigo, leiaute, aviso };
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
  return emTransacao((conn) => registrarOcorrenciaItemConn(conn, itemId, { ...dados, comprovante }, usuario));
}

async function registrarOcorrenciaItemConn(conn, itemId, dados, usuario) {
  const { comprovante = null } = dados;
  {
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
  }
}

// ── Arquivo retorno de pagamentos ───────────────────────────────────────────
// Cada chamada processa os itens que couberem em ~8 s (limite de 15 s da Vercel). A tela repete o envio
// do mesmo arquivo enquanto houver "restantes": itens já tratados deixam de estar "incluido" e são pulados.
const ORCAMENTO_MS = 8000;

export async function importarRetornoPagamentos({ arquivo } = {}, usuario) {
  await garantirEstruturaPagamentos();
  const doc = decodificarArquivo(arquivo, ['ret', 'txt']);
  const banco = doc.buffer.subarray(0, 3).toString('latin1');
  const ler = LEITORES_RETORNO[banco];
  if (!ler) throw erro(400, `Leitura de retorno não disponível para o banco ${banco || '?'} (disponível: Itaú 341).`);
  const r = ler(doc.buffer);
  if (r.erros?.length && !r.pagamentos?.length) throw erro(400, 'Arquivo retorno inválido.', { detalhes: r.erros });

  const avisos = [...(r.erros ?? [])];
  const [[cp]] = await pool.query(`SELECT * FROM financeiro_contas_pagadoras WHERE banco_codigo = ?`, [banco]);
  if (cp && (r.cabecalho.cnpj !== cp.cnpj.padStart(14, '0') || Number(r.cabecalho.conta) !== Number(cp.conta))) {
    avisos.push(`O retorno é da conta ${Number(r.cabecalho.agencia)}/${Number(r.cabecalho.conta)}-${r.cabecalho.dac} (CNPJ ${r.cabecalho.cnpj}), diferente da conta pagadora cadastrada.`);
  }
  for (const l of r.lotes) {
    const erros = l.ocorrencias.filter((o) => !['00', 'BD'].includes(o.codigo));
    if (erros.length) avisos.push(`Lote ${l.lote} do arquivo: ${erros.map((o) => `${o.codigo} ${o.descricao}`).join('; ')}`);
  }

  const ids = [...new Set(r.pagamentos.map((p) => p.ref?.itemId).filter(Boolean))];
  const [itens] = ids.length
    ? await pool.query(
      `SELECT i.*, l.banco_codigo, l.situacao AS lote_situacao, l.codigo AS lote_codigo, c.nome AS cooperado_nome
         FROM pagamento_lote_itens i JOIN pagamento_lotes l ON l.id = i.lote_id
         JOIN cooperado_pagamentos p ON p.id = i.pagamento_id JOIN ra_candidatos c ON c.id = p.candidato_id
        WHERE i.id IN (?)`, [ids])
    : [[]];
  const porId = new Map(itens.map((i) => [i.id, i]));

  const resumo = { total: r.pagamentos.length, pagos: 0, rejeitados: 0, agendados: 0, jaTratados: 0, naoEncontrados: 0, restantes: 0 };
  const lotesAfetados = new Set();
  const inicio = Date.now();
  for (const p of r.pagamentos) {
    const item = p.ref ? porId.get(p.ref.itemId) : null;
    if (!item || item.lote_id !== p.ref.loteId || item.banco_codigo !== banco) {
      resumo.naoEncontrados += 1;
      avisos.push(`"${p.seuNumero || 'sem seu número'}" (${p.favorecido}, R$ ${p.valor.toFixed(2)}): não corresponde a um item de lote do sistema.`);
      continue;
    }
    const rotulo = `${item.lote_codigo} · ${item.cooperado_nome}`;
    const textoOc = p.ocorrencias.map((o) => `${o.codigo} ${o.descricao}`).join('; ');
    if (item.situacao !== 'incluido' || item.lote_situacao === 'cancelado') {
      resumo.jaTratados += 1;
      if (p.resultado === 'devolvido' && item.situacao === 'confirmado') {
        avisos.push(`${rotulo}: ${textoOc}. O pagamento já estava confirmado — trate a devolução manualmente.`);
      }
      continue;
    }
    if (p.resultado === 'aguardando') {
      if (item.ocorrencia_codigo !== p.ocorrencias[0]?.codigo) {
        await pool.query(`UPDATE pagamento_lote_itens SET ocorrencia_codigo = ?, ocorrencia_descricao = ? WHERE id = ? AND situacao = 'incluido'`,
          [p.ocorrencias.map((o) => o.codigo).join(' ').slice(0, 20) || null, textoOc.slice(0, 300) || 'Recebido pelo banco', item.id]);
      }
      resumo.agendados += 1;
      lotesAfetados.add(item.lote_id);
      continue;
    }
    if (Date.now() - inicio > ORCAMENTO_MS) { resumo.restantes += 1; continue; }
    const codigos = p.ocorrencias.map((o) => o.codigo).join(' ').slice(0, 20);
    try {
      if (p.resultado === 'pago') {
        if (p.valorEfetivo > 0 && Math.abs(p.valorEfetivo - Number(item.valor)) > 0.005) {
          avisos.push(`${rotulo}: valor efetivado R$ ${p.valorEfetivo.toFixed(2)} diferente do lote (R$ ${Number(item.valor).toFixed(2)}).`);
        }
        await emTransacao((conn) => registrarOcorrenciaItemConn(conn, item.id, {
          situacao: 'confirmado', dataPagamento: p.dataEfetiva || p.dataPrevista || hojeISO(), codigo: codigos,
          descricao: `Retorno ${doc.nome}: ${textoOc}${p.nossoNumero ? ` (nosso número ${p.nossoNumero})` : ''}`,
        }, usuario));
        resumo.pagos += 1;
      } else {
        await emTransacao((conn) => registrarOcorrenciaItemConn(conn, item.id, {
          situacao: 'rejeitado', codigo: codigos, descricao: `Retorno ${doc.nome}: ${textoOc}`,
        }, usuario));
        resumo.rejeitados += 1;
      }
      lotesAfetados.add(item.lote_id);
    } catch (err) {
      avisos.push(`${rotulo}: não foi possível registrar (${err.message}).`);
    }
  }

  // Lote "gerado" com retorno do banco: o arquivo foi enviado.
  if (lotesAfetados.size) {
    await pool.query(`UPDATE pagamento_lotes SET situacao = 'enviado', enviado_por_nome = ?, enviado_em = NOW() WHERE id IN (?) AND situacao = 'gerado'`,
      [`${usuario.nome ?? ''} (retorno)`.trim(), [...lotesAfetados]]);
  }
  // Guarda o arquivo uma vez (pelo hash) e registra a importação nos lotes afetados.
  const [[jaSalvo]] = await pool.query(`SELECT id FROM financeiro_documentos WHERE entidade = 'retorno_pagamento' AND sha256 = ? LIMIT 1`, [doc.sha256]);
  if (!jaSalvo && lotesAfetados.size) {
    await emTransacao(async (conn) => {
      const primeiro = [...lotesAfetados][0];
      await salvarDocumento(conn, { entidade: 'retorno_pagamento', entidadeId: primeiro, tipo: 'retorno', arquivo: doc }, usuario);
      for (const loteId of lotesAfetados) {
        await auditarFin(conn, usuario, { entidade: 'lote', entidadeId: loteId, acao: 'importacao_retorno', novo: { arquivo: doc.nome, sha256: doc.sha256, banco } });
      }
    });
  }
  return { ok: true, banco, arquivo: doc.nome, ...resumo, avisos: [...new Set(avisos)].slice(0, 200) };
}
