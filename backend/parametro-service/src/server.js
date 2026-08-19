import express from 'express';
import { env } from './config/env.js';
import { testarConexao } from './config/database.js';
import parametroRoutes from './routes/parametro.js';

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  let bancoConectado = false;
  try { bancoConectado = await testarConexao(); } catch { bancoConectado = false; }
  res.json({ servico: 'parametro-service', status: 'ok', banco: bancoConectado ? 'conectado' : 'indisponível' });
});

app.use('/', parametroRoutes);

app.listen(env.port, () => {
  console.log(`[parametro-service] rodando na porta ${env.port} (${env.nodeEnv})`);
});
