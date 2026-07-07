import express from 'express';
import { env } from './config/env.js';
import { testarConexao } from './config/database.js';
import empresasRoutes from './routes/empresas.js';
import trabalhosRoutes from './routes/trabalhos.js';
import reunioesRoutes from './routes/reunioes.js';

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  let bancoConectado = false;
  try {
    bancoConectado = await testarConexao();
  } catch {
    bancoConectado = false;
  }
  res.json({ servico: 'empresas-service', status: 'ok', banco: bancoConectado ? 'conectado' : 'indisponível' });
});

app.use('/', empresasRoutes);
app.use('/', trabalhosRoutes);
app.use('/', reunioesRoutes);

app.listen(env.port, () => {
  console.log(`[empresas-service] rodando na porta ${env.port} (${env.nodeEnv})`);
});
