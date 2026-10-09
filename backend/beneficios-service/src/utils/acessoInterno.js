/** Dados de cooperado interno só podem ser vistos por administrador, suporte, Edilaine e Raquel. */
export function podeVerInterno(req) {
  const tipo = req.headers['x-usuario-tipo'];
  if (tipo === 'administrador' || tipo === 'suporte') return true;
  const nomeCodificado = req.headers['x-usuario-nome'];
  const nome = nomeCodificado ? decodeURIComponent(nomeCodificado).toLowerCase() : '';
  const emailCodificado = req.headers['x-usuario-email'];
  const email = emailCodificado ? decodeURIComponent(emailCodificado).toLowerCase() : '';
  return nome.includes('edilaine') || nome.includes('raquel') || email.includes('edilaine') || email.includes('raquel');
}
