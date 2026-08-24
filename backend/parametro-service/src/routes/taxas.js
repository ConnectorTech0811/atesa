import { Router } from 'express';
import { criarVerificadorAcesso } from '../../../shared/src/auth.js';
import {
  listarParametros,
  atualizarParametros,
  listarTodasCargos,
  substituirCargosDaCooperativa,
} from '../repositories/taxasRepository.js';

const router = Router();
const soAdmin = criarVerificadorAcesso(['administrador'], 'Taxas e Impostos');

// ── GET /api/taxas ────────────────────────────────────────────────────────────
router.get('/taxas', async (req, res) => {
  try {
    const [parametros, cargos] = await Promise.all([
      listarParametros(),
      listarTodasCargos(),
    ]);
    res.json({ parametros, cargos });
  } catch (e) {
    console.error('GET /taxas:', e);
    res.status(500).json({ erro: 'Erro ao carregar taxas e impostos.' });
  }
});

// ── PUT /api/taxas/parametros ─────────────────────────────────────────────────
router.put('/taxas/parametros', async (req, res) => {
  const usuario = soAdmin(req, res);
  if (!usuario) return;
  try {
    await atualizarParametros(req.body);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /taxas/parametros:', e);
    res.status(500).json({ erro: 'Erro ao salvar parâmetros.' });
  }
});

// ── PUT /api/taxas/cargos/:cooperativa ───────────────────────────────────────
router.put('/taxas/cargos/:cooperativa', async (req, res) => {
  const usuario = soAdmin(req, res);
  if (!usuario) return;
  const { cooperativa } = req.params;
  const { cargos } = req.body; // string[]
  if (!Array.isArray(cargos)) {
    return res.status(400).json({ erro: 'Campo "cargos" deve ser um array de strings.' });
  }
  try {
    await substituirCargosDaCooperativa(cooperativa, cargos);
    res.json({ ok: true });
  } catch (e) {
    console.error('PUT /taxas/cargos:', e);
    res.status(500).json({ erro: 'Erro ao salvar lista de cargos.' });
  }
});

export default router;
