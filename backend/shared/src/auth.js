/**
 * Utilitários de autenticação compartilhados entre todos os microsserviços.
 * Todos os cabeçalhos são injetados pelo API Gateway (injetarIdentidade).
 */

/** Extrai identidade do usuário a partir dos cabeçalhos internos. */
export function obterUsuarioAutenticado(req) {
  const id = req.headers['x-usuario-id'];
  const nomeCodificado = req.headers['x-usuario-nome'];
  if (!id || !nomeCodificado) return null;
  return { id: Number(id), nome: decodeURIComponent(nomeCodificado) };
}

/** Lê o tipo/perfil do usuário autenticado. */
export function obterTipo(req) {
  return req.headers['x-usuario-tipo'] ?? null;
}

/**
 * Cria uma função `verificarAcesso` para um módulo específico.
 * Retorna o usuário autenticado ou responde com 403/401 e retorna false.
 *
 * @param {string[]} perfisAutorizados - Ex.: ['administrador', 'ra']
 * @param {string}   nomeModulo        - Usado na mensagem de erro (ex.: 'RA')
 */
export function criarVerificadorAcesso(perfisAutorizados, nomeModulo) {
  return function verificarAcesso(req, res) {
    const tipo = obterTipo(req);
    if (!tipo || !perfisAutorizados.includes(tipo)) {
      res.status(403).json({ erro: `Acesso restrito ao módulo ${nomeModulo}.` });
      return false;
    }
    const usuario = obterUsuarioAutenticado(req);
    if (!usuario) {
      res.status(401).json({ erro: 'Usuário não identificado.' });
      return false;
    }
    return usuario;
  };
}
