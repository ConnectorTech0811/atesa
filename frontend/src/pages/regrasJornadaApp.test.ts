import { describe, it, expect } from 'vitest';
import { batidasDoPlantao, horarioDaVaga, janelaEntrada, msParaLiberarFimJornada, temJornadaAberta } from './regrasJornadaApp';

const em = (iso: string) => new Date(iso); // horário local

describe('janela de entrada (15 min antes do plantão)', () => {
  const escala = [{ data: '2026-11-18', hora_inicio: '07:00', hora_fim: '19:00', duracao_minutos: 720 }];

  it('bloqueia antes de 15 min do início e informa quando libera', () => {
    const j = janelaEntrada(em('2026-11-18T06:40:00'), escala);
    expect(j.permitido).toBe(false);
    expect(j.liberadaEm?.getHours()).toBe(6);
    expect(j.liberadaEm?.getMinutes()).toBe(45);
  });
  it('libera a partir de 15 min antes e durante o plantão', () => {
    expect(janelaEntrada(em('2026-11-18T06:45:00'), escala).permitido).toBe(true);
    expect(janelaEntrada(em('2026-11-18T10:00:00'), escala).permitido).toBe(true);
  });
  it('plantão noturno que vira o dia', () => {
    const noturno = [{ data: '2026-11-17', hora_inicio: '19:00', hora_fim: '07:00', duracao_minutos: null }];
    expect(janelaEntrada(em('2026-11-18T02:00:00'), noturno).permitido).toBe(true);
    expect(janelaEntrada(em('2026-11-17T18:00:00'), noturno).permitido).toBe(false);
  });
  it('sem escala usa o horário da vaga; sem horário nenhum não restringe', () => {
    expect(janelaEntrada(em('2026-11-18T06:00:00'), [], '07:00 às 19:00').permitido).toBe(false);
    expect(janelaEntrada(em('2026-11-18T06:50:00'), [], '07:00 às 19:00').permitido).toBe(true);
    expect(janelaEntrada(em('2026-11-18T03:00:00'), [], null).permitido).toBe(true);
    expect(horarioDaVaga('7h às 19h')).toEqual({ inicio: '07:00', fim: '19:00' });
  });
});

describe('permanência mínima para finalizar', () => {
  it('só libera após 1 hora', () => {
    const inicio = em('2026-11-18T07:00:00');
    expect(msParaLiberarFimJornada(inicio.toISOString(), em('2026-11-18T07:30:00'))).toBe(30 * 60 * 1000);
    expect(msParaLiberarFimJornada(inicio.toISOString(), em('2026-11-18T08:00:00'))).toBe(0);
  });
});

describe('bloqueio sem escala', () => {
  it('sem escala lançada bloqueia, mesmo com horário na vaga', () => {
    const j = janelaEntrada(em('2026-11-18T07:00:00'), [], '07:00 às 19:00', { exigirEscala: true });
    expect(j.permitido).toBe(false);
    expect(j.semEscala).toBe(true);
  });
  it('escala já encerrada e nenhuma próxima bloqueia', () => {
    const escala = [{ data: '2026-11-17', hora_inicio: '07:00', hora_fim: '19:00', duracao_minutos: 720 }];
    expect(janelaEntrada(em('2026-11-18T07:00:00'), escala, null, { exigirEscala: true }).semEscala).toBe(true);
  });
});

describe('estado do plantão', () => {
  const b = (tipoEvento: string, iso: string) => ({ tipoEvento, timestampDispositivo: new Date(iso).toISOString(), dataReferencia: iso.slice(0, 10) });
  it('mantém a entrada de ontem quando o plantão noturno ainda está aberto', () => {
    const lista = [b('jornada_inicio', '2026-11-17T19:00:00'), b('refeicao_inicio', '2026-11-18T01:00:00')];
    expect(batidasDoPlantao(lista, '2026-11-18').map((x) => x.tipoEvento)).toEqual(['jornada_inicio', 'refeicao_inicio']);
    expect(temJornadaAberta(lista)).toBe(true);
  });
  it('descarta o plantão de ontem já encerrado', () => {
    const lista = [b('jornada_inicio', '2026-11-17T07:00:00'), b('jornada_fim', '2026-11-17T19:00:00')];
    expect(batidasDoPlantao(lista, '2026-11-18')).toHaveLength(0);
    expect(temJornadaAberta(lista)).toBe(false);
  });
});
