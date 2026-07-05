import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

export const config = {
  port: Number(process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:8100',
  jwtSecret: process.env.JWT_SECRET ?? 'changeme',
  servicos: {
    regioes: process.env.REGIOES_SERVICE_URL ?? 'http://localhost:3001',
    usuarios: process.env.USUARIOS_SERVICE_URL ?? 'http://localhost:3002',
    empresas: process.env.EMPRESAS_SERVICE_URL ?? 'http://localhost:3003',
  },
};
