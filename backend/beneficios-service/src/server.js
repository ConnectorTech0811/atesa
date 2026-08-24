import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { env } from './config/env.js';
import { testarConexao } from './config/database.js';
import beneficiosRoutes from './routes/beneficios.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ── Arquivos estáticos (documentos enviados) ──────────────────────────────────
const UPLOADS_DIR = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(UPLOADS_DIR));

// ── Rotas ─────────────────────────────────────────────────────────────────────
app.use('/', beneficiosRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get('/health', async (_req, res) => {
  try {
    const db = await testarConexao();
    res.json({ status: 'ok', service: 'beneficios-service', port: env.port, db });
  } catch {
    res.status(503).json({ status: 'degraded', service: 'beneficios-service', db: false });
  }
});

// ── Inicialização ─────────────────────────────────────────────────────────────
app.listen(env.port, () => {
  console.log(`[beneficios-service] Rodando na porta ${env.port} (${env.nodeEnv})`);
});

export default app;
