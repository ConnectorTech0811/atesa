import { describe, expect, it } from 'vitest';
import { aliquotaEmPercentual, corrigirInsalubridadeLegada, corrigirPisGravadoErrado } from './aliquotas';

describe('aliquotaEmPercentual', () => {
  it('PIS em fração (seed) e em percentual (salvo pela tela) dão 0,65%', () => {
    expect(aliquotaEmPercentual(0.0065, 1)).toBe(0.65);
    expect(aliquotaEmPercentual(0.65, 1)).toBe(0.65);
  });
  it('INSS 0,20 (fração) vira 20%; 20 continua 20', () => {
    expect(aliquotaEmPercentual(0.2, 1)).toBe(20);
    expect(aliquotaEmPercentual(20, 1)).toBe(20);
  });
  it('vazio usa o padrão', () => {
    expect(aliquotaEmPercentual(null, 3)).toBe(3);
    expect(aliquotaEmPercentual('', 3)).toBe(3);
  });
});

describe('corrigirPisGravadoErrado', () => {
  it('65 volta para 0,65; valores corretos não mudam', () => {
    expect(corrigirPisGravadoErrado({ pis_percentual: 65 }).pis_percentual).toBe(0.65);
    expect(corrigirPisGravadoErrado({ pis_percentual: 0.65 }).pis_percentual).toBe(0.65);
    expect(corrigirPisGravadoErrado({} as { pis_percentual?: number }).pis_percentual).toBeUndefined();
  });
});

describe('corrigirInsalubridadeLegada', () => {
  it('troca 8/9/11 gravados pelo padrão de Taxas e Impostos (ou 10/20/40)', () => {
    const r = corrigirInsalubridadeLegada({ insalubridade_pre_pct: 8, insalubridade_media_pct: 9, insalubridade_maxima_pct: 11 });
    expect(r).toMatchObject({ insalubridade_pre_pct: 10, insalubridade_media_pct: 20, insalubridade_maxima_pct: 40 });
    const t = corrigirInsalubridadeLegada({ insalubridade_pre_pct: '8.00' }, { insalubridade_pre_pct: 12 });
    expect(t.insalubridade_pre_pct).toBe(12);
  });
  it('mantém valor escolhido diferente do legado', () => {
    expect(corrigirInsalubridadeLegada({ insalubridade_pre_pct: 15 }).insalubridade_pre_pct).toBe(15);
  });
});
