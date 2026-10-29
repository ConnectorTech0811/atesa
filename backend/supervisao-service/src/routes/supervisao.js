import { Router } from 'express';
import { obterTipo, obterUsuarioAutenticado } from '../../../shared/src/auth.js';
import { podeAcessarItemMonitoramento, exigirAcesso } from './acesso.js';
import financeiroRoutes from './financeiro.js';
import {
  obterResumoDashboard,
  listarCooperadosMonitoramento,
  obterDetalhesCooperadoMonitoramento,
  listarTodosApontamentos,
  listarClientesApontamentos,
  obterApontamentoPorId,
  editarApontamento,
  adicionarObservacaoApontamento,
  listarObservacoesApontamento,
  excluirObservacaoApontamento,
  listarLogsAuditoria,
  criarComplementoCooperado,
  excluirComplemento,
  listarVagasDisponiveis,
  alterarOperacaoCooperado,
  solicitarResetSenhaCooperado,
  confirmarResetSenhaCooperado,
  gerarRelatorioIndividual,
  gerarRelatorioPorVaga,
  gerarRelatorioGeralSupervisao,
} from '../repositories/supervisaoRepository.js';
import {
  listarOpcoesEscala,
  listarPacientes,
  criarPaciente,
  atualizarPaciente,
  listarEscalas,
  criarEscala,
  atualizarEscala,
  excluirEscala,
  previaSubstituicao,
  listarSubstituicoes,
  substituirCooperado,
  conferenciaPlantoes,
  importarValoresCliente,
  listarValoresCliente,
  excluirValoresCliente,
  gerarPlanilhaFaturamento,
} from '../repositories/escalaFaturamentoRepository.js';
import {
  listarUnidadesFaturamento,
  listarProcessos,
  criarProcesso,
  atualizarProcesso,
  obterProcesso,
  apurarProcesso,
  conferirItens,
  registrarAjuste,
  removerAjuste,
  registrarDivergencia,
  resolverDivergencia,
  aprovarProcesso,
  rejeitarProcesso,
  cancelarProcesso,
  listarAuditoriaProcesso,
} from '../repositories/faturamentoProcessoRepository.js';
import {
  obterRegrasApuracao,
  salvarRegrasApuracao,
  restaurarRegrasPadrao,
  listarClientesComRegra,
  listarHistoricoRegras,
} from '../repositories/regrasApuracaoRepository.js';
import { obterModeloPlanilha, salvarModeloPlanilha } from '../repositories/modeloPlanilhaRepository.js';
import {
  listarEscalistas,
  detalharEscalista,
  liberarCliente,
  removerCliente,
  definirTodosClientes,
  clientesPermitidos,
} from '../repositories/escalistasRepository.js';
import {
  listarSituacaoVagas,
  listarSolicitacoes,
  criarSolicitacao,
  aprovarSolicitacao,
  encerrarSolicitacao,
  listarCandidatosPosicao,
  alterarPosicao,
} from '../repositories/solicitacoesVagaRepository.js';

const router = Router();

function extrairUsuario(req) {
  if (req.usuario) {
    return {
      id: Number(req.usuario.id),
      nome: req.usuario.nome || 'Usuário do Sistema',
      tipoUsuario: req.usuario.tipoUsuario || req.usuario.tipo_usuario || 'supervisao',
      email: req.usuario.email || '',
      cpf: req.usuario.cpf || '',
      candidatoId: req.usuario.candidatoId || req.usuario.candidato_id || null,
    };
  }

  const id = Number(req.headers['x-usuario-id'] || 1);
  const nome = req.headers['x-usuario-nome'] ? decodeURIComponent(req.headers['x-usuario-nome']) : 'Usuário do Sistema';
  const tipoUsuario = req.headers['x-usuario-tipo'] || 'supervisao';

  return { id, nome, tipoUsuario, email: '', cpf: '', candidatoId: null };
}

// ── 1. Dashboard de Monitoramento ───────────────────────────────────────────
router.get(['/dashboard', '/supervisao/dashboard', '/monitoramento/dashboard'], async (req, res) => {
  try {
    const { periodo, dataInicio, dataFim, candidatoId, empresaId, status } = req.query;
    const resumo = await obterResumoDashboard({
      periodo,
      dataInicio,
      dataFim,
      candidatoId,
      empresaId,
      status,
    });
    res.json(resumo);
  } catch (err) {
    console.error('Erro ao obter dashboard de monitoramento:', err);
    res.status(500).json({ erro: err.message || 'Erro ao carregar métricas de monitoramento.' });
  }
});

// ── 2. Listagem de Cooperados ───────────────────────────────────────────────
router.get(['/cooperados', '/supervisao/cooperados', '/monitoramento/cooperados'], async (req, res) => {
  try {
    const { busca, status, empresaId, vagaId, dataInicio, dataFim, limite, pagina } = req.query;
    const cooperados = await listarCooperadosMonitoramento({
      busca,
      status,
      empresaId,
      vagaId,
      dataInicio,
      dataFim,
      limite,
      pagina,
    });
    res.json(cooperados);
  } catch (err) {
    console.error('Erro ao listar cooperados:', err);
    res.status(500).json({ erro: err.message || 'Erro ao listar cooperados.' });
  }
});

// ── 3. Detalhes de um Cooperado (Monitoramento Individual) ───────────────────
router.get(['/cooperados/:id', '/supervisao/cooperados/:id', '/monitoramento/cooperados/:id'], async (req, res) => {
  try {
    const candidatoId = Number(req.params.id);
    const { dataInicio, dataFim } = req.query;
    const detalhes = await obterDetalhesCooperadoMonitoramento(candidatoId, { dataInicio, dataFim });

    if (!detalhes) {
      return res.status(404).json({ erro: 'Cooperado não encontrado.' });
    }

    res.json(detalhes);
  } catch (err) {
    console.error('Erro ao obter detalhes do cooperado:', err);
    res.status(500).json({ erro: err.message || 'Erro ao obter dados do cooperado.' });
  }
});

// ── 4. Listagem Geral de Apontamentos ───────────────────────────────────────
router.get(['/apontamentos', '/supervisao/apontamentos', '/monitoramento/apontamentos'], async (req, res) => {
  try {
    const { busca, candidatoId, empresaId, vagaId, tipoEvento, status, apenasAjustados, dataInicio, dataFim, horaInicio, horaFim, limite, pagina } = req.query;
    const apontamentos = await listarTodosApontamentos({
      busca,
      candidatoId,
      empresaId,
      vagaId,
      tipoEvento,
      status,
      apenasAjustados: apenasAjustados === 'true' || apenasAjustados === '1',
      dataInicio,
      dataFim,
      horaInicio,
      horaFim,
      limite,
      pagina,
    });
    res.json(apontamentos);
  } catch (err) {
    console.error('Erro ao listar apontamentos:', err);
    res.status(500).json({ erro: err.message || 'Erro ao listar apontamentos.' });
  }
});

router.get(['/clientes-apontamentos', '/supervisao/clientes-apontamentos', '/monitoramento/clientes-apontamentos'], async (_req, res) => {
  try {
    res.json(await listarClientesApontamentos());
  } catch (err) {
    console.error('Erro ao listar clientes dos apontamentos:', err);
    res.status(500).json({ erro: err.message || 'Erro ao listar clientes.' });
  }
});

// ── 5. Buscar Apontamento por ID ────────────────────────────────────────────
router.get(['/apontamentos/:id', '/supervisao/apontamentos/:id', '/monitoramento/apontamentos/:id'], async (req, res) => {
  try {
    const id = Number(req.params.id);
    const apontamento = await obterApontamentoPorId(id);
    if (!apontamento) {
      return res.status(404).json({ erro: 'Apontamento não encontrado.' });
    }
    res.json(apontamento);
  } catch (err) {
    console.error('Erro ao obter apontamento:', err);
    res.status(500).json({ erro: err.message || 'Erro ao buscar apontamento.' });
  }
});

// ── 6. Edição de Apontamento (Ajuste pela Supervisão) ────────────────────────
router.put(['/apontamentos/:id', '/supervisao/apontamentos/:id', '/monitoramento/apontamentos/:id'], async (req, res) => {
  try {
    const id = Number(req.params.id);
    const usuarioLogado = extrairUsuario(req);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const { dataReferencia, timestampDispositivo, tipoEvento, atividade, observacao, motivo, status } = req.body ?? {};

    if (!motivo && !observacao) {
      return res.status(400).json({ erro: 'Informe obrigatoriamente a justificativa/motivo do ajuste.' });
    }

    const resultado = await editarApontamento(
      id,
      { dataReferencia, timestampDispositivo, tipoEvento, atividade, observacao, motivo, status },
      usuarioLogado,
      ip
    );

    res.json(resultado);
  } catch (err) {
    console.error('Erro ao editar apontamento:', err);
    const statusCode = err.status || (err.message && err.message.includes('não pode editar o próprio registro') ? 403 : 500);
    res.status(statusCode).json({ erro: err.message || 'Erro ao processar edição de apontamento.' });
  }
});

// ── 7a. Histórico de Observações do Apontamento ──────────────────────────────
router.get(['/apontamentos/:id/observacoes', '/supervisao/apontamentos/:id/observacoes', '/monitoramento/apontamentos/:id/observacoes'], async (req, res) => {
  try {
    res.json(await listarObservacoesApontamento(Number(req.params.id)));
  } catch (err) {
    console.error('Erro ao listar observações:', err);
    res.status(500).json({ erro: 'Erro ao carregar o histórico de observações.' });
  }
});

// Somente o Administrador exclui observações (exclusão lógica, registrada na auditoria)
router.delete(['/apontamentos/:id/observacoes/:obsId', '/supervisao/apontamentos/:id/observacoes/:obsId', '/monitoramento/apontamentos/:id/observacoes/:obsId'], async (req, res) => {
  if (!obterUsuarioAutenticado(req)) return res.status(401).json({ erro: 'Usuário não identificado.' });
  if (obterTipo(req) !== 'administrador') return res.status(403).json({ erro: 'Somente o Administrador pode excluir observações.' });
  try {
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    res.json(await excluirObservacaoApontamento(Number(req.params.id), Number(req.params.obsId), extrairUsuario(req), ip));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ erro: err.message });
    console.error('Erro ao excluir observação:', err);
    res.status(500).json({ erro: 'Erro ao excluir observação.' });
  }
});

// ── 7. Inserir Observação em Apontamento ─────────────────────────────────────
router.post(['/apontamentos/:id/observacao', '/supervisao/apontamentos/:id/observacao', '/monitoramento/apontamentos/:id/observacao'], async (req, res) => {
  try {
    const id = Number(req.params.id);
    const usuarioLogado = extrairUsuario(req);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const { observacao, motivo, ehAjuste } = req.body ?? {};

    if (!observacao || !observacao.trim()) {
      return res.status(400).json({ erro: 'Informe o texto da observação.' });
    }

    const resultado = await adicionarObservacaoApontamento(
      id,
      { observacao, motivo, ehAjuste: Boolean(ehAjuste) },
      usuarioLogado,
      ip
    );

    res.json(resultado);
  } catch (err) {
    console.error('Erro ao adicionar observação:', err);
    res.status(500).json({ erro: err.message || 'Erro ao adicionar observação.' });
  }
});

// ── 8. Horas Complementares & Bonificações ──────────────────────────────────
router.post(['/cooperados/:id/complementos', '/supervisao/cooperados/:id/complementos', '/monitoramento/cooperados/:id/complementos'], async (req, res) => {
  try {
    const candidatoId = Number(req.params.id);
    const usuarioLogado = extrairUsuario(req);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const resultado = await criarComplementoCooperado(candidatoId, req.body ?? {}, usuarioLogado, ip);
    res.status(201).json(resultado);
  } catch (err) {
    console.error('Erro ao criar complemento:', err);
    res.status(err.status || 500).json({ erro: err.message || 'Erro ao registrar complemento de horas.' });
  }
});

router.delete(['/complementos/:id', '/supervisao/complementos/:id', '/monitoramento/complementos/:id'], async (req, res) => {
  try {
    const id = Number(req.params.id);
    const usuarioLogado = extrairUsuario(req);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;
    const { motivo } = req.body ?? {};

    const resultado = await excluirComplemento(id, motivo, usuarioLogado, ip);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao excluir complemento:', err);
    res.status(err.status || 500).json({ erro: err.message || 'Erro ao excluir complemento.' });
  }
});

// ── 9. Alteração de Operação Vigente (Vagas, Turno, Atividade) ───────────────
router.get(['/vagas-disponiveis', '/supervisao/vagas-disponiveis', '/monitoramento/vagas-disponiveis'], async (_req, res) => {
  try {
    const vagas = await listarVagasDisponiveis();
    res.json(vagas);
  } catch (err) {
    console.error('Erro ao listar vagas disponíveis:', err);
    res.status(500).json({ erro: err.message || 'Erro ao listar vagas.' });
  }
});

router.post(['/cooperados/:id/alterar-operacao', '/supervisao/cooperados/:id/alterar-operacao', '/monitoramento/cooperados/:id/alterar-operacao'], async (req, res) => {
  try {
    const candidatoId = Number(req.params.id);
    const usuarioLogado = extrairUsuario(req);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const resultado = await alterarOperacaoCooperado(candidatoId, req.body ?? {}, usuarioLogado, ip);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao alterar operação:', err);
    res.status(500).json({ erro: err.message || 'Erro ao alterar dados da operação.' });
  }
});

// ── 10. Reset de Senha do Cooperado ──────────────────────────────────────────
router.post(['/cooperados/:id/solicitar-reset-senha', '/supervisao/cooperados/:id/solicitar-reset-senha', '/monitoramento/cooperados/:id/solicitar-reset-senha'], async (req, res) => {
  try {
    const candidatoId = Number(req.params.id);
    const usuarioLogado = extrairUsuario(req);
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || null;

    const resultado = await solicitarResetSenhaCooperado(candidatoId, usuarioLogado, ip);
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao solicitar reset de senha:', err);
    res.status(500).json({ erro: err.message || 'Erro ao solicitar reset de senha.' });
  }
});

router.post(['/cooperados/confirmar-reset-senha', '/supervisao/cooperados/confirmar-reset-senha', '/monitoramento/cooperados/confirmar-reset-senha', '/portal/cooperado/confirmar-reset-senha'], async (req, res) => {
  try {
    const resultado = await confirmarResetSenhaCooperado(req.body ?? {});
    res.json(resultado);
  } catch (err) {
    console.error('Erro ao confirmar reset de senha:', err);
    res.status(400).json({ erro: err.message || 'Erro ao redefinir senha.' });
  }
});

// ── 11. Relatórios Avançados ────────────────────────────────────────────────
router.get(['/relatorios/individual/:id', '/supervisao/relatorios/individual/:id', '/monitoramento/relatorios/individual/:id'], async (req, res) => {
  try {
    const candidatoId = Number(req.params.id);
    const { dataInicio, dataFim } = req.query;
    const relatorio = await gerarRelatorioIndividual(candidatoId, { dataInicio, dataFim });
    res.json(relatorio);
  } catch (err) {
    console.error('Erro ao gerar relatório individual:', err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar relatório individual.' });
  }
});

router.get(['/relatorios/por-vaga', '/supervisao/relatorios/por-vaga', '/monitoramento/relatorios/por-vaga'], async (req, res) => {
  try {
    const { vagaId, empresaId, dataInicio, dataFim } = req.query;
    const relatorio = await gerarRelatorioPorVaga({ vagaId, empresaId, dataInicio, dataFim });
    res.json(relatorio);
  } catch (err) {
    console.error('Erro ao gerar relatório por vaga:', err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar relatório por vaga.' });
  }
});

router.get(['/relatorios/geral', '/supervisao/relatorios/geral', '/monitoramento/relatorios/geral'], async (req, res) => {
  try {
    const { empresaId, vagaId, dataInicio, dataFim } = req.query;
    const relatorio = await gerarRelatorioGeralSupervisao({ empresaId, vagaId, dataInicio, dataFim });
    res.json(relatorio);
  } catch (err) {
    console.error('Erro ao gerar relatório geral:', err);
    res.status(500).json({ erro: err.message || 'Erro ao gerar relatório geral.' });
  }
});

// ── 12. Logs de Auditoria (Somente Leitura) ──────────────────────────────────
router.get(['/logs', '/supervisao/logs', '/monitoramento/logs', '/auditoria', '/supervisao/auditoria', '/monitoramento/auditoria'], async (req, res) => {
  try {
    const { busca, candidatoId, usuarioId, acao, dataInicio, dataFim, limite, pagina } = req.query;
    const logs = await listarLogsAuditoria({
      busca,
      candidatoId,
      usuarioId,
      acao,
      dataInicio,
      dataFim,
      limite,
      pagina,
    });
    res.json(logs);
  } catch (err) {
    console.error('Erro ao listar logs de auditoria:', err);
    res.status(500).json({ erro: err.message || 'Erro ao consultar logs de auditoria.' });
  }
});

// ── 13. Escalas de Plantão, Pacientes e Faturamento ─────────────────────────
const p3 = (sub) => [sub, `/supervisao${sub}`, `/monitoramento${sub}`];
const responderErro = (res, err, padrao) => {
  if (!err.status || err.status >= 500) console.error(padrao, err);
  res.status(err.status || 500).json({ erro: err.message || padrao });
};

/** Exige ao menos um dos itens de Monitoramento informados (regra em ./acesso.js). */
function exigirItemMonitoramento(itens, mensagem) {
  return exigirAcesso(itens.map((item) => [podeAcessarItemMonitoramento, item]), mensagem);
}

const exigirEscalas = exigirItemMonitoramento(['monitoramento.escalas'], 'Seu usuário não tem permissão para acessar as Escalas de plantão.');
const exigirFaturamento = exigirItemMonitoramento(['monitoramento.faturamento'], 'Seu usuário não tem permissão para acessar o Faturamento.');
// As telas de Faturamento e de Jornadas também usam /escalas/opcoes para listar as empresas
// (e a substituição pelo Monitoramento → cooperado, para listar os cooperados)
const exigirEscalasOuFaturamento = exigirItemMonitoramento(
  ['monitoramento.escalas', 'monitoramento.faturamento', 'monitoramento.jornadas', 'monitoramento.cooperados'],
  'Seu usuário não tem permissão para acessar Escalas ou Faturamento.'
);

/** Clientes permitidos ao usuário nas Escalas (escalista: região + liberados); null = todos. */
const permitidosDe = (req) => clientesPermitidos(extrairUsuario(req).id, obterTipo(req));

router.get(p3('/escalas/opcoes'), exigirEscalasOuFaturamento, async (req, res) => {
  try { res.json(await listarOpcoesEscala(await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao carregar opções da escala.'); }
});

router.get(p3('/escalas/pacientes'), exigirEscalas, async (req, res) => {
  try { res.json(await listarPacientes(req.query, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao listar pacientes.'); }
});

router.post(p3('/escalas/pacientes'), exigirEscalas, async (req, res) => {
  try { res.status(201).json(await criarPaciente(req.body ?? {}, extrairUsuario(req))); }
  catch (err) { responderErro(res, err, 'Erro ao cadastrar paciente.'); }
});

router.put(p3('/escalas/pacientes/:id'), exigirEscalas, async (req, res) => {
  try { res.json(await atualizarPaciente(Number(req.params.id), req.body ?? {})); }
  catch (err) { responderErro(res, err, 'Erro ao atualizar paciente.'); }
});

router.get(p3('/escalas/conferencia'), exigirEscalas, async (req, res) => {
  try { res.json(await conferenciaPlantoes(req.query, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao gerar conferência de plantões.'); }
});

router.get(p3('/escalas'), exigirEscalas, async (req, res) => {
  try { res.json(await listarEscalas(req.query, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao listar escalas.'); }
});

router.post(p3('/escalas'), exigirEscalas, async (req, res) => {
  try { res.status(201).json(await criarEscala(req.body ?? {}, extrairUsuario(req), await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao lançar escala.'); }
});

router.put(p3('/escalas/:id'), exigirEscalas, async (req, res) => {
  try { res.json(await atualizarEscala(Number(req.params.id), req.body ?? {}, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao atualizar escala.'); }
});

router.delete(p3('/escalas/:id'), exigirEscalas, async (req, res) => {
  try { res.json(await excluirEscala(Number(req.params.id), await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao excluir escala.'); }
});

// ── Escalistas × clientes (Cadastro de Usuários → Escalistas; só Administrador e Suporte) ──
function soAdminOuSuporte(req, res, next) {
  if (!obterUsuarioAutenticado(req)) return res.status(401).json({ erro: 'Usuário não identificado.' });
  if (!['administrador', 'suporte'].includes(obterTipo(req))) return res.status(403).json({ erro: 'Somente Administrador ou Suporte gerencia as escalistas.' });
  next();
}
const autorDe = (req) => ({ ...extrairUsuario(req), tipoUsuario: obterTipo(req) });

router.get(p3('/escalistas'), soAdminOuSuporte, async (_req, res) => {
  try { res.json(await listarEscalistas()); }
  catch (err) { responderErro(res, err, 'Erro ao listar as escalistas.'); }
});

router.get(p3('/escalistas/:id'), soAdminOuSuporte, async (req, res) => {
  try { res.json(await detalharEscalista(req.params.id)); }
  catch (err) { responderErro(res, err, 'Erro ao carregar a escalista.'); }
});

router.post(p3('/escalistas/:id/clientes'), soAdminOuSuporte, async (req, res) => {
  try { res.json(await liberarCliente(req.params.id, req.body?.empresaId, autorDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao liberar o cliente.'); }
});

router.delete(p3('/escalistas/:id/clientes/:empresaId'), soAdminOuSuporte, async (req, res) => {
  try { res.json(await removerCliente(req.params.id, req.params.empresaId, autorDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao remover o cliente.'); }
});

router.put(p3('/escalistas/:id/todos-clientes'), soAdminOuSuporte, async (req, res) => {
  try { res.json(await definirTodosClientes(req.params.id, !!req.body?.todos, autorDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao alterar o acesso da escalista.'); }
});

// Substituição de cooperado: pela lista de Escalas (plantão) ou pelo Monitoramento (alocação ativa)
const exigirSubstituicao = exigirItemMonitoramento(
  ['monitoramento.escalas', 'monitoramento.cooperados'],
  'Seu usuário não tem permissão para substituir cooperados.'
);

router.get(p3('/escalas/substituicoes'), exigirSubstituicao, async (req, res) => {
  try { res.json(await listarSubstituicoes(req.query, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao carregar o histórico de substituições.'); }
});

router.get(p3('/escalas/substituicoes/previa'), exigirSubstituicao, async (req, res) => {
  try { res.json(await previaSubstituicao(req.query, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao carregar os plantões da substituição.'); }
});

router.post(p3('/escalas/substituicoes'), exigirSubstituicao, async (req, res) => {
  try { res.status(201).json(await substituirCooperado(req.body ?? {}, extrairUsuario(req), await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao registrar a substituição.'); }
});

router.post(p3('/faturamento/valores-cliente/importar'), exigirFaturamento, async (req, res) => {
  try { res.json(await importarValoresCliente(req.body ?? {}, extrairUsuario(req))); }
  catch (err) { responderErro(res, err, 'Erro ao importar valores do cliente.'); }
});

router.get(p3('/faturamento/valores-cliente'), exigirFaturamento, async (req, res) => {
  try { res.json(await listarValoresCliente(req.query)); }
  catch (err) { responderErro(res, err, 'Erro ao listar valores do cliente.'); }
});

router.delete(p3('/faturamento/valores-cliente'), exigirFaturamento, async (req, res) => {
  try { res.json(await excluirValoresCliente(req.query)); }
  catch (err) { responderErro(res, err, 'Erro ao excluir valores do cliente.'); }
});

router.get(p3('/faturamento/planilha'), exigirFaturamento, async (req, res) => {
  try { res.json(await gerarPlanilhaFaturamento(req.query)); }
  catch (err) { responderErro(res, err, 'Erro ao gerar planilha de faturamento.'); }
});

// Conferência de jornadas (aba Jornadas do Monitoramento): mesma apuração da planilha,
// sem os valores em R$ enviados pelo cliente, que são assunto do Faturamento.
const exigirJornadas = exigirItemMonitoramento(
  ['monitoramento.jornadas', 'monitoramento.faturamento'],
  'Seu usuário não tem permissão para acessar a conferência de jornadas.'
);
const CAMPOS_VALOR_CLIENTE = ['bonificacao', 'desc_refeicao', 'desc_estacionamento', 'desc_farmacia', 'reembolso'];

router.get(p3('/jornadas/conferencia'), exigirJornadas, async (req, res) => {
  try {
    const planilha = await gerarPlanilhaFaturamento(req.query);
    const linhas = planilha.linhas.map((l) => {
      const semValores = { ...l };
      for (const c of CAMPOS_VALOR_CLIENTE) delete semValores[c];
      return semValores;
    });
    res.json({ ...planilha, linhas });
  } catch (err) { responderErro(res, err, 'Erro ao montar a conferência de jornadas.'); }
});

// ── 14. Processo de Faturamento (apuração, conferência, aprovação) ──────────
// Usuário com perfil e IP para a auditoria do processo
const usuarioAuditoria = (req) => ({
  ...extrairUsuario(req),
  perfil: obterTipo(req),
  ip: String(req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim().slice(0, 45) || null,
});

// Regras de apuração por cliente (menu Supervisão). A Supervisão consulta e edita;
// o Faturamento só consulta (a planilha usa a regra do cliente automaticamente).
const exigirRegrasConsulta = exigirItemMonitoramento(
  ['monitoramento.apontamentos', 'monitoramento.faturamento'],
  'Seu usuário não tem permissão para ver as regras de apuração.'
);
const exigirRegrasEdicao = exigirItemMonitoramento(
  ['monitoramento.apontamentos'],
  'Somente a Supervisão pode alterar as regras de apuração do cliente.'
);
const pRegras = (sub = '') => [...p3(`/regras-apuracao${sub}`), ...p3(`/faturamento/regras-apuracao${sub}`)];

// Modelo da planilha de faturamento vinculado ao cliente
router.get(p3('/faturamento/modelo-planilha'), exigirFaturamento, async (req, res) => {
  try { res.json(await obterModeloPlanilha(req.query.empresaId)); }
  catch (err) { responderErro(res, err, 'Erro ao carregar o modelo da planilha do cliente.'); }
});

router.put(p3('/faturamento/modelo-planilha'), exigirFaturamento, async (req, res) => {
  try { res.json(await salvarModeloPlanilha(req.body?.empresaId, req.body?.modelo, extrairUsuario(req))); }
  catch (err) { responderErro(res, err, 'Erro ao salvar o modelo da planilha do cliente.'); }
});

router.get(pRegras('/clientes'), exigirRegrasConsulta, async (_req, res) => {
  try { res.json(await listarClientesComRegra()); }
  catch (err) { responderErro(res, err, 'Erro ao listar os clientes com regra própria.'); }
});

router.get(pRegras('/historico'), exigirRegrasConsulta, async (req, res) => {
  try { res.json(await listarHistoricoRegras(req.query.empresaId)); }
  catch (err) { responderErro(res, err, 'Erro ao carregar o histórico da regra.'); }
});

router.get(pRegras(), exigirRegrasConsulta, async (req, res) => {
  try { res.json(await obterRegrasApuracao(req.query.empresaId)); }
  catch (err) { responderErro(res, err, 'Erro ao carregar as regras de apuração.'); }
});

router.put(pRegras(), exigirRegrasEdicao, async (req, res) => {
  try {
    const { empresaId, ...regras } = req.body ?? {};
    res.json(await salvarRegrasApuracao(empresaId, regras, extrairUsuario(req)));
  } catch (err) { responderErro(res, err, 'Erro ao salvar as regras de apuração.'); }
});

router.delete(pRegras(), exigirRegrasEdicao, async (req, res) => {
  try { res.json(await restaurarRegrasPadrao(req.query.empresaId, extrairUsuario(req))); }
  catch (err) { responderErro(res, err, 'Erro ao restaurar o padrão.'); }
});

router.get(p3('/faturamento/unidades'), exigirFaturamento, async (req, res) => {
  try { res.json(await listarUnidadesFaturamento(req.query)); }
  catch (err) { responderErro(res, err, 'Erro ao listar unidades do cliente.'); }
});

router.get(p3('/faturamento/processos'), exigirFaturamento, async (req, res) => {
  try { res.json(await listarProcessos(req.query)); }
  catch (err) { responderErro(res, err, 'Erro ao listar processos de faturamento.'); }
});

router.post(p3('/faturamento/processos'), exigirFaturamento, async (req, res) => {
  try { res.status(201).json(await criarProcesso(req.body ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao criar processo de faturamento.'); }
});

router.get(p3('/faturamento/processos/:id'), exigirFaturamento, async (req, res) => {
  try { res.json(await obterProcesso(req.params.id)); }
  catch (err) { responderErro(res, err, 'Erro ao carregar processo de faturamento.'); }
});

router.put(p3('/faturamento/processos/:id'), exigirFaturamento, async (req, res) => {
  try { res.json(await atualizarProcesso(req.params.id, req.body ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao atualizar processo de faturamento.'); }
});

router.get(p3('/faturamento/processos/:id/auditoria'), exigirFaturamento, async (req, res) => {
  try { res.json(await listarAuditoriaProcesso(req.params.id)); }
  catch (err) { responderErro(res, err, 'Erro ao consultar auditoria do processo.'); }
});

router.post(p3('/faturamento/processos/:id/apurar'), exigirFaturamento, async (req, res) => {
  try { res.json(await apurarProcesso(req.params.id, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao apurar o faturamento.'); }
});

router.post(p3('/faturamento/processos/:id/conferir'), exigirFaturamento, async (req, res) => {
  try { res.json(await conferirItens(req.params.id, req.body ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao conferir itens.'); }
});

router.post(p3('/faturamento/processos/:id/itens/:itemId/ajustes'), exigirFaturamento, async (req, res) => {
  try { res.json(await registrarAjuste(req.params.id, req.params.itemId, req.body ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao registrar ajuste.'); }
});

router.delete(p3('/faturamento/processos/:id/ajustes/:ajusteId'), exigirFaturamento, async (req, res) => {
  try { res.json(await removerAjuste(req.params.id, req.params.ajusteId, req.query ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao remover ajuste.'); }
});

router.post(p3('/faturamento/processos/:id/divergencias'), exigirFaturamento, async (req, res) => {
  try { res.status(201).json(await registrarDivergencia(req.params.id, req.body ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao registrar divergência.'); }
});

router.post(p3('/faturamento/processos/:id/divergencias/:divergenciaId/resolver'), exigirFaturamento, async (req, res) => {
  try { res.json(await resolverDivergencia(req.params.id, req.params.divergenciaId, req.body ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao resolver divergência.'); }
});

router.post(p3('/faturamento/processos/:id/aprovar'), exigirFaturamento, async (req, res) => {
  try { res.json(await aprovarProcesso(req.params.id, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao aprovar o faturamento.'); }
});

router.post(p3('/faturamento/processos/:id/rejeitar'), exigirFaturamento, async (req, res) => {
  try { res.json(await rejeitarProcesso(req.params.id, req.body ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao rejeitar o faturamento.'); }
});

router.post(p3('/faturamento/processos/:id/cancelar'), exigirFaturamento, async (req, res) => {
  try { res.json(await cancelarProcesso(req.params.id, req.body ?? {}, usuarioAuditoria(req))); }
  catch (err) { responderErro(res, err, 'Erro ao cancelar o processo.'); }
});

// ── 15. Comissões, notas fiscais, cobranças e recebimentos (routes/financeiro.js) ─
router.use(financeiroRoutes);

// ── Solicitações de abertura / reabertura de vagas ───────────────────────────
// Consulta e registro do pedido do cliente: quem trabalha na Supervisão (apontamentos ou cooperados).
// Aprovar/recusar e controlar as posições abertas: perfil Supervisão, Administrador ou Suporte.
const exigirSolicitacoesVaga = exigirItemMonitoramento(
  ['monitoramento.apontamentos', 'monitoramento.cooperados'],
  'Seu usuário não tem acesso às solicitações de vagas.'
);
function exigirDecisaoVaga(req, res, next) {
  if (!['administrador', 'suporte', 'supervisao'].includes(obterTipo(req))) {
    return res.status(403).json({ erro: 'Somente a Supervisão (ou Administrador/Suporte) decide e controla as solicitações de vagas.' });
  }
  next();
}

router.get(p3('/vagas-solicitacoes/situacao'), exigirSolicitacoesVaga, async (req, res) => {
  try { res.json(await listarSituacaoVagas(req.query, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao carregar a situação das vagas.'); }
});

router.get(p3('/vagas-solicitacoes'), exigirSolicitacoesVaga, async (req, res) => {
  try { res.json(await listarSolicitacoes(req.query, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao listar as solicitações de vagas.'); }
});

router.post(p3('/vagas-solicitacoes'), exigirSolicitacoesVaga, async (req, res) => {
  try { res.status(201).json(await criarSolicitacao(req.body ?? {}, autorDe(req), await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao registrar a solicitação.'); }
});

router.post(p3('/vagas-solicitacoes/:id/aprovar'), exigirSolicitacoesVaga, exigirDecisaoVaga, async (req, res) => {
  try { res.json(await aprovarSolicitacao(req.params.id, req.body ?? {}, autorDe(req), await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao aprovar a solicitação.'); }
});

router.post(p3('/vagas-solicitacoes/:id/recusar'), exigirSolicitacoesVaga, exigirDecisaoVaga, async (req, res) => {
  try { res.json(await encerrarSolicitacao(req.params.id, 'recusada', req.body ?? {}, autorDe(req), await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao recusar a solicitação.'); }
});

router.post(p3('/vagas-solicitacoes/:id/cancelar'), exigirSolicitacoesVaga, async (req, res) => {
  try { res.json(await encerrarSolicitacao(req.params.id, 'cancelada', req.body ?? {}, autorDe(req), await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao cancelar a solicitação.'); }
});

router.get(p3('/vagas-solicitacoes/posicoes/:id/candidatos'), exigirSolicitacoesVaga, exigirDecisaoVaga, async (req, res) => {
  try { res.json(await listarCandidatosPosicao(req.params.id, await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao listar os cooperados da vaga.'); }
});

router.post(p3('/vagas-solicitacoes/posicoes/:id/:acao(preencher|cancelar|reabrir)'), exigirSolicitacoesVaga, exigirDecisaoVaga, async (req, res) => {
  try { res.json(await alterarPosicao(req.params.id, req.params.acao, req.body ?? {}, autorDe(req), await permitidosDe(req))); }
  catch (err) { responderErro(res, err, 'Erro ao atualizar a posição.'); }
});

export default router;
