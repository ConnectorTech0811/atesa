import test from 'node:test';
import assert from 'node:assert/strict';
import { acoesPermitidas, motivoBloqueio } from '../src/repositories/fechamentoRepository.js';
import { horariosSobrepoem, vinculosEmConflito } from '../src/repositories/escalaFaturamentoRepository.js';

test('aberto: ninguém é bloqueado', () => {
  for (const p of ['escalista', 'supervisao', 'faturamento', 'administrador']) assert.equal(motivoBloqueio('aberto', p, '2026-10'), null);
});

test('em fechamento: só o supervisor altera', () => {
  assert.equal(motivoBloqueio('supervisao', 'supervisao', '2026-10'), null);
  assert.equal(motivoBloqueio('supervisao', 'administrador', '2026-10'), null);
  assert.ok(motivoBloqueio('supervisao', 'escalista', '2026-10'));
  assert.ok(motivoBloqueio('supervisao', 'faturamento', '2026-10'));
});

test('encaminhado ao Faturamento: ninguém altera, nem o administrador', () => {
  for (const p of ['escalista', 'supervisao', 'faturamento', 'administrador', 'suporte']) assert.ok(motivoBloqueio('faturamento', p, '2026-10'));
});

test('cada etapa tem o seu solicitante e o seu responsável pela reabertura', () => {
  assert.equal(acoesPermitidas('supervisao', 'escalista', false).solicitar, true);
  assert.equal(acoesPermitidas('supervisao', 'escalista', true).decidir, false);
  assert.equal(acoesPermitidas('supervisao', 'supervisao', true).decidir, true);
  assert.equal(acoesPermitidas('faturamento', 'escalista', false).solicitar, false);
  assert.equal(acoesPermitidas('faturamento', 'supervisao', false).solicitar, true);
  assert.equal(acoesPermitidas('faturamento', 'supervisao', true).decidir, false);
  assert.equal(acoesPermitidas('faturamento', 'faturamento', true).decidir, true);
  assert.equal(acoesPermitidas('aberto', 'escalista', false).iniciar, false);
});

test('sobreposição de horários considera plantão que vira a noite', () => {
  assert.equal(horariosSobrepoem('07:00', '19:00', '18:00', '20:00'), true);
  assert.equal(horariosSobrepoem('07:00', '19:00', '19:00', '07:00'), false);
  assert.equal(horariosSobrepoem('19:00', '07:00', '20:00', '23:00'), true);
});

test('atividade fica vinculada até a quantidade da vaga', () => {
  const ocupada = { data: '2026-10-30', hora_inicio: '07:00:00', hora_fim: '19:00:00', nome: 'Ana' };
  const novo = { data: '2026-10-30', hora_inicio: '07:00', hora_fim: '19:00' };
  assert.equal(vinculosEmConflito(novo, [ocupada], 1).length, 1);
  assert.equal(vinculosEmConflito(novo, [ocupada], 2).length, 0);
  assert.equal(vinculosEmConflito({ ...novo, data: '2026-10-31' }, [ocupada], 1).length, 0);
  assert.equal(vinculosEmConflito(novo, [], 1).length, 0);
});
