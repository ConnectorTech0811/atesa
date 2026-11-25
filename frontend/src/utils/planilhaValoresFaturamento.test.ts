import { describe, expect, it } from 'vitest';
import type { LinhaFaturamento, VagaValoresReferencia } from '../api/escalaFaturamentoApi';
import { calcularLinhaValores, horasDoHorario, ParametrosCalculo } from './planilhaValoresFaturamento';

const linha = (o: Partial<LinhaFaturamento> = {}): LinhaFaturamento => ({
  alocacao_id: 1, origem: 'alocacao', candidato_id: 1, unidade_id: 10, vaga_id: 100, cooperado: 'TESTE', matricula: '1',
  data_inicio: '2026-01-01', desligamento: null, atividade: 'ENFERMEIRO', tipo_escala: 'plantao', competencia: '10/2026',
  local: 'X', dias_mes_total: 30, dias_mes_fechado: 3, dias_trabalhados: 3, total_horas: 36, horas_apontadas: 36,
  horas_escala: 36, horas_previstas: 36, horas_falta: 0, horas_noturnas: 0, pl_diurno: 3, pl_noturno: 0,
  hora_excedente: 0, ad_noturno: 0, inconsistencias: [], avisos: [], bonificacao: 0, desc_refeicao: 0,
  desc_estacionamento: 0, desc_farmacia: 0, reembolso: 0, ...o,
});

const vaga = (o: Partial<VagaValoresReferencia> = {}): VagaValoresReferencia => ({
  id: 100, unidade_id: 10, cargo: 'ENFERMEIRO', salario_base: 172, tipo_escala: 'plantao', recebe_por: 'dia',
  insalubridade: 'medio', periculosidade: false, adicional_noturno: false, valor_vr_dia: 0, valor_vt_dia: 35,
  horario: '07:00 às 19:00', ...o,
});

const params = (o: Partial<ParametrosCalculo> = {}): ParametrosCalculo => ({
  taxaAdmPorUnidade: new Map([[10, 32]]), taxaAdmPadrao: null, issPercentual: 0, issRetido: true,
  irrf: 1.5, pis: 0.65, cofins: 3, dar: 100 / 12, salarioMinimo: 1621, ...o,
});

describe('horasDoHorario', () => {
  it('lê o horário da vaga, inclusive virando a noite', () => {
    expect(horasDoHorario('07:00 às 19:00')).toBe(12);
    expect(horasDoHorario('19:00 às 07:00')).toBe(12);
    expect(horasDoHorario('22h às 05h')).toBe(7);
    expect(horasDoHorario('')).toBeNull();
  });
});

describe('calcularLinhaValores', () => {
  it('plantão diurno: remuneração, insalubridade ÷ 15, VT, DAR 1/12, taxa adm da unidade e retenções', () => {
    const v = calcularLinhaValores(linha(), vaga(), params());
    expect(v.unidade).toBe('plantão');
    expect(v.quantidade).toBe(3);
    expect(v.remuneracao).toBe(516);
    expect(v.insalubridade).toBe(64.84); // 1621 × 20% ÷ 15 = 21,6133 × 3
    expect(v.vt).toBe(105);
    expect(v.servicos_prestados).toBe(580.84);
    expect(v.total_cooperado).toBe(685.84);
    expect(v.prov_dar).toBe(48.4);
    expect(v.taxa_adm).toBe(234.96); // (685,84 + 48,40) × 32%
    expect(v.nf).toBe(969.2);
    expect(v.ret_ir).toBe(8.71);
    expect(v.ret_pis).toBe(6.3);
    expect(v.ret_cofins).toBe(29.08);
    expect(v.ret_iss).toBe(0);
    expect(v.fatura).toBe(925.11);
    expect(v.pendencias).toEqual([]);
  });

  it('ad. noturno e hora excedente pelo valor da hora (remuneração + insalubridade ÷ horas do plantão)', () => {
    const v = calcularLinhaValores(
      linha({ pl_diurno: 0, pl_noturno: 1, ad_noturno: 7, hora_excedente: 1 }),
      vaga({ adicional_noturno: true, horario: '19:00 às 07:00' }),
      params()
    );
    // valor hora = (172 + 21,6133) / 12 = 16,1344
    expect(v.valor_hora).toBe(16.13);
    expect(v.ad_noturno).toBe(22.59); // 16,1344 × 20% × 7
    expect(v.hora_excedente).toBe(24.2); // 16,1344 × 1,5
  });

  it('avisa horas noturnas apuradas em vaga sem adicional noturno e não cobra', () => {
    const v = calcularLinhaValores(linha({ ad_noturno: 3 }), vaga(), params());
    expect(v.ad_noturno).toBe(0);
    expect(v.pendencias[0]).toMatch(/Ad\. Noturno = Não/);
  });

  it('mensal: proporcional aos dias e desconta horas de falta', () => {
    const v = calcularLinhaValores(
      linha({ dias_mes_fechado: 30, dias_trabalhados: 22, horas_falta: 11 }),
      vaga({ tipo_escala: 'mensal', salario_base: 2200, insalubridade: 'sem_risco', valor_vt_dia: 10 }),
      params()
    );
    expect(v.remuneracao).toBe(2090); // 2200 − 2200/220 × 11
    expect(v.vt).toBe(220);
  });

  it('periculosidade só sem insalubridade', () => {
    const v = calcularLinhaValores(linha({ pl_diurno: 1 }), vaga({ insalubridade: 'sem_risco', periculosidade: true }), params());
    expect(v.periculosidade).toBe(51.6);
    expect(v.insalubridade).toBe(0);
  });

  it('sem taxa na unidade usa a taxa informada na tela; sem nenhuma, aponta pendência', () => {
    expect(calcularLinhaValores(linha({ unidade_id: 99 }), vaga(), params({ taxaAdmPadrao: 14 })).taxa_adm_percentual).toBe(14);
    const sem = calcularLinhaValores(linha({ unidade_id: 99 }), vaga(), params());
    expect(sem.taxa_adm).toBe(0);
    expect(sem.pendencias).toContain('Taxa de serviço não informada no Parâmetro.');
  });

  it('linha sem vaga sai zerada com o motivo', () => {
    const v = calcularLinhaValores(linha({ vaga_id: null }), null, params());
    expect(v.nf).toBe(0);
    expect(v.pendencias[0]).toMatch(/sem vaga/);
  });
});
