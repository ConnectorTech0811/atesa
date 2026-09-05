import { Router } from 'express';
import {
  listarCandidatos,
  buscarCandidatoPorId,
  buscarCandidatosPorTexto,
  buscarCandidatosParecidos,
  buscarCandidatoPorCpf,
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
} from '../repositories/raRepository.js';
import { pool } from '../config/database.js';
import { validarCpf } from '../utils/validarCpf.js';
import { criarVerificadorAcesso } from '../../../shared/src/auth.js';

const router = Router();

// Permite perfis autorizados ou usuários com a permissão 'ra' ativa
const verificarAcesso = criarVerificadorAcesso(
  ['administrador', 'ra', 'supervisao'],
  'RA',
  'ra'
);

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
  if (cpf.length !== 11) return res.json({ existe: false });
  try {
    const candidato = await buscarCandidatoPorCpf(cpf);
    res.json({ existe: !!candidato, candidato: candidato ?? null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao verificar CPF.' });
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
    const alocacoes = await listarAlocacoesPorCandidato(req.params.id);
    res.json({ ...candidato, alocacoes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao obter candidato.' });
  }
});

router.post('/ra/candidatos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nome, cpf, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes } = req.body ?? {};
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
    });
    res.status(201).json({ id });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ erro: 'Já existe um candidato cadastrado com este CPF.' });
    }
    console.error(e);
    res.status(500).json({ erro: 'Erro ao cadastrar candidato.' });
  }
});

router.put('/ra/candidatos/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nome, email, telefone, whatsapp, cooperativa, tipo_contratacao, observacoes } = req.body ?? {};
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
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar candidato.' });
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

// Avaliação do cooperado (nota 0 a 10: >= 7 aprovado, < 7 reprovado)
router.post('/ra/candidatos/:id/avaliar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nota, observacao } = req.body ?? {};
  if (nota === undefined || nota === null || nota === '') {
    return res.status(400).json({ erro: 'A nota é obrigatória.' });
  }
  try {
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

router.patch('/ra/candidatos/:id/aprovar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nota = 10, observacao } = req.body ?? {};
  try {
    const resultado = await avaliarCandidato(req.params.id, {
      nota: Number(nota),
      observacao,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
    });
    res.json({ ok: true, matricula: resultado.matricula });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao aprovar candidato.' });
  }
});

router.patch('/ra/candidatos/:id/reprovar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nota = 5, observacao } = req.body ?? {};
  try {
    const resultado = await avaliarCandidato(req.params.id, {
      nota: Number(nota),
      observacao,
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
    });
    res.json({ ok: true, status: resultado.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao reprovar candidato.' });
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
  const { motivo, data_desligamento } = req.body ?? {};
  try {
    await desligarCandidato(req.params.id, {
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      motivo,
      dataDesligamento: data_desligamento,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao desligar cooperado.' });
  }
});

router.post('/ra/candidatos/:id/desligar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { motivo, data_desligamento } = req.body ?? {};
  try {
    await desligarCandidato(req.params.id, {
      usuarioId: usuario.id,
      usuarioNome: usuario.nome,
      motivo,
      dataDesligamento: data_desligamento,
    });
    res.json({ ok: true });
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
