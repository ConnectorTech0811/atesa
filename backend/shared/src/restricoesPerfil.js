/**
 * Perfis com acesso restrito a um conjunto fechado de rotas da API (lista de permissões).
 * Aplicado logo após a autenticação, no gateway (desenvolvimento) e em api/index.js (Vercel),
 * para que a limitação não dependa de cada serviço checar o perfil.
 *
 * Escalista: somente Escalas de plantão (lançar escalas, cadastrar pacientes/locais e conferir horas),
 * além das próprias permissões efetivas e da troca da própria senha.
 */
const ESCALAS = /^\/api\/(?:supervisao\/|monitoramento\/)?escalas(?:\/|$)/;

export const PERFIS_RESTRITOS = {
  escalista: [
    (metodo, caminho) => ESCALAS.test(caminho),
    (metodo, caminho, usuarioId) => metodo === 'GET' && caminho === `/api/usuarios/${usuarioId}/permissoes-efetivas`,
    (metodo, caminho, usuarioId) => metodo === 'PATCH' && caminho === `/api/usuarios/${usuarioId}/senha`,
  ],
};

/** true = o perfil pode chamar a rota (perfis sem restrição sempre podem). `caminho` começa com /api. */
export function rotaPermitidaParaPerfil(tipo, metodo, caminho, usuarioId) {
  const regras = PERFIS_RESTRITOS[tipo];
  if (!regras) return true;
  const limpo = String(caminho || '').split('?')[0].replace(/\/+$/, '') || '/';
  return regras.some((regra) => regra(String(metodo || '').toUpperCase(), limpo, String(usuarioId ?? '')));
}

/** Middleware Express: usa req.usuario (já validado pelo token) e o caminho completo da requisição. */
export function restringirPorPerfil(req, res, next) {
  const tipo = req.usuario?.tipoUsuario;
  if (!tipo || !PERFIS_RESTRITOS[tipo]) return next();
  if (rotaPermitidaParaPerfil(tipo, req.method, req.originalUrl, req.usuario.id)) return next();
  return res.status(403).json({ erro: 'Seu perfil tem acesso somente às Escalas de plantão.' });
}
