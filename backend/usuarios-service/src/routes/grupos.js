import { Router } from 'express';
import {
  adicionarMembro,
  atualizarGrupo,
  buscarGrupoPorId,
  criarGrupo,
  excluirGrupo,
  listarGrupos,
  listarMembrosPorGrupo,
  listarPermissoesGrupo,
  listarPermissoesUsuario,
  limparPermissoesUsuario,
  permissoesEfetivasUsuario,
  removerMembro,
  salvarPermissoesGrupo,
  salvarPermissoesUsuario,
} from '../repositories/gruposRepository.js';
import { buscarUsuarioPorId, listarUsuarios } from '../repositories/usuariosRepository.js';

const router = Router();

function soAdmin(req, res, next) {
  if (req.headers['x-usuario-tipo'] !== 'administrador') {
    return res.status(403).json({ erro: 'Sem permissão.' });
  }
  next();
}

// ── Grupos ────────────────────────────────────────────────────────────────────

router.get('/grupos', soAdmin, async (_req, res) => {
  try {
    res.json(await listarGrupos());
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar grupos.' });
  }
});

router.post('/grupos', soAdmin, async (req, res) => {
  const { nome, descricao } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do grupo.' });
  try {
    const id = await criarGrupo({ nome, descricao });
    res.status(201).json({ id });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe um grupo com este nome.' });
    console.error(e);
    res.status(500).json({ erro: 'Erro ao criar grupo.' });
  }
});

router.put('/grupos/:id', soAdmin, async (req, res) => {
  const { nome, descricao } = req.body ?? {};
  if (!nome) return res.status(400).json({ erro: 'Informe o nome do grupo.' });
  try {
    const grupo = await buscarGrupoPorId(req.params.id);
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    await atualizarGrupo(req.params.id, { nome, descricao });
    res.json({ ok: true });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe um grupo com este nome.' });
    console.error(e);
    res.status(500).json({ erro: 'Erro ao atualizar grupo.' });
  }
});

router.delete('/grupos/:id', soAdmin, async (req, res) => {
  try {
    const grupo = await buscarGrupoPorId(req.params.id);
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    await excluirGrupo(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao excluir grupo.' });
  }
});

// ── Membros ───────────────────────────────────────────────────────────────────

router.get('/grupos/:id/membros', soAdmin, async (req, res) => {
  try {
    const grupo = await buscarGrupoPorId(req.params.id);
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    res.json(await listarMembrosPorGrupo(req.params.id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar membros.' });
  }
});

router.post('/grupos/:id/membros', soAdmin, async (req, res) => {
  const { usuarioId } = req.body ?? {};
  if (!usuarioId) return res.status(400).json({ erro: 'Informe o usuarioId.' });
  try {
    const grupo = await buscarGrupoPorId(req.params.id);
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    const usuario = await buscarUsuarioPorId(Number(usuarioId)).catch(() => null);
    if (!usuario) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    await adicionarMembro(req.params.id, usuarioId);
    res.status(201).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao adicionar membro.' });
  }
});

router.delete('/grupos/:id/membros/:usuarioId', soAdmin, async (req, res) => {
  try {
    await removerMembro(req.params.id, req.params.usuarioId);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao remover membro.' });
  }
});

// ── Permissões do grupo ───────────────────────────────────────────────────────

router.get('/grupos/:id/permissoes', soAdmin, async (req, res) => {
  try {
    const grupo = await buscarGrupoPorId(req.params.id);
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    res.json(await listarPermissoesGrupo(req.params.id));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar permissões.' });
  }
});

router.put('/grupos/:id/permissoes', soAdmin, async (req, res) => {
  try {
    const grupo = await buscarGrupoPorId(req.params.id);
    if (!grupo) return res.status(404).json({ erro: 'Grupo não encontrado.' });
    await salvarPermissoesGrupo(req.params.id, req.body ?? {});
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao salvar permissões.' });
  }
});

// ── Permissões individuais do usuário ─────────────────────────────────────────

router.get('/usuarios/:id/permissoes', soAdmin, async (req, res) => {
  try {
    res.json(await listarPermissoesUsuario(Number(req.params.id)));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar permissões.' });
  }
});

router.put('/usuarios/:id/permissoes', soAdmin, async (req, res) => {
  try {
    await limparPermissoesUsuario(Number(req.params.id));
    if (Object.keys(req.body ?? {}).length) {
      await salvarPermissoesUsuario(Number(req.params.id), req.body);
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao salvar permissões.' });
  }
});

// ── Permissões efetivas (usada pelo próprio usuário ao logar) ─────────────────

router.get('/usuarios/:id/permissoes-efetivas', async (req, res) => {
  const solicitanteId = Number(req.headers['x-usuario-id']);
  const solicitanteTipo = req.headers['x-usuario-tipo'];
  const alvoId = Number(req.params.id);
  if (solicitanteId !== alvoId && solicitanteTipo !== 'administrador') {
    return res.status(403).json({ erro: 'Sem permissão.' });
  }
  try {
    res.json(await permissoesEfetivasUsuario(alvoId));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao calcular permissões.' });
  }
});

// ── Usuários disponíveis (para adicionar ao grupo) ───────────────────────────

router.get('/grupos/usuarios-disponiveis', soAdmin, async (_req, res) => {
  try {
    const todos = await listarUsuarios();
    res.json(todos.map(({ id, nome, email, tipo_usuario }) => ({ id, nome, email, tipo_usuario })));
  } catch (e) {
    console.error(e);
    res.status(500).json({ erro: 'Erro ao listar usuários.' });
  }
});

export default router;
