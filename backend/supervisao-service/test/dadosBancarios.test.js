import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizarChavePix, problemasChavePix, problemasConta, validarDadosBancarios } from '../src/repositories/dadosBancarios.js';
import { calcularPendencias } from '../src/repositories/pagamentosCooperadosRepository.js';

const contaOk = { codigo_banco: '341', agencia: '1234', conta: '56789', digito: '0', tipo_conta: 'corrente' };
const cooperado = { cpf: '52998224725', status: 1 };
const recebido = { confirmado: true };

test('chave PIX numérica é normalizada e validada com máscara', () => {
  assert.equal(normalizarChavePix('529.982.247-25', 'cpf'), '52998224725');
  assert.equal(normalizarChavePix('(11) 99999-8888', 'telefone'), '11999998888');
  assert.equal(normalizarChavePix(' a@b.com ', 'email'), 'a@b.com');
  assert.deepEqual(problemasChavePix('529.982.247-25', 'cpf', '52998224725'), []);
  assert.equal(problemasChavePix('111.111.111-11', 'cpf').length, 1);
});

test('conta exige banco com 3 dígitos e dígito verificador', () => {
  assert.deepEqual(problemasConta(contaOk), []);
  assert.ok(problemasConta({ ...contaOk, codigo_banco: '34' }).length);
  assert.ok(problemasConta({ ...contaOk, digito: '' }).length);
});

test('conta válida basta para liberar, mesmo sem PIX', () => {
  assert.equal(validarDadosBancarios(contaOk).valido, true);
});

test('cooperado sem dados bancários tem pendência bloqueante', () => {
  const [p] = calcularPendencias({ cooperado, bloqueiosAtivos: [], dadosBancarios: undefined, liquido: 100, recebimento: recebido });
  assert.equal(p.codigo, 'sem_dados_bancarios');
  assert.equal(p.excepcionavel, false);
});

test('dados corrigidos eliminam a pendência bancária', () => {
  const pend = calcularPendencias({ cooperado, bloqueiosAtivos: [], dadosBancarios: contaOk, liquido: 100, recebimento: recebido });
  assert.deepEqual(pend, []);
});
