import { Router } from 'express';
import { buscarRegiaoPorId, listarRegioes } from '../repositories/regioesRepository.js';

const router = Router();

router.get('/regioes', async (_req, res) => {
  try {
    const regioes = await listarRegioes();
    res.json(regioes);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao listar regiões.' });
  }
});

router.get('/regioes/:id', async (req, res) => {
  try {
    const regiao = await buscarRegiaoPorId(req.params.id);
    if (!regiao) return res.status(404).json({ erro: 'Região não encontrada.' });
    res.json(regiao);
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: 'Erro ao buscar região.' });
  }
});

export default router;
