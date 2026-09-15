import mysql from 'mysql2/promise';

const POOL_KEY = '__atesa_mysql_pool';
const isServerless = !!process.env.VERCEL;

/**
 * Detecta se o erro retornado pelo MySQL é transitório / por limite de conexões simultâneas.
 */
function isRetryableDbError(err) {
  if (!err) return false;
  const code = err.code || '';
  const message = String(err.message || '');
  return (
    code === 'ER_USER_LIMIT_REACHED' ||
    code === 'ER_CON_COUNT_ERROR' ||
    code === 'PROTOCOL_CONNECTION_LOST' ||
    code === 'ECONNRESET' ||
    code === 'ETIMEDOUT' ||
    message.includes('max_user_connections') ||
    message.includes('Too many connections') ||
    message.includes('Connection lost') ||
    message.includes('Resource temporarily unavailable')
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executa uma operação no pool com retentativas automáticas e backoff exponencial com jitter
 * em caso de exaustão transitória de conexões no MySQL.
 */
async function executeWithRetry(operation, maxAttempts = 3, label = 'DB') {
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await operation();
    } catch (err) {
      if (attempt < maxAttempts && isRetryableDbError(err)) {
        // Backoff progressivo: ~150ms -> ~350ms -> ~750ms
        const jitter = Math.floor(Math.random() * 100);
        const delay = Math.floor(150 * Math.pow(2, attempt - 1)) + jitter;
        console.warn(`[${label}] Limite/falha transitória de conexão DB (${err.code || err.message}). Tentativa ${attempt}/${maxAttempts} em ${delay}ms...`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
}

/**
 * Cria ou recupera o pool global único, encapsulado com retentativas automáticas.
 *
 * @param {object} env - Configuração de ambiente contendo db { host, port, user, password, database }
 */
export function getDatabasePool(env) {
  if (!global[POOL_KEY]) {
    const rawPool = mysql.createPool({
      host: env.db.host,
      port: env.db.port,
      user: env.db.user,
      password: env.db.password,
      database: env.db.database,
      waitForConnections: true,
      dateStrings: true,
      // No ambiente serverless (Vercel), cada instância/lambda recebe no máximo 1 conexão ativa.
      // Isso permite que até 25-30 lambdas concorrentes coexistam sem estourar max_user_connections no MySQL.
      connectionLimit: isServerless ? 1 : 10,
      maxIdle: isServerless ? 1 : 10,
      queueLimit: isServerless ? 20 : 100,
      // Libera conexões ociosas rapidamente (3s) em serverless para devolver slots livres ao servidor
      idleTimeout: isServerless ? 3000 : 15000,
      enableKeepAlive: true,
      keepAliveInitialDelay: 5000,
      connectTimeout: 10000,
    });

    // Proxy para interceptar chamadas a query, execute e getConnection com auto-retry
    const wrappedPool = new Proxy(rawPool, {
      get(target, prop, receiver) {
        if (prop === 'query') {
          return function (...args) {
            return executeWithRetry(() => target.query(...args), 3, 'pool.query');
          };
        }
        if (prop === 'execute') {
          return function (...args) {
            return executeWithRetry(() => target.execute(...args), 3, 'pool.execute');
          };
        }
        if (prop === 'getConnection') {
          return function (...args) {
            return executeWithRetry(() => target.getConnection(), 3, 'pool.getConnection');
          };
        }
        const val = Reflect.get(target, prop, receiver);
        if (typeof val === 'function') {
          return val.bind(target);
        }
        return val;
      },
    });

    global[POOL_KEY] = wrappedPool;
  }

  return global[POOL_KEY];
}

/**
 * Testa a conectividade com o banco de dados.
 */
export async function testarConexao(poolInstance) {
  const poolToUse = poolInstance || global[POOL_KEY];
  if (!poolToUse) {
    throw new Error('Pool de conexão não inicializado.');
  }
  const conexao = await poolToUse.getConnection();
  try {
    await conexao.ping();
    return true;
  } finally {
    conexao.release();
  }
}
