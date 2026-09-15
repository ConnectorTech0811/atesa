import { env } from './env.js';
import { getDatabasePool, testarConexao as sharedTestarConexao } from '../../../shared/src/database.js';

export const pool = getDatabasePool(env);

export async function testarConexao() {
  return sharedTestarConexao(pool);
}
