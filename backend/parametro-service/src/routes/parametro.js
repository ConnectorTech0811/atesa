import { Router } from 'express';
import {
  listarEmpresasParametro,
  listarUnidadesPorEmpresa,
  criarUnidade,
  atualizarUnidade,
  alternarAtivacaoUnidade,
  criarVaga,
  atualizarVaga,
  registrarIncremento,
  alternarAtivacaoVaga,
  listarIncrementosPorVaga,
  alterarStatusEmpresa,
  listarLog,
  listarAgendaVaga,
  atualizarStatusAgenda,
  regerarAgendaVaga,
  listarAtividadesPrimarias,
} from '../repositories/parametroRepository.js';
import { buscarEmpresaCompletaPorId } from '../repositories/empresasRepository.js';
import { criarVerificadorAcesso } from '../../../shared/src/auth.js';

const router = Router();

const verificarAcesso = criarVerificadorAcesso(['administrador', 'parametro'], 'Parâmetro');

// ── Empresas ─────────────────────────────────────────────────────────────────

router.get('/parametro/empresas', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const empresas = await listarEmpresasParametro();
    res.json(empresas);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar empresas.' });
  }
});

router.get('/parametro/empresas/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const empresa = await buscarEmpresaCompletaPorId(req.params.id);
    if (!empresa) return res.status(404).json({ erro: 'Empresa não encontrada.' });
    const unidades = await listarUnidadesPorEmpresa(req.params.id);
    res.json({ ...empresa, unidades });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao obter empresa.' });
  }
});

router.patch('/parametro/empresas/:id/status', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { status } = req.body ?? {};
  if (!status) return res.status(400).json({ erro: 'Informe o status.' });
  try {
    await alterarStatusEmpresa(req.params.id, status, usuario.id, usuario.nome);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao alterar status.' });
  }
});

router.get('/parametro/empresas/:id/log', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const log = await listarLog(req.params.id);
    res.json(log);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar log.' });
  }
});

// ── Unidades ─────────────────────────────────────────────────────────────────

router.post('/parametro/empresas/:id/unidades', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nomeUnidade, endereco, contatoResponsavel, observacoes } = req.body ?? {};
  if (!nomeUnidade) return res.status(400).json({ erro: 'Nome da unidade é obrigatório.' });
  try {
    const id = await criarUnidade(req.params.id, { nomeUnidade, endereco, contatoResponsavel, observacoes }, usuario.id, usuario.nome);
    res.status(201).json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar unidade.' });
  }
});

router.put('/parametro/unidades/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { nomeUnidade, endereco, contatoResponsavel, observacoes, empresaId } = req.body ?? {};
  if (!nomeUnidade || !empresaId) return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  try {
    await atualizarUnidade(req.params.id, { nomeUnidade, endereco, contatoResponsavel, observacoes }, empresaId, usuario.id, usuario.nome);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar unidade.' });
  }
});

router.patch('/parametro/unidades/:id/ativacao', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { ativa, empresaId } = req.body ?? {};
  if (typeof ativa !== 'boolean' || !empresaId) return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  try {
    await alternarAtivacaoUnidade(req.params.id, ativa, empresaId, usuario.id, usuario.nome);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao alterar ativação da unidade.' });
  }
});

// ── Vagas ─────────────────────────────────────────────────────────────────────

router.post('/parametro/unidades/:id/vagas', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { empresaId, ...dados } = req.body ?? {};
  if (!dados.cargo || !empresaId) return res.status(400).json({ erro: 'Cargo e empresaId são obrigatórios.' });
  try {
    const id = await criarVaga(req.params.id, empresaId, dados, usuario.id, usuario.nome);
    res.status(201).json({ id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar vaga.' });
  }
});

router.put('/parametro/vagas/:id', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { empresaId, unidadeId, ...dados } = req.body ?? {};
  if (!dados.cargo || !empresaId || !unidadeId) return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  try {
    await atualizarVaga(req.params.id, unidadeId, empresaId, dados, usuario.id, usuario.nome);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar vaga.' });
  }
});

router.post('/parametro/vagas/:id/incremento', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { empresaId, unidadeId, delta, motivo, dataIncremento } = req.body ?? {};
  if (!empresaId || !unidadeId || delta === undefined || !dataIncremento) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  }
  try {
    const resultado = await registrarIncremento(req.params.id, unidadeId, empresaId, { delta, motivo, dataIncremento }, usuario.id, usuario.nome);
    res.json(resultado);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: e.message || 'Erro ao registrar incremento.' });
  }
});

router.get('/parametro/vagas/:id/incrementos', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const incrementos = await listarIncrementosPorVaga(req.params.id);
    res.json(incrementos);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar incrementos.' });
  }
});

router.patch('/parametro/vagas/:id/ativacao', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { ativa, empresaId, unidadeId } = req.body ?? {};
  if (typeof ativa !== 'boolean' || !empresaId || !unidadeId) return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  try {
    await alternarAtivacaoVaga(req.params.id, ativa, unidadeId, empresaId, usuario.id, usuario.nome);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao alterar ativação da vaga.' });
  }
});

// ── Cadastro primário ────────────────────────────────────────────────────────

router.get('/parametro/empresas/:id/atividades-primarias', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const atividades = await listarAtividadesPrimarias(req.params.id);
    res.json(atividades);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar atividades.' });
  }
});

// ── Agenda de operação ────────────────────────────────────────────────────────

router.get('/parametro/vagas/:id/agenda', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  try {
    const agenda = await listarAgendaVaga(req.params.id);
    res.json(agenda);
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar agenda.' });
  }
});

router.patch('/parametro/agenda/:id/status', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { status, observacoes } = req.body ?? {};
  if (!status) return res.status(400).json({ erro: 'Informe o status.' });
  try {
    await atualizarStatusAgenda(req.params.id, status, observacoes, usuario.id, usuario.nome);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar agenda.' });
  }
});

router.post('/parametro/vagas/:id/agenda/regerar', async (req, res) => {
  const usuario = verificarAcesso(req, res);
  if (!usuario) return;
  const { unidadeId, empresaId, tipoEscala, dataInicio } = req.body ?? {};
  if (!unidadeId || !empresaId || !tipoEscala || !dataInicio) {
    return res.status(400).json({ erro: 'Campos obrigatórios ausentes.' });
  }
  try {
    const total = await regerarAgendaVaga(req.params.id, unidadeId, empresaId, tipoEscala, dataInicio, usuario.id, usuario.nome);
    res.json({ ok: true, total });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao regerar agenda.' });
  }
});

export default router;
