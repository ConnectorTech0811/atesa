import { Router } from 'express';
import {
  listarCandidatos,
  buscarCandidatoPorId,
  buscarCandidatosPorTexto,
  buscarCandidatosParecidos,
  buscarCandidatoPorCpf,
  buscarCandidatoPorEmail,
  inserirCandidato,
  atualizarCandidato,
  aprovarCandidato,
  reprovarCandidato,
  avaliarCandidato,
  inativarCandidato,
  desligarCandidato,
  reativarCandidato,
  excluirCandidato,
  listarAlocacoesPorVaga,
  listarAlocacoesPorCandidato,
  inserirAlocacao,
  encerrarAlocacao,
  obterMetricasRA,
  listarVagasDisponiveis,
  alternarAtivacaoVagaRA,
  listarHistoricoNotas,
  listarHistoricoDesligamentos,
  listarSuporteCooperados,
  buscarSuporteCooperadoDetalhe,
} from '../repositories/raRepository.js';
import { pool } from '../config/database.js';
import { validarCpf } from '../utils/validarCpf.js';
import { criarVerificadorAcesso } from '../../../shared/src/auth.js';

const router = Router();

// Permite perfis autorizados ou usuários com a permissão 'ra' ou 'usuarios' ativa
const verificarAcesso = criarVerificadorAcesso(
  ['administrador', 'ra', 'supervisao'],
  'RA',
  'ra'
);

// ── Suporte e Acompanhamento de Adesões ─────────────────────────────────────

router.get('/ra/suporte/cooperados', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const { busca, cooperativa, statusAdesao } = req.query;
    const lista = await listarSuporteCooperados({ busca, cooperativa, statusAdesao });
    res.json(lista);
  } catch (e) {
    console.error('Erro ao listar suporte cooperados:', e);
    res.status(500).json({ erro: 'Erro ao listar cooperados no suporte.' });
  }
});

router.get('/ra/suporte/cooperados/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const detalhe = await buscarSuporteCooperadoDetalhe(req.params.id);
    if (!detalhe) return res.status(404).json({ erro: 'Cooperado não encontrado.' });
    res.json(detalhe);
  } catch (e) {
    console.error('Erro ao buscar detalhe do cooperado no suporte:', e);
    res.status(500).json({ erro: 'Erro ao carregar detalhes do cooperado no suporte.' });
  }
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

router.get('/ra/metricas', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const dados = await obterMetricasRA();
    res.json(dados);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao obter métricas.' });
  }
});

// ── Candidatos ────────────────────────────────────────────────────────────────

router.get('/ra/candidatos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const { status, cooperativa, busca, tipo_contratacao } = req.query;
    const candidatos = await listarCandidatos({ status, cooperativa, busca, tipo_contratacao });
    res.json(candidatos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar candidatos.' });
  }
});

router.get('/ra/candidatos/verificar-nome', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const nome = String(req.query.nome ?? '').trim();
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : null;
  if (nome.length < 3) return res.json([]);
  try {
    const resultado = await buscarCandidatosParecidos(nome, excludeId);
    res.json(resultado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao verificar nome.' });
  }
});

router.get('/ra/candidatos/verificar-cpf', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const cpf = String(req.query.cpf ?? '').replace(/\D/g, '');
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : null;
  if (cpf.length !== 11) return res.json({ existe: false });
  try {
    const { candidato, usuario: usuarioColaborador } = await buscarCandidatoPorCpf(cpf, excludeId);
    res.json({
      existe: !!(candidato || usuarioColaborador),
      candidato: candidato ?? null,
      usuario: usuarioColaborador ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao verificar CPF.' });
  }
});

router.get('/ra/candidatos/verificar-email', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const email = String(req.query.email ?? '').trim();
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : null;
  if (!email || email.length < 5 || !email.includes('@')) return res.json({ existe: false });
  try {
    const { cooperado, usuario: usuarioColaborador } = await buscarCandidatoPorEmail(email, excludeId);
    res.json({
      existe: !!(cooperado || usuarioColaborador),
      cooperado: cooperado ?? null,
      usuario: usuarioColaborador ?? null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao verificar E-mail.' });
  }
});

router.get('/ra/candidatos/buscar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const q = String(req.query.q ?? '').trim();
  if (q.length < 2) return res.json([]);
  try {
    const resultado = await buscarCandidatosPorTexto(q);
    res.json(resultado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro na busca.' });
  }
});

router.get('/ra/candidatos/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const candidato = await buscarCandidatoPorId(req.params.id);
    if (!candidato) return res.status(404).json({ erro: 'Candidato não encontrado.' });
    const [alocacoes, historico_notas, historico_desligamentos] = await Promise.all([
      listarAlocacoesPorCandidato(req.params.id),
      listarHistoricoNotas(req.params.id),
      listarHistoricoDesligamentos(req.params.id),
    ]);
    res.json({ ...candidato, alocacoes, historico_notas, historico_desligamentos });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao obter candidato.' });
  }
});

router.get('/ra/candidatos/:id/historico-notas', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const lista = await listarHistoricoNotas(req.params.id);
    res.json(lista);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao buscar histórico de notas.' });
  }
});

router.get('/ra/candidatos/:id/historico-desligamentos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const lista = await listarHistoricoDesligamentos(req.params.id);
    res.json(lista);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao buscar histórico de desligamentos.' });
  }
});

// Verificador de acesso restrito à avaliação de notas (exclusivo para Administrador e Enfermeira)
function verificarAcessoAvaliacao(req, res) {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return null;
  const tipo = String(usuario.tipoUsuario ?? req.headers['x-usuario-tipo'] ?? '').toLowerCase();
  if (tipo !== 'administrador' && tipo !== 'enfermeira' && tipo !== 'enfermeiro') {
    res.status(403).json({ erro: 'Apenas Administrador e Enfermeira têm permissão para avaliar ou editar a nota do cooperado.' });
    return null;
  }
  return usuario;
}

router.post('/ra/candidatos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nome, cpf, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes, latitude, longitude } = req.body ?? {};
  if (!nome || !cpf) {
    return res.status(400).json({ erro: 'Nome e CPF são obrigatórios.' });
  }
  const cpfLimpo = String(cpf).replace(/\D/g, '');
  if (!validarCpf(cpfLimpo)) {
    return res.status(400).json({ erro: 'CPF inválido.' });
  }
  try {
    const id = await inserirCandidato({
      nome,
      cpf: cpfLimpo,
      email,
      telefone,
      whatsapp,
      cooperativa: cooperativa || 'ATESA',
      tipo_contratacao,
      observacoes,
      latitude,
      longitude,
    });
    res.status(201).json({ id });
  } catch (e) {
    if (e.code?.startsWith('ER_DUP_') || e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: e.message || 'Já existe um cadastro com estes dados (CPF ou E-mail duplicado).' });
    }
    console.error(e);
    res.status(500).json({ erro: e.message || 'Erro ao cadastrar candidato.' });
  }
});

router.put('/ra/candidatos/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nome, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes, latitude, longitude } = req.body ?? {};
  if (!nome) {
    return res.status(400).json({ erro: 'Nome é obrigatório.' });
  }
  try {
    await atualizarCandidato(req.params.id, {
      nome,
      email,
      telefone,
      whatsapp,
      cooperativa: cooperativa || 'ATESA',
      tipo_contratacao,
      observacoes,
      latitude,
      longitude,
    });
    res.json({ ok: true });
  } catch (e) {
    if (e.code?.startsWith('ER_DUP_') || e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: e.message || 'Já existe um cadastro com este E-mail.' });
    }
    console.error(e);
    res.status(500).json({ erro: e.message || 'Erro ao atualizar candidato.' });
  }
});


router.patch('/ra/candidatos/:id/tipo-contratacao', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { tipo_contratacao } = req.body ?? {};
  const tipo = tipo_contratacao === 'interno' ? 'interno' : 'externo';
  try {
    await pool.query('UPDATE ra_candidatos SET tipo_contratacao = ? WHERE id = ?', [tipo, req.params.id]);
    res.json({ ok: true, tipo_contratacao: tipo });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao alterar tipo de contratação.' });
  }
});

// Avaliação / Edição de Nota do cooperado (nota 0 a 10: >= 7 aprovado, < 7 reprovado)
// Avaliação de Prova / Inserção de Nota
// Para cooperados que já possuem nota registrada (status = 1), apenas Administrador pode alterar.
router.post('/ra/candidatos/:id/avaliar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nota, observacao } = req.body ?? {};
  if (nota === undefined || nota === null || nota === '') {
    return res.status(400).json({ erro: 'A nota é obrigatória.' });
  }

  try {
    const candAtual = await buscarCandidatoPorId(req.params.id);
    if (!candAtual) {
      return res.status(404).json({ erro: 'Candidato não encontrado.' });
    }

    // Se já possui nota registrada e já está aprovado, valida se é Administrador
    if (candAtual.status === 1 && candAtual.nota_avaliacao !== null && candAtual.nota_avaliacao !== undefined) {
      const tipo = String(usuario.tipoUsuario ?? req.headers['x-usuario-tipo'] ?? '').toLowerCase();
      if (tipo !== 'administrador') {
        return res.status(403).json({ erro: 'Apenas Administrador tem permissão para editar a nota de cooperados que já possuem avaliação registrada.' });
      }
    }

    const resultado = await avaliarCandidato(req.params.id, {
      nota,
      observacao,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
    });
    res.json({ ok: true, ...resultado });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e?.message ?? 'Erro ao avaliar cooperado.' });
  }
});

// Aprovação de Pré-cadastro
router.patch('/ra/candidatos/:id/aprovar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { observacao } = req.body ?? {};
  try {
    const resultado = await aprovarCandidato(req.params.id, usuario.id, usuario.nome);
    res.json({ ok: true, status: resultado.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e?.message ?? 'Erro ao aprovar pré-cadastro.' });
  }
});

// Reprovação de Pré-cadastro
router.patch('/ra/candidatos/:id/reprovar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { motivo, observacao } = req.body ?? {};
  try {
    const resultado = await reprovarCandidato(req.params.id, usuario.id, usuario.nome, motivo || observacao);
    res.json({ ok: true, status: resultado.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e?.message ?? 'Erro ao reprovar pré-cadastro.' });
  }
});

router.patch('/ra/candidatos/:id/inativar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { motivo } = req.body ?? {};
  try {
    await inativarCandidato(req.params.id, { usuarioId: usuario.id, usuarioNome: usuario.nome, motivo });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao inativar cooperado.' });
  }
});

router.patch('/ra/candidatos/:id/desligar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { motivo, data_desligamento, tipo_desligamento } = req.body ?? {};
  try {
    const resultado = await desligarCandidato(req.params.id, {
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      motivo,
      dataDesligamento: data_desligamento,
      tipoDesligamento: tipo_desligamento || 'total',
    });
    res.json({ ok: true, ...resultado });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao desligar cooperado.' });
  }
});

router.post('/ra/candidatos/:id/desligar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { motivo, data_desligamento, tipo_desligamento } = req.body ?? {};
  try {
    const resultado = await desligarCandidato(req.params.id, {
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      motivo,
      dataDesligamento: data_desligamento,
      tipoDesligamento: tipo_desligamento || 'total',
    });
    res.json({ ok: true, ...resultado });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao desligar cooperado.' });
  }
});

router.patch('/ra/candidatos/:id/reativar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    await reativarCandidato(req.params.id, { usuarioId: usuario.id, usuarioNome: usuario.nome });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao reativar cooperado.' });
  }
});

router.delete('/ra/candidatos/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    await excluirCandidato(req.params.id, { usuarioId: usuario.id, usuarioNome: usuario.nome });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao excluir candidato.' });
  }
});

// ── Vagas (leitura do Parâmetro com filtro de Tomador e Status) ───────────────

router.get('/ra/vagas', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const { empresaId, tomador, cargo, cooperativa, status } = req.query;
    const vagas = await listarVagasDisponiveis({ empresaId, tomador, cargo, cooperativa, status });
    res.json(vagas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar vagas.' });
  }
});

router.patch('/ra/vagas/:id/ativacao', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { ativa, motivo } = req.body ?? {};
  if (typeof ativa !== 'boolean') {
    return res.status(400).json({ erro: 'Campo "ativa" (booleano) é obrigatório.' });
  }
  try {
    await alternarAtivacaoVagaRA(req.params.id, ativa, {
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      motivo,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message || 'Erro ao alterar ativação da vaga.' });
  }
});

router.get('/ra/vagas/:id/alocacoes', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const alocacoes = await listarAlocacoesPorVaga(req.params.id);
    res.json(alocacoes);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar alocações.' });
  }
});

// ── Alocações ─────────────────────────────────────────────────────────────────

router.post('/ra/vagas/:id/alocar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { candidatoId, unidadeId, empresaId, dataInicio, observacoes } = req.body ?? {};
  if (!candidatoId || !unidadeId || !empresaId || !dataInicio) {
    return res.status(400).json({ erro: 'candidatoId, unidadeId, empresaId e dataInicio são obrigatórios.' });
  }
  try {
    const id = await inserirAlocacao({
      candidatoId, vagaId: req.params.id, unidadeId, empresaId, dataInicio, observacoes,
      usuarioId: usuario.id, usuarioNome: usuario.nome,
    });
    res.status(201).json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao alocar candidato.' });
  }
});

router.patch('/ra/alocacoes/:id/encerrar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { dataFim, observacoes } = req.body ?? {};
  try {
    await encerrarAlocacao(req.params.id, { usuarioId: usuario.id, usuarioNome: usuario.nome, dataFim, observacoes });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao encerrar alocação.' });
  }
});

export default router;
