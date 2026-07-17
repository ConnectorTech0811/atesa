import express from 'express';
import cors from 'cors';
import https from 'https';
import selfsigned from 'selfsigned';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';
import { verificarToken } from './verificarToken.js';

const app = express();
app.use(cors({
  origin: (origin, cb) => {
    if (!origin || origin === config.corsOrigin || /^https:\/\/localhost(:\d+)?$/.test(origin)) {
      cb(null, true);
    } else {
      cb(new Error('CORS não permitido'));
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
    target: config.servicos.empresas,
    changeOrigin: true,
    pathRewrite: (caminho) => `/trabalhos${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

app.use(
  '/api/reunioes',
  verificarToken,
  createProxyMiddleware({
    target: config.servicos.empresas,
    changeOrigin: true,
    pathRewrite: (caminho) => `/reunioes${caminho}`,
    on: { proxyReq: injetarIdentidade },
  })
);

if (config.nodeEnv === 'production') {
  app.listen(config.port, () => {
    console.log(`[gateway] rodando na porta ${config.port} (${config.nodeEnv})`);
  });
} else {
  const attrs = [{ name: 'commonName', value: 'localhost' }];
  const pems = selfsigned.generate(attrs, { days: 365 });
  https.createServer({ key: pems.private, cert: pems.cert }, app).listen(config.port, () => {
    console.log(`[gateway] HTTPS rodando na porta ${config.port} (${config.nodeEnv})`);
  });
}
