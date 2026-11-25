import { describe, expect, it } from 'vitest';
import { aliquotaEmPercentual, corrigirPisGravadoErrado } from './aliquotas';

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
