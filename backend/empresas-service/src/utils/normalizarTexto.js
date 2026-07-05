/** Remove acentos, baixa a caixa e tira espaços nas pontas — base para busca fonética/fuzzy. */
export function normalizarTexto(texto) {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}
