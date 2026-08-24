import mysql from 'mysql2/promise';
import { env } from './env.js';

const POOL_KEY = '__atesa_beneficios_pool';

if (!global[POOL_KEY]) {
  global[POOL_KEY] = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    dateStrings: true,
    connectionLimit: 10,
    queueLimit: 50,
    idleTimeout: 60000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });
}

export const pool = global[POOL_KEY];

export async function testarConexao() {
  const conexao = await pool.getConnection();
  try {
    await conexao.ping();
    return true;
  } finally {
    conexao.release();
  }
}
