import express from 'express';
import cors from 'cors';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';
import { verificarToken } from './verificarToken.js';

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    if (
      !origin ||
      origin === config.corsOrigin ||
      /^https?:\/\/localhost(:\d+)?$/.test(origin) ||
      /^https?:\/\/.*\.connectortech\.com\.br$/.test(origin) ||
      /^https?:\/\/.*\.vercel\.app$/.test(origin) ||
      (process.env.CORS_ORIGIN && process.env.CORS_ORIGIN.split(',').map((s) => s.trim()).includes(origin))
    ) {
      cb(null, true);
    } else {
      cb(new Error(`CORS não permitido para origem: ${origin}`));
    }
  },
  credentials: true,
}));

// IMPORTANTE: nenhum middleware de parsing de body (express.json) é usado
// aqui, pois consumiria o stream da requisição antes do proxy repassá-lo
// ao serviço de destino. Quem faz parsing do corpo é o serviço final.
//
// Express já remove o prefixo do app.use(...) do req.url antes de chamar
// o middleware do proxy. Por isso o pathRewrite recompõe o caminho com
// uma função, em vez de tentar casar um regex que já não existe mais ali.

/** Repassa a identidade do usuário (já validada pelo verificarToken) aos
 * serviços internos via cabeçalhos confiáveis. Os serviços nunca devem
 * confiar em algo equivalente vindo do corpo da requisição do cliente. */
function injetarIdentidade(proxyReq, req) {
  if (req.usuario) {
    proxyReq.setHeader('X-Usuario-Id', String(req.usuario.id));
    proxyReq.setHeader('X-Usuario-Nome', encodeURIComponent(req.usuario.nome));
    proxyReq.setHeader('X-Usuario-Tipo', req.usuario.tipoUsuario);
    if (req.usuario.permissoes) {
      proxyReq.setHeader('X-Usuario-Permissoes', encodeURIComponent(JSON.stringify(req.usuario.permissoes)));
    }
  }
}

app.get('/api/health', async (_req, res) => {
  const servicos = ['regioes', 'usuarios', 'empresas'];
  const resultados = await Promise.all(
    servicos.map(async (nome) => {
      try {
        const resposta = await fetch(`${config.servicos[nome]}/health`, { signal: AbortSignal.timeout(2000) });
        return [nome, resposta.ok ? await resposta.json() : { status: 'erro' }];
      } catch {
        return [nome, { status: 'indisponível' }];
      }
    })
  );
  res.json({ gateway: 'ok', servicos: Object.fromEntries(resultados) });
});

// Rota pública - login emite o token usado em todas as demais rotas
app.use(
  '/api/auth',
  createProxyMiddleware({
    target: config.servicos.usuarios,
    changeOrigin: true,
    pathRewrite: (caminho) => `/auth${caminho}`,
  })
);

// Rotas protegidas - exigem token válido
app.use(
  '/api/usuarios',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.usuarios,
    changeOrigin: true,
    pathRewrite: (caminho) => `/usuarios${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/regioes',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.regioes,
    changeOrigin: true,
    pathRewrite: (caminho) => `/regioes${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

// Rotas /api/empresas/:id/(trabalhos|reunioes|propostas) pertencem ao comercial-service.
// Devem ficar ANTES da rota genérica /api/empresas para não serem capturadas pelo empresas-service.
// Nota: com regex no app.use(), Express faz strip do caminho para '/', então usa-se req.originalUrl.
app.use(
  /^\/api\/empresas\/\d+\/(trabalhos|reunioes|propostas)(\/|$)/,
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.comercial,
    changeOrigin: true,
    pathRewrite: (_caminho, req) => req.originalUrl.replace(/^\/api/, ''),
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/empresas',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.empresas,
    changeOrigin: true,
    pathRewrite: (caminho) => `/empresas${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/trabalhos',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.comercial,
    changeOrigin: true,
    pathRewrite: (caminho) => `/trabalhos${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/grupos',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.usuarios,
    changeOrigin: true,
    pathRewrite: (caminho) => `/grupos${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/reunioes',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.comercial,
    changeOrigin: true,
    pathRewrite: (caminho) => `/reunioes${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/propostas',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.comercial,
    changeOrigin: true,
    pathRewrite: (caminho) => `/propostas${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/parametro',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.parametro,
    changeOrigin: true,
    pathRewrite: (caminho) => `/parametro${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/taxas',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.taxas || config.servicos.parametro,
    changeOrigin: true,
    pathRewrite: (caminho) => `/taxas${caminho.replace(/^\/taxas/, '')}`,
    on: { proxyReq: injetarIdentidade },
  })
);

// Rota pública do Portal do Cooperado — acesso com token de cadastro sem exigir login
app.use(
  ['/api/beneficios/portal', '/api/api/beneficios/portal', '/beneficios/portal'],
  createProxyMiddleware({
    target: config.servicos.beneficios,
    changeOrigin: true,
    pathRewrite: (caminho) => `/portal${caminho.replace(/^\/portal/, '')}`,
  })
);

// Download / Visualização pública de documentos
app.use(
  ['/api/beneficios/documentos', '/api/api/beneficios/documentos', '/beneficios/documentos'],
  createProxyMiddleware({
    target: config.servicos.beneficios,
    changeOrigin: true,
    pathRewrite: (caminho) => `/documentos${caminho.replace(/^\/documentos/, '')}`,
  })
);

app.use(
  '/api/beneficios',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.beneficios,
    changeOrigin: true,
    pathRewrite: (caminho) => caminho,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/ra',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.ra,
    changeOrigin: true,
    pathRewrite: (caminho) => `/ra${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

// Ocorrências ficam no empresas-service mas têm prefixo próprio (/ocorrencias)
app.use(
  '/api/ocorrencias',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.empresas,
    changeOrigin: true,
    pathRewrite: (caminho) => `/ocorrencias${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.listen(config.port, () => {
  console.log(`[gateway] rodando na porta ${config.port} (${config.nodeEnv})`);
});
