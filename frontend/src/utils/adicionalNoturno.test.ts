import { describe, expect, it } from 'vitest';
import { calcularAdicionalNoturno } from './adicionalNoturno';

describe('calcularAdicionalNoturno', () => {
  it('plantão com insalubridade pré (caso GRALAB): (70 + 14) / 12 × 8 × 20%', () => {
    expect(calcularAdicionalNoturno({
      salario_base: 70, tipo_escala: 'plantao', adicional_noturno: true, insalubridade: 'pre', periculosidade: false,
    })).toBe(11.2);
  });

  it('não calcula quando o flag é Não', () => {
    expect(calcularAdicionalNoturno({ salario_base: 70, tipo_escala: 'plantao', adicional_noturno: false })).toBe(0);
    expect(calcularAdicionalNoturno({ salario_base: 70, tipo_escala: 'plantao', adicional_noturno: 0 })).toBe(0);
  });

  it('aceita flag vindo do banco como 1 e salário como texto', () => {
    expect(calcularAdicionalNoturno({ salario_base: '120.00', tipo_escala: '12x36', adicional_noturno: 1 })).toBe(16);
  });

  it('mensal usa 220 h e 21 dias; insalubridade limitada ao salário mínimo', () => {
    // (2000 + 1621×20%) / 220 × 8 × 21 × 20%
    expect(calcularAdicionalNoturno({
      salario_base: 2000, tipo_escala: 'mensal', adicional_noturno: true, insalubridade: 'medio',
    })).toBe(354.97);
  });

  it('periculosidade só entra sem insalubridade', () => {
    expect(calcularAdicionalNoturno({
      salario_base: 120, tipo_escala: 'plantao', adicional_noturno: true, insalubridade: 'sem_risco', periculosidade: true,
    })).toBe(20.8);
  });
});
