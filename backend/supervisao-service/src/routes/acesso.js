import { obterUsuarioAutenticado, obterTipo, obterPermissoes } from '../../../shared/src/auth.js';

/**
 * Acesso a Escalas e Faturamento (mesma regra do frontend em DashboardLayout.tsx, Sidebar.tsx
 * e auth/acessoFaturamento.ts):
 *  - Módulo "monitoramento": padrão para Supervisão; outros perfis só se liberados em Permissões e Grupos.
 *  - Itens "monitoramento.escalas" e "monitoramento.faturamento" podem ser bloqueados individualmente.
 *  - Perfil Faturamento: Faturamento liberado por padrão, sem depender do módulo Monitoramento.
 *  - Perfil Escalista: somente Escalas, liberadas por padrão (demais rotas bloqueadas em shared/restricoesPerfil.js).
 *  - Administrador e Suporte têm acesso total.
 */
export function podeAcessarItemMonitoramento(req, item) {
  const tipo = obterTipo(req);
  if (tipo === 'administrador' || tipo === 'suporte') return true;
  const p = obterPermissoes(req);
  if (tipo === 'faturamento' && item === 'monitoramento.faturamento') return p[item] !== false;
  // Escalista: somente Escalas, liberadas por padrão e sem depender do módulo Monitoramento
  if (tipo === 'escalista') return item === 'monitoramento.escalas' && p[item] !== false;
  const modulo = tipo === 'supervisao' ? p.monitoramento !== false : p.monitoramento === true;
  return modulo && p[item] !== false;
}

/**
 * Acesso ao módulo Financeiro (mesma regra do frontend em auth/acessoFinanceiro.ts):
 *  - Perfil Financeiro: liberado por padrão; itens podem ser bloqueados individualmente.
 *  - Demais perfis: só se o módulo "financeiro" for liberado em Permissões e Grupos.
 *  - Administrador e Suporte têm acesso total, exceto aos itens restritos (ITENS_FINANCEIRO_RESTRITOS),
 *    que exigem concessão explícita para qualquer perfil diferente de Administrador.
 */
export function podeAcessarItemFinanceiro(req, item) {
  const tipo = obterTipo(req);
  if (tipo === 'escalista') return false; // perfil restrito às Escalas
  const p = obterPermissoes(req);
  // Itens restritos (ex.: liberar pagamento por exceção): só Administrador ou concessão explícita
  if (ITENS_FINANCEIRO_RESTRITOS.includes(item)) {
    if (tipo === 'administrador') return true;
    const modulo = tipo === 'financeiro' ? p.financeiro !== false : p.financeiro === true;
    return modulo && p[item] === true;
  }
  if (tipo === 'administrador' || tipo === 'suporte') return true;
  const modulo = tipo === 'financeiro' ? p.financeiro !== false : p.financeiro === true;
  return modulo && p[item] !== false;
}

/** Itens do Financeiro que não vêm liberados por padrão para nenhum perfil além do Administrador. */
export const ITENS_FINANCEIRO_RESTRITOS = ['financeiro.excecao_pagamento'];

/** Mesma regra de beneficios-service/src/utils/acessoInterno.js. */
export function podeVerCooperadoInterno(req) {
  const tipo = obterTipo(req);
  if (tipo === 'administrador' || tipo === 'suporte') return true;
  const nome = String(obterUsuarioAutenticado(req)?.nome ?? '').toLowerCase();
  const email = decodeURIComponent(req.headers['x-usuario-email'] ?? '').toLowerCase();
  return nome.includes('edilaine') || nome.includes('raquel') || email.includes('edilaine') || email.includes('raquel');
}

/** Exige ao menos uma das verificações [função, item]; responde 401/403 caso contrário. */
export function exigirAcesso(verificacoes, mensagem) {
  return (req, res, next) => {
    if (!obterUsuarioAutenticado(req)) return res.status(401).json({ erro: 'Usuário não identificado.' });
    if (!verificacoes.some(([fn, item]) => fn(req, item))) return res.status(403).json({ erro: mensagem });
    next();
  };
}

/** Usuário autenticado com perfil e IP, para as trilhas de auditoria. */
export function usuarioAuditoria(req) {
  const u = obterUsuarioAutenticado(req) || {};
  return {
    id: u.id ?? null,
    nome: u.nome ?? null,
    perfil: obterTipo(req),
    ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 45) || null,
  };
}
