import express from 'express';
import { env } from './config/env.js';
import { testarConexao } from './config/database.js';
import regioesRoutes from './routes/regioes.js';

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  let bancoConectado = false;
  try {
    bancoConectado = await testarConexao();
  } catch {
    bancoConectado = false;
  }
  res.json({ servico: 'regioes-service', status: 'ok', banco: bancoConectado ? 'conectado' : 'indisponível' });
});

app.use('/', regioesRoutes);

app.listen(env.port, () => {
  console.log(`[regioes-service] rodando na porta ${env.port} (${env.nodeEnv})`);
});
