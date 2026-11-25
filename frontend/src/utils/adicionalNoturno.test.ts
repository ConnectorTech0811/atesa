import { describe, expect, it } from 'vitest';
import { calcularAdicionalNoturno, valorInsalubridadeMensal, valorInsalubridadeUnitario } from './adicionalNoturno';

describe('valorInsalubridadeMensal', () => {
  it('salário mínimo × grau: Pré 10% = 162,10, Média 20%, Máxima 40%', () => {
    expect(valorInsalubridadeMensal('pre')).toBeCloseTo(162.1, 2);
    expect(valorInsalubridadeMensal('media')).toBeCloseTo(324.2, 2);
    expect(valorInsalubridadeMensal('maxima')).toBeCloseTo(648.4, 2);
    expect(valorInsalubridadeMensal('sem_risco')).toBe(0);
  });
});

describe('valorInsalubridadeUnitario', () => {
  it('plantão: valor mensal ÷ 15 (Média: 21,61 como nas planilhas da ATESA)', () => {
    expect(Math.round(valorInsalubridadeUnitario('plantao', 'media') * 100) / 100).toBe(21.61);
    expect(Math.round(valorInsalubridadeUnitario('plantao', 'pre') * 100) / 100).toBe(10.81);
    expect(Math.round(valorInsalubridadeUnitario('12x36', 'maxima') * 100) / 100).toBe(43.23);
  });
  it('mensal integral; procedimento ÷ 30; sem risco = 0', () => {
    expect(valorInsalubridadeUnitario('mensal', 'media')).toBeCloseTo(324.2, 2);
    expect(valorInsalubridadeUnitario('por_procedimento', 'media')).toBeCloseTo(10.8067, 3);
    expect(valorInsalubridadeUnitario('plantao', 'sem_risco')).toBe(0);
  });
});

describe('calcularAdicionalNoturno', () => {
  it('plantão com insalubridade pré (caso GRALAB): (70 + 10,81) ÷ 12 × 8 × 20%', () => {
    expect(calcularAdicionalNoturno({
      salario_base: 70, tipo_escala: 'plantao', adicional_noturno: true, insalubridade: 'pre', periculosidade: false,
    })).toBe(10.77);
  });

  it('não calcula quando o flag é Não', () => {
    expect(calcularAdicionalNoturno({ salario_base: 70, tipo_escala: 'plantao', adicional_noturno: false })).toBe(0);
    expect(calcularAdicionalNoturno({ salario_base: 70, tipo_escala: 'plantao', adicional_noturno: 0 })).toBe(0);
  });

  it('aceita flag vindo do banco como 1 e salário como texto', () => {
    expect(calcularAdicionalNoturno({ salario_base: '120.00', tipo_escala: '12x36', adicional_noturno: 1 })).toBe(16);
  });

  it('mensal usa 220 h e 21 dias', () => {
    // (2000 + 1621×20%) / 220 × 8 × 21 × 20%
    expect(calcularAdicionalNoturno({
      salario_base: 2000, tipo_escala: 'mensal', adicional_noturno: true, insalubridade: 'media',
    })).toBe(354.97);
  });

  it('periculosidade só entra sem insalubridade', () => {
    expect(calcularAdicionalNoturno({
      salario_base: 120, tipo_escala: 'plantao', adicional_noturno: true, insalubridade: 'sem_risco', periculosidade: true,
    })).toBe(20.8);
  });
});
