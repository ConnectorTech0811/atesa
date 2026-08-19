import mysql from 'mysql2/promise';
import { env } from './env.js';

// Em ambiente serverless (Vercel), múltiplos serviços rodam no mesmo processo.
// Compartilhar um único pool evita que cada serviço abra seu próprio conjunto
// de conexões, prevenindo o estouro de max_user_connections.
const POOL_KEY = '__atesa_mysql_pool';
const isServerless = !!process.env.VERCEL;

if (!global[POOL_KEY]) {
  global[POOL_KEY] = mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.database,
    waitForConnections: true,
    dateStrings: true,            // DATE/DATETIME retornam como string 'YYYY-MM-DD'
    connectionLimit: isServerless ? 3 : 10,
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
