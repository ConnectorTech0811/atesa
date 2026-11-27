import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gerarRemessa, lerRetorno, problemasItem, problemasContaPagadora, seuNumero, lerSeuNumero, classificar, alfa,
} from '../src/repositories/bancos/itauSispag.js';

const conta = {
  cnpj: '08930337000100', razao_social: 'Cooperativa ATESA', agencia: '1234', conta: '56789', dac: '0', tipo_pagamento: '20',
  endereco: 'Rua São João', numero: '100', complemento: 'Sala 2', cidade: 'São Paulo', cep: '01000000', uf: 'SP',
};
const fav = (extra) => ({ titular_nome: 'José da Silva Ção', titular_documento: '52998224725', codigo_banco: '341', agencia: '0501', conta: '12345', digito: '6', tipo_conta: 'corrente', ...extra });
const agora = new Date(2026, 10, 27, 10, 30, 5);
const pos = (l, ini, fim) => l.slice(ini - 1, fim);
const linhas = (buf) => buf.toString('latin1').split('\r\n').filter(Boolean);

test('remessa de crédito em conta: registros de 240 posições, lotes por forma e totais', () => {
  const itens = [
    { item_id: 11, valor: 1500.5, favorecido: fav() },
    { item_id: 12, valor: 99.99, favorecido: fav({ tipo_conta: 'poupanca', titular_nome: 'Maria' }) },
    { item_id: 13, valor: 10, favorecido: fav({ titular_nome: 'Ana' }) },
  ];
  const l = linhas(gerarRemessa({ lote: { id: 7, modalidade: 'credito_conta' }, itens, conta, dataPagamento: '2026-11-30', agora }));
  for (const x of l) assert.equal(x.length, 240);
  // header arquivo + (header lote + 2 A + trailer) + (header lote + 1 A + trailer) + trailer arquivo
  assert.equal(l.length, 9);
  const h = l[0];
  assert.equal(pos(h, 1, 3), '341');
  assert.equal(pos(h, 15, 17), '080');
  assert.equal(pos(h, 19, 32), '08930337000100');
  assert.equal(pos(h, 53, 57), '01234');
  assert.equal(pos(h, 59, 70), '000000056789');
  assert.equal(pos(h, 143, 143), '1');
  assert.equal(pos(h, 144, 157), '27112026103005');
  const hl = l[1];
  assert.equal(pos(hl, 10, 13), '2001'); // fornecedores, crédito em conta corrente Itaú
  assert.equal(pos(hl, 14, 16), '040');
  assert.equal(pos(hl, 143, 172).trim(), 'RUA SAO JOAO');
  const a = l[2];
  assert.equal(pos(a, 14, 14), 'A');
  assert.equal(pos(a, 21, 23), '341');
  assert.equal(pos(a, 24, 43), '00501 000000012345 6');
  assert.equal(pos(a, 44, 73).trim(), 'JOSE DA SILVA CAO');
  assert.deepEqual(lerSeuNumero(pos(a, 74, 93)), { loteId: 7, itemId: 11 });
  assert.equal(pos(a, 94, 101), '30112026');
  assert.equal(pos(a, 120, 134), '000000000150050');
  assert.equal(pos(a, 204, 217), '00052998224725');
  const tl = l[4];
  assert.equal(pos(tl, 8, 8), '5');
  assert.equal(pos(tl, 18, 23), '000004');
  assert.equal(pos(tl, 24, 41), '000000000000151050');
  assert.equal(pos(l[5], 12, 13), '05'); // segundo lote: poupança
  const ta = l[8];
  assert.equal(pos(ta, 4, 8), '99999');
  assert.equal(pos(ta, 18, 23), '000002');
  assert.equal(pos(ta, 24, 29), '000009');
});

test('remessa TED: forma 41, agência/conta de outros bancos e finalidade', () => {
  const f = fav({ codigo_banco: '237', agencia: '1234', conta: '9876543', digito: 'X' });
  const l = linhas(gerarRemessa({ lote: { id: 1, modalidade: 'ted' }, itens: [{ item_id: 1, valor: 200, favorecido: f }], conta, dataPagamento: '2026-11-30', agora }));
  assert.equal(pos(l[1], 12, 13), '41');
  const a = l[2];
  assert.equal(pos(a, 21, 23), '237');
  assert.equal(pos(a, 24, 43), '01234 000009876543 X');
  assert.equal(pos(a, 220, 224), '00010');
});

test('remessa PIX por chave: câmara 009, tipo 04 e segmento B com a chave', () => {
  const f = fav({ tipo_pix: 'telefone', chave_pix: '11987654321' });
  const l = linhas(gerarRemessa({ lote: { id: 2, modalidade: 'pix' }, itens: [{ item_id: 5, valor: 50, favorecido: f }], conta, dataPagamento: '2026-11-30', agora }));
  assert.equal(l.length, 6);
  assert.equal(pos(l[1], 12, 13), '45');
  const a = l[2];
  assert.equal(pos(a, 18, 20), '009');
  assert.equal(pos(a, 113, 114), '04');
  const b = l[3];
  assert.equal(pos(b, 14, 14), 'B');
  assert.equal(pos(b, 9, 13), pos(a, 9, 13)); // mesmo número do segmento A (nota 9)
  assert.equal(pos(b, 15, 16), '01');
  assert.equal(pos(b, 128, 227).trim(), '+5511987654321');
  assert.equal(pos(l[4], 18, 23), '000004');
});

test('validações do Itaú', () => {
  assert.deepEqual(problemasItem(fav(), 'credito_conta'), []);
  assert.ok(problemasItem(fav({ codigo_banco: '237' }), 'credito_conta').length);
  assert.ok(problemasItem(fav({ conta: '1234567' }), 'credito_conta').length);
  assert.ok(problemasItem(fav(), 'ted').length); // conta Itaú não vai por TED
  assert.ok(problemasItem(fav({ tipo_pix: null, chave_pix: null }), 'pix').length);
  assert.deepEqual(problemasContaPagadora(conta), []);
  assert.ok(problemasContaPagadora({ ...conta, dac: '' }).length);
  assert.ok(problemasContaPagadora(null).length);
  assert.equal(alfa('Ação  ç/ñ', 10), 'ACAO C N  ');
  assert.equal(seuNumero(7, 11), 'L000007I00000011');
});

test('retorno: classifica pago, agendado e rejeitado e lê datas/valores', () => {
  const itens = [
    { item_id: 1, valor: 100, favorecido: fav() },
    { item_id: 2, valor: 200, favorecido: fav({ titular_nome: 'B' }) },
    { item_id: 3, valor: 300, favorecido: fav({ titular_nome: 'C' }) },
  ];
  const rem = linhas(gerarRemessa({ lote: { id: 9, modalidade: 'credito_conta' }, itens, conta, dataPagamento: '2026-11-30', agora }));
  const set = (l, ini, txt) => l.slice(0, ini - 1) + txt + l.slice(ini - 1 + txt.length);
  const ret = rem.map((l, n) => {
    if (n === 0) return set(l, 143, '2');
    if (n === 2) return set(set(set(l, 155, '30112026'), 163, '000000000010000'), 231, '00        ');
    if (n === 3) return set(l, 231, 'BD        ');
    if (n === 4) return set(l, 231, 'ANCD      ');
    return l;
  });
  const r = lerRetorno(Buffer.from(`${ret.join('\r\n')}\r\n`, 'latin1'));
  assert.deepEqual(r.erros, []);
  assert.equal(r.pagamentos.length, 3);
  const [p1, p2, p3] = r.pagamentos;
  assert.equal(p1.resultado, 'pago');
  assert.equal(p1.dataEfetiva, '2026-11-30');
  assert.equal(p1.valorEfetivo, 100);
  assert.deepEqual(p1.ref, { loteId: 9, itemId: 1 });
  assert.equal(p2.resultado, 'aguardando');
  assert.equal(p3.resultado, 'rejeitado');
  assert.deepEqual(p3.ocorrencias.map((o) => o.codigo), ['AN', 'CD']);
  assert.equal(classificar([{ codigo: 'DV' }]), 'devolvido');
});

test('retorno: recusa arquivo de remessa e arquivo fora do CNAB 240', () => {
  const rem = gerarRemessa({ lote: { id: 1, modalidade: 'credito_conta' }, itens: [{ item_id: 1, valor: 1, favorecido: fav() }], conta, dataPagamento: '2026-11-30', agora });
  assert.match(lerRetorno(rem).erros[0], /remessa/);
  assert.ok(lerRetorno(Buffer.from('341abc\r\n')).erros.length);
});
