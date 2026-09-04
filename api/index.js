import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { verificarToken } from '../backend/gateway/src/verificarToken.js';

// ── Rotas por microsserviço ───────────────────────────────────────────────────
import authRoutes    from '../backend/usuarios-service/src/routes/auth.js';
import usuariosRoutes from '../backend/usuarios-service/src/routes/usuarios.js';
import gruposRoutes  from '../backend/usuarios-service/src/routes/grupos.js';
import regioesRoutes from '../backend/regioes-service/src/routes/regioes.js';

// empresas-service: cadastro de empresas + ocorrências
import empresasRoutes    from '../backend/empresas-service/src/routes/empresas.js';
// import ocorrenciasRoutes from '../backend/empresas-service/src/routes/ocorrencias.js'; // TODO: ativar quando módulo Ocorrências for priorizado

// comercial-service: pipeline comercial (trabalhos, reuniões, propostas)
import trabalhosRoutes from '../backend/comercial-service/src/routes/trabalhos.js';
import reunioesRoutes  from '../backend/comercial-service/src/routes/reunioes.js';
import propostasRoutes from '../backend/comercial-service/src/routes/propostas.js';

// parametro-service: vagas, agenda, incrementos e taxas
import parametroRoutes from '../backend/parametro-service/src/routes/parametro.js';
import taxasRoutes     from '../backend/parametro-service/src/routes/taxas.js';

// ra-service: recrutamento e alocação
import raRoutes from '../backend/ra-service/src/routes/ra.js';

// beneficios-service: dados sensíveis, bancários, documentos, cotas, qualificações, alertas
import beneficiosRoutes from '../backend/beneficios-service/src/routes/beneficios.js';

const app = express();

app.use(cors());
app.use(express.json());

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Evita que picos de requisições (bots, erros de cliente, ataques) esgotem
// o max_user_connections do banco. A Vercel injeta o IP real via x-forwarded-for.

app.set('trust proxy', 1); // necessário para x-forwarded-for funcionar corretamente

/** Rota de login: limite restrito para dificultar força-bruta. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' },
});

/** Rotas gerais da API: limite generoso mas que corta automações descontroladas. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 120,            // 2 req/s por IP — mais que suficiente para uso humano
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições. Aguarde um momento e tente novamente.' },
  skip: (req) => req.path === '/api/health',
});

app.use('/api/auth/login', loginLimiter);
app.use('/api', apiLimiter);

// ── Identidade ────────────────────────────────────────────────────────────────

// Injeta identidade do usuario logado para manter compatibilidade com os servicos
function injetarIdentidade(req, res, next) {
  if (req.usuario) {
    req.headers['x-usuario-id'] = String(req.usuario.id);
    req.headers['x-usuario-nome'] = encodeURIComponent(req.usuario.nome);
    req.headers['x-usuario-tipo'] = req.usuario.tipoUsuario;
  }
  next();
}

// ── Rotas ─────────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', environment: 'vercel-serverless' });
});

// Middleware de autenticação para as rotas protegidas
app.use('/api', (req, res, next) => {
  if (
    req.path.startsWith('/auth') ||
    req.path === '/health' ||
    req.path.includes('/portal') ||
    (req.path.includes('/documentos/') && req.path.includes('/download'))
  ) {
    return next();
  }
  return verificarToken(req, res, next);
}, injetarIdentidade);

// Rotas — agrupadas por microsserviço de origem
app.use('/api', authRoutes);
app.use('/api', usuariosRoutes);
app.use('/api', gruposRoutes);
app.use('/api', regioesRoutes);
app.use('/api', empresasRoutes);
// app.use('/api', ocorrenciasRoutes); // TODO: ativar quando módulo Ocorrências for priorizado
app.use('/api', trabalhosRoutes);
app.use('/api', reunioesRoutes);
app.use('/api', propostasRoutes);
app.use('/api', parametroRoutes);
app.use('/api', taxasRoutes);
app.use('/api', raRoutes);
app.use('/api/beneficios', beneficiosRoutes);
app.use('/api', beneficiosRoutes);

export default app;
