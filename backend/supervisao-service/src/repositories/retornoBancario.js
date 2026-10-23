// ── Leitura e validação de arquivos de retorno bancário (funções puras) ──────
// • CNAB 240 / CNAB 400: valida a estrutura geral FEBRABAN (tamanho das linhas, header/trailer,
//   arquivo de retorno, banco, contagem/sequência de registros). A leitura dos registros de
//   detalhe depende do leiaute de cada banco: o parser só é habilitado em LEIAUTES_BANCO quando
//   a ATESA fornecer o leiaute do banco priorizado. Sem ele, o arquivo é recusado (não adivinhamos posições).
// • CSV padrão do sistema: planilha simples (modelo para download) enquanto os leiautes não chegam.
import { dataISO, numero, r2 } from './financeiroComum.js';

/**
 * Parsers de detalhe por banco e leiaute: { '341': { cnab240: (linhas) => registros } }.
 * Vazio de propósito: aguardando os leiautes fornecidos pela ATESA.
 */
export const LEIAUTES_BANCO = {};

export const COLUNAS_CSV = {
  obrigatorias: ['identificador', 'data_pagamento', 'valor_pago'],
  opcionais: ['banco', 'data_credito', 'juros', 'desconto', 'pagador_nome', 'pagador_documento'],
};

function falha(erros, layout = null, banco = null) {
  return { ok: false, layout, banco_codigo: banco, registros: [], erros };
}

function linhasDoArquivo(buffer) {
  let txt = buffer.toString('latin1');
  if (txt.charCodeAt(0) === 0xef && txt.charCodeAt(1) === 0xbb && txt.charCodeAt(2) === 0xbf) txt = txt.slice(3);
  const linhas = txt.split(/\r?\n/);
  while (linhas.length && linhas[linhas.length - 1].trim() === '') linhas.pop();
  return linhas;
}

function dividirCsv(linha, sep) {
  const campos = [];
  let atual = '';
  let aspas = false;
  for (let i = 0; i < linha.length; i++) {
    const ch = linha[i];
    if (ch === '"') {
      if (aspas && linha[i + 1] === '"') { atual += '"'; i++; } else aspas = !aspas;
    } else if (ch === sep && !aspas) { campos.push(atual); atual = ''; } else atual += ch;
  }
  campos.push(atual);
  return campos.map((c) => c.trim());
}

const normalizarCabecalho = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

export function lerCsvPadrao(linhas, bancoPadrao = null) {
  if (linhas.length < 2) return falha(['A planilha não tem linhas de pagamento.'], 'csv');
  const sep = linhas[0].includes(';') ? ';' : ',';
  const cab = dividirCsv(linhas[0], sep).map(normalizarCabecalho);
  const faltando = COLUNAS_CSV.obrigatorias.filter((c) => !cab.includes(c));
  if (faltando.length) return falha([`Colunas obrigatórias ausentes: ${faltando.join(', ')}. Use a planilha modelo.`], 'csv');
  const idx = Object.fromEntries(cab.map((c, i) => [c, i]));
  const erros = [];
  const registros = [];
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i].trim() === '') continue;
    const n = i + 1;
    const c = dividirCsv(linhas[i], sep);
    const get = (k) => (idx[k] === undefined ? '' : c[idx[k]] ?? '');
    const identificador = get('identificador').replace(/\s+/g, '');
    const dataPag = dataISO(get('data_pagamento'));
    const valor = numero(get('valor_pago'));
    const dataCred = get('data_credito') ? dataISO(get('data_credito')) : null;
    const juros = numero(get('juros'));
    const desconto = numero(get('desconto'));
    const banco = get('banco').replace(/\D/g, '') || bancoPadrao;
    if (!identificador) erros.push(`Linha ${n}: identificador (nosso número ou código da cobrança) vazio.`);
    if (!dataPag) erros.push(`Linha ${n}: data de pagamento inválida ("${get('data_pagamento')}").`);
    if (valor === null || Number.isNaN(valor) || valor <= 0) erros.push(`Linha ${n}: valor pago inválido ("${get('valor_pago')}").`);
    if (get('data_credito') && !dataCred) erros.push(`Linha ${n}: data de crédito inválida.`);
    if (Number.isNaN(juros) || Number.isNaN(desconto)) erros.push(`Linha ${n}: juros/desconto inválido.`);
    if (banco && banco.length !== 3) erros.push(`Linha ${n}: código do banco deve ter 3 dígitos.`);
    registros.push({
      linha_numero: n, identificador: identificador.slice(0, 50), banco_codigo: banco || null,
      data_pagamento: dataPag, data_credito: dataCred, valor_pago: r2(valor), juros: r2(juros ?? 0), desconto: r2(desconto ?? 0),
      pagador_nome: get('pagador_nome').slice(0, 200) || null, pagador_documento: get('pagador_documento').replace(/\D/g, '').slice(0, 14) || null,
    });
  }
  if (!registros.length) erros.push('A planilha não tem linhas de pagamento.');
  if (erros.length) return falha(erros.slice(0, 50).concat(erros.length > 50 ? [`... e mais ${erros.length - 50} erro(s).`] : []), 'csv');
  return { ok: true, layout: 'csv', banco_codigo: bancoPadrao, registros, erros: [] };
}

export function validarCnab240(linhas) {
  const erros = [];
  const h = linhas[0];
  const t = linhas[linhas.length - 1];
  const banco = h.slice(0, 3);
  if (!/^\d{3}$/.test(banco)) erros.push('Header: código do banco inválido (posições 1-3).');
  if (h.slice(3, 7) !== '0000' || h[7] !== '0') erros.push('Primeira linha não é um header de arquivo CNAB 240.');
  if (h[142] !== '2') erros.push(h[142] === '1' ? 'O arquivo é de REMESSA, não de retorno.' : 'Header não identifica arquivo de retorno (posição 143).');
  if (t.slice(3, 7) !== '9999' || t[7] !== '9') erros.push('Última linha não é um trailer de arquivo CNAB 240.');
  linhas.forEach((l, i) => { if (l.slice(0, 3) !== banco) erros.push(`Linha ${i + 1}: banco diferente do header.`); });
  const qtd = Number(t.slice(23, 29));
  if (Number.isFinite(qtd) && qtd !== linhas.length) erros.push(`Trailer informa ${qtd} registros, mas o arquivo tem ${linhas.length}.`);
  return { banco, erros };
}

export function validarCnab400(linhas) {
  const erros = [];
  const h = linhas[0];
  const t = linhas[linhas.length - 1];
  const banco = h.slice(76, 79);
  if (h[0] !== '0') erros.push('Primeira linha não é um header CNAB 400.');
  if (h[1] !== '2' || h.slice(2, 9).toUpperCase() !== 'RETORNO') {
    erros.push(h[1] === '1' ? 'O arquivo é de REMESSA, não de retorno.' : 'Header não identifica arquivo de retorno.');
  }
  if (!/^\d{3}$/.test(banco)) erros.push('Header: código do banco inválido (posições 77-79).');
  if (t[0] !== '9') erros.push('Última linha não é um trailer CNAB 400.');
  linhas.forEach((l, i) => {
    if (Number(l.slice(394, 400)) !== i + 1) erros.push(`Linha ${i + 1}: número sequencial do registro fora de ordem.`);
  });
  return { banco, erros };
}

/** Identifica o leiaute, valida e devolve os registros de pagamento. */
export function analisarArquivoRetorno(buffer, { bancoPadrao = null } = {}) {
  const linhas = linhasDoArquivo(buffer);
  if (!linhas.length) return falha(['Arquivo vazio.']);
  const tamanhos = new Set(linhas.map((l) => l.length));
  const pareceCsv = /[;,]/.test(linhas[0]) && /identificador/i.test(linhas[0]);
  if (pareceCsv) return lerCsvPadrao(linhas, bancoPadrao);

  let layout = null;
  if (tamanhos.size === 1 && tamanhos.has(240)) layout = 'cnab240';
  else if (tamanhos.size === 1 && tamanhos.has(400)) layout = 'cnab400';
  else return falha([`Formato não reconhecido: linhas com ${[...tamanhos].slice(0, 5).join(', ')} caracteres (CNAB 240/400 exige tamanho fixo) e sem o cabeçalho da planilha padrão.`]);
  if (linhas.length < 2) return falha(['Arquivo sem header e trailer.'], layout);

  const { banco, erros } = layout === 'cnab240' ? validarCnab240(linhas) : validarCnab400(linhas);
  if (erros.length) return falha(erros.slice(0, 50), layout, banco);
  const parser = LEIAUTES_BANCO[banco]?.[layout];
  if (!parser) {
    return falha([`Leiaute ${layout.toUpperCase()} do banco ${banco} ainda não cadastrado no sistema. Envie o leiaute oficial do banco para habilitar a importação; enquanto isso, use a planilha padrão (CSV).`], layout, banco);
  }
  const registros = parser(linhas);
  return { ok: true, layout, banco_codigo: banco, registros, erros: [] };
}

/**
 * Classifica cada pagamento do arquivo em relação às cobranças:
 * integral / parcial / a_maior / nao_identificado / cobranca_cancelada / ja_quitada / duplicado.
 * `cobrancas`: lista com id, codigo, banco_codigo, nosso_numero, valor, valor_recebido, status.
 * `jaRecebidos`: recebimentos ativos existentes { identificador, data_pagamento, valor }.
 */
export function classificarPagamentos(registros, cobrancas, jaRecebidos = []) {
  const semZeros = (s) => String(s ?? '').trim().replace(/^0+(?=\d)/, '').toUpperCase();
  const porCodigo = new Map(cobrancas.filter((c) => c.codigo).map((c) => [String(c.codigo).toUpperCase(), c]));
  const porNossoNumero = new Map();
  for (const c of cobrancas) {
    if (!c.nosso_numero) continue;
    const k = semZeros(c.nosso_numero);
    if (!porNossoNumero.has(k)) porNossoNumero.set(k, []);
    porNossoNumero.get(k).push(c);
  }
  const chaveDup = (ident, data, valor) => `${semZeros(ident)}|${data}|${r2(valor).toFixed(2)}`;
  const existentes = new Set(jaRecebidos.map((r) => chaveDup(r.identificador, String(r.data_pagamento).slice(0, 10), r.valor)));
  const vistos = new Set();
  const consumido = new Map(); // cobrança → valor já consumido por linhas anteriores do mesmo arquivo

  return registros.map((reg) => {
    const out = { ...reg, cobranca_id: null, classificacao: 'nao_identificado', mensagem: null };
    const dup = chaveDup(reg.identificador, reg.data_pagamento, reg.valor_pago);
    if (existentes.has(dup)) return { ...out, classificacao: 'duplicado', mensagem: 'Pagamento já registrado anteriormente (mesmo identificador, data e valor).' };
    if (vistos.has(dup)) return { ...out, classificacao: 'duplicado', mensagem: 'Pagamento repetido no próprio arquivo.' };
    vistos.add(dup);

    let cob = porCodigo.get(String(reg.identificador).toUpperCase()) || null;
    if (!cob) {
      let lista = porNossoNumero.get(semZeros(reg.identificador)) || [];
      if (reg.banco_codigo) lista = lista.filter((c) => c.banco_codigo === reg.banco_codigo);
      if (lista.length > 1) return { ...out, mensagem: `Nosso número corresponde a ${lista.length} cobranças de bancos diferentes; vincule manualmente.` };
      cob = lista[0] || null;
    }
    if (!cob) return { ...out, mensagem: 'Nenhuma cobrança com este nosso número / código.' };
    out.cobranca_id = cob.id;
    if (cob.status === 'cancelada') return { ...out, classificacao: 'cobranca_cancelada', mensagem: `Cobrança ${cob.codigo} está cancelada.` };
    const saldo = r2(Number(cob.valor) - Number(cob.valor_recebido) - (consumido.get(cob.id) || 0));
    if (saldo <= 0) return { ...out, classificacao: 'ja_quitada', mensagem: `Cobrança ${cob.codigo} já está quitada.` };
    consumido.set(cob.id, r2((consumido.get(cob.id) || 0) + reg.valor_pago));
    if (r2(reg.valor_pago) === saldo) return { ...out, classificacao: 'integral' };
    if (reg.valor_pago < saldo) return { ...out, classificacao: 'parcial', mensagem: `Pagamento parcial: saldo de R$ ${r2(saldo - reg.valor_pago).toFixed(2)}.` };
    return { ...out, classificacao: 'a_maior', mensagem: `Valor R$ ${r2(reg.valor_pago - saldo).toFixed(2)} acima do saldo da cobrança.` };
  });
}
