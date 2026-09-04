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

/** Lê as permissões repassadas pelo Gateway ou requisição interna */
export function obterPermissoes(req) {
  const permsHeader = req.headers['x-usuario-permissoes'];
  if (!permsHeader) return {};
  try {
    return JSON.parse(decodeURIComponent(permsHeader));
  } catch {
    return {};
  }
}

/**
 * Cria uma função `verificarAcesso` para um módulo específico.
 * Retorna o usuário autenticado ou responde com 403/401 e retorna false.
 *
 * @param {string[]} perfisAutorizados - Ex.: ['administrador', 'ra']
 * @param {string}   nomeModulo        - Usado na mensagem de erro (ex.: 'RA')
 * @param {string}   [moduloId]        - ID da funcionalidade (ex.: 'ra', 'beneficios')
 */
export function criarVerificadorAcesso(perfisAutorizados, nomeModulo, moduloId) {
  return function verificarAcesso(req, res) {
    const usuario = obterUsuarioAutenticado(req);
    if (!usuario) {
      res.status(401).json({ erro: 'Usuário não identificado.' });
      return false;
    }
    const tipo = obterTipo(req);
    if (tipo === 'administrador') return usuario;

    const permissoes = obterPermissoes(req);
    // Se a permissão foi definida no grupo ou usuário
    if (moduloId && moduloId in permissoes) {
      if (permissoes[moduloId] === true) {
        return usuario;
      }
      if (permissoes[moduloId] === false) {
        res.status(403).json({ erro: `Acesso ao módulo ${nomeModulo} desabilitado para seu perfil.` });
        return false;
      }
    }

    if (perfisAutorizados && perfisAutorizados.length > 0) {
      if (!tipo || !perfisAutorizados.includes(tipo)) {
        res.status(403).json({ erro: `Acesso restrito ao módulo ${nomeModulo}.` });
        return false;
      }
    }
    return usuario;
  };
}
