import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const env = {
  port: Number(process.env.PORT ?? 3003),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3307),
    user: process.env.DB_USER ?? 'atesa',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'empresas_db',
  },
  servicos: {
    regioes: process.env.REGIOES_SERVICE_URL ?? 'http://localhost:3001',
    usuarios: process.env.USUARIOS_SERVICE_URL ?? 'http://localhost:3002',
  },
};
