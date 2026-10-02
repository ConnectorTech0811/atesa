import { Router } from 'express';
import {
  obterResumoDashboard,
  listarCooperadosMonitoramento,
  obterDetalhesCooperadoMonitoramento,
  listarTodosApontamentos,
  obterApontamentoPorId,
  editarApontamento,
  adicionarObservacaoApontamento,
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
    const { busca, candidatoId, empresaId, vagaId, tipoEvento, status, apenasAjustados, dataInicio, dataFim, limite, pagina } = req.query;
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
      limite,
      pagina,
    });
    res.json(apontamentos);
  } catch (err) {
    console.error('Erro ao listar apontamentos:', err);
    res.status(500).json({ erro: err.message || 'Erro ao listar apontamentos.' });
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
    const statusCode = err.message && err.message.includes('não pode editar o próprio registro') ? 403 : 500;
    res.status(statusCode).json({ erro: err.message || 'Erro ao processar edição de apontamento.' });
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
    res.status(500).json({ erro: err.message || 'Erro ao registrar complemento de horas.' });
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
    res.status(500).json({ erro: err.message || 'Erro ao excluir complemento.' });
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

export default router;
