import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from '../config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function executarArquivo(nomeArquivo) {
  const caminho = path.join(__dirname, nomeArquivo);
  const sqlSemComentarios = fs
    .readFileSync(caminho, 'utf-8')
    .split('\n')
    .filter((linha) => !linha.trim().startsWith('--'))
    .join('\n');

  const comandos = sqlSemComentarios
    .split(';')
    .map((c) => c.trim())
    .filter((c) => c.length > 0);

  for (const comando of comandos) {
    await pool.query(comando);
  }
}

async function main() {
  console.log('[empresas-service] Aplicando schema.sql...');
  await executarArquivo('schema.sql');
  console.log('[empresas-service] Aplicando seed.sql...');
  await executarArquivo('seed.sql');
  console.log('[empresas-service] Migração concluída com sucesso.');
  process.exit(0);
}

main().catch((erro) => {
  console.error('[empresas-service] Erro ao migrar banco de dados:', erro);
  process.exit(1);
});
