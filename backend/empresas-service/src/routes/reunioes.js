import { Router } from 'express';
import {
  atualizarStatusReuniao,
  buscarReuniaoPorId,
  inserirReuniao,
  listarReunioesPorEmpresa,
  listarReunioesPorExecutivo,
} from '../repositories/reunioesRepository.js';

const STATUS_VALIDOS = ['agendada', 'realizada', 'cancelada'];

const router = Router();

function obterUsuarioAutenticado(req) {
  const id = req.headers['x-usuario-id'];
  const nomeCodificado = req.headers['x-usuario-nome'];
  if (!id || !nomeCodificado) return null;
  return { id: Number(id), nome: decodeURIComponent(nomeCodificado) };
}

router.get('/reunioes', async (req, res) => {
  const usuario = obterUsuarioAutenticado(req);
  if (!usuario) return res.status(401).json({ erro: 'Usuário não identificado.' });
  try {
    const reunioes = await listarReunioesPorExecutivo(usuario.id);
    res.json(reunioes);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar reuniões.' });
  }
});

router.get('/empresas/:empresaId/reunioes', async (req, res) => {
  try {
    const reunioes = await listarReunioesPorEmpresa(req.params.empresaId);
    res.json(reunioes);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar reuniões.' });
  }
});

router.post('/reunioes', async (req, res) => {
  const usuario = obterUsuarioAutenticado(req);
  if (!usuario) return res.status(401).json({ erro: 'Usuário não identificado.' });

  const { empresaId, trabalhoId, titulo, dataHora, localReuniao, observacoes } = req.body ?? {};
  if (!empresaId || !titulo || !dataHora) {
    return res.status(400).json({ erro: 'Informe a empresa, título e data/hora.' });
  }

  try {
    const id = await inserirReuniao({
      empresaId, trabalhoId, titulo, dataHora, localReuniao, observacoes,
      agendadoPorId: usuario.id, agendadoPorNome: usuario.nome,
    });
    res.status(201).json({ id });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao agendar reunião.' });
  }
});

router.patch('/reunioes/:id', async (req, res) => {
  const { status } = req.body ?? {};
  if (!status || !STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ erro: 'Status inválido.' });
  }
  try {
    const reuniao = await buscarReuniaoPorId(req.params.id);
    if (!reuniao) return res.status(404).json({ erro: 'Reunião não encontrada.' });
    await atualizarStatusReuniao(req.params.id, status);
    res.json({ ok: true });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao atualizar reunião.' });
  }
});

export default router;
