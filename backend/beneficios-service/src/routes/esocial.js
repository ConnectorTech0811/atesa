import { Router } from 'express';
import { obterUsuarioAutenticado, obterTipo, obterPermissoes } from '../../../shared/src/auth.js';
import { podeVerInterno } from '../utils/acessoInterno.js';
import * as repo from '../repositories/esocialRepository.js';
import * as servico from '../esocial/servico.js';
import { situacaoCertificado } from '../esocial/certificado.js';
import { MAX_EVENTOS_POR_LOTE } from '../esocial/webservice.js';
import { competenciaValida } from '../esocial/layouts.js';

/**
 * Integração com o eSocial.
 *  - Benefícios: cadastro (S-2300), remunerações (S-1200) e pagamentos (S-1210)
 *  - Faturamento: fechamento (S-1299) e reabertura (S-1298) da competência
 */
const router = Router();

/**
 * Acesso ao eSocial (mesma regra do frontend em auth/acessoESocial.ts):
 *  - Módulo "esocial": padrão para Benefícios; outros perfis só se liberados em Permissões e Grupos.
 *  - Itens "esocial.enviar", "esocial.importar", "esocial.configurar" podem ser bloqueados individualmente.
 *  - Módulo "esocial_fechamento": padrão para Faturamento; outros perfis só se liberados.
 *    O item "esocial_fechamento.reabrir" controla a reabertura (S-1298).
 *  - Administrador e Suporte têm acesso total.
 */
function acessoESocial(req) {
  const tipo = obterTipo(req);
  const p = obterPermissoes(req);
  const total = tipo === 'administrador' || tipo === 'suporte';
  const modulo = total || (tipo === 'beneficios' ? p.esocial !== false : p.esocial === true);
  const item = (id) => total || (modulo && p[id] !== false);
  const fechamento = total || (tipo === 'faturamento' ? p.esocial_fechamento !== false : p.esocial_fechamento === true);
  const reabrir = total || (fechamento && p['esocial_fechamento.reabrir'] !== false);
  return { modulo, item, fechamento, reabrir, leitura: modulo || fechamento || tipo === 'financeiro' };
}

function criarVerificador(regra, mensagem) {
  return function verificar(req, res) {
    const usuario = obterUsuarioAutenticado(req);
    if (!usuario) {
      res.status(401).json({ erro: 'Usuário não identificado.' });
      return false;
    }
    if (!regra(acessoESocial(req))) {
      res.status(403).json({ erro: mensagem });
      return false;
    }
    return usuario;
  };
}

const verificarLeitura = criarVerificador((a) => a.leitura, 'Acesso ao eSocial não liberado para seu usuário.');
const verificarModulo = criarVerificador((a) => a.modulo, 'Acesso ao eSocial não liberado para seu usuário.');
const verificarEnvio = criarVerificador((a) => a.item('esocial.enviar'), 'Seu usuário não tem permissão para enviar eventos ao eSocial.');
const verificarImportacao = criarVerificador((a) => a.item('esocial.importar'), 'Seu usuário não tem permissão para importar remunerações.');
const verificarConfiguracao = criarVerificador((a) => a.item('esocial.configurar'), 'Seu usuário não tem permissão para alterar a configuração do eSocial.');
const verificarFechamento = criarVerificador((a) => a.fechamento, 'Seu usuário não tem permissão para fechar a competência.');
const verificarReabertura = criarVerificador((a) => a.reabrir, 'Seu usuário não tem permissão para reabrir a competência.');

function json(v) {
  if (!v) return [];
  try { return JSON.parse(v); } catch { return []; }
}

/** Oculta nome/CPF de cooperado interno para quem não tem acesso a esses dados. */
function mascararInterno(req) {
  const pode = podeVerInterno(req);
  return (l) => (pode || l.tipo_contratacao !== 'interno')
    ? l
    : { ...l, nome: 'Cooperado interno (acesso restrito)', cpf: l.cpf ? `***.***.***-${String(l.cpf).slice(-2)}` : null };
}

function tratarErro(res, e, mensagemPadrao) {
  if (e instanceof servico.ErroESocial || e.status) {
    return res.status(e.status || 400).json({ erro: e.message });
  }
  console.error('[eSocial]', e);
  return res.status(500).json({ erro: e.message ? `${mensagemPadrao}: ${e.message}` : mensagemPadrao });
}

function idsValidos(v) {
  return Array.isArray(v) ? [...new Set(v.map(Number).filter((n) => Number.isInteger(n) && n > 0))] : [];
}

// ── Configuração ──────────────────────────────────────────────────────────────

router.get('/config', async (req, res) => {
  if (!verificarLeitura(req, res)) return;
  try {
    await repo.garantirTabelasESocial();
    res.json({ config: await repo.obterConfig(), certificado: situacaoCertificado(), maxEventosPorLote: MAX_EVENTOS_POR_LOTE });
  } catch (e) { tratarErro(res, e, 'Erro ao carregar configuração do eSocial'); }
});

router.put('/config', async (req, res) => {
  const u = verificarConfiguracao(req, res); if (!u) return;
  const d = req.body ?? {};
  if (d.ambiente !== undefined && ![1, 2].includes(Number(d.ambiente))) return res.status(400).json({ erro: 'Ambiente inválido.' });
  try {
    await repo.garantirTabelasESocial();
    await repo.salvarConfig(d, u.nome);
    res.json({ config: await repo.obterConfig() });
  } catch (e) { tratarErro(res, e, 'Erro ao salvar configuração do eSocial'); }
});

// ── Cadastro do cooperado (S-2300) ────────────────────────────────────────────

router.get('/cadastros', async (req, res) => {
  if (!verificarLeitura(req, res)) return;
  try {
    await repo.garantirTabelasESocial();
    const cfg = await repo.obterConfig();
    const linhas = await repo.listarSituacaoCadastro(Number(cfg.ambiente));
    res.json(linhas.map(mascararInterno(req)).map((l) => ({ ...l, ocorrencias: json(l.ocorrencias_json), ocorrencias_json: undefined })));
  } catch (e) { tratarErro(res, e, 'Erro ao listar cadastros no eSocial'); }
});

router.post('/cadastros/marcar-existentes', async (req, res) => {
  const u = verificarEnvio(req, res); if (!u) return;
  const ids = idsValidos(req.body?.candidatoIds);
  if (!ids.length) return res.status(400).json({ erro: 'Informe os cooperados.' });
  try {
    res.json(await servico.marcarCadastroExistente({ candidatoIds: ids, nrRecibo: req.body?.nrRecibo, usuarioNome: u.nome }));
  } catch (e) { tratarErro(res, e, 'Erro ao registrar cadastro existente'); }
});

// ── Envio de lotes (S-2300, S-1200, S-1210) ───────────────────────────────────

/**
 * Envia UM lote (até 50 eventos). Sem `candidatoIds` envia os próximos ainda
 * não enviados; a resposta traz `restantes` para a tela chamar novamente.
 */
router.post('/lotes/enviar', async (req, res) => {
  const u = verificarEnvio(req, res); if (!u) return;
  const { tipo, competencia, retificar } = req.body ?? {};
  try {
    const r = await servico.enviarLoteCooperados({
      tipo, competencia, candidatoIds: idsValidos(req.body?.candidatoIds), retificar: !!retificar, usuarioNome: u.nome,
    });
    const mascarar = mascararInterno(req);
    res.json({
      ...r,
      invalidos: r.invalidos.map(mascarar),
      ignorados: r.ignorados.map(mascarar),
    });
  } catch (e) { tratarErro(res, e, 'Erro ao enviar lote ao eSocial'); }
});

router.post('/lotes/consultar', async (req, res) => {
  if (!verificarLeitura(req, res)) return;
  try {
    res.json(await servico.consultarRetornos());
  } catch (e) { tratarErro(res, e, 'Erro ao consultar retorno do eSocial'); }
});

router.get('/lotes', async (req, res) => {
  if (!verificarLeitura(req, res)) return;
  try {
    await repo.garantirTabelasESocial();
    const cfg = await repo.obterConfig();
    const lotes = await repo.listarLotes(Number(cfg.ambiente), { limite: 100 });
    res.json(lotes.map((l) => ({ ...l, aceitos: Number(l.aceitos || 0), rejeitados: Number(l.rejeitados || 0) })));
  } catch (e) { tratarErro(res, e, 'Erro ao listar lotes'); }
});

// ── Histórico do cooperado ────────────────────────────────────────────────────

router.get('/cooperados/:id/historico', async (req, res) => {
  if (!verificarLeitura(req, res)) return;
  try {
    await repo.garantirTabelasESocial();
    const cfg = await repo.obterConfig();
    const linhas = await repo.listarHistoricoCooperado(Number(req.params.id), Number(cfg.ambiente));
    res.json(linhas.map((l) => ({ ...l, ocorrencias: json(l.ocorrencias_json), ocorrencias_json: undefined })));
  } catch (e) { tratarErro(res, e, 'Erro ao carregar histórico do eSocial'); }
});

router.get('/eventos/:id/xml', async (req, res) => {
  if (!verificarModulo(req, res)) return;
  try {
    await repo.garantirTabelasESocial();
    const ev = await repo.buscarEventoPorId(Number(req.params.id));
    if (!ev?.xml_evento) return res.status(404).json({ erro: 'XML não disponível para este evento.' });
    res.json({ xml: ev.xml_evento });
  } catch (e) { tratarErro(res, e, 'Erro ao carregar XML'); }
});

// ── Competências e remunerações ───────────────────────────────────────────────

function validarCompetenciaParam(req, res) {
  if (!competenciaValida(req.params.competencia)) {
    res.status(400).json({ erro: 'Competência inválida (use AAAA-MM).' });
    return false;
  }
  return true;
}

router.get('/competencias', async (req, res) => {
  if (!verificarLeitura(req, res)) return;
  try {
    await repo.garantirTabelasESocial();
    const cfg = await repo.obterConfig();
    res.json(await repo.listarCompetencias(Number(cfg.ambiente)));
  } catch (e) { tratarErro(res, e, 'Erro ao listar competências'); }
});

router.get('/competencias/:competencia', async (req, res) => {
  if (!verificarLeitura(req, res) || !validarCompetenciaParam(req, res)) return;
  try {
    res.json(await servico.resumoCompetencia(req.params.competencia));
  } catch (e) { tratarErro(res, e, 'Erro ao carregar competência'); }
});

/** Consulta de bloqueio para outros módulos (Financeiro): período fechado não aceita movimentação. */
router.get('/competencias/:competencia/bloqueio', async (req, res) => {
  if (!verificarLeitura(req, res) || !validarCompetenciaParam(req, res)) return;
  try {
    res.json(await servico.competenciaBloqueada(req.params.competencia));
  } catch (e) { tratarErro(res, e, 'Erro ao verificar bloqueio da competência'); }
});

router.get('/competencias/:competencia/remuneracoes', async (req, res) => {
  if (!verificarLeitura(req, res) || !validarCompetenciaParam(req, res)) return;
  try {
    await repo.garantirTabelasESocial();
    const cfg = await repo.obterConfig();
    const linhas = await repo.listarRemuneracoesComSituacao(req.params.competencia, Number(cfg.ambiente));
    res.json(linhas.map(mascararInterno(req)).map((l) => ({
      ...l,
      s1200_ocorrencias: json(l.s1200_ocorrencias),
      s1210_ocorrencias: json(l.s1210_ocorrencias),
    })));
  } catch (e) { tratarErro(res, e, 'Erro ao listar remunerações'); }
});

router.post('/competencias/:competencia/remuneracoes/importar', async (req, res) => {
  const u = verificarImportacao(req, res); if (!u) return;
  if (!validarCompetenciaParam(req, res)) return;
  try {
    const r = await servico.importarRemuneracoes({ competencia: req.params.competencia, linhas: req.body?.linhas, usuarioNome: u.nome });
    // 200 mesmo com erros: a tela precisa da lista de erros por linha (nada é gravado nesse caso)
    res.json(r);
  } catch (e) { tratarErro(res, e, 'Erro ao importar remunerações'); }
});

router.delete('/competencias/:competencia/remuneracoes/:candidatoId', async (req, res) => {
  if (!verificarImportacao(req, res) || !validarCompetenciaParam(req, res)) return;
  try {
    await servico.removerRemuneracao({ competencia: req.params.competencia, candidatoId: Number(req.params.candidatoId) });
    res.json({ ok: true });
  } catch (e) { tratarErro(res, e, 'Erro ao remover remuneração'); }
});

router.post('/competencias/:competencia/fechar', async (req, res) => {
  const u = verificarFechamento(req, res); if (!u) return;
  if (!validarCompetenciaParam(req, res)) return;
  if (req.body?.confirmaFaturamento !== true) {
    return res.status(400).json({ erro: 'Confirme que todos os faturamentos da competência foram emitidos.' });
  }
  try {
    res.json(await servico.fecharCompetencia({ competencia: req.params.competencia, usuarioNome: u.nome }));
  } catch (e) { tratarErro(res, e, 'Erro ao fechar competência'); }
});

router.post('/competencias/:competencia/reabrir', async (req, res) => {
  const u = verificarReabertura(req, res); if (!u) return;
  if (!validarCompetenciaParam(req, res)) return;
  try {
    res.json(await servico.reabrirCompetencia({ competencia: req.params.competencia, usuarioNome: u.nome }));
  } catch (e) { tratarErro(res, e, 'Erro ao reabrir competência'); }
});

export default router;
