/**
 * Valida CNPJ no formato tradicional (apenas dígitos) e no novo formato
 * alfanumérico (letras A-Z + dígitos), onde letras valem charCode - 48.
 * Os 2 últimos caracteres (dígitos verificadores) são sempre numéricos.
 */
export function validarCnpj(cnpj) {
  // Remove máscara (pontos, barras, hífens), mantém letras e dígitos
  const raw = String(cnpj).replace(/[.\-\/\s]/g, '').toUpperCase();
  if (raw.length !== 14) return false;

  // Rejeita sequências uniformes (ex.: 00000000000000, AAAAAAAAAAAAAA)
  if (/^(.)\1{13}$/.test(raw)) return false;

  // Converte cada caractere: dígito → número, letra → charCode − 48 (A=17…Z=42)
  const charToVal = (c) => {
    const code = c.charCodeAt(0);
    return code >= 48 && code <= 57 ? code - 48 : code - 48;
  };
  const vals = raw.split('').map(charToVal);

  const calcDigito = (tamanho) => {
    const pesos = tamanho === 12
      ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
      : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < tamanho; i++) soma += vals[i] * pesos[i];
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  // Os dois últimos devem ser dígitos numéricos
  if (!/^\d$/.test(raw[12]) || !/^\d$/.test(raw[13])) return false;

  const d1 = calcDigito(12);
  const d2 = calcDigito(13);
  return d1 === vals[12] && d2 === vals[13];
}
