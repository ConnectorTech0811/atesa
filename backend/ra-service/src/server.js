// Servidor do Microsserviço de RA (Recrutamento & Admissão)
import express from 'express';
import { env } from './config/env.js';
import { testarConexao } from './config/database.js';
import raRoutes from './routes/ra.js';

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  let bancoConectado = false;
  try { bancoConectado = await testarConexao(); } catch { bancoConectado = false; }
  res.json({ servico: 'ra-service', status: 'ok', banco: bancoConectado ? 'conectado' : 'indisponível' });
});

app.use('/', raRoutes);

app.listen(env.port, () => {
  console.log(`[ra-service] rodando na porta ${env.port} (${env.nodeEnv})`);
});
