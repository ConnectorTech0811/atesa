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
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// A Vercel encaminha o IP real do cliente via x-forwarded-for
app.set('trust proxy', 1);

// ── Proteção contra Scanners e Bots Maliciosos ───────────────────────────────
// Descarta imediatamente requisições automatizadas de varredura/exploits comuns
// antes que toquem o banco de dados ou acionem o runtime serverless.
app.use((req, res, next) => {
  const url = (req.originalUrl || req.url || '').toLowerCase();
  if (
    url.includes('.php') ||
    url.includes('.env') ||
    url.includes('.git') ||
    url.includes('/wp-') ||
    url.includes('/wordpress') ||
    url.includes('/cgi-bin') ||
    url.includes('/actuator') ||
    url.includes('/boaform') ||
    url.includes('/vendor/') ||
    url.includes('/phpmyadmin') ||
    url.includes('/autoload.php')
  ) {
    return res.status(404).json({ erro: 'Recurso não encontrado.' });
  }
  next();
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Protege o banco MySQL contra picos de tráfego de bots/scanners que esgotam o max_user_connections.

/** Rota de login: limite restrito para conter ataques de força-bruta e bursts. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas de login. Aguarde 15 minutos e tente novamente.' },
});

/** Rotas do portal público do cooperado. */
const portalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições ao portal. Aguarde um momento e tente novamente.' },
});

/** Rotas gerais da API: 180 req/min (3 req/s por IP) — amplo para navegação legítima e dashboards. */
const apiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas requisições em pouco tempo. Aguarde um momento e tente novamente.' },
  skip: (req) => req.path === '/api/health' || req.path === '/health',
});

app.use('/api/auth/login', loginLimiter);
app.use('/api/beneficios/portal', portalLimiter);
app.use('/api/portal', portalLimiter);
app.use('/api', apiLimiter);

// ── Identidade ────────────────────────────────────────────────────────────────

// Injeta identidade do usuario logado para manter compatibilidade com os servicos
function injetarIdentidade(req, res, next) {
  if (req.usuario) {
    req.headers['x-usuario-id'] = String(req.usuario.id);
    req.headers['x-usuario-nome'] = encodeURIComponent(req.usuario.nome);
    req.headers['x-usuario-tipo'] = req.usuario.tipoUsuario;
    if (req.usuario.regiaoId) {
      req.headers['x-usuario-regiao-id'] = String(req.usuario.regiaoId);
    }
  }
  next();
}

// ── Rotas ─────────────────────────────────────────────────────────────────────

// Health check (rápido e sem tocar o DB)
app.get(['/api/health', '/health'], (_req, res) => {
  res.json({ status: 'ok', environment: 'vercel-serverless', timestamp: new Date().toISOString() });
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

// Resposta 404 explícita para rotas /api não existentes (evita processamento desnecessário)
app.all('/api/*', (req, res) => {
  res.status(404).json({
    erro: `Rota ${req.method} ${req.path} não encontrada.`,
    status: 404,
  });
});

// ── Middleware global de tratamento de erros ───────────────────────────────────
app.use((err, req, res, next) => {
  const errMsg = String(err?.message || '');
  const errCode = err?.code || '';
  
  console.error('[API Error]', req.method, req.originalUrl || req.path, errCode || errMsg);

  if (res.headersSent) {
    return next(err);
  }

  // Tratamento resiliente para exaustão temporária de conexões com o MySQL
  if (
    errCode === 'ER_USER_LIMIT_REACHED' ||
    errCode === 'ER_CON_COUNT_ERROR' ||
    errMsg.includes('max_user_connections') ||
    errMsg.includes('Too many connections')
  ) {
    res.setHeader('Retry-After', '2');
    return res.status(503).json({
      erro: 'Serviço temporariamente ocupado com alto volume de conexões. Por favor, tente novamente em alguns segundos.',
      status: 503,
    });
  }

  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    erro: err.message || 'Erro interno do servidor',
    status,
  });
});

export default app;
