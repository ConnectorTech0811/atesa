import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apurarAlocacoes, resolverAlocacao } from '../src/repositories/apuracaoFaturamento.js';

const periodo = { inicio: '2026-10-01', fim: '2026-10-31' };
const vagaNoturna = { horario: '19:00 às 07:00', adicional_noturno: 1, desconta_refeicao: 0 };
const aloc = (id, extra = {}) => ({ id, candidato_id: 1, empresa_id: 100, vaga_id: 5, data_inicio: '2026-01-01', data_fim: null, vaga_params: vagaNoturna, ...extra });
const bat = (tipo, ts, extra = {}) => ({ candidato_id: 1, alocacao_id: 10, vaga_id: 5, tipo_evento: tipo, timestamp_dispositivo: ts, data_referencia: ts.slice(0, 10), ...extra });
const base = { alocacoes: [aloc(10)], todasAlocacoes: [aloc(10)], escalas: [], complementos: [], periodo, hoje: '2026-11-05', empresaId: 100 };

test('noturno 12x36: horas, adicional noturno e plantões', () => {
  const r = apurarAlocacoes({ ...base, apontamentos: [
    bat('jornada_inicio', '2026-10-01 19:00:00'), bat('jornada_fim', '2026-10-02 07:00:00'),
    bat('jornada_inicio', '2026-10-03 19:00:00'), bat('jornada_fim', '2026-10-04 07:00:00'),
  ] }).get(10);
  assert.equal(r.minutos_trabalhados / 60, 24);
  assert.equal(r.minutos_ad_noturno / 60, 14);
  assert.equal(r.pl_noturno, 2);
  assert.equal(r.dias.size, 2);
  assert.equal(r.minutos_extra, 0);
  assert.equal(r.inconsistencias.length, 0);
});

test('plantão que começa no último dia entra no mês; o que começou no mês anterior não', () => {
  const r = apurarAlocacoes({ ...base, apontamentos: [
    bat('jornada_inicio', '2026-09-30 19:00:00'), bat('jornada_fim', '2026-10-01 07:00:00'),
    bat('jornada_inicio', '2026-10-31 19:00:00'), bat('jornada_fim', '2026-11-01 07:00:00'),
  ] }).get(10);
  assert.equal(r.minutos_trabalhados / 60, 12);
  assert.deepEqual([...r.dias], ['2026-10-31']);
  assert.equal(r.inconsistencias.length, 0);
});

test('escala: prevista sem batida vira falta e inconsistência; realizada conta; futura ignora', () => {
  const escalas = [
    { candidato_id: 1, alocacao_id: 10, data: '2026-10-05', hora_inicio: '19:00:00', duracao_minutos: 720, status: 'prevista' },
    { candidato_id: 1, alocacao_id: 10, data: '2026-10-07', hora_inicio: '19:00:00', duracao_minutos: 720, status: 'realizada' },
    { candidato_id: 1, alocacao_id: 10, data: '2026-10-30', hora_inicio: '19:00:00', duracao_minutos: 720, status: 'prevista' },
  ];
  const r = apurarAlocacoes({ ...base, hoje: '2026-10-20', escalas, apontamentos: [] }).get(10);
  assert.equal(r.minutos_falta / 60, 12);
  assert.equal(r.minutos_trabalhados / 60, 12);
  assert.equal(r.minutos_escala / 60, 36);
  assert.deepEqual(r.inconsistencias.map((i) => i.tipo), ['plantao_sem_apontamento']);
  assert.equal(r.avisos[0].tipo, 'realizada_sem_apontamento');
});

test('batida sem alocação: cooperado com um posto é atribuída; com dois postos ativos, não fatura', () => {
  const semAloc = [bat('jornada_inicio', '2026-10-01 19:00:00', { alocacao_id: null, vaga_id: null }), bat('jornada_fim', '2026-10-02 07:00:00', { alocacao_id: null, vaga_id: null })];
  assert.equal(apurarAlocacoes({ ...base, apontamentos: semAloc }).get(10).minutos_trabalhados, 720);

  const outro = { id: 20, candidato_id: 1, empresa_id: 200, vaga_id: 9, data_inicio: '2026-01-01', data_fim: null };
  const r = apurarAlocacoes({ ...base, todasAlocacoes: [aloc(10), outro], apontamentos: semAloc }).get(10);
  assert.equal(r.minutos_trabalhados, 0);
  assert.equal(r.inconsistencias[0].tipo, 'sem_alocacao');
});

test('batida de outro cliente não entra', () => {
  const outro = { id: 20, candidato_id: 1, empresa_id: 200, vaga_id: 9, data_inicio: '2026-01-01', data_fim: null };
  const r = apurarAlocacoes({ ...base, todasAlocacoes: [aloc(10), outro], apontamentos: [
    bat('jornada_inicio', '2026-10-01 19:00:00', { alocacao_id: 20 }), bat('jornada_fim', '2026-10-02 07:00:00', { alocacao_id: 20 }),
    bat('jornada_inicio', '2026-10-09 07:00:00', { alocacao_id: 20 }),
  ] }).get(10);
  assert.equal(r.minutos_trabalhados, 0);
  assert.equal(r.inconsistencias.length, 0);
});

test('extra automática + complemento no mesmo dia sinaliza possível duplicidade', () => {
  const r = apurarAlocacoes({
    ...base,
    apontamentos: [bat('jornada_inicio', '2026-10-01 19:00:00'), bat('jornada_fim', '2026-10-02 09:00:00')],
    complementos: [{ candidato_id: 1, alocacao_id: 10, data_referencia: '2026-10-01', tipo: 'hora_extra', quantidade_minutos: 120 }],
  }).get(10);
  assert.equal(r.minutos_extra, 120);
  assert.equal(r.minutos_extra_manual, 120);
  assert.equal(r.inconsistencias[0].tipo, 'possivel_extra_duplicado');
});

test('resolverAlocacao usa vaga e período', () => {
  const lista = [
    { id: 1, empresa_id: 100, vaga_id: 5, data_inicio: '2026-01-01', data_fim: '2026-06-30' },
    { id: 2, empresa_id: 100, vaga_id: 6, data_inicio: '2026-07-01', data_fim: null },
  ];
  assert.equal(resolverAlocacao({}, lista, '2026-03-10'), 1);
  assert.equal(resolverAlocacao({}, lista, '2026-08-10'), 2);
  assert.equal(resolverAlocacao({ alocacao_id: 7 }, lista, '2026-08-10'), 7);
});
