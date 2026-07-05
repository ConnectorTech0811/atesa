import express from 'express';
import { env } from './config/env.js';
import { testarConexao } from './config/database.js';
import authRoutes from './routes/auth.js';
import usuariosRoutes from './routes/usuarios.js';

const app = express();
app.use(express.json());

app.get('/health', async (_req, res) => {
  let bancoConectado = false;
  try {
    bancoConectado = await testarConexao();
  } catch {
    bancoConectado = false;
  }
  res.json({ servico: 'usuarios-service', status: 'ok', banco: bancoConectado ? 'conectado' : 'indisponível' });
});

app.use('/', authRoutes);
app.use('/', usuariosRoutes);

app.listen(env.port, () => {
  console.log(`[usuarios-service] rodando na porta ${env.port} (${env.nodeEnv})`);
});
