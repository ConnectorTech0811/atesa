import express from 'express';
import cors from 'cors';
import authRoutes from '../backend/usuarios-service/src/routes/auth.js';
import usuariosRoutes from '../backend/usuarios-service/src/routes/usuarios.js';
import regioesRoutes from '../backend/regioes-service/src/routes/regioes.js';
import empresasRoutes from '../backend/empresas-service/src/routes/empresas.js';
import trabalhosRoutes from '../backend/empresas-service/src/routes/trabalhos.js';
import reunioesRoutes from '../backend/empresas-service/src/routes/reunioes.js';
import { verificarToken } from '../backend/gateway/src/verificarToken.js';

const app = express();

app.use(cors());
app.use(express.json());

// Injeta identidade do usuario logado para manter compatibilidade com os servicos
function injetarIdentidade(req, res, next) {
  if (req.usuario) {
    req.headers['x-usuario-id'] = String(req.usuario.id);
    req.headers['x-usuario-nome'] = encodeURIComponent(req.usuario.nome);
    req.headers['x-usuario-tipo'] = req.usuario.tipoUsuario;
  }
  next();
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', environment: 'vercel-serverless' });
});

// Rotas publicas
app.use('/api', authRoutes);

// Middleware de autenticação para as rotas protegidas
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login' || req.path === '/health') {
    return next();
  }
  return verificarToken(req, res, next);
}, injetarIdentidade);

// Rotas protegidas
app.use('/api', usuariosRoutes);
app.use('/api', regioesRoutes);
app.use('/api', empresasRoutes);
app.use('/api', trabalhosRoutes);
app.use('/api', reunioesRoutes);

export default app;
