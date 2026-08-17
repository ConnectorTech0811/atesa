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
  listarAlocacoesPorVaga,
  listarAlocacoesPorCandidato,
  inserirAlocacao,
  encerrarAlocacao,
  obterMetricasRA,
  listarVagasDisponiveis,
} from '../repositories/raRepository.js';
import { validarCpf } from '../utils/validarCpf.js';

const router = Router();

const PERFIS_AUTORIZADOS = ['administrador', 'ra'];

function obterUsuarioAutenticado(req) {
  const id = req.headers['x-usuario-id'];
  const nomeCodificado = req.headers['x-usuario-nome'];
  if (!id || !nomeCodificado) return null;
  return { id: Number(id), nome: decodeURIComponent(nomeCodificado) };
}

function verificarAcesso(req, res) {
  const tipo = req.headers['x-usuario-tipo'];
  if (!tipo || !PERFIS_AUTORIZADOS.includes(tipo)) {
    res.status(403).json({ erro: 'Acesso restrito ao módulo RA.' });
    return false;
  }
  const usuario = obterUsuarioAutenticado(req);
  if (!usuario) {
    res.status(401).json({ erro: 'Usuário não identificado.' });
    return false;
  }
  return usuario;
}

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
    const { status, cooperativa, busca } = req.query;
    const candidatos = await listarCandidatos({ status, cooperativa, busca });
    res.json(candidatos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar candidatos.' });
  }
});

/** Verifica nomes parecidos — alerta de duplicata no formulário. */
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

/** Verifica se o CPF já está cadastrado. */
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

/** Busca rápida por nome / CPF / matrícula — usada no fluxo de alocação. */
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
  const { nome, cpf, email, telefone, cooperativa, observacoes } = req.body ?? {};
  if (!nome || !cpf || !cooperativa) {
    return res.status(400).json({ erro: 'Nome, CPF e cooperativa são obrigatórios.' });
  }
  const cpfLimpo = String(cpf).replace(/\D/g, '');
  if (!validarCpf(cpfLimpo)) {
    return res.status(400).json({ erro: 'CPF inválido.' });
  }
  try {
    const id = await inserirCandidato({ nome, cpf: cpfLimpo, email, telefone, cooperativa, observacoes });
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
  const { nome, email, telefone, cooperativa, observacoes } = req.body ?? {};
  if (!nome || !cooperativa) {
    return res.status(400).json({ erro: 'Nome e cooperativa são obrigatórios.' });
  }
  try {
    await atualizarCandidato(req.params.id, { nome, email, telefone, cooperativa, observacoes });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar candidato.' });
  }
});

/** Aprova pré-cadastro: status 0 → 1, gera matrícula. */
router.patch('/ra/candidatos/:id/aprovar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const matricula = await aprovarCandidato(req.params.id, usuario.id, usuario.nome);
    res.json({ ok: true, matricula });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao aprovar candidato.' });
  }
});

/** Remove pré-cadastro pendente. */
router.delete('/ra/candidatos/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    await reprovarCandidato(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao remover candidato.' });
  }
});

// ── Vagas (leitura do Parâmetro para alocação) ────────────────────────────────

router.get('/ra/vagas', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const { empresaId, cargo, cooperativa } = req.query;
    const vagas = await listarVagasDisponiveis({ empresaId, cargo, cooperativa });
    res.json(vagas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar vagas.' });
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
