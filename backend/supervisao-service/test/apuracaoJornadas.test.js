import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  montarJornadas, apurarJornada, casarComEscala, minutosNaJanela, lerHorarioVaga, minutosTrabalhadosSimples, REGRAS_PADRAO,
} from '../src/repositories/apuracaoJornadas.js';

const b = (tipo, ts, extra = {}) => ({ candidato_id: 1, alocacao_id: 10, vaga_id: 5, tipo_evento: tipo, timestamp_dispositivo: ts, data_referencia: ts.slice(0, 10), ...extra });
const h = (min) => min / 60;

test('plantão diurno com refeição registrada', () => {
  const { jornadas, inconsistencias } = montarJornadas([
    b('jornada_inicio', '2026-10-01 07:00:00'), b('refeicao_inicio', '2026-10-01 12:00:00'),
    b('refeicao_fim', '2026-10-01 13:00:00'), b('jornada_fim', '2026-10-01 19:00:00'),
  ]);
  assert.equal(jornadas.length, 1);
  assert.equal(inconsistencias.length, 0);
  const r = apurarJornada(jornadas[0], { desconta_refeicao: 1, tempo_refeicao: 60, horario: '07:00 às 19:00' }, null);
  assert.equal(h(r.trabalhado), 11);
  assert.equal(h(r.previsto), 11);
  assert.equal(r.extra, 0);
  assert.equal(r.falta, 0);
});

test('plantão noturno 19h → 07h (datas diferentes) conta 12h', () => {
  const { jornadas, inconsistencias } = montarJornadas([b('jornada_inicio', '2026-10-01 19:00:00'), b('jornada_fim', '2026-10-02 07:00:00')]);
  assert.equal(inconsistencias.length, 0);
  assert.equal(jornadas.length, 1);
  assert.equal(jornadas[0].data, '2026-10-01');
  assert.equal(h(jornadas[0].minutos_brutos), 12);
  const r = apurarJornada(jornadas[0], { adicional_noturno: 1, horario: '19:00 às 07:00' }, null);
  assert.equal(h(r.noturno), 7); // 22h–05h
  assert.equal(h(r.ad_noturno), 7);
});

test('12x36 noturno: três plantões = 36h', () => {
  const { jornadas } = montarJornadas([
    b('jornada_inicio', '2026-10-01 19:00:00'), b('jornada_fim', '2026-10-02 07:00:00'),
    b('jornada_inicio', '2026-10-03 19:00:00'), b('jornada_fim', '2026-10-04 07:00:00'),
    b('jornada_inicio', '2026-10-05 19:00:00'), b('jornada_fim', '2026-10-06 07:00:00'),
  ]);
  assert.equal(jornadas.reduce((s, j) => s + j.minutos_brutos, 0) / 60, 36);
});

test('dobra no mesmo dia: duas jornadas = 24h', () => {
  const { jornadas } = montarJornadas([
    b('jornada_inicio', '2026-10-01 07:00:00'), b('jornada_fim', '2026-10-01 19:00:00'),
    b('jornada_inicio', '2026-10-01 19:05:00'), b('jornada_fim', '2026-10-02 07:00:00'),
  ]);
  assert.equal(jornadas.length, 2);
  assert.equal(Math.round(jornadas.reduce((s, j) => s + j.minutos_brutos, 0) / 60 * 100) / 100, 23.92);
});

test('entrada sem saída e saída sem entrada geram inconsistência', () => {
  const r1 = montarJornadas([b('jornada_inicio', '2026-10-01 07:00:00')]);
  assert.equal(r1.jornadas.length, 0);
  assert.equal(r1.inconsistencias[0].tipo, 'jornada_sem_saida');
  const r2 = montarJornadas([b('jornada_fim', '2026-10-01 19:00:00')]);
  assert.equal(r2.inconsistencias[0].tipo, 'saida_sem_entrada');
  // entrada esquecida por mais de 26h não casa com a saída de outro plantão
  const r3 = montarJornadas([b('jornada_inicio', '2026-10-01 07:00:00'), b('jornada_fim', '2026-10-03 07:00:00')]);
  assert.equal(r3.jornadas.length, 0);
  assert.deepEqual(r3.inconsistencias.map((i) => i.tipo), ['jornada_sem_saida', 'saida_sem_entrada']);
});

test('refeição: vaga que não desconta não reduz horas; não registrada desconta o parâmetro', () => {
  const { jornadas } = montarJornadas([
    b('jornada_inicio', '2026-10-01 07:00:00'), b('refeicao_inicio', '2026-10-01 12:00:00'),
    b('refeicao_fim', '2026-10-01 13:00:00'), b('pausa_inicio', '2026-10-01 15:00:00'),
    b('pausa_fim', '2026-10-01 15:30:00'), b('jornada_fim', '2026-10-01 19:00:00'),
  ]);
  assert.equal(h(apurarJornada(jornadas[0], { desconta_refeicao: 0, desconta_pausa: 0 }, null).trabalhado), 12);
  assert.equal(h(apurarJornada(jornadas[0], { desconta_refeicao: 1, desconta_pausa: 1 }, null).trabalhado), 10.5);

  const sem = montarJornadas([b('jornada_inicio', '2026-10-01 07:00:00'), b('jornada_fim', '2026-10-01 19:00:00')]).jornadas[0];
  const r = apurarJornada(sem, { desconta_refeicao: 1, tempo_refeicao: 60 }, null);
  assert.equal(h(r.trabalhado), 11);
  assert.equal(r.avisos[0].tipo, 'refeicao_nao_registrada');
  const r2 = apurarJornada(sem, { desconta_refeicao: 1, tempo_refeicao: 60 }, null, { refeicao_nao_registrada: 'nao_descontar' });
  assert.equal(h(r2.trabalhado), 12);
});

test('extra e falta respeitam a tolerância', () => {
  const vaga = { horario: '07:00 às 19:00' };
  const j = (fim) => montarJornadas([b('jornada_inicio', '2026-10-01 07:00:00'), b('jornada_fim', fim)]).jornadas[0];
  assert.equal(apurarJornada(j('2026-10-01 19:08:00'), vaga, null).extra, 0); // dentro de 10 min
  assert.equal(apurarJornada(j('2026-10-01 20:30:00'), vaga, null).extra, 90);
  assert.equal(apurarJornada(j('2026-10-01 17:00:00'), vaga, null).falta, 120);
  assert.equal(apurarJornada(j('2026-10-01 20:30:00'), vaga, null, { extras_automaticos: false }).extra, 0);
});

test('escala tem prioridade sobre o horário da vaga como previsto', () => {
  const j = montarJornadas([b('jornada_inicio', '2026-10-01 07:00:00'), b('jornada_fim', '2026-10-01 13:00:00')]).jornadas[0];
  const r = apurarJornada(j, { horario: '07:00 às 19:00' }, { duracao_minutos: 360 });
  assert.equal(r.falta, 0);
});

test('casamento com a escala e plantão sem apontamento', () => {
  const { jornadas } = montarJornadas([b('jornada_inicio', '2026-10-01 19:20:00'), b('jornada_fim', '2026-10-02 07:00:00')]);
  const escalas = [
    { candidato_id: 1, data: '2026-10-01', hora_inicio: '19:00:00', duracao_minutos: 720, status: 'prevista' },
    { candidato_id: 1, data: '2026-10-03', hora_inicio: '19:00:00', duracao_minutos: 720, status: 'prevista' },
    { candidato_id: 1, data: '2026-10-05', hora_inicio: '19:00:00', duracao_minutos: 720, status: 'cancelada' },
  ];
  const { casadas, semJornada } = casarComEscala(jornadas, escalas);
  assert.equal(casadas.get(jornadas[0]).data, '2026-10-01');
  assert.deepEqual(semJornada.map((e) => e.data), ['2026-10-03']);
});

test('janela noturna, hora reduzida e leitura do horário', () => {
  const ini = Date.UTC(2026, 9, 1, 19) / 60000;
  assert.equal(minutosNaJanela(ini, ini + 720, 22 * 60, 5 * 60), 420);
  assert.equal(minutosNaJanela(ini - 19 * 60 + 1 * 60, ini - 19 * 60 + 3 * 60, 22 * 60, 5 * 60), 120); // 01h–03h
  const j = montarJornadas([b('jornada_inicio', '2026-10-01 22:00:00'), b('jornada_fim', '2026-10-02 05:00:00')]).jornadas[0];
  assert.equal(apurarJornada(j, { adicional_noturno: 1 }, null, { hora_noturna_reduzida: true }).ad_noturno, 480);
  assert.deepEqual(lerHorarioVaga('19h às 07h'), { inicio: 1140, duracao: 720 });
  assert.equal(lerHorarioVaga('Diurno'), null);
  assert.equal(REGRAS_PADRAO.tolerancia_minutos, 10);
});

test('soma simples do Monitoramento cobre plantão noturno', () => {
  assert.equal(minutosTrabalhadosSimples([b('jornada_inicio', '2026-10-01 19:00:00'), b('jornada_fim', '2026-10-02 07:00:00')]), 720);
});

// ── Regras por cliente (2026-10-28) ──
const jornada = (ini, fim, extra = []) => montarJornadas([b('jornada_inicio', ini), ...extra, b('jornada_fim', fim)]).jornadas[0];
const vaga12 = { horario: '07:00 às 19:00' };

test('limite de entrada antecipada: só conta 15 min antes do previsto', () => {
  const j = jornada('2026-10-01 06:00:00', '2026-10-01 19:00:00');
  const sem = apurarJornada(j, vaga12, null);
  assert.equal(h(sem.trabalhado), 13);
  const com = apurarJornada(j, vaga12, null, { limite_entrada_antecipada_minutos: 15, tolerancia_minutos: 10 });
  assert.equal(com.trabalhado, 12 * 60 + 15);
  assert.equal(com.extra, 15);
  assert.ok(com.avisos.some((a) => a.tipo === 'entrada_antecipada'));
  // 0 = conta só a partir do horário previsto
  assert.equal(h(apurarJornada(j, vaga12, null, { limite_entrada_antecipada_minutos: 0 }).trabalhado), 12);
});

test('limite de saída posterior usa o plantão da escala', () => {
  const j = jornada('2026-10-01 19:00:00', '2026-10-02 08:30:00');
  const esc = { data: '2026-10-01', hora_inicio: '19:00:00', duracao_minutos: 720 };
  const r = apurarJornada(j, null, esc, { limite_saida_posterior_minutos: 30 });
  assert.equal(r.trabalhado, 12 * 60 + 30);
  assert.ok(r.avisos.some((a) => a.tipo === 'saida_posterior'));
});

test('tolerância de falta separada da tolerância de extra', () => {
  const j = jornada('2026-10-01 07:20:00', '2026-10-01 19:00:00');
  assert.equal(apurarJornada(j, vaga12, null, { tolerancia_minutos: 10, tolerancia_falta_minutos: 30 }).falta, 0);
  assert.equal(apurarJornada(j, vaga12, null, { tolerancia_minutos: 10, tolerancia_falta_minutos: 10 }).falta, 20);
});

test('arredondamento das horas trabalhadas', () => {
  const j = jornada('2026-10-01 07:00:00', '2026-10-01 19:07:00'); // 727 min, arredonda para o mais próximo
  assert.equal(apurarJornada(j, vaga12, null, { arredondamento_minutos: 15 }).trabalhado, 720);
  assert.equal(apurarJornada(j, vaga12, null, { arredondamento_minutos: 5 }).trabalhado, 725);
});

test('pausa não registrada: desconta o tempo da vaga só se a regra pedir', () => {
  const j = jornada('2026-10-01 07:00:00', '2026-10-01 19:00:00');
  const v = { ...vaga12, desconta_pausa: 1, tempo_pausa: 15 };
  assert.equal(apurarJornada(j, v, null).trabalhado, 720);
  const r = apurarJornada(j, v, null, { pausa_nao_registrada: 'descontar_parametro' });
  assert.equal(r.trabalhado, 705);
  assert.ok(r.avisos.some((a) => a.tipo === 'pausa_nao_registrada'));
});

test('padrões novos não mudam a apuração anterior', () => {
  assert.equal(REGRAS_PADRAO.limite_entrada_antecipada_minutos, null);
  assert.equal(REGRAS_PADRAO.arredondamento_minutos, 0);
  assert.equal(REGRAS_PADRAO.plantao_sem_batida_gera_falta, true);
});
