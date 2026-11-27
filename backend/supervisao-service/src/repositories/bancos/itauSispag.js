// ── Itaú — SISPAG CNAB 240 (Manual Técnico SISPAG, maio/2022) ──────────────
// Remessa de pagamentos a cooperados e leitura do arquivo retorno. Funções puras (sem banco de dados).
// Leiaute do arquivo 080, leiaute do lote 040 (cheque, OP, DOC, TED, PIX Transferência e crédito em conta).
// Formas usadas: 01 crédito em conta corrente no Itaú, 05 crédito em poupança no Itaú, 41 TED outro titular,
// 45 PIX Transferência (modelo "chave", segmento B obrigatório). Lotes PIX vão em arquivo separado (exigência do Itaú).

export const BANCO = '341';
export const VERSAO = 'SISPAG-080';
export const TIPOS_PAGAMENTO = { '20': 'Fornecedores', '98': 'Diversos' };

const so = (v) => String(v ?? '').replace(/\D/g, '');

/** Alfanumérico: maiúsculo, sem acento/caractere especial, alinhado à esquerda com brancos. */
export function alfa(v, tam) {
  const s = String(v ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/[^A-Z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  return s.slice(0, tam).padEnd(tam, ' ');
}
/** Texto livre (chave PIX): só garante ASCII e tamanho, sem mudar maiúsculas. */
const livre = (v, tam) => String(v ?? '').replace(/[^\x20-\x7e]/g, '').slice(0, tam).padEnd(tam, ' ');
/** Numérico: alinhado à direita com zeros. Recusa valor que não cabe (não trunca). */
export function num(v, tam) {
  const s = so(v);
  if (s.length > tam) throw new Error(`Valor "${v}" não cabe em ${tam} posições.`);
  return s.padStart(tam, '0');
}
const brancos = (n) => ' '.repeat(n);
const zeros = (n) => '0'.repeat(n);
const centavos = (valor, tam) => num(String(Math.round(Number(valor) * 100)), tam);
const dataDDMMAAAA = (iso) => { const [a, m, d] = String(iso).split('-'); return `${d}${m}${a}`; };

function linha(partes) {
  const l = partes.join('');
  if (l.length !== 240) throw new Error(`Registro com ${l.length} posições (esperado 240).`);
  return l;
}

/** Problemas da conta pagadora (cadastro da ATESA no Itaú). */
export function problemasContaPagadora(c) {
  const p = [];
  if (!c) return ['Conta pagadora do Itaú não cadastrada.'];
  if (so(c.cnpj).length !== 14) p.push('CNPJ da empresa pagadora inválido.');
  if (!String(c.razao_social ?? '').trim()) p.push('Nome da empresa pagadora não informado.');
  if (!/^\d{1,4}$/.test(so(c.agencia))) p.push('Agência pagadora inválida (até 4 dígitos, sem o dígito).');
  if (!/^\d{1,6}$/.test(so(c.conta))) p.push('Conta pagadora inválida (até 6 dígitos, sem o dígito).');
  if (!/^\d$/.test(String(c.dac ?? '').trim())) p.push('Dígito (DAC) da conta pagadora inválido.');
  if (!TIPOS_PAGAMENTO[c.tipo_pagamento]) p.push('Tipo de pagamento SISPAG inválido.');
  return p;
}

/** Validações do leiaute do Itaú, além das regras gerais de dados bancários. */
export function problemasItem(f, modalidade) {
  const p = [];
  if (so(f.titular_documento).length !== 11 && so(f.titular_documento).length !== 14) p.push('CPF/CNPJ do favorecido obrigatório.');
  if (modalidade === 'credito_conta') {
    if (!['341', '409'].includes(f.codigo_banco)) p.push('Crédito em conta no Itaú exige conta no Itaú (341).');
    if (so(f.agencia).length > 4) p.push('Agência do Itaú tem 4 dígitos.');
    if (so(f.conta).length > 6) p.push('Conta do Itaú tem até 6 dígitos (sem o dígito).');
    if (!/^\d$/.test(String(f.digito ?? '').trim())) p.push('Dígito da conta Itaú deve ter 1 número.');
  } else if (modalidade === 'ted') {
    if (['341', '409'].includes(f.codigo_banco)) p.push('Conta no Itaú: use crédito em conta, não TED.');
    if (so(f.agencia).length > 5) p.push('Agência com mais de 5 dígitos.');
    if (so(f.conta).length > 12) p.push('Conta com mais de 12 dígitos.');
  } else if (modalidade === 'pix') {
    if (!chavePixItau(f)) p.push('Chave PIX inválida para o Itaú.');
  }
  return p;
}

const TIPO_CHAVE = { telefone: '01', email: '02', cpf: '03', cnpj: '03', aleatoria: '04' };
/** Chave no formato da nota 40 do manual (telefone com +55, CPF/CNPJ só dígitos, aleatória com traços). */
export function chavePixItau(f) {
  const tipo = TIPO_CHAVE[f.tipo_pix];
  const k = String(f.chave_pix ?? '').trim();
  if (!tipo || !k) return null;
  if (f.tipo_pix === 'telefone') {
    const d = so(k);
    const nacional = d.startsWith('55') && d.length >= 12 ? d.slice(2) : d;
    return { tipo, chave: `+55${nacional}` };
  }
  if (f.tipo_pix === 'cpf' || f.tipo_pix === 'cnpj') return { tipo, chave: so(k) };
  if (f.tipo_pix === 'email' && k.length > 77) return null;
  return { tipo, chave: f.tipo_pix === 'aleatoria' ? k.toLowerCase() : k };
}

/** Posições 024–043 do segmento A (nota 11). */
function agenciaContaFavorecido(f, modalidade) {
  if (modalidade === 'pix') return zeros(20); // modelo chave: dados da conta são opcionais
  if (modalidade === 'credito_conta') {
    return `0${num(f.agencia, 4)} ${zeros(6)}${num(f.conta, 6)} ${num(f.digito, 1)}`;
  }
  const dac = String(f.digito ?? '').trim().toUpperCase();
  return `${num(f.agencia, 5)} ${num(f.conta, 12)}${dac.length === 2 ? dac : ` ${dac || '0'}`}`;
}

/** "Seu número" (posições 074–093): identifica lote e item para a leitura do retorno. */
export const seuNumero = (loteId, itemId) => `L${String(loteId).padStart(6, '0')}I${String(itemId).padStart(8, '0')}`;
export function lerSeuNumero(s) {
  const m = /^L(\d{6})I(\d{8})/.exec(String(s ?? '').trim());
  return m ? { loteId: Number(m[1]), itemId: Number(m[2]) } : null;
}

/**
 * Gera o arquivo remessa. `itens`: [{ item_id, valor, favorecido }].
 * `conta`: conta pagadora (cnpj, razao_social, agencia, conta, dac, tipo_pagamento, endereço...).
 */
export function gerarRemessa({ lote, itens, conta, dataPagamento, agora = new Date() }) {
  const problemas = problemasContaPagadora(conta);
  if (problemas.length) throw new Error(problemas.join(' '));
  if (!itens.length) throw new Error('Lote sem itens.');
  const { modalidade } = lote;

  // Um lote de serviço por forma de pagamento (crédito em conta separa corrente e poupança).
  const grupos = new Map();
  for (const i of itens) {
    const forma = modalidade === 'pix' ? '45' : modalidade === 'ted' ? '41' : i.favorecido.tipo_conta === 'poupanca' ? '05' : '01';
    if (!grupos.has(forma)) grupos.set(forma, []);
    grupos.get(forma).push(i);
  }

  const cnpj = num(conta.cnpj, 14);
  const ag = num(conta.agencia, 5);
  const cc = num(conta.conta, 12);
  const dac = num(conta.dac, 1);
  const nome = alfa(conta.razao_social, 30);
  const p2 = (n) => String(n).padStart(2, '0');
  const dataGer = `${p2(agora.getDate())}${p2(agora.getMonth() + 1)}${agora.getFullYear()}`;
  const horaGer = `${p2(agora.getHours())}${p2(agora.getMinutes())}${p2(agora.getSeconds())}`;

  const linhas = [linha([
    BANCO, '0000', '0', brancos(6), '080', '2', cnpj, brancos(20), ag, ' ', cc, ' ', dac, nome, alfa('BANCO ITAU SA', 30),
    brancos(10), '1', dataGer, horaGer, zeros(9), zeros(5), brancos(69),
  ])];

  let nLote = 0;
  for (const [forma, grupo] of grupos) {
    nLote += 1;
    const cl = num(nLote, 4);
    linhas.push(linha([
      BANCO, cl, '1', 'C', num(conta.tipo_pagamento, 2), forma, '040', ' ', '2', cnpj, brancos(4), brancos(16), ag, ' ', cc, ' ', dac, nome,
      brancos(30), brancos(10), alfa(conta.endereco, 30), num(so(conta.numero).slice(0, 5) || '0', 5), alfa(conta.complemento, 15),
      alfa(conta.cidade, 20), num(so(conta.cep) || '0', 8), alfa(conta.uf, 2), brancos(8), brancos(10),
    ]));
    let reg = 0;
    let registrosLote = 1;
    let total = 0;
    for (const i of grupo) {
      reg += 1;
      const f = i.favorecido;
      const nr = num(reg, 5);
      linhas.push(linha([
        BANCO, cl, '3', nr, 'A', '000', modalidade === 'pix' ? '009' : '000', modalidade === 'pix' ? zeros(3) : num(f.codigo_banco, 3),
        agenciaContaFavorecido(f, modalidade), alfa(f.titular_nome, 30), alfa(seuNumero(lote.id, i.item_id), 20), dataDDMMAAAA(dataPagamento),
        'REA', brancos(8), modalidade === 'pix' ? '04' : brancos(2), zeros(5), centavos(i.valor, 15), brancos(15), brancos(5), zeros(8), zeros(15),
        brancos(20), zeros(6), num(f.titular_documento, 14), brancos(2), modalidade === 'ted' ? '00010' : brancos(5), brancos(5), '0', brancos(10),
      ]));
      registrosLote += 1;
      if (modalidade === 'pix') {
        const k = chavePixItau(f);
        const doc = so(f.titular_documento);
        linhas.push(linha([
          BANCO, cl, '3', nr, 'B', k.tipo, ' ', doc.length === 14 ? '2' : '1', num(doc, 14), brancos(30), brancos(65), livre(k.chave, 100), brancos(3), brancos(10),
        ]));
        registrosLote += 1;
      }
      total += Math.round(Number(i.valor) * 100);
    }
    registrosLote += 1; // trailer
    linhas.push(linha([BANCO, cl, '5', brancos(9), num(registrosLote, 6), num(total, 18), zeros(18), brancos(171), brancos(10)]));
  }
  linhas.push(linha([BANCO, '9999', '9', brancos(9), num(nLote, 6), num(linhas.length + 1, 6), brancos(211)]));
  return Buffer.from(`${linhas.join('\r\n')}\r\n`, 'latin1');
}

// ── Retorno ──────────────────────────────────────────────────────────────────
/** Nota 8 do manual (códigos usados em pagamentos por crédito em conta, TED e PIX). */
export const OCORRENCIAS = {
  '00': 'Pagamento efetuado', AE: 'Data de pagamento alterada', AG: 'Número do lote inválido', AH: 'Número sequencial do registro no lote inválido',
  AJ: 'Tipo de movimento inválido', AL: 'Código do banco favorecido inválido', AM: 'Agência do favorecido inválida', AN: 'Conta corrente do favorecido inválida',
  AO: 'Nome do favorecido inválido', AP: 'Data de pagamento inválida', AQ: 'Quantidade de registros maior que 999999', AR: 'Valor do lançamento inválido',
  BC: 'Nosso número inválido', BD: 'Pagamento agendado', BE: 'Pagamento agendado com forma alterada para OP',
  BI: 'CPF/CNPJ do favorecido inválido', CD: 'CPF/CNPJ informado divergente do cadastrado', CE: 'Pagamento cancelado', CF: 'Valor do documento inválido',
  CI: 'CPF/CNPJ/identificador inválido', CK: 'Tipo de inscrição inválida', CN: 'Conta não cadastrada', CP: 'Confirmação de OP cumprida',
  DV: 'DOC/TED devolvido pelo banco favorecido', EM: 'Confirmação de OP emitida', EX: 'Devolução de OP não sacada pelo favorecido',
  FC: 'Pagamento efetuado através de financiamento COMPROR', FD: 'Pagamento efetuado através de financiamento DESCOMPROR',
  HA: 'Erro no lote', HM: 'Erro no registro header de arquivo', IM: 'Tipo x forma não compatível', IN: 'Banco/agência não cadastrados',
  IR: 'Pagamento alterado', LA: 'Data de pagamento de um lote alterada', LC: 'Lote de pagamentos cancelado',
  NA: 'Pagamento cancelado por falta de autorização', NR: 'Operação não realizada', RJ: 'Registro rejeitado — conta em processo de abertura ou bloqueada',
  SS: 'Pagamento cancelado por insuficiência de saldo / limite diário excedido', TA: 'Lote não aceito — totais do lote com diferença', TI: 'Titularidade inválida',
};
const PAGO = ['00', 'FC', 'FD'];
const AGUARDANDO = ['BD', 'BE', 'AE', 'IR', 'LA', 'CP', 'EM'];

const descreverOcorrencias = (campo) => {
  const cods = (String(campo ?? '').match(/.{1,2}/g) || []).map((c) => c.trim()).filter(Boolean);
  return cods.map((codigo) => ({ codigo, descricao: OCORRENCIAS[codigo] ?? `Ocorrência ${codigo} (ver nota 8 do manual SISPAG)` }));
};

/** Classifica as ocorrências de um pagamento: pago, aguardando (agendado), devolvido ou rejeitado. */
export function classificar(ocorrencias) {
  const cods = ocorrencias.map((o) => o.codigo);
  if (cods.includes('DV')) return 'devolvido';
  const outros = cods.filter((c) => !PAGO.includes(c) && !AGUARDANDO.includes(c));
  if (outros.length) return 'rejeitado';
  if (cods.some((c) => PAGO.includes(c))) return 'pago';
  return 'aguardando';
}

const isoDeDDMMAAAA = (s) => (/^\d{8}$/.test(s) && s !== '00000000' ? `${s.slice(4, 8)}-${s.slice(2, 4)}-${s.slice(0, 2)}` : null);

/** Lê o arquivo retorno SISPAG. Devolve o cabeçalho, ocorrências dos lotes e os pagamentos (segmento A). */
export function lerRetorno(buffer) {
  let txt = buffer.toString('latin1');
  if (txt.charCodeAt(0) === 0xef && txt.charCodeAt(1) === 0xbb && txt.charCodeAt(2) === 0xbf) txt = txt.slice(3);
  const linhas = txt.split(/\r?\n/).filter((l) => l.trim() !== '');
  const erros = [];
  if (!linhas.length) return { erros: ['Arquivo vazio.'] };
  linhas.forEach((l, n) => { if (l.length !== 240) erros.push(`Linha ${n + 1}: ${l.length} posições (o CNAB 240 tem 240).`); });
  if (erros.length) return { erros: erros.slice(0, 20) };
  const h = linhas[0];
  if (h.slice(0, 3) !== BANCO || h[7] !== '0') return { erros: ['O arquivo não começa com o header de arquivo do Itaú (341).'] };
  if (h[142] !== '2') return { erros: ['Este é um arquivo de remessa, não de retorno. Importe o arquivo que o Itaú devolveu.'] };
  if (linhas[linhas.length - 1][7] !== '9') erros.push('Trailer de arquivo não encontrado (arquivo incompleto?).');

  const cabecalho = {
    banco: BANCO, cnpj: h.slice(18, 32), agencia: h.slice(52, 57), conta: h.slice(58, 70), dac: h[71],
    geradoEm: isoDeDDMMAAAA(h.slice(143, 151)),
  };
  const lotes = [];
  const pagamentos = [];
  for (const l of linhas) {
    const tipo = l[7];
    if (tipo === '1') {
      lotes.push({ lote: l.slice(3, 7), forma: l.slice(11, 13), ocorrencias: descreverOcorrencias(l.slice(230, 240)) });
    } else if (tipo === '3' && l[13] === 'A') {
      const ocorrencias = descreverOcorrencias(l.slice(230, 240));
      const seu = l.slice(73, 93).trim();
      pagamentos.push({
        seuNumero: seu, ref: lerSeuNumero(seu), favorecido: l.slice(43, 73).trim(), documento: l.slice(203, 217),
        dataPrevista: isoDeDDMMAAAA(l.slice(93, 101)), valor: Number(l.slice(119, 134)) / 100,
        nossoNumero: l.slice(134, 149).trim(), dataEfetiva: isoDeDDMMAAAA(l.slice(154, 162)), valorEfetivo: Number(l.slice(162, 177)) / 100,
        ocorrencias, resultado: classificar(ocorrencias),
      });
    }
  }
  if (!pagamentos.length) erros.push('Nenhum pagamento (segmento A) no arquivo.');
  return { erros, cabecalho, lotes, pagamentos };
}
