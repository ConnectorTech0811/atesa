import express from 'express';
import { env } from './config/env.js';
import { testarConexao } from './config/database.js';
import supervisaoRoutes from './routes/supervisao.js';

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use('/', supervisaoRoutes);
app.use('/supervisao', supervisaoRoutes);
app.use('/monitoramento', supervisaoRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    const db = await testarConexao();
    res.json({ status: 'ok', service: 'supervisao-service', port: env.port, db });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'supervisao-service', db: false });
  }
});

// ── Inicialização ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`[supervisao-service] Rodando na porta ${env.port} (${env.nodeEnv})`);
});

export default app;
